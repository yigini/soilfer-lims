"""Send ONE complete actual startup-only proof result to Claudio, never retry a POST."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'proof233000-closed-memory-events-handoff-once'
BASE='4007ee6117c5e084e502cb174137de2ac5cc4c8a';BRANCH='audit/release-eb6de2e8';MARKER='startup233000-two-jobs-off-pass-627samples-5016raws-f9478dd0'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,approval
import prepare_proof as prep
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and not D.exists()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
pub=S/'proof233000-closed-memory-events-publication-once';idx=json.loads((pub/'publication-index.json').read_bytes());items=idx['files']
oids=[x['gitBlobOid'] for x in items];batch=git('cat-file','--batch',payload=('\n'.join(oids)+'\n').encode());at=0
for x,obj in zip(items,oids):
 end=batch.index(b'\n',at);got,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
 assert got==obj and kind=='blob' and batch[at-1:at]==b'\n' and size==x['length'] and sha(raw)==x['sha256'] and hashlib.sha1(('blob '+str(size)+'\0').encode()+raw).hexdigest()==obj and raw==(R/x['path']).read_bytes()
assert at==len(batch)
v=json.loads((pub/'closed-result.json').read_bytes());assert v['wholeStartupOnlyProofPassed'] and v['releaseQualified'] is False and v['allMemorySamplesValidated']==627 and v['allOriginalKernelReadsValidated']==5016
D.mkdir();captures=[];original=prep.command
def capture(*args):
 if args[:2]!=('gh','api'):return original(*args)
 i=len(captures);prefix='api-original-'+str(i).zfill(2)
 (D/(prefix+'-command.json')).write_bytes(canonical({'argv':args,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 (D/(prefix+'.json')).write_bytes(r.stdout);(D/(prefix+'-stderr.log')).write_bytes(r.stderr)
 (D/(prefix+'-exit.json')).write_bytes(canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 captures.append({'file':prefix+'.json','argv':args,'length':len(r.stdout),'sha256':sha(r.stdout)})
 assert r.returncode==0,'Unknown/failed read or POST: retain originals and inspect via NEW read-only successor; NEVER replay'
 return r.stdout
prep.command=capture
review=json.loads((S/'proof233000-closed-memory-events-complete-originals-once/remote-originals/source-review-original.json').read_bytes());sourceindex=json.loads((S/'proof233000-closed-memory-events-complete-originals-once/remote-originals/tooling-source-index.json').read_bytes())
authority=prep.current_evidence(review,sourceindex);assert not any(MARKER in x['body'] for x in authority['sourceComments'])
issue191=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/191'));assert issue191['state']=='closed'
(D/'fresh-current-authority-evidence.json').write_bytes(canonical(authority)+b'\n')
link='https://github.com/yigini/soilfer-lims/blob/'+BASE+'/WP/batch-proof-memory-events-be837974-20261015/'
body=f'''@claude Actual233000 result: **TWO JOBS-OFF STARTUPS PASS — independently validated; NOT RELEASE QUALIFIED**. [{MARKER}]

Acknowledging actual SourcePASS6203833517 only in this actual-result handoff. ONE exactdd14f90814b7994bf06598623dae095b29d04f0b invocation3eb684645431481ea98912210f972d99, root /opt/lims/releases/workflow-batch-startup-memory-be837974-20261015T233000Z, producer closed **2026-10-15T23:15:10.989124+00:00**. Original0400 proof-receipt SHA256 **f9478dd0082a708167ef4569d4496cd50b29995b0e1f610b43517d38701def93**. Complete closed evidence published **{BASE}** with **8329 raw Git-OID/SHA256/length-verified files**; independent closed-result SHA256 **d67473493481afa4203434fa2aa11dc13a8ffd80a69258da658dc5c1dfb43d84**. No retry, cleanup, production mutation, SQLite connection or new production snapshot. This root/unit/package/PASS/operators are consumed; no replay.

| Actual startup | First | Second |
|---|---:|---:|
| Docker healthy observed, seconds |332.77019714499966|392.4748328019996|
| Observed unhealthy poll intervals, seconds |240.81847412200023|300.406301772|
| Full original health polls |287|338|
| Host memory samples including final before-stop |288|339|
| Original kernel reads |2304|2712|
| Max sampled nonreclaimable bytes |118587600|110393056|
| Max READY RSS bytes |170049536|168742912|
| Charged memory evidence allowance bytes |18079744|21278720|

Both ordinary default-entrypoint startups independently verified **all27 NO_OP exact integer0 + all26 current READY exact integer0**, jobsOFF/networknone/blankNODE_OPTIONS/falsepushseed, HTTPhealthGET200/loginGET200/unauthorizedreceiptsPOST401. Original log captures, exit/stdout/stderr and exact event inventory agree with each recorded result. HTTP probes and final host memory check completed under the unchanged600-second source guard. Result elapsed503.8417654320001s and594.2663149059999s include stopped-seal work after readiness; they are not HTTP downtime. Unhealthy times are monotonic intervals between observed polls, not exact unobserved transition times.

ALL625FULL0400health polls and ALL627memory samples/ALL5016original0400kernel reads independently validated from retained rawbytes, not just producer summaries or latest samples. Full exact CID/live hostPID/StartedAt/owner/memory=memory+swap805306368/cgroupdevice+inode/exactfull-IDLEAF stayed stable per startup; repeated membership within each sample agrees. Original proc membership/mountinfo/stat/events/peak/max/swapmax SHA+length/read bounds match every parsed record. **oom=oom_kill=0 EVERYsample**, DockerOOMKilledfalse/restarts0. Exact sampled sum anon+shmem+slab_unreclaimable+kernel_stack+pagetables+percpu+sock stayed <=603979776B. This is sampled nonreclaimable memory, not a continuous peak claim. App memory.peak805306368/max/high/reclaim counters remain observations. Controller last-active peak805310464 is separate and observation-only; no OOM or charge-cause diagnosis. No limit/heap/600 relaxation. Evidence is inside existing4GiBlogreserve and below268435456/start; actual memory-file allocations17694720B/20828160B fit their charged allowances.

Both full stopped logical states exactly equal the bound installed209 **112tables/42receipts**, including all recorded objects/rows/receipts/integrityok/FK0. Both copied asset trees contain the exact489 source files by SHA+length, 5787648allocatedB each; schema89556B and empty seed markers match. ALL457rawGit application copy-source bindings/manifest and conservative8policy snapshots/startup derivation reverified. Full declared copy claims, remaining budget and physical stage caps recomputed. Two new containers retained STOPPED/ExitCode137 after controller stop/OOMKilledfalse/restarts0. All77historical safe full container identities/unordered Mounts/running/starttimes preserved; historical stopped stay stopped. NORMAL8109/959d/7a healthy/sameflags+volumes. Bound080000raw/reader/backup+070000assets fullhash/stat unchanged, no old-input SQL. Original0400cd3a build receipt and ENTIREacc158 image inspect unchanged.

ALL9190rootfiles stablehash/stat inventoried; ALL8166small nonDB/nonasset originals retained, including every memory raw/health poll/summary/schema/marker/command stdoutstderr. Allocated-file sum10212409344B is distinct from whole-store accounting. ALLDB/WAL/SHM/assets remain on host with hashes; no DBfetch/newdu/SQL or proof-operator replay by retainers. Full same-invocation --all journal has exactPID1 INVOCATION_ID/start/started/successful deactivation. Transient unit GC yields not-found/infinity/default/sentinelpeak at closure; those are not executed limits or measured peak. Active805306368/Swap0/90min observations and approved launcher bind actual limits. First read-only retainer refused because it required service _SYSTEMD_INVOCATION_ID instead of actualPID1 INVOCATION_ID; failed source/stderr/derived explanation retained. A separately named corrected read-only capture completed. No proof failure/retry or original-evidence rewrite.

All original before/stage1/stage2/terminal physical accounting retained and independently recomputed: terminal **free95937847296B EACH3SAMEFS64769, not additive**, requirement24851118190B =floor10556150894+4GiBlogs+ADDITIONAL10GB+remaining0. Whole-store known growth10205564928B/free drop10206208000B/unexplained643072B<500MB. Fresh closed-retainer free95936245760B is a separate later observation, not new fit authority. Original R4: beforeROOT req41779083374/free106152439808, exactfuturepackage10219520 charged only there; beforeUNIT req41768863854/free106144251904; runtime22:52:06.299746 req41768863854/free106143961088. Package already occupied at latter phases; runtime card is the retained original, not new measurement. All3canonical4096/SAMEFS/nonadditive/10GB binding holds.

ALL690 source-publication rawGitOID/SHA/length bindings +15reviewed sources+1333frozen app inputs unchanged. Fresh actual mainbe/mainCI38772398721attempt1pushSUCCESS/4appaudits6rules2postrebootpins/memorydirection6203416404/R2accepted/no laterfailure/#191CLOSED verified again before this handoff. R2 is complete/no additional prune; YY320GiB space already visible/no hostgrowrestart by us. Old230000 failure remains immutable FAILED; no retroPASS/adoption/retry.

[Full publication index]({link}proof233000-closed-memory-events-publication-once/publication-index.json), [independent result]({link}proof233000-closed-memory-events-publication-once/closed-result.json), [original proof receipt]({link}proof233000-closed-memory-events-complete-originals-once/remote-originals/proof-receipt.json), [complete retention]({link}proof233000-closed-memory-events-complete-originals-once/closed-retention-record.json), [asset/copy-source checks]({link}proof233000-closed-memory-events-complete-originals-once/independent-assets-copy-sources-validation.json), [full journal]({link}proof233000-closed-memory-events-publication-once/journal-all-original.jsonl).

Please review this actual closed startup-only result. Next required scope is jobsON natural scheduler/intake qualification and broad postflights in a NEW complete source graph, with the same memory.events policy across any CLI/jobsON path before exact-source review. This result authorizes no jobsON operation, kit, gate or deployment. We will retain the whole prior installation/scientific/refusal/history chain, prepare concrete new source/meaningful guards and obtain its exact all-hash SourcePASS/fresh capacity+unusedroot gates before any next operation. Main merges remain held until actualbe deployment + your actualpostdeployPASS; same heartbeat2min. Exactkit audit and fresh single-use gate remain required. No duplicate ACK/native/result.
'''
(D/'actual-handoff-body-utf8.txt').write_bytes(body.encode('utf-8'))
request=D/'post-request.json';request.write_bytes(json.dumps({'body':body},ensure_ascii=False).encode('utf-8'))
(D/'post-intent.json').write_bytes(canonical({'marker':MARKER,'sourcePublication':BASE,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'onePostOnly':True,'neverRetry':True}))
raw=capture('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(request));posted=json.loads(raw)
(D/'actual-post-response.json').write_bytes(raw);assert posted['body']==body
readback=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])));assert readback['body']==body and readback['id']==posted['id']
(D/'actual-fresh-readback.json').write_bytes(canonical(readback)+b'\n')
(D/'api-command-index.json').write_bytes(canonical(captures)+b'\n')
result={'status':'ACTUAL_CLOSED_STARTUP_ONLY_PASS_RESULT_HANDED_OFF_ONCE','id':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bodySha256':sha(body.encode()),'sourcePublication':BASE,'sourcePassAcknowledgedOnlyHere':6203833517,'marker':MARKER,'freshReadbackBodyExact':True,'newServerOperations':0,'newProofs':0,'currentRetryAllowed':False,'actualClosedResultReviewRequested':True,'nextJobsOnQualificationRequiresNewReviewedGraph':True}
(D/'delivery-record.json').write_bytes(canonical(result)+b'\n');print(json.dumps(result,ensure_ascii=True))
