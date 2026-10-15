"""Observe the third boundary of the same cleanup only; no mutations or re-dispatch."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-approved-safe-set-cleanup-20261015/third-readonly-boundary-once';assert not D.exists();D.mkdir()
source='''import datetime,json,pathlib
p=pathlib.Path('/opt/lims/cleanup-receipts/yy-safe-set-6189633644');result={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'intentDirectoryExists':p.is_dir(),'readOnly':True,'records':{}}
for n in ['item-results.jsonl','receipt.json']:
 q=p/n
 if q.exists():
  b=q.read_bytes();assert len(b)<=8*1024**2;result['records'][n]={'bytes':len(b),'originalText':b.decode()}
print(json.dumps(result))
'''
(D/'observer-source.py').write_text(source,encoding='utf-8');p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=source.encode(),capture_output=True,timeout=30,cwd=R)
(D/'stdout-original.json').write_bytes(p.stdout);(D/'stderr-original.log').write_bytes(p.stderr);(D/'exit-original.json').write_text(json.dumps({'exitCode':p.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}));assert p.returncode==0
v=json.loads(p.stdout);rows=[]
for line in v['records'].get('item-results.jsonl',{}).get('originalText','').splitlines():
 try:rows.append(json.loads(line))
 except ValueError:pass
counts={}
for row in rows:
 if row['status'] in ['REMOVED','SKIPPED_CHANGED','NOT_REMOVED_OR_COMMAND_REFUSED','SKIPPED_FILTER_OR_STATE_MISMATCH']:counts[row['status']]=counts.get(row['status'],0)+1
print(json.dumps({'observedUtc':v['observedUtc'],'terminalReceiptPresent':'receipt.json' in v['records'],'observedCompletedItemCounts':counts,'latestObservedStatus':rows[-1]['status'] if rows else None,'readOnly':True}))
