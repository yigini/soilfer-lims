"""Run exact committed pure/SQLite guards in memory; no production read/write."""
import base64
import hashlib
import json
import subprocess
import sys

head = sys.argv[1]
if len(head) != 40 or any(value not in '0123456789abcdef' for value in head):
    raise RuntimeError('Exact source commit required')
files = {}
for name in ['proof_contract', 'kobo_copy_preservation', 'capture_kobo_fetch',
    'test_proof_contract', 'test_kobo_copy_preservation', 'test_capture_kobo_fetch']:
    data = subprocess.check_output(['git', 'show', head + ':WP/runtime-recovery-kobo/' + name + '.py'])
    files[name] = {'data': base64.b64encode(data).decode(), 'sha256': hashlib.sha256(data).hexdigest()}
payload = base64.b64encode(json.dumps({'head': head, 'files': files}).encode()).decode()
code = '''import base64,datetime,hashlib,json,sys,time,types,unittest
p=json.loads(base64.b64decode(PAYLOAD));start=time.monotonic();tests=[]
for name,value in p['files'].items():
 data=base64.b64decode(value['data']);assert hashlib.sha256(data).hexdigest()==value['sha256']
 module=types.ModuleType(name);module.__file__='/owned-in-memory-guards/'+name+'.py';sys.modules[name]=module
 exec(compile(data,module.__file__,'exec'),module.__dict__)
 if name.startswith('test_'):tests.append(module)
suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromModule(module) for module in tests)
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'sourceCommit':p['head'],'sourceHashes':{name:value['sha256'] for name,value in p['files'].items()},
 'completedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tests':result.testsRun,
 'failures':len(result.failures),'errors':len(result.errors),'skips':len(result.skipped),
 'elapsedSeconds':time.monotonic()-start,'productionDatabaseAccess':False}))
sys.exit(0 if result.wasSuccessful() else 1)
'''.replace('PAYLOAD', repr(payload))
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
    'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=60)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(result.returncode)
