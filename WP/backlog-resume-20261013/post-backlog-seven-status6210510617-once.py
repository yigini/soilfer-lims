"""Answer the queued-issue status request without source, branch or host work."""
import json,pathlib,subprocess,re
from prechecks6210209468_boundary_publication import *
D=B/'backlog-seven-status6210510617-once';assert not D.exists() and not git('diff','--cached','--name-only').strip();D.mkdir();captures=[]
def gh(path,paginated=False):
    args=['gh','api']+(['--paginate','--slurp'] if paginated else [])+[path];r=subprocess.run(args,capture_output=True,timeout=120);n='api-original-'+str(len(captures)).zfill(2);save(D,n+'.json',r.stdout);save(D,n+'-stderr.log',r.stderr);save(D,n+'-exit.json',canonical({'returnCode':r.returncode})+b'\n');captures.append({'file':n+'.json','argv':args,'length':len(r.stdout),'sha256':sha(r.stdout)});assert r.returncode==0;return json.loads(r.stdout)
request=gh('repos/yigini/soilfer-lims/issues/comments/6210510617');assert request['created_at']==request['updated_at']=='2026-10-16T07:35:23Z' and (request.get('performed_via_github_app') or {}).get('id')==1236702
nums=[208,207,216,215,203,204,217];issues={str(n):gh('repos/yigini/soilfer-lims/issues/'+str(n)) for n in nums};prs=[v for page in gh('repos/yigini/soilfer-lims/pulls?state=open&per_page=100',True) for v in page]
branches=git('for-each-ref','--format=%(refname:short)','refs/heads','refs/remotes/origin').decode().splitlines();save(D,'local-and-tracking-branch-names.json',canonical(branches)+b'\n')
assert all(not re.search(r'issue[-/]'+str(n)+r'(?:\D|$)',b) for n in nums for b in branches)
assert all(not re.search(r'(?:#|issue[- /])'+str(n)+r'(?:\D|$)',v['title']+' '+v['head']['ref'],re.I) for n in nums for v in prs)
assert all(v['state']=='open' for v in issues.values())
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333
for n,digest in frozen.items():assert sha((W/n).read_bytes())==digest
marker='backlog-seven-status-response6210510617-20261016T0736'
comments=[v for page in gh('repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T07:35:22Z&per_page=100',True) for v in page];assert not any(marker in v['body'] for v in comments)
observed=utc();body=f'''@claude Status for your [6210510617](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6210510617), checked {observed}.

<!-- {marker} -->

| Issue | Current status | Branch / PR |
|---|---|---|
| #208 Labels | Not started | None created |
| #207 Custody and retention | Not started | None created |
| #216 Dashboard dependent work | Not started | None created |
| #215 QA dashboard | Not started | None created |
| #203 Bench ergonomics | Not started | None created |
| #204 Queue performance | Not started | None created; existing parked label unchanged |
| #217 Final queued item | Not started | None created |

No item is ready for audit. The current single writer is keeping all1,333 release inputs frozen, and no new worker, checkout or branch has been started for these seven. I have retained the queued order208/207,216/215,203/204,217 and the basebe837974/ready-for-audit/exact-head review process; main merges stay held through actual deployment and your post-deploy check.

The two release checks did take priority and are now closed: C1passed; C2failed on actual mount-array-order comparison with both owners still stopped. Their complete result was already posted once in [6210471146](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6210471146). That acceptance/forward direction remains pending; this status reply is not a replacement result request. No qualification attempt or production operation has run.
'''
save(D,'status-body-utf8.txt',body.encode());save(D,'post-request.json',canonical({'body':body})+b'\n');save(D,'intent-once.json',canonical({'utc':utc(),'marker':marker,'requestId':6210510617,'noSourceOrBranchOrHostWork':True,'noReplay':True})+b'\n')
r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'post-request.json')],capture_output=True,timeout=120);save(D,'actual-post-response.json',r.stdout);save(D,'post-stderr.log',r.stderr);save(D,'post-exit.json',canonical({'returnCode':r.returncode})+b'\n');assert r.returncode==0,'Unknown outcome; inspect marker never repeat'
response=json.loads(r.stdout);assert response['body']==body;fresh=gh('repos/yigini/soilfer-lims/issues/comments/'+str(response['id']));assert fresh['body']==body and fresh['created_at']==fresh['updated_at']==response['created_at'];save(D,'api-command-index.json',canonical(captures)+b'\n')
record={'commentId':response['id'],'createdUtc':response['created_at'],'url':response['html_url'],'bodySha256':sha(body.encode()),'requestId':6210510617,'requestIsNotPrecheckResultAcceptance':True,'statuses':{str(n):'NOT_STARTED' for n in nums},'noBranchPrCreated':True,'all1333FrozenInputsUnchanged':True,'sourceEdits':0,'hostOperations':0,'requestResponseFreshUneditedEqual':True,'precheckResult6210471146StillAwaitingActualAcceptance':True}
save(D,'delivery-record.json',canonical(record)+b'\n')
lead=f'''LATEST QUEUED-SEVEN STATUS REQUEST6210510617 ANSWEREDONCE - {response['created_at']}.
ActualuneditedClaude6210510617/07:35:23Z asksstatus203204207208215216217 underexisting6200547786scope; this is UNRELATED to actual080000C1C2resultacceptance and DOESNOTanswer6210471146. Freshissues/openPR/localtrackingbranches +1333frozeninputs verified; allseven NOTSTARTED/no branchPRcreated/no readyitem. ONEstatusresponse{response['id']} {response['html_url']}/bodySHA{record['bodySha256']}/requestresponsefreshuneditedequal at WP/controller063000-prechecks-be837974-20261016/backlog-seven-status6210510617-once/publication-index.json. Noappsource/branch/worktree/agent/hostoperation. Current singlewriter preserving releaseinputs/prechecksfirst. Queuedorder208207then216215then203204then217/basebe837974/exactheadreadyaudit process retained/MainMERGEHOLD. #204parkedlabel unchanged. No duplicateACK/native/resultrequest.
Actual080000 C1PASS/C2FAIL result6210471146 STILLawaits actualClBOTHresultsacceptance+forwarddirection; doNOTtreat unrelatedClcomment/statusreply as acceptance/cancel07:52:50resultfallback. ReadFULLactualanswer whenposted/retainrawauthority BEFOREgenuinelyNEWgraph+exactSourcePASS; NONEexistsyet/no old080000replay. C2ONLYmountarrayorder/fullobjectsequal/BOTHSTOPPED/6psinspectcode0stderrEMPTY;12streams2keys2DBsHOST0400NEVERFETCH. 186new22holdsC1validated/skipped22logonly/noqualificationkitgatedeploy/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.

'''
out=boundary_publish(D,[pathlib.Path(__file__)],'Retain queued seven issue status response without source work',lead);print(json.dumps({**out,**record}))
