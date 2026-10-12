"""Pure fail-closed evidence checks for one NEW runtime recovery release."""
import datetime
import hashlib
import json
import pathlib
import re
from proof_contract import *

WORKLOAD_PINS = {'labAndHubBuildsOwnedByYY': True,
    'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
REVIEWED_PROOF_SHA = 'c47ef37880185fa7c8ac565f28fc16fe7040b549ed3bea482ab1c0295478d5f0'
REVIEWED_PROOF_SOURCE = '206c4dc41a99045ab8a47871ebe8782fda4cba20'
PROOF_SOURCE_REVIEW_ID = 6115225815
REVIEWED_VERIFIER_SHA = '3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23'
REVIEWED_PROOF_CONTRACT_SHA = 'cd190348d332fd12e53694ca080819c2d095bfa5c4ee86eb058686a65a38fb0e'
PROOF_BASELINE_LAYOUT_SHA = '49c76b8d0312a38820ea8dff707cdfd6674614c63344bedf2655755b6ca6f1b6'
PROOF_BASELINE_LAYOUT_POLICY = 'EXACT_HASHED_PROOF_AUTHORITY_LAYOUT'
BASELINE_GUARD_SHA = '878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f'
BASELINE_POLICY = 'CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE'
BASELINE_ATTEMPTS_MAX = 3
BASELINE_CONFIRMATION_SECONDS = 10
PRODUCTION_BASELINE_SCOPE_ID = 6113922488
DEPLOY_BASELINE_GUARD_SHA = 'd1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f'
PRODUCTION_SOURCE_FILES = ['known_core_disk_guard_deploy.py', 'deploy_runtime.py', 'freeze_runtime.py',
    'runtime_release_contract.py', 'collect_runtime_gate.py', 'export_freeze_runtime_kit.py', 'launch_runtime_release.py']
MEASUREMENT_GUARD_SHA = 'f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c'
ORIGINAL_GUARD_SHA = 'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169'
CORE_CONFIRMATION_SECONDS = 10
SHARED_READINESS_SHA = 'e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00'
KIT_STATUS = 'PREPARED_RUNTIME_FORWARD_ONLY_NOT_EXECUTED'
PHRASE = 'Audit passed: OK to merge and deploy'
FAILURE_REFERENCE_POLICY = 'PASS_HEADER_NEGATED_QUOTED_FAILURE_REFERENCE_ONLY'


def has_failed_verdict(body, include_source=False):
    """Keep broad refusal, except an exact negated quote inside a PASS verdict."""
    lines = body.lstrip().splitlines()
    first = lines[0].strip().strip('*_# ') if lines else ''
    if first in [PHRASE, 'Source review: PASS']:
        body = re.sub(r'\bno later[ \t]+(?:"audit failed"|\'audit failed\'|“audit failed”|‘audit failed’)',
            '', body, flags=re.IGNORECASE)
    normalized = body.lower()
    return 'audit failed' in normalized or (include_source and 'source review: failed' in normalized)


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
    require(PROOF_SOURCE_REVIEW_ID > 0, 'Actual new proof-source review is not bound')
    candidate_identity(pin)
    require(proof['naturalIntakePolicy'] == NATURAL_INTAKE_POLICY and proof['baseHead'] == BASE_HEAD and
        proof['pr'] == PR_NUMBER and proof['tree'] == MERGED_TREE and proof['auditedTree'] == AUDITED_PR_TREE and
        proof['mergeParents'] == MERGE_PARENTS, 'Proof release or original-cursor workload differs')
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
    pairing_contract(proof)
    require(proof['toolingCommit'] == REVIEWED_PROOF_SOURCE and
        proof['proofSourceReviewId'] == pin['proofSourceReviewId'] == PROOF_SOURCE_REVIEW_ID and
        proof['diskMeasurementGuardSha256'] == MEASUREMENT_GUARD_SHA and
        proof['baselineMeasurementGuardSha256'] == BASELINE_GUARD_SHA and
        proof['proofBaselineLayoutGuardSha256'] == PROOF_BASELINE_LAYOUT_SHA and
        proof['proofBaselineLayoutPolicy'] == PROOF_BASELINE_LAYOUT_POLICY and
        proof['copyVerifierSha256'] == REVIEWED_VERIFIER_SHA and
        proof['proofContractSha256'] == REVIEWED_PROOF_CONTRACT_SHA and
        proof['refusalScopeCommentId'] == REFUSAL_SCOPE_COMMENT_ID and
        proof['schedulerRefusalPolicy'] == REFUSAL_POLICY and proof['intakeCardinalityPolicy'] == CARDINALITY_POLICY and
        proof['baselineVanishedProcessPolicy'] == BASELINE_POLICY and
        proof['BASELINE_ATTEMPTS_MAX'] == BASELINE_ATTEMPTS_MAX and
        proof['BASELINE_CONFIRMATION_DEADLINE_SECONDS'] == BASELINE_CONFIRMATION_SECONDS and
        proof['baselineAttempt'] in [1, 2, 3] and
        proof['coreDeallocationConfirmationDeadlineSeconds'] == CORE_CONFIRMATION_SECONDS and
        re.fullmatch(r'[0-9a-f]{64}', proof['authoritySha256']),
        'Corrected proof source authority or measurement contract differs')


def original_cursor_intake(proof, record, original_config):
    """Bind pending identities to the actual immutable baseline cursor, including empty."""
    require(proof['naturalIntakePolicy'] == NATURAL_INTAKE_POLICY and
        record['configId'] == original_config['id'] == TARGET_CONFIG and
        record['labId'] == original_config['labId'] == TARGET_LAB and
        record['projectCode'] == original_config['projectCode'] == TARGET_PROJECT and
        record['since'] == original_config['lastSubmissionId'], 'Original intake cursor or config differs')
    ids = record['submissionIds']
    require(isinstance(ids, list) and all(isinstance(value, str) and value.isdigit() for value in ids) and
        len(set(ids)) == len(ids) and ids == sorted(ids, key=int) and
        (record['since'] is None or str(record['since']).isdigit()) and
        all(record['since'] is None or int(value) > int(record['since']) for value in ids),
        'Actual pending submission identities differ')
    require(type(proof['initialTargetSubmissionCount']) is int and
        proof['initialTargetSubmissionCount'] == len(ids), 'Actual initial pending count differs')


def pairing_contract(row):
    require(row['refusalPairingScopeCommentId'] == REFUSAL_PAIRING_SCOPE_COMMENT_ID and
        row['schedulerRefusalPairing'] == REFUSAL_PAIRING_POLICY and
        row['REFUSAL_PAIR_WINDOW_SECONDS'] == REFUSAL_PAIR_WINDOW_SECONDS,
        'Cross-stream pairing authority or timing differs')


def pairing_review_tokens():
    return ['refusalPairingScopeCommentId=' + str(REFUSAL_PAIRING_SCOPE_COMMENT_ID),
        'schedulerRefusalPairing=' + REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']


def sealed_scheduler_evidence(proof, expected, stdout, stderr, first, second, full):
    """Recheck the original timestamped log against its sealed copy results."""
    require(proof['expectedSchedulerRefusals'] == expected, 'Fresh baseline refusal scope differs')
    observed = scheduler_refusals(stdout, stderr, expected)
    pairing_contract(proof)
    lab_counts = {lab: sum(row['labId'] == lab for row in observed)
        for lab in sorted({row['labId'] for row in expected})}
    require(proof['schedulerRefusalLabCounts'] == lab_counts and
        proof['schedulerRefusalConfigCountsDerivedFromTriggers'] is True, 'Per-lab refusal counts differ')
    counts = {row['configId']: sum(value['configId'] == row['configId'] for value in observed)
        for row in expected}
    require(proof['observedSchedulerRefusals'] == observed and proof['schedulerRefusalCounts'] == counts,
        'Retained scheduler refusal evidence differs')
    completions = completed_syncs(stdout)
    require(len(completions) >= 2 and proof['firstScheduledSync'] == completions[0] and
        proof['secondScheduledSync'] == completions[1], 'Original natural completion evidence differs')
    protected = sorted(row['configId'] for row in expected)
    for state in [first, second, full]:
        require(state['protectedRefusalConfigIds'] == protected, 'Failed configuration protection differs')
    require(proof['firstIntakeSummary'] == intake_summary(first, completions[0]) and
        proof['secondIntakeSummary'] == intake_summary(second, completions[1]) and
        proof['secondGenuinelyNewSubmissionIds'] == second['newSubmissionIds'].get(TARGET_CONFIG, []),
        'Sealed Sample-row cardinality differs')


def measurement_manifest(manifest):
    require(PROOF_SOURCE_REVIEW_ID > 0, 'Actual new proof-source review is not bound')
    pairing_contract(manifest)
    require(manifest['sourceReviewId'] == PROOF_SOURCE_REVIEW_ID and
        manifest['proofToolingCommit'] == REVIEWED_PROOF_SOURCE and
        manifest['diskMeasurementGuardSha256'] == manifest['files']['known_core_disk_guard_v2.py'] == MEASUREMENT_GUARD_SHA and
        manifest['files']['known_core_disk_guard.py'] == ORIGINAL_GUARD_SHA and
        manifest['baselineMeasurementGuardSha256'] == manifest['files']['known_core_disk_guard_v3.py'] == BASELINE_GUARD_SHA and
        manifest['proofBaselineLayoutGuardSha256'] == manifest['files']['known_core_disk_guard_proof.py'] == PROOF_BASELINE_LAYOUT_SHA and
        manifest['proofBaselineLayoutPolicy'] == PROOF_BASELINE_LAYOUT_POLICY and
        manifest['copyVerifierSha256'] == manifest['files']['kobo_copy_preservation.py'] == REVIEWED_VERIFIER_SHA and
        manifest['proofContractSha256'] == manifest['files']['proof_contract.py'] == REVIEWED_PROOF_CONTRACT_SHA and
        manifest['refusalScopeCommentId'] == REFUSAL_SCOPE_COMMENT_ID and
        manifest['schedulerRefusalPolicy'] == REFUSAL_POLICY and manifest['intakeCardinalityPolicy'] == CARDINALITY_POLICY and
        manifest['baselineVanishedProcessPolicy'] == BASELINE_POLICY and
        manifest['BASELINE_ATTEMPTS_MAX'] == BASELINE_ATTEMPTS_MAX and
        manifest['BASELINE_CONFIRMATION_DEADLINE_SECONDS'] == BASELINE_CONFIRMATION_SECONDS and
        manifest['productionBaselineScopeCommentId'] == PRODUCTION_BASELINE_SCOPE_ID and
        manifest['productionBaselineAdapterSha256'] == manifest['files']['known_core_disk_guard_deploy.py'] ==
            DEPLOY_BASELINE_GUARD_SHA and
        manifest['coreDeallocationConfirmationDeadlineSeconds'] == CORE_CONFIRMATION_SECONDS,
        'Frozen source approval or measurement contract differs')


def production_source_review(review, tooling, files, now=None):
    require(review['html_url'] == 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']),
        'Separate production baseline source review missing')
    tokens = release_binding_tokens() + ['Source review: PASS', tooling, DEPLOY_BASELINE_GUARD_SHA,
        BASELINE_GUARD_SHA, MEASUREMENT_GUARD_SHA, ORIGINAL_GUARD_SHA,
        'productionBaselineScopeCommentId=' + str(PRODUCTION_BASELINE_SCOPE_ID),
        'REQUIRED_HASHED_MANIFEST_AND_GATE', 'JOURNAL_UNIT_OUTPUT',
        'baselineVanishedProcessPolicy=' + BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX=3',
        'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10', 'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
        'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']
    tokens += [files[name] for name in PRODUCTION_SOURCE_FILES] + pairing_review_tokens()
    tokens += [REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, REVIEWED_PROOF_CONTRACT_SHA,
        PROOF_BASELINE_LAYOUT_SHA, 'proofBaselineLayoutPolicy=' + PROOF_BASELINE_LAYOUT_POLICY,
        'proofSourceReviewId=' + str(PROOF_SOURCE_REVIEW_ID), FAILURE_REFERENCE_POLICY]
    require(all(token in review['body'] for token in tokens), 'Exact production baseline source approval missing')
    now = now or datetime.datetime.now(datetime.timezone.utc)
    require(utc_seconds(review['created_at']) <= now.timestamp(), 'Production source review is future-dated')


def proof_authority(proof, pin, source, authority, authority_sha):
    proof_source_binding(proof, pin)
    require(source['head'] == REVIEWED_PROOF_SOURCE and
        source['files']['rehearse_runtime.py']['sha256'] == REVIEWED_PROOF_SHA and
        source['files']['known_core_disk_guard_v2.py']['sha256'] == MEASUREMENT_GUARD_SHA and
        source['files']['known_core_disk_guard.py']['sha256'] == ORIGINAL_GUARD_SHA and
        source['files']['known_core_disk_guard_v3.py']['sha256'] == BASELINE_GUARD_SHA and
        source['files']['known_core_disk_guard_proof.py']['sha256'] == PROOF_BASELINE_LAYOUT_SHA and
        source['files']['kobo_copy_preservation.py']['sha256'] == REVIEWED_VERIFIER_SHA and
        source['files']['proof_contract.py']['sha256'] == REVIEWED_PROOF_CONTRACT_SHA and
        authority_sha == proof['authoritySha256'] and
        authority['head'] == pin['head'] and authority['proofSourceReview']['id'] == PROOF_SOURCE_REVIEW_ID,
        'Original proof authority or measured source differs')
    source_review_pass(authority['proofSourceReview'], REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA,
        verifier_sha=REVIEWED_VERIFIER_SHA, contract_sha=REVIEWED_PROOF_CONTRACT_SHA, baseline_guard_sha=BASELINE_GUARD_SHA, stream_pairing=True,
        proof_layout_sha=PROOF_BASELINE_LAYOUT_SHA,
        authority_hashes=[source['files'][name]['sha256'] for name in
            ['build_candidate.py', 'prepare_candidate_build.py', 'export_launch_runtime_proof.py']])


def review_tokens(manifest, manifest_sha):
    return release_binding_tokens() + pairing_review_tokens() + [PHRASE, FAILURE_REFERENCE_POLICY, manifest['head'], manifest['image'], manifest_sha,
        manifest['files']['deploy_runtime.py'], manifest['files']['rehearsal-receipt.json'],
        manifest['files']['startup_common.py'], manifest['files']['yy-authorization-evidence.md'],
        manifest['files']['target-pin.json'], HISTORICAL_RECEIPT_SHA,
        manifest['files']['proof-authority.json'], manifest['files']['proof-source-index.json'],
        REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA, ORIGINAL_GUARD_SHA,
        BASELINE_GUARD_SHA, REVIEWED_VERIFIER_SHA, REVIEWED_PROOF_CONTRACT_SHA,
        PROOF_BASELINE_LAYOUT_SHA, 'proofBaselineLayoutPolicy=' + PROOF_BASELINE_LAYOUT_POLICY,
        DEPLOY_BASELINE_GUARD_SHA, 'productionBaselineScopeCommentId=' + str(PRODUCTION_BASELINE_SCOPE_ID),
        'productionBaselineSourceReviewId=' + str(manifest['productionBaselineSourceReviewId']),
        manifest['files']['production-baseline-source-review.json'],
        'REQUIRED_HASHED_MANIFEST_AND_GATE', 'JOURNAL_UNIT_OUTPUT',
        'baselineVanishedProcessPolicy=' + BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX=3',
        'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10', 'refusalScopeCommentId=6113601584',
        REFUSAL_POLICY, CARDINALITY_POLICY,
        'proofSourceReviewId=' + str(PROOF_SOURCE_REVIEW_ID),
        'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
        'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']


def formal_pr_review(review):
    require(review['html_url'].startswith('https://github.com/yigini/soilfer-lims/pull/291#') and
        PHRASE in review['body'] and (AUDITED_PR_HEAD in review['body'] or AUDITED_PR_HEAD[:8] in review['body']),
        'Formal exact-head PR291 review missing')


def verify_gate(manifest, gate, manifest_sha, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    measurement_manifest(manifest)
    pairing_contract(gate)
    require(manifest['status'] == KIT_STATUS and manifest['baseHead'] == BASE_HEAD and
        manifest['head'] == CANDIDATE_HEAD and manifest['tree'] == MERGED_TREE and
        manifest['naturalIntakePolicy'] == NATURAL_INTAKE_POLICY and manifest['workloadControl'] == WORKLOAD_PINS and
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
    source_review_pass(gate['proofSourceReview'], REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA, now,
        verifier_sha=REVIEWED_VERIFIER_SHA, contract_sha=REVIEWED_PROOF_CONTRACT_SHA, baseline_guard_sha=BASELINE_GUARD_SHA, stream_pairing=True,
        proof_layout_sha=PROOF_BASELINE_LAYOUT_SHA,
        authority_hashes=[manifest['files'][name] for name in
            ['build_candidate.py', 'prepare_candidate_build.py', 'export_launch_runtime_proof.py']])
    require(gate['productionBaselineSourceReview']['id'] == manifest['productionBaselineSourceReviewId'] and
        gate['laterProductionSourceAuditFailure'] is False and
        gate['productionBaselineScopeCommentId'] == PRODUCTION_BASELINE_SCOPE_ID,
        'Production baseline source authority differs or was superseded')
    production_source_review(gate['productionBaselineSourceReview'], manifest['packagingCommit'], manifest['files'], now)
    require(gate['refusalScopeCommentId'] == REFUSAL_SCOPE_COMMENT_ID and
        gate['schedulerRefusalPolicy'] == REFUSAL_POLICY and gate['intakeCardinalityPolicy'] == CARDINALITY_POLICY and
        gate['baselineVanishedProcessPolicy'] == BASELINE_POLICY and gate['BASELINE_ATTEMPTS_MAX'] == BASELINE_ATTEMPTS_MAX and
        gate['BASELINE_CONFIRMATION_DEADLINE_SECONDS'] == BASELINE_CONFIRMATION_SECONDS,
        'Gate baseline/refusal/cardinality contract differs')
    require(gate['proofBaselineLayoutPolicy'] == PROOF_BASELINE_LAYOUT_POLICY and
        gate['proofBaselineLayoutGuardSha256'] == PROOF_BASELINE_LAYOUT_SHA,
        'Gate proof baseline layout authority differs')
    for key, name in [('coordinatorSha256', 'deploy_runtime.py'), ('rehearsalReceiptSha256', 'rehearsal-receipt.json'),
                      ('targetPinSha256', 'target-pin.json'), ('yyEvidenceSha256', 'yy-authorization-evidence.md'),
                      ('proofAuthoritySha256', 'proof-authority.json'), ('proofSourceIndexSha256', 'proof-source-index.json'),
                      ('diskMeasurementGuardSha256', 'known_core_disk_guard_v2.py'),
                      ('baselineMeasurementGuardSha256', 'known_core_disk_guard_v3.py'),
                      ('proofBaselineLayoutGuardSha256', 'known_core_disk_guard_proof.py'),
                      ('productionBaselineAdapterSha256', 'known_core_disk_guard_deploy.py'),
                      ('productionBaselineSourceReviewSha256', 'production-baseline-source-review.json'),
                      ('copyVerifierSha256', 'kobo_copy_preservation.py'), ('proofContractSha256', 'proof_contract.py')]:
        require(gate[key] == manifest['files'][name], 'Gate file binding differs: ' + name)
    pr = gate['pr']; require(pr['number'] == PR_NUMBER and pr['merged'] is True and
        pr['head'] == AUDITED_PR_HEAD and pr['mergeCommit'] == manifest['head'] == CANDIDATE_HEAD and
        pr['tree'] == manifest['tree'] == MERGED_TREE and pr['auditedTree'] == AUDITED_PR_TREE and
        pr['mergeParents'] == MERGE_PARENTS and pr['laterAuditFailure'] is False,
        'Merged application or audit tree differs')
    formal_pr_review(pr['review'])
    require(pr['checks'] and all(row['head_sha'] == AUDITED_PR_HEAD and row['status'] == 'completed' and
        row['conclusion'] == 'success' for row in pr['checks']), 'Exact PR checks are not green')
    ci = gate['mainCi']; require(ci['head_sha'] == manifest['head'] and ci['name'] == 'CI' and
        ci['event'] == 'push' and ci['status'] == 'completed' and ci['conclusion'] == 'success',
        'Exact main CI is not green')
    review = gate['kitReview']; require(review['html_url'] ==
        'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']) and
        review['id'] not in [6102481848, 6109804174, 6110472696, 6112725472, 6114626674, PROOF_SOURCE_REVIEW_ID] and
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
    candidate_identity(pin)
    require(pin['head'] == manifest['head'] and pin['image'] == manifest['image'] and
        pin['tree'] == manifest['tree'] and pin['auditedPrHead'] == AUDITED_PR_HEAD, 'Frozen target differs')
    proof = json.loads((root / 'rehearsal-receipt.json').read_bytes())
    validate_proof(proof, pin)
    proof_authority(proof, pin, json.loads((root / 'proof-source-index.json').read_bytes()),
        json.loads((root / 'proof-authority.json').read_bytes()), sha(root / 'proof-authority.json'))
    production_review = json.loads((root / 'production-baseline-source-review.json').read_bytes())
    require(production_review['id'] == manifest['productionBaselineSourceReviewId'], 'Frozen production source review differs')
    production_source_review(production_review, manifest['packagingCommit'], manifest['files'])
    return pin
