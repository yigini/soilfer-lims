"""Freeze a passed rehearsal into a fresh, non-executing production kit."""
import json, pathlib, shutil, subprocess, sys
import release_support as s

SCRIPTS = ['release-forward.py', 'release_support.py', 'rehearse.py',
    'build-candidate.py', 'prepare-owned.py', 'collect-gates.cjs',
    'export-git-source.cjs', 'summarize-proof.py', 'prepare_manifest.py',
    'collect-production-gate.cjs',
    'test_release_guards.py', 'postflight-roles.cjs', 'postflight-auth.cjs',
    'postflight-reference.cjs', 'postflight-qc-runs.cjs',
    'postflight-policy.cjs', 'readonly-smoke.cjs']

def validate(proof, build, gates):
    assert proof['status'] == 'PASSED' and proof['productionExecution'] is False
    assert proof['head'] == build['head'] == gates['head'] == s.HEAD
    assert proof['candidateImage'] == build['image']
    assert build['status'] == 'BUILT_ONLY_NOT_DEPLOYED' and build['productionDatabaseMounts'] == 0
    assert proof['repeatTotalChanges'] == proof['startupChanges'] == proof['readOnlyProbeChanges'] == 0
    assert proof['repeatedInstallDatabaseBytesPreserved'] is True
    assert [(row['key'], row['script']) for row in proof['installers']] == s.INSTALLERS
    repeat = next(row for row in proof['installers'] if row['key'] == '191')
    s.verify_repeat_inventory(repeat['dryRun'])
    s.verify_repeat_inventory(repeat['apply'])
    acceptance = next(row for row in proof['installers'] if row['key'] == s.ACCEPTANCE_KEY)
    s.verify_acceptance_stage(acceptance)
    assert proof['acceptancePlanSha256'] == acceptance['dryRun']['planSha256']
    assert [row['key'] for row in proof['repeatInstallers']] == [key for key, _ in s.INSTALLERS if key != s.ACCEPTANCE_KEY]
    assert all(row['mode'] == 'NO_OP' and row['totalChanges'] == 0 for row in proof['repeatInstallers'])
    assert [row['event'] for row in proof['startupReady']] == [name + '_STARTUP_READY' for name in s.READY_EVENTS]
    assert all(row.get('totalChanges', 0) == 0 for row in proof['startupReady'])
    assert proof['apiChecks'] == {'passed':31, 'total':31, 'failed':0}
    expected_probes = [name for name in SCRIPTS if name.startswith('postflight-')] + ['readonly-smoke.cjs']
    assert [row['file'] for row in proof['probes']] == expected_probes
    assert all(row['exitCode'] == 0 for row in proof['probes'])
    assert proof['health']['status'] == 'ok' and proof['benchCredentialCount'] == 0
    preservation = proof['preservation']
    assert preservation['originalRowsAndFieldsPreserved'] is True
    assert preservation['integrity'] == 'ok' and preservation['foreignKeyViolations'] == 0
    assert preservation['createdAttempts'] == 17 and preservation['approvedNullResultLinks'] == 19
    assert preservation['approvedAttemptStatusChanges'] == preservation['approvedAcceptanceAuditEvents'] == 1
    assert preservation['originalTableCount'] == 90 and preservation['originalReceiptsPreserved'] == 18
    s.verify_attempt_plan(proof['attemptDryRun'], proof['attemptPlanSha256'])
    assert len(proof['cliMemory']) == 3 * len(s.INSTALLERS)
    for key, _ in s.INSTALLERS:
        for mode in ['dry', 'apply', 'repeat']:
            row = proof['cliMemory'][key + '-' + mode + '-container.json']
            assert row['memoryLimitBytes'] == 805306368 and row['nodeOptions'] is None
            assert row['exitCode'] == row['cgroupMemoryPeak']['childStatus'] == 0
            assert row['cgroupMemoryPeak']['childSignal'] is None
            assert 0 < row['cgroupMemoryPeak']['releaseCliPeakBytes'] <= 805306368
    for name in ['startupMemoryAtReady', 'startupMemory']:
        row = proof[name]
        assert row['limitBytes'] == 805306368 and row['nodeOptions'] is None
        assert 0 < row['peakBytes'] <= 805306368
    assert gates['includedPrCount'] == len(s.INCLUDED_PRS) and gates['ungatedPrs'] == []
    assert len(gates['prs']) == len(s.INCLUDED_PRS) and all(row['gated'] for row in gates['prs'])
    assert {row['number'] for row in gates['prs']} == set(s.INCLUDED_PRS)
    main = [row for row in gates['mainCi'] if row['name'] == 'CI' and row['headSha'] == s.HEAD]
    assert main and main[0]['status'] == 'completed' and main[0]['conclusion'] == 'success'

def prepare(origin, destination, gates_file):
    assert origin.parent == destination.parent == pathlib.Path('/opt/lims/releases')
    assert origin.name.startswith('combined-eb6de2e8-')
    assert destination.name.startswith('combined-release-eb6de2e8-')
    assert not origin.is_symlink() and not destination.exists()
    proof = json.loads((origin / 'rehearsal-receipt.json').read_text())
    build = json.loads((origin / 'build-receipt.json').read_text())
    gates = json.loads(gates_file.read_text())
    validate(proof, build, gates)
    assert proof['buildReceiptSha256'] == s.sha(origin / 'build-receipt.json')
    assert proof['yy191ReviewChoiceSha256'] == s.sha(origin / 'yy-191-review-choice-evidence.md')
    assert build['sourceArchiveSha256'] == s.sha(origin / 'source.tar.gz')
    assert build['sourceIndexSha256'] == s.sha(origin / 'source-index.json')
    for name, digest in proof['scriptSha256'].items():
        assert name in SCRIPTS and s.sha(origin / name) == digest, 'Rehearsed script changed: ' + name
    files = SCRIPTS + ['rehearsal-receipt.json', 'build-receipt.json',
        'source.tar.gz', 'source-index.json', 'yy-authorization-evidence.md',
        'yy-191-review-choice-evidence.md', 'kit-source-index.json']
    assert all((origin / name).is_file() and not (origin / name).is_symlink() for name in files)
    kit = json.loads((origin / 'kit-source-index.json').read_text())
    assert kit['status'] == 'RAW_GIT_KIT_EXPORT'
    committed = {row['name']: row['sha256'] for row in kit['files']}
    for name in SCRIPTS + ['yy-authorization-evidence.md','yy-191-review-choice-evidence.md']:
        assert s.sha(origin / name) == committed[name], 'Kit source differs from Git: ' + name
    summary = subprocess.check_output([sys.executable, str(origin / 'summarize-proof.py'), str(origin)], text=True)
    destination.mkdir(mode=0o700)
    for name in files:
        with (origin / name).open('rb') as source, (destination / name).open('xb') as target:
            shutil.copyfileobj(source, target)
        (destination / name).chmod(0o400)
    for name, data in [('pr-gates-prepared.json', gates_file.read_bytes()),
                       ('rehearsal-summary.json', summary.encode())]:
        with (destination / name).open('xb') as output:
            output.write(data)
        (destination / name).chmod(0o400)
        files.append(name)
    manifest = {'status':'PREPARED_ONLY_NOT_EXECUTED', 'preparedUtc':s.utc(),
        'head':s.HEAD, 'kitSourceCommit':kit['head'], 'lastDeployedSha':s.LAST_DEPLOY, 'image':build['image'],
        'retainedImage':s.OLD_IMAGE, 'rehearsalRoot':str(origin), 'executionRoot':str(destination),
        'attemptPlanSha256':proof['attemptPlanSha256'], 'includedPrCount':len(s.INCLUDED_PRS),
        'acceptancePlanSha256':proof['acceptancePlanSha256'], 'acceptanceTuple':s.ACCEPTANCE_TUPLE,
        'acceptanceScopePin':'https://github.com/yigini/soilfer-lims/issues/191#issuecomment-6101762952',
        'installerOrder':[key for key, _ in s.INSTALLERS], 'diskReserveFloorBytes':8589934592,
        'unexplainedDropAbortBytes':500000000, 'recovery':'FORWARD_ONLY_AFTER_ANY_INSTALLER_ATTEMPT',
        'deferred':['#274: 225 missing ordered WorkItems across 10 samples', '#205', '#284'],
        'files':{name:s.sha(destination / name) for name in files}}
    with (destination / 'prepared-manifest.json').open('x') as output:
        json.dump(manifest, output, indent=2)
    (destination / 'prepared-manifest.json').chmod(0o400)
    return {'status':manifest['status'], 'root':str(destination), 'head':s.HEAD,
        'image':build['image'], 'manifestSha256':s.sha(destination / 'prepared-manifest.json'),
        'coordinatorSha256':manifest['files']['release-forward.py'],
        'rehearsalReceiptSha256':manifest['files']['rehearsal-receipt.json'],
        'attemptPlanSha256':manifest['attemptPlanSha256'],
        'acceptancePlanSha256':manifest['acceptancePlanSha256'],
        'yy191ReviewChoiceSha256':manifest['files']['yy-191-review-choice-evidence.md']}

if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Require passed rehearsal root, fresh execution root, and green PR/main evidence'
    print(json.dumps(prepare(*[pathlib.Path(value).resolve() for value in sys.argv[1:]])), flush=True)
