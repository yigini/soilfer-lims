"""Retain the actual closed 358-test ordinary sequential proof, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-report-pdf-queue-bounds-context-singles';review=wp/'issue209-report-pdf-queue-bounds-context-review'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes());assert summary['status']=='PASS' and summary['closedSuites']==8 and summary['closedTests']==summary['passedTests']==358 and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for p,d in before.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
reports=[]
for child in sorted(p for p in dest.iterdir() if p.is_dir()):
 r=json.loads((child/'report-original.json').read_bytes());s=json.loads((child/'observed-closed-summary.json').read_bytes())
 assert s['status']=='PASS' and int((child/'exit-original.txt').read_text())==0 and r['success'] and r['numTotalTestSuites']==1 and r['numTotalTests']==r['numPassedTests']==s['expectedTests']
 assert all(r[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites']);reports.append(r)
classification=json.loads((review/'pre-correction-classification.json').read_bytes());assert classification['reviewedBeforeChanges'] and len(classification['cases'])==19
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
source=json.loads((wp/'issue209-workbench-review-legacy-context-singles/index.json').read_bytes())['sourceDraftPaths'];source=list(dict.fromkeys(source+['server/tests/contracts/'+n for n in ['audit_0_8_report_truthfulness.test.js','report_pdf.test.js','audit_0_11_workbench_queue.test.js','issue_281_cross_check_bounds.test.js']]))
assert len(source)==86
raw={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps({'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','rawFiles':raw,'reviewFiles':pins,'sourceDraftPaths':source,'all19OriginalCasesPassed':True,'totalOriginalFailedCasesResolved':464,'remainingOriginalUnresolved':186,'newMeaningfulCasesPriorScope':8,'futureFullExpectedTests':5642,'changedLegacyExpectations':[{'comment':6169628053,'oldKeyedAnalysesReceiptCount':0,'newCount':1}],'originalForeignKeyCause':'UNCONFIRMED; unchanged original FK site passed independently; new context is after that site, not a guard correction', 'applicationFullyVerified':False,'productionOperations':0},indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified report/PDF/queue/bounds contexts CLOSED sequential PASS8/358; native read blocked by Windows lock\n\nClosed15:59:53.031407UTC8ordinarysingle-suite invocations18+5+2+17+139+32+112+33=358/358PASS0failedpendingtodo/exact8inventory/full370discovery/allfrozeninputs inclshared/generatedPrisma/heldoriginaltemplate unchanged/bothordinarysetups/worker512MB/blankNODE_OPTIONS/heldDBtriples. All19originalcases SOURCEclassified BEFOREcontext additions; owned approvedPH/fivePDFowners/controlledinstrumentowner/fractioncarbonnitrogen getdeclaredlegacyNULLorders beforeexecution. Everyoldsource/assertion exactlyrecovered byremovingnewblocks; values/units/requiredAnalyses/QC/dispositions/approval/numberlineage/policybounds/PDFbinary/share/revocation/instrumentreadiness/scientificSQL/scanners unchanged. ONEoriginaltruthfulness FKsetupfailure remainscauseUNCONFIRMED; originalFKsiteunchanged/newcontextafterit, nowindependentlyPASS, no FKguard correction ormissingorder attribution. Prior121batch7/473PASSa489/all82 paths52raw+5review; combined464original650verified/186unresolved. Currentall86draftpaths/58closedraw+6review files at issue209-report-pdf-queue-bounds-context-singles/index.json. NativefreshreturnedClaude7867734 read-only snapshot insteadWindowsLOCKSCREEN at5:59; NOinput/navigation/message/authentication/furtherUIattempt; currentthread/drafts NOTobservable. Unlockrequested perComputerUsesafety/userreplypending; repository/GHworkcontinues. Nativeobservation/text issue209-native-locked-boundary-1600 retained; no checkpointmessage sent/neverinventsentnotice. Futurefull370expected5642/ONLYderivedhelpmanifestmutableoutputbeforeafterbyteshash/freezecore+others. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. No pendingClscopego/allfouractualscopeanswers retained/neverduplicatequestion/handoff/ack. Samewriter/legacyruntimeorphans0writes/readonlylists/approvednonzeroSTOP/noamendmentorderstep/backfill/relink/103noapply/humancontent/214+206sourcegreenundeployed/open/historyguards hold.\n\n'
native=wp/'issue209-native-locked-boundary-1600'
nativePins={f.relative_to(root).as_posix():{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in native.iterdir() if f.is_file()}
assert len(nativePins)==2
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+list(pins)+list(nativePins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'prepare-issue209-report-pdf-queue-bounds-context-once.py').relative_to(root).as_posix(),(wp/'verify-issue209-report-pdf-queue-bounds-context-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in {**raw,**pins,**nativePins}.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
for p in source:assert git('show',':'+p)==(root/p).read_bytes().replace(b'\r\n',b'\n'),p
git('commit','-m','audit(209): retain classified report PDF queue bounds PASS358');head=git('rev-parse','HEAD').decode().strip();objects={}
for entry in git('ls-tree','-r','-z',head,'--',*list({**raw,**pins,**nativePins})).split(b'\0'):
 if entry:
  meta,p=entry.split(b'\t',1);objects[p.decode()]=meta.decode().split()[2]
assert set(objects)==set({**raw,**pins,**nativePins})
for p,pin in {**raw,**pins,**nativePins}.items():assert hashlib.sha256(git('cat-file','blob',objects[p])).hexdigest()==pin['sha256'],p
git('push','origin',head+':refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'passedTests':358,'closedSingleSuites':8,'rawGitBlobsVerified':len(raw),'reviewBlobsVerified':len(pins),'sourceDraftPaths':86,'originalCasesResolved':464,'remaining':186,'productionOperations':0}))
