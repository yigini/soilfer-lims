"""Validate and retain the actual exact-source approval; no host operations."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
EXPORT = ROOT / 'proof-source-export-f5e59428'
sys.path.insert(0, str(EXPORT))
from import_proof_contract import source_review_pass, require_pr_review, validate_merge_identity
from import_source_graph import git_source, require_executed_sources


def github(endpoint):
    return json.loads(subprocess.check_output(['gh', 'api', endpoint], encoding='utf-8'))


def main():
    source = 'f5e59428c1bbf19247db2555f5158bc3a2ac5fad'
    raw, index = git_source(source, lambda *args: subprocess.check_output(['git', *args]))
    hashes = {name: row['sha256'] for name, row in index['files'].items()}
    require_executed_sources(hashes, EXPORT / 'prepare_import_build.py')
    assert all((EXPORT / name).read_bytes() == value for name, value in raw.items())
    review = github('repos/yigini/soilfer-lims/issues/comments/6122670828')
    source_review_pass(review, source, hashes)
    comments = github('repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-12T10:43:17Z&per_page=100')
    assert not any(any(token in row['body'].lower() for token in
        ['source review: failed', 'source review: changes required', 'audit failed']) and
        row['created_at'] > review['created_at'] for row in comments)
    app = github('repos/yigini/soilfer-lims/issues/comments/6121933894')
    require_pr_review(app)
    current = github('repos/yigini/soilfer-lims/git/ref/heads/main')
    assert current['object']['sha'] == '5dd5488d138514351fffd54d0b0232ae19fcb64d'
    merged = github('repos/yigini/soilfer-lims/git/commits/' + current['object']['sha'])
    audited = github('repos/yigini/soilfer-lims/git/commits/c26591698c1e974a3bf771e5c333578755aef315')
    validate_merge_identity(merged, audited)
    ci = github('repos/yigini/soilfer-lims/actions/runs/38233444989')
    assert ci['head_sha'] == current['object']['sha'] and ci['status'] == 'completed' and ci['conclusion'] == 'success'
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    evidence = {'observedUtc': now, 'status': 'ACTUAL_EXACT_PROOF_BUILD_SOURCE_PASS_VERIFIED',
        'review': review, 'sourceIndex': index, 'applicationReview': app, 'mainCi': ci,
        'mergedCommit': merged, 'auditedCommit': audited, 'laterSourceFailure': False,
        'productionMutations': 0, 'productionPackagingApproval': False}
    data = (json.dumps(evidence, indent=2) + '\n').encode()
    with (ROOT / 'source-pass-6122670828.json').open('xb') as output:
        output.write(data)
    print(json.dumps({'status': evidence['status'], 'reviewId': review['id'],
        'observedUtc': now, 'source': source, 'sha256': hashlib.sha256(data).hexdigest(),
        'mainCi': ci['conclusion'], 'files': len(hashes)}))


if __name__ == '__main__':
    main()
