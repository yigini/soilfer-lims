"""ONE concrete exact-source review, actual direction ACK bundled only here; no host operator."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'exact-source-review270-once';BRANCH='audit/release-eb6de2e8';REL='WP/batch-proof-memory-events-be837974-20261015/'
sys.path.insert(0,str(S));from proof_contract import *
import prepare_proof as prep
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
head=git('rev-parse','HEAD').decode().strip()
assert git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and not D.exists() and git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head
rawindex=git('show',head+':'+REL+'source-publication-index270.json');published=exact_json(rawindex);assert published['localTests']==published['actualHostTests']==270 and published['operatorsExecuted']==0
index={'head':head,'files':{n:{'bytes':v['length'],'sha256':v['sha256'],'blob':v['gitBlobOid']} for n,v in published['sourceFiles'].items()}};graph(index)
assert len(FILES)==15
for n,p in index['files'].items():
 raw=git('show',head+':'+REL+n);assert raw==(S/n).read_bytes() and len(raw)==p['bytes'] and sha(raw)==p['sha256'] and oid(raw)==p['blob']
closed=exact_json((S/'source-local-host270-complete-once/exit-original.json').read_bytes());assert closed['status']=='PASS' and closed['sourceSha256After']==graph(index)
items=published['files'];batch=git('cat-file','--batch',payload=('\n'.join(x['gitBlobOid'] for x in items)+'\n').encode());at=0
for item in items:
 end=batch.index(b'\n',at);obj,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
 assert kind=='blob' and obj==item['gitBlobOid']==oid(raw) and batch[at-1:at]==b'\n' and size==item['length'] and sha(raw)==item['sha256'] and raw==(R/item['path']).read_bytes()
assert at==len(batch)
D.mkdir();captures=[];original=prep.command
def capture(*args):
 if args[:2]!=('gh','api'):return original(*args)
 prefix='api-original-'+str(len(captures)).zfill(2)
 (D/(prefix+'-command.json')).write_bytes(canonical({'argv':args,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 r=subprocess.run(args,cwd=R,capture_output=True,timeout=90)
 (D/(prefix+'.json')).write_bytes(r.stdout);(D/(prefix+'-stderr.log')).write_bytes(r.stderr);(D/(prefix+'-exit.json')).write_bytes(canonical({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 captures.append({'file':prefix+'.json','argv':args,'length':len(r.stdout),'sha256':sha(r.stdout),'gitBlobOid':oid(r.stdout)})
 assert r.returncode==0,'Uncertain/failed request: retain raw evidence, inspect actual history with NEW successor; NEVER replay'
 return r.stdout
prep.command=capture;evidence=prep.current_evidence();assert prep.gh('repos/yigini/soilfer-lims/issues/191')['state']=='closed'
marker='startup-host-memory-'+head[:8]+'-270-acc158-cd3a';assert not any(marker in c['body'] for c in evidence['sourceComments'])
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
bindings=tokens(index);readme=git('show',head+':'+REL+'README.md').decode();link='https://github.com/yigini/soilfer-lims/blob/'+head+'/'+REL
body='@claude Please review the COMPLETE NEW15-file host-memory-events proof graph at **'+head+'**. Marker: '+marker+'.\n\n'
body+='ACK your actual unedited6203416404/2026-10-15T22:16:57Z direction ONLY in this meaningful exact-source handoff. Implemented the specified replacement memory guard; no memory limit/heap/deadline increase. Prior230000 remains FAILED/consumed, firststartup evidence observation-only; result6203392900/full9efebefc/46c2fd0f already handed off, no duplicate ACK/result/native message.\n\n'
body+='**Please return a NEW unedited Claude-app Source review: PASS explicitly including ALL15SHA256 and EVERY literal binding below, or concrete findings.** Scope direction alone is not SourcePASS. New prepare/launch/run remain UNEXECUTED outside import/compile/closedfakeguards. No operational package/upload/root/unit/startup. New233000ONEattempt/no retry; exact-package fresh R4 beforeROOT/UNIT/runtime +freshallcurrentauthorities/unusedrootunit still mandatory after exactPASS.\n\n'
body+='[Source/README]('+link+'README.md), [complete original rawGitOID/SHA256/length index]('+link+'source-publication-index270.json). Final270local+270ACTUALhostPython3.9.23 PASS, all15hashunchanged, no real process/Docker/cache/productionSQLite/operator calls in final isolated suites. All initial260failure/262/268PASS snapshots/logs preserved; no old assertion weakened. New39memory guards plus2final source-audit guards (exact cgroup leaf, summary self-field included in bounded allocation).\n\n'
body+='Publication also retains [the three completion records]('+link+'source270-publication-completion-index.json): original publisher stopped on a LOCAL staging assertion because unchanged files were indexed but not staged by Git. A NEW completion helper independently verified exact owned changed paths, then all690rawOID/SHA/length files in staged and committed trees. No source/test/host/proof operation was replayed or changed.\n\n'
body+='Memory policy: exacthostcontainerID/PID/cgroupidentity, full0400raw memory.stat everyhealthpoll+finalbeforeSTOP; hardoom=oom_kill=0/DockerOOMfalse/restarts0, sampled anon+shmem+slab_unreclaimable+kernel_stack+pagetables+percpu+sock<=603979776. Peak/max/high/pgscan/pgsteal observation-only; maxREADYrss recorded. Original max805306368=memory+swap/hostswap0/blankNODE_OPTIONS/jobsOFF/networknone remain. Missing/unreadable/malformed/identityrace refuses. 601samplesmax/startup/rawfieldbounds/256MiBevidence+summary/startup withinexisting4GiBlogs; N24->30DB copies/25percent/schema/assets/floor/ADDITIONAL10GB/600/fullstoppedstate/science all unchanged.\n\n'
body+=readme+'\n\nALL exact review bindings:\n'+chr(96)*3+'\n'+'\n'.join(bindings)+'\n'+chr(96)*3+'\n'
assert len(body)<65536 and all(t in body for t in bindings)
(D/'actual-review-body-utf8.txt').write_bytes(body.encode());(D/'tooling-source-index.json').write_bytes(canonical(index)+b'\n');(D/'source-publication-index270-original.json').write_bytes(rawindex);(D/'fresh-current-authority-evidence.json').write_bytes(canonical(evidence)+b'\n')
request=D/'post-request.json';request.write_bytes(canonical({'body':body}));(D/'post-intent.json').write_bytes(canonical({'marker':marker,'head':head,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'neverRetry':True}))
raw=capture('gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(request));posted=exact_json(raw);(D/'actual-post-response.json').write_bytes(raw)
assert posted['body']==body
readback=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']));actual=exact_json(readback);assert actual['id']==posted['id'] and actual['body']==body and actual['created_at']==actual['updated_at']
(D/'actual-readback-original.json').write_bytes(readback);(D/'api-command-index.json').write_bytes(canonical(captures)+b'\n')
record={'status':'ONE_EXACT_NEW_MEMORY_SOURCE_REVIEW_REQUEST_POSTED','sourceHead':head,'sourceFiles':15,'localAndActualHostTests':270,'literalBindings':len(bindings),'commentId':posted['id'],'createdUtc':posted['created_at'],'url':posted['html_url'],'bodySha256':sha(body.encode()),'freshReadbackBodyExact':True,'directionAcknowledgedOnlyHere':6203416404,'sourcePassObserved':False,'operatorsExecuted':0,'rootOrUnitCreated':False,'marker':marker,'nativeFallbackAfterAbout20MinutesOnly':True}
(D/'delivery-record.json').write_bytes(canonical(record)+b'\n')
lead=f'''LATEST ACTUAL NEW MEMORY SOURCE REVIEW REQUEST - {posted['created_at']}. COMPLETE NEW15-file exact{head}/270LOCAL+270ACTUALhost guards/all15hashes+1333appunchanged/41newmemoryguards includingexactcgroup-leaf+summary-ownfieldbudget. ONE@claude#162 SourceReview{posted['id']} POSTED {posted['html_url']} fullALL15SHA+ALL{len(bindings)}literalbindings; actualrequestJSON==actualresponse==freshuneditedreadback body. Bundles6203416404directionACKONLYhere/no duplicate6203010192ACK/result/native. Source/index at WP/batch-proof-memory-events-be837974-20261015/source-publication-index270.json; actualrequest/currentauthorities/fullwirebytes at exact-source-review270-once/. ActualNEWexactSourcePASS PENDING; direction/270tests/referencefit NOT approval. NEW233000rootunit UNCREATED/UNUSED/no operationalpackage/upload/startup. Preparers/launcher/run UNEXECUTED outsideimportcompileclosedfakeguards. OnactualNEWall15hash+allliteral SourcePASS: independentlyretain/validatefullraw/source/allcurrentmainCI4audits6rules2postreboot+memorydirection/R2accepted/nolaterfailure; freshunusedrootunit/exactpackageR4 beforeROOT-unit-runtime required beforeONEnewproof. No oldhelper/230000/PASSreplay. Prior230000wholeFAILED/8192over remainshonest/consumed; FIRSTstartupobservation neverreusedPASS. No jobsON/kit/gate/deploy/mainmerge/R2prune. FreshR4reference22:27:13 required41768863854 INCLUDING10GB EXCLUDINGfutureexactpackage/free106160959488EACHsameFS/notadditive; referenceNOTlaunchAuthority. NativefallbackONLYanswer missingabout20min after{posted['created_at']}, freshactualtargetEMPTYcomposer/preservehumans/no duplicateGH/native/ACK. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS/allscience/R1-R5/600/805blankheap/forwardonly/no103/historyheld.\n\n'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.rglob('*') if p.is_file())+[pathlib.Path(__file__),*readmes];out=D/'publication-index.json'
out.write_bytes(canonical({'baseAudit':head,'actualRequest':record,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(out);names=[p.relative_to(R).as_posix() for p in paths]
assert not git('diff','--cached','--name-only').strip();git('-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul',payload=b'\0'.join(n.encode() for n in names)+b'\0');assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
def verify(ref):
 batch=git('cat-file','--batch',payload=('\n'.join(ref+':'+n for n in names)+'\n').encode());at=0
 for p in paths:
  end=batch.index(b'\n',at);obj,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size;assert kind=='blob' and batch[at-1:at]==b'\n' and raw==p.read_bytes() and oid(raw)==obj
 assert at==len(batch)
verify(git('write-tree').decode().strip());git('commit','-m','Request exact new host-memory-events source review with270 guards');deliveryhead=git('rev-parse','HEAD').decode().strip();verify(deliveryhead);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==deliveryhead and not git('diff','--cached','--name-only').strip()
print(json.dumps({**record,'deliveryPublication':deliveryhead,'rawOidShaLengthVerifiedFiles':len(paths)},ensure_ascii=True))
