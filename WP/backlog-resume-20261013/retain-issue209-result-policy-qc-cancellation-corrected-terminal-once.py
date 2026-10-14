"""Retain current corrected sequential proof and its unchanged earlier LOQ/policy proofs once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-result-policy-qc-cancellation-query-corrected-singles'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes())
assert summary['status']=='PASS' and summary['closedSuites']==7 and summary['closedTests']==summary['passedTests']==437 and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for name,digest in before.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
reports=[]
for child in sorted(f for f in dest.iterdir() if f.is_dir()):
 observation=json.loads((child/'observed-closed-summary.json').read_bytes());report=json.loads((child/'report-original.json').read_bytes())
 assert observation['status']=='PASS' and int((child/'exit-original.txt').read_text())==observation['exit']==0 and report['success']
 assert report['numTotalTestSuites']==1 and report['numTotalTests']==report['numPassedTests']==observation['expectedTests']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
 reports.append(report)
assert len(reports)==7 and sum(r['numTotalTests'] for r in reports)==437
prior=wp/'issue209-result-policy-qc-cancellation-serial-singles'
priorIndex=json.loads((prior/'index.json').read_bytes());assert priorIndex['totalOriginalFailedCasesResolved']==309
for ordinal,name in [(1,'audit_0_15_duplicate_loq.test'),(2,'audit_1_0_lab_policies.test')]:
 child=prior/(f'{ordinal:02d}-'+name);report=json.loads((child/'report-original.json').read_bytes());assert report['success'] and report['numFailedTests']==0
 p='server/tests/contracts/'+name+'.js';assert before[p]==json.loads((prior/'source-after.json').read_bytes())[p]
 reports.append(report)
assert len(reports)==9 and sum(r['numTotalTests'] for r in reports)==536
review=wp/'issue209-result-policy-qc-cancellation-context-review';correctedReview=wp/'issue209-result-policy-qc-cancellation-query-corrected-review'
classification=json.loads((review/'pre-correction-classification.json').read_bytes());assert classification['status']=='CLASSIFIED_BEFORE_EDITS' and len(classification['cases'])==30
passed={(Path(s['name']).name,c['fullName']) for r in reports for s in r['testResults'] for c in s['assertionResults'] if c['status']=='passed'}
assert all((c['suite'],c['test']) in passed for c in classification['cases'])
proof=json.loads((correctedReview/'corrected-additions-original.json').read_bytes())
for row in proof:
 source=(root/row['path']).read_bytes();assert hashlib.sha256(source).hexdigest()==row['afterSha256']
 recovered=source.decode('utf8').replace('\r\n','\n')
 for added in reversed(row['additions']):assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered==(review/(Path(row['path']).name+'.before-original')).read_text(encoding='utf8')
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);f=Path(row['path']);assert f.exists(),f
 if f.is_file():held.append({'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc':summary['closedUtc'],'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=priorIndex['sourceDraftPaths'];assert len(source)==78
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
reviewPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in correctedReview.iterdir() if p.is_file()}
native=wp/'issue209-keyed-analyses-receipt-boundary'
nativePins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in native.iterdir() if p.name in ['native-actual-sent.txt','native-delivery-record.json']}
assert len(nativePins)==2
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR_PLUS_UNCHANGED_EARLIER_LOQ_POLICY_PROOFS','childClosedReports':7,'sourceDraftPaths':source,'rawFiles':raw,'reviewFiles':reviewPins,'nativeFiles':nativePins,'sourceAndTemplateInputsFrozen':len(before),'totalOriginalFailedCasesResolved':320,'remainingOriginalUnresolved':330,'combinedFocusedSuites':9,'combinedFocusedTests':536,'all30OriginalBatchCasesPassed':True,'applicationFullyVerified':False,'productionOperations':0,'scopeQuestion':6169593044,'actualAnswerPending':True,'legacyReceiptAssertionUnchanged':True,'originalFailureImmutable':'aa25effa110cb92dde6f1dba4047a79fb3b1f9a5','questionProgressObservation':'Question used last observed active scanner status; later poll established actual closure13:32:47.362199UTC and native handoff corrected the checkpoint before13:35:43UTC. Original question retained unchanged.'}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified result/policy/QC/cancellation corrected CLOSED sequential PASS7/437; new keyed-receipt question once\n\nCorrected10942 successor CLOSED13:32:47.362199UTC7freshordinarysingle-suite invocations56+100+57+47+32+112+33=437/437PASS0failedpendingtodo/exact7inventory/full370discovery/allfrozeninputs inclshared/generatedPrisma/heldoriginaltemplate unchanged/bothordinarysetups/stockassertions/oneworker512MB/blankNODE_OPTIONS/heldDBtriples. Earlier unchangedLOQ63/63+policy36/36 yield9focusedproofs536tests; no singlefullrunclaim. All30originalcases nowPASS, combined320/650verified,330unresolved. Onlynewfixturewrongrelation orderRevision correctedtoactualrevision; earlier3/155154PASS1FAIL preservedaa25. Alloldsource/assertions recovered exactly; literalPRE200newownednullablemodelshape/currentorders preserve importDRYAPPLYNOOP/alloldrows/drafts; orphanhistoricalimport/QClocks/cancellation/batchconflict/provenance/parser/UUID/scientific/refusal/runtimeSQL/scannersunchanged. CLOSEDoriginals issue209-result-policy-qc-cancellation-query-corrected-singles/index.json/all78appdraftpaths retained. No runner/full209PASS/PR/ready/audit/merge/kit/gate/productionoperation. Newquestion6169593044 postedONCE/currentsharedkeyedanalysesone-receiptvsoldzeroassert; assertion/runtimeunchanged pendingactualClanswer. NativefreshreturnedClaude7867734/LIMSAudit/Labworkflow/rightEMPTY/focuscaret/draftEND+HEAD/ONE Return/sentbubbleemptyright/Kneading verifiedupper13:35:43UTC; exacttext/record retained, centreHumanDraft canyougoandaskPip preserved. Neverduplicatequestion/handoff. Postedquestionprogress used lastobservedactive scanners; actuallaterpollclosure andnative correctedcheckpoint retainedhonestly. Samewriter/Cl6167740581 readonlylists/approvednonzeroSTOP/noamendmentorderstep/backfill/relink/103noapply/humancontent/214+206sourcegreenundeployed/historyguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 p=root/name;p.write_bytes(lead.encode()+p.read_bytes())
owned=list(raw)+list(reviewPins)+list(nativePins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-result-policy-qc-cancellation-query-corrected-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in {**raw,**reviewPins,**nativePins}.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
for name in source:assert git('show',':'+name)==(root/name).read_bytes().replace(b'\r\n',b'\n'),name
git('commit','-m','audit(209): retain corrected context PASS437 and native receipt boundary');head=git('rev-parse','HEAD').decode().strip()
for name,pin in {**raw,**reviewPins,**nativePins}.items():assert hashlib.sha256(git('show',head+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'passedTests':437,'closedSingleSuites':7,'rawGitBlobsVerified':len(raw),'reviewBlobsVerified':len(reviewPins),'nativeBlobsVerified':len(nativePins),'sourceDraftPaths':78,'originalFailedCasesResolved':320,'remainingOriginalUnresolved':330,'productionOperations':0}))
