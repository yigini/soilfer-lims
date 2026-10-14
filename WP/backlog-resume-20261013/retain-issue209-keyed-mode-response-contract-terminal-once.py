"""Retain actual closed four-suite receipt/response/core/scanner proof, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-keyed-mode-response-contract-singles'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes())
assert summary['closedSuites']==4 and summary['closedTests']==316 and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
reports=[]
for child in sorted(f for f in dest.iterdir() if f.is_dir()):
 observation=json.loads((child/'observed-closed-summary.json').read_bytes());report=json.loads((child/'report-original.json').read_bytes())
 assert int((child/'exit-original.txt').read_text())==observation['exit'] and report['numTotalTestSuites']==1 and report['numTotalTests']==observation['expectedTests']
 reports.append(report)
assert len(reports)==4 and sum(r['numTotalTests'] for r in reports)==316
passed=summary['status']=='PASS' and all(r['success'] and r['numTotalTests']==r['numPassedTests'] and all(r[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites']) for r in reports)
review=wp/'issue209-keyed-mode-response-contract-review';classification=json.loads((review/'pre-correction-classification.json').read_bytes());assert classification['reviewedBeforeChanges'] and classification['actualDirection']==6169628053
if passed:
 cases={(Path(s['name']).name,c['fullName']) for r in reports for s in r['testResults'] for c in s['assertionResults'] if c['status']=='passed'}
 assert all((c['suite'],c['test']) in cases for c in classification['cases'])
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);f=Path(row['path']);assert f.exists(),f
 if f.is_file():held.append({'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc':summary['closedUtc'],'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-result-policy-qc-cancellation-query-corrected-singles/index.json').read_bytes())['sourceDraftPaths']
source=list(dict.fromkeys(source+['server/tests/contracts/audit_1_2_state_authority.test.js']));assert len(source)==79
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
reviewPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
resolved=324 if passed else 320;remaining=650-resolved
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','childClosedReports':4,'sourceDraftPaths':source,'rawFiles':raw,'reviewFiles':reviewPins,'sourceAndTemplateInputsFrozen':len(before),'totalOriginalFailedCasesResolved':resolved,'remainingOriginalUnresolved':remaining,'applicationFullyVerified':False,'actualScopeAnswer':6169628053,'authorizedChangedLegacyExpectations':[{'test':'analyses adding work to SUBMITTED_FULL atomically resumes processing','oldReceiptCount':0,'newReceiptCount':1,'reason':'Supplied key must never be ignored; sameTX receipt both modes under6169628053'}],'newMeaningfulCases':8,'futureFullExpectedTests':5642,'productionOperations':0,'questionAndNativeAlreadyCompleteNeverRepeat':True}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'## 2026-10-14 #209 actual keyed-mode and original-response contract CLOSED {summary["status"]}4/316\n\nClosed{summary["closedUtc"]}4freshordinarysingle-suite invocations139+32+112+33=316tests/{summary["passedTests"]}PASS; exact4inventory/full370discovery/allfrozeninputs inclshared/generatedPrisma/heldoriginaltemplate unchanged/bothordinarysetups/stockassertions/worker512MB/blankNODE_OPTIONS/heldDBtriples. FULLactualCl6169628053 accepted one scoped sameTX keyedreceiptbothmodes/identicalreplayoriginalresponse0writes/differingpayload409/crossmode409/nokey0. Mode includedinnormalizedpayloadhash; replayonlyprojectsoutinternalhash/no storedrowrewrite. ONElegacyreceipt0assertto1 explicitlyaccepted; two reasoninputs before unchangedorder/receiptrollbackasserts. Eightnewindependent cases cover bothmodes/alltable0write replay/differingreason/crossmode/no-key; originaltestbodyexactlyrecoverable exceptauthorizedexpectation+inputs. Coreorphans/scientificrefusal/approvedSTOP/intakeTXrollback/runtimeSQL/scanners checked. Originalfourfailedauthoritycases classifiedbeforechanges; combined{resolved}/650originalcasesverified/{remaining}unresolved. All79appdraftpaths/rawclosedchildreports/commands/logs/exits/sourcehashes/provenance at issue209-keyed-mode-response-contract-singles/index.json. Futurefull370expected5642; capturegeneratedhelpmanifestONLY asmutableoutput before/afterbyteshash/freezecore+others. No runner/newfull209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. Newquestion6169593044/actualanswer6169628053/nativehandoff alreadyONCEcomplete neverduplicate/acknotneeded. Earlier typoaa25/pathlimitretainer28d/objectrecovery681 immutable. Samewriter/Cl6167740581 readonlyimpactlists/approvednonzeroSTOP/noamendmentorderstep/backfill/relink/103noapply/humancontent/214+206sourcegreenundeployed/historyguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 p=root/path;p.write_bytes(lead.encode()+p.read_bytes())
owned=list(raw)+list(reviewPins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'prepare-issue209-keyed-mode-response-contract-once.py').relative_to(root).as_posix(),(wp/'verify-issue209-keyed-mode-response-contract-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in {**raw,**reviewPins}.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain keyed mode and response contract '+summary['status']+'316');head=git('rev-parse','HEAD').decode().strip()
objects={}
for entry in git('ls-tree','-r','-z',head,'--',*list({**raw,**reviewPins})).split(b'\0'):
 if entry:
  meta,path=entry.split(b'\t',1);objects[path.decode()]=meta.decode().split()[2]
assert set(objects)==set({**raw,**reviewPins})
for path,pin in {**raw,**reviewPins}.items():assert hashlib.sha256(git('cat-file','blob',objects[path])).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'status':summary['status'],'passedTests':summary['passedTests'],'closedSingleSuites':4,'rawGitBlobsVerified':len(raw),'reviewBlobsVerified':len(reviewPins),'sourceDraftPaths':79,'originalFailedCasesResolved':resolved,'remainingOriginalUnresolved':remaining,'futureFullExpectedTests':5642,'productionOperations':0}))
