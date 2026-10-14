"""Retain honest13 passing assertions with failed retained-parent teardown, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-workbench-request-order-context-singles';review=wp/'issue209-workbench-request-order-context-review'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes());assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['plannedSuites']==8 and summary['closedSuites']==1 and summary['plannedTests']==343 and summary['closedTests']==summary['passedTests']==13 and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for p,d in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
child=dest/'01-workbench_single_entry.test';r=json.loads((child/'report-original.json').read_bytes());assert r['numTotalTests']==r['numPassedTests']==13 and r['numFailedTests']==r['numPendingTests']==r['numTodoTests']==0 and r['numFailedTestSuites']==1 and int((child/'exit-original.txt').read_text())==1 and not r['success']
err=(child/'stderr-original.log').read_text(encoding='utf8');assert 'Invalid `prisma.orderLine.deleteMany()` invocation' in err and 'Foreign key constraint violated' in err
classification={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ALL13_ASSERTIONS_PASS_BUT_AFTERALL_PARENT_DELETION_REFUSED','afterAllCall':'prisma.orderLine.deleteMany({where:{revision:{sampleId:testSampleId}}})','actualProtection':'WorkAttempt retains its first legacy orderLineId; fixture cleanup must retain order parents, not weaken FK/history guards.','plannedCorrection':'Wrap only two original afterAll orderLine/sampleOrderRevision deletion calls in a no-retained-attempt guard; keep their literal statements and every assertion unchanged. Current header-only correction solved both original single-entry failures; no aggregate PASS or resolved-count increase until new closed successful successor.','remainingSevenSuitesNotExecuted':True,'productionOperations':0}
(review/'actual-teardown-refusal-classification.json').write_bytes((json.dumps(classification,indent=2)+'\n').encode())
ledger=dest/'physical-retention-original.jsonl';held=[]
for line in ledger.read_text(encoding='utf8').splitlines() if ledger.exists() else []:
 p=Path(json.loads(line)['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'filesystemCleanupLedgerPresent':ledger.exists(),'recordedTargets':len(held),'allRecordedTargetsRetained':True,'files':held,'suitePhysicalIdentityNotLoggedWhenLedgerAbsent':not ledger.exists(),'localGlobalTeardownExplicitNoOp':True,'originalHeldTemplateUnchanged':True},indent=2)+'\n').encode())
source=json.loads((wp/'issue209-single-entry-refusal-observation-singles/index.json').read_bytes())['sourceDraftPaths'];source=list(dict.fromkeys(source+['server/tests/contracts/'+n for n in ['workbench_draft_integrity.test.js','workbench_pipeline_twostep.test.js','qc_disposition_flagging.test.js']]));assert len(source)==113
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()};pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'summary':summary,'rawFiles':raw,'reviewFiles':pins,'sourceDraftPaths':source,'applicationFullyVerified':False,'totalOriginalFailedCasesResolved':597,'remainingOriginalUnresolved':53,'actualTeardownClassification':classification,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 header/order-context successor CLOSED partial teardown failure1/13\n\nClosed17:21:20.951987UTC first ordinary single13/13 assertions PASS/0failed assertions, but Jest exit1/one failed suite from original AFTERALL orderLine.deleteMany FK refusal. Old legacy first-attempt orderLineId is now correctly retained by #209; no runtime gap or FK relaxation. Header-only fixture correction fixed original two single-entry assertions; remaining seven planned suites NOT executed. Planned8/343 remains incomplete/NOTPASS, all frozen inputs unchanged/full370 discovery. Retain original report/commands/logs/exits/hash and actual teardown classifier at issue209-workbench-request-order-context-singles/index.json; all113 appdraft paths retained. NEXT unique correction wraps only original afterAll orderLine+revision cleanup in no-retained-attempt guard, preserves literal statements/assertions/owned immutable parents until DB teardown, then new unique successor. Diagnostic13/11/2/dd51 and both pretest config refusals/failed first retainer remain immutable; no replay. Combined original597/650 verified53remaining unchanged until closed success. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. Native512 checkpoint/Cl nothing-needed reply30049 once complete/no duplicates/human draft/cards preserved. Future full370expected5642/derived help manifest only mutable captured output/core/shared/Prisma/scenarios/template/allothers frozen; fouractualscopeanswers/ONEacceptedreceipt0to1/runtime orphan0writes/readonlyimpactlists/approvednonzeroSTOP/no amendmentorderstep/backfill/relink/103noapply/206+214 green undeployed/history guards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
owned=list(raw)+list(pins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'prepare-issue209-workbench-request-order-context-once.py').relative_to(root).as_posix(),(wp/'verify-issue209-workbench-request-order-context-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in {**raw,**pins}.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
for p in source:assert git('show',':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
git('commit','-m','audit(209): retain passing single-entry assertions with FK teardown failure')
head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*list({**raw,**pins})).split(b'\0'):
 if entry:
  meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set({**raw,**pins})
for p,pin in {**raw,**pins}.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'passingAssertions':13,'failedSuiteTeardown':1,'rawBlobsVerified':len(raw),'reviewBlobsVerified':len(pins),'sourceDraftPaths':113,'originalCasesResolved':597,'remaining':53,'productionOperations':0}))
