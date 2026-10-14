"""Retain the closed five-suite failure and exact source draft once, before correction."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-historical-context-family-regression'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['exit']==1 and summary['tests']==246 and summary['passedTests']==181 and summary['failed']==65 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-native-sqlite-guards-focused/index.json').read_bytes())['sourceDraftPaths']+[
 'server/services/workAttemptReservationService.js','server/tests/contracts/issue_209_order_revision_ui.test.js',
 'server/index.js','server/tests/globalSetup.js','Dockerfile','docker-entrypoint.sh','.gitattributes',
 'server/controllers/sampleController.js','server/tests/helpers/workflowWriteScanner.js','server/tests/helpers/qcGateFixture.js',
 'server/tests/helpers/workAttemptFixtures.js','client/src/components/sample/AnalysisUpdateModal.jsx','docs/audit/209-order-revisions.md']
source += ['server/services/orderAttemptWriteService.js','server/tests/helpers/qcWorksheetUi.js','server/scripts/order_revision_impact.js','server/tests/contracts/issue_209_order_revision_http.test.js','server/scripts/rehearsal_deployment_readiness.cjs','server/tests/contracts/deployment_readiness_bootstrap.test.js','server/tests/contracts/reconcile_analyses.test.js','server/tests/contracts/edit_analyses_permission.test.js']
source += [directory+'/'+locale+'.json' for directory in ['client/src/translations','server/locales'] for locale in ['en','es','es-419','fr','pt']]
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_HISTORICAL_CONTEXT_FAMILY_REGRESSION_FAILURE','summary':summary,
 'cause':'Closed10suites246tests181PASS65FAIL across7suites. Older positive attempt/equipment/amendment/report fixtures lack current order context/schema; a raw container negative INSERT is preempted by ORDER_LINE_REQUIRED; wiring source assertion still reads the retained thin wrapper instead of the new orderService authority. Preserve all assertions/guards and supply explicit fixture/context/source-target corrections. These are observed failures, not full application or CI PASS. Raw report contains every actual failure.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 broader retained-context family181 PASS65 FAIL, closed honestly

Closed09:43:26.727408UTC10suites246tests181PASS65FAIL/7failed3passed/0pending/allfrozeninputsunchanged/exactinventory/full370discovery. Actual failures: older positive attempt/equipment/amendment/report fixtures lack new currentorder context/schema; raw206aliquot-negative INSERT firsthitsORDER_LINE_REQUIRED; wiring lexicalassert reads oldsampleAnalysisStateService thinwrapper instead ofneworderService. Preserve allruntimeSQL/source/scanner/historyguards andstockassertion predicates; supplyexplicit ownedfixture contexts, validorderline inputbeforealiquot probe, retargetwiring sourceauthority. DoNOTintroduce runtimeabsencecatch/automaticlegacyrepair/backfill/relink. Originals issue209-historical-context-family-regression/index.json; allJestteardownDB/scratchtargets retained/terminalphysicalindex. Existing10/274 current209 regressionPASSfbfc604d/stablecode actualnativewrapper+first-repeat-scientificrollback proof and clientbuildlint/actualChromiumPASS22a5d072 remainvalidfocusedproof, NOTfullserverPASS/PR/ready/audit. Nativeprogresscheckpoint alreadySENTONCE09:36:39upperbound/ab4d0a95, neverrepeat; centreHUMANDRAFT preserved. No runner/productionconnectioncollectionoperation. ActualCl2096163271808/nativeguard-code direction1c153fda/standingcontinuation authorized;214mainCI completegreen366/5566/214+206undeployedopen/oldhandoffs immutable. Samewriter/humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-historical-context-family-regression-once.py').relative_to(root).as_posix(),(wp/'issue209-local-owned-physical-retention.cjs').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain broader historical fixture context failures honestly')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':181,'failedTests':65,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
