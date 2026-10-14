"""Checkpoint accepted scope, closed failures and a clearly open successor once."""
import datetime, hashlib, json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]; wp=Path(__file__).parent
dest=wp/'issue214-policy-owner-draft-checkpoint'
assert not dest.exists()
def git(*args,data=None):
    return subprocess.run(['git',*args],cwd=root,input=data,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8'
assert not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').strip()==b'a86931b3a01ad3a1fd59300003d7a11a585af38c'
app=['.gitattributes','Dockerfile','docker-entrypoint.sh','docs/audit/214-control-charts.md','server/index.js',
     'server/scripts/install_control_charts.js','server/scripts/install_lab_policy_schema.js',
     'server/scripts/rehearsal_deployment_readiness.cjs','server/services/labPolicyMigrationSource.js',
     'server/tests/contracts/deployment_readiness_bootstrap.test.js','server/tests/contracts/issue_214_lab_policy_schema.test.js',
     'server/tests/helpers/workflowWriteScanner.js']
dirs=['issue214-policy-owner-answer-6160619940','issue214-policy-owner-focused-failure','issue214-policy-owner-focused-corrected-failure']
closed=[p for name in dirs for p in (wp/name).rglob('*') if p.is_file()]
helpers=['retain-issue214-policy-owner-answer-6160619940-once.py','prepare-issue214-policy-owner-verification-once.py',
 'issue214-policy-owner-local-retention-teardown.cjs','verify-issue214-policy-owner-focused-once.py',
 'verify-issue214-policy-owner-focused-corrected-once.py','verify-issue214-policy-owner-snapshot-focused-once.py',
 'verify-issue214-policy-owner-full-once.py','retain-issue214-policy-owner-focused-failure-once.py',
 'retain-issue214-policy-owner-focused-corrected-failure-once.py',Path(__file__).name]
original=json.loads((wp/'issue214-scanner-call-form-full/source-before.json').read_bytes())
changed=[p for p,h in original.items() if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h]
assert set(changed)<=set(app),changed
active=json.loads((wp/'issue214-policy-owner-snapshot-focused/source-before.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in active.items())
dest.mkdir()
record={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'actualScopeComment':6160619940,
 'priorAuditHead':'a86931b3a01ad3a1fd59300003d7a11a585af38c','priorPRHead':'e47b842c2a7f6b4f06fa4c532f7460c01797821b',
 'base':'6d750914d8565acdd496767a7dd935811b5a89b2','applicationPaths':app,'changedPreviouslyFrozenPaths':changed,
 'frozenPathCount':len(active),'activeRunner':{'sessionId':34251,'status':'RUNNING','fullDiscovery':366,'finalResult':None},
 'localRetentionTeardownOnly':True,'ordinarySetupAndAssertionsEnabled':True,'stockCiUnchanged':True,
 'originalCi38467368095':'CLOSED_FAILED_NEVER_REPLAY','readyNoticeSent':False,'productionOperations':0}
(dest/'open-successor-metadata.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
allFiles=closed+[wp/p for p in helpers]+[dest/'open-successor-metadata.json']
index={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in allFiles}
(dest/'closed-evidence-index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
lead='''## 2026-10-14 #214 policy prerequisite accepted inside PR296; preservation successor running

Actual Claudio6160619940 at04:03:46UTC accepts the existing canonical policy-schema owner inside PR296, with NO automatic normalization. The full answer is retained under `WP/backlog-resume-20261013/issue214-policy-owner-answer-6160619940`. ABSENT creates only empty canonical storage and nullable Report.policyVersion if absent; PRESENT (including exact Prisma equivalent) is NO_OP0; partial/mismatched/tampered storage refuses0. Scientific214/prebinding/frozen history/min20 are unchanged. The owner precedes214 in default entrypoint/readiness. An eventual production kit must read-only PRESENT/NO_OP0 or STOP/no apply, and account for its retained snapshot allocation.

Two closed failures remain honest: first48181 has8suites184tests/4passing180passing/4failed, from new fixture fields/nonexistent selected scanner filename/dynamic test SQL/stock bootstrap timeout; corrected39506 has8suites217tests/7passing216passing/1failure, because an ordinary SQLite read-only WAL-mode open created missing sidecars. The new implementation classifies a fresh retained file snapshot, hashes original DB/WAL/SHM before/after, and never opens an original read-only target with SQLite. No automatic normalization or target pragma change. Third unique focused session34251 is RUNNING on421 frozen inputs/366 discovery; no final result yet. Stock assertions/both ordinary setups/worker512MB/blank local NODE_OPTIONS stay enabled; local retention-only teardown preserves held DBs, while stock CI hooks are unchanged. Never replay the closed runners or consumed retainers. PR296 remains on olde47b; no corrected head/push/newCI/ready notice/audit PASS/merge/kit/gate/production operation yet. Failed originalCI38467368095 never retries. New YY direction: after corrected push/full real greenCI, send one NEW exact-head audit request, then start209. Native draftn/human files remain untouched. This lead supersedes older scope-pending/no-draft statements below.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
    file=root/p; file.write_bytes(lead.encode()+file.read_bytes())
paths=app+readmes+[p.relative_to(root).as_posix() for p in allFiles]+[(dest/'closed-evidence-index.json').relative_to(root).as_posix()]
git('add','--',*paths)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(paths)
for p,row in index.items():
    assert hashlib.sha256(git('show',':'+p)).hexdigest()==row['sha256'],p
git('commit','-m','audit(214): retain accepted policy scope and closed preservation failures')
head=git('rev-parse','HEAD').decode().strip()
for p,row in index.items(): assert hashlib.sha256(git('show',head+':'+p)).hexdigest()==row['sha256'],p
git('push','origin','audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'closedBlobCount':len(index),'sourcePRUnchanged':True,'activeSession':34251}))
