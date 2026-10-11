"""Fresh exact forward-kit authorization; the original gate is never used."""
import datetime, json, pathlib
import release_support as s
import startup_common as c

def verify(root,manifest,gate,now=None):
    now=now or datetime.datetime.now(datetime.timezone.utc)
    assert manifest['status']=='PREPARED_FORWARD_ONLY_NOT_EXECUTED'
    assert manifest['head']==gate['head']==s.HEAD and manifest['image']==gate['image']==c.IMAGE
    assert manifest['deadlineSeconds']==600 and manifest['separateInstallerCommands']==0
    assert manifest['jobsBoundaryCommentId']==c.JOBS_BOUNDARY_COMMENT
    assert manifest['originalFailureReceiptSha256']==c.FAILURE_SHA
    assert gate['manifestSha256']==s.sha(root/'prepared-manifest.json')
    assert gate['coordinatorSha256']==manifest['files']['startup-forward.py']
    assert gate['rehearsalReceiptSha256']==manifest['files']['rehearsal-receipt.json']
    assert gate['sharedReadinessSha256']==manifest['files']['startup_common.py']
    assert gate['currentMainHead']==s.HEAD
    fetched=datetime.datetime.fromisoformat(gate['verifiedUtc'].replace('Z','+00:00'))
    assert 0<=(now-fetched).total_seconds()<=600, 'Fresh forward gate is stale'
    evidence=gate['prGates'];assert evidence['head']==s.HEAD and evidence['ungatedPrs']==[]
    assert evidence['includedPrCount']==2 and {r['number'] for r in evidence['prs']}=={288,290}
    for row in evidence['prs']:
        assert row['gated'] and row['state']=='MERGED' and not row['laterAuditFailure']
        assert 'Audit passed: OK to merge and deploy' in row['auditPass']['body']
        assert row['head'] in row['auditPass']['body'] or row['head'][:7] in row['auditPass']['body']
        assert row['checks'] and all(x['conclusion']=='SUCCESS' for x in row['checks'])
    main=[r for r in evidence['mainCi'] if r['name']=='CI' and r['headSha']==s.HEAD]
    assert main and main[0]['status']=='completed' and main[0]['conclusion']=='success'
    review=gate['kitReview'];assert review['issue']==162 and review['reviewedBy']=='Claudio'
    assert review['id'] not in [6109804174,6102481848]
    assert review['url']=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(review['id'])
    tokens=['Audit passed: OK to merge and deploy',s.HEAD,c.IMAGE,c.FAILURE_SHA,
        gate['manifestSha256'],gate['coordinatorSha256'],gate['rehearsalReceiptSha256'],gate['sharedReadinessSha256'],
        manifest['files']['yy-authorization-evidence.md'],'labAndHubBuildsOwnedByYY=true','RELEASE_DAY_DISK_ABORTS_ACCEPTED']
    assert all(t in review['body'] for t in tokens), 'Exact forward-kit audit pins missing'
    reviewed=datetime.datetime.fromisoformat(review['timeUtc'].replace('Z','+00:00'));assert reviewed<=now
    yy=gate['yyGo'];assert yy['confirmedByYY'] is True and yy['authorizationMode']=='AUTO_AFTER_REVIEW'
    assert yy['scopeHead']==s.HEAD and yy['scopeDecision']=='PREPARATION_AND_RESULTS_288_290'
    assert yy['source']=='CLAUDE_LIMS_AUDIT_THREAD' and yy['text']=='Auto after review'
    assert yy['evidenceSha256']==yy['scopeEvidenceSha256']==manifest['files']['yy-authorization-evidence.md']
    assert gate['workloadControl']=={'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
    for name,expected in manifest['files'].items():
        file=root/name
        assert pathlib.Path(name).name==name and not file.is_symlink() and s.sha(file)==expected, 'Frozen byte mismatch '+name
    validate_proof(root,manifest)

def validate_proof(root,manifest):
    proof=json.loads((root/'rehearsal-receipt.json').read_bytes())
    assert proof['status']=='PASSED_FORWARD_STARTUP' and proof['head']==s.HEAD and proof['image']==c.IMAGE
    assert proof['protectedStateSha256']==manifest['files']['protected-state.json']
    assert proof['logicalStateSha256']==manifest['logicalStateSha256']
    assert proof['productionStoppedPhysical']==manifest['productionStoppedPhysical']
    assert proof['databaseChangesBeforeJobs']==0 and proof['ownedMainBytesPreservedBeforeJobs'] and proof['productionFilesUntouched']
    assert proof['jobsBoundaryCommentId']==c.JOBS_BOUNDARY_COMMENT
    boundary=proof['normalJobsBoundary']
    assert boundary['rowCountUnchanged'] and boundary['allOther103TablesAndKoboFieldsPreserved']
    assert boundary['allowedFields']==['KoboConfig.lastSyncAt','KoboConfig.updatedAt']
    assert proof['jobs-onChecks']['ownedJobsBoundary']['allOther103TablesAndKoboFieldsPreserved']
    assert proof['separateInstallerCommands']==0
    for stage in ['jobs-off','jobs-on']:
        readiness=proof[stage+'Readiness'];checks=proof[stage+'Checks']
        assert readiness['deadlineSeconds']==600 and 0<readiness['elapsedSeconds']<600
        assert readiness['sharedReadinessCode']==manifest['files']['startup_common.py']
        assert readiness['restartCount']==0 and readiness['oomKilled'] is False
        assert readiness['jobsEnabled']==(stage=='jobs-on')
        assert checks['startupChanges']==0 and len(checks['entrypointInstallers'])==22
        assert all(x['mode']=='NO_OP' and x['totalChanges']==0 for x in checks['entrypointInstallers'])
        s.ready_logs('\n'.join(json.dumps(x) for x in checks['startupReady']))
        assert 0<checks['startupMemory']['peakBytes']<=c.LIMIT and checks['startupMemory']['nodeOptions'] is None
    assert proof['apiChecks']=={'passed':31,'total':31,'failed':0} and len(proof['probes'])==6
    assert proof['readOnlyProbeChanges']==0
