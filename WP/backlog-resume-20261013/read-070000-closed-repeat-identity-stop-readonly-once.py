"""Read only closed owned evidence, hashes and safe container metadata; never SQL/replay."""
import base64,datetime,hashlib,json,pathlib,shutil,stat,subprocess,sys
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z')
unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t070000z'
assert root.is_dir() and not root.is_symlink()
sys.path.insert(0,str(root))
from proof_contract import healthy_predecessor,PREDECESSOR_ID
from proof_files import file_state,identity_record
from proof_docker import all_containers,inspect,preserved_containers,mount_objects
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp'],timeout=15).decode()
props=dict(l.split('=',1) for l in state.splitlines() if '=' in l)
assert props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['Result']=='exit-code' and props['InvocationID']=='f19dadea3497486395b80a1549207e12'
original=json.loads((root/'proof-terminal-refusal.json').read_bytes())
assert original['closedUtc']=='2026-10-15T04:59:13.698388+00:00' and original['error']=='RuntimeError: Repeat changed main or WAL SHA-256 or length' and original['ownedStopError'] is None
absent=['stage-206.json','repeat-206-byte-identity.json','budget-issue-206-closed.json','actual-chart-impact.json','actual-order-impact.json','installation-result.json','proof-receipt.json','startup-1-default-entrypoint-attempt.json','startup-2-default-entrypoint-attempt.json']
assert not any((root/n).exists() for n in absent)
package=json.loads((root/'proof-input.json').read_bytes())
assert all(file_state(root/n)['sha256']==h and stat.S_IMODE((root/n).stat().st_mode)==0o400 for n,h in package['packageHashes'].items())
paths=sorted(root.rglob('*'));assert len(paths)<=200000 and all(not p.is_symlink() for p in paths)
paths=[p for p in paths if p.is_file()];assert len(paths)==1765
inventory=[];artifacts=[];content_total=0
for p in paths:
    rel=p.relative_to(root).as_posix();row=file_state(p);assert row is not None
    inventory.append({'path':rel,**row})
    selected=not rel.startswith('raw-production-assets/') and p.suffix in ['.json','.py','.log','.stdout','.stderr','.txt']
    if selected:
        assert row['bytes']<=16*1024**2
        raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256']
        content_total+=len(raw);assert content_total<=64*1024**2
        artifacts.append({'path':rel,'bytes':len(raw),'sha256':row['sha256'],'mode':row['mode'],'data':base64.b64encode(raw).decode()})
assert [p.relative_to(root).as_posix() for p in sorted(root.rglob('*')) if p.is_file()]==[r['path'] for r in inventory]
rows={r['path']:r for r in inventory}
raw_states={s:{k:v for k,v in rows['fresh-production-snapshot/raw/dev.db'+s].items() if k!='path'} for s in ['', '-wal','-shm']}
handoff=json.loads((root/'fresh-production-snapshot/raw/snapshot-handoff.json').read_bytes())
assert identity_record(raw_states)==handoff['rawCopyByteIdentity']
asset_handoff=json.loads((root/'assets-snapshot-handoff.json').read_bytes())
assets={n.removeprefix('raw-production-assets/'):{k:v for k,v in row.items() if k!='path'} for n,row in rows.items() if n.startswith('raw-production-assets/')}
assert identity_record(assets)==asset_handoff['rawCopyByteIdentity']
before=json.loads((root/'container-inventory-before.json').read_bytes());after=all_containers();preserved_containers(before,after)
assert all(all(before[id][k]==after[id][k] for k in ['name','image','labels','running','startedAt']) and mount_objects(before[id]['mounts'])==mount_objects(after[id]['mounts']) for id in before)
owned={id:v for id,v in after.items() if v['labels'].get('io.soilfer.release-owned','').startswith(str(root)+':')}
assert len(owned)==4 and set(after)-set(before)==set(owned) and all(v['running'] is False for v in owned.values())
owned_states={id:inspect(id)['State'] for id in owned};assert all(v['ExitCode']==0 and not v['OOMKilled'] for v in owned_states.values())
normal=healthy_predecessor(inspect(PREDECESSOR_ID))
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json'],timeout=15).decode();assert len(journal.encode())<=16*1024**2
assert not any('oom-kill' in json.loads(l).get('MESSAGE','').lower() for l in journal.splitlines())
baseline=json.loads((root/'fresh-actual-baseline.json').read_bytes());assert baseline['tableCount']==106 and baseline['schemaReceiptCount']==39
installed=json.loads((root/'installed-206/seal.json').read_bytes())
preservation=json.loads((root/'preservation-206.json').read_bytes())
repeat=json.loads((root/'repeat-206-run.stdout').read_bytes());assert repeat['mode']=='NO_OP' and type(repeat['totalChanges']) is int and repeat['totalChanges']==0
target={s:None if 'installation-target/dev.db'+s not in rows else {k:v for k,v in rows['installation-target/dev.db'+s].items() if k!='path'} for s in ['', '-wal','-shm']}
print(json.dumps({'status':'CLOSED_206_REPEAT_BYTE_IDENTITY_STOP_ALL_RETAINED_NO_SQL_OR_REPLAY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state,'journalOriginal':journal,'originalRefusal':original,'packageUnchanged':True,'rootFileInventoryWithStableHashes':inventory,'rootFileCount':len(inventory),'rootPhysicalAllocatedBytes':sum(r['allocatedBytes'] for r in inventory),'artifacts':artifacts,'selectedOriginalContentBytes':content_total,'allHistoricalContainerFullObjectsPreserved':True,'allHistoricalStoppedContainersPreserved':True,'containerInventoryAfterSafeSelected':after,'newOwnedContainersStoppedRetained':owned,'newOwnedContainerClosedStates':owned_states,'normalPredecessorSelectedDerived':normal,'currentFreeBytes':{p:shutil.disk_usage(p).free for p in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'rawMasterByteIdentityMatchesHandoff':True,'rawAssetsByteIdentityMatchesHandoff':True,'actualBaseline':baseline,'installed206Seal':installed,'preservation206':preservation,'actualRepeat206Result':repeat,'currentClosedTargetTripleNotOriginalComparisonSample':target,'controllerRepeatBeforeAndAfterSamplesWereNotSealed':True,'originalAbsentEvidence':absent,'actual214209ScientificLists':None,'productionSqliteConnections':0,'liveProductionContentOpensByRetainer':0,'proofReplays':0,'productionMutations':0,'installerAttemptsHaveOccurred':True,'defaultEntrypointAttempts':0,'newPhysicalDuMeasurements':0,'terminalFullStoreAccountingNotPerformed':True}))
