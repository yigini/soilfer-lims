"""Closed synthetic guards plus the actual byte-bound app writer function.

No real Docker/SSH/Git/production SQLite call is allowed in this suite.
Node runs only the unpatched bound controller with inert application imports.
"""
import ast,base64,copy,io,json,os,pathlib,subprocess,sys,tempfile,unittest
from unittest import mock
import diagnostic_contract as c
import diagnostic_io as disk
import provenance_privacy as privacy
import provenance_rules as rules
import stop_owned as stop
import prior_provenance_guards as prior
B=pathlib.Path(__file__).resolve().parent
def setUpModule():
    if privacy._value_key is None:privacy.install_value_key(bytes(range(32)))
class FingerprintGuards(unittest.TestCase):
    def test_actual_bound_writer_output_through_checked_cross(self):
        provided=os.environ.get('LIMS_ACTUAL_WRITER_PROBE_JSON')
        if provided:
            result=json.loads(provided)
            self.assertTrue(result['sourceUnpatched']);self.assertEqual(result['producer'],'ACTUAL_LOCAL_NODE_UNPATCHED_BOUND_CONTROLLER')
        else:
            run=subprocess.run(['node',str(B/'writer_fingerprint.cjs')],capture_output=True,timeout=15)
            self.assertEqual(run.returncode,0,run.stderr.decode('utf-8','replace'));self.assertEqual(run.stderr,b'');result=json.loads(run.stdout)
        self.assertEqual(result['sourceSha256'],c.sha((B/'application-source-fixtures/server/controllers/koboController.js').read_bytes()))
        f=prior.fixture();prior.edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(evidenceFingerprint=result['fingerprint']))
        self.assertEqual(prior.verify(f)['changedSamples'][0]['classification'],'CROSS_SUBMISSION_DUPLICATE')
    def test_writer_source_bound_16_no_dual_format(self):
        raw=(B/'provenance_rules.py').read_text(encoding='utf-8');self.assertIn("re.fullmatch('[a-f0-9]{16}',e['evidenceFingerprint'])",raw);self.assertNotIn("re.fullmatch('[a-f0-9]{64}',e['evidenceFingerprint'])",raw)
    def test_in_place_revision_is_explicit_conservative_refusal(self):
        f=prior.fixture();f['old']['metadata']=f['after']['metadata']
        prior.edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(lat=1))
        self.assertEqual(rules.classify_sample(f['old'],f['after'],f['configs'],f['fetch'],f['holds'],f['audits'])['classification'],'UNEXPLAINED')
def bad_fingerprint(name,value):
    def test(self):
        f=prior.fixture();prior.edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(evidenceFingerprint=value))
        with self.assertRaisesRegex(RuntimeError,'Conflict evidence identity/time malformed'):prior.verify(f)
    setattr(FingerprintGuards,'test_refuse_'+name,test)
for n,v in [('64hex','f'*64),('uppercase','F'*16),('15chars','f'*15),('17chars','f'*17),('nonstring',123)]:bad_fingerprint(n,v)
class HookEvidenceGuards(unittest.TestCase):
    def root(self):
        p=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR'])/self._testMethodName;p.mkdir();return p
    def test_call_records_stderr_before_refusal_and_keeps_text_private(self):
        root=self.root()
        def fake(args,stdout,stderr,timeout):stdout.write(b'[{"Config":{"Env":["JWT_SECRET=PRIVATE_SENTINEL"]}}]');stderr.write(b'PRIVATE_WARNING');return subprocess.CompletedProcess(args,0)
        with mock.patch.object(stop,'_record_root',root),mock.patch.object(stop,'_sequence',0),mock.patch.object(stop.subprocess,'run',fake):
            with self.assertRaisesRegex(RuntimeError,'Bounded exact-owner stop interface failed'):stop.call(['docker','inspect','a'*64])
        record=json.loads((root/'docker-call-001.json').read_bytes());self.assertEqual(record['streams']['stderr']['bytes'],15)
        self.assertNotIn('PRIVATE_SENTINEL',json.dumps(record));self.assertNotIn('PRIVATE_WARNING',json.dumps(record));self.assertTrue((root/'private-docker-call-001-stdout.bin').is_file())
        if os.name!='nt':self.assertEqual((root/'private-docker-call-001-stdout.bin').stat().st_mode&0o777,0o400)
    def test_call_timeout_records_streams_and_phase(self):
        root=self.root()
        def fake(args,stdout,stderr,timeout):stderr.write(b'private');raise subprocess.TimeoutExpired(args,timeout)
        with mock.patch.object(stop,'_record_root',root),mock.patch.object(stop,'_sequence',0),mock.patch.object(stop.subprocess,'run',fake):
            result=stop.stop_exact(stop.readonly_call)
        self.assertEqual(len(result['errors']),2);self.assertTrue(all(e['phase']=='inventory' for e in result['errors']))
        public=stop.public_result(result);self.assertTrue(all('errorHmacSha256' in e for e in public['errors']));self.assertNotIn('private',json.dumps(public))
        self.assertEqual(len(list(root.glob('docker-call-*.json'))),2)
    def test_stderr_static_literal_published_only_at_exact_site(self):
        root=self.root()
        def fake(args,stdout,stderr,timeout):stderr.write(b'not public');return subprocess.CompletedProcess(args,0)
        with mock.patch.object(stop,'_record_root',root),mock.patch.object(stop,'_sequence',0),mock.patch.object(stop.subprocess,'run',fake):r=stop.public_result(stop.stop_exact(stop.readonly_call))
        self.assertTrue(all(e.get('literalRequire')=='Bounded exact-owner stop interface failed' for e in r['errors']))
    def test_readonly_wrapper_refuses_stop_before_real_call(self):
        with mock.patch.object(stop,'call',side_effect=AssertionError('must not execute')):
            with self.assertRaisesRegex(RuntimeError,'only ps and inspect'):stop.readonly_call(['docker','stop','a'*64])
    def test_stopped_path_executes_only_ps_inspect(self):
        running={o:False for o in stop.OWNERS};seen=[]
        def call(args):
            seen.append(args);owner=next(o for o in stop.OWNERS if args[-1].endswith(o)) if args[1]=='ps' else sorted(stop.OWNERS)[0 if args[-1]=='a'*64 else 1]
            id=('a' if owner==sorted(stop.OWNERS)[0] else 'b')*64
            if args[1]=='ps':return (id+'\n').encode()
            label=owner.rsplit(':',1)[1];v={'Id':id,'Name':'/lims-owned-batch-'+c.sha(owner.encode())[:24],'Image':stop.IMAGE,'Config':{'Labels':{stop.LABEL:owner}},'HostConfig':{'RestartPolicy':{'Name':'no'}},'State':{'Running':False,'StartedAt':'same'},'Mounts':[{'Type':'bind','RW':True,'Source':str(stop.ROOT/(label+s)),'Destination':d} for s,d in [('-database','/app/server/prisma'),('-assets','/app/server/uploads'),('-retained-temp','/tmp')]]};return json.dumps([v]).encode()
        r=stop.stop_exact(call);self.assertTrue(r['allExactOwnedStopped']);self.assertEqual(len(r['stoppedAndRetained']),2);self.assertEqual([v[1] for v in seen],['ps','inspect','inspect']*2)
    def test_inspect_before_phase_and_second_owner_continues(self):
        def interface(args):
            if args[1]=='ps':return b'a'*64+b'\n'
            raise ValueError('PRIVATE_ENV_VALUE')
        r=stop.public_result(stop.stop_exact(interface));self.assertEqual([e['phase'] for e in r['errors']],['inspect-before']*2);self.assertNotIn('PRIVATE_ENV_VALUE',json.dumps(r))
class DiagnosticBounds(unittest.TestCase):
    def test_exact_two_copies_budget_and_additional_reserves(self):
        pins=json.loads((B/'diagnostic-pins.json').read_bytes());copies=2*563326976
        self.assertEqual(disk.required(pins),c.FLOOR+c.HEADROOM+c.LOG_RESERVE+copies)
        self.assertEqual(disk.required(pins,copies_pending=False),c.FLOOR+c.HEADROOM+c.LOG_RESERVE)
        self.assertEqual(disk.required(pins,4096)-disk.required(pins),4096)
    def test_500mb_boundary_is_refusal(self):
        before={'paths':{p:{'freeBytes':1000000000} for p in disk.PATHS}};after={'paths':{p:{'freeBytes':500000000} for p in disk.PATHS}}
        with self.assertRaises(RuntimeError):disk.growth(before,after,0)
        self.assertEqual(disk.growth(before,after,1)['unexplainedBytes'],499999999)
    def test_no_original_database_can_be_opened_by_verify_copy(self):
        from kobo_copy_preservation import verify_copy
        with mock.patch('sqlite3.connect',side_effect=AssertionError('SQL must not run')):
            with self.assertRaises(RuntimeError):verify_copy('/old/input.db','/old/current.db',owner_root=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']))
    def test_original_pin_rejects_changed_metadata_before_content(self):
        pins={'files':{'/fake/main.db':{'mode':256,'device':1,'inode':2,'bytes':4,'mtimeNs':8,'allocatedBytes':4096}}}
        with mock.patch.object(disk,'snapshot',return_value={'mode':256,'st_dev':1,'st_ino':3,'st_size':4,'st_mtime_ns':8,'allocatedBytes':4096}):
            with self.assertRaises(RuntimeError):disk.originals(pins,False)
    def test_exact_authority_and_source_review_floor(self):
        v={'id':c.ACCEPTED_ID,'body':'edited','created_at':c.ACCEPTED_TIME,'updated_at':c.ACCEPTED_TIME,'performed_via_github_app':{'id':1236702,'slug':'claude'}}
        with self.assertRaises(RuntimeError):c.accepted(v)
    def test_all_actual_remote_templates_compile_and_bind_modes(self):
        from launch_diagnostic import remote_sources
        files={n:(B/n).read_bytes() for n in c.SOURCE_NAMES+c.DATA_NAMES}
        for mode in c.MODES:
            programs=remote_sources(files,mode,123456)
            for n,raw in programs.items():compile(raw,n,'exec');self.assertIn(b'FUTURE=',raw)
            self.assertIn(b'Type=exec',programs['uploadAndUnit']);self.assertIn(b'MemorySwapMax=0',programs['uploadAndUnit']);self.assertIn(b'StandardOutput=journal',programs['uploadAndUnit'])
    def exercise_actual_upload(self,short=False):
        from launch_diagnostic import remote_sources
        import diagnostic_io
        blobs={n:(B/n).read_bytes() for n in c.SOURCE_NAMES+c.DATA_NAMES};state={'files':{},'mkdir':[],'calls':[]}
        class Handle(io.BytesIO):
            def __init__(self,path):super().__init__();self.path=path
            def close(self):
                if not self.closed:state['files'][self.path]=self.getvalue()
                super().close()
        class Path:
            def __init__(self,value):self.value=str(value)
            def __str__(self):return self.value
            def __truediv__(self,n):return Path(self.value+'/'+str(n))
            @property
            def parent(self):return Path(self.value.rsplit('/',1)[0])
            def mkdir(self,**kwargs):state['mkdir'].append(self.value)
            def exists(self):return self.value in state['files']
            def is_symlink(self):return False
            def is_dir(self):return self.value in state['mkdir']
            def open(self,mode):
                if 'x' in mode and self.exists():raise FileExistsError(self.value)
                return Handle(self.value)
            def read_bytes(self):return state['files'][self.value]
            def chmod(self,mode):self.mode=mode
        def run(args,**kwargs):
            state['calls'].append(args)
            return subprocess.CompletedProcess(args,0,b'not-found\n' if args[0]=='systemctl' else b'',b'')
        def capacity(*args,**kwargs):
            if short:raise RuntimeError('Synthetic one-byte short')
            return {'fits':True,'future':kwargs.get('copies_pending')}
        saved=list(sys.meta_path)
        try:
            with mock.patch.object(pathlib,'Path',Path),mock.patch.object(subprocess,'run',run),mock.patch.object(diagnostic_io,'originals',return_value={}),mock.patch.object(diagnostic_io,'capacity',capacity):
                exec(compile(remote_sources(blobs,'comparator',123456)['uploadAndUnit'],'actual-upload-rendered','exec'),{})
        finally:sys.meta_path[:]=saved
        return state
    def test_actual_upload_template_one_byte_short_never_creates_root(self):
        # Exception is raised by the actual rendered capacity-before-root branch.
        with self.assertRaisesRegex(RuntimeError,'one-byte short'):self.exercise_actual_upload(True)
    def test_actual_upload_template_creates_only_new_root_then_launches_exact_unit(self):
        state=self.exercise_actual_upload();self.assertEqual(state['mkdir'][0],str(c.ROOT));units=[a for a in state['calls'] if a[0]=='systemd-run'];self.assertEqual(len(units),1)
        self.assertIn('--property=MemoryMax=805306368',units[0]);self.assertIn('--property=PrivateNetwork=yes',units[0]);self.assertEqual(units[0][-1],'comparator');self.assertIn(str(c.ROOT)+'/unit-intent-comparator.json',state['files'])
    def test_writer_map_covers_every_comparator_require_and_range_digest(self):
        value=json.loads((B/'writer-map.json').read_bytes());actual=set()
        for n in ['provenance_rules.py','kobo_copy_preservation.py']:
            for node in ast.walk(ast.parse((B/n).read_text(encoding='utf-8'))):
                if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='require':actual.add((n,node.lineno))
        self.assertEqual(actual,{(e['comparatorFile'],e['line']) for e in value['entries']})
        for entry in value['entries']:
            self.assertTrue(entry['explanation'])
            for site in entry['writerSites']:
                lines=(B/'application-source-fixtures'/site['file']).read_text(encoding='utf-8').splitlines();self.assertEqual(c.sha(('\n'.join(lines[site['firstLine']-1:site['lastLine']])+'\n').encode()),site['sourceRangeSha256'])
    def test_static_failure_map_exact_ast_sites_including_stop(self):
        expected={}
        for n in c.SOURCE_NAMES:
            if not n.endswith('.py'):continue
            for node in ast.walk(ast.parse((B/n).read_text(encoding='utf-8'))):
                value=None
                if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='require' and len(node.args)>1 and isinstance(node.args[1],ast.Constant) and isinstance(node.args[1].value,str):value=node.args[1].value
                if isinstance(node,ast.Raise) and isinstance(node.exc,ast.Call) and isinstance(node.exc.func,ast.Name) and node.exc.func.id=='RuntimeError' and node.exc.args and isinstance(node.exc.args[0],ast.Constant) and isinstance(node.exc.args[0].value,str):value=node.exc.args[0].value
                if value is not None:expected.setdefault((n,node.lineno),[]).append(value)
        self.assertEqual(privacy.STATIC_FAILURE_SITES,{k:tuple(v) for k,v in expected.items()})
def suite():
    result=unittest.TestSuite()
    for cls in [prior.ProvenanceGuards,prior.OwnUnitGuards,prior.KeyGuards,prior.FullStoreGuards,FingerprintGuards,HookEvidenceGuards,DiagnosticBounds]:result.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(cls))
    for n in ['test_killed_controller_hook_finds_labels_without_controller_id_list','test_foreign_owner_never_stops','test_one_owner_failure_does_not_prevent_other_owner_stop','test_unexpected_mount_even_inside_root_never_stops']:result.addTest(prior.StopPostGuards(n))
    return result
if __name__=='__main__':
    setUpModule();result=unittest.TextTestRunner(verbosity=2).run(suite());sys.exit(not result.wasSuccessful())
