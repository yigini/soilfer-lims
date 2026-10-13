"""Retain the actual closed failed full boundary; never replay or claim PASS."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
run=wp/'issue214-full-fixture-corrected';dest=wp/'issue214-full-fixture-corrected-terminal'
def git(*args,binary=False):
    result=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8'
assert git('rev-parse','HEAD')=='507d8ed9d6343b4f20ad15ae37dcd04b650ccc60' and not git('diff','--cached','--name-only')
summary=json.loads((run/'summary.json').read_bytes());report=json.loads((run/'report-original.json').read_bytes())
inventory=json.loads((run/'inventory-original.json').read_bytes());before=json.loads((run/'source-before.json').read_bytes())
assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['exitCode']!=0 and not report['success']
assert summary['failed']>0 and summary['inventoryEqual'] and summary['sourceUnchanged']
assert len(inventory)==len(set(inventory))==report['numTotalTestSuites']==summary['suites']==365
assert report['numTotalTests']==summary['tests']==5547
assert set(inventory)=={suite['name'] for suite in report['testResults']}
assert len(before)==415 and before==json.loads((run/'source-after.json').read_bytes())
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in before.items())
assert int((run/'exit-original.txt').read_text())==summary['exitCode']
failures=[{'suite':suite['name'],'test':case['fullName'],'failureMessages':case['failureMessages']}
          for suite in report['testResults'] for case in suite['assertionResults'] if case['status']=='failed']
assert len(failures)==summary['failed']==report['numFailedTests']
assert summary['failedSuites']==report['numFailedTestSuites'] and summary['pending']==report['numPendingTests']
assert not dest.exists();dest.mkdir()
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sessionId':99113,'summary':summary,
        'failedCases':failures,'originalCommand':json.loads((run/'command.json').read_bytes()),
        'closed':True,'productionOperations':0,
        'unusedPreparedHelpers':['retain-issue214-full-fixture-corrected-pass-once.py',
            'prepare-issue214-source-only-review-once.py','create-issue214-source-pr-once.py'],
        'unusedPreparedHelpersMustNotExecute':True}
(dest/'terminal-boundary.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=('## 2026-10-13 #214 corrected full local regression CLOSED FAILED\n\n'
      f"The full successor closed at {summary['observedUtc']} with {report['numPassedTestSuites']}/365 passing suites "
      f"and {report['numPassedTests']}/5547 passing tests; {summary['failed']} failed and {summary['pending']} pending. "
      'All 365 discovered suites are present exactly once and all 415 frozen source/fixture hashes remain unchanged. '
      'This is a complete failed result, never a PASS. The workflow scanner correctly refused the newly added '
      'compatibility fixture caller of the existing digest-pinned owned-file calculation prerequisite helper. '
      'Preserve every stock assertion and helper guard; register only that reviewed fixture context, then use '
      'new unique focused/full successors. Complete raw failures are indexed at '
      '`WP/backlog-resume-20261013/issue214-full-fixture-corrected-terminal/index.json`. '
      'The three unused PASS/source-ref/PR preparation helpers named in the terminal record must not execute. '
      'No #214 PR, actual CI, exact-head audit PASS, merge, kit, gate or production operation exists. '
      '#206 remains undeployed/open; #103 has no production connection or apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:(root/path).write_bytes(lead.encode()+(root/path).read_bytes())
evidence=[path.relative_to(root).as_posix() for path in run.iterdir() if path.is_file()]
evidence += [(dest/'terminal-boundary.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]
evidence += ['WP/backlog-resume-20261013/'+name for name in record['unusedPreparedHelpers']]
index={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in evidence}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
owned=evidence+readmes+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m','Retain complete control chart fixture scanner failure honestly')
head=git('rev-parse','HEAD')
for path,row in index.items():assert hashlib.sha256(git('show',head+':'+path,binary=True)).hexdigest()==row['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'CLOSED_FULL_FAILURE_RETAINED','auditCommit':head,'exactBlobsVerified':len(index),'summary':summary,'productionOperations':0}))
