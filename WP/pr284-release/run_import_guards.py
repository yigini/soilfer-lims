"""Run exact committed owned-snapshot guards; no production database access."""
import base64
import hashlib
import json
import subprocess
import sys

head = sys.argv[1]
if len(head) != 40 or any(character not in '0123456789abcdef' for character in head):
    raise RuntimeError('Exact source commit required')
names = ['import_source_graph', 'import_preservation', 'import_startup_checks',
    'import_installation', 'import_stage', 'import_proof_contract', 'import_sealing', 'known_core_disk_guard_import',
    'test_import_preservation', 'test_import_startup_checks', 'test_import_installation', 'test_import_stage',
    'test_import_sealing', 'test_import_authority', 'test_import_layout',
    'production_output_paths', 'test_production_output_paths', 'import_release_contract', 'test_import_release',
    'known_core_disk_guard_import_deploy', 'test_import_deploy_layout',
    'export_freeze_import_kit', 'test_import_packaging_transport']
files = {name: subprocess.check_output(['git', 'show', head + ':WP/pr284-release/' + name + '.py']) for name in names}
helpers = {'release_support': '9db6932a9b1502bc2db65c816a925e7d9f54611d54d4027d418bb2574b837810',
    'startup_common': 'e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00'}
raw_helpers = {name: subprocess.check_output(['git', 'show', head + ':WP/forward-ae64f169/' + name + '.py']) for name in helpers}
if any(hashlib.sha256(raw).hexdigest() != helpers[name] for name, raw in raw_helpers.items()):
    raise RuntimeError('Historical measured helper changed')
extra = {'known_core_disk_guard': 'WP/runtime-containment-ae64f169/known_core_disk_guard.py',
    'known_core_disk_guard_v2': 'WP/runtime-recovery-kobo/known_core_disk_guard_v2.py',
    'known_core_disk_guard_v3': 'WP/runtime-recovery-kobo/known_core_disk_guard_v3.py',
    'runtime_proof_policies': 'WP/runtime-recovery-kobo/proof_contract.py',
    'test_baseline_confirmation': 'WP/runtime-recovery-kobo/test_baseline_confirmation.py'}
files = dict(raw_helpers, **{name: subprocess.check_output(['git', 'show', head + ':' + path])
    for name, path in extra.items()}, **files)
graph_namespace = {}
exec(compile(files['import_source_graph'], '/owned-graph.py', 'exec'), graph_namespace)
tooling, tooling_index = graph_namespace['git_source'](head, lambda *args: subprocess.check_output(['git', *args]))
production_names = ['import_release_contract.py', 'deploy_import.py', 'freeze_import.py',
    'known_core_disk_guard_import_deploy.py', 'collect_import_gate.py', 'export_freeze_import_kit.py', 'launch_import_release.py',
    'production_output_paths.py']
package = dict(tooling)
for name in production_names:
    package[name] = subprocess.check_output(['git', 'show', head + ':WP/pr284-release/' + name])
package['yy-authorization-evidence.md'] = subprocess.check_output(['git', 'show',
    head + ':WP/forward-ae64f169/yy-authorization-evidence.md'])
for name in ['yy-maintenance-choice-evidence.json', 'held-entry-scope-review.json', 'held-entry-receipt.json']:
    package[name] = subprocess.check_output(['git', 'show', head + ':WP/pr284-release/' + name])
for name, raw in package.items():
    if name.endswith('.py'): compile(raw, '/owned-compile-only/' + name, 'exec')
for name, raw in tooling.items():
    if name.endswith('.py'): compile(raw, '/owned-compile-only/' + name, 'exec')
assets = {name: subprocess.check_output(['git', 'show', head + ':server/prisma/migrations/20261010000100_instrument_import_templates/' + name])
    for name in ['migration.sql', 'fresh-prisma-tables.json', 'pre-prisma-draft-table.sql',
        'upgraded-prisma-draft-table.sql', 'post205-draft-tables.json']}
payload = {'sourceCommit': head, 'tooling': {name: base64.b64encode(raw).decode() for name, raw in tooling.items()},
    'frozenFixture': {name: base64.b64encode(subprocess.check_output(['git', 'show', head +
        ':WP/pr284-frozen-kit-20261012T161000Z/' + name])).decode() for name in json.loads(
        subprocess.check_output(['git', 'show', head + ':WP/pr284-frozen-kit-20261012T161000Z/prepared-manifest.json']))['files']},
    'originalBuildAuthority': {key: json.loads(subprocess.check_output(['git', 'show', head +
        ':WP/pr284-resume-20261012/build-959d17e1-135400/' + name])) for key, name in
        [('source', 'tooling-source-index.json'), ('review', 'proof-source-review.json')]},
    'package': {name: base64.b64encode(raw).decode() for name, raw in package.items()},
    'toolingIndex': tooling_index, 'files': {name: {'data': base64.b64encode(raw).decode(),
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
  module=types.ModuleType(name);module.__file__='/owned-in-memory-guards/WP/pr284-release/'+name+'.py';module.__raw_sha256__=hashlib.sha256(raw).hexdigest();sys.modules[name]=module
  exec(compile(raw,module.__file__,'exec'),module.__dict__)
 tests=sys.modules['test_import_preservation'];tests.ASSET_ROOT=root
 sys.modules['test_production_output_paths'].FROZEN_FIXTURE_BYTES={name:base64.b64decode(raw) for name,raw in p['frozenFixture'].items()}
 for name in ['test_import_authority','test_import_layout','test_import_release']:
  sys.modules[name].RAW_TOOLING={n:base64.b64decode(raw) for n,raw in p['tooling'].items()}
 sys.modules['test_import_release'].RAW_PACKAGE={n:base64.b64decode(raw) for n,raw in p['package'].items()}
 sys.modules['test_import_authority'].ORIGINAL_BUILD_AUTHORITY=p['originalBuildAuthority']
 sys.modules['test_import_deploy_layout'].RAW_PACKAGE={n:base64.b64decode(raw) for n,raw in p['package'].items()}
 suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[name]) for name in p['files'] if name.startswith('test_'))
 result=unittest.TextTestRunner(verbosity=2).run(suite)
 print(json.dumps({'sourceCommit':p['sourceCommit'],'sourceHashes':{name:item['sha256'] for name,item in p['files'].items()},
  'packagingSourceHashes':{name:hashlib.sha256(base64.b64decode(raw)).hexdigest() for name,raw in p['package'].items()},
  'assetHashes':{name:item['sha256'] for name,item in p['assets'].items()},'toolingIndex':p['toolingIndex'],'tests':result.testsRun,
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
