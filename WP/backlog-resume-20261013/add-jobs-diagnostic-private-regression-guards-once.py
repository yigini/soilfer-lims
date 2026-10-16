"""Add meaningful privacy, shared-sink and BEFORE_ROOT guards to the new source only."""
import ast,pathlib
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/jobs-row-diagnostic-private-be837974-20261016'
p=S/'run_diagnostic.py';s=p.read_text();old="    package_check(root);sink=Sink(root);install_value_key(os.urandom(32))\n    sink.write('private-value-hmac-key.json',{'algorithm':'HMAC-SHA256','keyHex':_run_key_hex(),'withheld':True})"
assert s.count(old)==1
s=s.replace(old,"    package_check(root);sink=initialize_sink(root)")
insert="""def initialize_sink(root):
    sink=Sink(root);install_value_key(os.urandom(32))
    sink.write('private-value-hmac-key.json',{'algorithm':'HMAC-SHA256','keyHex':_run_key_hex(),'withheld':True})
    return sink

"""
assert s.count('def run():')==1;p.write_bytes(s.replace('def run():',insert+'def run():').encode())
# Resolve metadata beside the reviewed launcher, including in-memory host tests.
p=S/'launch_diagnostic.py';s=p.read_text();old="strict((REPO/REL/'diagnostic-pins.json').read_bytes())";assert s.count(old)==1;p.write_bytes(s.replace(old,"strict(pathlib.Path(__file__).with_name('diagnostic-pins.json').read_bytes())").encode())
p=S/'verify_diagnostic.py';s=p.read_text();assert 'class PrivacyGuards' not in s
s=s.replace("if __name__=='__main__':unittest.main(verbosity=2)",'')
s+='''
class PrivacyGuards(unittest.TestCase):
    def test_hmac_known_vector_and_no_plain_scalar_digest(self):
        import hmac,hashlib
        for value in [14.634915,-90.506777,'2026-10-15T10:12:13Z','Surveyor Private Name',None,True,42]:
            raw=c.canonical(c.projection(value))
            self.assertEqual(c.value_hash(value),hmac.new(bytes(range(32)),raw,hashlib.sha256).hexdigest())
            self.assertNotEqual(c.value_hash(value),c.sha(raw))
    def test_fresh_key_required_no_plain_fallback(self):
        with mock.patch.object(c,'_value_key',None):
            with self.assertRaises(RuntimeError):c.value_hash('private')
            for key in [b'x'*31,b'x'*33,'x'*32]:
                with self.assertRaises(RuntimeError):c.install_value_key(key)
            c.install_value_key(b'x'*32)
            with self.assertRaises(RuntimeError):c.install_value_key(b'x'*32)
    def test_different_run_keys_unlink_public_values(self):
        first=c.value_hash(14.634915)
        with mock.patch.object(c,'_value_key',b'x'*32):self.assertNotEqual(first,c.value_hash(14.634915))
    def revision(self):
        f=list(fixture());old=json.loads(f[1]['metadata']);old['conflictingSubmissions'][0].update(lat=14.634915,lng=-90.506777,collected_at='2026-10-14T09:32:11Z',surveyor='Private Surveyor Alpha',site_id='PRIVATE_SITE_A')
        new=copy.deepcopy(old);new['conflictingSubmissions'][0].update(lat=14.634999,lng=-90.506701,collected_at='2026-10-15T10:43:22Z',surveyor='Private Surveyor Beta',site_id='PRIVATE_SITE_B')
        f[0]['metadata']=json.dumps(old);f[1]['metadata']=json.dumps(new);f[0]['rejectionReason']=c.REJECTION
        return f,old['conflictingSubmissions'][0],new['conflictingSubmissions'][0]
    def assert_private(self,result,*rows):
        text=json.dumps(result)
        for row in rows:
            for key in ['lat','lng','collected_at','surveyor','site_id']:
                value=row[key]
                self.assertNotIn(str(value),text)
                self.assertNotIn(c.sha(c.canonical(c.projection(value))),text)
                self.assertNotIn(c.sha(str(value).encode()),text)
        self.assertNotIn('keyHex',text)
    def test_in_place_revision_classification_private_unexplained(self):
        f,old,new=self.revision();v=d.classify_sample(*f)
        self.assertEqual(v['classification'],'UNEXPLAINED');self.assertIn('reason',v['refusal']);self.assert_private(v,old,new)
    def test_in_place_revision_all112_result_private_and_raw_withheld(self):
        f,old,new=self.revision();a,b=full_store_pair()
        try:
            for db,row in [(a,f[0]),(b,f[1])]:db.execute('UPDATE Sample SET metadata=?,rejectionReason=? WHERE id=?',(row['metadata'],row['rejectionReason'],row['id']))
            sink=MemorySink();v=d.compare_all(a,b,f[3],{},sink)
            self.assertEqual(v['tableCount'],112);self.assertEqual(v['changedSamples'][0]['classification'],'UNEXPLAINED');self.assertTrue(v['stopClassifications']);self.assert_private(v,old,new)
            self.assertIn(str(old['lat']),json.dumps(sink.rows));self.assertIn(new['surveyor'],json.dumps(sink.rows))
            self.assertTrue(all(n.startswith('private-') for n,row in sink.rows))
        finally:a.close();b.close()
    def test_static_refusal_and_literal_key_are_readable(self):
        self.assertEqual(c.public_failure(RuntimeError('Old metadata array changed'))['reason'],'Old metadata array changed')
        self.assertEqual(c.public_failure(KeyError('metadata'))['reason'],'Missing literal key: metadata')
    def test_dynamic_exception_text_is_keyed_and_never_public(self):
        value='Private Surveyor Alpha 14.634915'
        for error in [ValueError(value),RuntimeError(value),KeyError(value),sqlite3.DatabaseError(value)]:
            v=c.public_failure(error);self.assertEqual(v['errorHmacSha256'],c.value_hash(str(error)));self.assertNotIn(value,json.dumps(v));self.assertNotIn(c.sha(str(error).encode()),json.dumps(v))
    def test_run_key_private_exclusive_0400_and_in_shared_manifest(self):
        import run_diagnostic as run,stat
        root=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'private-key';root.mkdir()
        with mock.patch.object(c,'_value_key',None),mock.patch.object(run.os,'urandom',return_value=b'k'*32) as random:
            sink=run.initialize_sink(root);random.assert_called_once_with(32)
            raw=(root/'private-value-hmac-key.json').read_bytes();v=json.loads(raw);self.assertEqual(v['keyHex'],(b'k'*32).hex());self.assertTrue(sink.files[0]['withheld']);self.assertEqual(sink.bytes,len(raw));self.assertEqual(sink.files[0]['sha256'],c.sha(raw))
            if os.name!='nt':self.assertEqual(stat.S_IMODE((root/'private-value-hmac-key.json').stat().st_mode),0o400)
            with self.assertRaises(RuntimeError):run.initialize_sink(root)
        self.assertNotIn((b'k'*32).hex(),json.dumps(sink.files))
    def controller(self,sink,label):
        import run_diagnostic as run
        def raw(p):
            return {'memory.events':b'low 0\\nhigh 0\\nmax 1\\noom 0\\noom_kill 0\\n','memory.max':str(c.MEMORY).encode(),'memory.swap.max':b'0','memory.peak':b'123'}[p.name]
        with mock.patch.object(pathlib.Path,'read_text',return_value='0::/system.slice/'+c.UNIT+'.service\\n'),mock.patch.object(pathlib.Path,'read_bytes',autospec=True,side_effect=raw),mock.patch.object(pathlib.Path,'is_symlink',return_value=False),mock.patch.object(run,'Sink',side_effect=AssertionError('Hidden second sink')):run.own_events(sink,label)
    def test_controller_memory_both_files_share_manifest_and_cap(self):
        root=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'controller-shared';root.mkdir();sink=io.Sink(root)
        self.controller(sink,'before');self.controller(sink,'after');self.assertEqual(len(sink.files),2)
        self.assertEqual(sink.bytes,sum(p.stat().st_size for p in root.iterdir()));self.assertEqual({f['file'] for f in sink.files},{'controller-memory-before.json','controller-memory-after.json'})
    def test_controller_memory_cannot_bypass_output_cap(self):
        root=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'controller-cap';root.mkdir();sink=io.Sink(root,1)
        with self.assertRaises(RuntimeError):self.controller(sink,'before')
        self.assertEqual(list(root.iterdir()),[])
    def preflight(self,label,mutate=None,extra=None,race=False):
        import stat,types
        root,pins,states=Guards().pinned_inputs('preflight-'+label);new=root/'unused-new-root'
        if mutate:mutate(states[str(root/c.MAINS[1])])
        if extra:(root/(c.MAINS[1]+extra)).write_bytes(b'')
        tree=ast.parse(launch.PREFLIGHT);branch=next(n for n in tree.body if isinstance(n,ast.If) and isinstance(n.test,ast.Compare) and isinstance(n.test.left,ast.Subscript))
        code=compile(ast.fix_missing_locations(ast.Module(body=branch.body,type_ignores=[])),'actual-before-root-stat-branch','exec');calls=[]
        original_lstat=pathlib.Path.lstat
        def lstat(p):
            if str(p) not in states:return original_lstat(p)
            v=states[str(p)];calls.append(str(p));return types.SimpleNamespace(st_mode=stat.S_IFREG|v['mode'],st_nlink=v['nlink'],st_dev=v['device'],st_ino=v['inode'],st_size=v['bytes'],st_blocks=v['allocatedBytes']//512,st_mtime_ns=v['mtimeNs'],st_ctime_ns=v['ctimeNs']+(1 if race and len(calls)>6 else 0))
        namespace={'C':{'oldRoot':str(root.resolve()),'mains':c.MAINS,'inputPins':pins},'r':new,'pathlib':pathlib,'stat':stat}
        with mock.patch.object(pathlib.Path,'lstat',autospec=True,side_effect=lstat),mock.patch.object(pathlib.Path,'read_bytes',side_effect=AssertionError('No hashing/content in BEFORE_ROOT')),mock.patch.object(sqlite3,'connect',side_effect=AssertionError('No SQL in BEFORE_ROOT')):
            exec(code,namespace)
        self.assertFalse(new.exists());return calls
    def test_before_root_actual_stat_branch_reads_all_six_twice(self):self.assertEqual(len(self.preflight('positive')),12)
    def test_before_root_extra_journal_refuses(self):
        with self.assertRaises(AssertionError):self.preflight('journal',extra='-journal')
    def test_before_root_nlink_refuses(self):
        with self.assertRaises(AssertionError):self.preflight('nlink',lambda v:v.update(nlink=2))
    def test_before_root_ctime_race_refuses(self):
        with self.assertRaises(AssertionError):self.preflight('race',race=True)
    def test_optional_inaccessible_paths_and_new_review_floor(self):
        self.assertIn('InaccessiblePaths=-/var/lib/docker/volumes -/opt/lims/backups',launch.UNIT_PROGRAM)
        self.assertIn('privacyFindingsId=6206214444',c.tokens({'head':'a'*40,'files':{},'data':{}}));self.assertIn('publicValueHash=HMAC-SHA256',c.tokens({'head':'a'*40,'files':{},'data':{}}))

def preflight_negative(field):
    def test(self):
        def change(v):v[field]+=512 if field=='allocatedBytes' else 1
        with self.assertRaises(AssertionError):self.preflight(field,change)
    setattr(PrivacyGuards,'test_before_root_pin_'+field,test)
for field in ['bytes','allocatedBytes','device','inode','mode','mtimeNs']:preflight_negative(field)
if __name__=='__main__':unittest.main(verbosity=2)
'''
compile(s,'verify_diagnostic.py','exec');p.write_bytes(s.encode())
for p in S.glob('*.py'):compile(p.read_bytes(),p.name,'exec')
print('New privacy and actual preflight regression guards added; no tests/operators executed')
