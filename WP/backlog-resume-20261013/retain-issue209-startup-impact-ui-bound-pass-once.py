"""Retain the closed five-suite failure and exact source draft once, before correction."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-startup-impact-ui-bound-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['exit']==0 and summary['tests']==184 and summary['passedTests']==184 and summary['failed']==0 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-native-sqlite-guards-focused/index.json').read_bytes())['sourceDraftPaths']+[
 'server/services/workAttemptReservationService.js','server/tests/contracts/issue_209_order_revision_ui.test.js',
 'server/index.js','server/tests/globalSetup.js','Dockerfile','docker-entrypoint.sh','.gitattributes',
 'server/controllers/sampleController.js','server/tests/helpers/workflowWriteScanner.js','server/tests/helpers/qcGateFixture.js',
 'server/tests/helpers/workAttemptFixtures.js','client/src/components/sample/AnalysisUpdateModal.jsx','docs/audit/209-order-revisions.md']
source += ['server/tests/helpers/qcWorksheetUi.js']
source += [directory+'/'+locale+'.json' for directory in ['client/src/translations','server/locales'] for locale in ['en','es','es-419','fr','pt']]
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_STARTUP_IMPACT_UI_FOCUSED_PASS','summary':summary,
 'cause':'All184 focused tests pass. Exact direct immutable SQL source form resolves with existing scanner predicates and negative assertions unchanged; real browser event APIs supplied in test harness. Scientific reservation/old rows, OPEN-impact split and actual UI callbacks pass. Earlier179/5 failure retained unchanged.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 startup/impact/scientific-reservation/UI/scanners focused PASS5/184

Closed08:44:08.067797UTC5/5suites184/184tests0failedpendingtodo/allfrozeninputsunchanged/exactinventory/full369discovery. Actual scientific amendment reservation receives current order line at INSERT; original lines/parent attempts unchanged. Kitimpact uses actual OPENallocation decision, distinguishes continuing historicalOPEN identities from new-attempt refusals. Direct immutable migration call form resolves under unchanged scanners/allnegativeassertions; sourceDDL+loader unchanged. Actualdialog mandatoryreason/fulltarget and approved/archived/disposed amendment guidance, fiveclient+serverlocales PASS. Prior179/5 failure preserved9140e952; corrected harness supplies browser event APIs. StartupDocker/index/globalsetup/sourceLFpins wired, currentownedgatefixture uses real209owner+ordinaryinitialorder. FOCUSED DRAFT ONLY, notfull209PASS/PR/auditready; NEXTrealreadiness209proof/HTTProles/idempotency/broadercurrentfixture regression/readonlycollector allocations/fullverification. No runner remains/no productionconnectioncollectionoperation. ActualCl2096163271808 holds. PR296/mainCI38528593695 COMPLETE366/5566/fdf07fef,214+206undeployed/open; allhandoffs alreadyONCE. Samewriter/humancontent/103noapply/historyguards hold. Originals issue209-startup-impact-ui-bound-focused/index.json.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-startup-impact-ui-bound-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain startup impact scientific reservation UI and scanner PASS')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':184,'failedTests':0,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
