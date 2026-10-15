"""Bound closed070000 evidence; hash-only input validation, one RAW206 target copy."""
from proof_contract import *
from proof_files import file_state,triple,identity_record,tree_state,copy_triple,write_new,repeat_identity

def prior_records(root):
    records={}
    for name,pin in PRIOR_FILES.items():
        p=pathlib.Path(root)/name;raw=p.read_bytes()
        require(not p.is_symlink() and len(raw)==pin['bytes'] and sha(raw)==pin['sha256'],'Bound prior evidence bytes differ '+name)
        records[name]=exact_json(raw)
    validate_records(records)
    return records

def validate_records(v):
    require(set(v)==set(PRIOR_FILES),'Complete bound070000 evidence required')
    closed=v['prior-closed-retention.json'];seal=v['prior-installed-206--seal.json'];state=v['prior-installed-206--logical-state.json']
    require(closed['root']==str(PRIOR_ROOT) and closed['unit']=='lims-workflow-batch-stopped-copy-cde8c889-20261015t070000z' and closed['originalRefusal']==v['prior-proof-terminal-refusal.json'],'Prior closure identity differs')
    require(closed['originalRefusal']['closedUtc']=='2026-10-15T04:59:13.698388+00:00' and closed['originalRefusal']['error']=='RuntimeError: Repeat changed main or WAL SHA-256 or length' and closed['originalRefusal']['ownedStopError'] is None,'Only the accepted closed070000 failure')
    require(closed['packageUnchanged'] and closed['rawMasterByteIdentityMatchesHandoff'] and closed['rawAssetsByteIdentityMatchesHandoff'] and closed['allHistoricalStoppedContainersPreserved'] and len(closed['newOwnedContainersStoppedRetained'])==4 and all(not r['running'] for r in closed['newOwnedContainersStoppedRetained'].values()),'Prior preservation evidence differs')
    props=dict(l.split('=',1) for l in closed['systemctlOriginal'].splitlines() if '=' in l)
    require(props['ActiveState']=='failed' and props['InvocationID']=='f19dadea3497486395b80a1549207e12' and props['ExecMainStatus']=='1' and props['Result']=='exit-code' and props['MemoryMax']=='805306368' and props['MemorySwapMax']=='0','Prior executed identity/limits differ')
    spec=v['prior-proof-input.json'];review=v['prior-source-review-original.json'];source=v['prior-tooling-source-index.json']
    require(spec['root']==str(PRIOR_ROOT) and spec['toolingCommit']==source['head']=='68633fdd8322243a63b0135f3899963525af7fad' and spec['sourceReviewId']==review['id']==6184578280 and review['performed_via_github_app']['slug']=='claude' and first_line(review['body'])=='Source review: PASS','Prior exact source authority differs')
    require(spec['image']==IMAGE and spec['head']==CANDIDATE and spec['tree']==TREE and spec['labAndHubBuildsOwnedByYY'] is True and spec['releaseWindowControl']=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','Prior release authority/pins differ')
    baseline=v['prior-fresh-actual-baseline.json'];require(baseline==closed['actualBaseline'] and baseline['tableCount']==106 and baseline['schemaReceiptCount']==39 and baseline['databaseAssetsCrossFileAtomicityClaimed'] is False,'Bound baseline differs')
    require(baseline['databaseHandoffUtc']==v['prior-fresh-production-snapshot--raw--snapshot-handoff.json']['handoffUtc'] and baseline['assetHandoffUtc']==v['prior-assets-snapshot-handoff.json']['handoffUtc'],'Independent original handoff times differ')
    policy_gate(v['prior-policy-result.json']);plan(v['prior-dry-206-run.stdout'],'206','DRY_RUN');plan(v['prior-apply-206-run.stdout'],'206','APPLIED');plan(v['prior-repeat-206-run.stdout'],'206','NO_OP')
    require(v['prior-dry-206-byte-identity.json']['mainSha256AndLengthEqual'] and v['prior-dry-206-byte-identity.json']['walAbsentOrEmpty'],'Original206 dry identity missing')
    preserved=v['prior-preservation-206.json'];require(preserved==closed['preservation206'] and preserved['allOriginalRowsAndReceiptsPreserved'] and preserved['emptyEvidenceTables'] and preserved['newTables']==['ContainerSequence','SampleContainer'] and preserved['totalTables']==108 and preserved['schemaReceiptCount']==40 and preserved['backfilledCount']==0,'Prior206 additive preservation differs')
    require(seal==closed['installed206Seal'] and seal['rawMaster']==str(PRIOR_ROOT/'installed-206/raw/dev.db') and seal['backup']==str(PRIOR_ROOT/'installed-206/backup.db') and seal['rawMasterNeverOpenedSqlite'] and seal['countsIncludeWal'],'Prior raw input boundary differs')
    require(sha(canonical(state))==seal['logicalStateSha256'] and len(state['tables'])==108 and state['tables']['_schema_migrations']['count']==40 and state['integrity']=='ok' and state['foreignKeyViolations']==0,'Prior recorded logical state differs')
    original=seal['originalFiles'];require(original['']['sha256']=='9abe179ba9630143d000d4294139e51274cb474aac4a9fc11756503beca6958f' and original['']['bytes']==563322880 and original['-wal'] is None and original['-shm'] is None,'Raw206 input must be the exact installed byte state')
    rows={r['path']:r for r in closed['rootFileInventoryWithStableHashes']};require(len(rows)==closed['rootFileCount']==1765,'Complete prior file inventory differs')
    require(rows['installed-206/backup.db']['sha256']==seal['backupSha256'] and rows['installed-206/raw/dev.db']['sha256']==original['']['sha256'] and rows['installed-206/reader/dev.db']['sha256']==original['']['sha256'],'Recorded reader/raw/backup hashes differ')
    require(v['prior-installed-206--raw--copy-authority.json']['originalFiles']==original,'Raw copy authority differs')
    for name in ['dry','apply','repeat']:
        m=v['prior-'+name+'-206-measurement.json'];require(m['retainedStopped'] is True and m['measurement']['childStatus']==0 and m['measurement']['childSignal'] is None and 0<m['measurement']['releaseCliPeakBytes']<=MEMORY,'Prior206 CLI outcome/limit differs')
    return rows

def retained_guard(v):
    # Filesystem hash/stat only. No prior database is ever opened via SQLite here.
    rows=validate_records(v);paths=[]
    for directory,base in [('installed-206','backup.db'),('installed-206/reader','dev.db'),('installed-206/raw','dev.db'),('installation-target','dev.db')]:
        paths.extend(directory+'/'+base+s for s in ['', '-wal','-shm'])
    paths.extend(v['prior-proof-input.json']['packageHashes'])
    for rel in paths:
        expected=rows.get(rel);actual=file_state(pathlib.Path(PRIOR_ROOT)/rel)
        require(actual==(None if expected is None else {k:value for k,value in expected.items() if k!='path'}),'Retained prior file changed '+rel)
    raw=triple(pathlib.Path(PRIOR_RAW_DATA)/'dev.db')
    require(raw['']['mode']==0o400 and identity_record(raw)==identity_record(v['prior-installed-206--seal.json']['originalFiles']),'Raw206 input differs from installed seal')
    assets=tree_state(PRIOR_RAW_ASSETS);require(identity_record(assets['files'])==v['prior-assets-snapshot-handoff.json']['rawCopyByteIdentity'],'Retained asset bytes changed')
    return raw,assets

def prepare_resume(root,disk,v):
    raw,assets=retained_guard(v)
    after=triple(pathlib.Path(PRIOR_ROOT)/'installation-target/dev.db')
    before=v['prior-installed-206--seal.json']['originalFiles']
    evaluated=repeat_identity(before,after,v['prior-repeat-206-run.stdout'],'206',root,'accepted-206-repeat-after-closure')
    write_new(pathlib.Path(root)/'accepted-206-repeat-evaluation-after-closure.json',{'status':'PASS_CORRECTED_RULE_AFTER_CLOSURE_FROM_SEALED_RECORDS_AND_RETAINED_FILES','notOriginalControllerUnsealedTuples':True,'beforeAuthority':'BOUND_INSTALLED206_SEAL_ORIGINAL_FILES','afterAuthority':'HASH_ONLY_RETAINED_CLOSED_TARGET','priorEvidenceCommit':PRIOR_EVIDENCE,'no206InstallerReplay':True,'sqlConnections':0,'evaluation':evaluated})
    target,_=copy_triple(pathlib.Path(PRIOR_RAW_DATA)/'dev.db',pathlib.Path(root)/'installation-target',disk.check)
    for suffix,row in triple(target).items():
        if row is not None:pathlib.Path(str(target)+suffix).chmod(0o600)
    require(identity_record(triple(target))==identity_record(raw),'Owned forward target differs from installed206 raw byte state')
    retained_guard(v)
    write_new(pathlib.Path(root)/'carried-forward-inputs.json',{'priorEvidenceCommit':PRIOR_EVIDENCE,'priorRoot':str(PRIOR_ROOT),'sourceKind':'INSTALLED206_SEAL_RAW_TRIPLE_NOT_BACKUP','inputCopies':1,'newProductionSnapshots':0,'newPolicyOr206InstallerCalls':0,'inputSqlConnections':0,'logicalStateValidatedByRecordedReaderBackupHashes':True,'priorBaseline':v['prior-fresh-actual-baseline.json'],'prior206Preservation':v['prior-preservation-206.json'],'noCrossFileAtomicityClaimed':True})
    return target.parent,pathlib.Path(PRIOR_ROOT)/'installed-206/backup.db',v['prior-installed-206--logical-state.json']
