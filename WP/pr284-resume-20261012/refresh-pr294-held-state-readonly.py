"""Fresh read-only held-state observation; never replay the failed execution."""
import ast
import datetime
import json
from pathlib import Path
import subprocess

d = Path(__file__).resolve().parent
tree = ast.parse((d / 'retain-pr294-failed-production-161000-readonly.py').read_bytes())
payload = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign) and
    any(isinstance(target, ast.Name) and target.id == 'payload' for target in node.targets))
payload = payload.replace('print(json.dumps(record))', '''
for future in ['instrument-import-package-959d17e1-20261012T202400Z',
               'instrument-import-release-959d17e1-20261012T202400Z']:
 path=pathlib.Path('/opt/lims/releases')/future
 assert not path.exists() and not path.is_symlink(), 'Future root is not unused'
record['futurePackageAndKitRootsAbsent']=True
record['freeBytes']=s.disk_free()
record.pop('files')
record.pop('dryRunMeasurement')
print(json.dumps(record))''')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
target = d / ('held-readonly-' + stamp)
target.mkdir()
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
    'root@46.19.33.37', 'python3', '-B', '-'], input=payload.encode(), capture_output=True, timeout=120)
for name, raw in [('stdout.json', result.stdout), ('stderr.log', result.stderr)]:
    with (target / name).open('xb') as out: out.write(raw)
assert result.returncode == 0, result.stderr.decode(errors='replace')
print(result.stdout.decode())
