"""Observe finite stage artifacts of the same unit without opening any database."""
import datetime
import json
from pathlib import Path
import subprocess

d=Path(__file__).resolve().parent
payload=r'''import datetime,hashlib,json,pathlib,subprocess
r=pathlib.Path('/opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z')
u='lims-release-'+r.name.lower()+'.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,'-p','ActiveState','-p','SubState','-p','Result','-p','ExecMainStatus'],text=True,timeout=15).splitlines())
result={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unitState':state,'productionMutations':0,'liveSqliteConnections':0,'stages':{}}
for label in ['import-dry','import-apply','import-repeat']:
 row={}
 owner=str(r)+':'+label
 name='lims-owned-import-cli-'+hashlib.sha256(owner.encode()).hexdigest()[:24]
 inspected=subprocess.run(['docker','inspect',name],capture_output=True,text=True,timeout=15)
 if inspected.returncode==0:
  container=json.loads(inspected.stdout)[0]
  assert container['Config']['Labels']['io.soilfer.release-owned']==owner
  row['ownedContainer']={'name':name,'restartCount':container['RestartCount'],**{k:container['State'][k] for k in ['Running','ExitCode','OOMKilled','StartedAt','FinishedAt']}}
 for suffix in ['.stdout','.stderr','-container.json']:
  p=r/(label+suffix)
  if p.exists():
   assert not p.is_symlink() and p.is_file()
   row[suffix]={'bytes':p.stat().st_size}
   if suffix!='.stderr':
    try:
     value=json.loads(p.read_bytes())
     row[suffix].update({k:value[k] for k in ['mode','classification','totalChanges','exitCode','peakBytes','elapsedSeconds','memoryBytes','nodeOptions','oomKilled','restartCount'] if k in value})
     if 'cgroupMemoryPeak' in value:row[suffix]['cgroupMemoryPeak']=value['cgroupMemoryPeak']
    except json.JSONDecodeError:
     row[suffix]['jsonComplete']=False
 result['stages'][label]=row
for label in ['production-jobs-off','production-jobs-on']:
 row={}
 for suffix in ['-readiness.json','-startup.stdout','-startup.stderr']:
  p=r/(label+suffix)
  if p.exists():
   assert not p.is_symlink() and p.is_file()
   row[suffix]={'bytes':p.stat().st_size}
   if suffix=='-readiness.json':
    value=json.loads(p.read_bytes())
    row[suffix].update({k:value[k] for k in ['elapsedSeconds','jobsEnabled','restartCount','oomKilled'] if k in value})
 result['stages'][label]=row
print(json.dumps(result))
'''
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=payload.encode(),capture_output=True,timeout=60)
assert result.returncode==0,result.stderr.decode(errors='replace')
value=json.loads(result.stdout)
name='pr294-production-stage-files-213000-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json'
with (d/name).open('x',encoding='utf-8',newline='\n') as out:json.dump(value,out,indent=2)
print(json.dumps(value))
