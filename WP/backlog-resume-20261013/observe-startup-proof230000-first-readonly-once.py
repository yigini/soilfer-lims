"""First read-only observation of the same230000 startup proof; never redispatch."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-startup-be837974-20261015';D=S/'first-proof230000-readonly-observation-once'
assert not D.exists();D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
probe='''import datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-startup-be837974-20261015T230000Z');unit='lims-workflow-batch-startup-be837974-20261015t230000z'
assert root.is_dir() and root.resolve(strict=True)==root and not root.is_symlink(),'Existing exact root required'
props=['LoadState','ActiveState','SubState','Result','ExecMainStatus','ExecMainCode','MainPID','InvocationID','MemoryMax','MemorySwapMax','MemoryCurrent','MemoryPeak','RuntimeMaxUSec','ExecMainStartTimestamp','ExecMainExitTimestamp','ActiveEnterTimestamp','InactiveEnterTimestamp']
state=subprocess.run(['systemctl','show',unit,'--property='+','.join(props)],capture_output=True,timeout=15)
assert len(state.stdout)+len(state.stderr)<2097152
files=[];vanished=[]
for p in root.rglob('*'):
 assert len(files)<200000 and not p.is_symlink(),'Bounded nonalias root required'
 try:
  st=p.stat()
  if p.is_file():files.append({'path':p.relative_to(root).as_posix(),'bytes':st.st_size,'mode':oct(stat.S_IMODE(st.st_mode))})
 except FileNotFoundError:vanished.append(p.relative_to(root).as_posix())
selected={}
names=['proof-intent.json','proof-receipt.json','proof-terminal-refusal.json','fresh-r4-before-proof-copies.json','measured-copy-reserve.json','predecessor-before-selected.json','startup-1-default-entrypoint-attempt.json','startup-2-default-entrypoint-attempt.json','startup-1-result.json','startup-2-result.json']
for n in names:
 p=root/n
 if p.is_file():
  raw=p.read_bytes();assert len(raw)<=16777216;selected[n]=raw.decode('utf-8','strict')
spec=json.loads((root/'proof-input.json').read_bytes());expected=dict(spec['packageHashes']);expected['proof-input.json']=hashlib.sha256((root/'proof-input.json').read_bytes()).hexdigest()
package={}
for n,digest in expected.items():
 p=root/n;raw=p.read_bytes();s=p.stat();actual=hashlib.sha256(raw).hexdigest();assert actual==digest and stat.S_IMODE(s.st_mode)==0o400,n
 package[n]={'bytes':len(raw),'sha256':actual,'mode':oct(stat.S_IMODE(s.st_mode))}
journal=subprocess.run(['journalctl','--all','-u',unit,'--no-pager','--output=json'],capture_output=True,timeout=15)
assert len(journal.stdout)+len(journal.stderr)<=16777216
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctl':{'exitCode':state.returncode,'stdout':state.stdout.decode(),'stderr':state.stderr.decode()},'fileMetadata':files,'vanishedDuringActiveObservation':vanished,'packageHashes':package,'selectedOriginalUtf8':selected,'journal':{'exitCode':journal.returncode,'stdout':journal.stdout.decode(),'stderr':journal.stderr.decode()},'mode':'READONLY_SAME_ROOT_UNIT_NO_OPERATOR_NO_REPLAY'}))
'''
compile(probe,'readonly-startup-proof-observer.py','exec');save('readonly-observer-source.py',probe.encode())
args=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-']
save('command-original.json',(json.dumps({'argv':args,'operatorsExecuted':0,'neverReplay':True})+'\n').encode())
r=subprocess.run(args,cwd=R,input=probe.encode(),capture_output=True,timeout=60)
save('stdout-original.json',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'operatorsExecuted':0},indent=2)+'\n').encode())
assert r.returncode==0,'Read-only observation failed; never repeat helper'
v=json.loads(r.stdout);selected={}
for n,raw in v['selectedOriginalUtf8'].items():
 value=json.loads(raw);selected[n]={k:value[k] for k in ['status','error','startedUtc','closedUtc','id','elapsedSeconds','memoryPeakBytes','databaseReserveBytes','assetReserveBytes','requiredBytes','futurePackageAllocationBytes'] if k in value}
print(json.dumps({'observedUtc':v['observedUtc'],'systemctl':v['systemctl'],'fileCount':len(v['fileMetadata']),'packageFilesVerified':len(v['packageHashes']),'selected':selected,'newOperatorCalls':0}))
