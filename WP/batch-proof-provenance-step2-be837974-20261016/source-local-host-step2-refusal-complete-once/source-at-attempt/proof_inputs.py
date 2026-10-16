"""Pinned080000 installed209 inputs. Only hashes/stat/recorded state, never old SQL."""
from proof_contract import *
from proof_files import file_state,triple,tree_state,identity_record,write_new

def prior_records(root):
    values={}
    for name,pin in PRIOR_FILES.items():
        p=pathlib.Path(root)/name;raw=p.read_bytes();require(not p.is_symlink() and len(raw)==pin['bytes'] and sha(raw)==pin['sha256'],'Bound080000 input bytes differ '+name);values[name]=exact_json(raw)
    validate_records(values);return values

def validate_records(v):
    require(set(v)==set(PRIOR_FILES),'Complete bound080000 evidence required')
    closed=v['prior-closed-retention.json'];refusal=v['prior-proof-terminal-refusal.json'];seal=v['prior-installed-209--seal.json'];state=v['prior-installed-209--logical-state.json']
    require(closed['root']==str(PRIOR_ROOT) and closed['originalRefusal']==refusal and refusal['closedUtc']=='2026-10-15T07:30:46.830553+00:00' and refusal['error']=='RuntimeError: 600-second readiness STOP' and refusal['ownedStopError'] is None,'Exact consumed080000 failure required')
    require(closed['packageUnchanged'] and closed['allHistoricalStoppedContainersPreserved'] and len(closed['newOwnedContainersStoppedRetained'])==9 and all(r['running'] is False for r in closed['newOwnedContainersStoppedRetained'].values()),'Bound retained containers/package differ')
    policy_gate(v['prior-policy-result.json'])
    spec=v['prior-proof-input.json'];source=v['prior-tooling-source-index.json'];review=v['prior-source-review-original.json']
    require(spec['root']==str(PRIOR_ROOT) and spec['toolingCommit']==source['head']=='b9af37993632ca10b56943ae894fc0a816b8efcc' and spec['sourceReviewId']==review['id']==6185240820 and first_line(review['body'])=='Source review: PASS' and review['performed_via_github_app']['slug']=='claude','Prior exact authority differs')
    require(spec['head']==OLD_INPUT_CANDIDATE and spec['tree']==OLD_INPUT_TREE and spec['image']==OLD_INPUT_IMAGE and spec['labAndHubBuildsOwnedByYY'] is True and spec['releaseWindowControl']=='RELEASE_DAY_DISK_ABORTS_ACCEPTED','Bound app/image/YY pins differ')
    props=dict(l.split('=',1) for l in closed['systemctlOriginal'].splitlines() if '=' in l);require(props['InvocationID']=='0cb103307f4240689a630b3666545772' and props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['MemoryMax']==str(MEMORY) and props['MemorySwapMax']=='0','Prior executed identity/limits differ')
    for issue,receipts in [('214',41),('209',42)]:
        stage=v['prior-stage-'+issue+'.json'];preserved=v['prior-preservation-'+issue+'.json']
        for mode,key in [('DRY_RUN','dry'),('APPLIED','apply'),('NO_OP','repeat')]:plan(stage[key],issue,mode)
        require(stage['dryByteIdentity']['mainSha256AndLengthEqual'] and stage['repeatByteIdentity']['mainSha256AndLengthEqual'] and stage['repeatByteIdentity']['walAbsentEmptyEquivalentOrNonemptyExact'],'Prior identity guard missing')
        require(preserved==stage['preservation'] and preserved['allOriginalRowsAndReceiptsPreserved'] and preserved['priorStateFromBoundRecordNoSql'] and preserved['totalTables']==112 and preserved['schemaReceiptCount']==receipts and preserved['backfilledCount']==0,'Accepted installation preservation differs')
    require(v['prior-installation-result.json']['status']=='OWNED_COPY_INSTALLATION_PASS' and v['prior-installation-result.json']['productionMutations']==0,'Bound installation result differs')
    impact_gate(v['prior-actual-order-impact.json'])
    require(seal['rawMaster']==str(PRIOR_ROOT/'installed-209/raw/dev.db') and seal['backup']==PRIOR_BACKUP and seal['rawMasterNeverOpenedSqlite'] and seal['countsIncludeWal'],'Installed209 input boundary differs')
    require(sha(canonical(state))==seal['logicalStateSha256'] and len(state['tables'])==112 and state['tables']['_schema_migrations']['count']==42 and state['integrity']=='ok' and state['foreignKeyViolations']==0,'Recorded11242 logical state differs')
    rows={r['path']:r for r in closed['rootFileInventoryWithStableHashes']};require(len(rows)==closed['rootFileCount']==4517,'Full closed input inventory required')
    require(rows['installed-209/backup.db']['sha256']==seal['backupSha256'] and rows['installed-209/raw/dev.db']['sha256']==seal['originalFiles']['']['sha256'] and rows['installed-209/reader/dev.db']['sha256']==seal['originalFiles']['']['sha256'],'Raw/reader/backup record identity differs')
    require(identity_record(v['prior-installed-209--raw--copy-authority.json']['originalFiles'])==identity_record(seal['originalFiles']),'Raw copy authority differs')
    require(v['prior-fresh-actual-baseline.json']['databaseAssetsCrossFileAtomicityClaimed'] is False,'No cross-file atomicity claim allowed')
    return rows

def retained_guard(v):
    rows=validate_records(v);paths=[]
    for directory,base in [('installed-209','backup.db'),('installed-209/raw','dev.db'),('installed-209/reader','dev.db')]:paths.extend(directory+'/'+base+s for s in ['', '-wal','-shm'])
    paths.extend(v['prior-proof-input.json']['packageHashes'])
    for rel in paths:
        expected=rows.get(rel);actual=file_state(pathlib.Path(PRIOR_ROOT)/rel);require(actual==(None if expected is None else {k:value for k,value in expected.items() if k!='path'}),'Retained prior input changed '+rel)
    raw=triple(pathlib.Path(PRIOR_RAW_DATA)/'dev.db');require(raw['']['mode']==0o400 and identity_record(raw)==identity_record(v['prior-installed-209--seal.json']['originalFiles']),'Sealed209 raw identity differs')
    assets=tree_state(PRIOR_RAW_ASSETS);require(identity_record(assets['files'])==v['prior-assets-snapshot-handoff.json']['rawCopyByteIdentity'],'Retained070000 asset handoff differs')
    require(set(assets['directories'])==set(v['prior-assets-snapshot-handoff.json']['beforeLiveTree']['directories']) and len(assets['directories'])==7,'Pinned asset directory copy maximum changed')
    return raw,assets

def record_inputs(root,v):
    retained_guard(v);write_new(pathlib.Path(root)/'carried-forward-inputs.json',{'status':'BOUND_INSTALLED209_STARTUP_ONLY_INPUTS_NO_SQL','priorEvidenceCommit':PRIOR_EVIDENCE,'priorRoot':str(PRIOR_ROOT),'inputCopies':0,'newProductionSnapshots':0,'installerOrPolicyCalls':0,'inputSqlConnections':0,'stateValidatedByRecordedHashes':True,'installed209Seal':v['prior-installed-209--seal.json'],'accepted214Preservation':v['prior-preservation-214.json'],'accepted209Preservation':v['prior-preservation-209.json'],'actualChartCounts':v['prior-actual-chart-impact.json']['counts'],'actualOrderImpact':v['prior-actual-order-impact.json'],'jobsOnQualificationStillRequired':True})
    return pathlib.Path(PRIOR_BACKUP),v['prior-installed-209--logical-state.json']
