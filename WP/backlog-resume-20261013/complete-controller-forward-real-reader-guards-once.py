"""Complete retained stop-post raw evidence and unpatched fixture-file reader coverage."""
import pathlib,ast,json
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/batch-proof-controller-forward-step2-be837974-20261016';assert not (B/'final-reader-guard-preparation.json').exists()
q=B/'stop_owned.py';s=q.read_text();at=s.index('def post_stop(root,');s=s[:at]+'''def post_stop_snapshot(root):
 from proof_files import write_new
 reads=[]
 def retain(path,raw):
  reads.append(path);write_new(root/('controller-memory-stop-post-raw-'+str(len(reads)).zfill(2)+'.json'),{'path':path,'rawAscii':raw.decode('ascii'),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)})
 return own_snapshot(evidence=retain)

'''+s[at:];s=s.replace('try:memory=(memory_reader or own_snapshot)()','try:memory=(memory_reader or (lambda:post_stop_snapshot(root)))()');q.write_text(s,encoding='utf-8',newline='\n')
q=B/'verify_provenance_guards.py';s=q.read_text().replace('        def memory():','        def memory(**kwargs):')
s+='''
class UnpatchedFixtureReaderGuards(unittest.TestCase):
    def root(self):
        root=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).with_name(pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).name+'-'+self._testMethodName);root.mkdir();return root
    def package(self):
        from proof_contract import FILES,tokens
        root=self.root();files={}
        for name in sorted(FILES):
            raw=(pathlib.Path(__file__).parent/name).read_bytes();(root/name).write_bytes(raw);files[name]={'bytes':len(raw),'sha256':sha(raw),'blob':hashlib.sha1(('blob '+str(len(raw))+'\\0').encode()+raw).hexdigest()}
        index={'head':'f'*40,'files':files}
        review={'id':6208000001,'created_at':'2026-10-16T04:14:00Z','updated_at':'2026-10-16T04:14:00Z','performed_via_github_app':{'id':1236702,'slug':'claude'},'html_url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6208000001','body':'Source review: PASS\\n'+'\\n'.join(tokens(index))}
        for name,value in [('tooling-source-index.json',index),('source-review-original.json',review),('proof-input.json',{'toolingCommit':index['head'],'sourceReviewId':review['id']})]:(root/name).write_bytes(canonical(value))
        return root
    def test_unpatched_verifier_reads_real_new_fixture_files_and_hashes(self):stop.verify_retained_graph(self.package())
    def test_unpatched_verifier_refuses_actual_last_source_tamper(self):
        root=self.package();(root/'verify_provenance_guards.py').write_bytes(b'tampered')
        with self.assertRaisesRegex(RuntimeError,'^Stop-post source changed$'):stop.verify_retained_graph(root)
    def test_stop_post_raws_written_before_memory_oom_predicate(self):
        root=self.root()
        def actual_fake(evidence=None):return cg.own_snapshot(OwnUnitGuards().raw(oom=1),evidence=evidence)
        with mock.patch.object(stop,'own_snapshot',actual_fake):
            with self.assertRaisesRegex(RuntimeError,'^Controller memory OOM guard refused$'):stop.post_stop_snapshot(root)
        records=[json.loads(path.read_bytes()) for path in sorted(root.glob('controller-memory-stop-post-raw-*.json'))];self.assertEqual(len(records),7);self.assertIn('oom 1',records[1]['rawAscii'])
''';q.write_text(s,encoding='utf-8',newline='\n')
sites={}
for q in B.glob('*.py'):
 if q.name=='provenance_privacy.py':continue
 for node in ast.walk(ast.parse(q.read_bytes())):
  text=None
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='require' and len(node.args)>1 and isinstance(node.args[1],ast.Constant) and type(node.args[1].value) is str:text=node.args[1].value
  if isinstance(node,ast.Raise) and isinstance(node.exc,ast.Call) and isinstance(node.exc.func,ast.Name) and node.exc.func.id=='RuntimeError' and len(node.exc.args)==1 and isinstance(node.exc.args[0],ast.Constant) and type(node.exc.args[0].value) is str:text=node.exc.args[0].value
  if text is not None:sites.setdefault((q.name,node.lineno),[]).append(text)
q=B/'provenance_privacy.py';s=q.read_text();s=s[:s.index('\nSTATIC_FAILURE_SITES=')]+'\nSTATIC_FAILURE_SITES='+repr({k:tuple(v) for k,v in sorted(sites.items())})+'\n';q.write_text(s,encoding='utf-8',newline='\n')
(B/'final-reader-guard-preparation.json').write_text(json.dumps({'reason':'Retain stop-post raw reads before predicates too; exercise new verify_retained_graph unpatched on new synthetic files and actual tamper','prior417BothPassPreserved':True,'expectedTests':420,'sourceOperatorsExecuted':0},indent=2),encoding='utf-8')
p=W/'WP/backlog-resume-20261013/verify-controller-forward417-complete-local-host-once.py';s=p.read_text().replace('source-local-host-controller-forward-complete-once','source-local-host-controller-forward-final-once').replace('guards-complete-20261016T044000Z','guards-final-20261016T045000Z');q=p.with_name('verify-controller-forward420-final-local-host-once.py');assert not q.exists();ast.parse(s);q.write_text(s,encoding='utf-8',newline='\n');print('Final420 source and reader guards prepared')
