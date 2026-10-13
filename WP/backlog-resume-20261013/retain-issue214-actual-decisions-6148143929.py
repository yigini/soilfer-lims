"""Retain the actual scientific direction once; never replay this boundary."""
import datetime, hashlib, json, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
dest = Path(__file__).resolve().parent / 'issue214-actual-decisions-6148143929'
def command(*args):
    return subprocess.check_output(args, cwd=root)
assert not dest.exists(), 'Consumed boundary; never replay.'
assert command('git', 'branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert command('git', 'rev-parse', 'HEAD').decode().strip() == '12ee7c361ae5b63f80c3c1273fe0390fbc1387e6'
assert not command('git', 'diff', '--cached', '--name-only').strip()
dest.mkdir()
def retain(name, endpoint):
    raw = command('gh', 'api', endpoint)
    (dest / name).write_bytes(raw)
    return json.loads(raw)
answer = retain('answer-original-raw.json', 'repos/yigini/soilfer-lims/issues/comments/6148143929')
assert answer['performed_via_github_app']['slug'] == 'claude'
assert answer['created_at'] == '2026-10-13T14:42:18Z'
assert answer['body'].startswith("#214 decisions (Claudio, under YY's delegation recorded at #162/6141144901).")
for phrase in ['R-4s is within one run only', 'Arithmetic mean and sample SD', 'The approver must not be the proposer', 'Add a third set', 'review: []', 'A corrected value replaces the original']:
    assert phrase in answer['body'], phrase
(dest / 'actual-decisions.txt').write_bytes((answer['body'] + '\n').encode('utf-8'))
retain('issue214-current-raw.json', 'repos/yigini/soilfer-lims/issues/214')
retain('question-original-raw.json', 'repos/yigini/soilfer-lims/issues/comments/6147255466')
main = retain('main-current-raw.json', 'repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha'] == '6d750914d8565acdd496767a7dd935811b5a89b2'
pr = retain('pr295-current-raw.json', 'repos/yigini/soilfer-lims/pulls/295')
assert pr['merged'] is True
ci = retain('main-ci-completed-raw.json', 'repos/yigini/soilfer-lims/actions/runs/38409200015')
assert ci['status'] == 'completed' and ci['conclusion'] == 'success' and ci['run_attempt'] == 1
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), status='ACTUAL_CLAUDIO_SCIENTIFIC_DIRECTION_RECEIVED',
    issue=214, question=6147255466, answer=6148143929, actualAnswerUtc=answer['created_at'], authority='YY delegation #162/6141144901; Claude GitHub app',
    nativeObservation='Fresh actual LIMS Audit / Lab workflow audit and plan showed the posted decisions and empty centre/right composers; human #103 See first/Approve now remains unanswered.',
    series=['labId','analysisCode','methodologyId','referenceMaterialId (lot)'],
    order=['recorded run execution time','QC position sequence index','QcMeasurement id'],
    limits='One approved set or provisional fixed window; reset only on approved-set change, provisional/charted switch, lot or methodology change.',
    rules='R-4s within run; 2-2s/4-1s/10x consecutive observations across runs; QC_FAIL history retained; correction replaces original; ambiguous order stable 4xx.',
    baseline='Frozen effective passing/non-invalidated/non-superseded values, arithmetic mean/sample SD n-1; deliberate exclusion reasons; minimum via frozen policy; different named approver.',
    permissions='APPROVE_CONTROL_LIMITS: LAB_MANAGER, SUPER_ADMIN, MASTER_USER; no new QA role.',
    review='Separate lab-scoped evaluation/rule-idempotent obligation; permission holders; append-only no action or investigate/new limits proposed resolution; no verdict/release block.',
    policy='Third reject/warn/review set explicitly authorized. Strict review [4-1s,10x], others []; mutually exclusive; missing review on stored overrides means []; zero policy backfill.',
    applicationImplementationStarted=False, productionOperations=0, issue103ApplyGo=False, files={})
for p in dest.iterdir():
    raw=p.read_bytes();record['files'][p.name]=dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode('utf-8'))
checkpoint = ('## 2026-10-13 #214 actual scientific direction received\n\n'
    'Actual Claudio [answer6148143929](https://github.com/yigini/soilfer-lims/issues/214#issuecomment-6148143929), posted14:42:18UTC under YY delegation, resolves the four questions6147255466. Full original raw answer and immutable readable text are retained at `WP/backlog-resume-20261013/issue214-actual-decisions-6148143929/index.json`. '
    'It explicitly authorizes a third Westgard review policy set, Strict review4-1s/10x, other presets[], and missing review on stored overrides means[] without backfill; permission APPROVE_CONTROL_LIMITS belongs to existing lab-manager/super-admin/master-user roles. R-4s stays within run; sequence rules cross runs with recorded execution-time/position-index/measurement-id order, stable ambiguity refusal, QC_FAIL retained, frozen corrections and limit-basis resets. '
    'Baseline proposal uses arithmetic mean/sample SD n-1, deliberate exclusions with reasons and frozen policy minimum, a different named approver, retained superseded limits and immutable past evaluations. Separate idempotent lab-scoped review obligations have append-only outcomes and never change verdict or block release. No #214 source implementation at this retention boundary. '
    'Main CI38409200015 is complete PASS (362/5508, all client/Docker acceptance); PR295 merge and audit remain complete. No release/kit/gate/production operation; #206 OPEN. Native direction read with empty composers and human #103 card untouched; no #103 apply go. Never repeat questions, completed notices or consumed helpers.\n\n')
readmes=[root/'WP/audit-release-eb6de2e8/README.md',root/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(checkpoint.encode('utf-8')+p.read_bytes())
paths=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[Path(__file__).relative_to(root).as_posix()]+[p.relative_to(root).as_posix() for p in readmes]
subprocess.check_call(['git','add','-f','--',*paths],cwd=root)
assert set(command('git','diff','--cached','--name-only').decode().splitlines())==set(paths)
for name,detail in record['files'].items():assert hashlib.sha256(command('git','show',':'+(dest/name).relative_to(root).as_posix())).hexdigest()==detail['sha256']
print(json.dumps({k:v for k,v in record.items() if k!='files'},indent=2))
