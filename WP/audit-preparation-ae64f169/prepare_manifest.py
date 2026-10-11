"""Freeze only a complete, unchanged new-release proof; never executes it."""
import json, pathlib, shutil, sys
import release_support as s

SCRIPTS = ['build-candidate.py', 'release_support.py', 'rehearse.py',
    'release-forward.py', 'prepare_manifest.py', 'collect-gates.cjs',
    'export-git-source.cjs', 'export-kit.cjs', 'collect-production-gate.cjs',
    'postflight-roles.cjs', 'postflight-auth.cjs', 'postflight-reference.cjs',
    'postflight-qc-runs.cjs', 'postflight-policy.cjs', 'readonly-smoke.cjs',
    'test_release_guards.py']

def validate(proof, build, gates):
    assert proof['status']=='PASSED' and proof['productionExecution'] is False
    assert proof['head']==build['head']==gates['head']==s.HEAD
    assert build['status']=='BUILT_ONLY_NOT_DEPLOYED'
    assert proof['candidateImage']==build['image']
    assert gates['includedPrCount']==2 and gates['ungatedPrs']==[]
    assert {row['number'] for row in gates['prs']}=={288,290}
    assert all(row['gated'] and not row['laterAuditFailure'] for row in gates['prs'])
    main=[row for row in gates['mainCi'] if row['name']=='CI' and row['headSha']==s.HEAD]
    assert main and main[0]['status']=='completed' and main[0]['conclusion']=='success'
    assert proof['repeatTotalChanges']==proof['startupChanges']==proof['readOnlyProbeChanges']==0
    assert proof['repeatedInstallDatabaseBytesPreserved'] is True
    assert [(row['key'],row['script']) for row in proof['installers']]==s.INSTALLERS
    stage=proof['installers'][0]
    assert stage['dryRun']['classification']=='PRE_205' and stage['dryRun']['totalChanges']==0
    assert stage['dryRun']['sources']=={'migrationSha256':s.MIGRATION_SHA,'contractVersion':'205-v1'}
    assert stage['apply']['mode']=='APPLIED' and stage['apply']['totalChanges']==1
    assert stage['apply']['backfilledCount']==0 and stage['apply']['receipt']['originalRowsPreserved'] is True
    assert proof['repeatInstallers']==[{'key':'205','mode':'NO_OP','totalChanges':0}]
    assert [(row['key'],row['script']) for row in proof['legacyVerifiers']]==s.LEGACY_VERIFIERS
    for row in proof['legacyVerifiers']:
        s.validate_legacy(row['key'],row['dryRun'])
    assert [row['event'] for row in proof['startupReady']]==[name+'_STARTUP_READY' for name in s.READY_EVENTS]
    assert all(row.get('totalChanges',0)==0 for row in proof['startupReady'])
    assert proof['apiChecks']=={'passed':31,'total':31,'failed':0}
    expected=['postflight-roles.cjs','postflight-auth.cjs','postflight-reference.cjs',
        'postflight-qc-runs.cjs','postflight-policy.cjs','readonly-smoke.cjs']
    assert [row['file'] for row in proof['probes']]==expected and all(row['exitCode']==0 for row in proof['probes'])
    p=proof['preservation']
    assert p['originalRowsAndFieldsPreserved'] is True and p['additionalReceiptCount']==1
    assert p['newTables']==['PreparationRecord'] and p['changedSchemaObjects']==['table:WorkItemDraft']
    assert p['analyticalChanges']==p['acceptanceChanges']==p['foreignKeyViolations']==0 and p['integrity']=='ok'
    expected_labels={'legacy-'+key+'-dry-container.json' for key,_ in s.LEGACY_VERIFIERS}
    expected_labels|={'205-'+mode+'-container.json' for mode in ['dry','apply','repeat']}
    assert set(proof['cliMemory'])==expected_labels
    for row in proof['cliMemory'].values():
        assert row['memoryLimitBytes']==805306368 and row['nodeOptions'] is None and row['exitCode']==0
        assert 0<row['cgroupMemoryPeak']['releaseCliPeakBytes']<=805306368
        assert row['cgroupMemoryPeak']['childStatus']==0 and row['cgroupMemoryPeak']['childSignal'] is None
    for name in ['startupMemory','startupMemoryAtReady']:
        assert proof[name]['limitBytes']==805306368 and proof[name]['nodeOptions'] is None
        assert 0<proof[name]['peakBytes']<=805306368

def prepare(origin, destination, gates_file):
    root=pathlib.Path(__file__).resolve().parent
    assert origin.parent==destination.parent==root.parent==pathlib.Path('/opt/lims/releases')
    assert origin==root and origin.name.startswith('preparation-ae64f169-')
    assert destination.name.startswith('preparation-release-ae64f169-') and not destination.exists()
    proof=json.loads((origin/'rehearsal-receipt.json').read_text())
    build=json.loads((origin/'build-receipt.json').read_text())
    gates=json.loads(gates_file.read_text())
    validate(proof,build,gates)
    assert proof['buildReceiptSha256']==s.sha(origin/'build-receipt.json')
    assert build['sourceArchiveSha256']==s.sha(origin/'source.tar.gz')
    assert build['sourceIndexSha256']==s.sha(origin/'source-index.json')
    for name,digest in proof['scriptSha256'].items():
        assert name in SCRIPTS and s.sha(origin/name)==digest
    kit=json.loads((origin/'kit-source-index.json').read_text())
    assert kit['status']=='RAW_GIT_KIT_EXPORT'
    committed={row['name']:row['sha256'] for row in kit['files']}
    sources=SCRIPTS+['yy-authorization-evidence.md']
    assert all(s.sha(origin/name)==committed[name] for name in sources)
    files=sources+['kit-source-index.json','rehearsal-receipt.json','build-receipt.json',
        'source.tar.gz','source-index.json','build-origin.json']
    assert all((origin/name).is_file() and not (origin/name).is_symlink() for name in files)
    destination.mkdir(mode=0o700)
    for name in files:
        with (origin/name).open('rb') as src,(destination/name).open('xb') as dst: shutil.copyfileobj(src,dst)
        (destination/name).chmod(0o400)
    (destination/'pr-gates-prepared.json').write_bytes(gates_file.read_bytes())
    (destination/'pr-gates-prepared.json').chmod(0o400)
    files.append('pr-gates-prepared.json')
    manifest={'status':'PREPARED_ONLY_NOT_EXECUTED','preparedUtc':s.utc(),'head':s.HEAD,
        'lastDeployedSha':s.LAST_DEPLOY,'image':build['image'],'retainedImage':s.OLD_IMAGE,
        'kitSourceCommit':kit['head'],'rehearsalRoot':str(origin),'executionRoot':str(destination),
        'buildOrigin':json.loads((origin/'build-origin.json').read_text()),
        'includedPrCount':2,'installerOrder':['205'],'legacyVerificationOrder':[key for key,_ in s.LEGACY_VERIFIERS],
        'migrationSha256':s.MIGRATION_SHA,'diskReserveFloorBytes':8589934592,
        'unexplainedDropAbortBytes':500000000,'recovery':'FORWARD_ONLY_AFTER_ANY_INSTALLER_ATTEMPT',
        'deferred':['#274','#284'],'files':{name:s.sha(destination/name) for name in files}}
    with (destination/'prepared-manifest.json').open('x') as out: json.dump(manifest,out,indent=2)
    (destination/'prepared-manifest.json').chmod(0o400)
    return {'status':manifest['status'],'root':str(destination),'head':s.HEAD,'image':build['image'],
        'manifestSha256':s.sha(destination/'prepared-manifest.json'),
        'coordinatorSha256':manifest['files']['release-forward.py'],
        'rehearsalReceiptSha256':manifest['files']['rehearsal-receipt.json']}

if __name__=='__main__':
    assert len(sys.argv)==4
    print(json.dumps(prepare(*[pathlib.Path(value).resolve() for value in sys.argv[1:]])),flush=True)
