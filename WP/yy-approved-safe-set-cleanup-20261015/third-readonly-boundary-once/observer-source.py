import datetime,json,pathlib
p=pathlib.Path('/opt/lims/cleanup-receipts/yy-safe-set-6189633644');result={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'intentDirectoryExists':p.is_dir(),'readOnly':True,'records':{}}
for n in ['item-results.jsonl','receipt.json']:
 q=p/n
 if q.exists():
  b=q.read_bytes();assert len(b)<=8*1024**2;result['records'][n]={'bytes':len(b),'originalText':b.decode()}
print(json.dumps(result))
