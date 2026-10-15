"""New read-only observer with explicit zero byte; no cleanup re-dispatch."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-approved-safe-set-cleanup-20261015/timeout-literal-successor-readonly-once';assert not D.exists();D.mkdir()
source='''import datetime,json,pathlib,os
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
'''
compile(source,'observer-source.py','exec');(D/'observer-source.py').write_text(source,encoding='utf-8');p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=source.encode(),capture_output=True,timeout=30,cwd=R)
(D/'stdout-original.json').write_bytes(p.stdout);(D/'stderr-original.log').write_bytes(p.stderr);(D/'exit-original.json').write_text(json.dumps({'exitCode':p.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}));assert p.returncode==0
v=json.loads(p.stdout);rows=[]
for line in v['records'].get('item-results.jsonl',{}).get('originalText','').splitlines():
 try:rows.append(json.loads(line))
 except ValueError:pass
counts={}
for r in rows:
 if r['status'] in ['REMOVED','SKIPPED_CHANGED','NOT_REMOVED_OR_COMMAND_REFUSED','SKIPPED_FILTER_OR_STATE_MISMATCH']:counts[r['category']+':'+r['status']]=counts.get(r['category']+':'+r['status'],0)+1
print(json.dumps({'observedUtc':v['observedUtc'],'terminalReceiptPresent':'receipt.json' in v['records'],'completedItemCounts':counts,'latestStatus':rows[-1]['status'] if rows else None,'matchingProcesses':v['matchingLiveProcesses'],'readOnly':True}))
