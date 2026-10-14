"""Retain a CLOSED full policy-owner successor honestly, once; never active logs."""
import datetime,hashlib,json,re,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;run=wp/'issue214-policy-owner-full'
assert (run/'exit-original.txt').exists() and (run/'summary.json').exists()
summary=json.loads((run/'summary.json').read_bytes())
assert int((run/'exit-original.txt').read_text())==summary['exitCode']
report=json.loads((run/'report-original.json').read_bytes()) if (run/'report-original.json').exists() else {}
inventory=json.loads((run/'inventory-original.json').read_bytes())
before=json.loads((run/'source-before.json').read_bytes());after=json.loads((run/'source-after.json').read_bytes())
allPassed=summary['status']=='PASS' and summary['exitCode']==0 and len(inventory)==366 and len(set(inventory))==366 and set(inventory)=={s['name'] for s in report['testResults']}
allPassed=allPassed and report.get('numTotalTests')==report.get('numPassedTests')==5565 and report.get('numTodoTests',0)==0
allPassed=allPassed and all(c['status']=='passed' for s in report.get('testResults',[]) for c in s['assertionResults']) and before==after
dest=wp/('issue214-policy-owner-full-pass' if allPassed else 'issue214-policy-owner-full-failure')
assert not dest.exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
dest.mkdir()
for p in run.iterdir():
    if p.is_file():shutil.copyfile(p,dest/p.name)
lines=(run/'stderr-original.log').read_text(encoding='utf8',errors='replace').splitlines()
exact=[l.strip() for l in lines if l.startswith(('Test Suites:','Tests:','Snapshots:','Time:'))]
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'sessionId':98407,'status':'PASS' if allPassed else 'CLOSED_FAILURE_OR_INCOMPLETE',
 'summary':summary,'exactJestSummary':exact,'inventoryExact':set(inventory)=={s['name'] for s in report.get('testResults',[])},
 'frozenPathCount':len(before),'allFrozenInputsUnchanged':before==after,'sourceAuditBefore':git('rev-parse','HEAD').decode().strip(),
 'localRetentionTeardownOnly':True,'stockCiHooksUnchanged':True,'sourcePRUnchanged':True,'productionOperations':0}
(dest/'terminal-boundary.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
index={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 accepted policy-owner full successor CLOSED {record['status']}

Session98407 closed with {summary['passedSuites']}/{summary['suites']} passing suites and {summary['passedTests']}/{summary['tests']} passing tests, {summary['failed']} failed/{summary['pending']} pending. Exact original Jest summary: {' / '.join(exact)}. Discovery366 unique suites, input421 hashes unchanged={before==after}, exact report inventory={record['inventoryExact']}. Originals/hashes are retained at `WP/backlog-resume-20261013/{dest.name}/index.json`. Both ordinary setups/assertions, worker512MB/blanklocal NODE_OPTIONS remained enabled; explicit local visible-assets/retention-only teardown fixtures preserve held evidence. Stock CI hooks remain unchanged and do not use those fixtures. Actual accepted scope6160619940/no policy normalization and8/218 focused preservation proof govern. Earlier failures stay honest and immutable. PR296 remains olde47b/base6d until a separately guarded fast-forward update; original failedCI38467368095 never replays. No ready notice/final audit request/PASS/merge/kit/gate/production operation. Only after new complete real greenCI send a NEW exact-head audit request, then start209. Human draftn/#103noapply and historical release guards remain.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
    f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
helpers=[Path(__file__).relative_to(root).as_posix(),'WP/backlog-resume-20261013/update-pr296-policy-owner-after-full-pass-once.py']
paths=readmes+helpers+list(index)+[(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*paths)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(paths)
for p,row in index.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==row['sha256'],p
git('commit','-m','audit(214): retain closed full policy-owner '+record['status'].lower())
head=git('rev-parse','HEAD').decode().strip()
for p,row in index.items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==row['sha256'],p
git('push','origin','audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'rawBlobCount':len(index),**record}))
