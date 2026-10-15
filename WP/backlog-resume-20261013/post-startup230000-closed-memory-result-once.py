"""Send ONE complete actual failed proof result to Claudio, never retry a POST."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-startup-be837974-20261015';D=S/'proof230000-closed-memory-handoff-once'
BASE='9efebefccc05095d84bcfad234fce46a53cbeaf2';BRANCH='audit/release-eb6de2e8';MARKER='startup230000-closed-memory-805314560-8192'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,approval
import prepare_proof as prep
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and not D.exists()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
pub=S/'proof230000-closed-memory-publication-once';idx=json.loads((pub/'publication-index.json').read_bytes());items=idx['files']
oids=[x['gitBlobOid'] for x in items];batch=git('cat-file','--batch',payload=('\n'.join(oids)+'\n').encode());at=0
for x,obj in zip(items,oids):
 end=batch.index(b'\n',at);got,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
 assert got==obj and kind=='blob' and batch[at-1:at]==b'\n' and size==x['length'] and sha(raw)==x['sha256'] and hashlib.sha1(('blob '+str(size)+'\0').encode()+raw).hexdigest()==obj and raw==(R/x['path']).read_bytes()
assert at==len(batch)
v=json.loads((pub/'closed-result.json').read_bytes());assert v['exactLimitExcessBytes']==8192 and not v['wholeProofPassed']
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
review=json.loads((S/'proof230000-closed-memory-originals-once/remote-originals/source-review-original.json').read_bytes());sourceindex=json.loads((S/'proof230000-closed-memory-originals-once/remote-originals/tooling-source-index.json').read_bytes())
authority=prep.current_evidence(review,sourceindex);assert not any(MARKER in x['body'] for x in authority['sourceComments'])
issue191=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/191'));assert issue191['state']=='closed'
(D/'fresh-current-authority-evidence.json').write_bytes(canonical(authority)+b'\n')
link='https://github.com/yigini/soilfer-lims/blob/'+BASE+'/WP/batch-proof-startup-be837974-20261015/'
body=f'''@claude Actual230000 proof result: **CLOSED FAILED — Startup memory STOP**. [{MARKER}]

Acknowledging actual SourcePASS6203010192 only in this result handoff. ONE approved exact29fa000751f25447f1ff8c129b0dfcc5d2b67445 invocationb962da09082d4fb49c8b9076181b7f4c, ROOT /opt/lims/releases/workflow-batch-startup-be837974-20261015T230000Z, closed2026-10-15T22:03:39.298754+00:00. Resultexit-code/ExecMainStatus1/MainPID0; the proof, root/unit/package/operators/PASS are consumed. No retry, cleanup or source/limit change occurred.

The original app cgroup memory.peak stdout is **805314560B**, exactly **8192B above the reviewed805306368B limit**. This trips the unchanged exact peak<=MEMORY guard. Original peak command exit0/empty stderr. ControllerMemoryPeak805306368 is separately recorded and is not the app peak. Owned startup containerb143bdbe33a5fbf136a4fe6726a2cd131fa59caa4a7f7200d87830762d73f24d was stopped by the controller and retained: ExitCode137, OOMKilledfalse, restarts0, ownedStopErrornull. No OOM diagnosis or kernel-accounting explanation inferred. JobsOFF/networknone/blankNODE_OPTIONS/falsepushseed/Memory=MemorySwap=805306368 preserved.

Before that failure the first ordinary default startup produced all27entrypoint NO_OP integer0 verifiers and all26exact READY integer0 events. All372original0400health polls are retained with FULLStateHealth.Log/config/FailingStreak/UTC/monotonic elapsed. Status transitioned starting -> unhealthy -> healthy; healthy observed392.9904243249998s, within600. HTTPhealth200/login200/unauthorizedreceiptsPOST401 all passed. Observed unhealthy intervals total300.9889456830001s, not an assertion of exact unobserved transition times. The memory guard still FAILED. Second startup never attempted/0polls. No startup1-result, stopped full logical seal, startup stage closure, whole-proof receipt or final whole-store accounting was reached. NOOP/READY logs do not establish stopped11242 equality or whole-proof PASS.

Full closed retention and independent validation published **{BASE}**: all1867rootfiles stable SHA/length/stat inventoried (3399839744B allocated-file sum); all42package0400inputs unchanged; ALL1362small nonDB/nonasset originals, all905controller memory telemetry records, FULLsame-invocation --all journal/systemctl retained. Schema89556B and empty seed marker separately retained against that same inventory. ALLDB/WAL/SHM/assets remain on host; retainer fetched no DB and opened no SQLite, ran no newdu, and made no host mutation. Bound080000installed11242raw/reader/backup and070000assets reverified unchanged by fullhash/stat-only checks. Original0400qualifiedcd3abuild receipt and ENTIREfreshacc158image inspect unchanged. All76historical safe full identities/unorderedmounts/running/starttimes preserved, allhistoricalstopped stillstopped, ONEnewowned stoppedretained. NORMAL8109/959d/7ahealthy/0restart/noOOM/sameflagsvolumes.

All3original fresh R4 gates passed including ADDITIONAL10GB: beforeROOT req41779001454/free109576622080 (futurepackage10137600); beforeUNIT req41768863854/free109568503808 (packagealreadyoccupied); runtime21:56:06.227379 req41768863854/free109568176128. All3paths4096/device64769/SAMEFS/nonadditive. Runtime card is original, not a new measurement. Closedfree106175389696B EACH3sameFS is only an observation, not future fit. Largest file-stat groups: TMPDIR2816798720B/database563417088B/assets5787648B; no final whole-store accounting claim.

Independent rawGitOID/SHA/length checks: all629source-indexed originals+index630, all14reviewed sources+1333frozen app inputs unchanged. Fresh actual mainbe/mainCI38772398721attempt1pushSUCCESS/4audits6rules2postrebootpins/R2accepted/#191CLOSED/no later failure verified before this handoff. R2 remains COMPLETE; no more prune. YY resize space was already visible and no grow/restart was performed by us.

[Complete publication index]({link}proof230000-closed-memory-publication-once/publication-index.json), [independent closed result]({link}proof230000-closed-memory-publication-once/closed-result.json), [original app peak]({link}proof230000-closed-memory-originals-once/remote-originals/startup-1-peak.stdout), [FULLoriginal terminal refusal]({link}proof230000-closed-memory-originals-once/remote-originals/proof-terminal-refusal.json), [FULLclosed retention]({link}proof230000-closed-memory-originals-once/closed-retention-record.json), [FULLjournal]({link}proof230000-closed-memory-publication-once/journal-all-original.jsonl).

Please review this actual closed failure and give the scope for a separately audited forward remedy. The exact805306368 cap/blankheap/600 deadline, retained evidence and scientific/refusal/history guards remain; the8192B excess has not been rounded away or reclassified as PASS. No current-source retry or new proof is authorized by this handoff. No jobsON/kit/gate/deploy now; startup-only scope remains NOT_RELEASE_QUALIFIED. Main merges remain held until actualbe deployment + your actual postdeployPASS; same existing heartbeat stays2min. No duplicate ACK/native/request.
'''
(D/'actual-handoff-body-utf8.txt').write_bytes(body.encode('utf-8'))
request=D/'post-request.json';request.write_bytes(json.dumps({'body':body},ensure_ascii=False).encode('utf-8'))
(D/'post-intent.json').write_bytes(canonical({'marker':MARKER,'sourcePublication':BASE,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'onePostOnly':True,'neverRetry':True}))
raw=capture('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(request));posted=json.loads(raw)
(D/'actual-post-response.json').write_bytes(raw);assert posted['body']==body
readback=json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])));assert readback['body']==body and readback['id']==posted['id']
(D/'actual-fresh-readback.json').write_bytes(canonical(readback)+b'\n')
(D/'api-command-index.json').write_bytes(canonical(captures)+b'\n')
result={'status':'ACTUAL_CLOSED_FAILURE_RESULT_HANDED_OFF_ONCE','id':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bodySha256':sha(body.encode()),'sourcePublication':BASE,'sourcePassAcknowledgedOnlyHere':6203010192,'marker':MARKER,'freshReadbackBodyExact':True,'newServerOperations':0,'newProofs':0,'currentRetryAllowed':False,'separatelyReviewedForwardRemedyScopeRequested':True}
(D/'delivery-record.json').write_bytes(canonical(result)+b'\n');print(json.dumps(result,ensure_ascii=True))
