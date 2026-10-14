"""Retain the closed partial sequential failure honestly; never replay the runner."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-result-policy-qc-cancellation-serial-singles'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes())
assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['closedSuites']==3 and summary['closedTests']==155 and summary['passedTests']==154 and summary['sourceUnchanged'] and not summary['selectedInventoryEqual']
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for name,digest in before.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
reports=[]
for child in sorted(f for f in dest.iterdir() if f.is_dir()):
 report=json.loads((child/'report-original.json').read_bytes());observation=json.loads((child/'observed-closed-summary.json').read_bytes())
 assert int((child/'exit-original.txt').read_text())==observation['exit'] and report['numTotalTestSuites']==1 and report['numTotalTests']==observation['expectedTests']
 reports.append(report)
assert len(reports)==3 and sum(r['numFailedTests'] for r in reports)==1
failed=[c for r in reports for s in r['testResults'] for c in s['assertionResults'] if c['status']=='failed'];assert len(failed)==1 and failed[0]['fullName']=='conflicting attempt and work item batches refuse with all-table zero writes'
assert 'Unknown argument `orderRevision`' in '\n'.join(failed[0]['failureMessages'])
review=wp/'issue209-result-policy-qc-cancellation-context-review';classification=json.loads((review/'pre-correction-classification.json').read_bytes())
assert classification['status']=='CLASSIFIED_BEFORE_EDITS' and len(classification['cases'])==30
passed={(Path(s['name']).name,c['fullName']) for r in reports for s in r['testResults'] for c in s['assertionResults'] if c['status']=='passed'}
resolved=[c for c in classification['cases'] if (c['suite'],c['test']) in passed];assert len(resolved)==19
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);f=Path(row['path']);assert f.exists(),f
 if f.is_file():held.append({'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc':summary['closedUtc'],'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-fraction-import-export-uuid-serial-singles/index.json').read_bytes())['sourceDraftPaths']
source=list(dict.fromkeys(source+['server/tests/contracts/'+name for name in ['audit_0_15_duplicate_loq.test.js','audit_1_0_lab_policies.test.js','audit_1_5_result_writes.test.js','audit_4_7_instrument_import_install.test.js','audit_0_2_qc_lock.test.js','audit_1_6_intake_cancellation.test.js']]))
assert len(source)==78
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
reviewPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'applicationFullyVerified':False,'sourceDraftPaths':source,'rawFiles':raw,'reviewFiles':reviewPins,'originalCasesResolvedInThisPartialRun':resolved,'totalOriginalFailedCasesResolved':309,'remainingOriginalUnresolved':341,'productionOperations':0,'failureCause':'New fixture lookup used unknown Prisma relation orderRevision; actual field is revision. No runtime change or guard failure. Four selected fixture suites and core/scanners were not executed.'}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified result/policy/QC/cancellation successor CLOSED PARTIAL FAILURE3/155:154PASS1FAIL\n\nClosed13:28:04.775170UTC/allfrozeninputs unchanged/full370discovery. First LOQ63/63 andpolicy36/36 PASS; resultwrites55/56 PASS, one newfixture query uses wrong Prisma relation orderRevision (actualrevision), before original conflicting-batch predicate. Runner stopped honestly; import/QC/cancellation/core/scanners NOTexecuted. All30originalcases SOURCEclassified beforeedits/onlynewusableordercontexts orisolatednullablePRE200shape; everyoldsource/assertion recovered byremovingnewblocks.19originalcases provedPASS, combined309/650verified,341remaining. All78appdraftpaths retained at issue209-result-policy-qc-cancellation-serial-singles/index.json, closedchild originals/fullrawlogs/sourcehashes/heldDBtriples. Correct ONLYnewfixture relation lookup in next unique successor, preserve originalbatchfault/zero-writeasserts. Analyses-key receipt0 oldexpectation unresolvedseparately/noassertchanged orruntimeweakening. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. Samewriter/Clscope/runtimeorphans0write/readonlylists/approvednonzeroSTOP/noamendmentorderstep/backfill/relink/humancontent/103noapply/214+206sourcegreenundeployed/historyguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 p=root/name;p.write_bytes(lead.encode()+p.read_bytes())
owned=list(raw)+list(reviewPins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'prepare-issue209-result-policy-qc-cancellation-context-once.py').relative_to(root).as_posix(),(wp/'verify-issue209-result-policy-qc-cancellation-serial-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in {**raw,**reviewPins}.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
for name in source:assert git('show',':'+name)==(root/name).read_bytes().replace(b'\r\n',b'\n'),name
git('commit','-m','audit(209): retain classified partial context failure154 of155');head=git('rev-parse','HEAD').decode().strip()
for name,pin in {**raw,**reviewPins}.items():assert hashlib.sha256(git('show',head+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'closedTests':155,'passedTests':154,'failedTests':1,'originalCasesNowVerified':309,'sourcePaths':78,'rawBlobsVerified':len(raw),'reviewBlobsVerified':len(reviewPins),'productionOperations':0}))
