"""Pure fail-closed evidence checks for one NEW runtime recovery release."""
import datetime
import hashlib
import json
import pathlib
import re
from proof_contract import *

WORKLOAD_PINS = {'labAndHubBuildsOwnedByYY': True,
    'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
REVIEWED_PROOF_SHA = 'a88223aa90e22253118b56ce72770ec1a219d0a82f71b3c9556a00c79e8f4271'
SHARED_READINESS_SHA = 'e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00'
HISTORICAL_RECEIPT_SHA = '35ab0b825a5d52414304d426101863b671ce5d3b92f6d8eb81e8b79f34095462'
LIVE_IMAGE = 'sha256:bc2557a5dee2a8599d31cf96407088d67ce863c4ad3fc7e6989b8671e10c597a'
KIT_STATUS = 'PREPARED_RUNTIME_FORWARD_ONLY_NOT_EXECUTED'
PHRASE = 'Audit passed: OK to merge and deploy'


def sha(path):
    value = hashlib.sha256()
    with pathlib.Path(path).open('rb') as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()


def safe_root(value, prefix):
    root = pathlib.PurePosixPath(value)
    require(root.parent == pathlib.PurePosixPath('/opt/lims/releases') and
        re.fullmatch(re.escape(prefix) + r'[A-Za-z0-9_-]+', root.name), 'Unsafe or wrong release root')
    return root


def validate_proof(proof, pin):
    require(proof['status'] == 'PASSED_NEW_CANDIDATE_NATURAL_KOBO_PROOF', 'A failed proof cannot feed a kit')
    require(proof['head'] == pin['head'] and proof['image'] == pin['image'] and
        proof['buildReceiptSha256'] == pin['buildReceiptSha256'], 'Wrong proof candidate')
    require(proof['coordinatorSha256'] == REVIEWED_PROOF_SHA and
        proof['historicalReceiptSha256'] == HISTORICAL_RECEIPT_SHA, 'Unreviewed proof or altered history')
    require(proof['productionMutations'] == proof['separateInstallerCommands'] == 0 and
        proof['ownedWriterStopped'] is True, 'Proof isolation or stopped-writer evidence missing')
    require(proof['effectiveUid'] == 0 and proof['pythonOptimize'] == 0 and
        proof['baselineEnumerationErrorCount'] == 0, 'Proof execution guards did not pass')
    require(proof['workloadPins'] == WORKLOAD_PINS and proof['reserveBytes'] >= FLOOR,
        'Workload or disk reserve pin missing')
    require(proof['existingSampleVerifierPolicy'] == 'STRICT_ORIGINAL_ROWS' and
        proof['allOriginalRowsAndSchemaPreserved'] is True and
        proof['protectedTableCount'] == 104 and proof['protectedReceiptCount'] == 38,
        'Full original-row preservation missing')
    require(proof['memoryLimitBytes'] == LIMIT and proof['nodeOptions'] == '' and
        0 < proof['peakBytes'] <= LIMIT and proof['databaseChangesBeforeJobs'] == 0,
        'Bounded runtime or jobs-off zero-write evidence missing')
    require(proof['healthSamples'] and all(row['healthy'] is True and row['restartCount'] == 0 and
        0 < row['peakBytes'] <= LIMIT for row in proof['healthSamples']), 'Runtime observation includes an unhealthy sample')
    for stage, jobs in [('jobsOff', False), ('jobsOn', True)]:
        readiness = proof[stage + 'Readiness']; checks = proof[stage + 'Startup']
        require(readiness['deadlineSeconds'] == 600 and 0 < readiness['elapsedSeconds'] < 600 and
            readiness['sharedReadinessCode'] == SHARED_READINESS_SHA and
            readiness['restartCount'] == 0 and readiness['oomKilled'] is False and
            readiness['memoryLimitBytes'] == LIMIT and readiness['jobsEnabled'] is jobs,
            'Startup readiness proof did not pass')
        require(checks['startupChanges'] == 0 and len(checks['entrypointInstallers']) == 22 and
            all(row['mode'] == 'NO_OP' and row['totalChanges'] == 0 for row in checks['entrypointInstallers']) and
            len(checks['startupReady']) == 21 and all(row.get('totalChanges', 0) == 0 for row in checks['startupReady']),
            'Entrypoint repeat or READY evidence missing')
        require(0 < checks['startupMemory']['peakBytes'] <= LIMIT and
            checks['startupMemory']['nodeOptions'] is None, 'Startup heap override or peak refusal')
    require(proof['apiChecks'] == {'passed': 31, 'total': 31, 'failed': 0} and
        len(proof['probes']) == 6 and all(row['exitCode'] == 0 for row in proof['probes']) and
        proof['readOnlyProbeChanges'] == 0, 'Read-only API proof incomplete')
    require_final_observation(proof['firstScheduledSync'], proof['secondScheduledSync'],
        proof['jobsOnReadiness']['readyUtc'], proof['observedThroughUtc'], proof['copySyncIntervalMins'],
        0, proof['peakBytes'], proof['healthySoakSeconds'])


def review_tokens(manifest, manifest_sha):
    return [PHRASE, manifest['head'], manifest['image'], manifest_sha,
        manifest['files']['deploy_runtime.py'], manifest['files']['rehearsal-receipt.json'],
        manifest['files']['startup_common.py'], manifest['files']['yy-authorization-evidence.md'],
        manifest['files']['target-pin.json'], HISTORICAL_RECEIPT_SHA,
        'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']


def formal_pr_review(review):
    require(review['html_url'].startswith('https://github.com/yigini/soilfer-lims/pull/292#') and
        PHRASE in review['body'] and (AUDITED_PR_HEAD in review['body'] or AUDITED_PR_HEAD[:8] in review['body']),
        'Formal exact-head PR292 review missing')


def verify_gate(manifest, gate, manifest_sha, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    require(manifest['status'] == KIT_STATUS and manifest['baseHead'] == BASE_HEAD and
        manifest['head'] != BASE_HEAD and manifest['workloadControl'] == WORKLOAD_PINS and
        manifest['sourceReviewId'] == 6112725472 and manifest['separateInstallerCommands'] == 0,
        'Wrong or historical release manifest')
    require(gate['status'] == 'FRESH_SINGLE_USE_RUNTIME_GATE' and
        gate['executionRoot'] == manifest['root'] and
        gate['head'] == gate['currentMainHead'] == manifest['head'] and gate['image'] == manifest['image'] and
        gate['manifestSha256'] == manifest_sha and gate['workloadControl'] == WORKLOAD_PINS,
        'Execution gate identity mismatch')
    age = now.timestamp() - utc_seconds(gate['verifiedUtc'])
    require(0 <= age <= 600, 'Fresh execution gate is stale or future-dated')
    for key, name in [('coordinatorSha256', 'deploy_runtime.py'), ('rehearsalReceiptSha256', 'rehearsal-receipt.json'),
                      ('targetPinSha256', 'target-pin.json'), ('yyEvidenceSha256', 'yy-authorization-evidence.md')]:
        require(gate[key] == manifest['files'][name], 'Gate file binding differs: ' + name)
    pr = gate['pr']; require(pr['number'] == 292 and pr['merged'] is True and
        pr['head'] == AUDITED_PR_HEAD and pr['mergeCommit'] == manifest['head'] and
        pr['tree'] == pr['auditedTree'] == manifest['tree'] and pr['laterAuditFailure'] is False,
        'Merged application or audit tree differs')
    formal_pr_review(pr['review'])
    require(pr['checks'] and all(row['head_sha'] == AUDITED_PR_HEAD and row['status'] == 'completed' and
        row['conclusion'] == 'success' for row in pr['checks']), 'Exact PR checks are not green')
    ci = gate['mainCi']; require(ci['head_sha'] == manifest['head'] and ci['name'] == 'CI' and
        ci['event'] == 'push' and ci['status'] == 'completed' and ci['conclusion'] == 'success',
        'Exact main CI is not green')
    review = gate['kitReview']; require(review['html_url'] ==
        'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']) and
        review['id'] not in [6102481848, 6109804174, 6110472696, 6112725472] and
        all(token in review['body'] for token in review_tokens(manifest, manifest_sha)) and
        gate['laterKitAuditFailure'] is False, 'New exact-kit review missing or superseded')
    require(utc_seconds(review['created_at']) <= now.timestamp(), 'Kit review is future-dated')
    yy = gate['yyGo']; require(yy['authorizationMode'] == 'AUTO_AFTER_REVIEW' and
        yy['evidenceSha256'] == manifest['files']['yy-authorization-evidence.md'] and
        yy['standingScopeText'] == 'my go covers all' and yy['releaseHead'] == manifest['head'],
        'Original standing YY evidence missing')


def frozen_files(root, manifest):
    for name, digest in manifest['files'].items():
        path = root / name
        require(pathlib.PurePosixPath(name).name == name and not path.is_symlink() and
            path.stat().st_mode & 0o777 == 0o400 and sha(path) == digest, 'Frozen file changed: ' + name)
    require((root / 'prepared-manifest.json').stat().st_mode & 0o777 == 0o400, 'Manifest mode changed')
    require(manifest['historicalReceiptSha256'] == HISTORICAL_RECEIPT_SHA and
        manifest['productionObservationSeconds'] == 660 and manifest['deadlineSeconds'] == 600 and
        manifest['reserveFloorBytes'] == FLOOR, 'Release execution contract changed')
    pin = json.loads((root / 'target-pin.json').read_bytes())
    require(pin['head'] == manifest['head'] and pin['image'] == manifest['image'] and
        pin['tree'] == manifest['tree'] and pin['auditedPrHead'] == AUDITED_PR_HEAD, 'Frozen target differs')
    validate_proof(json.loads((root / 'rehearsal-receipt.json').read_bytes()), pin)
    return pin
