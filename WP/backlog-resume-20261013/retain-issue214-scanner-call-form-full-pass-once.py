"""Retain a genuinely complete full PASS; never capture an active run as closed."""
import datetime, hashlib, json, re, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
run=wp/'issue214-scanner-call-form-full'
summary=json.loads((run/'summary.json').read_bytes())
report=json.loads((run/'report-original.json').read_bytes())
inventory=json.loads((run/'inventory-original.json').read_bytes())
before=json.loads((run/'source-before.json').read_bytes())
assert summary['status']=='PASS' and summary['exitCode']==0 and report['success']
assert summary['failed']==summary['pending']==summary['failedSuites']==0 and summary['sourceUnchanged'] and summary['inventoryEqual']
assert len(inventory)==len(set(inventory))==summary['suites']==report['numPassedTestSuites']==365
assert report['numTotalTests']==report['numPassedTests']==summary['tests']==5547
assert set(inventory)=={suite['name'] for suite in report['testResults']}
assert before==json.loads((run/'source-after.json').read_bytes()) and len(before)==415
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in before.items())
assert int((run/'exit-original.txt').read_text())==0
stderr=(run/'stderr-original.log').read_text(encoding='utf-8',errors='replace')
jestSummary=[line for line in stderr.splitlines() if line.startswith(('Test Suites:','Tests:','Snapshots:','Time:'))]
assert any(re.fullmatch(r'Test Suites:\s+365 passed, 365 total',line) for line in jestSummary)
assert any(re.fullmatch(r'Tests:\s+5547 passed, 5547 total',line) for line in jestSummary)
def git(*args,binary=False):
    result=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout if binary else result.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8'
assert git('rev-parse','HEAD')=='519262ea8628e9a036bf9ace563984df336415e8'
assert not git('diff','--cached','--name-only')
dest=wp/'issue214-scanner-call-form-full-pass'
assert not dest.exists();dest.mkdir()
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sessionId':65892,'summary':summary,
    'exactJestSummary':jestSummary,'frozenSourcePathCount':415,'ordinarySetupsAndAssertions':True,
    'localVisibleStorageOnly':True,'stockCIHasNoLocalFixture':True,'productionOperations':0}
(dest/'terminal-boundary.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
status=('## 2026-10-13 #214 complete corrected full local regression PASS\n\n'
    f"The unique full successor closed at{summary['observedUtc']} with365/365 suites and5547/5547 tests PASS,0failed/skipped/pending. "
    'The final original Jest summary is quoted in `WP/backlog-resume-20261013/issue214-scanner-call-form-full-pass/terminal-boundary.json`. '
    'Every discovered suite is present once in the original report, all415 frozen source/fixture hashes are unchanged, '
    'both ordinary setups/assertions and the single worker512MB/blank local NODE_OPTIONS are preserved. Byte-identical '
    'built assets and disposable uploads use only the retained local visible-path fixture. Standard PR CI must independently '
    'run without that fixture and perform actual candidate/baseline Docker builds and boundary/readiness acceptance. '
    'All earlier failed/incomplete/refused runs remain honestly retained; consumed helpers never replay. '
    'No214 PR, actualCI, exact-head audit PASS, merge, kit, gate or production operation exists at this checkpoint. '
    '#206 remains source-merged but undeployed/open for actual post-deploy closure; #103 has no production connection/apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path=root/relative;path.write_bytes(status.encode()+path.read_bytes())
evidence=[path.relative_to(root).as_posix() for folder in [run,dest] for path in folder.iterdir() if path.is_file()]
evidence.append(Path(__file__).relative_to(root).as_posix())
index={path:{'bytes':(root/path).stat().st_size,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in evidence}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
owned=evidence+readmes+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m','Retain complete frozen control chart full regression PASS')
head=git('rev-parse','HEAD')
for path,row in index.items():assert hashlib.sha256(git('show',head+':'+path,binary=True)).hexdigest()==row['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'COMPLETE_FULL_PASS_RETAINED','auditCommit':head,'exactBlobsVerified':len(index),'summary':summary,'productionOperations':0}))
