"""Retain actual6163165778 PASS, then one independently rechecked SHA-guarded merge. Never replay."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
passed=wp/'pr296-actual-audit-pass-6163165778';dest=wp/'pr296-actual-merge-5e0b'
assert not passed.exists() and not dest.exists(),'Consumed/uncertain boundary: inspect, never replay.'
head='5e0b32830f961b3236c7cf8f74cf8f676e98fbaa';tree='f2152e240b355cd141612b783c6ccf04f5c8383a'
base='6d750914d8565acdd496767a7dd935811b5a89b2';runId=38524553288;verdictId=6163165778
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
def gh(path):return command('gh','api',path)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
closed=wp/'issue214-policy-post-probe-ci-38524553288-closed-terminal'
terminal=json.loads((closed/'index.json').read_bytes())
assert terminal['status']=='CLOSED_SUCCESS' and terminal['head']==head and terminal['passedTests']==5566
assert terminal['exactFullInventoryMatch'] and terminal['policyChartEntrypointProof']['after']['secondaryInspectionsOnRetainedSnapshot']
assert git('show',audit+':'+(closed/'index.json').relative_to(root).as_posix())==(closed/'index.json').read_bytes()
for name,pin in terminal['files'].items():assert hashlib.sha256(git('show',audit+':'+(closed/name).relative_to(root).as_posix())).hexdigest()==pin['sha256'],name
assert git('rev-parse',head+'^{tree}').decode().strip()==tree
paths=git('diff','--name-only',base,head).decode().splitlines();assert len(paths)==59 and not any(p.startswith('WP/') for p in paths)
def inspect(folder):
 folder.mkdir()
 def read(name,path):
  raw=gh(path);(folder/name).write_bytes(raw);return json.loads(raw)
 verdict=read('verdict-original.json',f'repos/yigini/soilfer-lims/issues/comments/{verdictId}')
 assert verdict['body'].startswith('Audit passed: OK to merge and deploy\n') and head in verdict['body']
 assert verdict['performed_via_github_app']['slug']=='claude' and verdict['created_at']==verdict['updated_at']=='2026-10-14T07:24:49Z'
 comments=command('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/296/comments?per_page=100')
 (folder/'comments-original.json').write_bytes(comments)
 flat=[c for page in json.loads(comments) for c in page];assert flat[-1]['id']==verdictId,'Inspect later comments before merge.'
 ci=read('run-original.json',f'repos/yigini/soilfer-lims/actions/runs/{runId}')
 assert ci['status']=='completed' and ci['conclusion']=='success' and ci['head_sha']==head and ci['run_attempt']==1
 jobs=read('jobs-original.json',f'repos/yigini/soilfer-lims/actions/runs/{runId}/jobs?per_page=100')['jobs']
 assert len(jobs)==1 and jobs[0]['conclusion']=='success'
 assert {s['name']:s['conclusion'] for s in jobs[0]['steps']}==terminal['requiredSteps']
 checks=read('checks-original.json',f'repos/yigini/soilfer-lims/commits/{head}/check-runs?per_page=100')['check_runs']
 assert checks and all(c['head_sha']==head and c['status']=='completed' and c['conclusion'] in ['success','neutral','skipped'] for c in checks)
 viewRaw=command('gh','pr','view','296','--repo','yigini/soilfer-lims','--json','headRefOid,baseRefOid,state,closingIssuesReferences')
 (folder/'closing-refs-original.json').write_bytes(viewRaw);view=json.loads(viewRaw)
 assert view['state']=='OPEN' and view['headRefOid']==head and view['baseRefOid']==base and view['closingIssuesReferences']==[]
 pr=read('pr-original.json','repos/yigini/soilfer-lims/pulls/296')
 assert pr['state']=='open' and not pr['merged'] and not pr['draft'] and pr['head']['sha']==head and pr['base']['sha']==base
 assert pr['mergeable'] is True and pr['mergeable_state']=='clean'
 assert pr['body']==(wp/'issue214-policy-post-probe-source-pr-update/pr-body-successor.md').read_text(encoding='utf8')
 assert read('main-original.json','repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha']==base
 assert git('ls-remote','origin','refs/heads/codex/issue-214-control-charts').decode().split()[0]==head
 return verdict
def retain(folder,record,message,lead):
 record['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in folder.iterdir() if p.is_file()}
 (folder/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
 readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
 for path in readmes:
  f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
 owned=[p.relative_to(root).as_posix() for p in folder.iterdir()]+readmes+[Path(__file__).relative_to(root).as_posix()]
 pins={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in owned if path not in readmes}
 git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
 for path,digest in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==digest,path
 git('commit','-m',message);sha=git('rev-parse','HEAD').decode().strip()
 for path,digest in pins.items():assert hashlib.sha256(git('show',sha+':'+path)).hexdigest()==digest,path
 git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
 assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==sha
 return sha
verdict=inspect(passed)
passAudit=retain(passed,{'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'ACTUAL_EXACT_HEAD_AUDIT_PASS',
 'commentId':verdictId,'commentUrl':verdict['html_url'],'head':head,'tree':tree,'base':base,'run':runId,
 'closedEvidenceAudit':audit,'sourcePaths':paths,'productionOperations':0,'mergePerformed':False,
 'nonBlockingFollowUp':'Refuse approving a proposal created before current APPROVED set fromDate; explicitly deferred by Claudio.',
 'kitRequirements':['readonly policy PRESENT/NO_OP0 or STOP','retained snapshot disk allocation','CONTROL_CHART context count','created-unstarted-unbound LRM run count']},
 'audit(214): retain actual exact-head PASS6163165778',
 f'## 2026-10-14 #214 actual exact-head audit PASS6163165778\n\nActual Claude GitHub-app verdict Audit passed: OK to merge and deploy at07:24:49UTC binds current{head}/tree{tree}/base{base}. ActualCI{runId} green366/5566/allDocker proof independentlyverified. Full verdict/fresh checks retained pr296-actual-audit-pass-6163165778/index.json before merge. KitreadonlyPRESENT/NO_OP0+snapshotdisk+context/unstartedLRMcounts remain required; no production collection/operation. Nonblocking older-pending-proposal approval followup deferred perCl. #209 started/question6163178638 pending. Humancontent/103noapply/historyguards preserved.\n\n')
inspect(dest) # Independently fresh checks after pushed verdict retention, immediately before ONE PUT.
request=dest/'merge-request.json';request.write_bytes((json.dumps({'sha':head,'merge_method':'merge'})+'\n').encode())
(dest/'mutation-started.json').write_bytes((json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'action':'ONE SHA-guarded PUT PR296 merge','neverRetry':True})+'\n').encode())
result=subprocess.run(['gh','api','repos/yigini/soilfer-lims/pulls/296/merge','--method','PUT','--input',str(request)],cwd=root,capture_output=True)
(dest/'merge-response-original.json').write_bytes(result.stdout);(dest/'merge-response-stderr.txt').write_bytes(result.stderr)
assert result.returncode==0,'Uncertain merge: inspect independently, never replay.'
merged=json.loads(result.stdout);assert merged['merged'] is True;sha=merged['sha']
def after(name,path):
 raw=gh(path);(dest/name).write_bytes(raw);return json.loads(raw)
commit=after('actual-merge-commit-original.json',f'repos/yigini/soilfer-lims/git/commits/{sha}')
assert [p['sha'] for p in commit['parents']]==[base,head] and commit['tree']['sha']==tree
pr=after('pr-merged-original.json','repos/yigini/soilfer-lims/pulls/296')
assert pr['merged'] and pr['merge_commit_sha']==sha and pr['head']['sha']==head
assert after('main-merged-original.json','repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha']==sha
assert after('issue214-after-original.json','repos/yigini/soilfer-lims/issues/214')['state']=='open'
refsRaw=command('gh','pr','view','296','--repo','yigini/soilfer-lims','--json','state,closingIssuesReferences')
(dest/'closing-refs-after-original.json').write_bytes(refsRaw);assert json.loads(refsRaw)=={'closingIssuesReferences':[],'state':'MERGED'}
runs=after('main-ci-open-original.json',f'repos/yigini/soilfer-lims/actions/runs?head_sha={sha}&event=push&per_page=100')
mainRuns=[{'id':r['id'],'head':r['head_sha'],'attempt':r['run_attempt'],'status':r['status'],'conclusion':r['conclusion'],'url':r['html_url']} for r in runs['workflow_runs']]
mergeRecord={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'MERGED_ACTUAL_AUDITED_HEAD','pr':296,'issue':214,
 'sourceHead':head,'sourceTree':tree,'priorMain':base,'merge':sha,'mergedUtc':pr['merged_at'],'parents':[base,head],
 'mergedTreeEqualsAuditedSource':True,'actualAuditCommentId':verdictId,'actualAuditEvidenceCommit':passAudit,'prCi':runId,
 'mainCi':mainRuns,'mainCiLogsCollected':False,'closingIssuesReferences':[],'issue214State':'open',
 'deploymentPerformed':False,'productionOperations':0,'nativeMergeAcknowledgementSent':False,'issue209Started':True,'issue209ScopeQuestion':6163178638}
finalAudit=retain(dest,mergeRecord,'audit(214): merge exact audited PR296 head once',
 f'## 2026-10-14 PR296 actual PASS and verified source merge COMPLETE\n\nActualClPASS6163165778 bound{head}/tree{tree}/base{base}; independentlyretainedbeforemerge at{passAudit}. ONE SHA-guarded merge at{pr["merged_at"]} as{sha}, parents{base}+{head}, actualmergedtree equalsauditedsource{tree}. PRCI{runId} SUCCESS366/5566/allrealDocker/policy snapshotproof. Merge originals/hashes at pr296-actual-merge-5e0b/index.json; NEVERmerge/requestaudit/replayagain. AutomaticmainCI metadata{json.dumps(mainRuns)} only/no closedlogs yet; observeSAMEactualrun once found/no dispatch/retry. #214 staysOPEN/closingrefs[] foractualpostdeploycheck; #206 source-merged butalso undeployed/open. No newrelease/kit/gate/productionoperation. KitreadonlypolicyPRESENT/NO_OP0+snapshotdisk+chartcontexts/unstartedunboundLRMcounts+Clkitreview remain required before freshgate. Nativefinalauditrequestalreadycomplete; nativeMERGEackUNSENT so far. #209 STARTED/question6163178638 awaitingactualhistorical-direction; independentvalidation/testplanning canproceed. Samewriter/humancontent/103noapply/historyguards hold.\n\n')
print(json.dumps({'auditHead':finalAudit,'passAudit':passAudit,'merge':sha,'mergedUtc':pr['merged_at'],'mainCi':mainRuns,'productionOperations':0}))
