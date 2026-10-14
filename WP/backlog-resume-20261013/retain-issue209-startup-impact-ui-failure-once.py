"""Retain the closed five-suite failure and exact source draft once, before correction."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-startup-impact-ui-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['exit']==1 and summary['tests']==184 and summary['passedTests']==179 and summary['failed']==5 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-native-sqlite-guards-focused/index.json').read_bytes())['sourceDraftPaths']+[
 'server/services/workAttemptReservationService.js','server/tests/contracts/issue_209_order_revision_ui.test.js',
 'server/index.js','server/tests/globalSetup.js','Dockerfile','docker-entrypoint.sh','.gitattributes',
 'server/controllers/sampleController.js','server/tests/helpers/workflowWriteScanner.js','server/tests/helpers/qcGateFixture.js',
 'server/tests/helpers/workAttemptFixtures.js','client/src/components/sample/AnalysisUpdateModal.jsx','docs/audit/209-order-revisions.md']
source += [directory+'/'+locale+'.json' for directory in ['client/src/translations','server/locales'] for locale in ['en','es','es-419','fr','pt']]
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_STARTUP_IMPACT_UI_FOCUSED_FAILURE','summary':summary,
 'cause':'Four UI tests lack browser event APIs in the lightweight harness; strict scanner refuses3 unresolved installer SQL call bindings. Scientific amendment reservation and OPEN-impact checks pass. Retained before correction.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 startup/impact/UI focused179 PASS5 FAIL, retained honestly

Closed08:39:56.494854UTC5suites184tests179PASS5FAIL0pending/allfrozeninputsunchanged/exactinventory/full369discovery. Scientific amendment INSERT link/oldrow equality, reservedOPEN impact distinction, shared service and native SQL guards PASS. Four actualdialog tests lack event APIs in test harness; strict scanner refuses3 unresolved installer SQL call bindings. Preserve scanner predicates/sourceguards/assertions; correct source-binding and harness then new successor only. Current source wires209owner after214 in Docker/directstartup/ordinaryglobalsetup, sourceLFpins, currentownedgatefixture normal initialorder, mandatoryreason/amendment UI+fiveclient/serverlocales; DRAFT notfull209PASS/PR/auditready. No runner remains/no productionconnectioncollectionoperation. ActualCl2096163271808 holds. PR296/mainCI38528593695 COMPLETE366/5566/fdf07fef,214+206undeployed/open; allhandoffs alreadyONCE. Samewriter/humancontent/103noapply/historyguards hold. Originals issue209-startup-impact-ui-focused/index.json.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-startup-impact-ui-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain startup impact and UI focused failures honestly')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':179,'failedTests':5,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
