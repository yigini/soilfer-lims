"""Read complete journal fields for the already closed same R2 invocation only."""
import base64,datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';D=S/'r2-220000-closed-originals-once/fresh-journal-all-once'
assert not D.exists();D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
probe='''import base64,datetime,hashlib,json,subprocess
unit='lims-r2-cache-acc15844-20261015t220000z';inv='b9eb871451b04dbfb1cc666fe0b4ce83'
q=subprocess.run(['systemctl','show',unit,'--property=MainPID,ActiveState,InvocationID'],capture_output=True,timeout=15)
assert q.returncode==0 and not q.stderr
p=dict(x.split('=',1) for x in q.stdout.decode().splitlines());assert p['MainPID']=='0' and p['ActiveState'] in ['inactive','failed'] and p['InvocationID'] in ['',inv]
files={}
for name,fmt in [('journal-all-original.jsonl','json'),('journal-all-original.log','short-iso-precise')]:
 args=['journalctl','-u',unit,'--all','--no-pager','--output='+fmt]
 r=subprocess.run(args,capture_output=True,timeout=20);assert r.returncode==0 and not r.stderr and len(r.stdout)<8388608
 files[name]={'argv':args,'bytes':len(r.stdout),'sha256':hashlib.sha256(r.stdout).hexdigest(),'base64':base64.b64encode(r.stdout).decode()}
rows=[json.loads(x) for x in base64.b64decode(files['journal-all-original.jsonl']['base64']).splitlines() if x]
assert rows and {x.get('INVOCATION_ID',x.get('_SYSTEMD_INVOCATION_ID')) for x in rows}=={inv} and all(isinstance(x.get('MESSAGE'),str) for x in rows)
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'unit':unit,'invocationId':inv,'files':files,'readOnly':True,'cacheOperations':0,'databaseConnections':0}))
'''
compile(probe,'full-journal-readonly.py','exec');save('readonly-source.py',probe.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=60)
save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'operatorsExecuted':0})+'\n').encode())
if r.returncode!=0:save('refused-stdout-original.log',r.stdout)
assert r.returncode==0,'New unique read-only successor required'
v=json.loads(r.stdout)
for n,row in v['files'].items():
 raw=base64.b64decode(row.pop('base64'),validate=True)
 import hashlib
 assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'];save(n,raw)
save('full-journal-read-index.json',(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode())
print(json.dumps(v))
