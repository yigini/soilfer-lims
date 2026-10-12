"""Run exact committed owned-snapshot guards; no production database access."""
import base64
import hashlib
import json
import subprocess
import sys

head = sys.argv[1]
if len(head) != 40 or any(character not in '0123456789abcdef' for character in head):
    raise RuntimeError('Exact source commit required')
names = ['import_preservation', 'test_import_preservation']
files = {name: subprocess.check_output(['git', 'show', head + ':WP/pr284-release/' + name + '.py']) for name in names}
assets = {name: subprocess.check_output(['git', 'show', head + ':server/prisma/migrations/20261010000100_instrument_import_templates/' + name])
    for name in ['migration.sql', 'fresh-prisma-tables.json', 'pre-prisma-draft-table.sql',
        'upgraded-prisma-draft-table.sql', 'post205-draft-tables.json']}
payload = {'sourceCommit': head, 'files': {name: {'data': base64.b64encode(raw).decode(),
    'sha256': hashlib.sha256(raw).hexdigest()} for name, raw in files.items()},
    'assets': {name: {'data': base64.b64encode(raw).decode(), 'sha256': hashlib.sha256(raw).hexdigest()}
        for name, raw in assets.items()}}
code = '''import base64,datetime,hashlib,json,pathlib,sys,tempfile,time,types,unittest
p=json.loads(base64.b64decode(PAYLOAD));start=time.monotonic()
with tempfile.TemporaryDirectory(prefix='owned-import-assets-') as directory:
 root=pathlib.Path(directory)
 for name,item in p['assets'].items():
  raw=base64.b64decode(item['data']);assert hashlib.sha256(raw).hexdigest()==item['sha256'];(root/name).write_bytes(raw)
 for name,item in p['files'].items():
  raw=base64.b64decode(item['data']);assert hashlib.sha256(raw).hexdigest()==item['sha256']
  module=types.ModuleType(name);module.__file__='/owned-in-memory-guards/WP/pr284-release/'+name+'.py';sys.modules[name]=module
  exec(compile(raw,module.__file__,'exec'),module.__dict__)
 tests=sys.modules['test_import_preservation'];tests.ASSET_ROOT=root
 result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(tests))
 print(json.dumps({'sourceCommit':p['sourceCommit'],'sourceHashes':{name:item['sha256'] for name,item in p['files'].items()},
  'assetHashes':{name:item['sha256'] for name,item in p['assets'].items()},'tests':result.testsRun,
  'failures':len(result.failures),'errors':len(result.errors),'skips':len(result.skipped),
  'elapsedSeconds':time.monotonic()-start,'completedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'productionDatabaseAccess':False,'status':'PROPOSED_SOURCE_GUARDS_ONLY_NOT_EXECUTION_AUTHORITY'}))
 sys.exit(0 if result.wasSuccessful() else 1)
'''.replace('PAYLOAD', repr(base64.b64encode(json.dumps(payload).encode()).decode()))
command = ['py', '-B', '-X', 'utf8', '-'] if '--windows' in sys.argv[2:] else [
    'ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-']
result = subprocess.run(command, input=code, text=True, encoding='utf-8', capture_output=True, timeout=60)
sys.stdout.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(result.returncode)
