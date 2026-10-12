"""Retain a read-only diagnosis of the failed packaging attempt; no retry."""
import datetime
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
code = r'''import datetime,hashlib,json,os,pathlib,subprocess
package=pathlib.Path('/opt/lims/releases/instrument-import-package-959d17e1-20261012T154640Z')
target=pathlib.Path('/opt/lims/releases/instrument-import-release-959d17e1-20261012T154640Z')
proof=pathlib.Path('/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(proof/'rehearsal-receipt.json')=='f2aff1624aa6b11abeca36374ffe45fc3b06c9ab78727b48b877512ba9f2fbce'
assert (proof/'rehearsal-receipt.json').stat().st_mode&0o777==0o400
unit='lims-owned-'+proof.name.lower()+'.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',unit,'-p','ActiveState','-p','SubState','-p','ExecMainStatus'],text=True,timeout=15).splitlines())
assert state['ActiveState']=='inactive' and state['ExecMainStatus']=='0'
processes=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  args=(p/'cmdline').read_bytes().split(b'\0')
  if str(package/'freeze_import.py').encode() in args:
   processes.append({'pid':int(p.name),'command':'freeze_import.py','root':str(package)})
 except (FileNotFoundError,PermissionError,ProcessLookupError):pass
files={}
if target.exists():
 files={p.name:{'bytes':p.stat().st_size,'sha256':sha(p),'mode':oct(p.stat().st_mode&0o777)} for p in target.iterdir() if p.is_file()}
live=json.loads(subprocess.check_output(['docker','inspect','soilfer-lims'],text=True,timeout=15))[0]
assert live['Image']=='sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f' and live['RestartCount']==0 and live['State']['Health']['Status']=='healthy'
https={}
for path in ['/api/health','/login']:
 r=subprocess.run(['curl','-sS','--max-time','10','-w','\n%{http_code}','https://lims.yigini.net'+path],capture_output=True,text=True,timeout=12)
 body,_,status=r.stdout.rpartition('\n');assert r.returncode==0 and status=='200';https[path]={'httpStatus':200,'tlsVerified':True}
 if path=='/api/health':assert json.loads(body)['status']=='ok'
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'READ_ONLY_FREEZE_TIMEOUT_DIAGNOSIS','packageRoot':str(package),'packageExists':package.exists(),'executionRoot':str(target),'executionRootExists':target.exists(),'files':files,'freezerProcesses':processes,'proofUnitState':state,'originalProofReceiptSha256':sha(proof/'rehearsal-receipt.json'),'liveImage':live['Image'],'liveHealthy':True,'restartCount':0,'https':https,'freeBytes':os.statvfs('/opt/lims').f_bavail*os.statvfs('/opt/lims').f_frsize,'productionOperations':0,'sqliteConnections':0}))
'''
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
    input=code.encode(), capture_output=True, timeout=60)
assert result.returncode == 0, result.stderr.decode('utf-8', errors='replace')
value = json.loads(result.stdout)
with (directory / 'pr294-freeze-154640-timeout-diagnosis.json').open('x', encoding='utf-8', newline='\n') as stream: json.dump(value, stream, indent=2)
print(json.dumps(value))
