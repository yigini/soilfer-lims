import base64,datetime,hashlib,json,subprocess
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
