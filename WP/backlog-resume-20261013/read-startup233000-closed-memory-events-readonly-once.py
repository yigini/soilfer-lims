"""Read closed233000 originals and safe Docker metadata; no SQL, du, writes or replay."""
import base64,datetime,hashlib,json,os,pathlib,shutil,stat,subprocess,sys
root=pathlib.Path('/opt/lims/releases/workflow-batch-startup-memory-be837974-20261015T233000Z')
unit='lims-workflow-batch-startup-memory-be837974-20261015t233000z'
assert root.is_dir() and not root.is_symlink()
sys.path.insert(0,str(root))
from proof_contract import healthy_predecessor,PREDECESSOR_ID
from proof_files import file_state
from proof_docker import all_containers,inspect,preserved_containers,mount_objects
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp,MainPID'],timeout=15).decode()
props=dict(l.split('=',1) for l in state.splitlines() if '=' in l)
assert props.get('MainPID')=='0' and props['ActiveState'] in ['inactive','failed'],'Proof must actually be closed'
assert props.get('InvocationID','') in ['', '3eb684645431481ea98912210f972d99'],'Different invocation refused'
terminal_paths=[p for p in [root/'proof-receipt.json',root/'proof-terminal-refusal.json'] if p.is_file()]
assert len(terminal_paths)==1,'One original terminal receipt or refusal required'
terminal_path=terminal_paths[0];assert stat.S_IMODE(terminal_path.stat().st_mode)==0o400
original=json.loads(terminal_path.read_bytes());success=terminal_path.name=='proof-receipt.json'
if success:
 assert original['status']=='FORWARD_TWO_JOBS_OFF_STARTUPS_PASS_FROM_BOUND_INSTALLED209_NOT_RELEASE_QUALIFIED' and original['deployments']==0 and original['jobsOnQualificationStillRequired'] is True
 assert props.get('ExecMainStatus')=='0' and props.get('Result')=='success'
else:
 assert original['status']=='FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY'
absent=[n for n in ['proof-receipt.json','proof-terminal-refusal.json','startup-1-result.json','startup-2-result.json','budget-startup-1-closed.json','budget-startup-2-closed.json','startup-2-default-entrypoint-attempt.json'] if not (root/n).exists()]
package=json.loads((root/'proof-input.json').read_bytes())
assert all(file_state(root/n)['sha256']==h and stat.S_IMODE((root/n).stat().st_mode)==0o400 for n,h in package['packageHashes'].items())
paths=sorted(root.rglob('*'));assert len(paths)<=200000 and all(not p.is_symlink() for p in paths)
paths=[p for p in paths if p.is_file()]
inventory=[];artifacts=[];content_total=0
for p in paths:
    rel=p.relative_to(root).as_posix();row=file_state(p);assert row is not None
    inventory.append({'path':rel,**row})
    selected=not any(part.endswith('-assets') for part in pathlib.PurePosixPath(rel).parts) and not p.name.endswith(('.db','.db-wal','.db-shm'))
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
    if row['labels']['io.soilfer.release-owned'].split(':')[-1] in ['startup-1','startup-2']:
        label=row['labels']['io.soilfer.release-owned'].split(':')[-1]
        r=subprocess.run(['docker','logs',id],capture_output=True,timeout=30)
        assert len(r.stdout)<=32*1024**2 and len(r.stderr)<=32*1024**2
        for suffix,raw in [('stdout.log',r.stdout),('stderr.log',r.stderr)]:extra.append({'path':'fresh-closed-'+label+'-docker-logs-'+suffix,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'data':base64.b64encode(raw).decode()})
        extra.append({'path':'fresh-closed-'+label+'-docker-logs-exit.json','bytes':len(json.dumps({'exitCode':r.returncode}).encode()),'sha256':hashlib.sha256(json.dumps({'exitCode':r.returncode}).encode()).hexdigest(),'data':base64.b64encode(json.dumps({'exitCode':r.returncode}).encode()).decode()})
normal=healthy_predecessor(inspect(PREDECESSOR_ID))
journal=subprocess.check_output(['journalctl','--all','-u',unit,'--no-pager','-o','json'],timeout=15).decode();assert len(journal.encode())<=16*1024**2
assert any(json.loads(l).get('_SYSTEMD_INVOCATION_ID')=='3eb684645431481ea98912210f972d99' for l in journal.splitlines()),'Full same-invocation journal required'
# Hash/stat-only preservation of all bound old raw/reader/backup files and assets.
from proof_inputs import prior_records,retained_guard
from proof_contract import BUILD_ROOT,BUILD_RECEIPT_SHA,IMAGE,qualified
prior=prior_records(root);preserved_raw,preserved_assets=retained_guard(prior)
receipt_path=pathlib.Path(BUILD_ROOT)/'build-receipt.json'
receipt_raw=receipt_path.read_bytes();receipt_state=file_state(receipt_path)
assert receipt_state['sha256']==BUILD_RECEIPT_SHA and receipt_state['mode']==0o400
image_raw=subprocess.check_output(['docker','image','inspect',IMAGE],timeout=15)
image_rows=json.loads(image_raw);assert len(image_rows)==1
qualified(json.loads(receipt_raw),receipt_raw,image_rows[0])
assert image_rows==json.loads((root/'qualified-image-inspect-original.json').read_bytes())
for label,raw in [('qualified-original-build-receipt.json',receipt_raw),('qualified-fresh-whole-image-inspect.json',image_raw)]:
    extra.append({'path':label,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'data':base64.b64encode(raw).decode()})
hardware={}
for path in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
    p=pathlib.Path(path);assert p.resolve()==p and not p.is_symlink()
    v=os.statvfs(path);st=p.stat();assert v.f_frsize==4096
    hardware[path]={'canonicalPath':str(p.resolve()),'device':st.st_dev,'fragmentBytes':v.f_frsize,'freeAvailableBytes':v.f_bavail*v.f_frsize,'sameFilesystemValuesAreNotAdditive':True}
# A second full metadata pass verifies stopped-file stability without another copy or SQL.
for row in inventory:
    s=(root/row['path']).stat()
    assert (s.st_size,s.st_dev,s.st_ino,s.st_mtime_ns,stat.S_IMODE(s.st_mode))==(row['bytes'],row['device'],row['inode'],row['mtimeNs'],row['mode'])
assert [p.relative_to(root).as_posix() for p in sorted(root.rglob('*')) if p.is_file()]==[r['path'] for r in inventory]
selected={n:json.loads((root/n).read_bytes()) for n in ['carried-forward-inputs.json','derived-healthcheck.json','measured-copy-reserve.json','startup-1-readiness-refusal-health-state.json','startup-2-readiness-refusal-health-state.json','startup-1-result.json','startup-2-result.json','budget-startup-1-closed.json','budget-startup-2-closed.json'] if (root/n).is_file()}
print(json.dumps({'status':'CLOSED_STARTUP_MEMORY_EVENTS_ORIGINALS_RETAINED_NOT_INDEPENDENTLY_VALIDATED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state,'journalOriginal':journal,'originalTerminal':original,'originalTerminalName':terminal_path.name,'producerRecordedSuccess':success,'packageUnchanged':True,'packageFileCount':len(package['packageHashes']),'rootFileInventoryWithStableHashes':inventory,'rootFileCount':len(inventory),'rootPhysicalAllocatedBytes':sum(r['allocatedBytes'] for r in inventory),'artifacts':artifacts,'freshClosedDiagnosticArtifacts':extra,'selectedOriginalContentBytes':content_total,'allHistoricalContainerFullObjectsPreserved':True,'allHistoricalStoppedContainersPreserved':True,'containerInventoryBeforeSafeSelected':before,'containerInventoryAfterSafeSelected':after,'newOwnedContainersStoppedRetained':owned,'newOwnedContainerClosedStates':owned_states,'newOwnedRuntimeSafeSelected':owned_runtime,'normalPredecessorSelectedDerived':normal,'currentFreeBytes':{p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'selectedActualClosedJson':selected,'originalAbsentEvidence':absent,'productionSqliteConnections':0,'liveProductionContentOpensByRetainer':0,'proofReplays':0,'productionMutations':0,'installerAttemptsHaveOccurred':False,'defaultEntrypointAttempts':sum(1 for n in [1,2] if (root/('startup-'+str(n)+'-default-entrypoint-attempt.json')).exists()),'newPhysicalDuMeasurements':0,'terminalFullStoreAccountingOriginalObserved':(root/'allocation-terminal.json').is_file(),'rawEnvironmentStored':False,'freshFilesystemMetadataOnly':hardware,'qualifiedOriginalReceiptState':receipt_state,'qualifiedEntireImageUnchanged':True,'boundOldInputRawReaderBackupHashesStatsPreserved':True,'boundOldRawMasterTriple':preserved_raw,'boundOldAssetTree':preserved_assets,'healthPollCounts':{str(n):len(list(root.glob('startup-'+str(n)+'-health-poll-*.json'))) for n in [1,2]},'memorySampleCounts':{str(n):len([p for p in root.glob('startup-'+str(n)+'-memory-*.json') if __import__('re').fullmatch('startup-'+str(n)+'-memory-[0-9]{6}[.]json',p.name)]) for n in [1,2]},'proofInputState':file_state(root/'proof-input.json')}))
