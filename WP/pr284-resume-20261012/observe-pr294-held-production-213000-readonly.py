"""Observe the SAME production unit and terminal evidence, without host mutation."""
import datetime
import json
from pathlib import Path
import subprocess

d=Path(__file__).resolve().parent
payload=r'''import datetime,hashlib,json,pathlib,subprocess
r=pathlib.Path('/opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z')
u='lims-release-'+r.name.lower()+'.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,'-p','ActiveState','-p','SubState','-p','Result','-p','ExecMainStatus'],text=True,timeout=15).splitlines())
record={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':u,'unitState':state,'productionMutations':0}
for n in ['execution-attempt.json','production-receipt.in-progress','production-receipt.json']:
 f=r/n
 if f.exists():
  raw=f.read_bytes();j=json.loads(raw)
  record[n]={'sha256':hashlib.sha256(raw).hexdigest(),'mode':oct(f.stat().st_mode&0o777),'status':j.get('status'),'head':j.get('head'),'timesUtc':j.get('timesUtc'),'keys':list(j)}
  if 'peakBytes' in j:record[n]['peakBytes']=j['peakBytes']
  if 'normalJobsHealthSamples' in j:record[n]['normalJobsHealthSampleCount']=len(j['normalJobsHealthSamples'])
journal=subprocess.check_output(['journalctl','-u',u,'-n','12','--no-pager','-o','cat'],text=True,timeout=15)
record['journalTail']=journal
record['ownedRunningNames']=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True,timeout=15).splitlines()
summary={key:record[key] for key in ['observedUtc','unitState','journalTail']}
if 'production-receipt.json' in record:
 summary['receipt']={key:value for key,value in record['production-receipt.json'].items() if key!='keys'}
summary['runningLimsNames']=[name for name in record['ownedRunningNames'] if 'lims' in name]
live=subprocess.run(['docker','inspect','soilfer-lims'],capture_output=True,text=True,timeout=15)
if live.returncode==0:
 item=json.loads(live.stdout)[0];env=dict(row.split('=',1) for row in item['Config']['Env'] if '=' in row)
 summary['liveContainer']={'image':item['Image'],'running':item['State']['Running'],'health':item['State'].get('Health',{}).get('Status'),'restartCount':item['RestartCount'],'oomKilled':item['State']['OOMKilled'],'jobsDisabled':env.get('DISABLE_BACKGROUND_JOBS'),'memoryLimitBytes':item['HostConfig']['Memory'],'nodeOptions':env.get('NODE_OPTIONS','')}
print(json.dumps(summary))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=payload.encode(),capture_output=True,timeout=60)
assert result.returncode==0,result.stderr.decode(errors='replace')
record=json.loads(result.stdout)
name='pr294-held-production-observation-213000-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json'
with (d/name).open('x',encoding='utf-8',newline='\n') as out: json.dump(record,out,indent=2)
print(json.dumps(record))
