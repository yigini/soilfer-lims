"""Observe the SAME new proof; no SQLite, Docker exec or writer changes."""
import datetime
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
code = r'''import datetime,hashlib,json,pathlib,subprocess,os
r=pathlib.Path('/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z')
u='lims-owned-instrument-import-proof-959d17e1-20261012t144000z.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,'-p','ActiveState','-p','SubState','-p','ExecMainStatus','-p','Result'],text=True,timeout=15).splitlines())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source=json.loads((r/'source-index.json').read_bytes())
assert source['head']=='201bb5fe8fd30cb2991f7169177a864265e6301b'
assert all(sha(r/n)==row['sha256'] and (r/n).stat().st_mode&0o777==0o400 for n,row in source['files'].items())
assert sha(r/'target-pin.json')=='241bd693b8cfdb3e9a05440716bd925a620a807bdb371206430a4abc2a9481b1'
names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True,timeout=15).splitlines()
selected=['soilfer-lims']+[name for name in names if name.startswith('lims-owned-'+r.name.lower())]
containers=[]
for name in selected:
 a=json.loads(subprocess.check_output(['docker','inspect',name],text=True,timeout=15))[0]
 containers.append({'name':name,'image':a['Image'],'restartCount':a['RestartCount'],
  'state':{k:a['State'].get(k) for k in ['Status','Running','OOMKilled','ExitCode','Health']},'memoryBytes':a['HostConfig']['Memory']})
files={p.name:{'bytes':p.stat().st_size,'mode':oct(p.stat().st_mode&0o777)} for p in r.iterdir() if p.is_file()}
receipt=None
if (r/'rehearsal-receipt.json').exists():
 p=r/'rehearsal-receipt.json';assert p.stat().st_mode&0o777==0o400
 receipt={'sha256':sha(p),'value':json.loads(p.read_bytes())}
outputs={}
for name in ['unit.stdout','unit.stderr']:
 p=r/name
 if p.exists():outputs[name]=p.read_text(encoding='utf-8',errors='replace')[-6000:]
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':u,
 'unitState':state,'files':files,'receipt':receipt,'containers':containers,'outputs':outputs,
 'freeBytes':os.statvfs('/opt/lims').f_bavail*os.statvfs('/opt/lims').f_frsize,
 'productionMutations':0,'sqliteConnections':0}))
'''
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
    input=code, text=True, encoding='utf-8', capture_output=True, timeout=60)
assert result.returncode == 0, result.stderr
evidence = json.loads(result.stdout)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
path = directory / ('pr294-sidecar-proof-observation-' + stamp + '.json')
with path.open('x', encoding='utf-8', newline='\n') as stream: json.dump(evidence, stream, indent=2)
print(json.dumps({'path':str(path),'observedUtc':evidence['observedUtc'],'unitState':evidence['unitState'],
    'receipt':evidence['receipt'], 'containers':evidence['containers'], 'freeBytes':evidence['freeBytes'],
    'outputs':evidence['outputs']}))
