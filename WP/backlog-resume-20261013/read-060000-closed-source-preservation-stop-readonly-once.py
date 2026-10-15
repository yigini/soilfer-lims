"""Read only CLOSED owned files and safe Docker metadata; no live file open or SQL."""
import base64,datetime,hashlib,json,pathlib,shutil,stat,subprocess,sys
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T060000Z')
unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t060000z'
sys.path.insert(0,str(root))
from proof_contract import healthy_predecessor,PREDECESSOR_ID
from proof_files import file_state,byte_identity
from proof_docker import all_containers,inspect,preserved_containers,mount_objects
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp'],timeout=15).decode()
props=dict(l.split('=',1) for l in state.splitlines() if '=' in l)
assert props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['Result']=='exit-code' and props['InvocationID']=='6ebd4f87542c4c67ab90059e4e000eae'
original=json.loads((root/'proof-terminal-refusal.json').read_bytes())
assert original['closedUtc']=='2026-10-15T04:16:51.486060+00:00' and original['error']=='RuntimeError: Original or raw master changed while reading owned copy' and original['ownedStopError'] is None
absent=['fresh-actual-baseline.json','budget-fresh-snapshot-closed.json','policy-canonical-noop-intent.json','installation-result.json','actual-chart-impact.json','actual-order-impact.json','proof-receipt.json','fresh-production-snapshot/seal.json','fresh-production-snapshot/logical-state.json']
assert not any((root/n).exists() for n in absent)
package=json.loads((root/'proof-input.json').read_bytes())
assert all(file_state(root/n)['sha256']==h and stat.S_IMODE((root/n).stat().st_mode)==0o400 for n,h in package['packageHashes'].items())
paths=sorted(p for p in root.rglob('*') if p.is_file());assert len(paths)==39
inventory=[];artifacts=[];content_total=0
for p in paths:
    rel=p.relative_to(root).as_posix();row=file_state(p);assert row is not None
    inventory.append({'path':rel,**row})
    selected=(p.parent==root or p.name in ['logical-state.json','seal.json','copy-authority.json']) and p.suffix in ['.json','.py','.log','.stdout','.stderr','.txt']
    if selected:
        assert row['mode']==0o400 and row['bytes']<=16*1024**2
        raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256']
        content_total+=len(raw);assert content_total<=64*1024**2
        artifacts.append({'path':rel,'bytes':len(raw),'sha256':row['sha256'],'mode':row['mode'],'data':base64.b64encode(raw).decode()})
assert [p.relative_to(root).as_posix() for p in sorted(root.rglob('*')) if p.is_file()]==[r['path'] for r in inventory]
rows={r['path']:r for r in inventory}
raw_states={s:{k:v for k,v in rows['fresh-production-snapshot/raw/dev.db'+s].items() if k!='path'} for s in ['', '-wal','-shm']}
authority=json.loads((root/'fresh-production-snapshot/raw/copy-authority.json').read_bytes())
reader_authority=json.loads((root/'fresh-production-snapshot/reader/copy-authority.json').read_bytes())
assert byte_identity(raw_states)==byte_identity(authority['originalFiles'])
assert raw_states==reader_authority['originalFiles']
before=json.loads((root/'container-inventory-before.json').read_bytes());after=all_containers();preserved_containers(before,after)
assert set(before)==set(after)
assert all(all(before[id][k]==after[id][k] for k in ['name','image','labels','running','startedAt']) and mount_objects(before[id]['mounts'])==mount_objects(after[id]['mounts']) for id in before)
owned=[id for id,v in after.items() if v['labels'].get('io.soilfer.release-owned','').startswith(str(root)+':')];assert not owned
normal=healthy_predecessor(inspect(PREDECESSOR_ID))
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json','-n','1000'],timeout=15).decode()
assert not any('oom-kill' in json.loads(l).get('MESSAGE','').lower() for l in journal.splitlines())
print(json.dumps({'status':'CLOSED_FRESH_SEAL_SOURCE_PRESERVATION_STOP_ALL_RETAINED_NO_SQL_OR_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state,'journalOriginal':journal,'originalRefusal':original,'freshSealCompleted':False,'actual060000BaselineCounts':None,'packageUnchanged':True,'rootFileInventoryWithStableHashes':inventory,'rootFileCount':len(inventory),'rootPhysicalAllocatedBytes':sum(r['allocatedBytes'] for r in inventory),'artifacts':artifacts,'allHistoricalContainerFullObjectsPreserved':True,'allHistoricalStoppedContainersPreserved':True,'newOwnedContainers':owned,'containerInventoryAfterSafeSelected':after,'normalPredecessorSelectedDerived':normal,'currentFreeBytes':{p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'retainedRawMasterBytesMatchOriginalCopyAuthority':True,'retainedRawMasterFullMetadataMatchesReaderCopyAuthority':True,'originalFailureAfterSourceSampleWasNotSealed':True,'whichLiveComponentChangedAtFailure':'UNKNOWN_AFTER_SAMPLE_NOT_RETAINED','originalAbsentEvidence':absent,'productionSqliteConnections':0,'liveProductionContentOpensByRetainer':0,'proofReplays':0,'productionMutations':0,'installerOrEntrypointAttempts':0,'newPhysicalDuMeasurements':0,'terminalFullStoreAccountingNotPerformed':True,'freshStagePhysicalClosureNotCompleted':True,'allRawTriplesAndAssetsRemainOnHost':True}))
