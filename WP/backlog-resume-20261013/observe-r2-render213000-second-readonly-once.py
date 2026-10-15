"""Second read-only observation of the same new reviewed root/unit; no operator."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015';D=S/'second-r2-213000-readonly-observation-once'
assert not D.exists();D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
probe='''import datetime,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T213000Z');unit='lims-r2-cache-acc15844-20261015t213000z'
assert root.is_dir() and root.resolve()==root and not root.is_symlink(),'Exact existing root required'
props=['LoadState','ActiveState','SubState','Result','ExecMainStatus','ExecMainCode','MainPID','InvocationID','MemoryMax','MemorySwapMax','MemoryCurrent','MemoryPeak','RuntimeMaxUSec','ExecMainStartTimestamp','ExecMainExitTimestamp','ActiveEnterTimestamp','InactiveEnterTimestamp']
state=subprocess.run(['systemctl','show',unit,'--property='+','.join(props)],capture_output=True,timeout=15)
assert len(state.stdout)+len(state.stderr)<2097152
files=[]
for p in root.rglob('*'):
 assert len(files)<100000 and not p.is_symlink(),'Bounded nonalias root required'
 if p.is_file():
  s=p.stat();files.append({'path':str(p.relative_to(root)),'bytes':s.st_size,'mode':oct(stat.S_IMODE(s.st_mode))})
selected={}
for n in ['terminal-receipt.json','terminal-failure.json']:
 p=root/n
 if p.is_file():
  raw=p.read_bytes();assert len(raw)<=8388608;selected[n]=raw.decode()
events=sorted(root.glob('[0-9][0-9][0-9][0-9][0-9]-*.json'))
for p in events[-8:]:
 if p.stat().st_size<=2097152:selected[p.name]=p.read_text()
journal=subprocess.run(['journalctl','-u',unit,'--no-pager','--output=json'],capture_output=True,timeout=15)
assert len(journal.stdout)+len(journal.stderr)<8388608
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctl':{'exitCode':state.returncode,'stdout':state.stdout.decode(),'stderr':state.stderr.decode()},'fileMetadata':files,'selectedOriginalUtf8':selected,'journal':{'exitCode':journal.returncode,'stdout':journal.stdout.decode(),'stderr':journal.stderr.decode()},'eventCount':len(events),'mode':'READONLY_NO_OPERATOR_NO_REPLAY'}))
'''
compile(probe,'readonly-r2-observer.py','exec');save('readonly-observer-source.py',probe.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=60)
save('stdout-original.json',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'operatorsExecuted':0},indent=2)+'\n').encode())
assert r.returncode==0,'Read-only observation failed; never repeat this helper'
v=json.loads(r.stdout);selected={}
for n,raw in v['selectedOriginalUtf8'].items():
 data=json.loads(raw);selected[n]={k:data[k] for k in ['status','error','utc','ID','closedUtc','actualPruneInvocations','remainingLogicalCacheBytes','protectedLogicalBytes','retryAllowed'] if k in data}
print(json.dumps({'observedUtc':v['observedUtc'],'systemctl':v['systemctl'],'fileCount':len(v['fileMetadata']),'eventCount':v['eventCount'],'selected':selected,'newOperatorCalls':0}))
