import sys\nsys.argv=['guard-harness','90e46e0b15885afc0112f31ff11e8227e859e86f']\n"""Run exact committed pure/SQLite guards in memory; no production read/write."""
import base64
import hashlib
import json
import subprocess
import sys

head = sys.argv[1]
if len(head) != 40 or any(value not in '0123456789abcdef' for value in head):
    raise RuntimeError('Exact source commit required')
files = {}
paths = {'release_support': 'WP/forward-ae64f169/release_support.py',
    'startup_common': 'WP/forward-ae64f169/startup_common.py',
    'known_core_disk_guard': 'WP/runtime-containment-ae64f169/known_core_disk_guard.py'}
paths.update({name: 'WP/runtime-recovery-kobo/' + name + '.py' for name in [
    'proof_contract', 'kobo_copy_preservation', 'capture_kobo_fetch', 'runtime_release_contract',
    'known_core_disk_guard_v2', 'test_proof_contract', 'test_kobo_copy_preservation',
    'test_capture_kobo_fetch', 'test_runtime_release_contract', 'test_core_deallocation_confirmation',
    'test_source_review_pin', 'test_scheduler_refusal_scope', 'known_core_disk_guard_v3',
    'test_baseline_confirmation', 'known_core_disk_guard_deploy', 'deploy_runtime', 'launch_runtime_release',
    'test_deploy_baseline_guard', 'test_scheduler_stream_pairing']})
for name, path in paths.items():
    data = subprocess.check_output(['git', 'show', head + ':' + path])
    files[name] = {'data': base64.b64encode(data).decode(), 'sha256': hashlib.sha256(data).hexdigest()}
fixtures = {}
for name in ['jobs-on.stdout.log', 'jobs-on.stderr.log']:
    fixtures[name] = base64.b64encode(subprocess.check_output(['git', 'show', head + ':WP/runtime-recovery-kobo/proof-failure-211630Z-original-logs/' + name])).decode()
files['test_scheduler_stream_pairing']['fixtures'] = fixtures
payload = base64.b64encode(json.dumps({'head': head, 'files': files}).encode()).decode()
code = '''import base64,datetime,hashlib,json,sys,time,types,unittest
p=json.loads(base64.b64decode(PAYLOAD));start=time.monotonic();tests=[]\nif sys.platform=='win32':sys.modules['fcntl']=types.ModuleType('fcntl')
for name,value in p['files'].items():
 data=base64.b64decode(value['data']);assert hashlib.sha256(data).hexdigest()==value['sha256']
 module=types.ModuleType(name);module.__file__='/owned-in-memory-guards/'+name+'.py';module.__raw_sha256__=value['sha256'];module.__raw_source__=data;sys.modules[name]=module
 module.__fixture_bytes__={key:base64.b64decode(encoded) for key,encoded in value.get('fixtures',{}).items()}
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
