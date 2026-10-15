"""One actual qualification progress notice; not a deployment or proof-ready notice."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-proof-cde8-20261015/b5-qualified-build-handoff-once'
assert not DEST.exists();assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO).decode().strip()=='5d9d719aca6614fddce01e15b85ac73ecc21f318'
history=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=REPO)
marker='b5-qualified-build-010000-c03ca0cd'
assert not any(marker in v.get('body','') for p in json.loads(history) for v in p),'Never duplicate the qualification notice'
body='''Claudio: NEW build-only qualification completed. Reference `b5-qualified-build-010000-c03ca0cd`.

Your actual SourcePASS6181452519 on exact6608548a authorized the ONE corrected-accounting run010000. The new ordinary cached Docker build exited0 in4.337801618s. Original receipt closed00:27:51.026962UTC, status `BUILT_AFTER_EXCLUDED_ACCOUNTING_FAILURE_NOT_PROVED_OR_DEPLOYED`, SHA256c03ca0cd16395a451a12f1606655166f0dfe0b3f78516212034b548888c7a3fd. NEW image sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb,414679214B, revisioncde8/tree638.

All3bound filesystems are device64769: free58684194816→58617470976/drop66723840. Exact physical growth is ownedroot66121728 plus /var/lib/containerd602112, Docker substores0; total66723840/unexplained0, floor10556150894 passed. Original24inputs0400/1561raw index entries/1560extracted source files+allGit hashes/modes verified unchanged. Sealed ID/log/receipt/originalinspect0400. A distinct post-closure read-only image response equals the ENTIRE original image inspection. Original topology before/after equals, including daemonPID/configSHA. ONE actual invocationa856dfdc5dcf401698724f7ef9459933 journal proves start/done/successfuldeactivation; unit was unloaded afterward, and not-found default props are not passed off as executed limits. Actual active opening805306368memory/swap0/45min is separately retained.

[Full51verified closed originals and independent qualification](https://github.com/yigini/soilfer-lims/blob/b1d68199ec356d744950f801515874e6a7096474/WP/batch-build-containerd-cde8-20261015/first-build-010000-closed-success/index.json). The first221500FAILED/1dexcluded/old3,609,116,672Bunproved/233000STOP/000500metadata-only+850ccanalysis remain immutable, with no retroPASS/adoption/old-residual credit. No replay/rebuild/retag/cleanup. The120s measurements succeeded; no300s successor is needed.

[Fresh normal-predecessor metadata and NONEXECUTABLE proof authority draft](https://github.com/yigini/soilfer-lims/blob/5d9d719aca6614fddce01e15b85ac73ecc21f318/WP/batch-proof-cde8-20261015/authority-preparation-index.json): actual /soilfer-lims8109d78e/rev959d/image7aeb was RUNNINGHEALTHY/0restarts/noOOM/memory805/blankheap/pushseedfalse/jobsON/samevolumes at00:38:56UTC. Output is safe SELECTED DERIVED metadata, not full raw inspect/environment. No database connection/count/volume-file-open/copy/startstop/settings change.

Next I am preparing a genuinely new complete source-bound stopped production-copy proof using this qualifiedb5/receiptc03 and the normal healthy predecessor. It is not the old held-entry route. Proof-source/actual-source-PASS/snapshot/stopped-PASS/kit/kit-audit/gate slots remain NULL. This is a progress notice, not a proof approval request. Prospective106/39→112/42 remains source/receipt-derived, not current production counts. No production snapshot/installer/default-entrypoint/proof/kit/gate/deploy/#103connection. The full next source must preserve all originals/stoppedcontainers, avoid historical --rm/cleanup/root/image authority, enforce policyPRESENT/NO_OP0orSTOP, actual214/209impact/invalidStoredAnalysisSampleCount/sample-owner lists/nonzeroYY/approved-amendmentSTOP/separateforwardremedy/fullretainedallocation+Dockerctrd/exactkit/freshgate. BothYYpins/alllimits/humanfilesdraftscards unchanged. Never replay this completed build or duplicate this notice.
'''
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('history-before-original.json',history);save('actual-qualified-notice-body.txt',body.encode());payload=(json.dumps({'body':body})+'\n').encode();save('post-payload-original.json',payload)
save('post-intent.json',(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'marker':marker,'neverReplay':True,'proofSourceReview':None,'productionDeployments':0})+'\n').encode())
try:
    r=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input','-'],cwd=REPO,input=payload,capture_output=True,timeout=60)
    save('post-response-original.json',r.stdout);save('post-stderr-original.txt',r.stderr);actual=json.loads(r.stdout) if r.returncode==0 else None
except subprocess.TimeoutExpired as e:
    save('post-response-partial.txt',e.stdout or b'');save('post-stderr-partial.txt',e.stderr or b'');actual=None
if actual is None:
    raw=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=REPO);save('reconcile-original.json',raw)
    matches=[v for p in json.loads(raw) for v in p if v.get('body')==body];assert len(matches)==1,'Unknown outcome; never repost';actual=matches[0]
assert actual['body']==body;save('actual-post-confirmed.json',(json.dumps(actual,indent=2)+'\n').encode())
print(json.dumps({'status':'QUALIFIED_BUILD_PROGRESS_NOTICE_POSTED_ONCE','id':actual['id'],'url':actual['html_url'],'createdUtc':actual['created_at'],'proofSourceReview':None,'productionDeployments':0}))
