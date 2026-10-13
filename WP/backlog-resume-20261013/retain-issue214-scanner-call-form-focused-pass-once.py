"""Retain one closed ordinary scanner/fixture PASS after the strict call-form fix."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
run=wp/'issue214-scanner-call-form-focused';dest=wp/'issue214-scanner-call-form-focused-pass'
prep=json.loads((wp/'issue214-scanner-call-form-correction/preparation-record.json').read_bytes())
summary=json.loads((run/'summary.json').read_bytes());report=json.loads((run/'report-original.json').read_bytes())
assert summary['status']=='PASS' and summary['exitCode']==0 and report['success']
assert summary['suites']==summary['passedSuites']==14 and summary['tests']==summary['passedTests']==report['numTotalTests']==293
assert summary['failed']==summary['pending']==summary['failedSuites']==0 and summary['sourceUnchanged'] and summary['inventoryEqual']
before=json.loads((run/'source-before.json').read_bytes());previous=json.loads((wp/'issue214-full-fixture-corrected/source-after.json').read_bytes())
assert before==json.loads((run/'source-after.json').read_bytes()) and len(before)==415
delta={'server/tests/helpers/workflowWriteScanner.js','server/tests/contracts/audit_2_3_compatibility_runs.test.js'}
assert {path for path in before if before[path]!=previous[path]}==delta
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in before.items())
assert prep['releasedCompatibilityStatementsAndAssertionsByteIdentical'] and prep['existingScannerPredicatesUnchanged']
def git(*args,binary=False):
    result=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8' and git('rev-parse','HEAD')==prep['auditSourceBefore']
assert not git('diff','--cached','--name-only') and not dest.exists();dest.mkdir()
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sessionId':49330,'summary':summary,
        'sourceDeltaFromClosedFullFailure':sorted(delta),'allowedCallerAdded':'tests/contracts/audit_2_3_compatibility_runs.test.js',
        'existingScannerPredicatesPinnedHelperAndStockAssertionsUnchanged':True,
        'releasedCompatibilityStatementsByteIdenticalOutsideApprovedFixtureContext':True,
        'runtimeWriterExemptionsAdded':0,'nextFullHelper':'verify-issue214-scanner-call-form-full-once.py',
        'nextFullState':'PREPARED_ONLY','productionOperations':0}
(dest/'terminal-boundary.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=('## 2026-10-13 #214 strict scanner fixture call form and focused regression PASS\n\n'
      f"The unique ordinary successor closed at {summary['observedUtc']} with 14/14 suites and 293/293 tests PASS, "
      'zero failed/pending and all 415 frozen inputs unchanged. Both scanner suites and all previous failed fixtures '
      'pass together. The compatibility current-schema Native fixture alone is a registered caller of the existing '
      'digest-pinned owned-file calculation prerequisite helper, using the scanner’s existing destructured import, '
      'immutable direct call and one owned-file identifier form. Scanner predicates, helper bytes/owned-database guards '
      'and all stock assertions are unchanged; removing only the approved fixture context reproduces every released '
      'compatibility statement byte-identically. No runtime writer exemption was added. Raw originals/source proof are '
      'at `WP/backlog-resume-20261013/issue214-scanner-call-form-focused-pass/index.json`. Earlier full365/5547 '
      'with one scanner failure and focused14/293 with one call-form failure remain honestly retained. '
      'The new full365-suite successor is PREPARED, not a result. No #214 PR, CI, audit PASS, merge, kit, gate '
      'or production operation exists; #206 undeployed/open and #103 has no production connection/apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:(root/path).write_bytes(lead.encode()+(root/path).read_bytes())
evidence=[path.relative_to(root).as_posix() for folder in [run,dest,wp/'issue214-scanner-call-form-correction'] for path in folder.iterdir() if path.is_file()]
evidence += sorted(delta)+[Path(__file__).relative_to(root).as_posix(),
            'WP/backlog-resume-20261013/prepare-issue214-scanner-call-form-successors-once.py']
evidence += ['WP/backlog-resume-20261013/'+name for name in prep['preparedHelpers']]
index={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in evidence}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
owned=evidence+readmes+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m','Use strict owned-fixture helper call form and retain scanner regression PASS')
head=git('rev-parse','HEAD')
for path,row in index.items():assert hashlib.sha256(git('show',head+':'+path,binary=True)).hexdigest()==row['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'FOCUSED_STRICT_SCANNER_PASS_RETAINED','auditCommit':head,'exactBlobsVerified':len(index),'summary':summary,'productionOperations':0}))
