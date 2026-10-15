"""Publish complete closed233000 startup-only proof originals and independent validation once."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';D=S/'proof233000-closed-memory-events-publication-once'
BASE='b35592229e7934b2758e5a95d586352559ca6eda';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,FILES
def cmd(*a,payload=None):return subprocess.check_output(a,cwd=R,input=payload)
def git(*a,payload=None):return cmd('git','-c','core.longpaths=true',*a,payload=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE and not D.exists()
rawdir=S/'proof233000-closed-memory-events-complete-originals-once';record=json.loads((rawdir/'closed-retention-record.json').read_bytes());v=json.loads((rawdir/'independent-closed-validation.json').read_bytes())
assert v['wholeStartupOnlyProofPassed'] and v['releaseQualified'] is False and v['all43PackageFilesUnchanged'] and v['allMemorySamplesValidated']==627 and v['allOriginalKernelReadsValidated']==5016
assert (S/'proof233000-closed-current-authority-once/verified-record.json').is_file()
extra=json.loads((rawdir/'independent-assets-copy-sources-validation.json').read_bytes());assert extra['applicationSourceRawGitOidShaLengthBindings']==457 and extra['mainIndependentValidationSha256']==sha((rawdir/'independent-closed-validation.json').read_bytes())
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
for n in FILES:assert (S/n).read_bytes()==(rawdir/'remote-originals'/n).read_bytes()
D.mkdir()
def save(n,raw):
 with (D/n).open('xb') as f:f.write(raw)
save('closed-result.json',canonical(v)+b'\n')
save('journal-all-original.jsonl',record['journalOriginal'].encode())
save('systemctl-original.txt',record['systemctlOriginal'].encode())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f'''LATEST ACTUAL CLOSED233000 STARTUP-ONLY PROOF PASS - independently validated {v['validatedUtc']}.

ONE exactdd14f90814b7994bf06598623dae095b29d04f0b/SourcePASS6203833517 invocation3eb684645431481ea98912210f972d99 CLOSED{v['terminalUtc']} producerPASS and independentPASS for TWOjobsOFFstartups FROMBOUND080000installed209 ONLY/NOT_RELEASE_QUALIFIED. Root /opt/lims/releases/workflow-batch-startup-memory-be837974-20261015T233000Z/unitlims-workflow-batch-startup-memory-be837974-20261015t233000z CONSUMED NEVERretryreplaycleanup. Original0400receiptSHA{v['receiptSha256']}. Firsthealthy332.77019714499966s/secondhealthy392.4748328019996s WITHIN600; each27entrypointNO_OP EXACTinteger0+26exactcurrentREADY EXACTinteger0/HTTPhealth200login200receipts401/jobsOFF. Actualresultelapsed503.8417654320001s and594.2663149059999s INCLUDEstoppedseal/notHTTPdowntime. Observedunhealthy240.81847412200023s/300.406301772s MONOTONICpollintervals/notexactunobservedtransitiontimes.

ALL625FULLoriginal0400healthpolls(287+338)/ALL627memorysamples(288+339)/ALL5016originalkernelreads0400+SHA+len independentlyverified. ExactownedID/livePID/start/owner/limits/cgroupdeviceinode/membership/exactIDLEAFstable perstartup; oom=oom_kill0 EVERYsample/DockerOOMfalse/restarts0. Samplednonreclaimable maxima118587600B+110393056B<=603979776B; maxREADYrss170049536B+168742912B. Evidenceallowance18079744B+21278720B within268435456B/start and EXISTING4GiBlogreserve. Finalbefore-stop sample each present/HTTP+finalcheck reviewed600guard; sampledONLY/notcontinuouspeak. memory.peak805306368/appmaxhighOBSERVATIONSONLY; controllerlastactivepeak805310464 separate/observationONLY/noOOMdiagnosis. BOTHfullstopped112tables42receiptslogicalstates EXACTboundprior/alloldrowsreceiptsobjects preserved; twoNEWownedcontainersSTOPPEDretained/all{v['historicalContainersPreserved']}historical fullsafeidentities/unorderedMounts/running/starttimes preserved/NORMALhealthy959d7a8109unchanged. Qualifiedoriginal0400cd3areceipt+ENTIREacc158imageunchanged; old080000rawreaderbackup+070000assets hash/stat-only preserved/no oldSQL/newproductionsnapshot/installerreplay.

ALL{v['rootFilesHashed']}rootfiles stablehash/stat inventoried/fileallocatedsum{v['rootFileAllocatedBytesNotWholeStoreAccounting']}B; ALL{v['allSmallNonDatabaseNonAssetOriginalsRetained']}smallnonDB/nonasset originals retained inclschemas/markers/commandstdoutstderr/fullsameinvocation--alljournal/systemctl. ALLDBWALSHM/assets remainHOST with hashes/noDBfetch/newdu/SQLbyretainer. Same-invocationPID1 lifecycle journal carries INVOCATION_ID exact3eb684645431481ea98912210f972d99/start/started/successfuldeactivation. Closed transientunitGC/not-found/infinityprops/sentinelpeak NOTexecutedlimits/measuredpeak; active805306368Swap0/90min separatelyretained. FirstLOCALretainer wronglyrequired _SYSTEMD_INVOCATION_ID andrefused afterreadonlyhashing; originalfailedhelperstderrretained/honestderivedrecord. NEWcompleteREADONLYsuccessor checksactualPID1 INVOCATION_ID orservice _SYSTEMD_INVOCATION_ID exact; no proof/operatorreplay.

Both489-file assetcopies/SHA+length/schema89556B+emptyseedmarker andALL457rawGitapplicationcopysourcebindings independentlyverified; actualmemoryfileallocated17694720B+20828160B withincharged18079744B+21278720B. ALLoriginalbefore/stage1/stage2/terminalphysicalaccounting+stagecopyclaims/remainingbudget/caps independentlyrecomputed. Finalfree95937847296B EACH3SAMEFS64769/nonadditive/req24851118190 inclfloor10556150894+4GiBlogs+10GB/remaining0. Originalknownphysicalgrowth10205564928B/freeDrop10206208000B/unexplained643072B<500MB. RuntimeR4 ORIGINAL22:52:06.299746req41768863854free106143961088; beforeROOT41779083374/free106152439808 chargesexactfuturepackage10219520ONLYthere; beforeUNIT41768863854/free106144251904/runtimepkgfuture0alreadyoccupied. No freshcapacity/prooffit inferredfromclosedfree. Fullsource690rawGitOID/SHA/lenbindings+all15source+1333app unchanged/freshmainbeCI38772398721attempt1SUCCESS/4audits6rules2postrebootmemorydirectionR2accepted/#191CLOSED/no laterfailure verified.

Full originals/independentvalidation/index at WP/batch-proof-memory-events-be837974-20261015/proof233000-closed-memory-events-publication-once/; completedoriginals siblingproof233000-closed-memory-events-complete-originals-once. NextONE@claude162actualresult/PASS6203833517ACKONLYthere/actualclosed-resultreview. No localproofrunner/retainer/remoteproof remains. JobsONnaturalintake+broadpostflights/exactkitreview/freshsingleusegate/deploy STILLREQUIRED; MainMERGEHOLD/heartbeat2min untilactualbeDEPLOYED+ClactualpostdeployPASS. R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestartbyus. Old230000FAILEDimmutable/no retroPASSretrycleanup. Allscience/refusal/fullreports/impact/R1-R5/600/805blankheap/forwardonly/no103/history/humansheld.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
helpers=['validate-startup233000-closed-assets-and-copy-sources-once.py','execute-startup233000-closed-independent-validation-once.py','observe-startup-memory-proof233000-eighth-readonly-once.py','read-startup233000-closed-memory-events-readonly-once.py','retain-startup233000-closed-memory-events-originals-once.py','read-startup233000-closed-memory-events-complete-readonly-once.py','retain-startup233000-closed-memory-events-complete-originals-once.py','validate-startup233000-closed-memory-events-once.py','retain-startup233000-closed-current-authority-once.py']
folders=[rawdir,S/'proof233000-closed-independent-validation-once',S/'eighth-proof233000-readonly-observation-once',S/'proof233000-closed-memory-events-originals-once',S/'proof233000-closed-current-authority-once',D]
fixed=[R/'WP/backlog-resume-20261013'/n for n in helpers]+[pathlib.Path(__file__),*readmes]
paths=sorted(p for d in folders for p in d.rglob('*') if p.is_file())+fixed
assert len(paths)==len(set(paths))
save('publication-index.json',canonical({'baseAudit':BASE,'sourceHead':v['sourceHead'],'sourceReviewId':6203833517,'terminalUtc':v['terminalUtc'],'status':v['status'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
paths.append(D/'publication-index.json');rels=[p.relative_to(R).as_posix() for p in paths]
git('-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul',payload=b'\0'.join(n.encode() for n in rels)+b'\0')
assert set(git('diff','--cached','--name-only').decode().splitlines())==set(rels)
def verify(head):
 prefixes=[d.relative_to(R).as_posix() for d in folders]+[p.relative_to(R).as_posix() for p in fixed]
 entries={}
 for row in git('ls-tree','-r','-z',head,'--',*prefixes).split(b'\0'):
  if not row:continue
  meta,path=row.split(b'\t',1);mode,kind,obj=meta.decode().split();assert kind=='blob' and mode in ['100644','100755'];entries[path.decode()]=obj
 assert set(entries)==set(rels)
 oids=[entries[n] for n in rels];batch=git('cat-file','--batch',payload=('\n'.join(oids)+'\n').encode());at=0
 for p,obj in zip(paths,oids):
  end=batch.index(b'\n',at);got,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
  assert got==obj and kind=='blob' and batch[at-1:at]==b'\n' and raw==p.read_bytes() and sha(raw)==sha(p.read_bytes()) and oid(raw)==obj
 assert at==len(batch)
verify(git('write-tree').decode().strip());git('commit','-m','Retain closed233000 two-startup memory-events proof and full evidence')
head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head
print(json.dumps({'head':head,'rawOidShaLengthVerifiedFiles':len(paths),'resultSha256':sha((D/'closed-result.json').read_bytes()),'index':(D/'publication-index.json').relative_to(R).as_posix(),'status':v['status']},ensure_ascii=True))
