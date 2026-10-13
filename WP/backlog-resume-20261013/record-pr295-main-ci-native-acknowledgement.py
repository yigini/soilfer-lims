"""Retain the visually verified single native acknowledgement; never replay."""
import datetime, hashlib, json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
dest=Path(__file__).resolve().parent/'pr295-main-ci-native-acknowledgement'
def command(*args):return subprocess.check_output(args,cwd=root)
assert not (dest/'native-delivery-record.json').exists(), 'Consumed boundary; never replay.'
assert command('git','branch','--show-current').strip()==b'audit/release-eb6de2e8'
assert not command('git','diff','--cached','--name-only').strip()
assert command('git','rev-parse','HEAD').decode().strip().startswith('2b3d9a5b')
text=(dest/'actual-sent.txt').read_text(encoding='utf-8')
for phrase in ['6d750914d8565acdd496767a7dd935811b5a89b2','38409200015','Test Suites: 362 passed, 362 total','Tests:       5508 passed, 5508 total','6148143929']:assert phrase in text
for name,endpoint in [('pr295-current-raw.json','repos/yigini/soilfer-lims/pulls/295'),('main-current-raw.json','repos/yigini/soilfer-lims/git/ref/heads/main'),('main-ci-completed-raw.json','repos/yigini/soilfer-lims/actions/runs/38409200015'),('issue214-answer-raw.json','repos/yigini/soilfer-lims/issues/comments/6148143929')]:
    raw=command('gh','api',endpoint);(dest/name).write_bytes(raw)
record=dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),status='ACTUAL_NATIVE_ACK_DELIVERED_AND_VISUALLY_VERIFIED',
    targetApp='Claude',actualWindowId=3408874,targetProject='LIMS Audit',targetThread='Lab workflow audit and plan',
    deliveredOnce=True,inputActions=['Fresh actual target and empty centre/right composers observed','Right composer focus click and caret observed','Exact literal acknowledgement typed','Draft end inspected, Control+Home then merge/head/CI/totals inspected','Return exactly once','Actual delivered bubble with merge and exact 362/5508 summary, empty composer and Gusting observed'],
    completedMainCi=38409200015,main='6d750914d8565acdd496767a7dd935811b5a89b2',scientificAnswer214=6148143929,
    humanCardsUntouched=True,issue103ApplyGo=False,productionOperations=0,newReleaseKitGate=False,files={})
for p in dest.iterdir():
    data=p.read_bytes();record['files'][p.name]=dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
(dest/'native-delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode('utf-8'))
checkpoint=('## 2026-10-13 PR295 main-CI / #214 direction native acknowledgement complete\n\n'
    'Fresh actual Claude / LIMS Audit / Lab workflow audit and plan was read with both composers empty. Actual final PR295 audit PASS and #214 decisions6148143929 were visually read and independently checked on GitHub. Pip acknowledged the completed single merge6d750914, mainCI38409200015 complete PASS362/5508 and every client/Docker acceptance step, and the actual scientific direction, ONCE. '
    'Right-composer focus/caret, draft end and exact merge/head/CI/totals were inspected before one Return; actual delivered bubble, empty composer and Claudio Gusting were visually verified. Exact actual sent text and current raw GitHub replies are retained at `WP/backlog-resume-20261013/pr295-main-ci-native-acknowledgement/native-delivery-record.json`. Never duplicate this acknowledgement, ready notice, audit request or scientific questions. '
    '#214 source implementation follows retained actual answer6148143929; no release/kit/gate/production operation exists. #206 stays OPEN for actual post-deploy check. Human #103 See first / Approve now remains unanswered, no apply go or production connection; all human drafts/cards untouched.\n\n')
readmes=[root/'WP/audit-release-eb6de2e8/README.md',root/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(checkpoint.encode('utf-8')+p.read_bytes())
paths=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[Path(__file__).relative_to(root).as_posix()]+[p.relative_to(root).as_posix() for p in readmes]
subprocess.check_call(['git','add','-f','--',*paths],cwd=root)
assert set(command('git','diff','--cached','--name-only').decode().splitlines())==set(paths)
for name,detail in record['files'].items():assert hashlib.sha256(command('git','show',':'+(dest/name).relative_to(root).as_posix())).hexdigest()==detail['sha256']
print(json.dumps({k:v for k,v in record.items() if k!='files'},indent=2))
