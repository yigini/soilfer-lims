"""Retain the closed five-suite failure and exact source draft once, before correction."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-independent-owned-context-regression'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['exit']==0 and summary['tests']==350 and summary['passedTests']==350 and summary['failed']==0 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-native-sqlite-guards-focused/index.json').read_bytes())['sourceDraftPaths']+[
 'server/services/workAttemptReservationService.js','server/tests/contracts/issue_209_order_revision_ui.test.js',
 'server/index.js','server/tests/globalSetup.js','Dockerfile','docker-entrypoint.sh','.gitattributes',
 'server/controllers/sampleController.js','server/tests/helpers/workflowWriteScanner.js','server/tests/helpers/qcGateFixture.js',
 'server/tests/helpers/workAttemptFixtures.js','client/src/components/sample/AnalysisUpdateModal.jsx','docs/audit/209-order-revisions.md']
source += ['server/tests/security/wiring.test.js','server/tests/contracts/audit_2_6_equipment_commit.test.js','server/tests/contracts/review_reports_amendments_p6.test.js','server/tests/contracts/audit_3_1_attempt_sql_guards.test.js','server/tests/contracts/issue_206_sample_containers.test.js','server/services/orderAttemptWriteService.js','server/tests/helpers/qcWorksheetUi.js','server/scripts/order_revision_impact.js','server/tests/contracts/issue_209_order_revision_http.test.js','server/scripts/rehearsal_deployment_readiness.cjs','server/tests/contracts/deployment_readiness_bootstrap.test.js','server/tests/contracts/reconcile_analyses.test.js','server/tests/contracts/edit_analyses_permission.test.js']
source += [directory+'/'+locale+'.json' for directory in ['client/src/translations','server/locales'] for locale in ['en','es','es-419','fr','pt']]
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_INDEPENDENT_OWNED_CONTEXT_REGRESSION_PASS','summary':summary,
 'cause':'All11suites350testsPASS; explicit current order context fixes existing equipment/P6 positives, valid orderLine in unchanged206aliquot refusal probes, exact nullable209modelshape for deliberate pre191workspace reads, and same wiring permission predicate retargeted to orderService. All old guard/assertion predicates unchanged; current core209+scanners pass. Fraction runtime/normalizer untouched pending new6166098211 decision.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 independent retained-context corrections PASS11/350

Closed10:32:20.048115UTC11/11suites350/350tests0failedpendingtodo/allfrozeninputsunchanged/exactinventory/full370discovery. Existing equipment/P6 positives getordinaryoneorderService initialorder; raw206aliquot probes havevalidorderline beforeunchangedinvalidaliquot assertions; deliberate pre191workspace onlyadds exactdigestboundnullable209modelshape/originalpre191guards/rows intact; wiring readsneworderService withSAMEpermissionpredicate. Allotherassertions/sourceSQL/scanner/runtime guards unchanged; core209/stablePrismawrappercode/rollback/impact+strictscanners pass. Closedoriginalreport/logs/config/discovery/command/exit/sourcehashes/physicalretainedindex at issue209-independent-owned-context-regression/index.json. Fractionruntime/normalizer unchanged; newquestion6166098211 postedONCE10:17:55/e8fc2f11 pendingactualClanswer. Actualownedprobe f87b30a0: full4fraction+TEXTUREtarget collapses/waivesfractions/no lines; nofraction-relatedruntimechangebeforedecision. Older standaloneapproved-history/fraction fixtures remain next; NO fullserver370PASS/209PR/ready/audit/productionoperation. NativefractionhandoffUNSENT: latestreadonly actualwindowOTHERproject/unrelatedincomingcallpopup, no input/navigation/callaction; preservehumancontent. Native274progressab4d alreadyonce;10/274 fbfc/clientUI22a5/priorfailedfamilyb5 immutable. No runner, samewriter/Cl209originalscope6163271808/103noapply/productionhistoryguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-independent-owned-context-regression-once.py').relative_to(root).as_posix(),(wp/'issue209-local-owned-physical-retention.cjs').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain independent owned order contexts and wiring PASS')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':350,'failedTests':0,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
