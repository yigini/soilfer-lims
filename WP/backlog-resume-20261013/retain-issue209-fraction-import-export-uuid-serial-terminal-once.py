"""Retain exact closed sequential child originals; aggregate is identified as derived, not a full Jest run."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-fraction-import-export-uuid-serial-singles'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes());assert summary['status']=='PASS' and summary['closedSuites']==7 and summary['closedTests']==summary['passedTests']==207 and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for name,digest in before.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
children=[]
for child in sorted(f for f in dest.iterdir() if f.is_dir()):
 observation=json.loads((child/'observed-closed-summary.json').read_bytes());report=json.loads((child/'report-original.json').read_bytes())
 assert observation['status']=='PASS' and int((child/'exit-original.txt').read_text())==observation['exit']==0 and report['success']
 assert report['numTotalTestSuites']==1 and report['numTotalTests']==report['numPassedTests']==observation['expectedTests']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
 children.append(observation)
assert len(children)==7 and sum(c['tests'] for c in children)==207 and set(c['suite'] for c in children)==set(c['suite'] for c in summary['children'])
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);f=Path(row['path']);assert f.exists(),f
 if f.is_file():held.append({'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc':summary['closedUtc'],'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-historical-corrected-serial-singles/index.json').read_bytes())['sourceDraftPaths']
source=list(dict.fromkeys(source+['server/tests/contracts/'+name for name in ['issue_291_texture_input_authority.test.js','issue_213_export_equals_report.test.js','audit_4_7_calculation_import.test.js','audit_1_4_uuid_transactions.test.js']]))
assert len(source)==72
review=wp/'issue209-fraction-import-export-uuid-context-review'
classification=json.loads((review/'pre-correction-classification.json').read_bytes());assert classification['reviewedBeforeFixtureChanges'] and len(classification['cases'])==12
reviewPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
raw={f.relative_to(root).as_posix():{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in dest.rglob('*') if f.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','childClosedReports':7,'sourceDraftPaths':source,'sourceAndTemplateInputsFrozen':len(before),'totalOriginalFailedCasesResolved':290,'remainingOriginalUnresolved':360,'remainingOriginalUnreviewed':360,'additionalInspectedNotCorrectedOrVerified':0,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':raw,'reviewFiles':reviewPins,'priorFailuresImmutable':['issue209-historical-column-spectral-publication-context-focused/index.json','issue209-historical-shape-corrected-context-focused/index.json']}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified fraction/import/export/UUID contexts CLOSED sequential PASS7/207\n\nNew82433 successor closed13:03:49.379023UTC:7fresh ordinarysingle-suite invocations6+5+4+15+32+112+33=207/207tests0failedpendingtodo/exact7inventory/full370discovery/allfrozeninputs inclshared/generatedPrisma/originalheldtemplate unchanged/bothordinarysetups/stockassertions/oneworker512MB/blankNODE_OPTIONS/heldDBtriples. All12originalfailedcases SOURCEclassified BEFOREedits; reasoned fulltarget order contexts for existingTEXTURE+fractioncompanions, PH+SOC percent export, base+EXCHCA+Olsen typedimport, UUIDtexture replicate owners. Removingnewblocks recoversoldsource/assertions byte-identically; units/censoring/tolerance/replicateatomicity/UUIDguards/importmapping/exportequality/science unchanged. Coreorphans/approvedkitSTOP/intakeTXrollback/nativeSQL/scannersPASS. Originals issue209-fraction-import-export-uuid-serial-singles/index.json and percase/oldsource/additions issue209-fraction-import-export-uuid-context-review. All72appdraftpaths retained. Combined290originalfailcases resolved by11/357+6/256+sequential6/381+7/207;360remainuninspected/unresolved. Earlierduplicatecolumnab6 andincompleteOOMbc6 remainhonestimmutable/neverreplay. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. NEXT classify remainingcasesbeforecurrentpositivecontext corrections; no runtimeorphan backfill/relink/widerfallback/amendmentorderstep. Futurefull370expected5634 mustcapturegeneratedhelpmanifest asmutableoutput(before/afterbytes+hash), freezeactualsource/allothers. Samewriter/Cl6163271808+6166518424+6167740581/readonlyopenlists+approvednonzeroSTOP/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+list(reviewPins)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-fraction-import-export-uuid-serial-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in {**raw,**reviewPins}.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
for name in source:assert git('show',':'+name)==(root/name).read_bytes().replace(b'\r\n',b'\n'),name
git('commit','-m','audit(209): retain classified fraction import export UUID PASS207');head=git('rev-parse','HEAD').decode().strip()
for name,pin in {**raw,**reviewPins}.items():assert hashlib.sha256(git('show',head+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'passedTests':207,'closedSingleSuites':7,'rawGitBlobsVerified':len(raw),'sourceDraftPaths':72,'originalFailedCasesResolved':290,'productionOperations':0}))
