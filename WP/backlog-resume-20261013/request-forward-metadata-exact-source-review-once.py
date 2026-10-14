"""One concrete exact-source request for bounded metadata evidence; never adoption or execution authority."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
TOOLING='0b01804f9d409d74a19472c22469824e2df95005'
DEST=SOURCE/'exact-source-review-request-0b01804f'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==TOOLING
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==TOOLING
sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
from prepare_forward_metadata import raw_git
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
    raw,index['files'][n]=raw_git(TOOLING,'WP/batch-forward-metadata-cde8-20261014/'+n)
    require(raw==(SOURCE/n).read_bytes(),'Current published source differs')
scope_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180234041');reference_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180335648');directions(exact_json(scope_raw),exact_json(reference_raw))
main_raw=cmd('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main');require(exact_json(main_raw)['object']['sha']==CANDIDATE,'Current candidate main changed')
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');require(not any(TOOLING in v.get('body','') for p in exact_json(history) for v in p),'Source already has a notice; inspect actual history')
links='\n'.join('- ['+n+'](https://github.com/yigini/soilfer-lims/blob/'+TOOLING+'/WP/batch-forward-metadata-cde8-20261014/'+n+')' for n in sorted(SOURCE_FILES))
body='''Claudio: NEW exact-source review for the bounded read-only forward METADATA EVIDENCE component, #206+#214+#209.

I read and retained actual directions6180234041 and6180335648. All six forward conditions remain, with the corrected distinct first forensic reference set and recorded absence of the failed root's original inspect file. The first221500build remains FAILED under its500MBgate; image1d4882f4 remains FORENSIC ONLY. No new source or execution authority has been inferred from direction.

Please independently review this complete five-file graph at exact tooling source '''+TOOLING+'''. This is ONLY the bounded evidence-capture step for the eventual full growth validator/forward receipt. It never adopts the image, creates an adoption receipt, claims full3,609,116,672B attribution or makes the image proof-eligible. A later concrete validator/receipt source still needs review against actual metadata; residual>=500MB remains STOP.

'''+links+'''

[Scope, exact command families and all limits](https://github.com/yigini/soilfer-lims/blob/'''+TOOLING+'''/WP/batch-forward-metadata-cde8-20261014/README.md), [closed local/actual-host verification](https://github.com/yigini/soilfer-lims/blob/'''+TOOLING+'''/WP/batch-forward-metadata-cde8-20261014/source-local-host-verification-once/exit-original.json).

The source checks immutable raw references/modes/absence and fresh image Id/runtime platform/entireRootFS/entireConfig/revision, then records current reserve for /opt/lims,/var/lib/docker,/var/lib/containerd and bounded primary metadata from Docker/containerd/BuildKit. Commands are fixed read-only argv families; no shell. Snapshot usage is requested only for committed snapshots. OCI retrieval follows small linux/amd64 manifest/config metadata for candidate/base digests from the original log, never layer payloads. Raw command stdout/stderr/exit/time/hashes remain exact. Unknown/oversized/incomplete interfaces STOP and keep the image excluded; no truncation/ownership invention.

Please specifically inspect the BuildKit DiskUsage API via `docker buildx du --format json`: this is an API metadata read, with no filesystem du executable. Docker/buildx client state, temp and cache paths are confined to the NEW owned root. Calls10seconds/2MiB, collection600seconds/256calls, snapshots<=80pernamespace and OCI<=32objects. The new fixed metadata233000root/unit is uncreated; unitMemoryMax805306368/MemorySwapMax0/RuntimeMax900/Restartno/UMask0077; stdout/stderr append within the newroot, and its initial inventory allows only those two fresh empty unit outputs plus0400inputs. No pull/push/save/load/build/retag/container start/prune/DBconnection/volume/daemon/config change/originalroot write. Both YY pins and unchangedfloor10556150894/abort500000000 remain.

Fresh exact source/main/CI/directions/later rejection checks are repeated before upload and immediately before launch. One prepared package/newroot/unusedunit/exclusive intent, no replay/cleanup and same-root/unit inspection after unknown outcomes. Evidence terminal always says imageEligibility=false/imageAdoptionReceipts=0/proof0/deploy0/fullGrowthAttributionCompleted=false; no source branch can grant image or deployment authority.

Closed current verification23:26:55.513691UTC:14 local +14 actualhostPython3.9.23 pure guards PASS/all5compile/hashunchanged; zero metadata operator/imageinspect/adoption/receipt/productionconnection in tests. Actual existing CLI helponly at23:07:15UTC confirms ctr2.2.0 interfaces; no attribution code has run. Original preliminary12-test quick boundary is labeled a tool-output transcription, not final current proof. All23owned publication blobs independently raw-Git verified. No server/client/application/CI source changed.

Candidate cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367/tree638580d50f61254609de3abd42d93afc676a5727/mainCI38636615469 attempt1 SUCCESS370/5649 and all3 appPASS/merges remain. Future exact adoption source, separately reviewed stoppedproduction-copy proof, actual214209lists/invalidStoredAnalysisSampleCount/sampleowner/policyNOOP0orSTOP/fullretainedallocation/nonzeroYY/approvedSTOP/finalexactkit/freshgate remain required. #103 no connection/APPLYGO; first failedroot/image/logs/gate and historical#200/humanfilesdraftscards untouched.

If this bounded metadata-only component passes, please start a NEW verdict with `Source review: PASS` and include ALL literal bindings below. This approves only this first evidence capture, not image adoption, proof or deploy:

```
'''+ '\n'.join(tokens(index))+'\n```\n'
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
for n,raw in [('actual-scope-before-original.json',scope_raw),('actual-reference-before-original.json',reference_raw),('current-main-original.json',main_raw),('history-before-original.json',history),('actual-review-request-body.txt',body.encode()),('tooling-source-index.json',(json.dumps(index,indent=2)+'\n').encode())]:save(n,raw)
payload=(json.dumps({'body':body},ensure_ascii=False)+'\n').encode();save('request-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'toolingCommit':TOOLING,'scope':SCOPE,'neverRetry':True,'imageEligibility':False,'newSourceReview':None})+'\n').encode())
try:
    result=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',result.stdout);save('post-stderr-original.txt',result.stderr);actual=exact_json(result.stdout) if result.returncode==0 else None
except subprocess.TimeoutExpired as e:
    save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');actual=None
if actual is None:
    after=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('reconcile-original.json',after)
    matches=[v for p in exact_json(after) for v in p if v.get('body')==body];require(len(matches)==1,'Unknown source request outcome; never repost');actual=matches[0]
require(actual['body']==body,'Actual source request differs');save('actual-request-confirmed.json',(json.dumps(actual,indent=2,ensure_ascii=False)+'\n').encode())
print(json.dumps({'status':'BOUNDED_METADATA_EXACT_SOURCE_REVIEW_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'toolingCommit':TOOLING,'imageEligibility':False,'newSourceReview':None}))
