"""Retain the investigated CI failure and ask Claudio one concrete scope question.

No application edits, new head, CI dispatch, ready notice, audit request or
production connection. Never replay an uncertain GitHub comment submission.
"""
import datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
head='e47b842c2a7f6b4f06fa4c532f7460c01797821b';base='6d750914d8565acdd496767a7dd935811b5a89b2';ci=38467368095
dest=wp/'issue214-ci-policy-owner-scope-boundary'
assert not dest.exists()
def cmd(args):
 r=subprocess.run(args,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace'))
 return r.stdout
def git(*args,binary=False):
 data=cmd(['git',*args]);return data if binary else data.decode('utf-8').strip()
def gh(path):return cmd(['gh','api',path])
assert git('branch','--show-current')=='audit/release-eb6de2e8' and git('rev-parse','HEAD')=='c1a70b5b7c2d6e7d7ee88765c9cdd694210ae3a7'
assert not git('diff','--cached','--name-only')
frozen=json.loads((wp/'issue214-scanner-call-form-full/source-before.json').read_bytes())
assert len(frozen)==415 and all(hashlib.sha256((root/p).read_bytes()).hexdigest()==d for p,d in frozen.items())
closed=wp/f'issue214-ci-{ci}-closed-terminal'
terminal=json.loads((closed/'index.json').read_bytes())
assert terminal['status']=='CLOSED_NON_SUCCESS' and terminal['conclusion']=='failure' and terminal['head']==head
server=re.sub(r'\x1b\[[0-9;]*m','',(closed/'server-tests-original.log').read_text(encoding='utf-8'))
expected={p.replace('\\','/').split('/server/',1)[1] for p in json.loads((wp/'issue214-scanner-call-form-full/inventory-original.json').read_bytes())}
passed=re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b',server)
assert len(passed)==len(set(passed))==365 and set(passed)==expected and not re.search(r'\bFAIL tests/',server)
assert terminal['exactJestSummary']==['Test Suites: 365 passed, 365 total','Tests:       5547 passed, 5547 total']
boundary=(closed/'docker-boundary-original.log').read_text(encoding='utf-8')
readiness=(closed/'docker-readiness-original.log').read_text(encoding='utf-8')
assert 'ALL REAL DOCKER BOUNDARY REHEARSALS COMPLETED SUCCESSFULLY' in boundary
assert 'QC_CHART_PREREQUISITE_REQUIRED' in readiness and 'lims_199_entrypoint_' in readiness
assert 'Process completed with exit code 1' in readiness
diagnostic=wp/'issue214-ci-policy-prerequisite-diagnostic-isolated'
probe=json.loads((diagnostic/'diagnostic-original.json').read_bytes())
assert probe['status']=='ORIGINAL_REFUSAL_REPRODUCED' and probe['missingPrerequisites']==['LabPolicyOverride.value']
assert probe['diagnosticDryRunTripleUnchanged'] and probe['allOtherRowsPreserved'] and probe['sourceFixtureTripleUnchanged']
assert probe['productionConnections']==probe['productionOperations']==0 and probe['refusal']['totalChanges']==0
raw={'pr-before-original.json':gh('repos/yigini/soilfer-lims/pulls/296'),
     'main-before-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
     'comments-before-original.json':gh('repos/yigini/soilfer-lims/issues/214/comments?per_page=100'),
     'run-before-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{ci}')}
pr=json.loads(raw['pr-before-original.json']);run=json.loads(raw['run-before-original.json'])
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert json.loads(raw['main-before-original.json'])['object']['sha']==base
assert run['status']=='completed' and run['conclusion']=='failure' and run['head_sha']==head and run['run_attempt']==1
marker=f'Pip #214 investigated CI{ci} policy-prerequisite boundary'
assert not any(marker in c['body'] for c in json.loads(raw['comments-before-original.json']))
baseline=git('show','48d0e526ded03232ac8516dd867f4b14923bdb58:server/prisma/schema.prisma',binary=True)
policySql=git('show',head+':server/prisma/migrations/20261004085500_add_lab_policy_settings/migration.sql',binary=True)
assert not re.search(rb'model\s+LabPolicy(?:Override)?\s*\{',baseline)
assert b'CREATE TABLE "LabPolicy"' in policySql and b'CREATE TABLE "LabPolicyOverride"' in policySql
assert b'ALTER TABLE "Report" ADD COLUMN "policyVersion" INTEGER;' in policySql
policySource=git('show',head+':server/services/policyService.js',binary=True)
assert b'db.labPolicyOverride.findMany' in policySource and b'P2021' not in policySource
raw.update({'supported-baseline-schema-original.prisma':baseline,'canonical-policy-migration-original.sql':policySql,
            'policy-service-original.js':policySource})
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
analysis={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'head':head,'run':ci,'overallCi':'FAILED',
 'serverSummary':terminal['exactJestSummary'],'all365UniqueServerPathsMatch':True,
 'clientAndBothActualDockerBuildsCompleted':True,'actualDockerBoundary':'PASS','actualDockerReadiness':'FAILED',
 'failedScenario':'Scenario6 historical PRE_199 copy, actual shipped default entrypoint',
 'refusalCode':'QC_CHART_PREREQUISITE_REQUIRED','onlyMissingPrerequisiteInOwnedReproduction':'LabPolicyOverride.value',
 'actualCiVolumeIndependentlyInspected':False,'supportedBaselinePolicyModelsAbsent':True,
 'canonicalPolicyMigrationSha256':hashlib.sha256(policySql).hexdigest(),
 'originalJobStepMetadataWasStaleRelativeToClosedLogs':True,'sourceUnchanged':True,
 'scopeQuestionOnly':True,'newApplicationChanges':0,'newCiDispatches':0,'productionOperations':0}
(dest/'investigation-original.json').write_bytes((json.dumps(analysis,indent=2)+'\n').encode())
folders=[dest,diagnostic,wp/'issue214-ci-policy-prerequisite-diagnostic-isolated-run']
owned=[p.relative_to(root).as_posix() for folder in folders for p in folder.iterdir() if p.is_file()]
owned += ['WP/backlog-resume-20261013/'+name for name in [
 'diagnose-issue214-ci-policy-prerequisite-owned-once.cjs','diagnose-issue214-ci-policy-prerequisite-owned-isolated-once.cjs',
 'prepare-run-issue214-owned-policy-diagnostic-successor-once.py',Path(__file__).name]]
pins={p:{'bytes':(root/p).stat().st_size,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in owned}
(dest/'pre-question-index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
lead=('## 2026-10-13 #214 actual CI failure investigated; policy schema-owner direction required\n\n'
      'CI38467368095 on PR296/e47b is CLOSED FAILED, not a server-test failure. Closed original server summary365/365 suites5547/5547 tests '
      'and all unique paths PASS; client build, both actual Docker builds and real boundary PASS. Real readiness fails Scenario6 on the '
      'historical PRE_199 copy at214 prerequisite QC_CHART_PREREQUISITE_REQUIRED. Supported baseline48d has no LabPolicy/Override; '
      'the existing entrypoint does not apply canonical policy migration20261004085500. An explicitly owned reproduction proves '
      'LabPolicyOverride.value is the only missing prerequisite and the refusal writes0/preserves DB-WAL-SHM/all other rows. '
      'policyService expects these tables and has no missing-table fallback; do not weaken readiness or invent policy defaults. '
      'Claudio scope question will propose a guarded owner of the existing canonical policy DDL (including its nullable Report.policyVersion '
      'addition only when absent), without changing stored policies/overrides/history. No application correction/new head/CI yet. '
      'Original API step metadata is stale relative to closed logs; retain both honestly. Originals/investigation at '
      '`WP/backlog-resume-20261013/issue214-ci-policy-owner-scope-boundary`. All415 inputs unchanged. '
      'No ready label/audit notice/final native handoff/PASS/merge/kit/gate/production connection or operation. '
      'The original diagnostic refused before fixture setup because DATABASE_PATH was absent; original helper preserved, '
      'explicitly isolated unique successor PASS with closed raw logs. Never replay any consumed helper.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:(root/p).write_bytes(lead.encode()+(root/p).read_bytes())
git('add','-f','--',*owned,(dest/'pre-question-index.json').relative_to(root).as_posix(),*readmes)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned+readmes+[(dest/'pre-question-index.json').relative_to(root).as_posix()])
git('commit','-m','Retain investigated Docker readiness policy prerequisite failure')
source=git('rev-parse','HEAD')
for p,row in pins.items():assert hashlib.sha256(git('show',source+':'+p,binary=True)).hexdigest()==row['sha256'],p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==source
url=f'https://github.com/yigini/soilfer-lims/tree/{source}/WP/backlog-resume-20261013/issue214-ci-policy-owner-scope-boundary'
body=(marker+'\n\n'
 f'Claudio, PR296 exact head `{head}` remains open/unmerged. Original CI38467368095 attempt1 closed FAILED21:38:10UTC. '
 'The closed logs correct the stale job-step metadata: **Test Suites: 365 passed, 365 total** / **Tests:       5547 passed, 5547 total**, '
 'all365 unique server paths match,0FAIL; client build, candidate+supported baseline48d0e52 actual Docker builds and real boundary rehearsal PASS. '
 'Real Docker readiness fails Scenario6 on its untouched historical PRE_199 copy when the actual default entrypoint reaches214: '
 '`QC_CHART_PREREQUISITE_REQUIRED`,0changes.\n\n'
 'The supported baseline schema contains neither LabPolicy nor LabPolicyOverride. The normal QC186 predecessor is COMPLETE and provides '
 'the other214 columns. A new explicitly isolated owned reproduction confirms LabPolicyOverride.value is the sole missing prerequisite; '
 'the refusal preserves the DB/WAL/SHM and all other rows. This reproduces the schema shape; it is not an independent inspection of the '
 'discarded CI volume. Existing policyService queries both policy tables directly and has no missing-table fallback, so removing the guard '
 'would mask a real schema gap.\n\n'
 f'[Closed CI originals](https://github.com/yigini/soilfer-lims/tree/c1a70b5b7c2d6e7d7ee88765c9cdd694210ae3a7/WP/backlog-resume-20261013/issue214-ci-38467368095-closed-terminal); '
 f'[source/owned reproduction/analysis]({url}). The existing canonical policy migration20261004085500 SHA256 is '
 f'`{analysis["canonicalPolicyMigrationSha256"]}`; its exact DDL is included.\n\n'
 '**Proposed narrow correction:** add a digest-bound guarded policy-schema prerequisite owner using this existing canonical DDL before214. '
 'Create empty LabPolicy/Override only for the genuinely absent predecessor, add the migration’s nullable Report.policyVersion only if absent, '
 'and preserve every existing policy/override/report row and historical value. Present/Prisma/partial/tampered schemas need explicit classification '
 'and refusal/normalization proof; no automatic preset/override rows, backfill, missing-table catch or readiness weakening. '
 'Existing214 scientific rules/prebinding/frozen-history/minimum20 remain unchanged. New owned preservation/refusal tests, full ordinary regression '
 'and a new source head/real CI follow the accepted correction; the failed CI is never retried or relabelled.\n\n'
 'Do you accept this schema-owner correction inside PR296, or require a separate predecessor PR? I have held application/source/CI changes '
 'for this concrete schema-ownership direction. This is a failure/scope boundary, not the final exact-head audit handoff. '
 'No ready notice, merge, kit, gate, production operation/collection, #103 connection/apply go or human-card answer.\n')
(dest/'question-actual-request.txt').write_bytes(body.encode())
request=dest/'post-question-request.json';request.write_bytes((json.dumps({'body':body},indent=2)+'\n').encode())
response=cmd(['gh','api','repos/yigini/soilfer-lims/issues/214/comments','--method','POST','--input',str(request)])
(dest/'post-question-response-original.json').write_bytes(response)
posted=json.loads(response);assert posted['body']==body
record={'postedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'comment':posted['id'],'url':posted['html_url'],
 'sourceEvidenceAudit':source,'head':head,'run':ci,'questionPostedOnce':True,'nativeFailureBoundarySent':False,
 'actualScopeAnswer':'PENDING','applicationChanges':0,'ciDispatches':0,'productionOperations':0}
(dest/'posted-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
later=[p.relative_to(root).as_posix() for p in dest.iterdir() if p.is_file() and p.name not in raw and p.name not in ['investigation-original.json','pre-question-index.json']]
laterPins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in later}
git('add','-f','--',*later)
assert set(git('diff','--cached','--name-only').splitlines())<=set(later)
git('commit','-m',f'Retain one Claudio policy-schema scope question {posted["id"]}')
final=git('rev-parse','HEAD')
for p,d in laterPins.items():assert hashlib.sha256(git('show',final+':'+p,binary=True)).hexdigest()==d,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==final
print(json.dumps(dict(record,auditCommit=final,verifiedPreQuestionBlobs=len(pins),verifiedPostQuestionBlobs=len(laterPins))))
