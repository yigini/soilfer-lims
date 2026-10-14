"""Retain this same frozen successor only after actual closure, including failures."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-historical-column-spectral-publication-context-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['suites']==6 and summary['tests']==381 and summary['failed']==8 and summary['status']=='FAILED_OR_INCOMPLETE' and summary['sourceUnchanged'] and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
assert summary['tests']==report['numTotalTests'] and summary['failed']==report['numFailedTests']
assert int((dest/'exit-original.txt').read_text())==summary['exit']
assert all('duplicate column name: workItemId' in c['failureMessages'][0] for s in report['testResults'] for c in s['assertionResults'] if c['status']=='failed')
if summary['status']=='PASS':
 assert summary['exit']==0 and summary['passedTests']==summary['tests'] and report['success']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-crosscheck-approved-context-focused/index.json').read_bytes())['sourceDraftPaths']
source=list(dict.fromkeys(source+['server/tests/contracts/'+name for name in ['audit_4_8_cross_check_install.test.js','audit_1_2_spectral_state.test.js','audit_0_3_publication.test.js']]))
assert len(source)==68
review=wp/'issue209-historical-column-spectral-publication-context-review'
classification=json.loads((review/'pre-correction-classification.json').read_bytes())
assert len(classification['cases'])==193 and classification['reviewedBeforeFixtureChanges']
reviewPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_CLASSIFIED_HISTORICAL_SPECTRAL_PUBLICATION_CONTEXT_'+summary['status'],'summary':summary,
 'scopeComments':[6163271808,6166518424,6167740581],'sourceDraftPaths':source,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins,'classifiedBeforeCorrections':193,'totalOriginalFailedCasesFullyResolvedBeforeThisRun':85,'remainingOriginalUnreviewed':372,'newFixtureSetupFailures':8,'cause':'Unnecessary schemaSql addition in current generated closure fixture: workItemId already exists; remove only new redundant shape blocks/imports in spectral/publication. PRE201 pinned shape is genuinely absent and its12 previouslyfailed cases nowpass. No runtime/schema owner/guard weakening.','reviewFiles':reviewPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='## 2026-10-14 #209 historical/spectral/publication fixture run CLOSED FAILURE6/381:373PASS8FAIL\n\nClosed12:39:09.003198UTC/exit1/6suites381tests373PASS8FAIL0pendingtodo/exactinventory/full370discovery/allfrozeninputsunchanged.193originalcases inspected BEFOREchanges; PRE201 pinned fixture truly lacks209column and its exactdigestboundnewownedshape+validSOCorder passes all12oldcases. Two generated closure fixtures alreadyhavecolumn; new redundant schemaSqlblocks cause8duplicate-column failures (6spectralCANCELLED,2publicationCOMPLETED/CANCELLED). Keep failure honest; remove ONLY those newblocks/imports in a new successor, notcatch/guardweakening/schemaowner changes. Other373tests include original spectral/publication predicates, coreorphans/approvedSTOP/nativeSQL/scannersPASS. Newlocalretentionhook preserves the exact literalpre190 spectral orphan test finally DBtriple afterallasserts; allotherintentionalbodyprobes andstockCIhooks unchanged. Closedoriginals issue209-historical-column-spectral-publication-context-focused/index.json; percase/oldsource/additions/finalizerboundary issue209-historical-column-spectral-publication-context-review. All68appdraftpaths retained. No runner/full209PASS/PR/ready/audit/merge/kit/gate/productionoperation. Prior85cases resolved11/357+6/256;193batch stillneeds8correction proof/372originalcases uninspected. No productioncollection/runtimebackfill/relink/amendmentorderstep. Samewriter/actualCl6167740581/humancontent/103noapply/214+206sourcegreenundeployed/historyguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+list(reviewPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-historical-column-spectral-publication-context-once.py').relative_to(root).as_posix(),(wp/'issue209-local-owned-physical-retention-spectral-finalizer.cjs').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in {**rawPins,**reviewPins}.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain honest historical spectral fixture failure')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in {**rawPins,**reviewPins}.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':summary['passedTests'],'failedTests':summary['failed'],'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
