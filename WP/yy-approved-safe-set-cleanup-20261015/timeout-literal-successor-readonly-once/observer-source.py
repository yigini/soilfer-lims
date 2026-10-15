import datetime,json,pathlib,os
p=pathlib.Path('/opt/lims/cleanup-receipts/yy-safe-set-6189633644');result={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'records':{},'matchingLiveProcesses':[]}
for n in ['item-results.jsonl','receipt.json']:
 q=p/n
 if q.exists():
  b=q.read_bytes();assert len(b)<=16*1024**2;result['records'][n]={'bytes':len(b),'originalText':b.decode()}
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdecimal() or int(p.name)==os.getpid():continue
 try:args=(p/'cmdline').read_bytes().split(bytes([0]))
 except (FileNotFoundError,PermissionError,ProcessLookupError):continue
 if args[:3]==[b'python3',b'-B',b'-'] or b'buildx' in args and b'prune' in args:result['matchingLiveProcesses'].append({'pid':int(p.name),'argv':[x.decode(errors='replace') for x in args if x]})
print(json.dumps(result))
