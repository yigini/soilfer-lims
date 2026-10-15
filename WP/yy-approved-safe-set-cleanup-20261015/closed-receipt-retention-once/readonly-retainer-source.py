import datetime,hashlib,json,pathlib,stat
p=pathlib.Path('/opt/lims/cleanup-receipts/yy-safe-set-6189633644');r=json.loads((p/'receipt.json').read_bytes());assert r['status'].startswith('CLOSED') or r['status'].startswith('FAILED')
records=[]
for q in sorted(p.iterdir()):
 assert q.name in ['approval-and-plan.json','before.json','item-results.jsonl','receipt.json'] and q.is_file() and not q.is_symlink()
 a=q.stat();assert stat.S_IMODE(a.st_mode)==0o400 and a.st_size<=16*1024**2;b=q.read_bytes();z=q.stat();assert all(getattr(a,k)==getattr(z,k) for k in ['st_dev','st_ino','st_size','st_mtime_ns','st_mode'])
 records.append({'name':q.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'mode':stat.S_IMODE(a.st_mode),'originalText':b.decode()})
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'CLOSED_CLEANUP_RECORDS_READONLY_RETAINED','records':records,'readOnly':True,'sqlConnections':0,'deletionsByRetainer':0}))
