"""Retain closed CI originals, owned reproduction and focused probe proof; no CI replay."""
import datetime,hashlib,json,re,shutil,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
archive=wp/'issue214-policy-owner-ci38515104824-closed-archive-successor'
dest=wp/'issue214-policy-ci38515104824-closed-step-analysis';assert not dest.exists()
focus=wp/'issue214-policy-post-probe-focused';diag=wp/'issue214-policy-post-probe-owned-diagnostic'
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
index=json.loads((archive/'index.json').read_bytes());audit=git('rev-parse','HEAD').decode().strip()
for name,row in index['files'].items():assert hashlib.sha256(git('show',audit+':'+(archive/name).relative_to(root).as_posix())).hexdigest()==row['sha256']
z=zipfile.ZipFile(archive/'logs-original.zip');dest.mkdir()
fragments={'server-tests-original.log':'Run server test suite','client-build-original.log':'Build client production bundle',
 'candidate-docker-build-original.log':'Build Docker image','baseline-docker-build-original.log':'Build Supported Baseline Docker Image',
 'docker-boundary-original.log':'Run Real Disposable Docker Boundary Rehearsal','docker-readiness-original.log':'Run Real Docker Deployment Readiness Acceptance'}
selection={}
for name,fragment in fragments.items():
 matches=[entry for entry in index['stepFilenameMatches'][fragment] if '_Post ' not in Path(entry).name]
 assert len(matches)==1;entry=matches[0];data=z.read(entry)
 assert hashlib.sha256(data).hexdigest()==next(e['sha256'] for e in index['archiveEntries'] if e['name']==entry)
 (dest/name).write_bytes(data);selection[name]=entry
plain=re.sub(r'\x1b\[[0-9;]*m','',(dest/'server-tests-original.log').read_text(encoding='utf8',errors='replace'))
summary=re.findall(r'(?:Test Suites:|Tests:) +[^\r\n]+',plain)
assert summary==['Test Suites: 366 passed, 366 total','Tests:       5565 passed, 5565 total']
passed=re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b',plain)
inventory=json.loads((wp/'issue214-policy-owner-full/inventory-original.json').read_bytes())
expected={p.replace('\\','/').split('/server/',1)[1] for p in inventory}
assert len(passed)==len(set(passed))==366 and set(passed)==expected and not re.search(r'\bFAIL tests/',plain)
focused=json.loads((focus/'summary.json').read_bytes());report=json.loads((focus/'report-original.json').read_bytes())
assert focused['status']=='PASS' and focused['exitCode']==0 and focused['suites']==focused['passedSuites']==8
assert focused['tests']==focused['passedTests']==219 and focused['failed']==focused['pending']==focused['failedSuites']==0
assert all(c['status']=='passed' for s in report['testResults'] for c in s['assertionResults']) and report.get('numTodoTests',0)==0
before=json.loads((focus/'source-before.json').read_bytes());assert len(before)==421 and before==json.loads((focus/'source-after.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in before.items())
previous=json.loads((wp/'issue214-policy-owner-full/source-after.json').read_bytes())
changed=sorted(p for p in before if before[p]!=previous[p]);assert changed==['server/scripts/rehearsal_deployment_readiness.cjs','server/tests/contracts/issue_214_lab_policy_schema.test.js']
diagnostic=json.loads((diag/'diagnostic-original.json').read_bytes())
assert diagnostic['status']=='OWNED_PROBE_SIDE_EFFECT_REPRODUCED_AND_SNAPSHOT_PROOF_PASS' and diagnostic['corrected']['originalDbWalShmPreserved']
assert diagnostic['sourceFixtureTripleUnchanged'] and not diagnostic['discardedCiVolumeIndependentlyInspected']
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'run':38515104824,'actualOverallCi':'FAILURE',
 'serverFullPassIndependentlyVerified':True,'exactJestSummary':summary,'uniqueInventory366Exact':True,
 'exactArchiveStepSelection':selection,'postBuildLogIsDistinctFromActualBuild':True,
 'readinessFailure':'Scenario6 post-start policy/chart probe original DB/WAL/SHM hash predicate',
 'entrypointHealthAndOrderChecksPassedInferredFromReachingPostProbe':True,'originalProbeFieldValuesIndependentlyRecovered':False,
 'ownedReproduction':diagnostic['status'],'discardedCiVolumeIndependentlyInspected':False,
 'focusedClosedPass':focused,'onlyChangedFrozenPaths':changed,'all421FocusedInputsUnchanged':True,
 'runtimeOwnerAndScientificSourceUnchanged':True,'newRegressionExecutesActualEmbeddedRehearsalProgram':True,
 'ciRetriesOrDispatches':0,'finalAuditRequestSent':False,'productionOperations':0}
(dest/'analysis.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
owned=[p.relative_to(root).as_posix() for directory in [dest,focus,diag] for p in directory.iterdir() if p.is_file()]
helpers=['retain-issue214-post-probe-closed-proof-once.py','diagnose-issue214-policy-post-probe-owned-once.cjs',
 'run-issue214-policy-post-probe-owned-diagnostic-once.py','prepare-issue214-policy-post-probe-focused-successor-once.py','verify-issue214-policy-post-probe-focused-once.py']
owned+=[(wp/name).relative_to(root).as_posix() for name in helpers]+changed
pins={p:{'bytes':(root/p).stat().st_size,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in owned}
(dest/'closed-index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
lead='''## 2026-10-14 #214 CI38515104824 investigated; corrected post-probe focused PASS

Original CLOSED failure05:45:28UTC/head8d564c24 retainedZIP/API/allarchivehashes19508384 plus exact6step logs now retained in issue214-policy-ci38515104824-closed-step-analysis. Actual server366/5565 PASS/all366uniqueinventory/zeroFAIL; client/bothactualDockerbuilds/boundarypassed, overallCI FAILED at Scenario6 newpost-start preservationprobe. Source/controlflow shows actualdefaultentrypoint reachedhealth/policy-before-chart checks beforeprobe. No independentinspection of discardedCIvolume or recoveredcompositepredicatefields claimed. NEWowneddiagnostic PASS05:57:01: policyreadyPRESENT/NO_OP0/COMPLETE214/counts0 allpass, subsequent original-file readonly chart/count inspections createWAL/SHM; using retainedowner snapshot keepsoriginaltriple unchanged. Sourcefixture/template untouched/allownedfilesretained/no productionconnection. Correction ONLYrehearsal probe+1 regression executingACTUALembeddedprogramme, addsno app runtime/schema/science/catch/normalization/guardweakening. Focused61023 CLOSEDPASS06:45:45UTC8/219/exact8inventory/full366discovery/all421frozeninputsunchanged. Exact2 changedpaths vs priorfull8d, allother419unchanged. NewactualCI full366/5566 andallrealDockerproof required; no newlocalfull5566 claim. Originale47bCI38467368095 and8dCI38515104824 immutable/neverretry. No auditrequest/209work/merge/kit/gate/productionoperation. OLDunused request-pr296-policy-owner-exact-head-audit-after-green-once.py is boundFAILED385 andMUST NEVER EXECUTE; useNEWsource/head/CI/request successors. Humancontent/#103noapply/historicalguards preserved.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
paths=owned+readmes+[(dest/'closed-index.json').relative_to(root).as_posix()]
git('add','-f','--',*paths);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(paths)
for p,row in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==row['sha256'],p
git('commit','-m','fix(214): preserve original triple in Docker post-start probe and retain closed proof')
head=git('rev-parse','HEAD').decode().strip()
for p,row in pins.items():assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==row['sha256'],p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'verifiedBlobs':len(pins),'sourceChangedPaths':changed,'focusedSuites':8,'focusedTests':219,'actualOldCiFullServer':'366/5565 PASS','actualOldOverallCi':'FAILURE'}))
