"""Verify a completed release receipt and live health without database writes."""
import json, pathlib, sqlite3, subprocess, sys
sys.dont_write_bytecode = True
root = pathlib.Path('/opt/lims/releases/combined-release-eb6de2e8-feac6534-20261010T214130Z')
sys.path.insert(0, str(root))
import release_support as s
receipt_file = root / 'production-receipt.json'
receipt = json.loads(receipt_file.read_text())
assert receipt['status'] == 'DEPLOYED' and receipt['head'] == s.HEAD
assert receipt_file.stat().st_mode & 0o777 == 0o400
manifest = json.loads((root / 'prepared-manifest.json').read_text())
assert s.sha(root / 'prepared-manifest.json') == 'e6b8b8decd82fcb5fde05547bb0a8c32ce60081bcad1f76570e05034f724114a'
for name, expected in manifest['files'].items():
    assert s.sha(root / name) == expected
assert s.sha(pathlib.Path(manifest['rehearsalRoot']) / 'rehearsal-receipt.json') == manifest['files']['rehearsal-receipt.json']
assert receipt['githubGate']['workloadControl']['labAndHubBuildsOwnedByYY'] is True
assert receipt['githubGate']['workloadControl']['releaseWindowControl'] == 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'
assert receipt['apiChecks'] == {'passed':31, 'total':31, 'failed':0}
assert receipt['startupChanges'] == receipt['readOnlyProbeChanges'] == 0
assert [r['key'] for r in receipt['installers']] == [key for key, _ in s.INSTALLERS]
assert len(receipt['repeatInstallers']) == 21
assert all(r['mode'] == 'NO_OP' and r['totalChanges'] == 0 for r in receipt['repeatInstallers'])
assert len(receipt['startupReady']) == 20 and all(r.get('totalChanges', 0) == 0 for r in receipt['startupReady'])
link = next(r for r in receipt['installers'] if r['key'] == s.ACCEPTANCE_KEY)
s.verify_acceptance_stage(link)
repeat = next(r for r in receipt['installers'] if r['key'] == '191')
s.verify_repeat_inventory(repeat['dryRun'])
s.verify_repeat_inventory(repeat['apply'])
preservation = receipt['preservation']
assert preservation['originalRowsAndFieldsPreserved'] is True
assert preservation['originalTableCount'] == 90 and preservation['originalReceiptsPreserved'] == 18
assert preservation['createdAttempts'] == 17 and preservation['approvedNullResultLinks'] == 19
assert preservation['approvedAttemptStatusChanges'] == preservation['approvedAcceptanceAuditEvents'] == 1
assert preservation['integrity'] == 'ok' and preservation['foreignKeyViolations'] == 0
memory = {}
for key, _ in s.INSTALLERS:
    for mode in ['dry', 'apply', 'repeat']:
        label = key + '-' + mode
        row = json.loads((root / (label + '-container.json')).read_text())
        peak = row['cgroupMemoryPeak']
        assert row['memoryLimitBytes'] == 805306368 and row['nodeOptions'] is None and row['exitCode'] == 0
        assert peak['childStatus'] == 0 and peak['childSignal'] is None
        assert 0 < peak['releaseCliPeakBytes'] <= 805306368
        memory[label] = peak['releaseCliPeakBytes']
probe_names = ['postflight-roles', 'postflight-auth', 'postflight-reference',
    'postflight-qc-runs', 'postflight-policy', 'readonly-smoke']
assert all((root / (name + '.stdout')).is_file() and (root / (name + '.stderr')).is_file() for name in probe_names)
live = json.loads(subprocess.check_output(['docker', 'inspect', 'soilfer-lims'], text=True))[0]
assert live['Image'] == manifest['image'] and live['State']['Running'] is True
assert live['State']['Health']['Status'] == 'healthy' and live['RestartCount'] == 0
env = dict(value.split('=',1) for value in live['Config']['Env'])
assert env['DISABLE_BACKGROUND_JOBS'] == 'false'
assert env['ALLOW_PRISMA_DB_PUSH'] == env['ALLOW_AUTO_SEED'] == 'false'
image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', live['Image']], text=True))[0]
assert image['Config']['Labels']['org.opencontainers.image.revision'] == s.HEAD
assert 'R=503' not in s.CONF.read_text()
health = json.loads(subprocess.check_output(['curl', '-fsS', '--max-time','15','https://lims.yigini.net/api/health'], text=True))
assert health['status'] == 'ok'
denied = subprocess.check_output(['curl','-sS','--max-time','15','-o','/dev/null','-w','%{http_code}',
    '-X','POST','https://lims.yigini.net/api/v2/data-exchange/receipts'], text=True)
assert denied == '401'
db = sqlite3.connect('file:' + str(s.LIVE) + '?mode=ro', uri=True)
try:
    assert db.execute('SELECT status FROM WorkAttempt WHERE id=?', ('att-s02-p-2',)).fetchone() == ('ACCEPTED',)
    assert db.execute('SELECT attemptId FROM ReviewDecision WHERE id=?', ('dec-s02-p-acc',)).fetchone() == (None,)
    assert db.execute('SELECT status FROM Report WHERE id=?', ('RPT-GTM-DEMO-S02-v1',)).fetchone() == ('PUBLISHED',)
finally:
    db.close()
free = s.disk_free()
assert min(free.values()) >= receipt['diskReserveRequiredBytes']
print(json.dumps({'status':'INDEPENDENT_READ_ONLY_PRODUCTION_VERIFICATION_PASSED', 'verifiedUtc':s.utc(),
    'head':s.HEAD, 'completedUtc':receipt['timesUtc']['completed'],
    'productionReceiptSha256':s.sha(receipt_file), 'gateSha256':s.sha(root / 'production-gate.json'),
    'image':live['Image'], 'imageRevision':s.HEAD, 'health':health, 'containerHealth':'healthy',
    'restarts':live['RestartCount'], 'jobsEnabled':True, 'ingressOpen':True, 'deniedPostHttpStatus':401,
    'installerStages':len(receipt['installers']), 'boundedCliMeasurements':len(memory),
    'maxCliPeakBytes':max(memory.values()), 'endRepeats':21, 'immediateAcceptanceRepeatChanges':0,
    'startupReady':20, 'apiChecks':receipt['apiChecks'], 'readOnlyProbes':6,
    'preservation':preservation, 'freeBytes':free, 'reserveBytes':receipt['diskReserveRequiredBytes']}))
