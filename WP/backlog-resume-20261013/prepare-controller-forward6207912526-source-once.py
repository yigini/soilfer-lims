"""Distinct complete controller-forward source only; never execute a proof operator."""
import ast,hashlib,json,pathlib,subprocess
W=pathlib.Path(__file__).resolve().parents[2];OLD='WP/batch-proof-provenance-step2-be837974-20261016/';NEW='WP/batch-proof-controller-forward-step2-be837974-20261016/';B=W/OLD;D=W/NEW
assert not D.exists();SOURCE='937901c7514437fc3937639454e621d1bfd68dc4';idx=json.loads((B/'exact-source-review398-once/source-index.json').read_bytes());assert len(idx['files'])==31 and idx['head']==SOURCE
raws={n:subprocess.check_output(['git','-c','core.longpaths=true','show',SOURCE+':'+OLD+n],cwd=W) for n in idx['files']}
for n,b in raws.items():assert hashlib.sha256(b).hexdigest()==idx['files'][n]['sha256'] and b==(B/n).read_bytes()
accept=json.loads((B/'actual-result-accepted6207912526-once/actual-result-acceptance-original.json').read_bytes());projection={k:accept[k] for k in ['id','body','created_at','updated_at']};projection['app']={k:accept['performed_via_github_app'][k] for k in ['id','slug']};semantic=hashlib.sha256(json.dumps(projection,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
assert accept['id']==6207912526 and hashlib.sha256(accept['body'].encode()).hexdigest()=='11664ce3faf7b9cc401632ed9b038375d89a46190ef1324fdb3e2dde7ec70ead'
texts={n:b.decode() for n,b in raws.items()};c=texts['proof_contract.py'].replace('workflow-batch-provenance-step2-be837974-20261016T050000Z','workflow-batch-controller-forward-step2-be837974-20261016T063000Z').replace("review.get('id',0)>6206990387","review.get('id',0)>6207912526").replace("review['created_at']>'2026-10-16T02:55:36Z'","review['created_at']>'2026-10-16T04:12:57Z'")
c=c.replace("'6206990387':DIAGNOSTIC_ACCEPTED_SHA}","'6206990387':DIAGNOSTIC_ACCEPTED_SHA,'6207912526':'"+semantic+"'}")
c=c.replace("return ['step2DirectionPinsSha256='","return ['acceptedControllerRefusalId=6207912526','acceptedControllerRefusalSha256="+semantic+"','controllerProcPath=NUMERIC_CURRENT_PID_NO_ALIASES','stopExactOwnersBeforeReviewIndexHashesAndMemory=true','realHostOwnSnapshotUnpatchedMembershipRefusal=true','realNumericProcReadEqualsPlainOpen=true','literalRequireErrorsReadableOtherwiseHmac=true','controllerRawReadsRetainedBeforePredicates=true','stopPostPrivateHmacKeyAfterStops=true','step2DirectionPinsSha256='")
texts['proof_contract.py']=c;texts['prepare_proof.py']=texts['prepare_proof.py'].replace(OLD,NEW)
g=texts['controller_guard.py'];start=g.index('def own_snapshot');end=g.index(" member=read('/proc/self/cgroup')",start)
g=g[:start]+'''def numeric_membership_path():return '/proc/'+str(os.getpid())+'/cgroup'

def actual_reader(path):
 p=pathlib.Path(path)
 for a in [p,*p.parents]:require(not a.is_symlink(),'Controller cgroup alias')
 with p.open('rb') as f:b=f.read(MAX_BYTES+1)
 require(len(b)<=MAX_BYTES,'Controller memory raw bound');return b

def own_snapshot(read=None,evidence=None):
 read=read or actual_reader
 def recorded(path):
  raw=read(path)
  if evidence is not None:evidence(path,raw)
  return raw
''' +g[end:]
g=g.replace("member=read('/proc/self/cgroup')","member=recorded(numeric_membership_path())").replace('read is actual','read is actual_reader').replace("{n:read(group+'/'+n)","{n:recorded(group+'/'+n)").replace("require(read('/proc/self/cgroup')==member","require(recorded(numeric_membership_path())==member")
g=g.replace('  value=own_snapshot()', '''  reads=[]
  def retain(path,raw):
   record={'path':path,'rawAscii':raw.decode('ascii'),'sha256':sha(raw),'bytes':len(raw)};reads.append(record)
   write_new(self.root/('controller-memory-'+label+'-raw-'+str(len(reads)).zfill(2)+'.json'),record)
  value=own_snapshot(evidence=retain)''');texts['controller_guard.py']=g
s=texts['stop_owned.py'];s=s[:s.index('def main():')]+'''def verify_retained_graph(root):
 spec=json.loads((root/'proof-input.json').read_bytes());index=json.loads((root/'tooling-source-index.json').read_bytes());review=json.loads((root/'source-review-original.json').read_bytes());approval(review,index)
 require(spec['toolingCommit']==index['head'] and spec['sourceReviewId']==review['id'],'Stop-post specification binding differs')
 for n,d in graph(index).items():require(hashlib.sha256((root/n).read_bytes()).hexdigest()==d,'Stop-post source changed')

def post_stop(root,stopper=None,verifier=None,memory_reader=None):
 result=(stopper or stop_exact)();errors=[]
 try:(verifier or verify_retained_graph)(root)
 except BaseException as e:errors.append(('verification',e))
 try:memory=(memory_reader or own_snapshot)()
 except BaseException as e:memory=None;errors.append(('memory',e))
 result.update({'controllerMemory':memory,'controllerMemoryErrorType':next((type(e).__name__ for kind,e in errors if kind=='memory'),None),'execStopPost':True})
 return result,errors

def main():
 root=pathlib.Path(__file__).resolve().parent;require(str(root)==str(ROOT),'Exact stop-post root required')
 result,errors=post_stop(root)
 from provenance_privacy import initialize_private_key,public_failure
 initialize_private_key(root,'private-stop-post-hmac-key.json')
 result['postStopErrors']=[{'phase':kind,**public_failure(error)} for kind,error in errors]
 p=root/'stop-post-result.json'
 with p.open('xb') as f:f.write(canonical(result)+b'\\n')
 p.chmod(0o400)
 require(result['allExactOwnedStopped'] and not errors,'Stop-post or controller memory refused; inspect same retained root')
if __name__=='__main__':main()
''';texts['stop_owned.py']=s
p=texts['provenance_privacy.py'].replace('def initialize_private_key(root):','def initialize_private_key(root,filename="private-value-hmac-key.json"):').replace("root=pathlib.Path(root);p=child_path(root,root/'private-value-hmac-key.json')","require(filename in {'private-value-hmac-key.json','private-stop-post-hmac-key.json'},'Exact private key filename required')\n    root=pathlib.Path(root);p=child_path(root,root/filename)")
p=p.replace("def public_failure(e):return {'errorType':type(e).__name__,'errorHmacSha256':value_hash(str(e))}",'''def public_failure(e):
    if type(e) is RuntimeError and len(e.args)==1 and type(e.args[0]) is str:
        tb=e.__traceback__
        while tb is not None:
            site=(pathlib.Path(tb.tb_frame.f_code.co_filename).name,tb.tb_lineno)
            if e.args[0] in STATIC_FAILURE_SITES.get(site,()):return {'errorType':'RuntimeError','literalRequire':e.args[0]}
            tb=tb.tb_next
    return {'errorType':type(e).__name__,'errorHmacSha256':value_hash(str(e))}
''');texts['provenance_privacy.py']=p
v=texts['verify_provenance_guards.py'].replace("'/proc/self/cgroup':","cg.numeric_membership_path():")
v+='''
class ControllerForwardGuards(unittest.TestCase):
    def test_numeric_path_is_current_pid(self):self.assertEqual(cg.numeric_membership_path(),'/proc/'+str(os.getpid())+'/cgroup')
    def test_real_reader_refuses_numeric_symlink_ancestor_before_open(self):
        ancestor=pathlib.Path('/proc/'+str(os.getpid()))
        with mock.patch.object(pathlib.Path,'is_symlink',lambda path:path==ancestor),mock.patch.object(pathlib.Path,'open',side_effect=AssertionError('Opened alias')):
            with self.assertRaisesRegex(RuntimeError,'^Controller cgroup alias$'):cg.actual_reader(cg.numeric_membership_path())
    def test_real_reader_refuses_cgroup_alias_before_open(self):
        with mock.patch.object(pathlib.Path,'is_symlink',lambda path:path==pathlib.Path('/sys/fs/cgroup')),mock.patch.object(pathlib.Path,'open',side_effect=AssertionError('Opened alias')):
            with self.assertRaisesRegex(RuntimeError,'^Controller cgroup alias$'):cg.actual_reader('/sys/fs/cgroup/system.slice/owned.service/memory.events')
    def test_raws_retained_before_oom_predicate(self):
        reads=[]
        with self.assertRaises(RuntimeError):cg.own_snapshot(OwnUnitGuards().raw(oom=1),evidence=lambda path,raw:reads.append((path,raw)))
        self.assertEqual(len(reads),7);self.assertIn(b'oom 1',reads[1][1])
    def test_post_stop_order_is_stops_verify_memory(self):
        calls=[]
        result,errors=stop.post_stop(pathlib.Path('/synthetic'),stopper=lambda:(calls.append('stop') or {'allExactOwnedStopped':True}),verifier=lambda root:calls.append('verify'),memory_reader=lambda:(calls.append('memory') or {}))
        self.assertEqual(calls,['stop','verify','memory']);self.assertFalse(errors)
    def test_verification_failure_after_stop_still_reads_memory_and_fails(self):
        calls=[]
        def bad(root):calls.append('verify');raise RuntimeError('private dynamic '+str(root))
        result,errors=stop.post_stop(pathlib.Path('/synthetic'),stopper=lambda:(calls.append('stop') or {'allExactOwnedStopped':True}),verifier=bad,memory_reader=lambda:(calls.append('memory') or {}))
        self.assertEqual(calls,['stop','verify','memory']);self.assertEqual(errors[0][0],'verification')
    def test_memory_failure_after_stop_is_retained(self):
        def bad():raise RuntimeError('dynamic PRIVATE')
        result,errors=stop.post_stop(pathlib.Path('/synthetic'),stopper=lambda:{'allExactOwnedStopped':True},verifier=lambda root:None,memory_reader=bad)
        self.assertEqual(errors[0][0],'memory');self.assertIsNone(result['controllerMemory']);self.assertNotIn('PRIVATE',json.dumps(p.public_failure(errors[0][1])))
    def test_literal_actual_reader_error_is_readable(self):
        with mock.patch.object(pathlib.Path,'is_symlink',return_value=True):
            try:cg.actual_reader(cg.numeric_membership_path())
            except RuntimeError as error:self.assertEqual(p.public_failure(error),{'errorType':'RuntimeError','literalRequire':'Controller cgroup alias'})
    def test_literal_membership_error_is_readable(self):
        try:cg.own_snapshot(OwnUnitGuards().raw(member=b'0::/foreign\\n'))
        except RuntimeError as error:self.assertEqual(p.public_failure(error),{'errorType':'RuntimeError','literalRequire':'Exact controller unit membership required'})
    def test_interpolated_require_remains_hmac(self):
        try:require(False,'PRIVATE-'+str(123))
        except RuntimeError as error:self.assertIn('errorHmacSha256',p.public_failure(error));self.assertNotIn('PRIVATE',json.dumps(p.public_failure(error)))
    def test_same_literal_from_unreviewed_site_remains_hmac(self):
        error=RuntimeError('Controller cgroup alias');self.assertIn('errorHmacSha256',p.public_failure(error))
    def test_new_acceptance_cannot_be_source_pass(self):
        from proof_contract import approval
        value=Step2AuthorityGuards().values()['6207912526']
        with self.assertRaises(RuntimeError):approval(value,{})
    def test_new_acceptance_missing_refuses(self):
        from proof_contract import step2_authorities
        values=Step2AuthorityGuards().values();values.pop('6207912526')
        with self.assertRaises(RuntimeError):step2_authorities(values)
''';texts['verify_provenance_guards.py']=v
sites={}
for name,text in texts.items():
 if not name.endswith('.py') or name=='provenance_privacy.py':continue
 for node in ast.walk(ast.parse(text)):
  literal=None
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='require' and len(node.args)>1 and isinstance(node.args[1],ast.Constant) and type(node.args[1].value) is str:literal=node.args[1].value
  if isinstance(node,ast.Raise) and isinstance(node.exc,ast.Call) and isinstance(node.exc.func,ast.Name) and node.exc.func.id=='RuntimeError' and len(node.exc.args)==1 and isinstance(node.exc.args[0],ast.Constant) and type(node.exc.args[0].value) is str:literal=node.exc.args[0].value
  if literal is not None:sites.setdefault((name,node.lineno),[]).append(literal)
texts['provenance_privacy.py']+='\nSTATIC_FAILURE_SITES='+repr({k:tuple(v) for k,v in sorted(sites.items())})+'\n'
for n,text in texts.items():
 if n.endswith('.py'):ast.parse(text,filename=n,feature_version=(3,9));compile(text,n,'exec')
D.mkdir()
for n,text in texts.items():
 with (D/n).open('xb') as f:f.write(text.encode())
for sub in ['bound-input-records','new-authority-fixtures','application-source-fixtures']:
 for path in (B/sub).rglob('*'):
  if path.is_file() and '__pycache__' not in path.parts:
   target=D/sub/path.relative_to(B/sub);target.parent.mkdir(parents=True,exist_ok=True)
   with target.open('xb') as f:f.write(path.read_bytes())
(D/'compose-source.yml').write_bytes((B/'compose-source.yml').read_bytes());values=json.loads((D/'new-authority-fixtures/step2-directions.json').read_bytes());values['6207912526']=accept;(D/'new-authority-fixtures/step2-directions.json').write_text(json.dumps(values,sort_keys=True,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
record={'status':'NEW_COMPLETE_SOURCE_ONLY_NOT_APPROVED_NOT_EXECUTED','predecessorSource':SOURCE,'acceptedScope':6207912526,'acceptedScopeSemanticSha256':semantic,'files':{n:{'sha256':hashlib.sha256((D/n).read_bytes()).hexdigest(),'bytes':(D/n).stat().st_size,'predecessorSha256':idx['files'][n]['sha256']} for n in sorted(texts)},'literalSourceSites':len(sites),'operatorsExecuted':0,'newRootCreated':False,'newPackageCreated':False,'oldSourceUnchanged':all((B/n).read_bytes()==raws[n] for n in raws)}
(D/'source-preparation-record.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in record.items() if k!='files'}))
