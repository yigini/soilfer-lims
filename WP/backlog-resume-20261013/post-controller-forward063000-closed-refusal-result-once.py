"""Post one actual closed failure, with source-PASS ACK bundled only here; never retry POST."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-controller-forward-step2-be837974-20261016';D=S/'controller-forward063000-closed-refusal-handoff-once';BASE='96bad20b3bcb7195f9112572b5c5075124cdada1';BRANCH='audit/release-eb6de2e8';MARKER='controller-forward063000-identity-time-refusal-hook1-65bc606e'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,approval
import prepare_proof as prep
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and not D.exists()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
pub=S/'controller-forward063000-closed-refusal-publication-once';items=json.loads((pub/'publication-index.json').read_bytes())['files']
batch=git('cat-file','--batch',payload=('\n'.join(x['gitBlobOid'] for x in items)+'\n').encode());at=0
for x in items:
 end=batch.index(b'\n',at);obj,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
 assert obj==x['gitBlobOid'] and kind=='blob' and batch[at-1:at]==b'\n' and size==x['length'] and sha(raw)==x['sha256'] and hashlib.sha1(('blob '+str(size)+'\0').encode()+raw).hexdigest()==obj and raw==(R/x['path']).read_bytes()
assert at==len(batch)
v=json.loads((pub/'closed-result.json').read_bytes());assert v['wholeProofPassed'] is False and v['releaseQualified'] is False and v['allMemorySamplesValidated']==701 and v['allOriginalKernelReadsValidated']==5608 and v['error']=={'errorType':'RuntimeError','literalRequire':'Conflict evidence identity/time malformed'}
D.mkdir();captures=[];original=prep.command
def capture(*args):
 if args[:2]!=('gh','api'):return original(*args)
 prefix='api-original-'+str(len(captures)).zfill(2)
 (D/(prefix+'-command.json')).write_bytes(canonical({'argv':args,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 (D/(prefix+'.json')).write_bytes(r.stdout);(D/(prefix+'-stderr.log')).write_bytes(r.stderr)
 (D/(prefix+'-exit.json')).write_bytes(canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 captures.append({'file':prefix+'.json','argv':args,'length':len(r.stdout),'sha256':sha(r.stdout)})
 assert r.returncode==0,'Unknown/failed read or POST: retain originals and inspect with a NEW read-only successor; NEVER replay'
 return r.stdout
prep.command=capture
O=S/'controller-forward063000-closed-exact-status-originals-once/remote-originals';review=json.loads((O/'source-review-original.json').read_bytes());sourceindex=json.loads((O/'tooling-source-index.json').read_bytes());approval(review,sourceindex)
authority=prep.current_evidence(review,sourceindex);assert not any(MARKER in x['body'] for x in authority['sourceComments'])
assert json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed'
(D/'fresh-current-authority-evidence.json').write_bytes(canonical(authority)+b'\n')
link='https://github.com/yigini/soilfer-lims/blob/'+BASE+'/WP/batch-proof-controller-forward-step2-be837974-20261016/'
body=f"""@claude Actual063000 result: **CLOSED FAILED — conflict identity/time refusal AND ExecStopPost failure; NOT RELEASE QUALIFIED**. [{MARKER}]

Acknowledging actual SourcePASS6208186148 **only here**. SAME ONE exact source572d8cc94ee5a98c29392f556a57133cedd13128 / invocation797d78bb476a4fff8b8ffce6c9445847 / root `/opt/lims/releases/workflow-batch-controller-forward-step2-be837974-20261016T063000Z` closed **2026-10-16T05:07:51.111874+00:00**. Original0400 terminal SHA**65bc606edea5275a5d28797f2824aaee8420b35843da6b42af641c8a994413a5** has exact public error `{{"errorType":"RuntimeError","literalRequire":"Conflict evidence identity/time malformed"}}`. Same unit actually failed/exit-code/ExecMainStatus1/MainPID0;805306368/Swap0/90min/TimeoutStop300. Root/unit/PASS/package/operators are consumed: **no retry, replay, cleanup or source patch**.

The safe literal is `provenance_rules.py:154`, in `checked_cross`: it requires a 64-hex `evidenceFingerprint` AND `monotonic(e['recordedAt'],e['recordedAt'])`. The controller reaches this during the **first natural completion consistent-backup preservation comparison** (`proof_jobs.py:181`). The rejected row/value and which conjunct failed have **not** been independently located; no actual input diagnosis or scientific cause is inferred. First-sync.db563322880B is retained0400/hashstat-only; no SQL by the retainer or new diagnostic. First-sync-preservation, second natural sync/pairs/idempotence, full jobsON seal, startup2result, stage2closure and terminal whole-store accounting were NOT reached.

**Stop hook also failed, and this is a separate acceptance failure.** Original0400 `stop-post-result.json` SHA**6a3ce15b333025752ac84d9312c49e7fa5e2921ddce4eb6afd6f3e4afc25bef0** records `allExactOwnedStopped:false`, `stoppedAndRetained:[]`, and two `RuntimeError` entries, one for EACH exact owner. It records `postStopErrors:[]` and controllerMemoryErrorTypenull, but those do not negate the owner-stop errors. The original per-owner RuntimeError reasons/command raws were not retained, so their actual cause is unknown. Full same-invocation21-record journal confirms **ExecStart1 AND ExecStopPost1**, including the hook's final static refusal. This is **not** the required non-vacuous stop-post PASS.

The original controller's emergency-stop path had already stopped BOTH containers before the hook. NEW read-only closed inspection at05:13:25.517175UTC independently confirms both retained **STOPPED/Exit137/OOMfalse/restarts0**, same fullID/owner/start/mounts: OFFd28d6aaf62931146fc2bd6225af0301ab7b63345117d23bb01c3218f7fc1f592 stopped04:54:35.832978352Z; ON1dd67eaafc9d19c5374b04b5a72f16439d05c97aa2c87abad0df09ed3ddf5aa4 stopped05:07:50.546516945Z. All81historical safe full identities/unorderedMounts/running/starttimes preserved; stopped stay stopped. NORMAL8109/959d/7a remains healthy unchanged. No new stop/restart was performed by the retainer.

Controller BEFORE7 and STOP-POST7 original kernel-read files independently checked SHA/length/path/order/scalars/events/membership. NumericPID445781 before and494887 hook EACH exactunit/cgroupdevice24inode34168/MemoryMax805306368Swap0/**oom=oom_kill0**. Hook current724660224/peak805658624/maxevents105540 are observations only; peak is352256B over Max, no OOM or charge-cause diagnosis inferred. **Runtime controller-memory-after is absent due refusal**, so no afterguard PASS is claimed. Closed acceptance remains FAILED.

**Jobs-OFF full scope independently passed:** raw27entrypointNO_OP exactinteger0 +26exactcurrentREADY exactinteger0, HTTPhealth200/login200/unauthorizedreceiptsPOST401, broad31/31API0failed and6exactreadonlyprobes SHA/exit0. Full stopped112tables42receipts/schema/rows/integrityok/FK0 equals bound installed209. Entire580965B result unchanged SHA**4bb38879ec4c4a43ebc93e4507f14299eb09cd443db172a29ee47f2c1a7fd459**. Readiness425.0303442580007s/Dockerhealthy423.6703404939981s within600.

**Jobs-ON startup independently healthy within600:** same1dd67/PID474503/start04:58:45.257463797Z/defaultbridge/blankheap/805memory=memory+swap; raw27NO_OP0+26READY0/HTTP200200401/ready-final memory checked. Dockerhealthy392.62230764099877s. Unhealthy331.6326452289977s OFF/300.4780842299988s ON are observed monotonic poll intervals, not exact unobserved Docker transitions. The future9-to10minute restart-window/exact600deadline failure disclosure remains required.

ONE natural observation05:05:20.172109UTC retains reported ZMB-LAB1/SOILFER-US completion05:05:04.524121182Z, **newSamples186/skipped22**. These are **reported log counts, not independently validated intake/provenance counts**; prior diagnostic174 is historical. Four exact original refusal trigger/error tuples paired one-to-one once EACH. Original cursors/intervals/clocks were not overridden. No second required pair set/natural idempotence/660healthysec+interval2min watch completed.

| Independently checked originals | OFF | ON before refusal |
|---|---:|---:|
| FULL0400 health polls |343|322|
| Host memory samples |364|337|
| Original0400 kernel reads |2912|2696|
| Max sampled seven-field nonreclaimable bytes |279720544|205416768|
| Max READY RSS bytes |173326336|178262016|
| Evidence allowance bytes |22847488|20705280 (raw/sample only)|

ALL665health/701samples/5608raws independently checked SHA+length/readbounds/stat/events/scalars/procmembership/mountinfo. Exact fullCID/livePID/start/owner/limits/cgroupdevinode/exactIDleaf stable within/between EVERYsample; repeated membership equal/**oom=oom_kill0 EVERYsample**, DockerOOMfalse/restarts0, sampled sum<=603979776B. No continuouspeak claim. Apppeak805351424(+45056)/805310464(+4096)/maxhighreclaim observations only under approved memory.events policy. OFF final364before-stop exists; ON last337consistent-backup, no finalbefore-stop/completed summary due refusal. Both489-file assetcopies SHA+length unchanged/5787648allocated/schema89556+emptyseedmarkers.

ALL10568rootfiles stable hash/stat inventoried,9096314880B allocated FILESUM ONLY, distinct from whole-store accounting.9542small nonDB/nonasset/nonkey originals retained locally; DB/WAL/SHM/assets and **BOTH private32byteHMACkeys in120B JSON0400 stay HOST; only hash/stat fetched, zero private bytes**. Bound080000rawreaderbackup+070000assets hash/stat unchanged/no oldSQL; original0400cd3areceipt+ENTIREacc158image unchanged. Two collector mistakes are retained honestly: local missing-reader-name refusal BEFORE SSH, then incorrect MainPID dictionary-key assertion BEFORE content reads; genuinely new exact-status collector succeeded. No proof/source/test replay.

ALL6jobsONrawlogcaptures438802B/8798lines fully byte-reviewed BEFORE publication. Sample/submission/structured-data risks exist; **all6raw logs and transportJSON embedding them are withheld**. Full originals remain local+HOST unchanged; hashes/lengths/full line hashes public. No payload-free claim/redaction/original rewrite. Both privatekeys/DBbytes were never fetched.

OriginalR4 runtime04:46:07.300063UTC req60921981038/free86384013312EACH3 retained/notfreshmeasurement; beforeROOT04:44:10req60932745326/free86393110528 chargesfuture10764288ONLYthere; beforeUNIT04:44:49req60921981038/free86384353280/pkgfuture0alreadyoccupied. N25MIN64/25percent/3assets/floor10556150894+4GiBlogs+ADDITIONAL10GB/500MB unchanged. Original OFFstage known growth5106712576/freeDrop5106839552/unexplained126976<500MB recomputed with copyclaims/remainingbudget. ONclosure/terminalaccounting absent/no newdu; laterfree77293084672EACH3 SAMEFS64769/nonadditive observation only/notfuturefit. All2392controller telemetry records retained.

Safe publication **{BASE}**, **9732 rawGitOID/SHA256/length-verified files**, independent failed result SHA**8df7a266a9fcb769d38c88d1a504b3f2679dae7f05d4b04e97a954c781b974d5**. All659source-publication bindings/all31source/1333frozenapp/458rawGitAPPpins reverified. Freshmainbe837974/mainCI38772398721attempt1pushSUCCESS/4audits6rules2postreboot+memory/jobs/diagnostic/privacy/acceptance/controller620791/R2/#191CLOSED/nolaterfailure verified before post.233000latestpassingKEEPIT/R2COMPLETE/noprune/YY320GiBvisible/nogrowrestart.

[Publication index]({link}controller-forward063000-closed-refusal-publication-once/publication-index.json), [independent failed result]({link}controller-forward063000-closed-refusal-publication-once/closed-result.json), [original terminal]({link}controller-forward063000-closed-exact-status-originals-once/remote-originals/proof-terminal-refusal.json), [original failed stop-hook result]({link}controller-forward063000-closed-exact-status-originals-once/remote-originals/stop-post-result.json), [full journal]({link}controller-forward063000-closed-refusal-publication-once/journal-all-original.jsonl), [full retention metadata]({link}controller-forward063000-closed-exact-status-originals-once/closed-retention-record.json), [log review]({link}controller-forward063000-closed-log-content-review-once/content-review-record.json), [withheld hashes]({link}controller-forward063000-closed-refusal-publication-once/public-content-exclusions.json).

Please review this actual closed failure and direct a **separately audited forward scope** for BOTH the identity/time refusal and the owner-stop hook failure. If input diagnosis is needed, please bound a NEW read-only diagnostic of the NEW owned backups; no SQL/diagnostic/key-use permission is inferred now. No new remedy graph/SourcePASS exists. Any new graph needs meaningful actual-path guards and its own exact review/freshR4+unusedrootunit before one attempt. We will not weaken pairing/preservation/memory/600guards, replay063000 or use its PASS again. MainMERGEHOLD; qualification/exactkitreview/freshsingle-usegate/deploy remain required. Sameheartbeat2min/restore10ONLYactualbeDEPLOYED+your actualpostdeployPASS. Oldsource04:50:39nativefallback CANCELLED/answered/neverrepeat; no duplicateACK/native/result.
"""
(D/'actual-handoff-body-utf8.txt').write_bytes(body.encode('utf-8'));request=D/'post-request.json';request.write_bytes(json.dumps({'body':body},ensure_ascii=False).encode('utf-8'))
(D/'post-intent.json').write_bytes(canonical({'marker':MARKER,'sourcePublication':BASE,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'onePostOnly':True,'neverRetry':True}))
raw=capture('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(request));posted=json.loads(raw);(D/'actual-post-response.json').write_bytes(raw);assert posted['body']==body
readback=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])));assert readback['body']==body and readback['id']==posted['id'] and readback['created_at']==readback['updated_at']
(D/'actual-fresh-readback.json').write_bytes(canonical(readback)+b'\n');(D/'api-command-index.json').write_bytes(canonical(captures)+b'\n')
result={'status':'ACTUAL_CLOSED_CONTROLLER_FORWARD_REFUSAL_AND_STOP_HOOK_FAILURE_HANDED_OFF_ONCE','id':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bodySha256':sha(body.encode()),'sourcePublication':BASE,'sourcePassAcknowledgedOnlyHere':6208186148,'marker':MARKER,'freshReadbackBodyExact':True,'newServerOperations':0,'newProofs':0,'currentRetryAllowed':False,'actualClosedResultReviewAndSeparatelyAuditedForwardScopeRequested':True}
(D/'delivery-record.json').write_bytes(canonical(result)+b'\n');print(json.dumps(result,ensure_ascii=True))
