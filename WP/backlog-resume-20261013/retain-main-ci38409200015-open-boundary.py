"""Retain one live metadata boundary, not active logs or a completion verdict."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
dest = work / 'main-ci38409200015-open-boundary'
assert not dest.exists(), 'Boundary already consumed.'

def command(*args):
    return subprocess.check_output(args, cwd=root)

assert command('git', 'branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not command('git', 'diff', '--cached', '--name-only').strip()
audit = command('git', 'rev-parse', 'HEAD').decode().strip()
assert audit.startswith('b224462b')
assert command('git', 'ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
dest.mkdir()

def retain(name, endpoint):
    raw = command('gh', 'api', endpoint)
    (dest / name).write_bytes(raw)
    return json.loads(raw)

run = retain('run-current-raw.json', 'repos/yigini/soilfer-lims/actions/runs/38409200015')
assert run['head_sha'] == '6d750914d8565acdd496767a7dd935811b5a89b2' and run['event'] == 'push' and run['run_attempt'] == 1
assert run['status'] in ('queued', 'in_progress') and run['conclusion'] is None, 'Completion is a separate boundary.'
jobs = retain('jobs-current-raw.json', 'repos/yigini/soilfer-lims/actions/runs/38409200015/jobs?per_page=100')
main = retain('main-current-raw.json', 'repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha'] == run['head_sha']
pr = retain('pr295-current-raw.json', 'repos/yigini/soilfer-lims/pulls/295')
assert pr['merged'] is True and pr['merge_commit_sha'] == run['head_sha']
issue = retain('issue206-current-raw.json', 'repos/yigini/soilfer-lims/issues/206')
assert issue['state'] == 'open'
questions = retain('issue214-questions-current-raw.json', 'repos/yigini/soilfer-lims/issues/comments/6147255466')
assert questions['created_at'] == questions['updated_at'] == '2026-10-13T13:58:58Z'
raw = command('gh', 'api', '--paginate', '--slurp', 'repos/yigini/soilfer-lims/issues/214/comments?per_page=100')
(dest / 'issue214-comments-current-raw.json').write_bytes(raw)
pages = json.loads(raw)
assert pages[-1][-1]['id'] == 6147255466, 'New Claudio direction needs its own retained boundary.'
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), status='OPEN_MAIN_CI_BOUNDARY_NOT_COMPLETION',
    main=run['head_sha'], ci=run['id'], ciUrl=run['html_url'], ciStatus=run['status'], ciConclusion=None,
    activeLogsCollected=False, completedVerdict=False, issue206State='open',
    issue214QuestionsComment=6147255466, issue214AwaitingClaudio=True, sourceImplementationStarted=False,
    noProductionOperation=True, nativeAcknowledgementSent=False, humanDraftsAndCardsUntouched=True, files={})
for path in dest.iterdir():
    data = path.read_bytes()
    record['files'][path.name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
(dest / 'index.json').write_bytes((json.dumps(record, indent=2) + '\n').encode('utf-8'))
checkpoint = ('## 2026-10-13 current backlog coordination boundary\n\n'
    'PR295 is actually merged at `' + run['head_sha'] + '` after Claudio exact-head PASS/6146939836; merged tree and parents were independently verified and pushed at `ae9b6049`. '
    'Observe the one actual main push CI [38409200015](' + run['html_url'] + '), attempt 1, currently ' + run['status'] + '. Only raw metadata is retained in `WP/backlog-resume-20261013/main-ci38409200015-open-boundary/index.json`; no active logs or completion claim. '
    '#214 design questions [6147255466](https://github.com/yigini/soilfer-lims/issues/214#issuecomment-6147255466) were posted once and pushed at `b224462b`; actual Claudio scientific/data-model answers are pending before source implementation. '
    'Native merge acknowledgement is unsent because the fresh actual Claude window contained a human draft in another chat. Preserve human activity; at the next meaningful boundary use fresh target/focus/draft observations before any native input. '
    'No new release, kit, gate or production operation. #206 remains OPEN for actual post-deploy closure; #103 has no production connection or apply go. '
    'Consumed new verdict-retainer, merge, #214 question and open-boundary helpers must never rerun. Completed notices/handoffs remain once only.\n\n')
readmes = [root / 'WP/audit-release-eb6de2e8/README.md', root / 'WP/runtime-recovery-kobo/README.md']
for path in readmes:
    path.write_bytes(checkpoint.encode('utf-8') + path.read_bytes())
paths = [p.relative_to(root).as_posix() for p in dest.iterdir()] + [Path(__file__).relative_to(root).as_posix()] + [p.relative_to(root).as_posix() for p in readmes]
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
assert set(command('git', 'diff', '--cached', '--name-only').decode().splitlines()) == set(paths)
for name, detail in record['files'].items():
    assert hashlib.sha256(command('git', 'show', ':' + (dest / name).relative_to(root).as_posix())).hexdigest() == detail['sha256']
print(json.dumps({k:v for k,v in record.items() if k != 'files'}, indent=2))
