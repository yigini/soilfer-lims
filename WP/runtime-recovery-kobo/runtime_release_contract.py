"""Pure fail-closed evidence checks for one NEW runtime recovery release."""
import datetime
import hashlib
import json
import pathlib
import re
from proof_contract import *

WORKLOAD_PINS = {'labAndHubBuildsOwnedByYY': True,
    'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
REVIEWED_PROOF_SHA = '9f175f1355413fd66c6dbf7082eea64f50a97fea6cec4ee1c6a0055384f70a71'
REVIEWED_PROOF_SOURCE = '55c18943f569e9b031c8aae008f167ab399473af'
PROOF_SOURCE_REVIEW_ID = 6113431945
MEASUREMENT_GUARD_SHA = 'f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c'
ORIGINAL_GUARD_SHA = 'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169'
CORE_CONFIRMATION_SECONDS = 10
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
    proof_source_binding(proof, pin)
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


def proof_source_binding(proof, pin):
    require(proof['toolingCommit'] == REVIEWED_PROOF_SOURCE and
        proof['proofSourceReviewId'] == pin['proofSourceReviewId'] == PROOF_SOURCE_REVIEW_ID and
        proof['diskMeasurementGuardSha256'] == MEASUREMENT_GUARD_SHA and
        proof['coreDeallocationConfirmationDeadlineSeconds'] == CORE_CONFIRMATION_SECONDS and
        re.fullmatch(r'[0-9a-f]{64}', proof['authoritySha256']),
        'Corrected proof source authority or measurement contract differs')


def measurement_manifest(manifest):
    require(manifest['sourceReviewId'] == PROOF_SOURCE_REVIEW_ID and
        manifest['proofToolingCommit'] == REVIEWED_PROOF_SOURCE and
        manifest['diskMeasurementGuardSha256'] == manifest['files']['known_core_disk_guard_v2.py'] == MEASUREMENT_GUARD_SHA and
        manifest['files']['known_core_disk_guard.py'] == ORIGINAL_GUARD_SHA and
        manifest['coreDeallocationConfirmationDeadlineSeconds'] == CORE_CONFIRMATION_SECONDS,
        'Frozen source approval or measurement contract differs')


def proof_authority(proof, pin, source, authority, authority_sha):
    proof_source_binding(proof, pin)
    require(source['head'] == REVIEWED_PROOF_SOURCE and
        source['files']['rehearse_runtime.py']['sha256'] == REVIEWED_PROOF_SHA and
        source['files']['known_core_disk_guard_v2.py']['sha256'] == MEASUREMENT_GUARD_SHA and
        source['files']['known_core_disk_guard.py']['sha256'] == ORIGINAL_GUARD_SHA and
        authority_sha == proof['authoritySha256'] and
        authority['head'] == pin['head'] and authority['proofSourceReview']['id'] == PROOF_SOURCE_REVIEW_ID,
        'Original proof authority or measured source differs')
    source_review_pass(authority['proofSourceReview'], REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA)


def review_tokens(manifest, manifest_sha):
    return [PHRASE, manifest['head'], manifest['image'], manifest_sha,
        manifest['files']['deploy_runtime.py'], manifest['files']['rehearsal-receipt.json'],
        manifest['files']['startup_common.py'], manifest['files']['yy-authorization-evidence.md'],
        manifest['files']['target-pin.json'], HISTORICAL_RECEIPT_SHA,
        manifest['files']['proof-authority.json'], manifest['files']['proof-source-index.json'],
        REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA, ORIGINAL_GUARD_SHA,
        'proofSourceReviewId=' + str(PROOF_SOURCE_REVIEW_ID),
        'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
        'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']


def formal_pr_review(review):
    require(review['html_url'].startswith('https://github.com/yigini/soilfer-lims/pull/292#') and
        PHRASE in review['body'] and (AUDITED_PR_HEAD in review['body'] or AUDITED_PR_HEAD[:8] in review['body']),
        'Formal exact-head PR292 review missing')


def verify_gate(manifest, gate, manifest_sha, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    measurement_manifest(manifest)
    require(manifest['status'] == KIT_STATUS and manifest['baseHead'] == BASE_HEAD and
        manifest['head'] != BASE_HEAD and manifest['workloadControl'] == WORKLOAD_PINS and
        manifest['separateInstallerCommands'] == 0,
        'Wrong or historical release manifest')
    require(gate['status'] == 'FRESH_SINGLE_USE_RUNTIME_GATE' and
        gate['executionRoot'] == manifest['root'] and
        gate['head'] == gate['currentMainHead'] == manifest['head'] and gate['image'] == manifest['image'] and
        gate['manifestSha256'] == manifest_sha and gate['workloadControl'] == WORKLOAD_PINS,
        'Execution gate identity mismatch')
    age = now.timestamp() - utc_seconds(gate['verifiedUtc'])
    require(0 <= age <= 600, 'Fresh execution gate is stale or future-dated')
    require(gate['proofSourceReview']['id'] == manifest['sourceReviewId'] and
        gate['laterSourceAuditFailure'] is False and
        gate['coreDeallocationConfirmationDeadlineSeconds'] == CORE_CONFIRMATION_SECONDS,
        'Corrected source approval was superseded or timing differs')
    source_review_pass(gate['proofSourceReview'], REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA, now)
    for key, name in [('coordinatorSha256', 'deploy_runtime.py'), ('rehearsalReceiptSha256', 'rehearsal-receipt.json'),
                      ('targetPinSha256', 'target-pin.json'), ('yyEvidenceSha256', 'yy-authorization-evidence.md'),
                      ('proofAuthoritySha256', 'proof-authority.json'), ('proofSourceIndexSha256', 'proof-source-index.json'),
                      ('diskMeasurementGuardSha256', 'known_core_disk_guard_v2.py')]:
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
        review['id'] not in [6102481848, 6109804174, 6110472696, 6112725472, PROOF_SOURCE_REVIEW_ID] and
        all(token in review['body'] for token in review_tokens(manifest, manifest_sha)) and
        gate['laterKitAuditFailure'] is False, 'New exact-kit review missing or superseded')
    require(utc_seconds(review['created_at']) <= now.timestamp(), 'Kit review is future-dated')
    yy = gate['yyGo']; require(yy['authorizationMode'] == 'AUTO_AFTER_REVIEW' and
        yy['evidenceSha256'] == manifest['files']['yy-authorization-evidence.md'] and
        yy['standingScopeText'] == 'my go covers all' and yy['releaseHead'] == manifest['head'],
        'Original standing YY evidence missing')


def frozen_files(root, manifest):
    measurement_manifest(manifest)
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
    proof = json.loads((root / 'rehearsal-receipt.json').read_bytes())
    validate_proof(proof, pin)
    proof_authority(proof, pin, json.loads((root / 'proof-source-index.json').read_bytes()),
        json.loads((root / 'proof-authority.json').read_bytes()), sha(root / 'proof-authority.json'))
    return pin
