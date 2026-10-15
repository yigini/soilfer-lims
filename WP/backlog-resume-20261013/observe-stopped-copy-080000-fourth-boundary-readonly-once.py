"""Observe the SAME newly launched080000 unit; no proof, SQL or replay."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2];DEST=REPO/'WP/batch-proof-forward-resume-cde8-20261015/first-proof-080000-fourth-observation-once'
assert not DEST.exists(),'Consumed observer';DEST.mkdir()
script='''import datetime,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z');unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t080000z'
assert root.is_dir() and not root.is_symlink()
state=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp,ActiveEnterTimestamp,InactiveEnterTimestamp'],capture_output=True,text=True,timeout=15)
journal=subprocess.run(['journalctl','-u',unit,'--no-pager','-o','json','-n','1000'],capture_output=True,text=True,timeout=15)
files=[]
for p in sorted(root.rglob('*')):
 assert not p.is_symlink()
 if p.is_file():
  s=p.stat();files.append({'path':p.relative_to(root).as_posix(),'bytes':s.st_size,'mode':stat.S_IMODE(s.st_mode)})
 assert len(files)<=200000
selected={}
for n in ['proof-receipt.json','proof-terminal-refusal.json','carried-forward-inputs.json','accepted-206-repeat-evaluation-after-closure.json','measured-copy-reserve.json','budget-forward-input-closed.json','installation-result.json','actual-chart-impact.json','actual-order-impact.json','stage-214.json','stage-209.json']:
 p=root/n
 if p.is_file() and stat.S_IMODE(p.stat().st_mode)==0o400:
  raw=p.read_bytes();assert len(raw)<=67108864;selected[n]=json.loads(raw)
print(json.dumps({'status':'READONLY_SAME_FORWARD_PROOF_BOUNDARY_OBSERVATION_NOT_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'unit':unit,'root':str(root),'systemctlExitCode':state.returncode,'systemctlOriginal':state.stdout,'systemctlStderrOriginal':state.stderr,'journalExitCode':journal.returncode,'journalOriginal':journal.stdout,'journalStderrOriginal':journal.stderr,'fileInventory':files,'closedImmutableSelectedJson':selected,'sqliteConnections':0,'productionMutations':0,'proofReplays':0}))
'''
with (DEST/'observer-source.py').open('x',encoding='utf-8') as f:f.write(script)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.encode(),capture_output=True,timeout=50)
with (DEST/'stdout-original.json').open('xb') as f:f.write(r.stdout)
with (DEST/'stderr-original.log').open('xb') as f:f.write(r.stderr)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:f.write(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readonlyObserver':True,'proofReplays':0})+'\n')
assert r.returncode==0,'Inspect original observer failure; never replay'
value=json.loads(r.stdout);selected=value['closedImmutableSelectedJson']
print(json.dumps({'observedUtc':value['observedUtc'],'systemctl':value['systemctlOriginal'],'fileCount':len(value['fileInventory']),'selectedNames':list(selected),'terminalRefusal':selected.get('proof-terminal-refusal.json'),'receiptStatus':selected.get('proof-receipt.json',{}).get('status'),'journalTail':value['journalOriginal'][-3500:]}))
