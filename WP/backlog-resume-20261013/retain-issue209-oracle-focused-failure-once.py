"""Retain closed oracle-corrected209 first-fill failure and frozen source draft once, without claiming behavioral PASS."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-order-service-oracle-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes());assert summary['exit']==1 and summary['failed']==1 and summary['passedTests']==24 and summary['sourceUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
failed=[case for suite in report['testResults'] for case in suite['assertionResults'] if case['status']=='failed']
assert len(failed)==1 and all('The database refused an invalid workflow write.' in '\n'.join(case['failureMessages']) for case in failed)
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=['server/services/orderService.js','server/services/orderLineResolutionService.js','server/services/orderRevisionMigrationSource.js',
 'server/scripts/install_order_revisions.js','server/services/sampleAnalysisStateService.js','server/services/intakeWorkItemService.js',
 'server/services/workAttemptWriteService.js','server/services/workRepeatService.js','server/services/scientificAmendmentService.js',
 'server/prisma/schema.prisma','server/prisma/migrations/20261014000100_order_revision_contract/migration.sql',
 'server/tests/contracts/issue_209_order_revision_integration.test.js','server/tests/helpers/legacyWorkflowDatabase.js']
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_FAILED_HISTORICAL_OPEN_FIRST_FILL',
 'summary':summary,'cause':'Seven integration tests and17request tests pass; raw integer-timestamp historical OPEN fixture first fill is refused by an existing workflow guard. Exact guard code pending isolated inspection. No guard change.',
 'sourceDraftPaths':source,'scopeComment':6163271808,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 oracle corrected; real service/installer focused24 PASS/1 first-fill failure

Strict historical generated-schema oracle now declaresONLYnewnullableOrderLine.workItemId gap, oldDDL+allpriororacleentries/assertionsunchanged. NEWfocused CLOSEDFAIL08:01:59.832545UTC2/25:24PASS1FAIL0pending/allfrozeninputsunchanged/exactinventory/full368discovery. ActualinstallerDRY/APPLY/NO_OP retention/threehistoricalACTIVEs, reasonedALLsupersession+line/attempt equality, legacy single-match newattemptlink, each refusalcause/count/zero-write, and concurrentrevisiononeACTIVE passed. One historicalOPENNULL firstfill fixture fails existingworkflowguard; it was constructed byrawinteger-timestampINSERT, investigate/correctordinaryretained OPEN fixture shape before newrun, never weaken190/191guards or relinkNULL. Originalreport/logs/config/exit/sourcehashes retained issue209-order-service-oracle-focused/index.json; no full209PASS/PR/audit/productionoperation. Bothclosedfailuresimmutable, runner/retainersneverreplay. Samewriter/Cl209scope6163271808/humancontent/103noapply/historyguards hold. MainCI38528593695 same2242 stillACTIVE, no terminalPASS yet.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-order-service-oracle-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain real focused24-pass and historical first-fill fixture failure')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'failedFirstFill':1,'passedTests':24,'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
