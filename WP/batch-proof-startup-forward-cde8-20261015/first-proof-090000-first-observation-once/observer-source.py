import datetime,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-startup-forward-cde8c889-20261015T090000Z');unit='lims-workflow-batch-startup-forward-cde8c889-20261015t090000z';assert root.is_dir() and not root.is_symlink()
state=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp'],capture_output=True,text=True,timeout=15)
journal=subprocess.run(['journalctl','-u',unit,'--no-pager','-o','json','-n','1000'],capture_output=True,text=True,timeout=15)
files=[]
for p in sorted(root.rglob('*')):
 assert not p.is_symlink()
 if p.is_file():
  s=p.stat();files.append({'path':p.relative_to(root).as_posix(),'bytes':s.st_size,'mode':stat.S_IMODE(s.st_mode)})
 assert len(files)<=200000
selected={}
for n in ['proof-receipt.json','proof-terminal-refusal.json','carried-forward-inputs.json','derived-healthcheck.json','measured-copy-reserve.json','budget-startup-1-closed.json','budget-startup-2-closed.json','startup-1-result.json','startup-2-result.json','startup-1-readiness-refusal-health-state.json','startup-2-readiness-refusal-health-state.json']:
 p=root/n
 if p.is_file() and stat.S_IMODE(p.stat().st_mode)==0o400:
  b=p.read_bytes();assert len(b)<=67108864;selected[n]=json.loads(b)
print(json.dumps({'status':'READONLY_SAME_NEW_STARTUP_PROOF_OBSERVATION_NOT_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state.stdout,'systemctlStderrOriginal':state.stderr,'systemctlExitCode':state.returncode,'journalOriginal':journal.stdout,'journalStderrOriginal':journal.stderr,'journalExitCode':journal.returncode,'fileInventory':files,'closedImmutableSelectedJson':selected,'productionMutations':0,'sqlConnections':0,'proofReplays':0}))
