"""Use structural AST equality across3.12/3.9, retaining pretty text as evidence."""
import ast,json,pathlib,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/batch-proof-mount-order-forward-be837974-20261016';sys.path.insert(0,str(B));import proof_contract as c
D=B/'python39-ast-fixture-correction-once';assert not D.exists();D.mkdir()
for name in ['map-array-sweep.json','verify_mount_order_guards.py']:(D/name).write_bytes((B/name).read_bytes())
p=B/'map-array-sweep.json';sweep=json.loads(p.read_bytes());rows=[]
for name in sorted(c.FILES):
 if not name.endswith('.py') or name.startswith('verify') or name=='provenance_privacy.py':continue
 for n in ast.walk(ast.parse((B/name).read_bytes())):
  if isinstance(n,ast.Compare) and any(isinstance(op,(ast.Eq,ast.NotEq)) for op in n.ops):rows.append({'file':name,'line':n.lineno,'expression':ast.unparse(n),'ast':ast.dump(n,include_attributes=False)})
sweep['allRuntimeEqualityComparisons']=rows;p.write_bytes(c.canonical(sweep)+b'\n')
p=B/'verify_mount_order_guards.py';s=p.read_text(encoding='utf-8');before="actual.append({'file':name,'line':node.lineno,'expression':ast.unparse(node)})";assert s.count(before)==1;s=s.replace(before,"actual.append({'file':name,'line':node.lineno,'ast':ast.dump(node,include_attributes=False)})")
before="self.assertEqual(sweep['allRuntimeEqualityComparisons'],actual)";assert s.count(before)==1;s=s.replace(before,"self.assertEqual([{k:r[k] for k in ['file','line','ast']} for r in sweep['allRuntimeEqualityComparisons']],actual)")
p.write_text(s,encoding='utf-8',newline='\n')
old=W/'WP/backlog-resume-20261013/verify-mount-order-attempt-local-host-complete-once.py';new=W/'WP/backlog-resume-20261013/verify-mount-order-attempt-local-host-final-once.py';assert not new.exists()
s=old.read_text(encoding='utf-8').replace('source-local-host-mount-order-complete-once','source-local-host-mount-order-final-once').replace('lims-mount-order-guards-complete-20261016T082000Z','lims-mount-order-guards-final-20261016T082500Z');compile(s,str(new),'exec');new.write_text(s,encoding='utf-8',newline='\n')
(D/'derived.json').write_text(json.dumps({'kind':'CLOSED_GUARD_FIXTURE_CORRECTION','priorLocal':{'tests':568,'passed':568},'priorHost':{'tests':568,'passed':567,'failed':1,'python':'3.9.23'},'cause':'ast.unparse pretty-printer adds parentheses differently on3.9 versus3.12; comparison expressions/ASTs/source remained unchanged.','correction':'Compare complete ast.dump structure and exact file+line; keep original readable expression and every656 inventory site. No runtime or predicate relaxation, host operator or Docker call.'}),encoding='utf-8')
print(new.relative_to(W).as_posix())
