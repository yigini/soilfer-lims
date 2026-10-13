"""Retain the single investigated source successor and its active CI metadata once."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root=Path(__file__).resolve().parents[2]
evidence=Path(__file__).resolve().parent
destination=evidence/'ci-38400174689-open-boundary.json'
assert not destination.exists()
head='1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a'
def gh(*args):
    return subprocess.check_output(['gh',*args],cwd=root)
raw_run=gh('api','repos/yigini/soilfer-lims/actions/runs/38400174689')
raw_jobs=gh('api','repos/yigini/soilfer-lims/actions/runs/38400174689/jobs?per_page=100')
raw_pr=gh('pr','view','295','--repo','yigini/soilfer-lims','--json',
          'state,headRefOid,baseRefOid,closingIssuesReferences,labels,comments,body')
run,jobs,pr=map(json.loads,(raw_run,raw_jobs,raw_pr))
assert run['status']!='completed', 'Inspect a terminal result before recording an active snapshot.'
assert run['head_sha']==pr['headRefOid']==head
assert run['run_attempt']==1 and pr['state']=='OPEN' and pr['closingIssuesReferences']==[]
assert pr['labels']==[] and pr['comments']==[]
assert subprocess.check_output(['git','rev-parse','codex/issue-206-containers'],cwd=root).decode().strip()==head
assert subprocess.check_output(['git','diff','--name-only','9ae02f6ab7651d2ca887a98722f6a20ace3cc471',head],cwd=root).strip()==b'server/package.json'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).strip()
files={}
for name,data in [('ci-38400174689-initial-run-raw.json',raw_run),
                  ('ci-38400174689-initial-jobs-raw.json',raw_jobs),
                  ('pr-295-harness-head-initial-raw.json',raw_pr)]:
    path=evidence/name
    assert not path.exists()
    path.write_bytes(data)
    files[name]=dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
record=dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    reviewHead=head,base=pr['baseRefOid'],pr=295,ciRun=38400174689,ciStatus=run['status'],
    ciConclusion=run['conclusion'],runAttempt=1,activeMetadataOnly=True,
    completeCIVerdict=False,readyForAudit=False,finalNativeHandoff=False,
    exactHeadAuditPass=False,failedPriorCI=38393187129,
    scopeComment=6145765510,localFocused='8 suites / 232 tests PASS',
    fullDiscoveredInventory=362,requiredNewFullTests=5508,
    sourceOnlyDelta=['server/package.json'],prior51SourcePathsUnchanged=True,
    configSetupAssertionsCIHeapUnchanged=True,automaticClosingReferences=[],
    productionMutations=0,newWorktrees=0,files=files)
destination.write_bytes((json.dumps(record,indent=2)+'\n').encode())
prefix=f'''# #206 PR295 approved test-script correction; fresh CI pending — 2026-10-13

PR295 is OPEN at source-only head `{head}`, base `959d17e11c357266f7c2a41b0c84ab76914c591e`. Actual Claudio scope acceptance [#206/6145765510](https://github.com/yigini/soilfer-lims/issues/206#issuecomment-6145765510), also visually read in the native thread, permits only the server test-script correction in this same PR. The sole change from prior `9ae02f6a` is `scripts.test`: `jest --maxWorkers=1 --workerIdleMemoryLimit=512MB`. All 51 previous source paths, stock assertions, Jest config/discovery/setup/teardown/timeouts, and existing CI 8192 MB heap are unchanged; no GC hooks or production settings changed.

Closed local ordinary-`npm test` verification PASS at 12:47:47 UTC: 8 focused suites / 232 tests, zero failures or pending, one serial recyclable worker, default heap/blank NODE_OPTIONS, both ordinary setup files, and full discovery equal to the same 362-suite inventory. The local visible-storage fixture serves byte-identical assets and disposable uploads; standard CI uses no path fixture. Raw configuration, inventory, report/logs, native/GitHub scope and hashes are pushed at audit `30243a81` (`issue-206-harness-verification-retention.json`). Original PR body remains immutable, and the current PR description explicitly records the harness correction and failed CI reason.

ONE fresh real CI [38400174689](https://github.com/yigini/soilfer-lims/actions/runs/38400174689), created 12:49:34 UTC on the pushed new head, is {run['status']}. Observe this same run. The prior `38393187129` remains FAILED/incomplete and retained, never replayed; its heap-exhaustion cause was investigated before this single source successor. Current active API snapshots/hashes: `ci-38400174689-open-boundary.json`; they are not complete CI logs or a terminal verdict. Require the final Jest summary of all 362 suites / 5,508 tests without skips, both real candidate/baseline Docker builds, Docker boundary/readiness acceptance, then one ready-for-audit notice and final new-head native handoff. Claudio's fresh exact-head audit PASS is still required before merge. `closingIssuesReferences=[]`; #206 stays open for actual post-deploy closure. No local runner, new release/kit/gate/production writer or mutation exists. Human drafts/#103 card remain untouched; all historical release and failed-run evidence stays retained.

---

'''.encode()
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path=root/relative
    path.write_bytes(prefix+path.read_bytes())
paths=['WP/backlog-resume-20261013/'+name for name in files]
paths += [str(destination.relative_to(root)).replace('\\','/'),
          str(Path(__file__).relative_to(root)).replace('\\','/'),*readmes]
subprocess.check_call(['git','add','-f','--',*paths],cwd=root)
for name,pin in files.items():
    blob=subprocess.check_output(['git','show',':WP/backlog-resume-20261013/'+name],cwd=root)
    assert hashlib.sha256(blob).hexdigest()==pin['sha256']
assert set(subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).decode().splitlines())==set(paths)
subprocess.check_call(['git','commit','-m','docs(206): bind approved harness head to its single fresh CI'],cwd=root)
subprocess.check_call(['git','push','origin','audit/release-eb6de2e8'],cwd=root)
print(json.dumps({key:value for key,value in record.items() if key!='files'},indent=2))
