"""ONE concrete exact-source request; acceptance ACK bundled here only."""
import datetime,hashlib,json,pathlib,subprocess,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-provenance-step2-be837974-20261016/';B=W/REL;D=B/'exact-source-review398-once';SOURCE='937901c7514437fc3937639454e621d1bfd68dc4'
sys.path.insert(0,str(B))
import prepare_proof as prep
from proof_contract import *
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def batch(ref,names):
    data=git('cat-file','--batch',input=('\n'.join(ref+':'+n for n in names)+'\n').encode());at=0;out={}
    for n in names:
        end=data.index(b'\n',at);given,kind,count=data[at:end].decode().split();count=int(count);at=end+1;raw=data[at:at+count];at+=count
        require(given==oid(raw) and kind=='blob' and data[at:at+1]==b'\n','Raw Git framing differs');at+=1;out[n]=raw
    require(at==len(data),'Expanded Git response');return out
require(git('rev-parse','HEAD').decode().strip()==SOURCE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Exact source writer and unused request required')
pubpath=REL+'source398-complete-publication-once/publication-index.json';pubraw=batch(SOURCE,[pubpath])[pubpath];rows=exact_json(pubraw)['bindings'];require(len(rows)==736,'Complete source publication required');raws=batch(SOURCE,[r['path'] for r in rows])
for r in rows:require(len(raws[r['path']])==r['bytes'] and sha(raws[r['path']])==r['sha256'] and oid(raws[r['path']])==r['gitBlobOid'],'Raw source publication binding differs')
index={'head':SOURCE,'files':{}}
for n in sorted(FILES):
    raw=raws[REL+n];require(raw==(B/n).read_bytes(),'Executing NEW source graph differs');index['files'][n]={'bytes':len(raw),'sha256':sha(raw),'blob':oid(raw)}
graph(index);final=exact_json((B/'source-local-host-step2-refusal-complete-once/exit-original.json').read_bytes());require(final['status']=='PASS' and final['expectedTests']==398 and final['sourceSha256After']==graph(index),'Final398 source binding differs')
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333 and all(sha((W/n).read_bytes())==h for n,h in frozen.items()),'Frozen1333 application input changed')
captures=[];original=prep.command
def capture(*args):
    raw=original(*args)
    if args[:2]==('gh','api'):captures.append((list(args),raw))
    return raw
prep.command=capture;evidence=prep.current_evidence()
marker='step2-provenance398-937901c7-accepted6206990387'
require(not any(marker in c['body'] for c in evidence['sourceComments']),'Request already exists; never repost')
binding_tokens=tokens(index)
body='''@claude — NEW exact Step 2 source review, after your accepted Step 1 diagnostic6206990387.

ACK6206990387 is bundled ONLY here. I read your complete actual acceptance and conditions, retained it unedited at 7625655507bd852c1f800c477c7d3d1475d1c110 (43 raw bindings), and independently reverified the preceding publications. The old 003000 run remains a consumed refusal, 023000 remains accepted Step 1 only, and 233000 stays the latest passing startup-only proof. No YY question or production action.

Concrete NEW source937901c7514437fc3937639454e621d1bfd68dc4, complete31 files, README and all737 raw GitOID/SHA256/length-verified source/test/publication files:
https://github.com/yigini/soilfer-lims/tree/937901c7514437fc3937639454e621d1bfd68dc4/WP/batch-proof-provenance-step2-be837974-20261016
Publication index: WP/batch-proof-provenance-step2-be837974-20261016/source398-complete-publication-once/publication-index.json

Final398LOCAL +398 ACTUAL host Python3.9.23 guards PASS, closed2026-10-16T03:17:55.763196+00:00; all31 source hashes unchanged. Host sources only in memory, real processes/Docker/operators blocked, SQLite restricted to new retained synthetic fixtures, no host source files or production SQL. Of the prior26 sources,17 are byte-identical and9 changed;5 genuinely new modules. All old26 proof, both old8source+3data diagnostic graphs and1333 frozen application inputs are unchanged. No app/Dockerfile/CI changes.

The new predicates apply your scope/retained-fetch/occurrence/exact hold+audit checks to changed EXPECTED originals AND samples created earlier in the SAME sync, with strict intra-submission duplicate pairing. A same-sync creation-path transition baseline is explicitly labelled reconstructed, not an observed snapshot. Every added Sample gets exactly one scheduled CREATE; global exact consumption refuses every orphan/extra audit or hold, including CREATE on changed originals. All other112-table rows/schema/42receipts remain protected/no deletions. Old conflict in-place evidence revisions stay refused. Notifications require exact manager/config/count/link and the full comparison accounts for both independently validated sync batches. The actual app emits one notification per active manager for each config with new samples; the accepted fixture had one manager. The second natural comparison protects ALL first-fetch IDs and permits new additions/conflict changes/cursor advances only for retained IDs above the first-fetch maximum. Full SHA/stat of both NEW immutable comparison backups is checked before/after.

Controller-own exact unit membership/cgroup identity/raw memory.events/current/peak/max/swap before copies and before runtime completion, oom=oom_kill0. Source-bound ExecStopPost independently stops/retains only this root's TWO exact labels with full CID/deterministic name/current image/exact data-assets-temp mounts/no restart; it runs after SIGKILL/OOM/timeout as well as normal exit. Stop does not depend on reserve/headroom or memory evidence writes. One owner failure does not prevent checking/stopping the other. It records post-stop controller memory; independent closed acceptance must require successful hook, closed unit and all owned containers stopped. Runtime receipt expressly AWAITING_EXEC_STOP_POST, not a closed PASS. TimeoutStopSec300 is bounded for the two owners.

Every actual container keeps805306368 memory=memory+swap/hostSwap0/blank heap/600 total readiness including HTTP+final sample/OOM0/exact host cgroup identity/7-field sampled nonreclaimable<=603979776; peak/max/high remain observations. Broad31API+6readonly probes, both ordinary independent starts, natural two syncs/interval+2min/660 healthy seconds, exact four refusal pairings, original cursors/clocks/intervals and old-input HASHSTAT-only authority remain. No CLI/installer/policy replay/new production snapshot/manual sync.

Privacy: new fresh private32-byte HMAC key retained only0400 in NEW root; public per-row/value/error hashes keyed/no plaintext fallback. Diagnostic private rows/key have NOT been fetched. Full DB and raw jobs-ON logs stay retained on host; logs require full content review before any later public publication. No private key/row bytes in this publication.

Proposed sole NEW root /opt/lims/releases/workflow-batch-provenance-step2-be837974-20261016T050000Z / unit lims-workflow-batch-provenance-step2-be837974-20261016t050000z is UNCREATED by us. No operational package/preparer/launcher/run invocation. Fresh R4+ADDITIONAL10GB before ROOT, immediately UNIT and runtime; N25/MIN64/25%/3assets/fixed schema+markers/floor10556150894+4GiBlogs/all physical stage caps/500MB retained. Exact future package charged before ROOT only, already occupied later. No current capacity-fit claim. All actual remote programs render/compile BEFORE first SSH. Any refusal consumes the attempt; unknown outcome inspect SAME root/unit, never redispatch.

Future kit/gate must disclose first-production-sync impact (diagnostic observed174 new EXPECTED+22 provenance holds,20 on existing ZMB-LAB1 samples; managers see holds; deploy numbers may differ), PLUS9–10 minute restart window and exact production600-second readiness failure behavior. Main merges held. No kit/gate/deploy authority inferred.

Honest retained predecessors:393 local391PASS/two stale fixture clocks failed before host;393localPASS/host362PASS31Linux-URI harness refusals; unique URI successor393bothPASS; authority/mount successor398bothPASS; final398bothPASS tightens two refusal fixtures to exercise the intended scope branch. First local publisher refused four generated CPython caches BEFOREstage/commit/host; complete successor excludes only those exact local retained cache files and verifies all737 published raw bindings. No helper/test/operator replay or cleanup.

Please review this complete exact graph and conditions. If it passes, use first line `Source review: PASS` and retain ALL literal bindings below; otherwise give findings for a genuinely new source successor. Your diagnostic acceptance is scope only and is not reused as SourcePASS. One attempt remains conditional on a NEW exact PASS/current authorities/freshR4/unused root+unit. No production action.

Exact graph and literal bindings:
```
'''+ '\n'.join(binding_tokens)+ '\n```\n\n<!-- '+marker+' -->\n'
require(len(body.encode())<60000,'Bounded exact request body required')
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
save('source-index.json',canonical(index)+b'\n');save('body.md',body.encode());save('request.json',canonical({'body':body})+b'\n');save('current-evidence.json',canonical(evidence)+b'\n');save('source-publication-index-original.json',pubraw)
save('request-intent.json',canonical({'marker':marker,'sourceHead':SOURCE,'bodySha256':sha(body.encode()),'literalBindings':len(binding_tokens),'onePostOnly':True,'retryAllowed':False,'all737RawSourceBindingsVerified':True})+b'\n')
response=capture('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'request.json'));save('response-original.json',response);posted=exact_json(response)
require(posted['body']==body and posted['created_at']==posted['updated_at'],'Actual response differs; inspect same marker, never repost')
readback=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']));save('readback-original.json',readback);fresh=exact_json(readback)
require(fresh['id']==posted['id'] and fresh['body']==body and fresh['created_at']==fresh['updated_at']==posted['created_at'],'Fresh unedited readback differs; never repost')
for k,(argv,raw) in enumerate(captures):save('api-original-'+str(k).zfill(2)+'.json',raw)
save('api-index.json',canonical([{'file':'api-original-'+str(k).zfill(2)+'.json','argv':a,'bytes':len(b),'sha256':sha(b),'gitBlobOid':oid(b)} for k,(a,b) in enumerate(captures)])+b'\n')
fallback=datetime.datetime.fromisoformat(posted['created_at'].replace('Z','+00:00'))+datetime.timedelta(minutes=20)
record={'status':'ONE_ACTUAL_NEW_EXACT_STEP2_SOURCE_REVIEW_POSTED','sourceHead':SOURCE,'commentId':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'bodySha256':sha(body.encode()),'marker':marker,'literalBindings':len(binding_tokens),'allSourceBindingsVerified':737,'requestResponseFreshReadbackEqual':True,'diagnosticAcceptanceAckBundledOnlyHere':6206990387,'noDuplicateAckOrNative':True,'sourcePass':False,'packagePrepared':False,'rootCreated':False,'proofOperators':0,'nativeFallbackNoEarlierUtc':fallback.isoformat()}
save('delivery-record.json',canonical(record)+b'\n');print(json.dumps(record))
