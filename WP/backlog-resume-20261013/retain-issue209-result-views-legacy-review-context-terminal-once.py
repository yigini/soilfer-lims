"""Retain the actual closed 347-test ordinary sequential proof, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-result-views-legacy-review-context-singles';review=wp/'issue209-result-views-legacy-review-context-review'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes());assert summary['status']=='PASS' and summary['closedSuites']==6 and summary['closedTests']==summary['passedTests']==347 and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for p,d in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
reports=[]
for child in sorted(p for p in dest.iterdir() if p.is_dir()):
 r=json.loads((child/'report-original.json').read_bytes());s=json.loads((child/'observed-closed-summary.json').read_bytes())
 assert s['status']=='PASS' and int((child/'exit-original.txt').read_text())==0 and r['success'] and r['numTotalTestSuites']==1 and r['numTotalTests']==r['numPassedTests']==s['expectedTests']
 assert all(r[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites']);reports.append(r)
classification=json.loads((review/'pre-correction-classification.json').read_bytes());assert classification['reviewedBeforeChanges'] and len(classification['cases'])==28
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
source=json.loads((wp/'issue209-report-pdf-queue-bounds-context-singles/index.json').read_bytes())['sourceDraftPaths'];source=list(dict.fromkeys(source+['server/tests/contracts/'+n for n in ['audit_0_10_current_result_views.test.js','audit_0_5_legacy_review.test.js']]))
assert len(source)==88
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','rawFiles':raw,'reviewFiles':pins,'sourceDraftPaths':source,'all28OriginalCasesPassed':True,'totalOriginalFailedCasesResolved':492,'remainingOriginalUnresolved':158,'newMeaningfulCasesPriorScope':8,'futureFullExpectedTests':5642,'changedLegacyExpectations':[{'comment':6169628053,'oldKeyedAnalysesReceiptCount':0,'newCount':1}],'applicationFullyVerified':False,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified current-result views and legacy-review contexts CLOSED sequential PASS6/347\n\nClosed16:13:16.221238UTC6ordinarysingle-suite invocations15+16+139+32+112+33=347/347PASS0failedpendingtodo/exact6inventory/full370discovery/allfrozeninputs inclshared/generatedPrisma/heldoriginaltemplate unchanged/bothordinarysetups/worker512MB/blankNODE_OPTIONS/heldDBtriples. All28originalcases SOURCEclassified BEFOREcontexts: SOCview freshretainedhistorydeclaresonelegacyNULLorder usingexistingsentinel-safeidgenerator; legacyPH review ONLYevidence:true getsdeclaredorder/evidence:false remainsmissing. No other-lab Lab/policy/approval metadata invented; everyoldsource/assertion exactlyrecovered byremovingnewblocks. Ambiguousmethods/controlledunits/censoring/noSelection/invalidsupersededdata/savedpolicy/date/scope filters andlegacyACCEPT/RETURN/WAIVE/scalarflags/QCstate/permission/refusal assertions remainunchanged. Corekeymode139/orphans32/scanners145PASS; runtime/scientificSQL/scannerguards unchanged. All88draftpaths/46raw+4review blobs at issue209-result-views-legacy-review-context-singles/index.json; percase/before/proof correspondingreview. Combined492original650verified/158unresolved. Prior19batch8/358cbe and121batch7/473a489 honestunchanged; originaloneFKsetupcauseUNKNOWN/siteunchanged nowPASS, neverclaimmissingordercausedit. QC118twentycases source-readonly/NOTyetedited/classified/tested; inspecteachwitness andreservation beforeaddingownedordercontext. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. NativeWindowsLOCKED asobserved16:00/freshClaude7867734 snapshot; NOUIinput/message/authentication/currentthreaddraftread/furtherUIattempt. Unlockrequested/asyncreplypending; continueGH/repo, do notpoll/bypasslockedUI. Twooriginalnativeobservation/text alreadyretainedcbe, no newcheckpointmessage. Futurefull370expected5642/ONLYderivedhelpmanifestmutableoutputbeforeafterbyteshash/freezecore+others. AllfouractualClscopeanswerscomplete/no duplicatequestion/handoff/ack; ONEacceptedlegacyreceipt0to1 expectation listedindocs/provenance. Samewriter/readonlyimpactlists/approvednonzeroSTOP/noamendmentorderstep/backfill/relink/103noapply/humancontent/214+206sourcegreenundeployed/open/historyguards hold.\n\n'
native=wp/'issue209-native-locked-boundary-1600'
nativePins={f.relative_to(root).as_posix():{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in native.iterdir() if f.is_file()}
assert len(nativePins)==2
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+list(pins)+list(nativePins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'prepare-issue209-result-views-legacy-review-context-once.py').relative_to(root).as_posix(),(wp/'verify-issue209-result-views-legacy-review-context-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in {**raw,**pins,**nativePins}.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
for p in source:assert git('show',':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
git('commit','-m','audit(209): retain current result views and legacy review PASS347');head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*list({**raw,**pins,**nativePins})).split(b'\0'):
 if entry:
  meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set({**raw,**pins,**nativePins})
for p,pin in {**raw,**pins,**nativePins}.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'passedTests':347,'closedSingleSuites':6,'rawGitBlobsVerified':len(raw),'reviewBlobsVerified':len(pins),'sourceDraftPaths':88,'originalCasesResolved':492,'remaining':158,'productionOperations':0}))
