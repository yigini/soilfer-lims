"""Retain the actual13/11/2 closed diagnostic and both pretest refusals, once."""
import datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-single-entry-refusal-observation-singles';review=wp/'issue209-single-entry-refusal-observation-review'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes());assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['closedSuites']==1 and summary['closedTests']==13 and summary['passedTests']==11 and summary['fullDiscovery']==370 and summary['sourceUnchanged']
child=dest/'01-workbench_single_entry.test';r=json.loads((child/'report-original.json').read_bytes());assert r['numTotalTests']==13 and r['numPassedTests']==11 and r['numFailedTests']==2 and not r['success'] and int((child/'exit-original.txt').read_text())==1
assert r['numPendingTests']==r['numTodoTests']==0
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for p,d in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
rawstderr=(child/'stderr-original.log').read_text(encoding='utf8');m=re.search(r'\[issue209-single-entry-actual-response\] (\{[^\n]+\})',rawstderr);assert m
actual=json.loads(m.group(1));assert actual=={'status':500,'body':{'error':'Failed to update analyses'}}
assert "Cannot read properties of undefined (reading 'x-idempotency-key')" in rawstderr
fixture=root/'server/tests/contracts/workbench_single_entry.test.js';controller=root/'server/controllers/sampleController.js';route=root/'server/routes/sampleRoutes.js'
assert "req.headers['x-idempotency-key']" in controller.read_text(encoding='utf8')
assert "router.put('/:id/analyses', checkPermission('EDIT_ANALYSES'), sampleController.updateSampleAnalyses);" in route.read_text(encoding='utf8')
analysis={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'actualResponse':actual,'actualRefusal':'MOCK_REQ_HEADERS_ABSENT_BEFORE_ORDER_SERVICE','failureBeforeReconciliation':True,'runtimeReachabilityClassification':'Mounted Express HTTP request has headers; repository route is the sole non-test caller. Direct fixture mock omitted the HTTP request object primitive. Existing actual mounted analyses keyed/no-key route proofs pass. No current runtime missing-order/reconciliation fault observed.','plannedCorrection':'Add req.headers={} at only the direct mock input site, remove only the new diagnostic console after retention. Keep original ACTIVE revision1/PH+EC lines, required analyses, POTASSIUM definition/request/reason and all revision2/three-line/supersession/workspace assertions unchanged.','controllerSha256':hashlib.sha256(controller.read_bytes()).hexdigest(),'routeSha256':hashlib.sha256(route.read_bytes()).hexdigest(),'productionInspections':0,'runtimeChanges':0,'originalCasesResolved':597,'remaining':53}
(review/'actual-refusal-classification.json').write_bytes((json.dumps(analysis,indent=2)+'\n').encode())
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 p=Path(json.loads(line)['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
source=json.loads((wp/'issue209-profile-scope-workspace-context-singles/index.json').read_bytes())['sourceDraftPaths'];source=list(dict.fromkeys(source+['server/tests/contracts/workbench_single_entry.test.js']));assert len(source)==110
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()};pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'summary':summary,'rawFiles':raw,'reviewFiles':pins,'sourceDraftPaths':source,'applicationFullyVerified':False,'totalOriginalFailedCasesResolved':597,'remainingOriginalUnresolved':53,'actualRefusalClassification':analysis,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 single-entry real refusal CLOSEDFAIL13/11/2 retained before correction\n\nActual diagnostic closed17:13:52.602372UTC13tests11PASS2FAIL/zero pendingtodo/all frozen unchanged/exact1inventory/full370. Original mock has valid ACTIVE revision1/PH+EC legacy lines and reasoned POTASSIUM request; failure is not absent-order context. Actual console response500 Failed to update analyses with TypeError reading x-idempotency-key from undefined req.headers BEFORE order service. Source route is sole non-test caller/mounted Express supplies headers; actual mounted keyed/no-key route proofs already pass. Classification: direct request mock primitive missing, no runtime reconciliation gap observed/no production inspection. Next only add req.headers={} at that mock input and remove only NEW diagnostic console; preserve every old source/assertion/input value/order/history/POTASSIUM definition. Two copied diagnostic helpers refused BEFORE tests on renamed prerequisite filenames; both original helpers/records unchanged. New guards-bound helper verified all21 prerequisite paths then ONE actual diagnostic. Closed raws/review/actual analysis at issue209-single-entry-refusal-observation-singles/index.json; all110 current draftpaths retained (diagnostic addition only). Prior profile17/333275712 passes unchanged/combined597of650/53unresolved. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/production operation. No native question/ack needed; actual unlocked512 checkpoint/Cl nothing-needed reply30049 complete, human draft/cards untouched. Future full370expected5642/only derived help manifest mutable captured output/core source and allother frozen; four scope answers/ONE accepted receipt expectation/legacy runtime orphan zero-write refusal/readonly lists/approvednonzeroSTOP/no amendmentorderstep/backfill/relink/103noapply/206+214 green undeployed/history guards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
helpers=['prepare-issue209-single-entry-refusal-observation-once.py','verify-issue209-single-entry-refusal-observation-once.py','verify-issue209-single-entry-refusal-observation-context-bound-once.py','verify-issue209-single-entry-refusal-observation-guards-bound-once.py']
owned=list(raw)+list(pins)+source+readmes+[(wp/n).relative_to(root).as_posix() for n in helpers]+[Path(__file__).relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in {**raw,**pins}.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
for p in source:assert git('show',':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
git('commit','-m','audit(209): retain actual single-entry request context refusal')
head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*list({**raw,**pins})).split(b'\0'):
 if entry:
  meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set({**raw,**pins})
for p,pin in {**raw,**pins}.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'closedTests':13,'passed':11,'failed':2,'rawBlobsVerified':len(raw),'reviewBlobsVerified':len(pins),'sourceDraftPaths':110,'originalCasesResolved':597,'remaining':53,'productionOperations':0}))
