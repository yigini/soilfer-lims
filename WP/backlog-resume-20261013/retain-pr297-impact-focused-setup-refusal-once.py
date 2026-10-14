"""Retain CLOSED focused setup refusal honestly; never replay."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'pr297-impact-audit-correction-focused'
assert not (dest/'terminal-index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['exit']==1 and summary['tests']==0 and summary['suites']==summary['failedSuites']==5
assert summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for p,h in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
assert 'Local physical retention requires the owned evidence directory.' in (dest/'stderr-original.log').read_text(encoding='utf-8')
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
paths=['server/scripts/install_order_revisions.js','server/tests/contracts/issue_209_order_revision_integration.test.js','docs/audit/209-order-revisions.md']
(dest/'source-delta-from-audited-head-original.diff').write_bytes(git('diff','--no-ext-diff','562cab2d24b25a500041a44abf384ffc4dbfad7c','--',*paths))
pins={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.rglob('*') if p.is_file()}
(dest/'terminal-index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'rawPins':pins,
 'failureCause':'Local helper chose pr297 directory; existing retention hook requires issue209 prefix',
 'testsExecuted':0,'sourceDeltaPaths':paths,'fullCurrentPass':False,'newHeadCiPass':False,'finalAuditPass':False,'productionOperations':0},indent=2)+'\n').encode())
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
lead='''## 2026-10-14 #209 audit correction focused setup REFUSED before tests

New focused helper closed19:49:15.955961UTC/exit1/5 setup failures/0 tests because its pr297 evidence-directory name violated the unchanged issue209 local retention prefix guard. All1327 frozen inputs unchanged; originals retained at pr297-impact-audit-correction-focused/terminal-index.json. No application failure/PASS inferred. Original helper/run immutable; new unique issue209-prefixed successor required, no retention guard change. Actual audit6176831479 remains FAILED on old562 head despite old stock370/5642green; two report corrections and seven new meaningful checks are draft only. Native finalhandoff alreadyonce/centre draft preserved. No merge/kit/gate/production/new source ref/CI yet.

'''
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+paths+readmes+[(dest/'terminal-index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix(),(wp/'verify-pr297-impact-audit-correction-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
git('commit','-m','audit(209): retain focused setup refusal and scoped report correction draft')
audit=git('rev-parse','HEAD').decode().strip()
for p,h in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==h,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditCommit':audit,'status':summary['status'],'testsExecuted':0,'verifiedBlobs':len(pins)}))
