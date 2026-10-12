"""One read-only unused-kit and headroom observation, without collecting a gate."""
import json
from pathlib import Path
import subprocess

d=Path(__file__).resolve().parent
payload=r'''import datetime,json,pathlib,subprocess,sys
r=pathlib.Path('/opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z');sys.path.insert(0,str(r))
from deploy_import import execution_preflight
result=execution_preflight(r,'5392cab2c224e68e74694950336ec1fad638eb4c0bf282e6614009f58cb5c7c8',require_unused_gate=True)
result['observedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
result['status']='READ_ONLY_UNUSED_KIT_HEADROOM_READY_NOT_A_GATE'
result['https']={}
for p in ['/api/health','/login']:
 response=subprocess.run(['curl','-sS','--max-time','10','-w','\n%{http_code}','https://lims.yigini.net'+p],capture_output=True,text=True,timeout=12)
 body,_,status=response.stdout.rpartition('\n');assert response.returncode==0 and status=='200'
 result['https'][p]={'httpStatus':200,'tlsVerified':True}
 if p=='/api/health':
  value=json.loads(body);assert value['status']=='ok';result['https'][p]['status']=value['status']
print(json.dumps(result))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=payload.encode(),capture_output=True,timeout=120)
assert result.returncode==0,result.stderr.decode(errors='replace')
record=json.loads(result.stdout)
with (d/'pr294-unused-kit-headroom-161000-readonly.json').open('x',encoding='utf-8',newline='\n') as out: json.dump(record,out,indent=2)
print(json.dumps(record))
