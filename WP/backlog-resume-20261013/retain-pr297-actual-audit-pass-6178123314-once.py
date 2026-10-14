"""Retain the actual current-head Claudio PASS once; no remote mutations."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]; wp=Path(__file__).parent
dest=wp/'pr297-actual-audit-pass-6178123314'
head='6bd516c42a07332d0b0653ed150d1526bf7e424e'
base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
tree='638580d50f61254609de3abd42d93afc676a5727'
ci_audit='401f07214e8b287331385316cb4287d82ad764c3'
def command(*args): return subprocess.check_output(args,cwd=root)
def git(*args): return command('git',*args).decode('utf-8').strip()
def blob(revision,path):
    entry=command('git','ls-tree','-z',revision,'--',path).split(b'\t',1)[0].split()
    assert len(entry)==3 and entry[1]==b'blob',path
    return command('git','cat-file','blob',entry[2].decode())
assert not dest.exists(),'Consumed boundary; never replay.'
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
assert git('rev-parse','HEAD')==ci_audit
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==ci_audit
ci_dir=wp/'pr297-impact-ci-38629458186-closed-terminal'
pin=json.loads((ci_dir/'index.json').read_bytes())
assert pin['status']=='CLOSED_SUCCESS' and pin['head']==head and pin['exactFullInventoryMatch']
assert pin['exactJestSummary']==['Test Suites: 370 passed, 370 total','Tests:       5649 passed, 5649 total']
for name,detail in pin['files'].items():
    assert hashlib.sha256(blob(ci_audit,(ci_dir/name).relative_to(root).as_posix())).hexdigest()==detail['sha256'],name
raw={}
def retain(name,*args):
    data=command('gh',*args);raw[name]=data;return json.loads(data)
verdict=retain('actual-verdict-original.json','api','repos/yigini/soilfer-lims/issues/comments/6178123314')
assert verdict['body'].startswith('Audit passed: OK to merge and deploy.') and head in verdict['body']
assert verdict['performed_via_github_app']['slug']=='claude'
assert verdict['created_at']==verdict['updated_at']=='2026-10-14T20:48:25Z'
comments=retain('comments-original.json','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/297/comments?per_page=100')
assert comments[-1][-1]['id']==verdict['id'],'Newer comment requires independent inspection.'
pr=retain('pr-original.json','api','repos/yigini/soilfer-lims/pulls/297')
assert pr['state']=='open' and not pr['merged'] and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['mergeable'] is True and pr['mergeable_state']=='clean'
expected_body=(wp/'pr297-impact-audit-correction-source-update-completed/pr-body-successor.md').read_text(encoding='utf-8')
assert pr['body']==expected_body,'PR body changed.'
main=retain('main-original.json','api','repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha']==base
source=retain('source-original.json','api','repos/yigini/soilfer-lims/git/commits/'+head)
assert source['tree']['sha']==tree
run=retain('ci-original.json','api','repos/yigini/soilfer-lims/actions/runs/38629458186')
assert run['status']=='completed' and run['conclusion']=='success' and run['head_sha']==head and run['run_attempt']==1
checks=retain('checks-original.json','api','repos/yigini/soilfer-lims/commits/'+head+'/check-runs')
assert checks['check_runs'] and all(c['status']=='completed' and c['conclusion']=='success' for c in checks['check_runs'])
assert any(c['name']=='Test & Build' for c in checks['check_runs'])
view=retain('closing-references-original.json','pr','view','297','--repo','yigini/soilfer-lims','--json','headRefOid,baseRefOid,state,closingIssuesReferences')
assert view['state']=='OPEN' and view['headRefOid']==head and view['baseRefOid']==base and view['closingIssuesReferences']==[]
issue=retain('issue209-original.json','api','repos/yigini/soilfer-lims/issues/209');assert issue['state']=='open'
proofs={}
for line in (ci_dir/'docker-readiness-original.log').read_text(encoding='utf-8').splitlines():
    for key in ['policyChartEntrypointProof','orderRevisionEntrypointProof']:
        pos=line.find('{"'+key+'"')
        if pos>=0:proofs[key]=json.loads(line[pos:])[key]
a=proofs['policyChartEntrypointProof']; b=proofs['orderRevisionEntrypointProof']
assert a['before']['dry']['classification']=='ABSENT' and a['before']['dry']['totalChanges']==0 and a['before']['dbWalShmPreserved']
assert a['after']['counts']=={'LabPolicy':0,'LabPolicyOverride':0}
assert a['after']['dbWalShmPreserved'] and a['after']['secondaryInspectionsOnRetainedSnapshot']
assert a['after']['charts']['classification']=='COMPLETE_214' and a['after']['charts']['receipt']['originalRowsPreserved'] and a['after']['charts']['backfilledCount']==0
for key in ['ready','again']:
    assert a['after'][key]['classification']=='PRESENT' and a['after'][key]['totalChanges']==a['after'][key]['dataWrites']==0
assert b['after']['dbWalShmPreserved'] and b['after']['secondaryInspectionsOnRetainedSnapshot'] and b['retainedRowsAndReceiptsPreserved']
for key in ['ready','again','impact']:
    v=b['after'][key]; assert v['classification']=='COMPLETE_209' and v['totalChanges']==v['backfilledCount']==0 and v['receipt']['originalRowsPreserved']
assert b['after']['impact']['originalFilesPreserved'] and b['after']['impact']['productionMutations']==0
assert b['after']['impact']['retainedAllocation']['allocationMeasured']
raw['independent-readiness-proof.json']=(json.dumps(proofs,indent=2)+'\n').encode()
record={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_EXACT_HEAD_AUDIT_PASS',
    'number':297,'issue':209,'head':head,'tree':tree,'base':base,'verdictId':verdict['id'],'verdictUrl':verdict['html_url'],
    'ci':38629458186,'ciEvidenceAudit':ci_audit,'previousCiBlobsVerified':len(pin['files']),
    'exactJestSummary':pin['exactJestSummary'],'readyNoticeSent':False,'newAuditRequestSent':False,
    'noticeBoundary':'Actual final exact-head PASS already posted before this heartbeat; do not duplicate the completed audit request.',
    'nativeBoundary':'Fresh returned Claude7867734/LIMS Audit/Lab workflow audit and plan read after one activation recovery; right composer EMPTY, centre human draft can you go and ask Pip preserved. Latest visible native reply is old failed-audit direction; no new native PASS claimed and zero input.',
    'kitRequirements':['invalidStoredAnalysisSampleCount and sample/owner lists; nonzero shown to YY','approved amendment nonzero STOP and separate Claudio-reviewed forward remedy','policy PRESENT/NO_OP0 or STOP','actual214/209 impact lists and retained-snapshot disk accounting before exact-kit audit/fresh gate'],
    'productionOperations':0,'productionCountsCollected':False,'mergePerformed':False,
    'files':{n:{'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()} for n,d in raw.items()}}
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'## 2026-10-14 #209 actual current-head Claudio PASS6178123314\n\nActual Claude GitHub app verdict **Audit passed: OK to merge and deploy** at20:48:25UTC binds PR297 head{head}/tree{tree}/base{base}. Closed stock CI38629458186 SUCCESS370/5649/all370inventory/all real Docker independently retained401f07214e8b287331385316cb4287d82ad764c3; policy/chart/209 original triples, retained snapshots, rows/receipts and zero backfill verified. Actual final PASS already exists; no duplicate ready/audit request/native handoff. Fresh native read showed prior failed direction/rightEMPTY/centre HUMAN DRAFT preserved, no input. Raw verdict/fresh PR/main/CI/checks/body/closingrefs and readiness proof at pr297-actual-audit-pass-6178123314/index.json. Authorized exact-head merge follows fresh immediate checks; no merge by this retainer. Eventual kit MUST print invalidStoredAnalysisSampleCount and lists, show nonzero to YY, retain approved nonzero STOP, actual214/209 lists/disk/policy requirements before exact-kit audit/fresh gate. No production counts/kit/gate/operation/103apply; all old failures and historical guards immutable.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for rel in readmes:p=root/rel;p.write_bytes(lead.encode()+p.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[Path(__file__).relative_to(root).as_posix()]+readmes
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').splitlines())==set(owned)
git('commit','-m','Retain actual PR297 Claudio exact-head PASS6178123314')
audit=git('rev-parse','HEAD')
for p,d in pins.items():assert hashlib.sha256(blob(audit,p)).hexdigest()==d,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit
print(json.dumps({'status':record['status'],'audit':audit,'head':head,'verifiedBlobs':len(pins),'mergePerformed':False,'productionOperations':0}))
