"""Retain the closed owned focused correction result honestly, once."""
import datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-pr297-impact-audit-correction-focused-owned'
assert not (dest/'terminal-index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes());exitCode=int((dest/'exit-original.txt').read_text());assert exitCode==summary['exit']
before=json.loads((dest/'source-before.json').read_bytes());after=json.loads((dest/'source-after.json').read_bytes())
assert summary['sourceUnchanged']==(before==after)
for p,d in after.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
policy=json.loads((dest/'derived-output-policy-closed.json').read_bytes());assert policy['onlyDeclaredMutableOutput']=='server/data/help/RELEASE_MANIFEST_v1.json'
for which in ['before','after']:
 raw=(dest/('derived-help-manifest-'+which+'-original.json')).read_bytes();assert len(raw)==policy[which+'Bytes'] and hashlib.sha256(raw).hexdigest()==policy[which+'Sha256']
assert policy['beforeOriginalCaptured'] and policy['afterOriginalCaptured']
assert hashlib.sha256((root/policy['onlyDeclaredMutableOutput']).read_bytes()).hexdigest()==policy['afterSha256']
report=json.loads((dest/'report-original.json').read_bytes()) if (dest/'report-original.json').exists() else {}
if summary['status']=='PASS':
 assert exitCode==0 and report['success'] and summary['suites']==summary['passedSuites']==5 and summary['tests']==summary['passedTests']==333
 assert summary['sourceUnchanged'] and summary['selectedInventoryEqual'] and summary['visibleAssetsUnchanged']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
 assert set(s['name'] for s in report['testResults'])==set(json.loads((dest/'selected-inventory-original.json').read_bytes()))
stderr=(dest/'stderr-original.log').read_text(encoding='utf8',errors='replace');jestSummary=[line for line in stderr.splitlines() if re.match(r'^(Test Suites:|Tests:|Snapshots:|Time:)',line)]
(dest/'exact-jest-summary-original.txt').write_bytes(('\n'.join(jestSummary)+'\n').encode())
held=[];ledger=dest/'physical-retention-original.jsonl'
for line in ledger.read_text(encoding='utf8').splitlines() if ledger.exists() else []:
 p=Path(json.loads(line)['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc':summary['closedUtc'],'retentionLedgerPresent':ledger.exists(),'allRecordedTeardownTargetsRetained':True,'allPhysicalFixtureIdentitiesClaimed':False,'files':held},indent=2)+'\n').encode())
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-exchange-spectral-context-singles/index.json').read_bytes())['sourceDraftPaths'];assert len(source)==122
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file() and p.name not in ['open-retention-index.json','terminal-index.json']}
changed=['server/scripts/install_order_revisions.js','server/tests/contracts/issue_209_order_revision_integration.test.js','docs/audit/209-order-revisions.md']
actual=(root/changed[1]).read_text(encoding='utf-8');old=git('show','562cab2d24b25a500041a44abf384ffc4dbfad7c:'+changed[1]).decode()
start=actual.index("test('approved impact excludes");end=actual.index("test('repeat reservation maps",start)
assert actual[:start]+actual[end:]==old,'All old integration bytes must remain unchanged'
patch=dest/'source-delta-from-audited-head-original.diff';patch.write_bytes(git('diff','--no-ext-diff','562cab2d24b25a500041a44abf384ffc4dbfad7c','--',*changed))
raw[patch.relative_to(root).as_posix()]={'bytes':patch.stat().st_size,'sha256':hashlib.sha256(patch.read_bytes()).hexdigest()}
(dest/'terminal-index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'exactJestSummary':jestSummary,'rawFiles':raw,'sourceDraftPaths':source,'independentOriginal650Ledger':'issue209-original-case-reconciliation-650/index.json','onlyDeclaredMutableOutputCapturedBeforeAndAfter':True,'focusedOrdinaryVerified':summary['status']=='PASS','fullCurrentLocalVerified':False,'oldIntegrationBytesRecovered':True,'stockRealCIPass':False,'finalClaudioAuditPass':False,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 actual audit correction focused CLOSED '+summary['status']+'\n\nActual terminal '+json.dumps(summary)+'; exact Jest summary '+json.dumps(jestSummary)+'. Five ordinary suites including seven new report cases and both scanners; old integration source/assertions byte-exact recovered. Only two required impact-report fixes plus documentation, no runtime/schema/scanner change. Closed originals/source hashes/manifest snapshots at issue209-pr297-impact-audit-correction-focused-owned/terminal-index.json. This is focused evidence only; prior full370/5642 stock/local is bound to old562 head whose actual audit FAILED6176831479. On focused PASS create a new same-PR source successor and ONE automatic CI; no oldCI/helper replay, no final newheadPASS/merge/kit/gate/production. Original failed setup run0tests/cd619 remains immutable; existing local retention prefix guard unchanged. Native final handoff once/centre draft preserved; all history and103noapply hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+source+readmes+[(dest/'terminal-index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]
owned += [(wp/'verify-pr297-impact-audit-correction-focused-owned-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in raw.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
for p in source:assert git('show',':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
git('commit','-m','audit(209): retain scoped impact audit correction focused terminal '+summary['status']);head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*raw).split(b'\0'):
 if entry:meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set(raw)
for p,pin in raw.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'terminalStatus':summary['status'],'rawGitBlobsVerified':len(raw),'sourceDraftPaths':len(source),'productionOperations':0}))
