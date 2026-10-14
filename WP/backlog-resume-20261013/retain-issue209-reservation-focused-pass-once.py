"""Retain closed ordinary-reservation209 focused PASS and frozen source draft once, without claiming behavioral PASS."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-order-service-reservation-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes());assert summary['exit']==0 and summary['failed']==0 and summary['passedTests']==25 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
assert report['numTotalTestSuites']==report['numPassedTestSuites']==2 and report['numTotalTests']==report['numPassedTests']==25
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=['server/services/orderService.js','server/services/orderLineResolutionService.js','server/services/orderRevisionMigrationSource.js',
 'server/scripts/install_order_revisions.js','server/services/sampleAnalysisStateService.js','server/services/intakeWorkItemService.js',
 'server/services/workAttemptWriteService.js','server/services/workRepeatService.js','server/services/scientificAmendmentService.js',
 'server/prisma/schema.prisma','server/prisma/migrations/20261014000100_order_revision_contract/migration.sql',
 'server/tests/contracts/issue_209_order_revision_integration.test.js','server/tests/helpers/legacyWorkflowDatabase.js']
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_REAL_SERVICE_INSTALLER_FOCUSED_PASS',
 'summary':summary,'cause':'All25 tests pass, including retained OPEN first fill with originalNULL and every immutable identity scalar unchanged using ordinary pre209Prisma reservation timestamps. Both prior failures remain honest. No runtime guard or timestamp normalization change.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 real shared service/installer focused PASS2/25

NEWordinary-reservation-shape focused successor CLOSEDPASS08:05:53.908904UTC2/2suites25/25tests0failedpendingtodo/allfrozeninputsunchanged/exactinventory/full368discovery. ActualownerDRY/APPLY/NO_OP/originaltripleretention/threehistoricalACTIVEs, reasonedALLsupersession+unchangedoldlines/attempts, legacyexactsinglematch newattemptlink, allthree refusalcauses/counts/zero-write, concurrencyoneACTIVE and historicalOPENfirstfillkeepingNULL+everyidentityscalar unchanged PASS. First8-failure strictoracle refusal and second1-failure rawinteger-timestampOPENfixture remainretainedhonestly; newtestusesordinaryPrisma reservation BEFORE209installation, NO runtimeguard/timestampnormalizationchange. Rawclosed report/logs/config/command/exit/sourcehashes at issue209-order-service-reservation-focused/index.json. ThisisFOCUSEDdraftproofONLY, notfull209PASS/PR/audit/ready. StartupDocker/globalsetup/readiness/scanner sourcepins/roles/routes/UI+locales/repeat+scientificamendment insertion/readonlykitcollector/scopedregression/fullverification remain next. MainCI38528593695 CLOSEDGREEN on2242 independentlyretained separately; #214+#206remainundeployed/open/no kitgateproductionoperation. Samewriter/actualCl2096163271808/humancontent/103noapply/historyguards hold. No runnerremains; consumedfocusedhelpersneverreplay.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-order-service-reservation-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain real shared service and historical-null first-fill focused PASS')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':25,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
