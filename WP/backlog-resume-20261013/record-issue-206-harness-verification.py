"""Retain closed verification, update the PR description, then push its one successor."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
destination = evidence / 'issue-206-harness-verification-retention.json'
assert not destination.exists()
source = json.loads((evidence/'issue-206-harness-review-ref.json').read_bytes())
summary = json.loads((evidence/'harness-206-serial-verification/summary.json').read_bytes())
assert summary['status']=='PASS' and summary['exitCode']==0
assert summary['failedTests']==summary['pendingTests']==0
assert summary['exactFocusedInventory'] and summary['fullDiscoveryUnchanged']
assert summary['fullDiscoveryCount']==362 and summary['runInBand'] is False
assert summary['testWorkerCount']==1 and summary['workerIdleMemoryLimit']==512000000
assert summary['nodeOptions']=='' and not summary['exposeGc']
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).strip()
raw_before = subprocess.check_output(['gh','pr','view','295','--repo','yigini/soilfer-lims',
    '--json','state,headRefOid,body,closingIssuesReferences'],cwd=root)
pr = json.loads(raw_before)
original = (evidence/'issue-206-pr-body.md').read_text()
assert pr['state']=='OPEN' and pr['headRefOid']==source['priorHead']
assert pr['closingIssuesReferences']==[] and pr['body'].strip()==original.strip()
body = original + f'''
Test-harness correction at `{source['reviewHead']}`: [Claudio accepted](https://github.com/yigini/soilfer-lims/issues/206#issuecomment-6145765510) replacing only the server `test` script with `jest --maxWorkers=1 --workerIdleMemoryLimit=512MB`. Run [38393187129](https://github.com/yigini/soilfer-lims/actions/runs/38393187129) at the previous head exhausted its existing 8 GB heap and exited 134 after 350 passing suite headers; it is FAILED/incomplete, and Docker acceptance was skipped. The correction recycles one sequential worker between suites. Jest discovery, configuration, all setup/teardown, timeouts, assertions and the CI 8192 MB heap remain unchanged; no GC hooks or production settings changed. The prior 51 source paths are unchanged. Local ordinary-`npm test` verification on this head passed {summary['totalSuites']} focused suites / {summary['passedTests']} tests at the default heap, and discovery is exactly the same 362-suite inventory. The complete prior 362-suite / 5,508-test result above remains identified by its original head and provenance. Fresh full CI must now execute all 362 suites / 5,508 tests with zero skips, followed by both real Docker checks and the new exact-head audit; its final Jest summary will be quoted when available.
'''
body_path = evidence/'issue-206-pr-body-harness-correction.md'
assert not body_path.exists()
body_path.write_bytes(body.encode())
before_path = evidence/'pr-295-before-harness-update-raw.json'
assert not before_path.exists()
before_path.write_bytes(raw_before)
subprocess.check_call(['gh','pr','edit','295','--repo','yigini/soilfer-lims',
                      '--body-file',str(body_path)],cwd=root)
raw_after = subprocess.check_output(['gh','pr','view','295','--repo','yigini/soilfer-lims',
    '--json','state,headRefOid,body,closingIssuesReferences'],cwd=root)
updated = json.loads(raw_after)
assert updated['body'].strip()==body.strip() and updated['closingIssuesReferences']==[]
after_path=evidence/'pr-295-harness-description-raw.json'
assert not after_path.exists()
after_path.write_bytes(raw_after)
files=list((evidence/'harness-206-serial-verification').iterdir())
files += [evidence/'issue-206-harness-review-ref.json',
          evidence/'verify-issue-206-harness-serial.py',body_path,before_path,after_path,Path(__file__)]
record=dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    reviewHead=source['reviewHead'], priorHead=source['priorHead'],
    approvedScopeCommentId=6145765510, focusedSummary=summary,
    originalPRBodyPreserved=True, prDescriptionUpdated=True,
    automaticClosingReferences=[], readyForAudit=False,
    fullNewCI='PENDING; single source-head push follows', productionMutations=0,
    files={str(path.relative_to(root)).replace('\\','/'):dict(bytes=path.stat().st_size,
           sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in files})
destination.write_bytes((json.dumps(record,indent=2)+'\n').encode())
files.append(destination)
paths=[str(path.relative_to(root)).replace('\\','/') for path in files]
subprocess.check_call(['git','add','-f','--',*paths],cwd=root)
assert set(subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root).decode().splitlines())==set(paths)
for relative,pin in record['files'].items():
    blob=subprocess.check_output(['git','show',':'+relative],cwd=root)
    assert hashlib.sha256(blob).hexdigest()==pin['sha256']
subprocess.check_call(['git','commit','-m','docs(206): retain serial worker verification and scoped PR description'],cwd=root)
subprocess.check_call(['git','push','origin','audit/release-eb6de2e8'],cwd=root)
subprocess.check_call(['git','push','origin','codex/issue-206-containers'],cwd=root)
print(json.dumps(dict(reviewHead=source['reviewHead'],focusedSuites=summary['totalSuites'],
                     focusedTests=summary['passedTests'],fullDiscovery=362,
                     singleSourceHeadPushed=True,productionMutations=0),indent=2))
