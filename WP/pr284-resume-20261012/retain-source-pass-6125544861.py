"""Independently validate actual PR294 source authority without host operations."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
EXPORT = ROOT / 'proof-source-export-630b2354'
sys.path.insert(0, str(EXPORT))
from import_proof_contract import *
from import_source_graph import git_source, require_executed_sources

def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint], encoding='utf-8'))

def main():
    destination = ROOT / 'source-pass-6125544861.json'
    assert not destination.exists(), 'Never replace original evidence'
    source = '630b2354a1a45df0d88545ac5c63594361615999'
    raw, index = git_source(source, lambda *args: subprocess.check_output(['git', *args]))
    hashes = {name: row['sha256'] for name, row in index['files'].items()}
    require_executed_sources(hashes, EXPORT / 'prepare_import_build.py')
    assert all((EXPORT / name).read_bytes() == value for name, value in raw.items())
    review = github('repos/yigini/soilfer-lims/issues/comments/6125544861')
    source_review_pass(review, source, hashes)
    pages = json.loads(subprocess.check_output(['gh', 'api',
        'repos/yigini/soilfer-lims/issues/162/comments?since=' + review['created_at'] + '&per_page=100',
        '--paginate', '--slurp'], encoding='utf-8'))
    later = [row for page in pages for row in page if row['created_at'] > review['created_at']]
    assert not any(any(token in row['body'].lower() for token in
        ['source review: failed', 'source review: changes required', 'audit failed']) for row in later)
    app = github('repos/yigini/soilfer-lims/issues/comments/' + str(AUDIT_REVIEW_ID))
    require_pr_review(app)
    pr = github('repos/yigini/soilfer-lims/pulls/294')
    assert pr['merged'] and pr['head']['sha'] == AUDITED_PR_HEAD and pr['merge_commit_sha'] == CANDIDATE_HEAD
    assert github('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == CANDIDATE_HEAD
    merged = github('repos/yigini/soilfer-lims/git/commits/' + CANDIDATE_HEAD)
    audited = github('repos/yigini/soilfer-lims/git/commits/' + AUDITED_PR_HEAD)
    validate_merge_identity(merged, audited)
    ci = github('repos/yigini/soilfer-lims/actions/runs/38256676268')
    assert ci['head_sha'] == CANDIDATE_HEAD and ci['name'] == 'CI' and ci['event'] == 'push'
    assert ci['status'] != 'completed' or ci['conclusion'] == 'success'
    evidence = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'status': 'ACTUAL_EXACT_PR294_PROOF_BUILD_SOURCE_PASS_VERIFIED',
        'review': review, 'sourceIndex': index, 'applicationReview': app,
        'mergedCommit': merged, 'auditedCommit': audited, 'mainCi': ci,
        'laterComments': later, 'laterSourceFailure': False, 'productionMutations': 0,
        'productionPackagingApproval': False, 'proofRequiresMainCiSuccess': True}
    data = (json.dumps(evidence, indent=2) + '\n').encode()
    with destination.open('xb') as output:
        output.write(data)
    print(json.dumps({'status': evidence['status'], 'reviewId': review['id'],
        'source': source, 'sha256': hashlib.sha256(data).hexdigest(),
        'files': len(hashes), 'mainCiStatus': ci['status'], 'mainCiConclusion': ci['conclusion']}))

if __name__ == '__main__':
    main()
