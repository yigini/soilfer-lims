"""NEW #200 candidate contract bound to the actual audited merge.

Natural scheduler/refusal policies come from the exact historical pure module.
Only a new reviewed source commit may bind the actual audited/merged candidate;
no historical source pass, receipt, gate or proof is execution authority here.
"""
import datetime
import hashlib
import json
import re

from import_source_graph import require_source_set
from import_stage import REPEAT_POLICY

from runtime_proof_policies import (LIMIT, FLOOR, SOAK_SECONDS, TARGET_CONFIG, TARGET_LAB,
    TARGET_PROJECT, NATURAL_INTAKE_POLICY, REFUSAL_SCOPE_COMMENT_ID, REFUSAL_POLICY,
    CARDINALITY_POLICY, REFUSAL_PAIRING_SCOPE_COMMENT_ID, REFUSAL_PAIRING_POLICY,
    REFUSAL_PAIR_WINDOW_SECONDS, require, utc_seconds, expected_refusals,
    scheduler_refusals, intake_summary, completed_syncs, observation_end,
    require_final_observation)

BASE_HEAD = '51f6798806f630773786a08432290c1b21a841da'
MERGE_BASE_HEAD = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
LIVE_IMAGE = 'sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f'
HISTORICAL_ROOT_PATH = '/opt/lims/releases/runtime-kobo-release-51f67988-20261012T044924Z'
HISTORICAL_RECEIPT_SHA = '480f9e1a102533f6b8e2e1646db1bfbaeeab30f9e63a1a3611926dd82e621515'
PR_NUMBER = 294  # Actual one-time correction; NEW proof-source review is still required.
AUDIT_REVIEW_ID = 6125341751
AUDITED_PR_HEAD = '5e65fe5b587747efc717f167f9b61469effa9afe'
CANDIDATE_HEAD = '959d17e11c357266f7c2a41b0c84ab76914c591e'
AUDITED_PR_TREE = '336223df0161caeae4eb7db1e40df748d8ba110f'
MERGED_TREE = '336223df0161caeae4eb7db1e40df748d8ba110f'
MERGE_PARENTS = [MERGE_BASE_HEAD, AUDITED_PR_HEAD]
EXPECTED_PROOF_ROOT = '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z'
FAILED_PROOF_ROOTS = {'/opt/lims/releases/instrument-import-proof-5dd5488d-20261012T105200Z',
    '/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z'}
FIRST_PROOF_POLICY = 'EXACT_REVIEWED_FIRST_PROOF_ROOT_NO_REPLAY'
MIN_MEASURED_TIMEOUT_HEADROOM_SECONDS = 60
PRODUCTION_UNIT_LIMIT_SECONDS = 5400
MIN_MEASURED_UNIT_HEADROOM_SECONDS = 600
NATIVE_DELTA_POLICY = 'ONLY_200_EMPTY_ADDITIVE_IMPORT_10438_TO_10639'
RECOVERY_POLICY = 'SEPARATELY_AUDITED_FORWARD_FIX_ONLY'
RETAINED_DATABASE_ALLOCATION_COUNT = 16
BUILD_REUSE_POLICY = 'EXACT_ORIGINAL_BUILD_AUTHORITY_NO_REBUILD_OR_RETAG'
ORIGINAL_BUILD_ROOT = '/opt/lims/releases/instrument-import-build-959d17e1-20261012T135400Z'
ORIGINAL_BUILD_SOURCE = '630b2354a1a45df0d88545ac5c63594361615999'
ORIGINAL_BUILD_SOURCE_REVIEW_ID = 6125544861
ORIGINAL_BUILD_RECEIPT_SHA256 = '1a983172adebaba8b1a61959810d5469d9c12d706725bd33783d43cc8cceabe0'
ORIGINAL_BUILD_IMAGE = 'sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
ORIGINAL_BUILD_IMAGE_BYTES = 413806636
ORIGINAL_BUILDER_SHA256 = 'c460f0dc0ee6a3a579025653abcf562f7b73859e1191a61c0f9f4b561932877a'
ORIGINAL_PREPARER_SHA256 = 'a63a1cc3aaead6b0cf470efa69ca8168d65429802deb987078effc6e702a0991'
ORIGINAL_BUILD_SOURCE_INDEX_SHA256 = '592f749f83eb166660a649030a0020600c0f99f403e5c40f9dfb9a5e3fc30c3f'
ORIGINAL_BUILD_REVIEW_RAW_SHA256 = 'cd3f50d2794d39b6c28d2af3bbb88d3a2fa7ec1ffe93b7f1b4458655c5b82190'
HISTORICAL_SOURCE_REVIEWS = {6112725472, 6114217683, 6114289486, 6114935703,
    6115039634, 6115225815, 6115334499, 6117398054, 6117551195,
    6122670828, 6122904371, 6125544861}


def bound_candidate():
    require(all(re.fullmatch('[a-f0-9]{40}', value) for value in
        [BASE_HEAD, MERGE_BASE_HEAD, AUDITED_PR_HEAD, CANDIDATE_HEAD, AUDITED_PR_TREE, MERGED_TREE]) and
        AUDITED_PR_TREE == MERGED_TREE and MERGE_PARENTS == [MERGE_BASE_HEAD, AUDITED_PR_HEAD] and
        type(PR_NUMBER) is int and PR_NUMBER > 0 and PR_NUMBER != 284 and
        type(AUDIT_REVIEW_ID) is int and AUDIT_REVIEW_ID > 0 and AUDIT_REVIEW_ID != 6121933894,
        'Unreviewed/unmerged #200 target deliberately refuses execution')


def require_first_proof_root(root):
    """Bind the single root before any copy/CLI and again when freezing a kit."""
    import pathlib
    bound_candidate()
    require(isinstance(root, str), 'First proof root must be an exact absolute path')
    path = pathlib.PurePosixPath(root)
    require(str(path) == root and
        path.parent == pathlib.PurePosixPath('/opt/lims/releases') and
        re.fullmatch(r'instrument-import-proof-[A-Za-z0-9_-]+', path.name) and
        root == EXPECTED_PROOF_ROOT and root not in FAILED_PROOF_ROOTS,
        'Only the exact NEW source-reviewed first proof root is permitted')


def release_binding_tokens():
    bound_candidate()
    require_first_proof_root(EXPECTED_PROOF_ROOT)
    return [BASE_HEAD, MERGE_BASE_HEAD, AUDITED_PR_HEAD, CANDIDATE_HEAD, AUDITED_PR_TREE, MERGED_TREE,
        LIVE_IMAGE, HISTORICAL_RECEIPT_SHA, 'releasePr=' + str(PR_NUMBER),
        'auditReviewId=' + str(AUDIT_REVIEW_ID), 'mergeBaseHead=' + MERGE_BASE_HEAD,
        'originalProofRoot=' + EXPECTED_PROOF_ROOT, 'firstProofPolicy=' + FIRST_PROOF_POLICY,
        'MIN_MEASURED_TIMEOUT_HEADROOM_SECONDS=60', 'PRODUCTION_UNIT_LIMIT_SECONDS=5400',
        'MIN_MEASURED_UNIT_HEADROOM_SECONDS=600',
        'mergePolicy=EXACT_REVIEWED_PARENTS_AND_UNION_TREE',
        'naturalIntakePolicy=' + NATURAL_INTAKE_POLICY, 'importDeltaPolicy=' + NATIVE_DELTA_POLICY,
        'originalState=104tables/38receipts', 'installedState=106tables/39receipts',
        'defaultStartup=23NO_OP0/22READY0', 'productionRecovery=' + RECOVERY_POLICY,
        'nativeDryCopyPolicy=SEPARATE_OWNED_0400_BACKUP_COPY_WITH_WRITABLE_SIDECAR_DIRECTORY',
        'retainedDatabaseAllocationCount=' + str(RETAINED_DATABASE_ALLOCATION_COUNT),
        'repeatPhysicalPolicy=' + REPEAT_POLICY,
        'buildReusePolicy=' + BUILD_REUSE_POLICY, ORIGINAL_BUILD_ROOT, ORIGINAL_BUILD_SOURCE,
        'originalBuildSourceReviewId=' + str(ORIGINAL_BUILD_SOURCE_REVIEW_ID),
        ORIGINAL_BUILD_RECEIPT_SHA256, ORIGINAL_BUILD_IMAGE, 'originalBuildImageBytes=' + str(ORIGINAL_BUILD_IMAGE_BYTES),
        'originalBuilderSha256=' + ORIGINAL_BUILDER_SHA256, 'originalPreparerSha256=' + ORIGINAL_PREPARER_SHA256,
        ORIGINAL_BUILD_SOURCE_INDEX_SHA256, ORIGINAL_BUILD_REVIEW_RAW_SHA256,
        'CLI_TIMEOUT_SECONDS=600', 'nativeCliNetwork=none', 'nativeCliMemorySwapBytes=805306368']


def measured_timing_headroom(native, jobs_off, jobs_on):
    """Report measured stages only; backup/quiesce/ingress are not estimated here."""
    import math
    stages = {label: row.get('elapsedSeconds') for label, row in zip(
        ['import-dry', 'import-apply', 'import-repeat'], native.get('measurements', []))}
    require(len(native.get('measurements', [])) == 3, 'Three measured native stages required')
    stages.update({'jobs-off-readiness': jobs_off.get('elapsedSeconds'),
                  'jobs-on-readiness': jobs_on.get('elapsedSeconds')})
    require(all(type(value) in [int, float] and math.isfinite(value) and
        0 < value <= 600 - MIN_MEASURED_TIMEOUT_HEADROOM_SECONDS for value in stages.values()),
        'Measured CLI/readiness stages need at least sixty seconds of timeout headroom')
    measured = sum(stages.values()) + 660
    remaining = PRODUCTION_UNIT_LIMIT_SECONDS - measured
    require(remaining >= MIN_MEASURED_UNIT_HEADROOM_SECONDS,
        'Measured stages leave insufficient production unit headroom')
    return {'policy': 'MEASURED_STAGES_ONLY_NOT_TOTAL_PRODUCTION_WALL_TIME',
        'stageElapsedSeconds': stages, 'stageTimeoutHeadroomSeconds':
            {label: 600 - elapsed for label, elapsed in stages.items()},
        'productionHealthyObservationSeconds': 660,
        'measuredStagesPlusObservationSeconds': measured,
        'unitLimitSeconds': PRODUCTION_UNIT_LIMIT_SECONDS,
        'remainingForUnmeasuredOperationsSeconds': remaining,
        'unmeasuredOperations': ['quiesce', 'backup', 'seals', 'API probes', 'ingress', 'coordination']}


def require_pr_review(review):
    bound_candidate()
    identifier = review.get('id')
    first = next((line.strip().strip('*_# ') for line in review.get('body', '').splitlines() if line.strip()), '')
    require(type(identifier) is int and identifier == AUDIT_REVIEW_ID and
        review.get('html_url') == 'https://github.com/yigini/soilfer-lims/pull/' + str(PR_NUMBER) + '#issuecomment-' + str(identifier) and
        first == 'Audit passed: OK to merge and deploy' and AUDITED_PR_HEAD in review['body'] and
        'audit failed' not in review['body'].lower(), 'NEW primary exact-head correction audit required')


def candidate_identity(pin):
    bound_candidate()
    require(pin.get('head') == CANDIDATE_HEAD and pin.get('baseHead') == BASE_HEAD and
        pin.get('mergeBaseHead') == MERGE_BASE_HEAD and
        type(pin.get('auditReviewId')) is int and pin['auditReviewId'] == AUDIT_REVIEW_ID and
        pin.get('auditedPrHead') == AUDITED_PR_HEAD and type(pin.get('pr')) is int and pin['pr'] == PR_NUMBER and
        pin.get('tree') == MERGED_TREE and pin.get('auditedTree') == AUDITED_PR_TREE and
        pin.get('mergeParents') == MERGE_PARENTS and
        pin.get('originalProofRoot') == EXPECTED_PROOF_ROOT and
        pin.get('firstProofPolicy') == FIRST_PROOF_POLICY, 'Exact newly reviewed #200 candidate required')
    require_first_proof_root(pin['originalProofRoot'])


def validate_merge_identity(merged, audited):
    bound_candidate()
    require(merged['sha'] == CANDIDATE_HEAD and merged['tree']['sha'] == MERGED_TREE and
        [row['sha'] for row in merged['parents']] == MERGE_PARENTS and
        audited['sha'] == AUDITED_PR_HEAD and audited['tree']['sha'] == AUDITED_PR_TREE,
        'Actual merged parent/union-tree authority differs')


def validate_candidate(pin, built, image):
    candidate_identity(pin)
    require_build_reuse(pin)
    require(type(pin.get('auditReviewId')) is int and pin['auditReviewId'] > 0 and
        type(pin.get('mainCiRunId')) is int and pin['mainCiRunId'] > 0, 'Actual audit/main CI missing')
    require(pin.get('labAndHubBuildsOwnedByYY') is True and
        pin.get('releaseWindowControl') == 'RELEASE_DAY_DISK_ABORTS_ACCEPTED', 'Both workload pins required')
    require(built.get('status') == 'BUILT_ONLY_NOT_DEPLOYED' and built.get('head') == pin['head'] and
        built.get('tree') == MERGED_TREE and built.get('productionDatabaseMounts') == 0,
        'One valid newly built #200 candidate required')
    require(pin.get('buildRoot') == ORIGINAL_BUILD_ROOT and
        pin.get('buildReceiptSha256') == ORIGINAL_BUILD_RECEIPT_SHA256 and
        pin.get('buildReusePolicy') == BUILD_REUSE_POLICY and
        built.get('toolingCommit') == pin.get('buildSourceCommit') == ORIGINAL_BUILD_SOURCE and
        built.get('proofSourceReviewId') == pin.get('buildSourceReviewId') == ORIGINAL_BUILD_SOURCE_REVIEW_ID and
        built.get('builderSha256') == ORIGINAL_BUILDER_SHA256 and
        built.get('toolingSourceIndexSha256') == ORIGINAL_BUILD_SOURCE_INDEX_SHA256 and
        built.get('proofSourceReviewRawSha256') == ORIGINAL_BUILD_REVIEW_RAW_SHA256 and
        pin['image'] == ORIGINAL_BUILD_IMAGE and pin['imageBytes'] == ORIGINAL_BUILD_IMAGE_BYTES,
        'Only the unchanged original reviewed 959d build is eligible; no rebuild')
    require(image['Id'] == pin['image'] == built['image'] and
        type(image['Size']) is int and image['Size'] > 0 and image['Size'] == pin['imageBytes'] == built['imageBytes'] and
        image['Config']['Labels'].get('org.opencontainers.image.revision') == pin['head'],
        'Candidate image digest/size/revision differs')


def retained_build_authority(source, review):
    require(source.get('head') == ORIGINAL_BUILD_SOURCE and
        hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest() == ORIGINAL_BUILD_SOURCE_INDEX_SHA256 and
        review.get('id') == ORIGINAL_BUILD_SOURCE_REVIEW_ID and
        hashlib.sha256(json.dumps(review, sort_keys=True).encode()).hexdigest() == ORIGINAL_BUILD_REVIEW_RAW_SHA256 and
        source['files']['build_import.py']['sha256'] == ORIGINAL_BUILDER_SHA256 and
        source['files']['prepare_import_build.py']['sha256'] == ORIGINAL_PREPARER_SHA256,
        'Original build source/review/preparer authority changed')


def build_reuse_binding():
    """Keep the completed build's authority separate from NEW proof authority."""
    return {'buildReusePolicy': BUILD_REUSE_POLICY, 'buildRoot': ORIGINAL_BUILD_ROOT,
        'buildReceiptSha256': ORIGINAL_BUILD_RECEIPT_SHA256,
        'buildSourceCommit': ORIGINAL_BUILD_SOURCE, 'buildSourceReviewId': ORIGINAL_BUILD_SOURCE_REVIEW_ID,
        'buildSourceIndexSha256': ORIGINAL_BUILD_SOURCE_INDEX_SHA256,
        'buildSourceReviewRawSha256': ORIGINAL_BUILD_REVIEW_RAW_SHA256,
        'originalBuilderSha256': ORIGINAL_BUILDER_SHA256, 'originalPreparerSha256': ORIGINAL_PREPARER_SHA256,
        'image': ORIGINAL_BUILD_IMAGE, 'imageBytes': ORIGINAL_BUILD_IMAGE_BYTES}


def require_build_reuse(row):
    require(all(type(row.get(key)) is type(value) and row[key] == value
        for key, value in build_reuse_binding().items()),
        'Completed original build reuse authority differs; no rebuild or retag')


def source_review_pass(review, tooling, files, now=None):
    bound_candidate()
    require(type(review.get('id')) is int and review['id'] > 0 and review['id'] not in HISTORICAL_SOURCE_REVIEWS and
        review['html_url'] == 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']) and
        re.fullmatch('[a-f0-9]{40}', tooling), 'A NEW exact #200 source review is required')
    require_source_set(files)
    first_line = next((line.strip().strip('*_# ') for line in review['body'].splitlines() if line.strip()), '')
    require(first_line == 'Source review: PASS' and 'source review: failed' not in review['body'].lower() and
        'audit failed' not in review['body'].lower(), 'Source pass must be the primary unambiguous verdict')
    tokens = release_binding_tokens() + ['Source review: PASS', tooling,
        'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
        'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
        'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10',
        'proofBaselineLayoutPolicy=EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT',
        'refusalScopeCommentId=' + str(REFUSAL_SCOPE_COMMENT_ID), REFUSAL_POLICY, CARDINALITY_POLICY,
        'refusalPairingScopeCommentId=' + str(REFUSAL_PAIRING_SCOPE_COMMENT_ID),
        'schedulerRefusalPairing=' + REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']
    tokens += [name + '=' + digest for name, digest in sorted(files.items())]
    require(all(token in review['body'] for token in tokens), 'Exact NEW #200 source approval missing')
    now = now or datetime.datetime.now(datetime.timezone.utc)
    require(utc_seconds(review['created_at']) <= now.timestamp(), 'Source review is future-dated')
