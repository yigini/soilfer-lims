"""Merge actual audited PR297 once; never retry an uncertain mutation."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'pr297-actual-merge-6bd'
head='6bd516c42a07332d0b0653ed150d1526bf7e424e'
base='2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'
tree='638580d50f61254609de3abd42d93afc676a5727'
audit_pass='761990bc30696aea375981ad1ebfdceca23c0a50'
def command(*args):return subprocess.check_output(args,cwd=root)
def git(*args):return command('git',*args).decode('utf-8').strip()
def blob(revision,path):
    entry=command('git','ls-tree','-z',revision,'--',path).split(b'\t',1)[0].split()
    assert len(entry)==3 and entry[1]==b'blob',path
    return command('git','cat-file','blob',entry[2].decode())
assert not dest.exists(),'Consumed or uncertain merge; inspect GitHub, never replay.'
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
assert git('rev-parse','HEAD')==audit_pass
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit_pass
prior_dir=wp/'pr297-actual-audit-pass-6178123314'
pin=json.loads((prior_dir/'index.json').read_bytes())
assert pin['status']=='ACTUAL_EXACT_HEAD_AUDIT_PASS' and pin['head']==head and pin['ci']==38629458186
for name,detail in pin['files'].items():
    assert hashlib.sha256(blob(audit_pass,(prior_dir/name).relative_to(root).as_posix())).hexdigest()==detail['sha256'],name
dest.mkdir()
def retain(name,*args):
    raw=command('gh',*args);(dest/name).write_bytes(raw);return json.loads(raw)
verdict=retain('verdict-immediate-original.json','api','repos/yigini/soilfer-lims/issues/comments/6178123314')
assert verdict['body'].startswith('Audit passed: OK to merge and deploy.') and head in verdict['body']
assert verdict['performed_via_github_app']['slug']=='claude'
assert verdict['created_at']==verdict['updated_at']=='2026-10-14T20:48:25Z'
assert (dest/'verdict-immediate-original.json').read_bytes()==(prior_dir/'actual-verdict-original.json').read_bytes()
comments=retain('comments-immediate-original.json','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/297/comments?per_page=100')
assert comments[-1][-1]['id']==6178123314,'Newer direction requires independent inspection.'
ci=retain('ci-immediate-original.json','api','repos/yigini/soilfer-lims/actions/runs/38629458186')
assert ci['status']=='completed' and ci['conclusion']=='success' and ci['head_sha']==head and ci['run_attempt']==1
jobs=retain('jobs-immediate-original.json','api','repos/yigini/soilfer-lims/actions/runs/38629458186/jobs?per_page=100')['jobs']
assert len(jobs)==1 and jobs[0]['status']=='completed' and jobs[0]['conclusion']=='success'
assert all(s['status']=='completed' and s['conclusion']=='success' for s in jobs[0]['steps'])
checks=retain('checks-immediate-original.json','api','repos/yigini/soilfer-lims/commits/'+head+'/check-runs')
assert checks['check_runs'] and all(c['status']=='completed' and c['conclusion']=='success' for c in checks['check_runs'])
assert any(c['name']=='Test & Build' for c in checks['check_runs'])
view=retain('closing-references-immediate-original.json','pr','view','297','--repo','yigini/soilfer-lims','--json','headRefOid,baseRefOid,state,closingIssuesReferences')
assert view['state']=='OPEN' and view['headRefOid']==head and view['baseRefOid']==base and view['closingIssuesReferences']==[]
pr=retain('pr-immediate-original.json','api','repos/yigini/soilfer-lims/pulls/297')
assert pr['state']=='open' and not pr['merged'] and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['mergeable'] is True and pr['mergeable_state']=='clean'
assert pr['body']==(wp/'pr297-impact-audit-correction-source-update-completed/pr-body-successor.md').read_text(encoding='utf-8')
main=retain('main-immediate-original.json','api','repos/yigini/soilfer-lims/git/ref/heads/main');assert main['object']['sha']==base
request=dest/'merge-request.json';request.write_bytes((json.dumps({'sha':head,'merge_method':'merge'})+'\n').encode())
(dest/'mutation-started.json').write_bytes((json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'action':'ONE SHA-guarded PUT PR297 merge','neverRetry':True})+'\n').encode())
result=subprocess.run(['gh','api','repos/yigini/soilfer-lims/pulls/297/merge','--method','PUT','--input',str(request)],cwd=root,capture_output=True)
(dest/'merge-response-original.json').write_bytes(result.stdout);(dest/'merge-response-stderr.txt').write_bytes(result.stderr)
assert result.returncode==0,'Unknown mutation outcome; independent inspection, never replay.'
merged=json.loads(result.stdout);assert merged['merged'] is True
sha=merged['sha']
commit=retain('actual-merge-commit-original.json','api','repos/yigini/soilfer-lims/git/commits/'+sha)
assert [p['sha'] for p in commit['parents']]==[base,head],'Unexpected live base; retain and stop.'
assert commit['tree']['sha']==tree
after=retain('pr-merged-original.json','api','repos/yigini/soilfer-lims/pulls/297')
assert after['merged'] and after['merge_commit_sha']==sha and after['head']['sha']==head
main_after=retain('main-merged-original.json','api','repos/yigini/soilfer-lims/git/ref/heads/main');assert main_after['object']['sha']==sha
issue=retain('issue209-after-original.json','api','repos/yigini/soilfer-lims/issues/209');assert issue['state']=='open'
after_view=retain('closing-references-after-original.json','pr','view','297','--repo','yigini/soilfer-lims','--json','state,headRefOid,closingIssuesReferences')
assert after_view['state']=='MERGED' and after_view['closingIssuesReferences']==[]
runs=retain('main-ci-open-original.json','api','repos/yigini/soilfer-lims/actions/runs?head_sha='+sha+'&event=push&per_page=100')
record={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'MERGED_ACTUAL_AUDITED_HEAD','number':297,'issue':209,
    'sourceHead':head,'sourceTree':tree,'priorMain':base,'actualMerge':sha,'mergedAt':after['merged_at'],'parents':[base,head],
    'mergedTreeEqualsAuditedSource':True,'actualAuditCommentId':6178123314,'actualAuditEvidenceCommit':audit_pass,'prCi':38629458186,
    'mainCi':[{'id':r['id'],'head':r['head_sha'],'attempt':r['run_attempt'],'status':r['status'],'conclusion':r['conclusion'],'url':r['html_url']} for r in runs['workflow_runs']],
    'mainCiLogsCollected':False,'issue209State':'open','closingIssuesReferences':[], 'nativeAcknowledgementSent':False,
    'deploymentPerformed':False,'productionOperations':0,'productionCountsCollected':False,
    'kitReminder':'Print invalidStoredAnalysisSampleCount and actual sample/owner lists, show any nonzero to YY; approved nonzero STOP. Actual214/209 lists, policy PRESENT/NO_OP0 or STOP and retained-snapshot disk require exact-kit review/fresh gate.',
    'files':{}}
for p in dest.iterdir():d=p.read_bytes();record['files'][p.name]={'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'## 2026-10-14 #209 actual PASS and verified PR297 merge\n\nClaudio final PASS6178123314/20:48:25UTC binds exacthead{head}. ONE fresh SHA-guarded merge at{after["merged_at"]} created actualmain{sha}, parents{base}+{head}, mergedtree{tree} equals auditedsource. Actual complete PR CI38629458186 SUCCESS370/5649/allinventory/all realDocker and preservation originals retained401f0721; actual verdict/fresh body/refs/checks retained761990bc. Actual merge originals at pr297-actual-merge-6bd/index.json. Observe ONE automatic main push CI; OPEN metadata only until actual closure, never dispatch/retry. #209 staysOPEN/closingrefs[] for actual deploy/postcheck,206+214 also sourcegreen undeployedopen. Actual audit already completed; no duplicate ready/audit request. Native merge acknowledgement not sent by this helper. Eventual kit invalidStoredAnalysisSampleCount/lists/nonzeroYY, approved nonzeroSTOP, actual214/209lists/disk/policy/exact-kit review/fresh gate remain required. No kit/gate/production/countcollection/103apply/historical replay; same audit writer/worktree/branch.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for rel in readmes:p=root/rel;p.write_bytes(lead.encode()+p.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[Path(__file__).relative_to(root).as_posix()]+readmes
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').splitlines())==set(owned)
git('commit','-m','Merge audited PR297 order revision head6bd once')
audit=git('rev-parse','HEAD')
for p,d in pins.items():assert hashlib.sha256(blob(audit,p)).hexdigest()==d,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit
print(json.dumps({k:v for k,v in record.items() if k!='files'}));print(json.dumps({'audit':audit,'verifiedBlobs':len(pins)}))
