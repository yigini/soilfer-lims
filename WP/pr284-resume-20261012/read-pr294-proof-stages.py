"""Retain finished CLI metadata read-only; never connect SQLite or enter a container."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
code = r'''import datetime,hashlib,json,pathlib
r=pathlib.Path('/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z')
result={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'stages':{}}
for label in ['import-dry','import-apply','import-repeat']:
 p=r/(label+'-container.json')
 if not p.exists():continue
 assert p.is_file() and not p.is_symlink() and p.stat().st_mode&0o777==0o400
 metadata=json.loads(p.read_bytes()); artifacts={}
 for name,digest in metadata['retainedArtifacts'].items():
  a=r/name;raw=a.read_bytes()
  assert a.is_file() and not a.is_symlink() and a.stat().st_mode&0o777==0o400
  assert hashlib.sha256(raw).hexdigest()==digest
  artifacts[name]={'sha256':digest,'bytes':len(raw),'text':raw.decode('utf-8')}
 result['stages'][label]={'metadataSha256':hashlib.sha256(p.read_bytes()).hexdigest(),
  'metadata':metadata,'artifacts':artifacts}
for name in ['import-install-preservation.json','installed-protected-state.json']:
 p=r/name
 if p.exists():
  assert p.is_file() and not p.is_symlink() and p.stat().st_mode&0o777==0o400
  result[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'value':json.loads(p.read_bytes())}
print(json.dumps(result))
'''
completed = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
    'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True, encoding='utf-8',
    capture_output=True, timeout=60)
assert completed.returncode == 0, completed.stderr
record = json.loads(completed.stdout)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
path = directory / ('pr294-proof-stages-' + stamp + '.json')
with path.open('x', encoding='utf-8', newline='\n') as output:
    json.dump(record, output, ensure_ascii=False, indent=2)
summary = {}
for label, row in record['stages'].items():
    metadata = row['metadata']
    value = json.loads(row['artifacts'][label + '.stdout']['text'])
    summary[label] = {'exitCode': metadata['exitCode'], 'elapsedSeconds': metadata['elapsedSeconds'],
        'peak': metadata['cgroupMemoryPeak'], 'metadataSha256': row['metadataSha256'],
        'classification': value.get('classification'), 'mode': value.get('mode'),
        'totalChanges': value.get('totalChanges'), 'backfilledCount': value.get('backfilledCount')}
print(json.dumps({'record': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'observedUtc': record['observedUtc'], 'stages': summary,
    'sealedArtifacts': [name for name in record if name.endswith('.json')]}))
