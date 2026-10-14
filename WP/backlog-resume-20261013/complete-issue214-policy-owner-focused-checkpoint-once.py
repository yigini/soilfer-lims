"""Retain the third closed focused PASS and finish the narrowly staged checkpoint."""
import datetime,hashlib,json,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'issue214-policy-owner-snapshot-focused-pass';run=wp/'issue214-policy-owner-snapshot-focused'
assert not dest.exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
summary=json.loads((run/'summary.json').read_bytes())
assert summary['status']=='PASS' and summary['exitCode']==0 and summary['suites']==summary['passedSuites']==8
assert summary['tests']==summary['passedTests']==218 and summary['failed']==summary['pending']==0
before=json.loads((run/'source-before.json').read_bytes())
assert before==json.loads((run/'source-after.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in before.items())
report=json.loads((run/'report-original.json').read_bytes())
argv=json.loads((run/'command.json').read_bytes())['argv']
assert set(argv[argv.index('--runTestsByPath')+1:argv.index('--json')])=={r['name'] for r in report['testResults']}
previous=wp/'issue214-policy-owner-draft-checkpoint'
record=json.loads((previous/'open-successor-metadata.json').read_bytes())
index=json.loads((previous/'closed-evidence-index.json').read_bytes())
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
allowed=set(index)|set(record['applicationPaths'])|set(readmes)|{(previous/'closed-evidence-index.json').relative_to(root).as_posix()}
assert set(git('diff','--cached','--name-only').decode().splitlines())<=allowed
assert git('rev-parse','HEAD').strip()==b'a86931b3a01ad3a1fd59300003d7a11a585af38c'
dest.mkdir()
for p in run.iterdir():
    if p.is_file():shutil.copyfile(p,dest/p.name)
(dest/'terminal-boundary.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),
 'sessionId':34251,'summary':summary,'all421InputsUnchanged':True,'exactFocusedInventory':True,
 'stagingPreparationRefusal':'.gitignore:52 *.log; first checkpoint staged only its named nonignored paths; originals retained',
 'fullLocalResult':None,'sourcePRUnchanged':True,'productionOperations':0},indent=2)+'\n').encode())
rows={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps(rows,indent=2)+'\n').encode())
lead='''## 2026-10-14 #214 accepted policy owner; snapshot-preservation focused PASS

Third unique focused session34251 closed PASS04:27:26UTC:8/8 suites218/218 tests,0failed/pending/all421 frozen inputs unchanged, exact8 selected paths and366 full discovery. It covers ABSENT exact DRY0/APPLY empty DDL/immediate NO_OP0, canonical and actual Prisma PRESENT row-byte preservation, every partial/type/source refusal, real active-WAL refusal/DB-WAL-SHM equality, shipped Strict CONTROL_CHART/min20 through actual policyService, default entrypoint/readiness order and existing chart/startup/scanner contracts. Both earlier failures stay honestly retained. Snapshot classification never opens the original target with SQLite and does not normalize it. Local retention-only teardown preserves held DBs; stock CI hooks and ordinary setup/assertions remain unchanged. Full366-suite verification is the next boundary, not yet a result; PR296 still olde47b/originalfailedCI immutable. Actual accepted scope6160619940/no normalization governs. No ready notice/merge/kit/gate/production operation. Source/ref/CI correction follows full proof, then exact-head audit request; only after that start209. Native human draftn is preserved.

'''
for p in readmes:
    f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
extra=[Path(__file__).relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
paths=sorted(allowed|set(rows)|set(extra))
git('add','-f','--',*paths)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(paths)
for p,row in (index|rows).items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==row['sha256'],p
git('commit','-m','audit(214): retain accepted policy owner and focused snapshot preservation proof')
head=git('rev-parse','HEAD').decode().strip()
for p,row in (index|rows).items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==row['sha256'],p
git('push','origin','audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'closedVerifiedBlobCount':len(index|rows),'focused':summary,'sourcePRUnchanged':True}))
