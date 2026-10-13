"""Retain the actual exact-head verdict once. Read-only GitHub; no application writes."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
dest = work / 'pr295-actual-audit-pass-6146939836'
head = '1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a'
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
tree = '85350d14bdff5a607a3d2edc9615785842c9c94b'

def command(*args):
    return subprocess.check_output(args, cwd=root)

assert not dest.exists(), 'Consumed boundary: never replay.'
assert command('git', 'branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not command('git', 'diff', '--cached', '--name-only').strip()
audit = command('git', 'rev-parse', 'HEAD').decode().strip()
assert audit == 'c5a3d17041887b429d2a0dbc87211d57d8a47043'
assert command('git', 'ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
dest.mkdir()

def retain(name, *args):
    raw = command('gh', *args)
    (dest / name).write_bytes(raw)
    return json.loads(raw)

verdict = retain('actual-verdict-raw.json', 'api', 'repos/yigini/soilfer-lims/issues/comments/6146939836')
assert verdict['body'].startswith('Audit passed: OK to merge and deploy\n')
assert head in verdict['body'] and 'Audit by Claudio, for #206.' in verdict['body']
assert verdict['performed_via_github_app']['slug'] == 'claude'
assert verdict['created_at'] == verdict['updated_at'] == '2026-10-13T13:43:23Z'
pr = retain('pr-before-raw.json', 'api', 'repos/yigini/soilfer-lims/pulls/295')
assert pr['state'] == 'open' and not pr['merged']
assert pr['head']['sha'] == head and pr['base']['sha'] == base and pr['base']['ref'] == 'main'
assert pr['mergeable'] is True and pr['mergeable_state'] == 'clean'
main = retain('main-before-raw.json', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha'] == base
source = retain('source-commit-raw.json', 'api', 'repos/yigini/soilfer-lims/git/commits/' + head)
assert source['tree']['sha'] == tree
run = retain('ci-run-raw.json', 'api', 'repos/yigini/soilfer-lims/actions/runs/38400174689')
assert run['status'] == 'completed' and run['conclusion'] == 'success'
assert run['head_sha'] == head and run['run_attempt'] == 1 and run['event'] == 'pull_request'
checks = retain('checks-raw.json', 'api', 'repos/yigini/soilfer-lims/commits/' + head + '/check-runs')
assert checks['check_runs'] and all(c['status'] == 'completed' and c['conclusion'] in ('success', 'neutral', 'skipped') for c in checks['check_runs'])
assert any(c['name'] == 'Test & Build' and c['conclusion'] == 'success' for c in checks['check_runs'])
view = retain('closing-references-raw.json', 'pr', 'view', '295', '--repo', 'yigini/soilfer-lims', '--json', 'headRefOid,baseRefOid,state,closingIssuesReferences')
assert view['headRefOid'] == head and view['baseRefOid'] == base and view['closingIssuesReferences'] == []
issue = retain('issue-206-before-raw.json', 'api', 'repos/yigini/soilfer-lims/issues/206')
assert issue['state'] == 'open'
pin = json.loads((work / 'ci-38400174689-completed-success/index.json').read_text(encoding='utf-8'))
for name, details in pin['files'].items():
    rel = 'WP/backlog-resume-20261013/ci-38400174689-completed-success/' + name
    assert hashlib.sha256(command('git', 'show', '79daa45c13d831345727fd1ea75734231bfad19f:' + rel)).hexdigest() == details['sha256']
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), status='ACTUAL_EXACT_HEAD_AUDIT_PASS',
    pr=295, issue=206, head=head, tree=tree, base=base, auditCommentId=verdict['id'], auditCommentUrl=verdict['html_url'],
    auditCommentCreatedAt=verdict['created_at'], ci=38400174689, ciConclusion='success', mergePerformed=False,
    productionOperations=0, previousRawCiGitBlobHashesVerified=len(pin['files']),
    nativeBoundary='Fresh actual Claude window showed Soil Museum / GitHub issues triage and a human right-composer draft. Zero input; draft preserved. No native acknowledgement sent.', files={})
for path in dest.iterdir():
    data = path.read_bytes()
    record['files'][path.name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
(dest / 'index.json').write_bytes((json.dumps(record, indent=2) + '\n').encode('utf-8'))
paths = [p.relative_to(root).as_posix() for p in dest.iterdir()] + [Path(__file__).relative_to(root).as_posix()]
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
assert set(command('git', 'diff', '--cached', '--name-only').decode().splitlines()) == set(paths)
for name, details in record['files'].items():
    assert hashlib.sha256(command('git', 'show', ':' + (dest / name).relative_to(root).as_posix())).hexdigest() == details['sha256']
print(json.dumps({k:v for k,v in record.items() if k != 'files'}, indent=2))
