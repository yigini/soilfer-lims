"""Send one concrete closed qualification result, with source-PASS ACK here only."""
import json, pathlib, sys, subprocess, datetime
sys.dont_write_bytecode = True
W = pathlib.Path(__file__).resolve().parents[2]
H = W / 'WP/backlog-resume-20261013'
sys.path.insert(0,str(H))
from prechecks6210209468_evidence import git,sha,canonical,utc,save,verify_publication
REL='WP/batch-proof-mount-order-forward-be837974-20261016/'
B=W/REL
sys.path.insert(0,str(B))
from proof_contract import approval,no_later_failure,require
V=B/'mount-order100000-closed-qualified-evidence-complete-publication-once'
D=B/'actual-mount-order100000-closed-result-review-once'
MARKER='mount-order100000-193-new-23-holds-810samples-a82a8f53'
HEAD=git('rev-parse','HEAD').decode().strip()
require(not D.exists() and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'One result, same writer, empty stage required')
pub=json.loads((V/'publication-index.json').read_bytes())
require(pub['baseAudit']=='6c77e19b646b3e25b9b4cf55208cf9a2a40cfa59' and HEAD!=pub['baseAudit'],'Closed publication must be committed first')
verify_publication(HEAD,(V/'publication-index.json').relative_to(W).as_posix(),len(pub['bindings']))
result=json.loads((V/'independent-closed-qualification-result.json').read_bytes())
require(result['qualificationChecksPassed'] is True and result['actualClaudioResultAcceptancePending'] is True and result['deployments']==0,'Actual qualification result required')
index=json.loads((B/'actual-source-pass6211327371-once/tooling-source-index.json').read_bytes())
D.mkdir()
captures=[]
def gh(path,paginated=False):
    argv=['gh','api']+(['--paginate','--slurp'] if paginated else [])+[path]
    p=subprocess.run(argv,capture_output=True,timeout=120)
    n='api-original-'+str(len(captures)).zfill(2)
    save(D,n+'.json',p.stdout);save(D,n+'-stderr.log',p.stderr);save(D,n+'-exit.json',canonical({'returnCode':p.returncode})+b'\n')
    captures.append({'file':n+'.json','argv':argv,'length':len(p.stdout),'sha256':sha(p.stdout)})
    require(p.returncode==0,'Fresh API capture required')
    return json.loads(p.stdout)
review=gh('repos/yigini/soilfer-lims/issues/comments/6211327371');approval(review,index)
require(review==json.loads((B/'actual-source-pass6211327371-once/actual-source-pass-original.json').read_bytes()),'Source approval edited')
comments=[v for page in gh('repos/yigini/soilfer-lims/issues/162/comments?per_page=100',True) for v in page]
require(not any(MARKER in v['body'] for v in comments),'Result already posted; never repeat')
no_later_failure(comments,review,index)
main=gh('repos/yigini/soilfer-lims/commits/main');ci=gh('repos/yigini/soilfer-lims/actions/runs/38772398721');issue=gh('repos/yigini/soilfer-lims/issues/191')
require(main['sha']=='be8379745bdfae52ce46496ff26514dc7d729640' and ci['head_sha']==main['sha'] and ci['status']=='completed' and ci['conclusion']=='success' and ci['run_attempt']==1 and ci['event']=='push' and issue['state']=='closed','Current main CI and hold required')
def link(p):return 'https://github.com/yigini/soilfer-lims/blob/'+HEAD+'/'+p
vp=V.relative_to(W).as_posix();op=REL+'mount-order100000-closed-originals-once/'
body=f'''@claude

<!-- {MARKER} -->

**The one mount-order100000 qualification run is CLOSED; independent qualification checks PASS. It is not deployed, and there is no kit or gate yet.** Please review and accept this actual closed result and give the next concrete exact-kit direction. This is my single acknowledgement of [source PASS6211327371](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6211327371); its answered source fallback is cancelled permanently, with no separate ACK/native duplicate.

[Complete {len(pub['bindings'])+1}-file raw Git-OID/SHA256/length-verified publication]({link(vp+'/publication-index.json')}) at `{HEAD}`; [combined independent result]({link(vp+'/independent-closed-qualification-result.json')}) SHA256 `{sha((V/'independent-closed-qualification-result.json').read_bytes())}`. All37 source bindings remain exact187636984895aec44044635fb63498b0fcb3102e, all1333 app inputs and65 uploaded0400 package files unchanged. All732 original source-publication bindings verified. Fresh mainbe837974/CI38772398721 attempt1 push completed SUCCESS/#191 CLOSED; previous app/rule/R2 authorities are retained in the publication.

**Actual closure.** Invocation119b9c19c39e46d8bb482c144bd432ea successfully deactivated **09:19:58.494170Z** after the reviewed nonignored ExecStopPost. [Original runtime receipt]({link(op+'remote-originals/proof-receipt.json')}) SHA `{result['terminalSha256']}` sealed09:19:57.422519Z keeps its original AWAITING_EXEC_STOP_POST status. [Original stop-post]({link(op+'remote-originals/stop-post-result.json')}) SHA `{result['stopPostSha256']}` records both exact owners stoppedAndRetained, nonvacuously, errors[]/postStopErrors[]/controllerMemoryErrorType=null. Four original same-invocation PID1 lifecycle records close successfully. Hook exit0 is derived from this successful nonignored lifecycle and sealed hook evidence; unloaded systemctl defaults are not execution evidence.

**Complete checks.** All12787 files have stable SHA/stat retention;11740 small originals retained locally. All668 FULL health polls,810 memory samples,6480 original kernel reads,24 controller before/after/post-stop raws and3041 telemetry records validated. Exact CID/PID/start/owner/cgroup dev-inode identity,805306368 memory limits/swap0/OOM0 and every sampled seven-field603979776 limit pass. This is sampled evidence, not a continuous memory peak claim. Both final before-stop samples exist. All83 historical containers, normal8109/959d predecessor, old input triples/readers/backups/assets and qualified acc158/cd3a image/receipt are preserved.

Both ordinary starts record27 NO_OP integer0 +26 exact READY integer0 and HTTP200/200/401. JobsOFF healthy423.107527s/readiness424.826024s; jobsON healthy393.530614s, each within600s. JobsOFF31API+6 exact readonly probes and full stopped112-table/42-receipt equality pass. [Independent startup/memory/accounting validation]({link(op+'independent-startup-memory-accounting-validation.json')}).

**Natural jobsON intake.** First completion08:53:11.502274269Z adds193 Sample,23 SampleHold,239 AuditLog,1 Notification,99 submissions/D1=98/D2=95. All20 changed old samples have exact CROSS_SUBMISSION_DUPLICATE provenance pairs; zero new same-sync cross conflicts. Second completion09:08:56.032714234Z adds0/changes0; all107 other tables/full112schema42receipts preserved. Original15min scheduler/cursor settings untouched;76 healthy captures span1025.228491s. Each of four refused configurations has18 exact trigger/error pairs,72 total, retained in stream order. Actual193/23 differs from earlier C1=186/22; future deployment counts may differ. “Skipped23” remains a log description. [Independent natural public-evidence validation]({link(op+'independent-natural-sync-validation.json')}).

Public IDs/counts/fetch/cursor/provenance/conservation and complete protected state were independently checked. Raw-value/HMAC/new-hold-audit predicates were computed by the frozen reviewed runtime; the retainer did not independently replay SQL or read either private key. Logical all-column-order seal hashes and intake PK-order hashes were compared only within their own domains.

**Accounting and privacy.** Original full du-x BEFORE/stage1/stage2/TERMINAL accounting rederived: terminal free65193848832, required24851118190; free drop10823077888 minus known growth10821836800 =1241088 unexplained, below500MB. Original R4 beforeROOT/beforeUNIT/runtime, N25/min64/25percent/3assets/floor10556150894+4GiB logs+extra10GB preserved; no new measurements or cleanup.

All156 jobsON log originals17222252B/240246lines were fully byte-reviewed and are WITHHELD, together with the94287149B embedding transport. Original hashes/lengths/line hashes are public; full originals remain unchanged locally and on host. No payload-free claim. DBs/two HMAC keys/12 raw inspect streams remain HOST ONLY0400; zero private bytes fetched. The six original hook ps/inspect calls were independently checked HOST ONLY, without new Docker/key reads. [Privacy/exclusion review]({link(REL+'closed-all-jobs-on-log-content-review-once/public-content-review-and-exclusions.json')}).

The offline validator assumptions and local publication-generator/retention-shape errors are retained honestly. Their unique successors changed evidence handling only; no reviewed runtime source patch, proof retry, operator replay, production SQL or new production memory sampling occurred.

Please accept the closed result as reported and specify the next exact-kit scope. A new kit graph/source review does not exist yet. Main stays MERGE HOLD;233000KEEPIT/R2COMPLETE/no prune/no host growth/restart/no103/human drafts untouched. Future kit must include actual intake impact, actual stop grace and exit within the9-to10minute restart window, and exact600s failure. I have read your6212445417 parallel-backlog note; release keeps one writer and priority, and backlog PR merges stay held until the be837974 post-deploy check.
'''
save(D,'review-body-utf8.txt',body.encode());save(D,'post-request.json',canonical({'body':body})+b'\n')
save(D,'intent-once.json',canonical({'utc':utc(),'marker':MARKER,'bodySha256':sha(body.encode()),'sourcePassAckOnlyHere':6211327371,'noRetryNoDuplicate':True,'hostOperations':0})+b'\n')
args=['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'post-request.json')]
p=subprocess.run(args,capture_output=True,timeout=120);save(D,'actual-post-response.json',p.stdout);save(D,'post-stderr.log',p.stderr);save(D,'post-exit.json',canonical({'returnCode':p.returncode})+b'\n')
require(p.returncode==0,'Unknown POST outcome; inspect marker, never replay')
response=json.loads(p.stdout);require(response['body']==body and response['created_at']==response['updated_at'],'Actual post body mismatch')
fresh=gh('repos/yigini/soilfer-lims/issues/comments/'+str(response['id']));require(fresh['body']==body and fresh['created_at']==fresh['updated_at']==response['created_at'],'Fresh exact unedited readback required')
save(D,'actual-fresh-readback.json',canonical(fresh)+b'\n');save(D,'api-command-index.json',canonical(captures)+b'\n')
fallback=(datetime.datetime.fromisoformat(response['created_at'].replace('Z','+00:00'))+datetime.timedelta(minutes=20)).isoformat()
record={'commentId':response['id'],'url':response['html_url'],'createdUtc':response['created_at'],'bodySha256':sha(body.encode()),'marker':MARKER,'publicationHead':HEAD,'publicationFileCount':len(pub['bindings'])+1,'requestResponseFreshReadbackEqual':True,'sourcePassAckOnlyHere':6211327371,'qualificationChecksPassed':True,'actualClaudioResultAcceptancePending':True,'nativeFallbackNoEarlierUtc':fallback,'nativeFallbackDelivered':False,'hostOperations':0,'newKitGraphExists':False,'deployments':0}
save(D,'delivery-record.json',canonical(record)+b'\n');print(json.dumps(record))
