"""Publish complete closed230000 failure originals and independent validation once."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-startup-be837974-20261015';D=S/'proof230000-closed-memory-publication-once'
BASE='4d2befe3d034709143cdbf1e3517cf88b906aa05';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,FILES
def cmd(*a,payload=None):return subprocess.check_output(a,cwd=R,input=payload)
def git(*a,payload=None):return cmd('git','-c','core.longpaths=true',*a,payload=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE and not D.exists()
rawdir=S/'proof230000-closed-memory-originals-once';record=json.loads((rawdir/'closed-retention-record.json').read_bytes());v=json.loads((rawdir/'independent-closed-validation.json').read_bytes())
assert v['exactLimitExcessBytes']==8192 and v['appOriginalCgroupPeakBytes']==805314560 and not v['wholeProofPassed'] and v['all42PackageFilesUnchanged'] and v['firstStartupReadyZeroCount']==26
assert (S/'proof230000-closed-current-authority-once/verified-record.json').is_file()
frozen=json.loads((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333 and all(sha((R/n).read_bytes())==h for n,h in frozen.items())
for n in FILES:assert (S/n).read_bytes()==(rawdir/'remote-originals'/n).read_bytes()
D.mkdir()
def save(n,raw):
 with (D/n).open('xb') as f:f.write(raw)
save('closed-result.json',canonical(v)+b'\n')
save('journal-all-original.jsonl',record['journalOriginal'].encode())
save('systemctl-original.txt',record['systemctlOriginal'].encode())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f'''LATEST ACTUAL CLOSED230000 MEMORY-GUARD FAILURE - retained/publication prepared {now}.

ONE exact29fa000751f25447f1ff8c129b0dfcc5d2b67445/SourcePASS6203010192 jobs-OFF proof CLOSEDFAILED2026-10-15T22:03:39.298754+00:00. SAMEroot /opt/lims/releases/workflow-batch-startup-be837974-20261015T230000Z/unitlims-workflow-batch-startup-be837974-20261015t230000z/invocationb962da09082d4fb49c8b9076181b7f4c. ActualResultexit-code/ExecMainStatus1/MainPID0/MemoryMax805306368Swap0/90min. Original Startup memory STOP: APP cgroup memory.peak805314560B, EXACT8192B above805306368B. No tolerance/rounding/limit increase authorized. ControllerMemoryPeak805306368B is separate. Ownedb143bdbe STOPPEDretained/exit137 after ownedstop/OOMKilledfalse/restarts0; no OOM claim. DefaultjobsOFF/networknone/blankheap/exactmemory+totalswap805306368/falsepushseed retained.

Actual first startup ALL27entrypointNO_OP integer0 + ALL26exactREADY integer0; health starting0.6161289369997576s -> unhealthy -> healthy392.9904243249998s (<600), all372FULLoriginal0400polls retained including FULLStateHealth.Log/FailingStreak/config/UTC/monotonicelapsed. HTTPhealth200/login200/unauthorizedreceiptsPOST401 passed before memoryguard. Observedunhealthyinterval300.9889456830001s is MONOTONIC OBSERVED poll intervals, not exact unobserved transition time. SECONDstartupUNATTEMPTED/0polls. No startup1result/fullstoppedlogicalseal/stageclosure/wholeproofreceipt/finalwhole-storeaccounting was reached; no zero-state-change/PASS inferred from NOOP/READY logs. Boundold080000installed11242raw/reader/backup+070000assets unchanged by complete hash/stat-only validation, no oldinputSQL. No new production snapshots/standalone installer replay/productionSQLite connection.

FULL1867stablehashedrootfiles3399839744fileallocatedB/ALL42package0400hashes unchanged.1362ALLsmall nonDB/nonasset originals10MB+, all905controller memory telemetry originals, FULLsame-invocation --all journal/systemctl, qualified ORIGINAL0400cd3areceipt+ENTIREfreshacc158image object unchanged, ALL76historical fullsafecontainer identities/mounts/starttimes preserved/stoppedstillstopped + ONEnewownedstopped retained. Schema89556B+emptyseedmarker separatelyretained against same closed inventory; ALLDB/WAL/SHM/assets remain HOST with fullhash/stat, no DBfetch/newdu/cleanup by retainer. Largestfileallocationgroups startup1TMPDIR2816798720B/database563417088B/assets5787648B; these are file-stat sums, not final whole-store physical accounting. Closedfree106175389696B EACH3sameFS64769/notadditive/observationONLY/notfuturefit. OriginalfreshR4 beforeROOT41779001454/free109576622080 and beforeUNIT41768863854/free109568503808 plus runtime21:56:06.227379 req41768863854/free109568176128 passed with ADDITIONAL10GB/packagefuture10137600onlybeforeROOT. Runtimecard is ORIGINAL, not newmeasurement.

Independentvalidation/all629source-indexedraws+index630 rawGitOID/SHA/length/all14reviewedsources+1333frozenappinputs unchanged; freshcurrentmainbe/mainCI38772398721attempt1pushSUCCESS/4audits6rules2postrebootpins/R2accepted/no laterfailure/#191CLOSED retained. Complete originals/independentvalidation/publication-index at WP/batch-proof-startup-be837974-20261015/proof230000-closed-memory-publication-once/. NOactiveproof/localretainer remains. ROOT/unit/sourcePASS/package/operators/all oncehelpers CONSUMED NEVERretryreplaycleanup. NEXT ONE@claude#162 fullactualclosedresult +6203010192ACKONLYthere/request separately reviewed forward remedy. No source correction/newproof/jobsON/kit/gate/deploy now. NOT_RELEASE_QUALIFIED; mainMERGEHOLD/heartbeat2min until actualbeDEPLOYED+ClpostdeployPASS. R2COMPLETE/no moreprune; YYpostrebootspace alreadyvisible/no hostgrowth performed; allscience/R1-R5/600/805blankheap/forwardonly/no103/history/humans held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
helpers=['observe-startup-proof230000-fifth-readonly-once.py','prepare-startup230000-closed-readonly-retainer-source-once.py','read-startup230000-closed-memory-readonly-once.py','retain-startup230000-closed-memory-originals-once.py','retain-startup230000-closed-schema-marker-once.py','validate-startup230000-closed-memory-evidence-once.py','retain-startup230000-closed-current-authority-once.py']
folders=[rawdir,S/'fifth-proof230000-readonly-observation-once',S/'proof230000-closed-current-authority-once',D]
fixed=[R/'WP/backlog-resume-20261013'/n for n in helpers]+[pathlib.Path(__file__),*readmes]
paths=sorted(p for d in folders for p in d.rglob('*') if p.is_file())+fixed
assert len(paths)==len(set(paths))
save('publication-index.json',canonical({'baseAudit':BASE,'sourceHead':v['sourceHead'],'sourceReviewId':6203010192,'terminalUtc':v['terminalUtc'],'status':v['status'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
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
verify(git('write-tree').decode().strip());git('commit','-m','Retain closed230000 startup memory failure and full original evidence')
head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head
print(json.dumps({'head':head,'rawOidShaLengthVerifiedFiles':len(paths),'resultSha256':sha((D/'closed-result.json').read_bytes()),'index':(D/'publication-index.json').relative_to(R).as_posix(),'status':v['status']},ensure_ascii=True))
