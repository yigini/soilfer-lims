"""Retain actual failed forward attempt and verify held originals read-only."""
import base64
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

d=Path(__file__).resolve().parent
target=d/'failed-production-161000';assert not target.exists()
payload=r'''import base64,datetime,hashlib,json,pathlib,subprocess,sys
r=pathlib.Path('/opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z');sys.path.insert(0,str(r))
import import_release_contract as c
import release_support as s
import startup_common as startup
from deploy_import import all_writers_stopped,triple_state
u='lims-release-'+r.name.lower()+'.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,'-p','ActiveState','-p','SubState','-p','Result','-p','ExecMainStatus'],text=True,timeout=15).splitlines())
assert state['ActiveState']=='failed' and state['ExecMainStatus']=='1'
f=r/'production-receipt.json';raw=f.read_bytes();receipt=json.loads(raw)
assert c.sha(f)=='2a03e66071406c58b754d9c63ed8200373c55a0433c2d1ad1cbdc2836d72499e' and f.stat().st_mode&0o777==0o400
assert receipt['status']=='FAILED_IMPORT_FORWARD_HOLD'
manifest=json.loads((r/'prepared-manifest.json').read_bytes());c.frozen_files(r,manifest)
all_writers_stopped();physical=triple_state(s.LIVE);assert physical==receipt['originalDatabaseFiles']
assert c.sha(pathlib.Path(receipt['originalStoppedSeal']['backupPath']))==receipt['stoppedBackupSha256']
assert c.sha(pathlib.Path(manifest['originalProofRoot'])/'rehearsal-receipt.json')==manifest['files']['rehearsal-receipt.json']
assert c.sha(s.CONF)==c.HELD_INGRESS_SHA
live=startup.inspect('soilfer-lims');assert not live['State']['Running']
assert live['Image']==c.LIVE_IMAGE
meta=json.loads((r/'import-dry-container.json').read_bytes());dry=json.loads((r/'import-dry.stdout').read_bytes())
assert meta['exitCode']==0 and dry['mode']=='DRY_RUN' and dry['classification']=='PRE_200' and dry['totalChanges']==0
assert not any((r/n).exists() for n in ['import-apply.stdout','import-apply.stderr','import-apply-container.json','import-repeat-container.json'])
names=['production-receipt.json','execution-attempt.json','instrument-import-attempt.json','import-dry.stdout','import-dry.stderr','import-dry-container.json','import-dry-retained-inspect.stdout','import-dry-retained-inspect.stderr','original-stopped-seal/sealed-state.json','original-stopped-seal/raw/original-triple.json']
files={}
for n in names:
 p=r/n;raw=p.read_bytes();files[n]={'data':base64.b64encode(raw).decode(),'sha256':hashlib.sha256(raw).hexdigest(),'mode':oct(p.stat().st_mode&0o777),'bytes':len(raw)}
files['unit-journal.txt']={'data':base64.b64encode(subprocess.check_output(['journalctl','-u',u,'--no-pager','-o','cat'],timeout=15)).decode()}
record={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'FAILED_PRODUCTION_HELD_PHYSICAL_ORIGINALS_VERIFIED_NO_APPLY','root':str(r),'unitState':state,'receiptSha256':c.sha(f),'originalPhysicalTripleUnchanged':True,'originalStoppedBackupHashUnchanged':True,'allOriginalWritersStopped':True,'ingressHeld':True,'originalImageStopped':True,'dryRunTotalChanges':0,'dryRunMeasurement':meta,'noApplyOrRepeatArtifacts':True,'all62FrozenFilesUnchanged':True,'originalProofReceiptUnchanged':True,'productionMutationsByThisVerifier':0,'liveSqliteConnections':0,'files':files}
for p in ['/api/health','/login']:
 q=subprocess.run(['curl','-sS','--max-time','10','-o','/dev/null','-w','%{http_code}','https://lims.yigini.net'+p],capture_output=True,text=True,timeout=12)
 assert q.returncode==0 and q.stdout=='503';record[p]={'httpStatus':503,'tlsVerified':True}
assert c.sha(f)==record['receiptSha256'];all_writers_stopped()
print(json.dumps(record))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=payload.encode(),capture_output=True,timeout=120)
assert result.returncode==0,result.stderr.decode(errors='replace')
record=json.loads(result.stdout);target.mkdir()
for n,row in record['files'].items():
 raw=base64.b64decode(row.pop('data'));digest=hashlib.sha256(raw).hexdigest()
 if 'sha256' in row:assert digest==row['sha256']
 else:row.update(sha256=digest,bytes=len(raw))
 p=target/n;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb') as out:out.write(raw)
with (target/'read-only-failure-verification.json').open('x',encoding='utf-8',newline='\n') as out:json.dump(record,out,indent=2)
print(json.dumps({key:value for key,value in record.items() if key not in ['files','dryRunMeasurement']}))
