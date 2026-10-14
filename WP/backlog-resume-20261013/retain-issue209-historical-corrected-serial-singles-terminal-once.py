"""Retain exact closed sequential child originals; aggregate is identified as derived, not a full Jest run."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-historical-corrected-serial-singles'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary-observed.json').read_bytes());assert summary['status']=='PASS' and summary['closedSuites']==6 and summary['closedTests']==summary['passedTests']==381 and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for name,digest in before.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
children=[]
for child in sorted(f for f in dest.iterdir() if f.is_dir()):
 observation=json.loads((child/'observed-closed-summary.json').read_bytes());report=json.loads((child/'report-original.json').read_bytes())
 assert observation['status']=='PASS' and int((child/'exit-original.txt').read_text())==observation['exit']==0 and report['success']
 assert report['numTotalTestSuites']==1 and report['numTotalTests']==report['numPassedTests']==observation['expectedTests']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
 children.append(observation)
assert len(children)==6 and sum(c['tests'] for c in children)==381 and set(c['suite'] for c in children)==set(c['suite'] for c in summary['children'])
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);f=Path(row['path']);assert f.exists(),f
 if f.is_file():held.append({'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc':summary['closedUtc'],'allRecordedTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-historical-shape-corrected-context-focused/index.json').read_bytes())['sourceDraftPaths'];assert len(source)==68
raw={f.relative_to(root).as_posix():{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in dest.rglob('*') if f.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'summary':summary,'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','childClosedReports':6,'sourceDraftPaths':source,'sourceAndTemplateInputsFrozen':len(before),'totalOriginalFailedCasesResolved':278,'remainingOriginalUnresolved':372,'remainingOriginalUnreviewed':360,'additionalInspectedNotCorrectedOrVerified':12,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':raw,'priorFailuresImmutable':['issue209-historical-column-spectral-publication-context-focused/index.json','issue209-historical-shape-corrected-context-focused/index.json']}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified historical/spectral/publication contexts CLOSED sequential PASS6/381\n\nNew26169 successor closed12:55:50.338281UTC:6fresh ordinarysingle-suite invocations17+107+80+32+112+33=381/381tests/0failedpendingtodo; exact6inventory/full370discovery/allfrozeninputs inclshared/generatedPrisma/originalheldtemplate unchanged. Bothordinarysetups/stockassertions/maxWorkers1/512MBworker/blankNODE_OPTIONS/heldDBtriples. This is sequentialfocused proof, NOTonefull370run/CI. All193originalfailedcases in thisbatch nowverified with their original assertion/runtime/scanner/history boundaries. Currentgeneratedclosurecolumn alreadyexists: onlynewredundantshape blocks removed; genuine pinnedPRE201stillgets exactdigestboundnullablemodelshape in NEWownedfixture beforecapture. ValidlegacyNULLorders/newreasonedcontexts/no approval/science/backfill/relink/guardchange. Earlier373/8duplicatecolumnfailureab6 and incompleteOOM/nooriginalreportorexitbc6 remainhonestimmutable, neverreplay. Originals issue209-historical-corrected-serial-singles/index.json/6childreports+commands/logs/exits/hashes/physicalretention. All68appdraftpaths retained. Combined278originalfailcases resolved by11/357+6/256+sequential6/381;372originalcases remainunresolved:360uninspected and12fraction/import/export/UUID source-inspected/pre-correctionreviewprepared butNOTedited/tested. No runner/full209PASS/PR/ready/audit/merge/kit/gate/productionoperation. Samewriter/Cl6163271808+6166518424+6167740581/approvedorphanlistsSTOP/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(raw)+source+readmes+[Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-historical-corrected-serial-singles-once.py').relative_to(root).as_posix(),(dest/'index.json').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in raw.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
for name in source:assert git('show',':'+name)==(root/name).read_bytes().replace(b'\r\n',b'\n'),name
git('commit','-m','audit(209): retain classified historical contexts sequential PASS381');head=git('rev-parse','HEAD').decode().strip()
for name,pin in raw.items():assert hashlib.sha256(git('show',head+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'passedTests':381,'closedSingleSuites':6,'rawGitBlobsVerified':len(raw),'sourceDraftPaths':68,'originalFailedCasesResolved':278,'productionOperations':0}))
