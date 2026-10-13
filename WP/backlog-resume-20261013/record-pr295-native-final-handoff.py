"""Record the visually verified actual native handoff once, without sending again."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root=Path(__file__).resolve().parents[2]
work=Path(__file__).resolve().parent
destination=work/'pr295-final-audit-request-1a070'
record_path=destination/'native-delivery-record.json'
assert not record_path.exists(), 'Native boundary already retained; never replay.'
sent=(destination/'native-handoff-actual-sent.txt').read_bytes()
assert b'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a' in sent
assert b'6146853088' in sent and b'Tests:       5508 passed, 5508 total' in sent
pr_bytes=subprocess.check_output(['gh','pr','view','295','--repo','yigini/soilfer-lims','--json',
    'state,headRefOid,baseRefOid,comments,labels,closingIssuesReferences'],cwd=root)
pr=json.loads(pr_bytes)
assert pr['headRefOid']=='1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a'
assert pr['state']=='OPEN' and pr['closingIssuesReferences']==[]
(destination/'pr-after-native-raw.json').write_bytes(pr_bytes)
record=dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    target='Claude / LIMS Audit / Lab workflow audit and plan',windowId=3408874,
    sourceHead=pr['headRefOid'],readyForAuditComment=6146853088,
    nativeFinalHandoff='DELIVERED_ONCE_VISUALLY_VERIFIED',
    beforeSend='Fresh actual returned window/right thread, both empty composers, explicit right-composer click and fresh caret; draft end then exact head/tree/base/Jest totals inspected before Return',
    afterSend='Actual sent bubble shows correct head/tree/base/CI and Jest totals; right composer empty; Claudio Forming response visible',
    humanDraftsAnd103Card='UNTOUCHED; See first / Approve now remains unanswered',
    actualFinalAuditPass=False,productionMutations=0,
    sentFile=dict(name='native-handoff-actual-sent.txt',bytes=len(sent),sha256=hashlib.sha256(sent).hexdigest()),
    prApi=dict(name='pr-after-native-raw.json',bytes=len(pr_bytes),sha256=hashlib.sha256(pr_bytes).hexdigest()))
record_path.write_bytes((json.dumps(record,indent=2)+'\n').encode('utf-8'))
prefix='''# #206 PR295 final audit requested; actual Claudio verdict pending — 2026-10-13

Exact source-only head remains `1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a` / PR295, base `959d17e11c357266f7c2a41b0c84ab76914c591e`. Full ordinary CI38400174689 is SUCCESS (362/362 suites, 5508/5508 tests, zero failures/skips/pending; actual candidate/baseline Docker builds and boundary/readiness acceptance PASS). All closed raw logs/API/archive/hash evidence is pushed at `79daa45c13d831345727fd1ea75734231bfad19f`, including independent Git-blob hash verification. The full current PR description quotes the exact final Jest summary and links that immutable evidence.

The ready-for-audit label and [comment6146853088](https://github.com/yigini/soilfer-lims/pull/295#issuecomment-6146853088) were posted ONCE at 13:38:58 UTC. Final native handoff was then delivered ONCE and visually verified after fresh actual target/empty composer/focus and inspection of the draft's exact head/tree/base/totals. Claudio's response was forming; no final exact-head verdict exists yet. Actual delivered text and raw API/hash record: `WP/backlog-resume-20261013/pr295-final-audit-request-1a070/native-delivery-record.json`. Earlier prepared `native-handoff.txt` remains its immutable preparation artifact; `native-handoff-actual-sent.txt` is the exact readable text actually delivered. Never repeat any ready-for-audit notice, scope acknowledgement or final handoff. Consumed helpers `handoff-pr295-ci38400174689-once.py`, `prepare-ci38400174689-pass-notes.py` and `record-pr295-native-final-handoff.py` must never be rerun.

Observe the actual Claudio exact-head audit verdict; merge only after PASS for this current head and fresh live main/base/CI checks. No source push after CI, no merge, new release/kit/gate or production operation. #206 stays OPEN (`closingIssuesReferences=[]`) until Claudio's own actual post-deploy closure. #103 human See first / Approve now card and all human drafts/files are untouched. Same writer/worktree/branch; all failed/incomplete runs and completed release evidence/notices remain immutable. Coordination ACTIVE and quiet unchanged/non-actionable.

---

'''
paths=[str(p.relative_to(root)).replace('\\','/') for p in [record_path,destination/'native-handoff-actual-sent.txt',destination/'pr-after-native-raw.json',Path(__file__)]]
for rel in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
    path=root/rel
    old=path.read_text(encoding='utf-8')
    assert prefix.splitlines()[0] not in old
    path.write_bytes((prefix+old).encode('utf-8'))
    paths.append(rel)
subprocess.check_call(['git','add','-f','--',*paths],cwd=root)
staged=subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).decode().splitlines()
assert all(p.startswith('WP/backlog-resume-20261013/pr295-final-audit-request-1a070/') or
    p in paths or p=='WP/backlog-resume-20261013/handoff-pr295-ci38400174689-once.py' for p in staged)
for name,pin in [('native-handoff-actual-sent.txt',record['sentFile']),('pr-after-native-raw.json',record['prApi'])]:
    rel=str((destination/name).relative_to(root)).replace('\\','/')
    assert hashlib.sha256(subprocess.check_output(['git','show',':'+rel],cwd=root)).hexdigest()==pin['sha256']
print(json.dumps(record,indent=2))
