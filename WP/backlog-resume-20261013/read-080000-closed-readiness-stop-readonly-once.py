"""Read closed080000 originals and safe Docker metadata; no SQL, du, writes or replay."""
import base64,datetime,hashlib,json,pathlib,shutil,stat,subprocess,sys
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z')
unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t080000z'
assert root.is_dir() and not root.is_symlink()
sys.path.insert(0,str(root))
from proof_contract import healthy_predecessor,PREDECESSOR_ID
from proof_files import file_state
from proof_docker import all_containers,inspect,preserved_containers,mount_objects
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp'],timeout=15).decode()
props=dict(l.split('=',1) for l in state.splitlines() if '=' in l)
assert props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['Result']=='exit-code' and props['InvocationID']=='0cb103307f4240689a630b3666545772'
original=json.loads((root/'proof-terminal-refusal.json').read_bytes())
assert original['closedUtc']=='2026-10-15T07:30:46.830553+00:00' and original['error']=='RuntimeError: 600-second readiness STOP' and original['ownedStopError'] is None
absent=['proof-receipt.json','startup-1-result.json','startup-2-result.json','budget-startup-1-closed.json','budget-startup-2-closed.json','startup-2-default-entrypoint-attempt.json']
assert not any((root/n).exists() for n in absent)
package=json.loads((root/'proof-input.json').read_bytes())
assert all(file_state(root/n)['sha256']==h and stat.S_IMODE((root/n).stat().st_mode)==0o400 for n,h in package['packageHashes'].items())
paths=sorted(root.rglob('*'));assert len(paths)<=200000 and all(not p.is_symlink() for p in paths)
paths=[p for p in paths if p.is_file()]
inventory=[];artifacts=[];content_total=0
for p in paths:
    rel=p.relative_to(root).as_posix();row=file_state(p);assert row is not None
    inventory.append({'path':rel,**row})
    selected=not any(part.endswith('-assets') for part in pathlib.PurePosixPath(rel).parts) and p.suffix in ['.json','.py','.log','.stdout','.stderr','.txt']
    if selected:
        assert row['bytes']<=64*1024**2
        raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256']
        content_total+=len(raw);assert content_total<=128*1024**2
        artifacts.append({'path':rel,'bytes':len(raw),'sha256':row['sha256'],'mode':row['mode'],'data':base64.b64encode(raw).decode()})
assert [p.relative_to(root).as_posix() for p in sorted(root.rglob('*')) if p.is_file()]==[r['path'] for r in inventory]
before=json.loads((root/'container-inventory-before.json').read_bytes());after=all_containers();preserved_containers(before,after)
assert all(all(before[id][k]==after[id][k] for k in ['name','image','labels','running','startedAt']) and mount_objects(before[id]['mounts'])==mount_objects(after[id]['mounts']) for id in before)
owned={id:v for id,v in after.items() if v['labels'].get('io.soilfer.release-owned','').startswith(str(root)+':')}
assert owned and set(after)-set(before)==set(owned) and all(v['running'] is False for v in owned.values())
owned_states={};owned_runtime={};extra=[]
for id,row in owned.items():
    v=inspect(id);owned_states[id]=v['State']
    env=dict(x.split('=',1) for x in v['Config'].get('Env',[]) if '=' in x)
    owned_runtime[id]={'name':v['Name'],'image':v['Image'],'restartCount':v['RestartCount'],'state':v['State'],'config':{k:v['Config'].get(k) for k in ['Image','Entrypoint','Cmd','Healthcheck']},'hostConfig':{k:v['HostConfig'].get(k) for k in ['Memory','MemorySwap','NetworkMode','RestartPolicy']},'selectedEnvironment':{k:env.get(k) for k in ['NODE_OPTIONS','ALLOW_PRISMA_DB_PUSH','ALLOW_AUTO_SEED','DISABLE_BACKGROUND_JOBS','DATABASE_PATH','DATABASE_URL','TMPDIR','TMP','TEMP']},'mounts':v['Mounts'],'fullRawEnvironmentStored':False}
    if row['labels']['io.soilfer.release-owned'].endswith(':startup-1'):
        r=subprocess.run(['docker','logs',id],capture_output=True,timeout=30)
        assert len(r.stdout)<=32*1024**2 and len(r.stderr)<=32*1024**2
        for suffix,raw in [('stdout.log',r.stdout),('stderr.log',r.stderr)]:extra.append({'path':'fresh-closed-startup-1-docker-logs-'+suffix,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'data':base64.b64encode(raw).decode()})
        extra.append({'path':'fresh-closed-startup-1-docker-logs-exit.json','bytes':len(json.dumps({'exitCode':r.returncode}).encode()),'sha256':hashlib.sha256(json.dumps({'exitCode':r.returncode}).encode()).hexdigest(),'data':base64.b64encode(json.dumps({'exitCode':r.returncode}).encode()).decode()})
normal=healthy_predecessor(inspect(PREDECESSOR_ID))
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json'],timeout=15).decode();assert len(journal.encode())<=16*1024**2
selected={n:json.loads((root/n).read_bytes()) for n in ['stage-214.json','stage-209.json','preservation-214.json','preservation-209.json','installation-result.json','accepted-206-repeat-evaluation-after-closure.json','carried-forward-inputs.json','budget-forward-input-closed.json','budget-issue-214-closed.json','budget-order-impact-closed.json','budget-issue-209-closed.json']}
print(json.dumps({'status':'CLOSED_FIRST_STARTUP_READINESS_STOP_ALL_RETAINED_NO_SQL_DU_OR_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state,'journalOriginal':journal,'originalRefusal':original,'packageUnchanged':True,'packageFileCount':len(package['packageHashes']),'rootFileInventoryWithStableHashes':inventory,'rootFileCount':len(inventory),'rootPhysicalAllocatedBytes':sum(r['allocatedBytes'] for r in inventory),'artifacts':artifacts,'freshClosedDiagnosticArtifacts':extra,'selectedOriginalContentBytes':content_total,'allHistoricalContainerFullObjectsPreserved':True,'allHistoricalStoppedContainersPreserved':True,'containerInventoryBeforeSafeSelected':before,'containerInventoryAfterSafeSelected':after,'newOwnedContainersStoppedRetained':owned,'newOwnedContainerClosedStates':owned_states,'newOwnedRuntimeSafeSelected':owned_runtime,'normalPredecessorSelectedDerived':normal,'currentFreeBytes':{p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'selectedActualClosedJson':selected,'originalAbsentEvidence':absent,'productionSqliteConnections':0,'liveProductionContentOpensByRetainer':0,'proofReplays':0,'productionMutations':0,'installerAttemptsHaveOccurred':True,'defaultEntrypointAttempts':1,'newPhysicalDuMeasurements':0,'terminalFullStoreAccountingNotPerformed':True,'rawEnvironmentStored':False}))
