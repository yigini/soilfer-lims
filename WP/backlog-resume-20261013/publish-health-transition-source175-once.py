"""Publish complete new health-transition graph and175 closed local/host guards."""
import hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-health-transitions-cde8-20261015';BASE='e923fdc14aecd965721e9009e0f4d81b8c13f706'
sys.path.insert(0,str(S));from proof_contract import FILES,PRIOR_FILES,PRIOR_FILES_SHA,COMPOSE_PIN,canonical,sha,require
from proof_budget import TABLE,TABLE_SHA,TOTAL_DB_COPIES,DB_EQUIVALENTS,copy_site_guard,EXPECTED_SITES
from prepare_proof import raw_git
def cmd(*a,payload=None):return subprocess.check_output(a,cwd=REPO,input=payload)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
proof=json.loads((S/'source-local-host-verification-transitions-once/exit-original.json').read_bytes());require(proof['status']=='PASS' and proof['localExitCode']==proof['hostExitCode']==0 and proof['expectedTests']==175 and proof['sourceSha256Before']==proof['sourceSha256After']=={n:sha((S/n).read_bytes()) for n in FILES},'Frozen175 proof differs')
for n in FILES:compile((S/n).read_bytes(),n,'exec')
copy_site_guard({n:(S/n).read_bytes() for n in EXPECTED_SITES});require(TOTAL_DB_COPIES==24 and DB_EQUIVALENTS==30 and len(TABLE)==2 and len(PRIOR_FILES)==20,'Graph/model differs')
for n,pin in PRIOR_FILES.items():
 b,m=raw_git('dd496777400e9c2f4f0ace73009f8cf8c86022d0',pin['path']);require(m=={k:pin[k] for k in ['bytes','sha256','blob']} and b==(S/'bound-input-records'/n).read_bytes(),'Real prior differs')
compose,m=raw_git('cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367','docker-compose.yml');require(m=={k:COMPOSE_PIN[k] for k in ['bytes','sha256','blob']} and compose==(S/'compose-source.yml').read_bytes(),'Compose differs')
assessment=json.loads((S/'reference-owned209-capacity-metadata-once/reference-assessment.json').read_bytes());require(assessment['N']==24 and assessment['equivalents']==30 and assessment['tableSha256']==TABLE_SHA,'Reference differs')
index={'files':{n:{'sha256':sha((S/n).read_bytes()),'bytes':(S/n).stat().st_size} for n in sorted(FILES)},'actualLocalTests':175,'actualHostTests':175,'proofClosedUtc':proof['closedUtc'],'inputPins':20,'priorEvidenceIndexSha256':PRIOR_FILES_SHA,'composePin':COMPOSE_PIN,'direction':6188190365,'predecessorSource':'0541865b67af0fbf3232d7cb077ab505896a2ced','noOperatorsExecuted':True}
with (S/'complete-source-static-index.json').open('xb') as f:f.write(canonical(index)+b'\n')
(S/'declared-copy-budget-table.json').write_bytes(canonical({'table':TABLE,'tableSha256':TABLE_SHA,'declaredDbTriples':24,'dbEquivalents':30,'marginPercent':25,'minimumDbEquivalents':0,'assetsReserveMultiplier':3,'freshReference':assessment,'copySiteGuardPassedOnRealSources':True,'unchanged054BudgetExplicit6188190365':True})+b'\n')
doc='''# Exact production-health transition startup proof source

Complete NEW twelve-file graph under actual scope direction [6188190365](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6188190365), posted08:47:44UTC. This is not SourcePASS or execution. Proposed unused root `/opt/lims/releases/workflow-batch-startup-forward-cde8c889-20261015T100000Z`; no operational package/root/unit/operator exists. NEW exact all-hash PASS, current main/CI/3app audits and both fresh capacity gates are required before one attempt.090000/080000 remain FAILED and immutable; no retry/replay/retrospective PASS.

## Behavior and evidence

090000 stopped after102.226s while the ordinary verifier chain was active:24of27 NO_OP0,0of26 READY/no server-start marker. Docker health was unhealthy; the old rule stopped immediately. Claudio explicitly corrected that rule and rejected proof-only StartPeriod600. This graph keeps the EXACT pinned Compose bytes/health fields including30s start period and records unhealthy as an observation inside the unchanged600s deadline. No production Compose/app/image change or hidden proof grace values.

`proof_health` validates raw Compose GitOID/SHA/length before parsing; CMD-SHELL exec wget and all durations/retries are derived from those bytes. `Docker.validate` asserts the exact Config.Healthcheck before start, each poll/validation and after stop, plus identity, memory805306368/swapMEMORY/blankheap/networkNONE/jobsOFF/pushseedfalse/mounts/no restarts. Restarting/dead/exited/OOM immediately STOP. Only containers created by this controller can be stopped; all remain retained.

Every readiness poll invokes `HealthHistory.observe` on the freshly inspected object BEFORE validation can refuse it. It writes a NEW0400 JSON file containing UTC timestamp, monotonic elapsed seconds, status, FULL State including FailingStreak and FULL Health.Log, exact healthcheck, previous status, transition flag and cumulative observed unhealthy time. Missing/unknown health and invalid running state are retained before immediate STOP. Unhealthy is allowed and observable. Final startup results include every poll path, every transition, timeToFirstHealthySeconds and totalUnhealthySeconds. Durations use monotonic intervals between observed polls, explicitly labelled as observational rather than exact unobserved Docker transition times.

PASS requires healthy, successful HTTP health200, exact27entryNO_OP0+26READY0 inventory, then HTTP200health/200login/401receipt. The new deadline assertion AFTER all HTTP probes prevents accepting late probe results after600s. Healthy with failed HTTP, persistent unhealthy at600s, missing/unknown health, exited/restarting/dead/OOM or config mismatch STOP. A full stopped logical seal must equal the bound recorded11242 state; input rechecks and physical stage closure must pass. Health alone never qualifies a startup.

## Unchanged inputs and budget

All20 exact dd496777 raw Git pins from0541865b are unchanged:4517-row080000 inventory, exact oldfailure/source/PASS/input identity, installed209 raw/reader authorities/seal/recorded logical state,214209 stages/preservation, canonical policy PRESENT/CANONICAL/NO_OP, originalbaseline/assets handoff, carried inputs and full chart/order lists. Each is independently rawOID/SHA/length verified before publication. Old DBs are hash/stat only, never SQLite opened. SQL is only on NEW owned stopped seals.080000 installed209 backup and070000 raw assets are rechecked before copying, after EACH clone+assetcopy BEFOREcreate/start, after each stopped seal and closure. No206214209/policy/impact replay, new production snapshot, old container start, rebuild/retag, cleanup, jobsON, kit, gate or deploy.

Budget is byte-identical to054, explicitly retained by6188190365: two stages/12 DB-equivalents each (clone1, sealtriples2, sealbackup1, eight internal policy snapshots), N24 =>30equiv/25%/minimum0.3x assets/floor10556150894/4GiB logs/500MB unexplained STOP/remaining consumption/runtime claims/realAST guard/perstage disjointdu-x caps/allretainedreleasesDockercontainerd remain. Poll JSON/telemetry consume the existing logs/stage margin; no extra DB producer or old-copy credit.

Fresh08:55:28.653994UTC reference metadata: T563326976/A5787648, required31768290414/free31946665984B all3paths, slack178375570B. REFERENCE ONLY, narrow slack stated honestly. Fresh gates BEFOREnewroot and immediatelyBEFOREunit decide; nofit STOP with everything retained. No cleanup permission inferred from YY's separate list.

## Closed verification and boundaries

175/175 local +175/175 ACTUAL host Python3.9.23, all12 compile/hash unchanged. Only NEW retained synthetic local/host fixtures and recorded metadata; zero real Dockercreates/operators/productionconnections/oldSQL. Tests cover unhealthy-tohealthy plusHTTP/two independent startups/retained fullpoll logs0400; unhealthydeadlineSTOP; exitedunhealthyimmediateSTOP+record; missinghealthSTOP; healthyHTTPfailureSTOP; fullHTTP600s overrunSTOP; changedstoppedstateSTOP; exacthealth/Composepin/limits/mount/inputrechecks/science/policy/authority/copybudget/mount/name/WAL negatives. The171 predecessor cases are carried with two obsolete immediate-unhealthy expectations replaced by actual direction and four additional cases. Their original054 bytes/evidence remain unchanged.

The final receipt remains FORWARD_TWO_JOBS_OFF_STARTUPS_PASS_FROM_BOUND_INSTALLED209_NOT_RELEASE_QUALIFIED. JobsON natural intake/broaderpostflights/exactkitreview/freshsingleusegate remain later. Eventual kit MUSTshow actual firsthealthy/unhealthy timing and expected downtime; transient unhealthy is not rollback authority. No app change/release qualification inferred.

YY list1f871bbc dependencies reviewed byClaudio; groupa5roots3.979GB offered toYY with irreversible raw-byte loss/plain groupb26not offered. ExactYYcleanup choice remains unobserved/unanswered byagent.070000080000qualifiedB5/currentproofinputs excluded. No deletion/move/prune; independent source work.

## Exact twelve source hashes

```
'''
doc+='\n'.join(n+'='+r['sha256'] for n,r in index['files'].items())+'\n```\n'
with (S/'SOURCE_REVIEW.md').open('x',encoding='utf8') as f:f.write(doc)
with (S/'publisher-preparation-refusal-transcription.json').open('x',encoding='utf8') as f:json.dump({'status':'TOOL_OUTPUT_TRANSCRIPTION_BEFORE_SHELL_OR_FILE_CREATION','error':'functions JavaScript SyntaxError: Unexpected string during initial publisher preparation','sourceUnchanged':True,'remoteOperations':0,'publisherExecutedAtThatRefusal':False},f)
lead='## 2026-10-15 COMPLETE NEW health-transition graph175 local+host / exact SourceReview next\n\nActual6188190365 implemented12file NEW WP/batch-proof-health-transitions-cde8-20261015/proposed100000rootUNCREATED/no operationalpackageunit.175local+175ACTUALhost3.9.23/all12compilehashunchanged/20realdd496777pins/unchanged054N24/30/tablec74e17c1/25percent/min0/3assets/AST. ExactpinnedCompose30s10s3start30s unchanged;unhealthyobservationallowed/everypoll0400UTCelapsedstatusFailingStreakFULLHealth.Log/transitions/timeToFirstHealthy/totalUnhealthy(labelledobservedpollintervals). Missingunknownhealth/exitedrestartingdeadOOM/configmismatch/deadline immediateSTOP. Healthy+full27NOOP0+26READY0+HTTP200200401 withinHARD600totalassertAFTERprobes/fullstoppedstate/inputrechecks mandatory. No oldinputSQL/206214209policyreplay/newproductioncopy/startretry/cleanup. Freshreference08:55:28T563326976/A5787648/free31946665984/required31768290414/slack178375570 REFERENCEONLY/freshlaunchergatesmandatory/nofitSTOP. NEXTONEnewexactall12hashreview/nativehandoff;NEWSourcePASSbeforeANYoperator.090000aa7a695rawFAILEDimmutable/080000dd496777acceptedinstall11242only/NORMALhealthyunchanged. YYlist1f871bbcgroupa5roots3.979GB dependenciesreviewedCl/offeredYY/rawlossplain/cardUNANSWEREDbyagent/no deletionapprovalobserved/groupb26NOT offered. AllYYpins/science/retentionfloorlogs500MB/memory805blankheapSwap0/readiness600unit5400headroom60+600/gate600/forwardonlyno103humanhistoryguards hold. NOT_RELEASE_QUALIFIED/jobsONpostflights/exactkitfreshgate later. Samewriterbranch/noagents/newchat/worktree/checkout/concurrentwriter/broadstage/resetclean/unrelateddirt.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
helpers=['prepare-health-transition-source-successor-once.py','verify-health-transition-source-local-host-once.py','read-health-transition-reference-stat-once.py'];fixed=[pathlib.Path(__file__),*[REPO/'WP/backlog-resume-20261013'/n for n in helpers],readme]
paths=sorted(p for p in S.rglob('*') if p.is_file())+fixed;require(all(p.suffix not in ['.db','.sqlite','.pyc'] for p in paths),'No DB/bytecode publication')
out=S/'source-publication-index.json';require(not out.exists(),'Consumed publisher')
with out.open('xb') as f:f.write(canonical({'status':'COMPLETE_HEALTH_TRANSITION_SOURCE175_READY_FOR_NEW_EXACT_REVIEW_NOT_APPROVED','sourceStaticIndex':index,'budgetTableSha256':TABLE_SHA,'referenceCapacity':assessment,'operatorExecutions':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--pathspec-from-file=-','--pathspec-file-nul',payload=b'\0'.join(n.encode() for n in rels)+b'\0');require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
def verify(head):
 entries={}
 for row in cmd('git','ls-tree','-r','-z',head,'--',S.relative_to(REPO).as_posix(),*[p.relative_to(REPO).as_posix() for p in fixed]).split(b'\0'):
  if not row:continue
  meta,name=row.split(b'\t');mode,kind,oid=meta.decode().split();require(kind=='blob' and mode in ['100644','100755'],'Raw regular blob required');entries[name.decode()]=oid
 require(set(entries)==set(rels),'Raw inventory differs');oids=[entries[n] for n in rels];data=cmd('git','cat-file','--batch',payload=('\n'.join(oids)+'\n').encode());at=0
 for p,oid in zip(paths,oids):
  end=data.index(b'\n',at);returned,kind,length=data[at:end].decode().split();size=int(length);b=data[end+1:end+1+size];require(returned==oid and kind=='blob' and hashlib.sha1(('blob '+str(size)+'\0').encode()+b).hexdigest()==oid and b==p.read_bytes(),'Independent raw differs');require(data[end+1+size:end+2+size]==b'\n','Batch delimiter');at=end+2+size
 require(at==len(data),'Trailing batch')
verify(cmd('git','write-tree').decode().strip());cmd('git','commit','-m','Publish complete production-health transition source and175 guards');head=cmd('git','rev-parse','HEAD').decode().strip();verify(head)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'COMPLETE_NEW_HEALTH_TRANSITION_SOURCE175_PUBLISHED_NOT_APPROVED','head':head,'rawVerifiedBlobs':len(paths),'operators':0}))
