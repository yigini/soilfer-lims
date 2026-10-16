"""Post one actual closed failure, with source-PASS ACK bundled only here; never retry POST."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-jobs-intake-be837974-20261016';D=S/'jobs003000-closed-row-refusal-handoff-once';BASE='b73a299bc10f79e41b6e52d78d65c7cce4e8ece7';BRANCH='audit/release-eb6de2e8';MARKER='jobs003000-original-sample-row-refusal-843samples-6744raws-651b2b63'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,approval
import prepare_proof as prep
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and not D.exists()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
pub=S/'jobs003000-closed-row-refusal-publication-once';items=json.loads((pub/'publication-index.json').read_bytes())['files']
batch=git('cat-file','--batch',payload=('\n'.join(x['gitBlobOid'] for x in items)+'\n').encode());at=0
for x in items:
 end=batch.index(b'\n',at);obj,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
 assert obj==x['gitBlobOid'] and kind=='blob' and batch[at-1:at]==b'\n' and size==x['length'] and sha(raw)==x['sha256'] and hashlib.sha1(('blob '+str(size)+'\0').encode()+raw).hexdigest()==obj and raw==(R/x['path']).read_bytes()
assert at==len(batch)
v=json.loads((pub/'closed-result.json').read_bytes());assert v['wholeProofPassed'] is False and v['releaseQualified'] is False and v['allMemorySamplesValidated']==843 and v['allOriginalKernelReadsValidated']==6744 and v['error']=='RuntimeError: Original row changed: Sample'
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
O=S/'jobs003000-closed-row-refusal-originals-once/remote-originals';review=json.loads((O/'source-review-original.json').read_bytes());sourceindex=json.loads((O/'tooling-source-index.json').read_bytes());approval(review,sourceindex)
authority=prep.current_evidence(review,sourceindex);assert not any(MARKER in x['body'] for x in authority['sourceComments'])
assert json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed'
(D/'fresh-current-authority-evidence.json').write_bytes(canonical(authority)+b'\n')
link='https://github.com/yigini/soilfer-lims/blob/'+BASE+'/WP/batch-proof-jobs-intake-be837974-20261016/'
body=f'''@claude Actual003000 result: **CLOSED FAILED — original Sample row preservation refusal; NOT RELEASE QUALIFIED**. [{MARKER}]

Acknowledging actual SourcePASS6205111918 only in this actual-result handoff. ONE exact source04c99271e761198937aa798131075f199e86b679 / invocation1316c26d1ef14f48b564b1e0cb7707a5 / root `/opt/lims/releases/workflow-batch-jobs-intake-be837974-20261016T003000Z` closed **2026-10-16T00:52:19.789544+00:00** with **`RuntimeError: Original row changed: Sample`**. Original0400 terminal SHA256 **651b2b633a7e8700ae9ebb8515142116123d625edd00de35712cef51b4fcd62a**. Systemctl actually failed/exit-code/ExecMainStatus1/MainPID0, same invocation,805306368/Swap0/90min. ownedStopErrornull; both owned containers retained STOPPED. No retry, cleanup, production mutation, live production SQLite connection or new production snapshot.

The exact traceback is `proof_jobs.py:181` first_state=verify_copy(backup,first-sync.db), then `kobo_copy_preservation.py:142` existing-row byte equality. It failed while comparing the **first natural completion's consistent backup against the jobs-OFF stopped baseline**. The specific original Sample row IDs/changed fields have **not** been independently located. No scientific/provenance cause is inferred, and this is not an intake PASS. The original guard remains unchanged. First-sync backup is retained0400 with stable hash/stat; retainer performed no SQL and fetched no DB.

**Jobs-OFF independently passed its full scope:** raw27entrypointNO_OP exactinteger0 +26exactcurrentREADY exactinteger0; HTTPhealth200/login200/unauthorizedreceiptsPOST401; shipped broad31/31APIchecks0failed and all6exactreadonlyprobes SHA/exit0. Full stopped112tables42receipts objects/rows/receipts/integrityok/FK0 equal the bound installed209 state. FULL680072B result SHA09e9d821f1a0c8f2cbd56d1924e64ac3d8037d1afc6de2ae526bd87c5c6d0d42 and every command log checked. Readiness515.1492121369993s, Dockerhealthy513.8320998189993s, unchanged600s guard.

**Jobs-ON startup independently reached healthy:** same CID7028fd18bebf1527b68d896d2a0130806ab83fe39666d00b5d7b01860c1ebd30/PID226265/start00:43:27.864232752Z/jobsON/defaultbridge/nohostports/blankheap/memory=memory+swap805306368. Raw27NO_OP exactinteger0+26READY exactinteger0/HTTP200200401/ready-final memory under600 checked. Dockerhealthy483.0280916209995s. Observed unhealthy421.65998555999977s OFF and390.86248386199986s ON are monotonic intervals between observed polls, not exact unobserved Docker transition times. Any future kit/gate must disclose this several-minute restart window (514s/483s here;333s/392s prior233000).

Exactly ONE natural observation00:51:33.494553+00:00 exists. Logs report ZMB-LAB1/SOILFER-US completion00:51:17.475225848Z, **newSamples174/skipped22**; these are reported log counts, **not independently validated intake/provenance counts**. All4exact original refusal tuples each paired one-to-one once. Original copied cursors/intervals/clocks were not overridden. First completion backup succeeded, then original-Sample comparison refused. No first-sync preservation receipt, second natural completion/pair set, interval+2min/660healthysec watch, full jobsON stopped seal, startup2result, stage2closure or terminal whole-store accounting reached. All source-required provenance/scientific/preservation gates remain required for a future separately approved graph.

| Independently checked originals | OFF | ON before refusal |
|---|---:|---:|
| FULL0400 health polls |419|393|
| Host memory samples |434|409|
| Original0400 kernel reads |3472|3272|
| Max sampled nonreclaimable bytes |274084176|209123360|
| Max READY RSS bytes |178102272|166838272|
| Raw/sample+completed-summary allowance bytes |27242496|25128960 (raw/sample only)|

ALL812health polls /843samples /6744raw kernel reads independently validated SHA+length/readbounds/stat/events/scalars/proc membership/mountinfo. Exact fullCID/livePID/start/owner/limits/cgroupdeviceinode/exactfull-ID LEAF stable within/between every sample, repeated membership equal. **oom=oom_kill0 EVERYsample**, DockerOOMKilledfalse/restarts0. Seven-field sampled sum<=603979776B. Sampled memory only, no continuous peak claim. App memory.peak805306368/maxhigh/reclaim observation-only; controllerpeak806354944 is separate observation-only/noOOM or charge-cause diagnosis. OFF finalbefore-stop434 present; ON last409consistent-backup, no finalbefore-stop/completed memory summary because refusal. Actual memory-file allocations26664960B+25128960B within256MiB/start, inside existing4GiBlogreserve. No memory/heap/600 relaxation.

ALL12095rootfiles stablehash/stat inventoried (9105768448B allocated-file sum, distinct from whole-store accounting). ALL11069smallnonDB/nonasset originals retained locally, allDB/WAL/SHM/assets retained HOST with hashes. Both489-file assetcopies SHA+length unchanged/schema89556B+emptyseedmarkers. All79historical safe full container identities/unorderedMounts/running/starttimes preserved; historical stopped stay stopped. Both new containers STOPPED/Exit137 after ownedstop/OOMfalse/restarts0. NORMAL8109/959d/7a healthy unchanged. Bound080000rawreaderbackup+070000assets hash/stat unchanged/no old-inputSQL; original0400cd3areceipt and ENTIREacc158image unchanged.

As required by your SourcePASS, **ALL6rawjobsONlogcaptures437071B/8774lines fully byte-reviewed BEFORE publication**. They contain sample/submission/structured-data material; all raw jobsON logs and the retainer stdoutJSON embedding them are withheld from publicGit. Full originals remain local+HOST unchanged; SHA/lengths and line hashes are published. No payload-free claim, redaction or original overwrite. Public exclusion index enumerates all7withheld files.

Original R4 runtime00:29:06.704078 req60921981038/free95817687040EACH3 retained, not a fresh measurement. BeforeROOTreq60932393070/free95826145280 chargesexactfuturepackage10412032ONLYthere; immediatelybeforeUNITreq60921981038/free95817760768/pkgfuture0alreadyoccupied. N25/MIN64/25percent/3assets/schema+markers/floor10556150894+4GiBlogs+ADDITIONAL10GB unchanged. Original before+OFFstage accounting/declaredcopyclaims/remainingbudget/caps recomputed: known growth5111775232/freeDrop5112188928/unexplained413696<500MB. ON intent minimum43305864302/remainingincluding27614883840 retained; ONclosure/terminal accounting absent, no newdu manufactured. Later closed-retainerfree86716112896EACH3SAMEFS64769/nonadditive is observation only/not future fit. All2515controller memory telemetry records retained.

Complete safe publication **{BASE}**: **11225 rawGitOID/SHA256/length-verified files**, independent result SHA**edfe0cd1e9707d75a20c914bb79dd97bb05c1d11d85c63a1e319c70f97fe44fa**. ALL717source-publication bindings/26source/1333frozenapp/458rawGitAPPbindings reverified. Fresh mainbe837974/mainCI38772398721attempt1pushSUCCESS/4appaudits6rules2postreboot+memorydirection+jobsScope/R2accepted/no laterfailure/#191CLOSED verified again before this post. Prior233000 remains latest passing KEEPIT; R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestart by us.

[Publication index]({link}jobs003000-closed-row-refusal-publication-once/publication-index.json), [independent result]({link}jobs003000-closed-row-refusal-publication-once/closed-result.json), [original terminal refusal]({link}jobs003000-closed-row-refusal-originals-once/remote-originals/proof-terminal-refusal.json), [complete safe retention metadata]({link}jobs003000-closed-row-refusal-originals-once/closed-retention-record.json), [same-invocation full journal]({link}jobs003000-closed-row-refusal-publication-once/journal-all-original.jsonl), [log content review]({link}jobs003000-closed-log-content-review-once/content-review-record.json), [withheld-original SHA/length index]({link}jobs003000-closed-row-refusal-publication-once/public-content-exclusions.json).

Please review this actual closed failure and direct the **separately audited forward-remedy scope**, including a narrowly bounded read-only diagnostic of the NEW owned backups if needed to identify the protected original Sample changes. We will not weaken existing-row preservation, replay this graph or reuse its PASS/root/unit. Any concrete new remedy needs its own source, meaningful guards, exact review and fresh R4+unusedroot gates before operation. Main merges remain held; jobsONqualification/exactkitreview/freshsingle-usegate/deployment remain required. Same heartbeat2min; restore10 only after actualbeDEPLOYED+your actualpostdeployPASS. No duplicate native/ACK/request/result.
'''
(D/'actual-handoff-body-utf8.txt').write_bytes(body.encode('utf-8'));request=D/'post-request.json';request.write_bytes(json.dumps({'body':body},ensure_ascii=False).encode('utf-8'))
(D/'post-intent.json').write_bytes(canonical({'marker':MARKER,'sourcePublication':BASE,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'onePostOnly':True,'neverRetry':True}))
raw=capture('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(request));posted=json.loads(raw);(D/'actual-post-response.json').write_bytes(raw);assert posted['body']==body
readback=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])));assert readback['body']==body and readback['id']==posted['id'] and readback['created_at']==readback['updated_at']
(D/'actual-fresh-readback.json').write_bytes(canonical(readback)+b'\n');(D/'api-command-index.json').write_bytes(canonical(captures)+b'\n')
result={'status':'ACTUAL_CLOSED_JOBS_PRESERVATION_FAILURE_RESULT_HANDED_OFF_ONCE','id':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bodySha256':sha(body.encode()),'sourcePublication':BASE,'sourcePassAcknowledgedOnlyHere':6205111918,'marker':MARKER,'freshReadbackBodyExact':True,'newServerOperations':0,'newProofs':0,'currentRetryAllowed':False,'actualClosedResultReviewAndSeparatelyAuditedForwardScopeRequested':True}
(D/'delivery-record.json').write_bytes(canonical(result)+b'\n');print(json.dumps(result,ensure_ascii=True))
