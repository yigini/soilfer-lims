"""NEW #200 candidate contract bound to the actual audited merge.

Natural scheduler/refusal policies come from the exact historical pure module.
Only a new reviewed source commit may bind the actual audited/merged candidate;
no historical source pass, receipt, gate or proof is execution authority here.
"""
import datetime
import re

from import_source_graph import require_source_set

from runtime_proof_policies import (LIMIT, FLOOR, SOAK_SECONDS, TARGET_CONFIG, TARGET_LAB,
    TARGET_PROJECT, NATURAL_INTAKE_POLICY, REFUSAL_SCOPE_COMMENT_ID, REFUSAL_POLICY,
    CARDINALITY_POLICY, REFUSAL_PAIRING_SCOPE_COMMENT_ID, REFUSAL_PAIRING_POLICY,
    REFUSAL_PAIR_WINDOW_SECONDS, require, utc_seconds, expected_refusals,
    scheduler_refusals, intake_summary, completed_syncs, observation_end,
    require_final_observation)

BASE_HEAD = '51f6798806f630773786a08432290c1b21a841da'
LIVE_IMAGE = 'sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f'
HISTORICAL_ROOT_PATH = '/opt/lims/releases/runtime-kobo-release-51f67988-20261012T044924Z'
HISTORICAL_RECEIPT_SHA = '480f9e1a102533f6b8e2e1646db1bfbaeeab30f9e63a1a3611926dd82e621515'
PR_NUMBER = 284
AUDITED_PR_HEAD = 'c26591698c1e974a3bf771e5c333578755aef315'
CANDIDATE_HEAD = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
AUDITED_PR_TREE = '9b3b77496c3aa2cdad7c7594a0b258ec4b491753'
MERGED_TREE = '9b3b77496c3aa2cdad7c7594a0b258ec4b491753'
MERGE_PARENTS = [BASE_HEAD, AUDITED_PR_HEAD]
NATIVE_DELTA_POLICY = 'ONLY_200_EMPTY_ADDITIVE_IMPORT_10438_TO_10639'
RECOVERY_POLICY = 'SEPARATELY_AUDITED_FORWARD_FIX_ONLY'
HISTORICAL_SOURCE_REVIEWS = {6112725472, 6114217683, 6114289486, 6114935703,
    6115039634, 6115225815, 6115334499, 6117398054, 6117551195}


def bound_candidate():
    require(all(re.fullmatch('[a-f0-9]{40}', value) for value in
        [AUDITED_PR_HEAD, CANDIDATE_HEAD, AUDITED_PR_TREE, MERGED_TREE]) and
        AUDITED_PR_TREE == MERGED_TREE and MERGE_PARENTS == [BASE_HEAD, AUDITED_PR_HEAD],
        'Unreviewed/unmerged #200 target deliberately refuses execution')


def release_binding_tokens():
    bound_candidate()
    return [BASE_HEAD, AUDITED_PR_HEAD, CANDIDATE_HEAD, AUDITED_PR_TREE, MERGED_TREE,
        LIVE_IMAGE, HISTORICAL_RECEIPT_SHA, 'releasePr=284',
        'mergePolicy=EXACT_REVIEWED_PARENTS_AND_UNION_TREE',
        'naturalIntakePolicy=' + NATURAL_INTAKE_POLICY, 'importDeltaPolicy=' + NATIVE_DELTA_POLICY,
        'originalState=104tables/38receipts', 'installedState=106tables/39receipts',
        'defaultStartup=23NO_OP0/22READY0', 'productionRecovery=' + RECOVERY_POLICY]


def require_pr_review(review):
    bound_candidate()
    identifier = review.get('id')
    first = next((line.strip().strip('*_# ') for line in review.get('body', '').splitlines() if line.strip()), '')
    require(type(identifier) is int and identifier > 0 and
        review.get('html_url') == 'https://github.com/yigini/soilfer-lims/pull/284#issuecomment-' + str(identifier) and
        first == 'Audit passed: OK to merge and deploy' and AUDITED_PR_HEAD in review['body'] and
        'audit failed' not in review['body'].lower(), 'NEW primary exact-head PR284 audit required')


def candidate_identity(pin):
    bound_candidate()
    require(pin.get('head') == CANDIDATE_HEAD and pin.get('baseHead') == BASE_HEAD and
        pin.get('auditedPrHead') == AUDITED_PR_HEAD and type(pin.get('pr')) is int and pin['pr'] == PR_NUMBER and
        pin.get('tree') == MERGED_TREE and pin.get('auditedTree') == AUDITED_PR_TREE and
        pin.get('mergeParents') == MERGE_PARENTS, 'Exact newly reviewed #200 candidate required')


def validate_merge_identity(merged, audited):
    bound_candidate()
    require(merged['sha'] == CANDIDATE_HEAD and merged['tree']['sha'] == MERGED_TREE and
        [row['sha'] for row in merged['parents']] == MERGE_PARENTS and
        audited['sha'] == AUDITED_PR_HEAD and audited['tree']['sha'] == AUDITED_PR_TREE,
        'Actual merged parent/union-tree authority differs')


def validate_candidate(pin, built, image):
    candidate_identity(pin)
    require(type(pin.get('auditReviewId')) is int and pin['auditReviewId'] > 0 and
        type(pin.get('mainCiRunId')) is int and pin['mainCiRunId'] > 0, 'Actual audit/main CI missing')
    require(pin.get('labAndHubBuildsOwnedByYY') is True and
        pin.get('releaseWindowControl') == 'RELEASE_DAY_DISK_ABORTS_ACCEPTED', 'Both workload pins required')
    require(built.get('status') == 'BUILT_ONLY_NOT_DEPLOYED' and built.get('head') == pin['head'] and
        built.get('tree') == MERGED_TREE and built.get('productionDatabaseMounts') == 0,
        'One valid newly built #200 candidate required')
    require(image['Id'] == pin['image'] == built['image'] and
        type(image['Size']) is int and image['Size'] > 0 and image['Size'] == pin['imageBytes'] == built['imageBytes'] and
        image['Config']['Labels'].get('org.opencontainers.image.revision') == pin['head'],
        'Candidate image digest/size/revision differs')


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
