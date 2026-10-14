"""Retain the closed five-suite failure and exact source draft once, before correction."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-http-schema-literal-regression'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['exit']==0 and summary['tests']==270 and summary['passedTests']==270 and summary['failed']==0 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-native-sqlite-guards-focused/index.json').read_bytes())['sourceDraftPaths']+[
 'server/services/workAttemptReservationService.js','server/tests/contracts/issue_209_order_revision_ui.test.js',
 'server/index.js','server/tests/globalSetup.js','Dockerfile','docker-entrypoint.sh','.gitattributes',
 'server/controllers/sampleController.js','server/tests/helpers/workflowWriteScanner.js','server/tests/helpers/qcGateFixture.js',
 'server/tests/helpers/workAttemptFixtures.js','client/src/components/sample/AnalysisUpdateModal.jsx','docs/audit/209-order-revisions.md']
source += ['server/tests/helpers/qcWorksheetUi.js','server/scripts/order_revision_impact.js','server/tests/contracts/issue_209_order_revision_http.test.js','server/scripts/rehearsal_deployment_readiness.cjs','server/tests/contracts/deployment_readiness_bootstrap.test.js','server/tests/contracts/reconcile_analyses.test.js','server/tests/contracts/edit_analyses_permission.test.js']
source += [directory+'/'+locale+'.json' for directory in ['client/src/translations','server/locales'] for locale in ['en','es','es-419','fr','pt']]
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_HTTP_SCHEMA_LITERAL_REGRESSION_PASS','summary':summary,
 'cause':'All10suites270testsPASS; native schema probes use explicit literal case form. All scanner predicates/negative assertions unchanged, migration and loader unchanged. Actual HTTP bothroutes, idempotency, scope, amendment boundaries, intake, historicalID retention, repeat/scientificINSERT, bootstrap, activeWAL/nested retained allocation and actual poststartprogramme pass. Prior264/2 and269/1 failures remain retained honestly.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 HTTP/readiness/retained impact/schema/scanners PASS10/270

Closed09:10:31.067466UTC10/10suites270/270tests0failedpendingtodo/allfrozeninputsunchanged/exactinventory/full370discovery. Both actualHTTP routes mandatoryreason/trimnormalization/idempotency/scopes/APPROVEDARCHIVEDDISPOSED409, initialintake throughoneorderService, unstartedWIremoval retainsoldlineID, realrepeat/scientificreservation INSERT links, oldrows/NULLhistoricalOPEN identities preserved. Native wrongtype/newFK/tamperedindex/partialguard refuse0; explicitliteraltestform passes unchanged scanners/allnegativeassertions. Readonlycollector activeWAL/originaltriple equality and allnestedcopies+diskallocation PASS; actualembeddedDockerpoststartprogramme onownedWALmodeDBwithoutsidecars PASS (not localDockerclaim). RealCI must verifyactualDocker proof/physicalLinuxallocations. StartupDocker/direct/globalsetup/readiness wired; currentownedfixturecontexts preserveoldassertions; LOCALactualJestteardown retention keepsDBs/scratchroots, stockCIhooks unchanged. Originalclosedlogs/report/config/command/hash/inventory/exit/summary/physicalretainedindex at issue209-http-schema-literal-regression/index.json. Prior264/2 0325f102 and269/1 2be8a0b6 failures immutable. No runner/full209PASS/PR/ready/audit/productionoperation. NEXTclientbuildlint/actualbrowserUI/broaderoldfixturecontexts/fullordinaryverification. ActualCl2096163271808/standingcontinuation authorized. PR296/main214CI completegreen366/5566/fdf07fef;214+206undeployed/open/allhandoffs onceimmutable. Samewriter/humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-http-schema-literal-regression-once.py').relative_to(root).as_posix(),(wp/'issue209-local-owned-physical-retention.cjs').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain HTTP startup retained impact and schema regression PASS')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':270,'failedTests':0,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
