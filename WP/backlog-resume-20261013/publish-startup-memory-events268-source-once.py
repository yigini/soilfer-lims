"""Publish complete NEW memory-events proof source, closed268 guards and actual direction."""
import ast,datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';OLD=R/'WP/batch-proof-startup-be837974-20261015'
BASE='46c2fd0f57d79b148487714490d94a01f47fd719';BRANCH='audit/release-eb6de2e8';sys.path.insert(0,str(S))
from proof_contract import *
from proof_memory import NON_RECLAIMABLE_FIELDS,NON_RECLAIMABLE_MAX,MAX_EVIDENCE_ALLOCATED_PER_STARTUP
import prepare_proof as prep
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
closed=exact_json((S/'source-local-host268-complete-once/exit-original.json').read_bytes());assert closed['status']=='PASS' and closed['expectedTests']==268 and closed['localExitCode']==closed['hostExitCode']==0 and closed['sourceUnchanged']
expected=closed['sourceSha256After'];assert set(expected)==FILES and len(FILES)==15 and all(sha((S/n).read_bytes())==h for n,h in expected.items())
host=exact_json((S/'source-local-host268-complete-once/host-stdout-original.json').read_bytes());assert host['testsRun']==268 and host['status']=='PASS' and host['sourceSha256']==expected and host['sourceFilesWritten']==host['actualDockerCalls']==host['proofOperatorsExecuted']==host['productionSqliteConnections']==0 and '3.9.23' in host['pythonVersion']
assert b'Ran 268 tests' in (S/'source-local-host268-complete-once/local-stderr-original.log').read_bytes()
assert ast.parse((S/'proof_memory.py').read_bytes()) and NON_RECLAIMABLE_MAX==603979776
freeze=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(freeze)==1333 and all(sha((R/n).read_bytes())==h for n,h in freeze.items())
oldindex=exact_json((OLD/'proof230000-closed-memory-originals-once/remote-originals/tooling-source-index.json').read_bytes())
for n,pin in oldindex['files'].items():assert sha((OLD/n).read_bytes())==pin['sha256'] and (S/'source-preparation-before'/n).read_bytes()==(OLD/n).read_bytes()
same=[n for n in oldindex['files'] if (S/n).read_bytes()==(OLD/n).read_bytes()]
ref=exact_json((S/'fresh-capacity-cgroup-reference-once/independent-reference-validation.json').read_bytes());assert ref['newRootAbsent'] and ref['newUnitUnused'] and ref['requiredExcludingFutureExactPackageBytes']==41768863854 and ref['operatorsExecuted']==ref['serverWrites']==0
fresh=S/'fresh-source-publication-authority-once';assert not fresh.exists();fresh.mkdir();original=prep.command;captures=[]
def capture(*args):
 raw=original(*args)
 if args[:2]==('gh','api'):
  n='api-original-'+str(len(captures)).zfill(2)+'.json';(fresh/n).write_bytes(raw);captures.append({'path':n,'argv':args,'length':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)})
 return raw
prep.command=capture;evidence=prep.current_evidence();assert prep.gh('repos/yigini/soilfer-lims/issues/191')['state']=='closed'
(fresh/'current-evidence-derived.json').write_bytes(canonical(evidence)+b'\n');(fresh/'api-command-index.json').write_bytes(canonical(captures)+b'\n')
prior_index=(OLD/'proof230000-closed-memory-publication-once/publication-index.json').read_bytes();(S/'prior230000-publication-index-original.json').write_bytes(prior_index)
readme=f'''# New host-memory-events startup proof source

Complete NEW15-file graph from reviewed29fa000751f25447f1ff8c129b0dfcc5d2b67445, under actual uneditedClaude-app direction6203416404/2026-10-15T22:16:57Z. This is source for a NEW exact review, not a SourcePASS or a proof. No operational package/upload/root/unit/startup has been created. Proposed root {ROOT}; ONE attempt/no retry. The old230000root/unit/package/PASS/operators remain consumed and immutable.

Actual direction: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6203416404 . Semantic SHA256{MEMORY_DIRECTION_SHA}; the new contract pins the complete id/body/created_at/updated_at/app-id/slug projection. Fresh authority reads are mandatory before preparation, upload, launch, and bound at runtime; a later exact SourcePASS must be newer than6203416404 and22:16:57Z and include EVERY literal binding and ALL15source hashes.

The prior230000 whole proof FAILED at its exact old app peak guard:805314560B versus805306368B,8192Bexcess; no retroactive PASS. Full retained1509blobs and independentresultff22ab7627ab90aa3848dd5ae0cf3078cc4fb60b787f33944185a9415e42ab1d are published9efebefccc05095d84bcfad234fce46a53cbeaf2. Actualresult handoff6203392900 and125raws are published46c2fd0f. Its firststartup27NOOP0+26READY0/healthy393s/allHTTPprobes remains an observation; no fullstoppedstate/secondstartup/wholeproofPASS is reused. Claudio's diagnosis is retained as his explanation, not an independent proof of the exact kernel charge cause.

## Exact authorized memory policy

Memory805306368 = totalmemory+swap805306368, host memory.swap.max0, blankNODE_OPTIONS, jobsOFF/networknone/falsepushseed stay fixed. Every health poll plus a final sample BEFORE stop resolves the exact full container ID -> live host PID -> single unified/proc/PID/cgroup membership -> canonical host cgroup2 mount. The full ID must be its own path component; hostPID/starttime/owner/cgroupdirectoryinode/device/membership and inspected container identity must stay equal across each read and between samples. Aliases, v1/subtree/foreign cgroups, missing/duplicate/noninteger/truncated counters, unreadable files and any identity race refuse without retry. No counter writes, peak reset, reclaim, process inside the container, or production sampling is used by this memory collector.

Hard gates every sample: memory.events oom=0 and oom_kill=0; DockerOOMKilledfalse/restarts0/running; memory.max805306368 and swap.max0; sampled non-reclaimable total <=603979776B (75%). The total is EXACTLY {' + '.join(NON_RECLAIMABLE_FIELDS)}. This is the requested sampled bound, not a claim of continuous peak measurement. ALL raw memory.stat/events/peak/max/swap-max and host proc membership/mountinfo bytes are retained0400 with source paths, SHA256 and lengths, before guard evaluation. A failed read/guard retains its refusal and all earlier raw reads. All601maximumsamples/startup (<=600health polls +final) and maxREADYrss_bytes are recorded.

memory.peak and memory.events max/high plus pgscan/pgsteal/reclaimable counters are explicitly observations, not success thresholds. A peak=limit+8192 with zeroOOM and a safe sampled total passes this NEW gate. The old proof remains FAILED. Kernel primary interface reference: https://docs.kernel.org/admin-guide/cgroup-v2.html (keyed memory.stat, hierarchical memory.events, and memory.max/peak interfaces). The implemented policy comes from the actual reviewer direction.

Telemetry is bounded: mountinfo256KiB/membership4KiB/stat16KiB/events4KiB/scalars64B per read;601samplesmaximum/startup. Per-startup raw records+rounded4096allocations+summary are capped at268435456B, <=512MiB for both startups INSIDE the existing4GiB log reserve. No extra DB copy, TMPDIR, asset copy, or allowance reduction. The existing N24 ->30DB-equivalents/25%margin/fixedschema89556B+markers+32dirs/startup/3assetreserve/floor10556150894/ADDITIONAL10GB/500MBunexplained-growth stop/stage caps/600s/readiness and fullHTTP deadline remain. Remaining-budget accounting and all remote templates/render-before-SSH guards remain.

## Verification and preserved scope

Final268local +268ACTUALhost Python3.9.23 tests PASS; all15source hashes unchanged. Local and host suites block real subprocesses and use closed fake interfaces; only retained synthetic owned fixtures are written, host source modules loaded IN MEMORY. Zero real Docker/cache/proof-operator/productionSQLite calls in final268 tests. All229existing guard assertions retained; fixture-only changes supply new-memory closed sampler/READYrss and later mock review dates. Added39memory-policy, identity-race, raw0400, final-before-stop, integration-refusal, bounded-read/evidence-budget and direction/prior-failure guards.

First260local attempt is honestly retained:246tests ran/5failed+1classerror, host NOTstarted. New memory fixtures created the old strict fixture parent too early; old startup control-flow fixtures lacked a memory sampler/RSS. Missing sampler caused unintended LOCAL readonly docker-inspect attempts that refused; no mutation, production connection or host test occurred. The262 isolated successor passed local+host; final268 adds explicit telemetry bounds and tests. All predecessor source-at-attempt bytes/logs/exit records remain. No source guard or assertion was weakened.

{len(same)} of14oldsource files are BYTEIDENTICAL: {', '.join(sorted(same))}. The six changed predecessor files are contract/newnamespace+direction+bindings; budget includes the new no-copy module; startup integrates host sampling; prepare/run bind fresh memory direction; tests add guards/fixture context. New proof_memory.py is the only added module. No application/client/CI/Dockerfile/Compose bytes changed;1333frozenappinputs unchanged.

Qualified image remains acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a/414683521B, original0400cd3a receipt, build190000/4de3/PASS6200145007/evidence5f86. Currentmainbe837974/tree676/mainCI38772398721attempt1pushSUCCESS/all4appAudits/6standingrules/2postrebootpins/R2accepted+newmemorydirection freshly validated. Old080000cde8/tree638/B5 installed209 input authority remains separate; same bound11242raw/reader/backup+070000assets, no oldinputSQL/newproductionsnapshot/standaloneinstaller-policy replay. Two FULLordinary jobsOFF starts,27NOOP0+26READY0 each/full stopped-state seals/inputpreservation/full accounting remain required. Allscience/refusals/impact/nonzeroYY/approvedamendmentSTOP/fullhash/race/retainedcontainers/history/forwardonly/no103 guards stay.

Fresh STAT-only reference {ref['observedUtc']}: required41768863854B INCLUDING10GB, EXCLUDING future unprepared exact package; free{min(ref['freeBytes'].values())}B EACH3canonical4096paths/SAMEFS64769/nonadditive; NEWrootABSENT/unitnot-found. Actual host exact-container cgroup path derivation validated read-only against existing normal container metadata. This reference is NOT launch authority. New exact-source PASS + fresh allhash/currentauthority/unusedrootunit + exact future package R4 BEFORE ROOT/UNIT/runtime remain mandatory; no operator yet.

Scope stays startup-only/jobsOFF/NOT_RELEASE_QUALIFIED. No jobsON/kit/gate/deploy. MainMERGEHOLD until actualbeDEPLOYED+actualClpostdeployPASS. R2COMPLETE/no moreprune; YYpostrebootspacealreadyvisible/no grow/restart performed. Samewriter/no agents/newchat/worktree/concurrentwriter/humanfilesdraftcards changes. ACK actual6203416404 direction ONLY in the coming meaningful exact-source handoff; no duplicate6203010192ACK, resultpost, or native message.
'''
(S/'README.md').write_bytes(readme.encode())
lead=f'''LATEST COMPLETE NEW MEMORY-EVENTS SOURCE - {datetime.datetime.now(datetime.timezone.utc).isoformat()}. ActualCl6203416404/22:16:57 FULLREAD/semanticpin{MEMORY_DIRECTION_SHA} authorizes NEW graph memory policy keeping805306368=totalmemory+swap/hostswap0/blankheap; hardoom+oom_kill0/DockerOOMfalse/restarts0 +EVERYhealthpoll host memory.stat nonreclaimable<=603979776/75percent; finalhostevents BEFOREstop; peak/max/high/pgscan/pgsteal OBSERVATIONS/maxREADYrssrecorded. NEW15-file WP/batch-proof-memory-events-be837974-20261015/README.md COMPLETE/268LOCAL+268ACTUALhostPython3.9.23 PASS/all15hashunchanged/INMEMORYhostsources/realprocessesblocked/0realDocker-cache-productionSQLite/operator calls. First260fixturefailure/unintendedLOCALreadonlyinspectattempts honestlyretained/hostnotstarted;262bothPASS then268bothPASS withtelemetrybounds. Same8oldfilesbyteidentical/all229oldassertions retained/39newguards.601samplesmax/startup/rawbounded/256MiBevidence+summary/startup withinexisting4GiBlogs; no copybudgetchange/N24->30/25percent/600/805blankheap/fullscience unchanged. NEWproposed233000root {ROOT} UNCREATED/unitunused reference{ref['observedUtc']} req41768863854+futureexactpackageNOTYETprepared vsfree{min(ref['freeBytes'].values())}EACHsameFS/nonadditive; referenceNOTlaunchAuthority. NEWexactall15hashSourcePASS REQUIRED beforeanypackage/upload/root/unit/startup, withfreshallcurrentauthority/R4beforeROOT-unit-runtime/unusedroot. Newprepare/launch/run UNEXECUTED exceptimport/compile/closedfakeguards. Prior230000FAILED9efebefc/8192Bover staysFAILED/consumed/no retry/no reusefirststartupPASS; result6203392900 handoff46c2fd0f complete. NextONE@claude#162 exactnewsourceReview bundles6203416404ACKONLYthere/no duplicates/native. No jobsON/kit/gate/deploy/mainmerges. R2COMPLETE/heartbeat2min/allR1-R5/science/history/humans held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
helpers=['prepare-startup-memory-events-source-once.py','prepare-startup-memory-events-verifier-source-once.py','verify-startup-memory-events260-local-host-once.py','verify-startup-memory-events262-isolated-local-host-once.py','verify-startup-memory-events268-bounded-local-host-once.py','read-startup-memory-events-capacity-cgroup-reference-once.py']
paths=sorted(p for p in S.rglob('*') if p.is_file())+[R/'WP/backlog-resume-20261013'/n for n in helpers]+[pathlib.Path(__file__),*readmes]
assert not any('__pycache__' in str(p) or p.suffix=='.pyc' for p in paths)
def meta(p):
 raw=p.read_bytes();return {'path':p.relative_to(R).as_posix(),'length':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)}
indexpath=S/'source-publication-index.json';assert not indexpath.exists()
index={'status':'COMPLETE_NEW_HOST_MEMORY_EVENTS_SOURCE_268_LOCAL_AND_ACTUAL_HOST_GUARDS_NOT_EXECUTED','baseAudit':BASE,'direction':6203416404,'directionSemanticSha256':MEMORY_DIRECTION_SHA,'sourceFiles':{n:meta(S/n) for n in sorted(FILES)},'localTests':268,'actualHostTests':268,'all15SourceHashesUnchanged':True,'all1333ApplicationInputsUnchanged':True,'byteIdenticalPredecessorFiles':same,'prior230000StillFailedAndConsumed':True,'referenceOnly':ref,'operatorsExecuted':0,'newSourcePassRequired':True,'files':[meta(p) for p in paths]}
indexpath.write_bytes(canonical(index)+b'\n');paths.append(indexpath);names=[p.relative_to(R).as_posix() for p in paths];assert len(names)==len(set(names))
git('-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul',payload=b'\0'.join(n.encode() for n in names)+b'\0');assert set(git('diff','--cached','--name-only').decode().splitlines())==set(names)
def verify(head):
 refs=[head+':'+n for n in names];batch=git('cat-file','--batch',payload=('\n'.join(refs)+'\n').encode());at=0
 for p in paths:
  end=batch.index(b'\n',at);got,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
  assert kind=='blob' and batch[at-1:at]==b'\n' and raw==p.read_bytes() and oid(raw)==got and sha(raw)==meta(p)['sha256']
 assert at==len(batch)
verify(git('write-tree').decode().strip());git('commit','-m','Publish new host-memory-events startup graph and268 isolated guards');head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'head':head,'rawOidShaLengthVerifiedFiles':len(paths),'sourceFiles':len(FILES),'localAndHostTests':268,'reference':ref,'operatorsExecuted':0,'newExactSourcePassRequired':True},ensure_ascii=True))
