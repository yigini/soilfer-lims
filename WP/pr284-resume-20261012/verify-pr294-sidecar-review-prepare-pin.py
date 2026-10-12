"""Verify an ACTUAL NEW source verdict and make one separately bound local pin.

No remote creation, copy, SQLite, Docker mutation or release execution. The
source-reviewed coordinator independently rechecks the original build/image
on the host before any new database copy.
"""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
repo = directory.parents[1]
source = '201bb5fe8fd30cb2991f7169177a864265e6301b'
sys.path.insert(0, str(directory / 'proof-source-export-201bb5fe'))
from import_proof_contract import *


def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint], cwd=repo, text=True, encoding='utf-8'))


def main():
    review_id = int(sys.argv[1])
    review = github('repos/yigini/soilfer-lims/issues/comments/' + str(review_id))
    index_path = directory / 'proof-source-export-201bb5fe/source-index.json'
    index = json.loads(index_path.read_bytes())
    files = {name: row['sha256'] for name, row in index['files'].items()}
    assert index['head'] == source
    for name, digest in files.items():
        assert hashlib.sha256((index_path.parent / name).read_bytes()).hexdigest() == digest
    source_review_pass(review, source, files)
    comments = json.loads(subprocess.check_output(['gh', 'api',
        'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp'],
        cwd=repo, text=True, encoding='utf-8'))
    assert not any(('source review: failed' in row['body'].lower() or 'source review: changes required' in row['body'].lower()
        or 'audit failed' in row['body'].lower()) and row['created_at'] > review['created_at']
        for page in comments for row in page), 'Later source failure exists'
    assert github('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == CANDIDATE_HEAD
    pr = github('repos/yigini/soilfer-lims/pulls/294')
    assert pr['merged'] and pr['head']['sha'] == AUDITED_PR_HEAD and pr['merge_commit_sha'] == CANDIDATE_HEAD
    validate_merge_identity(github('repos/yigini/soilfer-lims/git/commits/' + CANDIDATE_HEAD),
        github('repos/yigini/soilfer-lims/git/commits/' + AUDITED_PR_HEAD))
    app_review = github('repos/yigini/soilfer-lims/issues/comments/' + str(AUDIT_REVIEW_ID))
    require_pr_review(app_review)
    ci = github('repos/yigini/soilfer-lims/actions/runs/38256676268')
    assert ci['head_sha'] == CANDIDATE_HEAD and ci['status'] == 'completed' and ci['conclusion'] == 'success'
    checks = github('repos/yigini/soilfer-lims/commits/' + AUDITED_PR_HEAD + '/check-runs')['check_runs']
    assert checks and all(row['status'] == 'completed' and row['conclusion'] == 'success' for row in checks)
    original = json.loads((directory / 'build-959d17e1-135400/independent-verification.json').read_bytes())
    retained_build_authority(original['source'], original['sourceReview'])
    assert hashlib.sha256((directory / 'build-959d17e1-135400/build-receipt.json').read_bytes()).hexdigest() == ORIGINAL_BUILD_RECEIPT_SHA256
    pin = {'head': CANDIDATE_HEAD, 'baseHead': BASE_HEAD, 'auditedPrHead': AUDITED_PR_HEAD,
        'mergeBaseHead': MERGE_BASE_HEAD, 'originalProofRoot': EXPECTED_PROOF_ROOT,
        'firstProofPolicy': FIRST_PROOF_POLICY, 'pr': PR_NUMBER, 'tree': MERGED_TREE,
        'auditedTree': AUDITED_PR_TREE, 'mergeParents': MERGE_PARENTS,
        'auditReviewId': AUDIT_REVIEW_ID, 'mainCiRunId': 38256676268, 'proofSourceReviewId': review_id,
        **build_reuse_binding(), 'labAndHubBuildsOwnedByYY': True,
        'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
    validate_candidate(pin, original['built'], original['image'])
    pin_path = directory / 'target-pin-959d17e1-sidecar-144000.json'
    raw_path = directory / ('source-pass-' + str(review_id) + '.json')
    verification_path = directory / 'pr294-sidecar-source-pass-verification.json'
    assert not any(path.exists() for path in [pin_path, raw_path, verification_path]), 'Never overwrite source authority or pin'
    with raw_path.open('x', encoding='utf-8', newline='\n') as stream: json.dump(review, stream, indent=2)
    pin_bytes = (json.dumps(pin, indent=2) + '\n').encode()
    with pin_path.open('xb') as stream: stream.write(pin_bytes)
    record = {'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'status': 'ACTUAL_NEW_SIDECAR_SOURCE_PASS_VERIFIED_NO_WRITER', 'sourceCommit': source,
        'sourceReviewId': review_id, 'rawSourceReviewSha256': hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        'targetPinSha256': hashlib.sha256(pin_bytes).hexdigest(), 'targetPin': pin,
        'originalBuildReusedWithoutMutation': True, 'originalFailedPinUntouched': True,
        'newProofRootCreated': False, 'productionOperations': 0}
    with verification_path.open('x', encoding='utf-8', newline='\n') as stream: json.dump(record, stream, indent=2)
    print(json.dumps(record))


if __name__ == '__main__': main()
