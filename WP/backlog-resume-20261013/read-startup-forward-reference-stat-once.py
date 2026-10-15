"""Reference capacity only: owned209 input/backup/assets metadata, no source operator."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-startup-forward-cde8-20261015';D=S/'reference-owned209-capacity-metadata-once';assert not D.exists();D.mkdir();sys.path.insert(0,str(S))
from proof_contract import PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP
from proof_budget import capacity_probe_source,capacity_gate,TABLE,TABLE_SHA,TOTAL_DB_COPIES,DB_EQUIVALENTS
script=capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP);(D/'metadata-source.py').write_bytes(script)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script,capture_output=True,timeout=35)
for name,b in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr)]:
 with (D/name).open('xb') as f:f.write(b)
with (D/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'referenceOnlyNotLaunchAuthority':True,'newOperations':0},f)
assert r.returncode==0,'Retain refusal, never replay'
v=json.loads(r.stdout);error=None
try:capacity_gate(v)
except RuntimeError as e:error=str(e)
record={'status':'REFERENCE_FIT_NOT_CURRENT_LAUNCH_AUTHORITY' if error is None else 'REFERENCE_CAPACITY_STOP_NOT_LAUNCH_AUTHORITY','actualMetadata':v,'declaredTable':TABLE,'tableSha256':TABLE_SHA,'N':TOTAL_DB_COPIES,'equivalents':DB_EQUIVALENTS,'slackBytes':min(v['freeBytes'].values())-v['requiredBytes'],'error':error,'newRootCreated':False,'operatorsExecuted':0,'productionSqlConnections':0,'freshBeforeRootAndBeforeUnitStillRequired':True}
with (D/'reference-assessment.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
print(json.dumps(record))
