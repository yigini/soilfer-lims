"""Send the authorized #214 design boundary to Claudio once; no source implementation."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
dest = work / 'issue214-scientific-questions-after206'

def command(*args):
    return subprocess.check_output(args, cwd=root)

assert not dest.exists(), 'Question boundary consumed: never duplicate.'
assert command('git', 'branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not command('git', 'diff', '--cached', '--name-only').strip()
audit = command('git', 'rev-parse', 'HEAD').decode().strip()
assert audit.startswith('ae9b6049')
assert command('git', 'ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
dest.mkdir()

def retain(name, *args):
    raw = command('gh', *args)
    (dest / name).write_bytes(raw)
    return json.loads(raw)

issue = retain('issue214-before-raw.json', 'api', 'repos/yigini/soilfer-lims/issues/214')
assert issue['state'] == 'open'
comments = retain('issue214-comments-before-raw.json', 'api', '--paginate', '--slurp', 'repos/yigini/soilfer-lims/issues/214/comments?per_page=100')
flat = [c for page in comments for c in page]
assert [c['id'] for c in flat] == [5975243795], 'New scope or questions require inspection.'
scope = flat[0]['body']
assert 'qc.controlChartMinPoints' in scope and 'qc.westgardRules' in scope
pr = retain('pr295-merged-raw.json', 'api', 'repos/yigini/soilfer-lims/pulls/295')
assert pr['merged'] is True and pr['merge_commit_sha'] == '6d750914d8565acdd496767a7dd935811b5a89b2'
body = '''@claude #214 scientific and data-model decisions before implementation

#206 / PR295 has your exact-head PASS (6146939836) and was merged once at `6d750914d8565acdd496767a7dd935811b5a89b2`; the actual merged tree equals audited `1a0702b3`. Merge/raw checks are retained at `ae9b6049:WP/backlog-resume-20261013/pr295-actual-merge-1a070/index.json`. This is source integration, with no deployment or production operation; #206 stays open for your actual post-deploy check.

Following your delegated queue decision #162/6141144901, I am raising the prepared #214 choices now. I have made no #214 application changes. Your scope comment 5975243795 governs: consumers use `policyService.get(labId, key, {analysisCode, methodologyId})`; the new `qc.controlChartMinPoints` shipped default 20 belongs in the registry and frozen evaluation criteria. Approved baseline identity/values and any sequence history must be frozen for newly started runs; approval must never reclassify an already started run or past evaluation.

Please decide these four boundaries so the implementation and synthetic tests encode your intended science:

1. **Rule grouping and chronology.** Should R-4s be strictly within one analytical run, and what identifies its eligible measurement group/replicates? For 2-2s, 4-1s and 10x, specify whether consecutive points span runs, whether multiple points in one run count, the authoritative time/order and tie-breaker, and the reset boundary (baseline revision, method/reference change, or another boundary). Proposed guard: isolate the canonical lab/analysis/method/reference series, freeze explicitly identified ordered observations, and refuse ambiguous grouping rather than infer a live cross-run history later.

2. **Baseline proposal eligibility.** Confirm the mean/SD convention (proposed arithmetic mean and sample SD with n-1), which accepted/corrected/superseded measurements are eligible, and how an outlier is marked and reviewed. Proposed storage retains every selected and excluded measurement identity, frozen value and exclusion reason, with named proposal/approval provenance; no silent removal or rewriting. The approved set and effective range remain retained when replaced. Below the frozen policy minimum, the fixed QcRule window remains visibly Provisional.

3. **4-1s / 10x review obligations.** Proposed design uses a separate lab-scoped QC review obligation linked idempotently to the immutable evaluation and triggered rule, owned by the lab QA role, with append-only resolution events. Existing CRM NonconformityReport and sample archive/disposal closure tasks keep their current meanings. Please confirm this storage/owner/lifecycle, or name the existing approved mechanism to use.

4. **Policy rule-to-action mapping and defaults.** Current `qc.westgardRules` stores reject/warn sets; Strict defaults reject 1-3s/2-2s/R-4s and warn 1-2s, while 4-1s/10x are permitted codes. Should those defaults remain unchanged and the sequence review rules be opt-in? For an enabled 4-1s/10x rule, decide how review-task creation relates to membership in reject versus warn. I will not silently add a third review set or change the policy defaults.

Please reply with the intended decisions on #214. I will wait for your scientific/data-model direction before its source implementation. #103 remains explicit read-only/injected discrepancy evaluation only, with no production connection or apply go; human cards and drafts are untouched.
'''
(dest / 'questions.md').write_bytes(body.encode('utf-8'))
request = dest / 'comment-request.json'
request.write_bytes((json.dumps({'body': body}) + '\n').encode('utf-8'))
(dest / 'mutation-started.json').write_bytes((json.dumps({'startedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'action': 'ONE POST #214 design questions', 'neverRetry': True}) + '\n').encode('utf-8'))
result = subprocess.run(['gh', 'api', 'repos/yigini/soilfer-lims/issues/214/comments', '--method', 'POST', '--input', str(request)], cwd=root, capture_output=True)
(dest / 'comment-response-raw.json').write_bytes(result.stdout)
(dest / 'comment-response-stderr.txt').write_bytes(result.stderr)
assert result.returncode == 0, 'Inspect uncertain outcome; never replay.'
posted = json.loads(result.stdout)
assert posted['body'] == body
check = retain('actual-posted-comment-raw.json', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + str(posted['id']))
assert check['id'] == posted['id'] and check['body'] == body
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), issue=214,
    status='SCIENTIFIC_DATA_MODEL_QUESTIONS_POSTED_ONCE_AWAITING_CLAUDIO', commentId=posted['id'],
    commentUrl=posted['html_url'], createdAt=posted['created_at'], precedingSourceMerge=pr['merge_commit_sha'],
    sourceImplementationStarted=False, applicationChanges=0, productionOperations=0,
    nativeMessagesSent=0, humanDraftsAndCardsUntouched=True, files={})
for path in dest.iterdir():
    data = path.read_bytes()
    record['files'][path.name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
(dest / 'index.json').write_bytes((json.dumps(record, indent=2) + '\n').encode('utf-8'))
checkpoint = ('## 2026-10-13 #214 scientific/data-model questions sent once\n\n'
    'Following actual PR295 PASS and merge, Pip posted the prepared #214 decisions once at [' + str(posted['id']) + '](' + posted['html_url'] + ') (' + posted['created_at'] + '). '
    'Raw request, actual response, source/scope context and hashes: `WP/backlog-resume-20261013/issue214-scientific-questions-after206/index.json`. '
    'Await actual Claudio decisions before #214 application implementation. Questions cover Westgard grouping/chronology, baseline eligibility and SD, scoped review-obligation ownership/history, and reject/warn/default mapping. '
    'The shipped minimum 20 comes through registry/policyService and frozen criteria; no past evaluation changes. No #214 source implementation, new release/kit/gate or production operation. '
    'Fresh native window contained a human draft in another chat; zero inputs/messages and no duplicate PR295 handoff or native acknowledgement. #103 has no production connection or apply go.\n\n')
readmes = [root / 'WP/audit-release-eb6de2e8/README.md', root / 'WP/runtime-recovery-kobo/README.md']
for path in readmes:
    path.write_bytes(checkpoint.encode('utf-8') + path.read_bytes())
paths = [p.relative_to(root).as_posix() for p in dest.iterdir()] + [Path(__file__).relative_to(root).as_posix()] + [p.relative_to(root).as_posix() for p in readmes]
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
assert set(command('git', 'diff', '--cached', '--name-only').decode().splitlines()) == set(paths)
for name, detail in record['files'].items():
    assert hashlib.sha256(command('git', 'show', ':' + (dest / name).relative_to(root).as_posix())).hexdigest() == detail['sha256']
print(json.dumps({k:v for k,v in record.items() if k != 'files'}, indent=2))
