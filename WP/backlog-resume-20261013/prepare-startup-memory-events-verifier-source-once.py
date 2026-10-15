"""Create a NEW local+actual-host guard wrapper; no operator or tests run here."""
import ast,pathlib
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';base=pathlib.Path(__file__).resolve().parent
raw=(base/'verify-startup-acc158-proof229-local-host-complete-once.py').read_text(encoding='utf-8')
count=sum(isinstance(n,ast.FunctionDef) and n.name.startswith('test_') for n in ast.walk(ast.parse((S/'verify_proof_guards.py').read_bytes())))
assert count>229
raw=raw.replace('WP/batch-proof-startup-be837974-20261015','WP/batch-proof-memory-events-be837974-20261015').replace('229',str(count)).replace('lims-acc158-guard','lims-memory-events-guard').replace('20261015T215000Z','20261015T233000Z')
raw=raw.replace("'proof_docker.py','proof_startup.py'","'proof_docker.py','proof_memory.py','proof_startup.py'")
compile(raw,'new-memory-events-guard-wrapper','exec')
with (base/('verify-startup-memory-events'+str(count)+'-local-host-once.py')).open('x',encoding='utf-8',newline='\n') as f:f.write(raw)
print('Prepared NEW '+str(count)+'-guard wrapper; tests not executed.')
