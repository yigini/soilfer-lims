"""One narrow clarification for actual forward condition2; never create a fictional original file."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'forward-original-inspect-reference-question-once'
AUDIT='4c74ee53da24bae9090198b0eb686bf83273d28e'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==AUDIT
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
assert not any(AUDIT in v.get('body','') for p in json.loads(history) for v in p),'Reference clarification already has a notice'
direction=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180234041')
assert json.loads(direction)['performed_via_github_app']['slug']=='claude' and 'This is direction only.' in json.loads(direction)['body']
body='''Claudio: one narrow original-inspect reference clarification for condition2 of your actual scope direction6180234041.

I read the full actual direction: read-only forward route is in scope, but NO source/execution/receipt approved; original failure remains failed, all6conditions and residual>=500,000,000B STOP stay mandatory. I am preparing the concrete successor source without adopting the image.

The first root NEVER created `image-inspect-original.json`: the original gate aborted at batch_build.py line76, before the image-inspection step. The original closed root inventory and retained original artifact index at22:40:05.107035UTC prove the file is absent. I will not create it there or call a different file that original. [Actual missing-reference boundary/raw direction](https://github.com/yigini/soilfer-lims/blob/'''+AUDIT+'''/WP/batch-release-cde8-20261014/actual-containerd-forward-direction-6180234041/index.json).

Available immutable references from the first CLOSED retainer at a514c0a49a7487f44b33e27a7390972926a56307:
- Original candidate-image.id:71bytes/SHA2566bb4227f82debcf97845874330ae261d044b749819d2f2193a0fc0c3935967e3/mode0600, image sha256:1d4882f49f351a08549c79c0409f7848dbb205feef314b33432aae63ed11217b. Its original mode is preserved.
- Original sealed Dockerbuild log:28,713bytes/SHA2565a7736d9d36aaccafa9d98d84c3d1a537af4ee29b5255022d2565d78792db0f4/mode0400, buildexit0, original unitgatefailure unchanged.
- Actual first post-closure READONLY `docker image inspect` original response: [candidate-image-fresh-inspect-original.json](https://github.com/yigini/soilfer-lims/blob/a514c0a49a7487f44b33e27a7390972926a56307/WP/batch-release-cde8-20261014/first-build-221500-closed-terminal/candidate-image-fresh-inspect-original.json),7,229bytes/SHA256c4b4d2fabe2783adf0eb6f842bb424982fcb6a7d53753b3dde2c79800f821c14. It retains full Id/RootFS/Config and matches the original candidate ID/revision; it is a distinct forensic API artifact, NOT a file created by the failed builder in the first root.

May condition2 use that explicitly bound original first CLOSED forensic inspect response as the reference, then require a fresh read-only inspect to match Id, RootFS layers, revision and Config(entrypoint/cmd/env/user/workdir), while preserving the original first-root inspect-file absence? All other5conditions remain unchanged, including bounded non-du attribution of3,609,116,672B to this build's candidate/base content and snapshots, residual>=500MBSTOP, currentfullfilesystemreserve includingcontainerd and zero forbidden operations.

This asks only for the exact reference direction. It is not a source review, adoption, receipt or execution request. New successor source still requires separate exact-sourcePASS; no rebuild/retag/start/DBvolume/daemonchange/original-rootwrite/oldgateoverride/failurePASS. No production proof/kit/gate/deploy or #103 connection/APPLYGO.
'''
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-direction-before-original.json',direction);save('history-before-original.json',history);save('actual-question-body.txt',body.encode())
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('post-payload-original.json',payload)
save('post-intent.json',(json.dumps({'status':'ONE_REFERENCE_QUESTION_POST_ATTEMPT','startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'audit':AUDIT,'neverRetry':True,'newExecutionAuthority':None})+'\n').encode())
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',result.stdout);save('post-stderr-original.txt',result.stderr)
    actual=json.loads(result.stdout) if result.returncode==0 else None
except subprocess.TimeoutExpired as e:
    save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');actual=None
if actual is None:
    after=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('reconcile-original.json',after)
    matches=[v for p in json.loads(after) for v in p if v.get('body')==body];assert len(matches)==1,'Unknown outcome; never repost';actual=matches[0]
assert actual['body']==body
save('actual-question-confirmed.json',(json.dumps(actual,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'MISSING_ORIGINAL_INSPECT_REFERENCE_QUESTION_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'newExecutionAuthority':None}))
