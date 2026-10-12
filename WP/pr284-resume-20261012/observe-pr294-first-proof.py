"""Read the one original proof unit and its artifacts; no SQLite or docker exec."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
code = r'''import datetime,hashlib,json,pathlib,shutil,subprocess
r=pathlib.Path('/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z')
u='lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,
 '-p','ActiveState','-p','SubState','-p','ExecMainStatus','-p','Result'],text=True).splitlines())
assert r.is_dir() and not r.is_symlink()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source=json.loads((r/'source-index.json').read_bytes())
assert source['head']=='630b2354a1a45df0d88545ac5c63594361615999'
assert all(sha(r/n)==item['sha256'] and (r/n).stat().st_mode&0o777==0o400 for n,item in source['files'].items())
assert sha(r/'target-pin.json')=='3786a68f0df9e0762a4d7cc144251b9180297f7dbf9d5745a8591d58f9680a8f'
names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True).splitlines()
selected=['soilfer-lims']+[n for n in names if n.startswith('lims-owned-'+r.name.lower())]
containers=[]
for n in selected:
 a=json.loads(subprocess.check_output(['docker','inspect',n],text=True,timeout=15))[0]
 containers.append({'name':n,'image':a['Image'],'restartCount':a['RestartCount'],
  'state':{k:a['State'].get(k) for k in ['Status','Running','OOMKilled','ExitCode','Health']},
  'memoryBytes':a['HostConfig']['Memory']})
files={p.name:{'bytes':p.stat().st_size,'mode':oct(p.stat().st_mode&0o777)} for p in r.iterdir() if p.is_file()}
receipt=None
if (r/'rehearsal-receipt.json').exists():
 p=r/'rehearsal-receipt.json';assert p.stat().st_mode&0o777==0o400
 receipt={'sha256':sha(p),'value':json.loads(p.read_bytes())}
outputs={}
for n in ['unit.stdout','unit.stderr']:
 p=r/n
 if p.exists():
  with p.open('rb') as f:
   f.seek(max(0,p.stat().st_size-3000));outputs[n]=f.read().decode('utf-8',errors='replace')
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'root':str(r),'unit':u,'unitState':state,'sourceBytesUnchanged':True,
 'containers':containers,'files':files,'receipt':receipt,'tail':outputs,
 'freeBytes':shutil.disk_usage('/opt/lims').free,'productionMutations':0}))
'''
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
    'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True, encoding='utf-8', capture_output=True, timeout=60)
assert result.returncode == 0, result.stderr
evidence = json.loads(result.stdout)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
path = directory / ('pr294-first-proof-observation-' + stamp + '.json')
with path.open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(evidence, stream, indent=2)
print(json.dumps({'record': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'observedUtc': evidence['observedUtc'], 'unitState': evidence['unitState'],
    'containers': evidence['containers'], 'fileNames': list(evidence['files']),
    'receipt': evidence['receipt'], 'tail': evidence['tail'], 'freeBytes': evidence['freeBytes']}))
