"""Read SAME100000 fourth-boundary status and sealed metadata, no SQL or replay."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2];D=REPO/'WP/batch-proof-health-transitions-cde8-20261015/first-proof-100000-fourth-observation-once';assert not D.exists();D.mkdir()
script='''import datetime,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-startup-forward-cde8c889-20261015T100000Z');unit='lims-workflow-batch-startup-forward-cde8c889-20261015t100000z';assert root.is_dir() and not root.is_symlink()
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
last_polls={}
for number in [1,2]:
 candidates=[p for p in sorted(root.glob('startup-'+str(number)+'-health-poll-*.json')) if stat.S_IMODE(p.stat().st_mode)==0o400]
 if candidates:
  p=candidates[-1];b=p.read_bytes();assert len(b)<=1048576;last_polls[str(number)]={'path':p.name,'sealedPollCount':len(candidates),'value':json.loads(b)}
print(json.dumps({'status':'READONLY_SAME_NEW_STARTUP_PROOF_OBSERVATION_NOT_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state.stdout,'systemctlStderrOriginal':state.stderr,'systemctlExitCode':state.returncode,'journalOriginal':journal.stdout,'journalStderrOriginal':journal.stderr,'journalExitCode':journal.returncode,'fileInventory':files,'closedImmutableSelectedJson':selected,'latestSealedHealthPolls':last_polls,'productionMutations':0,'sqlConnections':0,'proofReplays':0}))
'''
(D/'observer-source.py').write_text(script,encoding='utf-8');r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.encode(),capture_output=True,timeout=45)
for n,b in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr)]:
 with (D/n).open('xb') as f:f.write(b)
(D/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readonlyObserver':True,'neverReplay':True}),encoding='utf-8');assert r.returncode==0,'Inspect original failure, never replay'
v=json.loads(r.stdout);s=v['closedImmutableSelectedJson'];print(json.dumps({'observedUtc':v['observedUtc'],'systemctl':v['systemctlOriginal'],'fileCount':len(v['fileInventory']),'selectedNames':list(s),'terminalRefusal':s.get('proof-terminal-refusal.json'),'receiptStatus':s.get('proof-receipt.json',{}).get('status'),'startupResultsObserved':[n for n in s if n.endswith('-result.json')],'latestHealthSummary':{k:{'path':r['path'],'sealedPollCount':r['sealedPollCount'],'status':r['value'].get('status'),'elapsedSeconds':r['value'].get('elapsedSeconds'),'unhealthySecondsObservedSoFar':r['value'].get('unhealthySecondsObservedSoFar')} for k,r in v['latestSealedHealthPolls'].items()},'journalTail':v['journalOriginal'][-1800:]}))
