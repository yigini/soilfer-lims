"""Retain the actual closed 473-test ordinary sequential proof, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-workbench-review-legacy-context-singles';review=wp/'issue209-workbench-review-legacy-context-review'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes());assert summary['status']=='PASS' and summary['closedSuites']==7 and summary['closedTests']==summary['passedTests']==473 and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for p,d in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
reports=[]
for child in sorted(p for p in dest.iterdir() if p.is_dir()):
 r=json.loads((child/'report-original.json').read_bytes());s=json.loads((child/'observed-closed-summary.json').read_bytes())
 assert s['status']=='PASS' and int((child/'exit-original.txt').read_text())==0 and r['success'] and r['numTotalTestSuites']==1 and r['numTotalTests']==r['numPassedTests']==s['expectedTests']
 assert all(r[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites']);reports.append(r)
classification=json.loads((review/'pre-correction-classification.json').read_bytes());assert classification['reviewedBeforeChanges'] and len(classification['cases'])==121
passed={(Path(s['name']).name,c['fullName']) for r in reports for s in r['testResults'] for c in s['assertionResults'] if c['status']=='passed'}
assert all((c['suite'],c['test']) in passed for c in classification['cases'])
for row in json.loads((review/'fixture-additions-original.json').read_bytes()):
 raw=(root/row['path']).read_bytes();assert hashlib.sha256(raw).hexdigest()==row['afterSha256'];recovered=raw.decode().replace('\r\n','\n')
 for added in reversed(row['additions']):assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered==(review/(Path(row['path']).name+'.before-original')).read_text(encoding='utf8')
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 p=Path(json.loads(line)['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc':summary['closedUtc'],'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
def git(*a):return subprocess.run(['git',*a],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-keyed-mode-response-contract-singles/index.json').read_bytes())['sourceDraftPaths'];source=list(dict.fromkeys(source+['server/tests/contracts/'+n for n in ['audit_1_2_workbench_state.test.js','audit_0_6_review_atomicity.test.js','audit_1_2_legacy_results.test.js']]))
assert len(source)==82
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','rawFiles':raw,'reviewFiles':pins,'sourceDraftPaths':source,'all121OriginalCasesPassed':True,'totalOriginalFailedCasesResolved':445,'remainingOriginalUnresolved':205,'newMeaningfulCasesPriorScope':8,'futureFullExpectedTests':5642,'changedLegacyExpectations':[{'comment':6169628053,'oldKeyedAnalysesReceiptCount':0,'newCount':1}],'applicationFullyVerified':False,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified workbench/review/legacy context CLOSED sequential PASS7/473\n\nClosed15:52:50.335317UTC7ordinarysingle-suite invocations86+33+38+139+32+112+33=473/473PASS0failedpendingtodo/exact7inventory/full370discovery/allfrozeninputs inclshared/generatedPrisma/heldoriginaltemplate unchanged/bothordinarysetups/worker512MB/blankNODE_OPTIONS/heldDBtriples.121originalcases SOURCEclassified BEFOREchanges: declaredusablelegacyNULLorders beforeNEWownedexecutionwitnesses, onlyseparatelyseededcanonicalEC andexplicitSAND/SILT/CLAYdiagnosticwitnesses getmatchingNEWownedlines. Everyoldsource/assertion exactlyrecoveredbyremovingnewblocks; operationalworkbench/closurecustodyaliases/approvalmetadata/CAS/QClocks/RETURNidentity/values40-30-17/requiredAnalyses/refusal/snapshot/auditrollback/scientificSQL/scannerguards unchanged. Generatedclosurealreadyhasnullablecolumn/NODDLchange. Actual6169628053 keyedmode/response139cases/core32+scanners145 alsoPASS; docs209 updatedmode-scope/originalresponse/ONEacceptedlegacyexpectationreason. All82appdraftpaths/rawclosedreports/logs/commands/exits/hash/heldphysicalindex at issue209-workbench-review-legacy-context-singles/index.json; classifiedbeforebytes/additionproof in correspondingcontext-review. Combined445original650casesverified/205unresolved. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. Next19report/PDF/queue/bounds cases source-readbutNOTedited/verified; continuepercaseclassification. Futurefull370expected5642/derivedhelpmanifestONLYmutableoutputbeforeafterbyteshash/freezecore+allothers. Actualscope6163271808/6166518424/6167740581/6169628053 complete/no repeatedquestion/handoff/ack. Legacyruntimeorphans0writes/readonlyimpactlists/approvednonzeroSTOP/noamendmentorderstep/backfill/relink. Samewriter/103noapply/humancontent/214+206sourcegreenundeployed/open/historyguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+list(pins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'prepare-issue209-workbench-review-legacy-context-once.py').relative_to(root).as_posix(),(wp/'verify-issue209-workbench-review-legacy-context-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in {**raw,**pins}.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
for p in source:assert git('show',':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
git('commit','-m','audit(209): retain classified workbench review legacy PASS473');head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*list({**raw,**pins})).split(b'\0'):
 if entry:
  meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set({**raw,**pins})
for p,pin in {**raw,**pins}.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'passedTests':473,'closedSingleSuites':7,'rawGitBlobsVerified':len(raw),'reviewBlobsVerified':len(pins),'sourceDraftPaths':82,'originalCasesResolved':445,'remaining':205,'productionOperations':0}))
