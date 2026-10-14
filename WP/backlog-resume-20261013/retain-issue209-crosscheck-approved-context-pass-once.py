"""Retain this same frozen successor only after actual closure, including failures."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-crosscheck-approved-context-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['suites']==6 and summary['tests']==256 and summary['status']=='PASS' and summary['sourceUnchanged'] and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
assert summary['tests']==report['numTotalTests'] and summary['failed']==report['numFailedTests']
assert int((dest/'exit-original.txt').read_text())==summary['exit']
if summary['status']=='PASS':
 assert summary['exit']==0 and summary['passedTests']==summary['tests'] and report['success']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-calculation-header-keyboard-context-focused/index.json').read_bytes())['sourceDraftPaths']
source=list(dict.fromkeys(source+['server/tests/contracts/'+name for name in ['audit_4_8_cross_check_evidence.test.js','audit_6_1_first_fill.test.js','audit_6_3_report_content.test.js']]))
assert len(source)==65
review=wp/'issue209-crosscheck-approved-context-review'
classification=json.loads((review/'pre-correction-classification.json').read_bytes())
assert len(classification['cases'])==39 and classification['reviewedBeforeFixtureChanges']
reviewPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_CLASSIFIED_CROSSCHECK_APPROVED_CONTEXT_'+summary['status'],'summary':summary,
 'scopeComments':[6163271808,6166518424,6167740581],'sourceDraftPaths':source,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins,'classifiedBeforeCorrections':39,'totalOriginalFailedCasesResolved':85,'remainingFailedCases':565,'reviewFiles':reviewPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='## 2026-10-14 #209 classified cross-check and approved-history contexts CLOSED PASS6/256\n\nClosed12:30:11.006033UTC6/6suites256/256tests0failedpendingtodo/exact6inventory/full370discovery/allfrozeninputsunchanged/bothordinarysetups/512MBworker/blankNODE_OPTIONS/heldDBtriples. All39originalfailedcases across cross-check evidence/accepted-parent first-fill/report approval-evidence fixtures inspected BEFOREchanges. Only reasoned current added-determination full targets and declared usable retainedACTIVE legacyNULL order contexts added during fresh owned fixture assembly; the new unlinked amendment child supplies orderLineId atINSERT while its absentamendmentlink/refusal remains. No approval metadata/Lab/policy/scientific value/assertion/guard changed; removingnewblocks recoversoldsource byte-identically. Coreorphans/approvedSTOP/initialintakeTXrollback/nativeSQL/strictscannersPASS. Originals issue209-crosscheck-approved-context-focused/index.json; before-source/per-case/additionproof issue209-crosscheck-approved-context-review. All65appdraftpaths retained. Combined85originalfailcases resolved by honest11/357+6/256 focusedproof;565originalfailedcases stillunreviewed/unresolved. No runner/full209PASS/PR/ready/audit/merge/kit/gate/productionoperation. Legacy48dmissingorder variants remainrefused/readonlylists/approvednonzeroSTOP perCl6167740581/no amendmentorderstep/backfill/relink. Full650failure originaldaca/derivedhelpmanifest capture boundary unchanged. Next inspect remaining historical/current positive fixture contexts individually, preserve runtime-negative distinctions. Samewriter/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+list(reviewPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-crosscheck-approved-context-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in {**rawPins,**reviewPins}.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain classified crosscheck approved history PASS')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in {**rawPins,**reviewPins}.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':summary['passedTests'],'failedTests':summary['failed'],'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
