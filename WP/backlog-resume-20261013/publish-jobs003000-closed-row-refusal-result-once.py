"""Publish validated actual failure and safe originals once; withhold all raw jobs-ON logs."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-jobs-intake-be837974-20261016';D=S/'jobs003000-closed-row-refusal-publication-once';BASE='6f1ca47b5f3a04b6b352ab11ed3be037cdac48ef';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,FILES
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip() and not D.exists()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
rawdir=S/'jobs003000-closed-row-refusal-originals-once';r=json.loads((rawdir/'closed-retention-record.json').read_bytes());v=json.loads((rawdir/'independent-closed-validation.json').read_bytes())
assert v['wholeProofPassed'] is False and v['releaseQualified'] is False and v['all54PackageFilesUnchanged'] and v['allMemorySamplesValidated']==843 and v['allOriginalKernelReadsValidated']==6744
assert (S/'jobs003000-closed-current-authority-once/verified-record.json').is_file()
review=json.loads((S/'jobs003000-closed-log-content-review-once/content-review-record.json').read_bytes());assert len(review['rawJobsOnCaptures'])==6 and review['payloadFreeClaimed'] is False
withheld={R/x['path'] for x in review['rawJobsOnCaptures']}|{rawdir/'stdout-original.json'}
assert len(withheld)==7 and all(p.is_file() for p in withheld)
for p in review['rawJobsOnCaptures']:assert sha((R/p['path']).read_bytes())==p['sha256'] and p['publicRawContentsAllowed'] is False
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
for n in FILES:assert (S/n).read_bytes()==(rawdir/'remote-originals'/n).read_bytes()
D.mkdir()
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
save('closed-result.json',canonical(v)+b'\n');save('journal-all-original.jsonl',r['journalOriginal'].encode());save('systemctl-original.txt',r['systemctlOriginal'].encode())
save('public-content-exclusions.json',canonical({'reason':'Preserve full jobs-ON originals privately and on host. All six log captures fully byte-reviewed; hashes acceptable under actual SourcePASS6205111918. Never publish transport JSON embedding those originals. No payload-free claim.','contentReviewRecord':'WP/batch-proof-jobs-intake-be837974-20261016/jobs003000-closed-log-content-review-once/content-review-record.json','withheld':[{'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(withheld)]})+b'\n')
save('local-shell-parse-refusal-derived.json',canonical({'kind':'TOOL_OUTPUT_TRANSCRIPTION','boundary':'Local compact diagnostic and pre-execution source edit command','error':'PowerShell ParserError before Python execution from nested quote escaping','reviewedSourceChanged':False,'validatorExecutedByFailedCommand':False,'hostCalls':0,'correction':'New here-string command completed before validator first execution; no proof or helper replay.'})+b'\n')
lead=f'''LATEST ACTUAL CLOSED003000 JOBS INTAKE REFUSAL - {v['terminalUtc']} / independent validation {v['validatedUtc']}.

SAME ONE exact04c99271e761198937aa798131075f199e86b679/SourcePASS6205111918/invocation1316c26d1ef14f48b564b1e0cb7707a5 CLOSED FAILED with RuntimeError: Original row changed: Sample. Original0400 terminal SHA651b2b633a7e8700ae9ebb8515142116123d625edd00de35712cef51b4fcd62a. Failure is the first natural completion consistent-backup comparison against jobsOFF stopped baseline, kobo_copy_preservation.py:142/proof_jobs.py:181; existing Sample row equality rejected. Changed fields/row IDs have NOT independently been located, so no scientific/provenance cause is inferred. No full jobsON preservation, second natural sync, final stopped seal, second result or terminal whole-store accounting reached. No qualification/kit/gate/deploy PASS. Root /opt/lims/releases/workflow-batch-jobs-intake-be837974-20261016T003000Z/unitlims-workflow-batch-jobs-intake-be837974-20261016t003000z/PASS/package/operators consumed NEVERretryreplaycleanup. ownedStopErrornull/all original files and two ownedSTOPPEDcontainers retained.

FIRST jobsOFF FULL result and ALL command raws now independently checked:27entrypointNO_OP EXACTinteger0+26currentREADY EXACTinteger0/HTTP200200401, broad31/31API0failed+6exactreadonlyprobeSHA/exit0. Readiness515.1492121369993s/Dockerhealthy513.8320998189993s within600. Full stopped112tables42receipts objects/rows/receipts/integrityok/FK0 EXACTbound prior installed209; original resultSHA09e9d821f1a0c8f2cbd56d1924e64ac3d8037d1afc6de2ae526bd87c5c6d0d42 unchanged. SECOND jobsON same7028fd18bebf1527b68d896d2a0130806ab83fe39666d00b5d7b01860c1ebd30/PID226265/start00:43:27.864232752Z reached Dockerhealthy483.0280916209995s; raw27NOOP0+26READY0/HTTP200200401/ready-final memory under600 checked. Transientunhealthy observed intervals421.65998555999977s and390.86248386199986s are MONOTONICpollintervals/not exact unobserved transition times. Several-minute restart window MUST be disclosed in any later kit/gate (these healthy514s/483s; prior333s/392s).

ONE natural observation00:51:33.494553 retained FULL. Log reports targetZMB-LAB1/SOILFER-US completion00:51:17.475225848Z/newSamples174/skipped22; these are REPORTED counts, NOT independently validated intake/provenance counts. Four exact original refusal tuples each one-to-one paired once; second required pairs/secondsync never reached. Original copied cursors/intervals/clocks unchanged by controller; first-sync.db retained0400/HASHSTAT ONLY/no new SQL by retainer. Full journal exactsameinvocation traceback + failedexit1/MainPID0/MemoryMax805306368Swap0/Runtime90min confirms actual closure. Controllerpeak806354944B separate observationONLY/noOOM or charge-cause diagnosis.

ALL812FULL0400healthpolls419+393/ALL843memorysamples434+409/ALL6744original0400kernelreads SHA+length/readbounds/stat/events/scalars/procmembership/mountinfo independently validated. ExactownedCID/livePID/start/owner/limits/cgroupdeviceinode/exactIDleaf stable within/between EVERYsample; repeated memberships equal; oom=oom_kill0/DockerOOMfalse/restarts0 EVERYsample. Seven-field samplednonreclaimable maxima274084176B+209123360B<=603979776; maxREADYrss178102272+166838272. App memory.peak805306368/maxhigh/reclaim observationsONLY; no continuouspeak claim. OFF finalbefore-stop434 exists/charged27242496B inside256MiB; ON last409phaseconsistent-backup/no finalbefore-stop or completedsummary because refusal; captured raw+sample allocation25128960B inside256MiB. Actualmemoryfileallocated26664960+25128960B. Both489-file assets copies SHA+length unchanged/5787648allocatedB/schema89556+emptyseedmarkers preserved.

ALL12095rootfiles stablehashed/9105768448B allocated FILESUM ONLY, not whole-store accounting. ALL11069smallnonDB/nonasset originals retained locally/fullDBWALSHM/assets retained HOST with hashes/no DBfetch/oldSQL/newSQL/newdu/proofreplay. ALL79historical safe fullcontainer identities/unorderedMounts/running/starttimes preserved/stoppedstaystopped; two NEWowned stoppedExit137/OOMfalse/restarts0. NORMAL8109/959d/7a healthy unchanged; original0400cd3areceipt + ENTIREacc158image unchanged; bound080000rawreaderbackup+070000assets fullhashstat unchanged.

ALL six jobsON logcaptures437071B/8774lines FULL-byte reviewed; sample/submission/structured-data content risk exists. ALL rawjobsON logs AND closed-retainer stdoutJSON embedding them are deliberately WITHHELD from publicGit; fulloriginals remain local+HOST, SHA/lengths and full line hashes published. No payload-free claim or original redaction/rewrite. Public source originals and allhealth/memory raws retained; public-content-exclusions.json explicitly enumerates seven withheld files.

OriginalR4 runtime00:29:06.704078 req60921981038/free95817687040 EACH3 retained/not freshmeasurement; beforeROOTreq60932393070/free95826145280 chargesexactfuturepackage10412032 ONLYthere, immediatelybeforeUNITreq60921981038/free95817760768/pkgfuture0alreadyoccupied. N25/MIN64/25percent/3assets/schema+markers/stagecaps/floor10556150894+4GiBlogs+ADDITIONAL10GB unchanged. Original before+OFFstage physicalaccounting/declaredcopyclaims/remainingbudgets/caps recomputed: stage1known growth5111775232/freeDrop5112188928/unexplained413696<500MB; ON intent min43305864302/remainingincluding27614883840 preserved. ONstageclosure/finalwhole-storemeasurement NOT reached; no freshdu created. Closed-retainerfree86716112896 EACH3 SAMEFS/nonadditive is later observation only/not futurefit. ALL2515controller memory telemetry records retained. All717sourcepub rawGitOID/SHA/len+26source+1333frozenapp+458rawGitappbindings verified/currentmainbeCI38772398721attempt1pushSUCCESS/4appaudits6rules2postreboot memorydirection/jobsScope/R2accepted/nolaterfailure/#191CLOSED freshly verified.

Full safe originals/independent result and publication-index at WP/batch-proof-jobs-intake-be837974-20261016/jobs003000-closed-row-refusal-publication-once; local complete originals siblingjobs003000-closed-row-refusal-originals-once. No activeproof/localrunnerretainer. NEXT ONE@claude162actualfailedresult bundling620511PASSACK ONLYthere; request separately audited forward-remedy scope. No existingguard weakening or oldhelper/source/test/host/proof replay. MainMERGEHOLD until actualbeDEPLOYED+ClactualpostdeployPASS; SAMEheartbeatACTIVE2min/restore10ONLYthen. Qualificationonly/no kit/gate/deployapproval. Prior233000latestpassingKEEPIT/R2COMPLETE/no moreprune/YY320GiBalreadyvisible/nohostgrowrestart/no103/noagentsnewchatworktreecheckout/humanfilesdraftcards preserved. Native0018followup answered/NEVERduplicate nativeACKGHrequest. Preserve ALL older history verbatim below.

'''
save('checkpoint-prefix.txt',lead.encode());readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
helpers=['observe-jobs-intake003000-sixth-readonly-once.py','read-jobs003000-closed-row-refusal-readonly-once.py','retain-jobs003000-closed-row-refusal-originals-once.py','retain-jobs003000-closed-current-authority-once.py','validate-jobs003000-closed-row-refusal-once.py','execute-jobs003000-closed-independent-validation-once.py','review-jobs003000-all-jobs-on-logs-before-publication-once.py']
folders=[rawdir,S/'sixth-jobs003000-readonly-observation-once',S/'jobs003000-closed-independent-validation-once',S/'jobs003000-closed-log-content-review-once',S/'jobs003000-closed-current-authority-once',D]
fixed=[R/'WP/backlog-resume-20261013'/n for n in helpers]+[pathlib.Path(__file__),*readmes]
paths=sorted(p for d in folders for p in d.rglob('*') if p.is_file() and p not in withheld)+fixed
assert len(paths)==len(set(paths)) and not set(paths)&withheld
for p in paths:assert not p.name.endswith(('.db','.db-wal','.db-shm'))
save('publication-index.json',canonical({'baseAudit':BASE,'sourceHead':v['sourceHead'],'sourceReviewId':6205111918,'terminalUtc':v['terminalUtc'],'status':v['status'],'withheldContentIndex':'public-content-exclusions.json','files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
paths.append(D/'publication-index.json');rels=[p.relative_to(R).as_posix() for p in paths]
git('-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul',payload=b'\0'.join(n.encode() for n in rels)+b'\0')
assert set(git('diff','--cached','--name-only').decode().splitlines())==set(rels)
def verify(head):
 prefixes=[d.relative_to(R).as_posix() for d in folders]+[p.relative_to(R).as_posix() for p in fixed];entries={}
 for row in git('ls-tree','-r','-z',head,'--',*prefixes).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);mode,kind,obj=meta.decode().split();assert kind=='blob';entries[path.decode()]=obj
 assert set(entries)==set(rels) and not {p.relative_to(R).as_posix() for p in withheld}&set(entries)
 objects=[entries[n] for n in rels];batch=git('cat-file','--batch',payload=('\n'.join(objects)+'\n').encode());at=0
 for p,obj in zip(paths,objects):
  end=batch.index(b'\n',at);got,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
  assert got==obj and kind=='blob' and batch[at-1:at]==b'\n' and raw==p.read_bytes() and oid(raw)==obj
 assert at==len(batch)
verify(git('write-tree').decode().strip());git('commit','-m','Retain closed jobs qualification preservation refusal and independently verified evidence')
head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH);assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head
print(json.dumps({'head':head,'rawOidShaLengthVerifiedFiles':len(paths),'resultSha256':sha((D/'closed-result.json').read_bytes()),'withheldFullOriginals':len(withheld),'status':v['status']},ensure_ascii=True))
