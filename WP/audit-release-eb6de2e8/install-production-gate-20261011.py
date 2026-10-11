"""Install the newly collected exact-kit gate once; no production execution."""
import importlib.util, json, pathlib, sys
sys.dont_write_bytecode = True
root = pathlib.Path('/opt/lims/releases/combined-release-eb6de2e8-feac6534-20261010T214130Z')
sys.path.insert(0, str(root))
import release_support as s
spec = importlib.util.spec_from_file_location('reviewed_coordinator', root / 'release-forward.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
incoming = pathlib.Path('/tmp/production-gate-feac6534-c4e0a8f.json')
assert s.sha(incoming) == 'c4e0a8f582526af97b4295080049b6087d5e07584e8a65ee4aaa3ff9b0d33f03'
manifest = json.loads((root / 'prepared-manifest.json').read_text())
gate = json.loads(incoming.read_text())
module.verify_gate(manifest, gate)
evidence = pathlib.Path('/opt/lims/releases/image-cleanup-feac6534-20261011T053500Z')
first = json.loads((evidence / 'sample-1.json').read_text())
second = json.loads((evidence / 'sample-2.json').read_text())
from datetime import datetime
assert (datetime.fromisoformat(second['utc']) - datetime.fromisoformat(first['utc'])).total_seconds() >= 300
current = s.disk_free()
assert min(current.values()) >= second['requiredFreeBytes']
s.check_drop(second['freeBytes'], current, {k:0 for k in current})
assert not (root / 'production-receipt.json').exists()
target = root / 'production-gate.json'
with target.open('xb') as stream:
    stream.write(incoming.read_bytes())
target.chmod(0o400)
assert s.sha(target) == s.sha(incoming)
print(json.dumps({'status':'FRESH_GATE_INSTALLED_NOT_EXECUTED', 'gateSha256':s.sha(target),
    'verifiedUtc':gate['verifiedUtc'], 'includedPrCount':gate['prGates']['includedPrCount'],
    'ungatedPrs':gate['prGates']['ungatedPrs'], 'freeBytes':current,
    'requiredFreeBytes':second['requiredFreeBytes'], 'workloadControl':gate['workloadControl']}))
