"""Create a distinct Step2 SOURCE tree. No operators, tests, SSH or SQLite."""
import ast,hashlib,json,pathlib,subprocess,shutil
W=pathlib.Path(__file__).resolve().parents[2];old=W/'WP/batch-proof-jobs-intake-be837974-20261016';diag=W/'WP/jobs-row-diagnostic-private-be837974-20261016';new=W/'WP/batch-proof-provenance-step2-be837974-20261016'
assert not new.exists()
accept=json.loads((diag/'actual-result-accepted6206990387-once/actual-acceptance-original.json').read_bytes())
projection={**{k:accept[k] for k in ['id','body','created_at','updated_at']},'app':{k:accept['performed_via_github_app'][k] for k in ['id','slug']}}
assert hashlib.sha256(json.dumps(projection,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()=='e4ed0595412a6965e33e5fed5118e0d023f0acb9b5cb07035b27936d7b29c829'
index=json.loads((old/'exact-source-review323-once/tooling-source-index.json').read_bytes());assert len(index['files'])==26
new.mkdir()
for n,pin in index['files'].items():
    raw=subprocess.check_output(['git','show','04c99271e761198937aa798131075f199e86b679:WP/batch-proof-jobs-intake-be837974-20261016/'+n],cwd=W)
    assert hashlib.sha256(raw).hexdigest()==pin['sha256'];(new/n).write_bytes(raw)
for n in ['compose-source.yml']:(new/n).write_bytes((old/n).read_bytes())
for n in ['bound-input-records','new-authority-fixtures','application-source-fixtures']:shutil.copytree(old/n,new/n)
def change(n,fn):
    p=new/n;s=p.read_text(encoding='utf-8');p.write_text(fn(s),encoding='utf-8',newline='\n')
def replace(s,a,b):
    assert a in s,a;return s.replace(a,b)
folder='WP/batch-proof-provenance-step2-be837974-20261016/'
change('proof_contract.py',lambda s:replace(replace(replace(replace(replace(s,'workflow-batch-jobs-intake-be837974-20261016T003000Z','workflow-batch-provenance-step2-be837974-20261016T050000Z'),'BOUND_INSTALLED209_NEW_JOBS_ON_NATURAL_INTAKE_AND_BROAD_POSTFLIGHTS','BOUND_INSTALLED209_STEP2_STRICT_PROVENANCE_NATURAL_INTAKE_AND_BROAD_POSTFLIGHTS'),"'readonly-smoke.cjs'})","'readonly-smoke.cjs','provenance_rules.py','provenance_privacy.py','controller_guard.py','stop_owned.py','verify_provenance_guards.py'})"),"review.get('id',0)>6204518776","review.get('id',0)>6206990387"),"review['created_at']>'2026-10-15T23:36:01Z'","review['created_at']>'2026-10-16T02:55:36Z'"))
change('proof_contract.py',lambda s:replace(s,"return [index['head'],CANDIDATE", "return ['diagnosticAcceptedId=6206990387','diagnosticAcceptanceSha256=e4ed0595412a6965e33e5fed5118e0d023f0acb9b5cb07035b27936d7b29c829','strictSameSyncNewSampleConflictPairing=true','strictIntraSubmissionHoldAuditPairing=true','noOrphanOrExtraAudit=true','secondNaturalConflictIdempotence=true','controllerExactRootOwnerStopPost=true','controllerOwnMemoryEvents=true','firstProductionSyncImpactMustBeDisclosed=true','productionRestartWindowMinutes=9to10','productionReadinessDeadlineSeconds=600','newPrivateValueHmacKey=true',index['head'],CANDIDATE"))
authority='''\nDIAGNOSTIC_ACCEPTED_SHA='e4ed0595412a6965e33e5fed5118e0d023f0acb9b5cb07035b27936d7b29c829'\ndef diagnostic_accepted(v):\n    require(v.get('id')==6206990387 and v.get('created_at')==v.get('updated_at')=='2026-10-16T02:55:36Z' and sha(canonical(authority_projection(v)))==DIAGNOSTIC_ACCEPTED_SHA,'Actual Step1 diagnostic acceptance changed')\n    require(first_line(v['body'])=='Diagnostic result review: ACCEPTED (023000, Step 1 only, not release qualified)','Actual diagnostic acceptance missing')\n'''
with (new/'proof_contract.py').open('a',encoding='utf-8') as f:f.write(authority)
change('prepare_proof.py',lambda s:replace(replace(s,"REL='WP/batch-proof-jobs-intake-be837974-20261016/'","REL='"+folder+"'"),"current(out['main'],out['ci'],out['prs'],out['verdicts'],out['comments'])","out['diagnosticAccepted']=gh('repos/yigini/soilfer-lims/issues/comments/6206990387');diagnostic_accepted(out['diagnosticAccepted'])\n    current(out['main'],out['ci'],out['prs'],out['verdicts'],out['comments'])"))
change('run_stopped_proof.py',lambda s:replace(s,"jobs_scope_authority(evidence['jobsScope'])","jobs_scope_authority(evidence['jobsScope']);diagnostic_accepted(evidence['diagnosticAccepted'])"))
change('verify_proof_guards.py',lambda s:replace(replace(s,'6204600001','6207000001'),'2026-10-15T23:40:00Z','2026-10-16T02:56:00Z'))
change('verify_jobs_guards.py',lambda s:replace(s,'BOUND_INSTALLED209_NEW_JOBS_ON_NATURAL_INTAKE_AND_BROAD_POSTFLIGHTS','BOUND_INSTALLED209_STEP2_STRICT_PROVENANCE_NATURAL_INTAKE_AND_BROAD_POSTFLIGHTS'))
# Exact, already-reviewed structural predicates become NEW source with a new
# private hashing dependency. The operational graph never imports old folders.
s=(diag/'diagnostic_compare.py').read_text(encoding='utf-8').split('def compare_all(')[0]
s=s.replace('from diagnostic_contract import *','from provenance_privacy import *')
s=s.replace('"""Streaming full-store diff and conservative code-bound provenance diagnosis.\n\nThis reports observed changes. It does not authorize a preservation exception,\nproduce a release PASS, repair data, or draft the Step 2 proof.\n"""','"""New Step2 structural transition predicates derived from accepted Step1.\nStrict global row/audit consumption below adds same-sync and intra checks.\n"""')
(new/'provenance_rules.py').write_text(s,encoding='utf-8',newline='\n')
record={'status':'NEW_STEP2_SOURCE_SEEDED_INCOMPLETE_NOT_APPROVED_OR_EXECUTED','acceptedId':6206990387,'sourcePredecessor':index['head'],'newFolder':str(new),'operatorsExecuted':0,'testsExecuted':0,'hostCalls':0}
(new/'source-seed-record.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps(record))
