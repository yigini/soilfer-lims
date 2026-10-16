"""Ninth read-only observation of the same100000 mount-order jobs qualification proof; never redispatch."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-mount-order-forward-be837974-20261016';D=S/'ninth-mount-order-100000-readonly-observation-once'
assert not D.exists();D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
probe='''import datetime,hashlib,json,pathlib,stat,subprocess,re
root=pathlib.Path('/opt/lims/releases/workflow-batch-mount-order-forward-be837974-20261016T100000Z');unit='lims-workflow-batch-mount-order-forward-be837974-20261016t100000z'
assert root.is_dir() and root.resolve(strict=True)==root and not root.is_symlink(),'Existing exact root required'
props=['LoadState','ActiveState','SubState','ExecStopPost','TimeoutStopUSec','Result','ExecMainStatus','ExecMainCode','MainPID','InvocationID','MemoryMax','MemorySwapMax','MemoryCurrent','MemoryPeak','RuntimeMaxUSec','ExecMainStartTimestamp','ExecMainExitTimestamp','ActiveEnterTimestamp','InactiveEnterTimestamp']
state=subprocess.run(['systemctl','show',unit,'--property='+','.join(props)],capture_output=True,timeout=15)
assert len(state.stdout)+len(state.stderr)<2097152
props_read=dict(line.split('=',1) for line in state.stdout.decode().splitlines() if '=' in line)
assert state.returncode==0 and (props_read.get('ActiveState')!='active' or props_read.get('InvocationID')=='119b9c19c39e46d8bb482c144bd432ea'),'Same invocation required'
files=[];vanished=[]
for p in root.rglob('*'):
 assert len(files)<200000 and not p.is_symlink(),'Bounded nonalias root required'
 try:
  st=p.stat()
  if p.is_file():files.append({'path':p.relative_to(root).as_posix(),'bytes':st.st_size,'mode':oct(stat.S_IMODE(st.st_mode))})
 except FileNotFoundError:vanished.append(p.relative_to(root).as_posix())
selected={}
names=['stop-post-result.json','controller-memory-before.json','controller-memory-after.json','proof-intent.json','proof-receipt.json','proof-terminal-refusal.json','fresh-r4-before-proof-copies.json','measured-copy-reserve.json','predecessor-before-selected.json','startup-1-default-entrypoint-attempt.json','startup-2-default-entrypoint-attempt.json','startup-1-result.json','startup-2-result.json']
names += sorted(p.name for p in root.glob('controller-memory-*-raw-*.json'))
for n in names:
 p=root/n
 if p.is_file():
  raw=p.read_bytes();assert len(raw)<=16777216;selected[n]=raw.decode('utf-8','strict')
health_counts={};memory_counts={};memory_raws={};unsealed=[];sealed_stats={}
def sealed(p):
 before=p.stat();assert p.is_file() and not p.is_symlink() and stat.S_IMODE(before.st_mode)==0o400
 raw=p.read_bytes();after=p.stat();assert (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_mode)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_mode) and len(raw)<=16777216
 sealed_stats[p.name]={'device':after.st_dev,'inode':after.st_ino,'bytes':after.st_size,'mtimeNs':after.st_mtime_ns,'mode':oct(stat.S_IMODE(after.st_mode)),'beforeAfterStatEqual':True}
 return raw
for label in ['startup-1','startup-2']:
 polls=sorted(root.glob(label+'-health-poll-*.json'));polls=[p for p in polls if stat.S_IMODE(p.stat().st_mode)==0o400];health_counts[label]=len(polls)
 for p in polls[-2:]:selected[p.name]=sealed(p).decode('utf-8','strict')
 samples=sorted(p for p in root.glob(label+'-memory-*.json') if re.fullmatch(label+'-memory-[0-9]{6}[.]json',p.name) and stat.S_IMODE(p.stat().st_mode)==0o400);memory_counts[label]=len(samples)
 for p in samples[-2:]:
  raw=sealed(p);selected[p.name]=raw.decode('utf-8','strict');sample=json.loads(raw)
  for row in sample['originalKernelReads']:
   name=row['path'];assert pathlib.PurePosixPath(name).name==name and name.startswith(p.stem+'-raw-')
   data=sealed(root/name);assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
   memory_raws[name]={'bytes':len(data),'sha256':row['sha256'],'kernelPath':row['kernelPath'],'originalRetainedUtf8':data.decode('ascii','strict'),'mode':'0o400'}
 for pattern in [label+'-memory-*-guard-refusal.json',label+'-memory-*-read-refusal.json']:
  for p in sorted(root.glob(pattern)):selected[p.name]=sealed(p).decode('utf-8','strict')
spec=json.loads((root/'proof-input.json').read_bytes());expected=dict(spec['packageHashes']);expected['proof-input.json']=hashlib.sha256((root/'proof-input.json').read_bytes()).hexdigest()
package={}
for n,digest in expected.items():
 p=root/n;raw=p.read_bytes();s=p.stat();actual=hashlib.sha256(raw).hexdigest();assert actual==digest and stat.S_IMODE(s.st_mode)==0o400,n
 package[n]={'bytes':len(raw),'sha256':actual,'mode':oct(stat.S_IMODE(s.st_mode))}
journal=subprocess.run(['journalctl','--all','-u',unit,'--no-pager','--output=json'],capture_output=True,timeout=15)
assert len(journal.stdout)+len(journal.stderr)<=16777216
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctl':{'exitCode':state.returncode,'stdout':state.stdout.decode(),'stderr':state.stderr.decode()},'fileMetadata':files,'vanishedDuringActiveObservation':vanished,'packageHashes':package,'healthPollCounts':health_counts,'memorySampleCounts':memory_counts,'retainedMemoryOriginals':memory_raws,'sealedOriginalStats':sealed_stats,'selectedOriginalUtf8':selected,'journal':{'exitCode':journal.returncode,'stdout':journal.stdout.decode(),'stderr':journal.stderr.decode()},'mode':'READONLY_SAME_ROOT_UNIT_NO_OPERATOR_NO_REPLAY'}))
'''
compile(probe,'readonly-jobs-proof-observer.py','exec');save('readonly-observer-source.py',probe.encode())
args=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-']
save('command-original.json',(json.dumps({'argv':args,'operatorsExecuted':0,'neverReplay':True})+'\n').encode())
r=subprocess.run(args,cwd=R,input=probe.encode(),capture_output=True,timeout=60)
save('stdout-original.json',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'operatorsExecuted':0},indent=2)+'\n').encode())
assert r.returncode==0,'Read-only observation failed; never repeat helper'
v=json.loads(r.stdout);selected={}
for n,raw in v['selectedOriginalUtf8'].items():
 value=json.loads(raw);selected[n]={k:value[k] for k in ['status','error','startedUtc','closedUtc','id','elapsedSeconds','memoryPeakBytes','databaseReserveBytes','assetReserveBytes','requiredBytes','futurePackageAllocationBytes'] if k in value}
print(json.dumps({'observedUtc':v['observedUtc'],'systemctl':v['systemctl'],'fileCount':len(v['fileMetadata']),'packageFilesVerified':len(v['packageHashes']),'selected':selected,'healthPollCounts':v['healthPollCounts'],'memorySampleCounts':v['memorySampleCounts'],'retainedMemoryRawCount':len(v['retainedMemoryOriginals']),'newOperatorCalls':0}))

