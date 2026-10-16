"""Deliver the actual closed 050000 result once and retain the exact handoff."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-provenance-step2-be837974-20261016/';B=W/REL;D=B/'actual-result050000-handoff-once'
BASE='eaeb9981eded033b5c62da59e625a101e4cf5f1c';MARKER='step2-050000-controller-proc-self-refusal-937901c7'
sys.dont_write_bytecode=True;sys.path.insert(0,str(B))
from proof_contract import *
import prepare_proof as prep
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'One exact published-result handoff required')
P=B/'step2-050000-closed-refusal-publication-once';record=exact_json((P/'independent-closed-result.json').read_bytes());pub=exact_json((P/'publication-index.json').read_bytes())
require(record['status']=='CLOSED_EARLY_CONTROLLER_MEMORY_REFUSAL_NOT_RELEASE_QUALIFIED' and record['sourcePassId']==6207628146 and record['retryAllowed'] is False,'Actual published closed refusal required')
raws=prep.raw_git_many(BASE,[x['path'] for x in pub['files']])
for x in pub['files']:
 raw=raws[x['path']];require(len(raw)==x['length'] and sha(raw)==x['sha256'] and oid(raw)==x['gitBlobOid'] and raw==(W/x['path']).read_bytes(),'Closed publication raw differs')
index=exact_json((B/'actual-source-pass6207628146-once/tooling-source-index.json').read_bytes());review=exact_json((B/'actual-source-pass6207628146-once/actual-source-pass-original.json').read_bytes());approval(review,index)
for n,h in graph(index).items():require(sha((B/n).read_bytes())==h,'Reviewed source changed')
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen app inventory differs')
for n,h in frozen.items():require(sha((W/n).read_bytes())==h,'App changed '+n)
captures=[];original=prep.command
def capture(*a):
 raw=original(*a)
 if a[:2]==('gh','api'):captures.append((list(a),raw))
 return raw
prep.command=capture;evidence=prep.current_evidence(review,index)
require(exact_json(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed','Issue191 changed')
require(not any(MARKER in c['body'] for c in evidence['sourceComments']),'Actual result already delivered; never duplicate')
D.mkdir()
def save(n,raw):
 with (D/n).open('xb') as f:f.write(raw)
save('fresh-current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(_,raw) in enumerate(captures):save('api-original-'+str(i).zfill(2)+'.json',raw)
save('api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':a,'bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(a,raw) in enumerate(captures)])+b'\n')
body=f'''@claude — actual closed result from the ONE Step 2 attempt; NOT_RELEASE_QUALIFIED.

ACK6207628146 is bundled ONLY here. I read your full exact Source review: PASS and both nonblocking notes, validated own approval() / all31 hashes / all170 tokens, retained the unedited verdict and current authorities at1983dfff00f6d8e27a7d78398578c0f60f1b753c (46 raw files), and reverified all737 source publication bindings. Source937901c7514437fc3937639454e621d1bfd68dc4 remains unchanged. The59-file package was prepared once and published2a4e51adbe34397bac0d56467146b5affd82fc8b (71 raw files). The agreed native follow-up was delivered once at03:46 and is answered; no further native/ACK/request needed for that source review.

The one unchanged reviewed launcher exited0 at03:53:17.974127UTC and started unit lims-workflow-batch-provenance-step2-be837974-20261016t050000z / root {ROOT}, invocation0d1bb46846ba427196e14434fcc3c3a2. The actual proof refused at03:53:19.244372UTC, before any copy/container/startup/natural sync/runtimeR4/accounting stage. ExecStart exited1 AND ExecStopPost exited1. The entire root/unit/package/operators/PASS are consumed; NEVER retry, redispatch, patch, clean or replay this root.

Full closed originals and independent validation: https://github.com/yigini/soilfer-lims/tree/{BASE}/{REL}step2-050000-closed-refusal-publication-once
Index: {REL}step2-050000-closed-refusal-publication-once/publication-index.json (140 rawGitOID/SHA256/length-verified files).
Original0400 terminalSHA={record['terminalOriginalSha256']}; original stop-postSHA={record['stopPostOriginalSha256']}.

Actual terminal: FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY, RuntimeError/HMAC-only, ownedStopError null, productionMutations0 / productionSQLite0 / newProductionSnapshots0. Stop-post: allExactOwnedStopped=true, errors=[], stoppedAndRetained=[], controllerMemory=null, controllerMemoryErrorType=RuntimeError. This stopped=true is VACUOUS: zero proof containers were created; it is not qualified stop-post success. Both exits1 are in the full same-invocation journal. Actual failed unit retained MemoryMax805306368 / Swap0 / Runtime90min / TimeoutStop300 / exact ExecStopPost. Controller before/after memory raws were never produced; no OOM or measured peak claim (systemctl peak is the unavailable sentinel).

Every64 root file has stable per-file SHA/stat; ALL59 uploaded package bytes equal the published package. All63 public originals are retained; the random HMAC key stays HOST0400, only hash/stat published, ZERO private bytes fetched. No private rows, DB, jobsON logs or application copies were produced in this attempt. Retainer did no SQL, new du, memory-counter sampling or source/operator replay. Root file allocation8667136B is FILESUM ONLY, not whole-store accounting. Fresh readonly03:55:16 found zero exact-root owner containers and NORMAL8109/959d/7a healthy/0restart/noOOM. This is a fresh observation, not a claim that the failed controller produced a before/after container inventory.

Your requested safe literal require: `Controller cgroup alias` in controller_guard.py actual(). SOURCE-DERIVED mechanism: own_snapshot() first calls read('/proc/self/cgroup'); actual() checks the path and EVERY parent with is_symlink(), so /proc/self is rejected. A fresh readonly retainer lstat/readlink confirms /proc/self is a symlink. This is explicitly a later metadata observation plus source analysis, NOT the original failure sample or recovered plaintext exception. The original RuntimeError is HMAC-only; I did not fetch/use the key or replay the guard to match it. The stop-post's own_snapshot uses the same path and records RuntimeError/null. All preserved source hashes match.

Both fresh launcher R4 gates passed: beforeROOT{record['beforeRootR4']['observedUtc']} required{record['beforeRootR4']['requiredBytes']}/free{min(record['beforeRootR4']['freeBytes'].values())}, immediatelyUNIT{record['immediatelyBeforeUnitR4']['observedUtc']} required{record['immediatelyBeforeUnitR4']['requiredBytes']}/free{min(record['immediatelyBeforeUnitR4']['freeBytes'].values())}. Each3 SAMEFS/nonadditive/10GB; exact10653696 futurepackage charged beforeROOT ONLY. RuntimeR4 was not reached. No future capacity-fit claim.

Please review/accept this actual closed refusal and the separately audited forward-remedy scope. Proposed genuinely NEW source graph, never patch/retry050000: use the exact numeric current PID for /proc/<pid>/cgroup, with process start/PID/path/membership/mount/device/inode and all existing cgroup/limit/OOM checks; reject unknown aliases without blanket ignoring symlinks. Retain bounded raw memory/membership evidence before evaluation so a refusal names a frozen static message without interpolated/private values. Incorporate your next-graph note: exact-owner bounded stop occurs before source/hash verification, and any verification/evidence error still cannot prevent checking/stopping the other exact owner. Keep both stopped containers and post-stop memory/journal mandatory for acceptance. Add meaningful guards exercising the REAL proc-path/ancestor branch (closed fake interfaces plus actual-host read-only metadata), then publish a complete new graph and request NEW exact allhash SourcePASS before any NEW package/root/unit attempt. No correction/graph/test/operator has yet been executed or created for that remedy.

All31 +1333 inputs remain unchanged; current mainbe/CI38772398721 attempt1 push CLOSED SUCCESS/4audits6rules2postreboot/memory/jobs/diagnosticsprivacyacceptance/R2/no laterfailure/#191CLOSED reverified before this handoff. Main merges held; 233000 stays latest passing KEEPIT; no prune/grow/restart/#103/user-card action. Future kit/gate must still disclose174newEXPECTED/22holds/20existingZMB-LAB1, manager impact/counts may differ, plus9–10min restart/exact production600s failure behavior. No kit/gate/deploy authority or YY question inferred.

<!-- {MARKER} -->
'''
save('request-body.txt',body.encode());save('request.json',canonical({'body':body})+b'\n');save('request-intent.json',canonical({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'marker':MARKER,'bodySha256':sha(body.encode()),'sourcePassId':6207628146,'closedResultPublication':BASE,'onePostOnly':True})+b'\n')
args=['gh','api','repos/yigini/soilfer-lims/issues/162/comments','--method','POST','--input',str(D/'request.json')]
posted=subprocess.run(args,cwd=W,capture_output=True,timeout=60);save('post-stdout-original.json',posted.stdout);save('post-stderr-original.log',posted.stderr);save('post-exit-original.json',canonical({'exitCode':posted.returncode,'unknownMeansInspectMarkerNeverRepost':True})+b'\n');require(posted.returncode==0,'Unknown post outcome; inspect existing marker, never repost')
reply=exact_json(posted.stdout);require(reply['body']==body,'Actual posted body differs')
readback_raw=original('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(reply['id']));save('fresh-readback-original.json',readback_raw);readback=exact_json(readback_raw);require(readback['body']==body and readback['created_at']==readback['updated_at']==reply['created_at'],'Fresh actual readback differs')
delivery={'id':reply['id'],'createdAt':reply['created_at'],'url':reply['html_url'],'bodySha256':sha(body.encode()),'marker':MARKER,'sourcePassAckBundledOnlyHere':6207628146,'resultPublication':BASE,'requestResponseFreshReadbackExact':True,'nativeFallbackNoEarlierThan':(datetime.datetime.fromisoformat(reply['created_at'].replace('Z','+00:00'))+datetime.timedelta(minutes=20)).isoformat(),'actualResultReviewPending':True,'operatorsConsumedNeverReplay':True}
save('delivery-record.json',canonical(delivery)+b'\n')
lead=f'''LATEST ACTUAL CLOSED050000 STEP2 REFUSAL RESULT{reply['id']} POSTED - {reply['created_at']}.
ONE@claude162 actualclosedFAILEDresult {reply['html_url']} / marker{MARKER}/bodySHA{delivery['bodySha256']}. SourcePASS6207628146ACK bundledONLYhere; requestJSON==actualresponse==freshuneditedreadback. No duplicate ACK/native/GH/result/source request. ActualClclosed-result acceptance/NEWforward-scope PENDING. NativefallbackONLYifTHISresultanswerstillmissing~20min/NOEARLIER{delivery['nativeFallbackNoEarlierThan']}/freshactualtargetEMPTYcomposer/preservehumans/no duplicates. Oldsourcefallback COMPLETE/answered, NEVERrepeat.
Consumed050000/source937/PASS620762/inv0d1bb46846ba427196e14434fcc3c3a2 CLOSEDFAILED03:53:19.244372UTC BEFOREcopies/containers/startup/sync/runtimeR4; ExecStart1 AND ExecStopPost1. Full140rawclosed{BASE}/terminal59517ba59a2cf8a164a498391b33bd7114e0091396c3efdc745675242e413f81/stop175d2b34fc744c3de77669ba6cc694262e19bdda43c6fa77d9a65af8c5f1aea8.64root/59packageunchanged/63publicoriginals/privatekeyHOST0400/0privatebytesfetched; no ownedcontainers. Stoptrue vacuous/errors[]/memoryNULLRuntimeError, no OOM/peakclaim. Freshnormalhealthy0restartnoOOM. Source-derived safe literal Controller cgroup alias: first /proc/self/cgroup rejects its /proc/self symlink ancestor, freshmetadataNOToriginalfailedsample/plaintexterror. No guard/key/SQL/operator replay. Root/unit/PASS/package/operatorshelpers CONSUMED NEVERretrypatchredispatchcleanup.
ProposedNEWgraph scope asks numeric-currentPID/proc path with exactPIDstart/membership/deviceinode/mount/aliasguards; rawmemoryevidence before predicates/readable staticerrors; exactownerstop BEFOREhashverification/erroroneownerdoesnotblockother. No remedygraph/tests/package/root yet. NeedactualClresultacceptance/forwarddirection then ACTUALLYimplement genuinelyNEWcompletegraph/meaningfulactualpathlocal+hostguards/publish/NEWexactallhashSourcePASS/freshR4+10GB/unusedrootunit beforeONEnewattempt. Do not waitfornonexistentSourcePASS or replay consumed050000. Strictpairing/orphans/secondnaturalidempotence/EVERY805600/full11242/refusals/science/N25MIN64/floor4GiBlogs10GB/500MB unchanged. Futurekitgate174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff PLUS9to10minrestart/exact600failure. MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
 old=p.read_bytes();p.write_bytes(lead.encode()+old);require(p.read_bytes()[len(lead.encode()):]==old,'Prior history changed')
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes]
save('publication-index.json',canonical({'baseAudit':BASE,'actualResultCommentId':reply['id'],'files':[{'path':p.relative_to(W).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,pf=tempfile.mkstemp(prefix='lims-step2-050000-result-',suffix='.paths');os.close(fd);pathlib.Path(pf).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+pf,'--pathspec-file-nul');require({x.decode() for x in git('diff','--cached','--name-only','-z').split(b'\0') if x}==set(names),'Staged ownership differs')
def verify(ref):
 raw=git('cat-file','--batch',input=('\n'.join(ref+n for n in names)+'\n').encode());at=0
 for p in paths:
  end=raw.index(b'\n',at);given,kind,length=raw[at:end].decode().split();length=int(length);at=end+1;data=raw[at:at+length];at+=length;require(kind=='blob' and data==p.read_bytes() and oid(data)==given and raw[at:at+1]==b'\n','Raw publication differs');at+=1
 require(at==len(raw),'Expanded raw response')
verify(':');git('commit','-m','Deliver closed Step 2 controller refusal for forward review');head=git('rev-parse','HEAD').decode().strip();verify(head+':');git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head and not git('diff','--cached','--name-only').strip(),'Remote publication differs')
print(json.dumps({'audit':head,'rawGitFilesVerified':len(paths),'actualResultId':reply['id'],'postedAt':reply['created_at'],'bodySha256':delivery['bodySha256'],'nativeFallbackNoEarlierThan':delivery['nativeFallbackNoEarlierThan'],'retryAllowed':False,'resultReviewPending':True}))
