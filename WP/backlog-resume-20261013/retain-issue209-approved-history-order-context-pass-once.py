"""Retain the closed five-suite failure and exact source draft once, before correction."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-approved-history-order-context-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['exit']==0 and summary['tests']==181 and summary['passedTests']==181 and summary['failed']==0 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-native-sqlite-guards-focused/index.json').read_bytes())['sourceDraftPaths']+[
 'server/services/workAttemptReservationService.js','server/tests/contracts/issue_209_order_revision_ui.test.js',
 'server/index.js','server/tests/globalSetup.js','Dockerfile','docker-entrypoint.sh','.gitattributes',
 'server/controllers/sampleController.js','server/tests/helpers/workflowWriteScanner.js','server/tests/helpers/qcGateFixture.js',
 'server/tests/helpers/workAttemptFixtures.js','client/src/components/sample/AnalysisUpdateModal.jsx','docs/audit/209-order-revisions.md']
source += ['server/tests/contracts/audit_6_1_non_scientific_authorisation.test.js','server/tests/security/wiring.test.js','server/tests/contracts/audit_2_6_equipment_commit.test.js','server/tests/contracts/review_reports_amendments_p6.test.js','server/tests/contracts/audit_3_1_attempt_sql_guards.test.js','server/tests/contracts/issue_206_sample_containers.test.js','server/services/orderAttemptWriteService.js','server/tests/helpers/qcWorksheetUi.js','server/scripts/order_revision_impact.js','server/tests/contracts/issue_209_order_revision_http.test.js','server/scripts/rehearsal_deployment_readiness.cjs','server/tests/contracts/deployment_readiness_bootstrap.test.js','server/tests/contracts/reconcile_analyses.test.js','server/tests/contracts/edit_analyses_permission.test.js']
source += [directory+'/'+locale+'.json' for directory in ['client/src/translations','server/locales'] for locale in ['en','es','es-419','fr','pt']]
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_APPROVED_HISTORY_ORDER_CONTEXT_FOCUSED_PASS','summary':summary,
 'cause':'Bothsuites181testsPASS; the fresh owned approved-history fixture now declares an explicit retainedACTIVE legacyorderline withNULLworkItemId. Oldassertions unchanged; actualscientific request/authorisation/linkedguards/historypreservation/role/refusal cases andstrictscanner pass. No runtime/schema/sourceguard/scientific change; fraction question6166098211 stillpending.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 explicit approved-history legacy-order fixture PASS2/181

Closed10:39:12.577192UTC2/2suites181/181tests0failedpendingtodo/allfrozeninputsunchanged/exactinventory/full370discovery. Freshownedapproved-history fixture declaresoneACTIVE retainedlegacyOrderLine withworkItemIdNULL; nobackfill/oldline/attempt rewrite. ExistingALLscientific request/authorisation/context-guard/history-preservation/role/refusal assertions andstrictscanner passunchanged; no runtime/schema/sourceguard/scientificchange. Originals issue209-approved-history-order-context-focused/index.json; earlier11/350 independentcontextPASS991b62b7/frozeninputs persists. Fractionruntime/normalizer remainsuntouched pendingactualanswer6166098211, exactoncepostedGHquestione8fc2f11/probef87b30a0. Nativefractionhandoff stillUNSENT: latestcorrectLIMSAuditstate read stable-codeacceptance/batchsuggestion, then humanchangedtoOTHERproject betweenobserve/focus; onlyfocusclick/no typing/message/cardanswer. No furthernativeinput attempted; preservehumancontent. No runner/full370PASS/209PR/ready/audit/productionoperation. Current#20910/274stablecodefbfc/clientUI22a5/native274ab4d immutable; samewriter/Cl2096163271808/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-approved-history-order-context-focused-once.py').relative_to(root).as_posix(),(wp/'issue209-local-owned-physical-retention.cjs').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain explicit approved history order fixture PASS')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':181,'failedTests':0,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
