"""Retain closed scanner/fixture regressions and their one caller registration."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
run=wp/'issue214-scanner-caller-focused';dest=wp/'issue214-scanner-caller-focused-pass'
prep=json.loads((wp/'issue214-scanner-caller-correction/preparation-record.json').read_bytes())
summary=json.loads((run/'summary.json').read_bytes());report=json.loads((run/'report-original.json').read_bytes())
assert summary['status']=='PASS' and summary['exitCode']==0 and report['success']
assert summary['suites']==summary['passedSuites']==14 and summary['tests']==summary['passedTests']==report['numTotalTests']
assert summary['failed']==summary['pending']==summary['failedSuites']==0 and summary['sourceUnchanged'] and summary['inventoryEqual']
before=json.loads((run/'source-before.json').read_bytes());previous=json.loads((wp/'issue214-full-fixture-corrected/source-after.json').read_bytes())
assert before==json.loads((run/'source-after.json').read_bytes()) and len(before)==415
assert {path for path in before if before[path]!=previous[path]}=={'server/tests/helpers/workflowWriteScanner.js'}
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in before.items())
assert len({suite['name'] for suite in report['testResults']})==14
def git(*args,binary=False):
    result=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8' and git('rev-parse','HEAD')==prep['auditSourceBefore']
assert not git('diff','--cached','--name-only')
assert not dest.exists();dest.mkdir()
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sessionId':72037,'summary':summary,
        'sourceDeltaFromClosedFailure':prep['changedSource'],'allowedCallerAdded':prep['addedCaller'],
        'pinnedHelperAndStockAssertionsUnchanged':True,'runtimeWriterExemptionsAdded':0,
        'nextFullHelper':'verify-issue214-scanner-caller-full-once.py','nextFullState':'PREPARED_ONLY',
        'productionOperations':0}
(dest/'terminal-boundary.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=('## 2026-10-13 #214 fixture caller registration and focused scanner regression PASS\n\n'
      f"The new ordinary successor closed at {summary['observedUtc']} with 14/14 suites and "
      f"{summary['tests']}/{summary['tests']} tests PASS, zero failed/pending and all 415 frozen inputs unchanged. "
      'The only source delta from the complete failed full run is registration of '
      '`tests/contracts/audit_2_3_compatibility_runs.test.js` as a permitted caller of the existing digest-pinned '
      'owned-file calculation prerequisite helper, for the normal current-schema Native case Claudio authorized. '
      'The helper bytes, owned-database guards, stock assertions, other caller restrictions and runtime writer '
      'exemptions are unchanged. Both scanner suites, all earlier failing fixtures and the chart/default Strict '
      'contracts pass together. Raw originals/hashes are at '
      '`WP/backlog-resume-20261013/issue214-scanner-caller-focused-pass/index.json`. '
      'The failed full 364/365 suites, 5546/5547 tests and its one scanner finding remain honestly retained at '
      '`issue214-full-fixture-corrected-terminal/index.json`. A new full 365-suite successor is PREPARED, '
      'not a result. No #214 PR, CI, audit PASS, merge, kit, gate or production operation exists. '
      '#206 remains undeployed/open; #103 has no production connection or apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:(root/path).write_bytes(lead.encode()+(root/path).read_bytes())
evidence=[path.relative_to(root).as_posix() for folder in [run,dest,wp/'issue214-scanner-caller-correction'] for path in folder.iterdir() if path.is_file()]
evidence += ['server/tests/helpers/workflowWriteScanner.js',Path(__file__).relative_to(root).as_posix(),
             'WP/backlog-resume-20261013/prepare-issue214-scanner-caller-successors-once.py']
evidence += ['WP/backlog-resume-20261013/'+name for name in prep['preparedHelpers']]
index={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in evidence}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
owned=evidence+readmes+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m','Register reviewed owned compatibility fixture caller and retain scanner PASS')
head=git('rev-parse','HEAD')
for path,row in index.items():assert hashlib.sha256(git('show',head+':'+path,binary=True)).hexdigest()==row['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'FOCUSED_SCANNER_PASS_RETAINED','auditCommit':head,'exactBlobsVerified':len(index),'summary':summary,'productionOperations':0}))
