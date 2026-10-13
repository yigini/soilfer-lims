"""Checkpoint owned #214 source and CLOSED evidence; open run metadata stays open."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
def git(*args, binary=False):
 r=subprocess.run(['git',*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace'))
 return r.stdout if binary else r.stdout.decode('utf-8').strip()
assert git('branch','--show-current')=='audit/release-eb6de2e8'
assert git('rev-parse','HEAD')=='ad6173bb8ae5508e3c30c9bcf706338562ffa554'
assert not git('diff','--cached','--name-only')
dest=wp/'issue214-draft-checkpoint-1917'
assert not dest.exists();dest.mkdir()
frozen=json.loads((wp/'issue214-full-server-responsive/source-before.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==digest for p,digest in frozen.items())
source=list(frozen)
openRun={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'OPEN_RUNNING_NO_RESULT','sessionId':49046,'helper':'verify-issue214-full-server-responsive.py','inventorySuites':len(json.loads((wp/'issue214-full-server-responsive/inventory-original.json').read_bytes())),'frozenSource':frozen,'productionOperations':0}
assert openRun['inventorySuites']==365 and not (wp/'issue214-full-server-responsive/summary.json').exists()
(dest/'full-successor-open-metadata.json').write_bytes((json.dumps(openRun,indent=2)+'\n').encode())
status="""## 2026-10-13 #214 source draft and closed local evidence; full successor OPEN

The #214 draft implements actual Claudio scientific direction6148143929, confirmed prebinding/frozen-lot direction6152114918 and retained Native fixture direction6152507558. Strict/default CONTROL_CHART laboratories must prebind served LRM lots before new start, including Provisional series; stable refusals name the position. Fixed-window and genuinely pre-release started runs retain their path. The default-path test uses Strict without an override; retained Native fixtures use ordinary FIXED_WINDOW policy setup with stock assertions unchanged. The eventual kit must retain an actual read-only policy/rule-resolved lab/analyte/method and unstarted-run impact count for Claudio review before a fresh gate. The collector is prepared and tested only against owned disposable data; no production collection occurred.

Closed ordinary targeted regression: 12 suites / 197 tests, zero failures/pending at19:00:37UTC, exact frozen source hashes in `WP/backlog-resume-20261013/issue214-scoped-impact-ordinary-regression`. It covers correction/effective-point replacement, retained immutable proposal/evaluation evidence, frozen-lot refusal, the real guarded schema, startup, UI wiring, role/scope and read-only impact-byte preservation. Responsive client build/lint completed19:07:12UTC with both exit0, unchanged source and the same14 existing warnings. Actual Chromium desktop1440×1050/mobile390×844 inspections and keyboard requests are closed in `issue214-responsive-browser-closed/index.json`; the first mobile overflow is retained honestly and the successor fits (document375/viewport390). The focused PASS precedes the CSS-only responsive correction. A fresh full ordinary npm-test successor is RUNNING on 365 discovered suites with all ordinary setup/assertions, single worker512MB and blank local NODE_OPTIONS; `issue214-draft-checkpoint-1917/full-successor-open-metadata.json` is OPEN metadata, never a result.

All preceding failed/incomplete raw reports/helpers are retained honestly: Native145/113/32, subsequent196/195/1 and197/196/1, original schema/setup refusals and the first full attempt stopped before the CSS change (no final report). No consumed helper may replay. Actual lot and fixture questions/native deliveries were each once; actual answers are retained. No #214 PR, exact-head audit PASS, release/kit/gate/deployment or production operation exists. #206/PR295 audit and merge/main CI remain complete; #206 stays OPEN for actual post-deploy closure. #103 has no production connection or apply go. Human files/drafts/cards remain untouched. Same writer/worktree/branch, coordination ACTIVE and quiet unchanged/non-actionable.

"""
for rel in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=root/rel;p.write_bytes(status.encode('utf-8')+p.read_bytes())
tracked=set(git('ls-files','-z',binary=True).decode('utf-8').split('\0'))
evidence=[]
for p in sorted(wp.rglob('*')):
 if not p.is_file():continue
 rel=p.relative_to(root).as_posix()
 if rel in tracked:continue
 parts=p.relative_to(wp).parts
 if '214' not in parts[0] or parts[0]=='issue214-full-server-responsive':continue
 evidence.append(rel)
# Closed discovery metadata only. Never capture the active stdout/stderr/report.
for name in ['source-before.json','inventory-original.json','inventory-stderr-original.log','command.json']:
 evidence.append((wp/'issue214-full-server-responsive'/name).relative_to(root).as_posix())
evidence.append(Path(__file__).relative_to(root).as_posix())
evidence=sorted(set(evidence))
index={p:{'bytes':(root/p).stat().st_size,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in evidence}
(dest/'closed-evidence-index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
(dest/'source-raw-before-stage.json').write_bytes((json.dumps(frozen,indent=2)+'\n').encode())
owned=sorted(set(source+evidence+['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']+[p.relative_to(root).as_posix() for p in dest.iterdir() if p.is_file()]))
for begin in range(0,len(owned),45):git('add','-f','--',*owned[begin:begin+45])
staged=git('diff','--cached','--name-only').splitlines()
assert set(staged)<=set(owned) and len(staged)>50
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==digest for p,digest in frozen.items())
git('commit','-m','Checkpoint control chart draft and closed scientific boundary evidence')
head=git('rev-parse','HEAD')
for p,record in index.items():
 assert hashlib.sha256(git('show',head+':'+p,binary=True)).hexdigest()==record['sha256'],p
for p in ['server/prisma/migrations/20261013000200_control_charts/migration.sql','server/services/controlChartMigrationSource.js','server/tests/fixtures/pre214-native-run-source.cjs']:
 assert hashlib.sha256(git('show',head+':'+p,binary=True)).hexdigest()==frozen[p],p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==head
print(json.dumps({'status':'PUSHED_CHECKPOINT','auditCommit':head,'closedRawFilesVerified':len(index),'changedOwnedPaths':len(staged),'fullRun':'OPEN_RUNNING_NO_RESULT','productionOperations':0}))

