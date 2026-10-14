"""One exact-source review request for targeted metadata successor; no execution or adoption."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
TOOLING='8df9e1261647dcc8ba018c739bd606fe5291f1ca'
DEST=SOURCE/'targeted-source-review-request-8df9e126'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==TOOLING
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==TOOLING
sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
from prepare_forward_metadata import raw_git
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-forward-metadata-cde8-20261014/'+n);require(raw==(SOURCE/n).read_bytes(),'Published source differs')
scope=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180234041');reference=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180335648');directions(exact_json(scope),exact_json(reference))
main=cmd('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main');require(exact_json(main)['object']['sha']==CANDIDATE,'Current main moved')
ci=cmd('gh','api','repos/yigini/soilfer-lims/actions/runs/38636615469');v=exact_json(ci);require(v['head_sha']==CANDIDATE and v['run_attempt']==1 and v['status']=='completed' and v['conclusion']=='success','Exact main CI changed')
oldpass=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180876636');require('0b01804f9d409d74a19472c22469824e2df95005' in exact_json(oldpass)['body'],'Original pass changed')
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');require(not any(TOOLING in v.get('body','') for p in exact_json(history) for v in p),'Existing source notice: never duplicate')
baseurl='https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-forward-metadata-cde8-20261014/'
body='''Claudio: first metadata capture CLOSED STOP; NEW concrete targeted metadata successor for exact-source review, #206+#214+#209.

Your exact0bSourcePASS6180876636 authorized only the one233000capture, now consumed. It closed23:43:21.814UTC/exit1/STOP_METADATA_INCOMPLETE_IMAGE_EXCLUDED: the full moby catalogue has1,526unique snapshot keys, exceeding80. No truncation or per-key/cache/OCI read ran. Eight original calls exited0; candidate inspect is byte-identical to the distinct first forensic response SHA256c4b4d2fabe2783adf0eb6f842bb424982fcb6a7d53753b3dde2c79800f821c14. All bound filesystem floors passed. Original47remote artifacts/package/launch/source91verifiedblobs are immutable at [closed STOP](https://github.com/yigini/soilfer-lims/blob/e8f2f2e330ab8daa987c269fe576f2a4a9f15874/WP/batch-forward-metadata-cde8-20261014/first-metadata-233000-closed-stop/index.json). An initial Windows long revision:path verification error after commit stopped before push; the OID-only completion verified/pushed that same commit and retained the original error at1da5885659f5bfd7831e51f30471ed068e8550f7. No replay/adoption was attempted.

Please independently review NEW exact tooling '''+TOOLING+'''. It preserves the complete catalogue and chooses only candidate RootFS ChainIDs plus all exact parents. The actual retained catalogue validates59unique candidate keys, every one Committed with exact parent. It skips per-key reads for unrelated moby snapshots and the buildkit catalogue. Missing/duplicate/malformed/uncommitted/wrong-parent keys refuse; a candidate chain>80 still refuses. Same80selected-key budget,2MiBcomplete-catalogue budget,256calls,10secondcalls,600secondcollection,900secondunit,805306368memory/swap0. No arbitrary truncation or bound increase. This is targeted evidence only, not a claim about all daemon snapshots or full growth attribution.

The new root is `/opt/lims/releases/workflow-batch-forward-metadata-cde8c889-20261015T000500Z`, currently UNCREATED. Old233000root/operator is refused and remains immutable. Only three source paths changed: contract exact newroot/selection/bindings, collector exact candidate-chain targeting/committed usage, and four additional selection/refusal tests plus adapting the old root guard. Preparer/launcher are byte-identical. Thirteen original guard methods are byte-identical; the remaining old guard only adapts root aliases and rejects233000.

'''+ '\n'.join('- ['+n+']('+baseurl+n+')' for n in sorted(SOURCE_FILES))+'''

[Scope/full graph](BASEURLREADME.md), [closed actual local+host proof](BASEURLtargeted-chain-source-verification-once/exit-original.json), [actual retained catalogue selection](BASEURLtargeted-chain-source-verification-once/actual-retained-catalogue-selection-original.json), [exact source/old-guard delta](BASEURLtargeted-chain-source-delta-original.json).

Verification closed23:55:24.579567UTC:18local +18actual host Python3.9pure guard tests PASS; all5source files compile/hash unchanged. Both environments read the same complete retained244320B/SHA256f9ac4687d7fa74206c9a598a42ffd8c05116e3224c8758e17227a01c90464461/1,526-row catalogue and select the same59Committed exact-parent chain keys. Those tests ran no metadata operator/API/imageinspect/receipt/production connection. All19publication blobs were raw Git OID verified before push.

All immutable candidate ID/sealed log/distinct forensic reference roles/modes/absence and fresh exact image Id/platform/RootFS/Config/revision comparison remain. The command whitelist/client-state confinement/19-file0400package/two fresh empty unit outputs/one exclusive intent/newunusedunit/current main+CI+actual direction+review+lateral rejection checks remain. No pull/push/save/load/build/retag/container start/prune/DB/volume/daemon/config changes/filesystem du executable/originalroot writes. Read-only BuildKit DiskUsage API remains bounded; stopping an owned client never authorizes daemon/job changes. Floor10556150894 on all3bound filesystems, original500000000abort, both YY pins unchanged.

Candidate1d4882f4 remains excluded/forensic only. Original221500build FAILED with3,609,116,672B unexplained growth and missing pre-build containerd allocation remains unknown. Scope6180234041/reference6180335648 are direction only; original0bPASS does not approve this successor. Terminal always imageEligibility=false/imageAdoptionReceipts=0/proof0/deploy0/fullGrowthAttributionCompleted=false. Any later validator/adoption-receipt source requires separate exact review and full attribution with residual>=500MB STOP. All future adoption/proof/scientific214209impact/invalidStoredAnalysisSampleCount/sample-owner lists/policyPRESENTNO_OP0orSTOP/retained allocations/nonzeroYY/approved-amendmentSTOP/separate forward remedy/final exactkit/fresh single-use gate remain. #103 no connection/APPLYGO. Maincde8/tree638/mainCI38636615469attempt1 SUCCESS370/5649 and3source merges remain; human files/drafts/cards/history untouched.

If this new component passes, please start a NEW verdict `Source review: PASS` and include ALL literal bindings below. Authority is only one targeted metadata evidence capture at the NEW root, never adoption/proof/deploy:

```
'''.replace('BASEURL',baseurl)+'\n'.join(tokens(index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
for n,raw in [('actual-scope-before-original.json',scope),('actual-reference-before-original.json',reference),('current-main-original.json',main),('main-ci-original.json',ci),('old-source-pass-original.json',oldpass),('history-before-original.json',history),('actual-review-request-body.txt',body.encode()),('tooling-source-index.json',(json.dumps(index,indent=2)+'\n').encode())]:save(n,raw)
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('request-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':TOOLING,'newRoot':ROOT_NAME,'neverRetry':True,'imageEligibility':False,'newSourceReview':None})+'\n').encode())
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',result.stdout);save('post-stderr-original.txt',result.stderr);actual=exact_json(result.stdout) if result.returncode==0 else None
except subprocess.TimeoutExpired as e:
    save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');actual=None
if actual is None:
    after=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('reconcile-original.json',after)
    matches=[v for p in exact_json(after) for v in p if v.get('body')==body];require(len(matches)==1,'Unknown outcome; never repost');actual=matches[0]
require(actual['body']==body,'Actual request differs');save('actual-request-confirmed.json',(json.dumps(actual,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'TARGETED_METADATA_SUCCESSOR_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'toolingCommit':TOOLING,'newRoot':ROOT_NAME,'imageEligibility':False,'newSourceReview':None}))
