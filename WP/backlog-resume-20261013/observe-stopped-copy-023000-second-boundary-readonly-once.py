"""Observe only the already launched same unit/root. Never execute or retry the proof."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2];DEST=REPO/'WP/batch-proof-cde8-20261015/first-proof-023000-second-observation-once'
assert not DEST.exists();DEST.mkdir()
script='''import datetime,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T023000Z');unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t023000z'
assert root.is_dir() and not root.is_symlink()
state=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp,ActiveEnterTimestamp,InactiveEnterTimestamp'],capture_output=True,text=True,timeout=15)
journal=subprocess.run(['journalctl','-u',unit,'--no-pager','-o','json','-n','1000'],capture_output=True,text=True,timeout=15)
files=[]
for p in sorted(root.rglob('*')):
 assert not p.is_symlink()
 if p.is_file():
  s=p.stat();files.append({'path':p.relative_to(root).as_posix(),'bytes':s.st_size,'mode':stat.S_IMODE(s.st_mode)})
 assert len(files)<=10000
selected={}
for n in ['proof-receipt.json','proof-terminal-refusal.json','fresh-actual-baseline.json','measured-copy-reserve.json','installation-result.json','actual-chart-impact.json','actual-order-impact.json']:
 p=root/n
 if p.is_file() and stat.S_IMODE(p.stat().st_mode)==0o400:
  raw=p.read_bytes();assert len(raw)<=67108864;selected[n]=json.loads(raw)
print(json.dumps({'status':'READONLY_SAME_PROOF_BOUNDARY_OBSERVATION_NOT_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'unit':unit,'root':str(root),'systemctlExitCode':state.returncode,'systemctlOriginal':state.stdout,'systemctlStderrOriginal':state.stderr,'journalExitCode':journal.returncode,'journalOriginal':journal.stdout,'journalStderrOriginal':journal.stderr,'fileInventory':files,'closedImmutableSelectedJson':selected,'sqliteConnections':0,'productionMutations':0,'proofReplays':0}))
'''
(DEST/'observer-source.py').write_text(script,encoding='utf-8');r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.encode(),capture_output=True,timeout=50)
(DEST/'stdout-original.json').write_bytes(r.stdout);(DEST/'stderr-original.log').write_bytes(r.stderr)
(DEST/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readonlyObserver':True,'proofReplays':0})+'\n',encoding='utf-8')
assert r.returncode==0,'Read retained original observer failure, never replay'
value=json.loads(r.stdout);s=value['closedImmutableSelectedJson'];print(json.dumps({'observedUtc':value['observedUtc'],'systemctl':value['systemctlOriginal'],'fileCount':len(value['fileInventory']),'selected':s,'journalTail':value['journalOriginal'][-10000:]}))
