"""Retain closed ordinary-reservation209 focused PASS and frozen source draft once, without claiming behavioral PASS."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-native-sqlite-guards-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes());assert summary['exit']==0 and summary['failed']==0 and summary['passedTests']==28 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
assert report['numTotalTestSuites']==report['numPassedTestSuites']==2 and report['numTotalTests']==report['numPassedTests']==28
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
 'summary':summary,'cause':'All28 tests pass, including native SQLite guard-code refusals and unchanged-row proofs plus real repeat insertion. Previous26pass/2Prisma-wrapper assertions preserved; exact runtime/source guards unchanged for this diagnostic successor.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 real shared service/owner/insert-guard/repeat focused PASS2/28

NEWnativeSQLite diagnostic successor CLOSEDPASS08:17:48.531165UTC2/2suites28/28tests0failedpendingtodo/allfrozeninputsunchanged/exactinventory/full368discovery. ActualinstallerDRY/APPLY/NO_OP/originalDB-WAL-SHM+rows retention/threehistoricalACTIVEs; reasonedALLsupersession+oldlines/attempts equality; legacy single-matchnewattemptlink/all3refusalcauses/counts/zero-writes; concurrencyoneACTIVE; historicalOPENfirstfillkeepingNULL+allidentityscalars; rawSQLiteambiguouslineinsertrefusal/linkidentityimmutability+zero-rowchanges; REALrepeat receiveslineatINSERT PASS. Earlier26pass/2negative-message failures were PrismaGenericForeignKey wrappers; stronger directSQLitechecks verifyliteralguardcodes withoutweakeninganypredicate/sourceguard. CurrentmigrationSHA5c51f423689b1c726e16c12cdce7b381574661017cdb622eb3f562957a18304c/loaderSHAba6baba68eceb2355cbc68a7a6bba83a1e3c7f168a30bdf8a35df80c8dde1093. All3closedfailedsuccessors remainhonest; consumedrunners/retainers NEVERreplay. Originals at issue209-native-sqlite-guards-focused/index.json. ThisisFOCUSEDdraftproofONLY/NO full209PASS/PR/auditready. NEXTstartupDocker/globalsetup/readiness/scanner exactsourcepins/roles/routes/UIlocales/real scientificamendment insertlink/readonlykitcollector+allocation/scopedregression/fullordinaryverification. No runnerremains/no productionconnectioncollectionoperation. MainCI38528593695 actualCLOSEDSUCCESS366/5566/allrealDocker/policysnapshotproof originals16verifiedblobspushedfdf07fef. PR296actualPASS+merge2242 andbothnativehandoffs complete/neverrepeat, #214+#206undeployed/open. NativeMAINCI+actual209scope progresscheckpoint SENTONCE08:15:06upperbound verified/ClDiscombobulating/centreHUMANDRAFT preserved, retained8ab53913; do notduplicateprogressorfinalauditrequests. Samewriter/Cl2096163271808/humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-native-sqlite-guards-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain native SQLite insert guards and real repeat focused PASS')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':28,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
