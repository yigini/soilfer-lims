"""One concrete Claudio scope question after the genuine first-build accounting refusal."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'containerd-forward-scope-question-once'
AUDIT='b219d425606d70bb4ac28977cbea4396edfa9f36'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==AUDIT
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==AUDIT
main=cmd('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main');assert json.loads(main)['object']['sha']=='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
assert not any(AUDIT in v.get('body','') for p in json.loads(history) for v in p),'Scope boundary already has a notice; inspect'
body='''Claudio: first #206+#214+#209 build CLOSED REFUSED; NEW containerd-accounting forward-scope boundary.

Your actual corrected Source review PASS6179940139 on2afd1928 authorized one first build. That exact first root `/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z` and unit `lims-workflow-batch-build-cde8c889-20261014t221500z`/invocation2da8e4edfe95494c8c60263ae1b1578b are now consumed. The unit CLOSED FAILED22:38:24UTC/exit1. Original stock Dockerbuild exit0/297.495872s, but the original500MB unexplainedgrowth gate refused and emitted only `FAILED_OR_RESERVE_REFUSED_BUILD_ONLY_RETAIN_ALL`, with NO successful build receipt. This remains failed.

- Free bytes62,403,399,680→58,728,148,992: drop3,675,250,688B. Recorded owned-root net growth66,134,016B; buildkit unchanged; recorded old overlay2/image/containerd subdirectories zero. Residual3,609,116,672B exceeds500,000,000B. No floor/threshold override or retroactive PASS.
- Actual once-built candidate sha256:1d4882f49f351a08549c79c0409f7848dbb205feef314b33432aae63ed11217b/414679214B is retained FORENSIC ONLY. Its actual revision label is cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367; all21 original package inputs/modes and1560 extracted rawGit application blobs remain unchanged. No DBconnection/volume mount/installer/proof/deploy was invoked.
- [Closed original unit, full journal/buildlog/intent/failure/inputs/source/image inspection and independent verdict](https://github.com/yigini/soilfer-lims/blob/a514c0a49a7487f44b33e27a7390972926a56307/WP/batch-release-cde8-20261014/first-build-221500-closed-terminal/index.json).
- [Actual storage-boundary analysis](https://github.com/yigini/soilfer-lims/blob/'''+AUDIT+'''/WP/batch-release-cde8-20261014/closed-build-accounting-forward-boundary/storage-boundary-analysis.json) confirms `io.containerd.snapshotter.v1`, DockerRoot `/var/lib/docker`, active host containerd/config root `/var/lib/containerd`, same device64769. The original accounting omitted that separate store. [Docker documents the separate image/snapshot store](https://docs.docker.com/engine/daemon/). We did NOT measure its pre-build allocation, so this diagnoses the accounting gap but does not fully reconcile or retroactively approve the old growth.
- A separate recursive topology metadata collector timed out60s without a completed allocation result. Its source and labeled refusal transcription are retained; a new bounded no-du metadata query succeeded. Later du process inventory is empty; Pip stopped no process, changed no daemon/configuration and performed no cleanup.

[Concrete proposed forward scope](https://github.com/yigini/soilfer-lims/blob/'''+AUDIT+'''/WP/batch-release-cde8-20261014/closed-build-accounting-forward-boundary/forward-remedy-scope-proposal.json): prepare NEW source for a read-only forensic validation of this existing once-built image, discover/bind complete disjoint Docker+containerd roots and full retained allocations, preserve the original missing before-state/failure honestly, enforce unchanged reserve/growth/YY pins, and potentially seal a NEW distinct forward receipt only after separate exact-source review. ZERO new Dockerbuilds/retags/container starts/DBconnections/volume mounts/original-root writes; no old receipt fabrication, gate override or failure reclassification. Every new receipt/source/review/execution binding is still empty.

Is that separately reviewed read-only forward-receipt route in scope, or must this retained once-built image stay excluded? I will not use it for a proof or kit without your actual scope direction and a later concrete exact-source PASS. No rebuild, retry, retag, cleanup or production action is proposed or authorized by this question.

Candidate/main cde8c889/tree638/mainCI38636615469SUCCESS370/5649 and all3 appPASS/merges remain unchanged; issues206/214/209 undeployedOPEN. Future stopped-production-copy proof/actual214209impact lists (including invalidStoredAnalysisSampleCount/sampleownerIDs)/policyPRESENTNO_OP0orSTOP/retainedallocation/nonzeroYY/approvednonzeroSTOP/separateforwardremedy/finalexactkit/freshsingle-usegate remain required. No amendment-side order/backfill/relink/normalizer change; #103 no connection/APPLYGO. All historical#200 roots/images/receipts/DB-WAL-SHM/gates/helpers and human drafts/cards remain preserved.
'''
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('current-main-original.json',main);save('issue162-history-before-original.json',history);save('actual-question-body.txt',body.encode())
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('request-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'audit':AUDIT,'postCount':1,'neverRetry':True,'newExecutionAuthority':None,'productionOperations':0})+'\n').encode())
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',result.stdout);save('post-stderr-original.txt',result.stderr)
    actual=json.loads(result.stdout) if result.returncode==0 else None
except subprocess.TimeoutExpired as e:
    save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');actual=None
if actual is None:
    after=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('post-reconcile-original.json',after)
    matches=[v for p in json.loads(after) for v in p if v.get('body')==body];assert len(matches)==1,'Unknown question outcome; never repost';actual=matches[0]
assert actual['body']==body and actual['html_url']=='https://github.com/yigini/soilfer-lims/issues/162#issuecomment-'+str(actual['id'])
save('actual-question-confirmed.json',(json.dumps(actual,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'CONTAINERD_FORWARD_SCOPE_QUESTION_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'actualDirection':None,'newExecutionAuthority':None,'productionOperations':0}))
