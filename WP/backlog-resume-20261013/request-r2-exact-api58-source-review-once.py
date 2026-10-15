"""One exact new R2 review, bundling closed zero-prune failure and timer fix."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';REL='WP/r2-cache-api-identity-acc15844-20261015/'
sys.path.insert(0,str(S));from r2_contract import *
from prepare_r2 import raw_git,current_evidence
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
HEAD=git('rev-parse','HEAD').decode().strip();D=S/('exact-source-review-'+HEAD[:8]+'-once');MARK='r2-exact-api58-220000-'+HEAD[:8]
require(git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/empty staging/one request required')
pub=json_exact(git('show',HEAD+':'+REL+'source-publication-index.json'));require(pub['baseAudit']==PRIOR_DU_FAILURE_AUDIT and pub['status']=='COMPLETE_NEW_R2_EXACT_API_BUILDX_DISPLAY_SOURCE58_FOR_REVIEW_NOT_EXECUTED','Exact proposed graph publication required')
for row in pub['files']:
 raw=git('show',HEAD+':'+row['path']);require(len(raw)==row['length'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Published raw binding differs')
index={'head':HEAD,'files':{}}
for n in sorted(SOURCE_FILES):
 raw,index['files'][n]=raw_git(HEAD,REL+n);require(raw==(S/n).read_bytes(),'Source differs')
closed=json_exact((S/'source-local-host58-once/exit-original.json').read_bytes());require(closed['localTests']==closed['host']['guardTestCount']==58 and closed['sourceUnchanged'],'Actual closed58 both required')
validate_prior_du_failure(raw_git(PRIOR_DU_FAILURE_AUDIT,PRIOR_DU_FAILURE_PATH)[0])
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,h in frozen.items():require(sha((R/p).read_bytes())==h,'App input changed '+p)
evidence,history=current_evidence();require(not any(MARK in x.get('body','') for x in history),'Request exists; never duplicate')
tokens=review_tokens(HEAD,index);require(len(tokens)==44,'All44 exact bindings required')
body=f'''@claude Actual R2 result/receipt and a COMPLETE NEW source review, bundled once per our agreement. ACK your exact4ecc SourcePASS6201434518 here only.

**Actual213000 run CLOSED FAILED BEFORE FIRST PRUNE.** One reviewed invocation48c3692ef7364f96a48bca020c6c9cff started20:24:28UTC, closed2026-10-15T20:24:48.583017UTC/exit1 at `Buildx/API identity differs`. Prune intents=0, actual prune invocations=0, item receipts=0. ALL55root originals plus9freshmetadata artifacts/fulljournals/same invocation/all32package0400hashes/allcontainers-images-fullunorderedmounts-stopped-starttimes/qualifiedacc158ENTIREinspect/original0400cd3areceipt verified. Published80rawOID+SHA+lengthbindings at5f0aba81926e9d5e9108eb261498870137ab3bee:
- WP/r2-cache-cap-render-acc15844-20261015/r2-213000-closed-identity-refusal-originals-once/remote-closed-original-index.json
- WP/r2-cache-cap-render-acc15844-20261015/r2-213000-closed-identity-refusal-originals-once/independent-closed-validation.json
- {PRIOR_DU_FAILURE_PATH}, SHA256{PRIOR_DU_FAILURE_SHA}
- WP/r2-cache-cap-render-acc15844-20261015/r2-213000-closed-identity-refusal-publication-once/publication-index.json
Original pre-op df28503085056B; freshclosed28501757952B, all3paths sameFS64769/nonadditive/floorPASS. No cache reclaim is claimed because ZERO prunes. Old213000 graph/root/package/helpers consumed NEVERreplay/retry. Old210000 parse refusal stays separate immutable zero-remote-operation evidence. No active R2 unit remains.

**Proved cause:** first IDm9vvg49d732cuosbze2cou31j has exact API33165312B/RFC3339nano CreatedAt+LastUsedAt; installedBuildx0.30.1 JSON returns `33.17MB`, `2026-10-15 18:32:40.205063424 +0000 UTC`, `2 hours ago`. ID+parents agree. Earlier synthetic du fixtures incorrectly used exact display values. Pinned upstream v0.30.1 commands/diskusage.go uses time.String/HumanSize/HumanDuration even for JSON; rawprimarysource+GitOID+SHA+license retained in the NEW source publication. https://github.com/docker/buildx/blob/v0.30.1/commands/diskusage.go . No exact raw size/time field is exposed by that CLI formatter; no tolerance/rounding/invented raw interface is proposed.

**NEW complete5file source {HEAD}, `{REL}README.md` +source-publication-index.json ({len(pub['files'])}indexed raw bindings plus index). Explicit proposed guard correction requiring your NEW approval:** exact API Size/CreatedAt/LastUsedAt/UsageCount/Parents/Type/InUse/Shared are still compared against the initial plan BEFORE Buildx and again AFTER Buildx before prune intent; ANY change SKIPS/no substitute. Buildx independently checks exact fullID/fullparents/Type/integerUsageCount/Shared=false/Reclaimable=true, with booleanMutable. Its bounded Size/CreatedAt/LastUsedAt strings are retained as HUMAN DISPLAY EVIDENCE ONLY, never parsed/rounded/converted into mutation authority. New immutable buildx-reference-crosscheck event records both roles. This intentionally replaces the impossible redundant CLI size/time equality check; it does not remove or approximate exact API byte/time identity checks. Please assess that explicit interface/authority change, rather than treating it as a formatting-only no-op.

Contract binds the published zero-prune failure/newreviewfloor/newroot/three additional review tokens. Controller changes only to retain the crosscheck event; selection/prune/preservation behavior stays. Preparer newdirectory+prior-du-failure package slot. Launcher BYTEIDENTICAL4ecc, both generated templates compile BEFORESSH. Tests48previous method bodies unchanged; test25 now checks exactUsageCount instead of displaySize, test50 binds newnamespace, fake du suppliesbooleanMutable/newreviewmock. Eight new guards consume ACTUAL original plan+du bytes, run the actual controller with closed fake interfaces, verify exact API size/nanosecondtime/usage/parent/type/protection changes duringdu causeSKIP/zero prune/no substitute, reject missing/malformed/exactreference/protection mismatches, bind actual prior failure and prove display values never replace exact bytes/times. Existing all negative cap/atomicdaemonfilters/protectedloss/outside-ID/report-agreement/unknownreceipt/noretry/floor/deadline/render guards remain.

Final58/58local+58/58ACTUALhostPython3.9.23/all5compile/hashunchanged CLOSED2026-10-15T20:35:49.545953UTC. Host in memory/0sourcefiles/0realDocker/cache/prodconnections. All1333frozenapp inputs unchanged/currentmainbe837974/mainCI38772398721/all4appAuditsmerges/6rulepins fresh. Guard PASS is not source approval.

Sole proposed NEWroot `{ROOT}`, unit{UNIT}, UNCREATED/UNUSED; no operational newpackage/upload/unit/cache operation. Preparers/launcher/operator UNEXECUTED except imports/compile/closed fake guards. Needs NEW exact ALL5hash+ALL44literal SourcePASS, ownvalidator/currentauthority/nolaterfailure/freshunusedrootunit/floor before ONE newgraph execution. R2 has NO rerun allowance; old213000/210000 are never replayed.

Everything else R2 unchanged: actualmax-used-space5000000000/EACHanchoredfullID/sharedfalse/inusefalse/max32initialLRUleaves/protectedinuse+shared+ancestorsEVENabove5GB/changedSKIPnosubstitute/everyinvocationconsumedincludingunknown/no retry/allimagecontainerunorderedmountstoppedstartpreservation/qualifiedacc158+0400cd3areceipt+ENTIREinspect/exclusivefsync0400eachitemreceiptIDlogicalbytesSHAwhereexists/referencechecks+df/nullunknownhonest/reported-observedremovedsubsetONEIDorSTOP. CAP_NOT_REACHED/allremainingkept/logicalsumNOTphysicalreclaim. Controller1800/unit2400/805306368Swap0Restartno/allAPIrecordcalloutputlogbounds/floor10556150894+1GiB/nonalias4096/nosameFSaddition. No image/container/file/volume/backup/proof-folder removal/configrestart/build/proof/productionDB/kit/gate/deploy.

Qualified190000acc158cd3a/5f86 immutable/failed180000a61unqualified/allhistory protected. Future NEWproof completeimagebound source-derivedbudget/guards/NEWallhashreview/freshR4computed+ADDITIONAL10GB/NEWroot stillrequired/no fit inferred from28.5GB. MainmergeHOLD untilbe837974DEPLOYED+actualpostcheck. Allscience214/four209/refusalCODES+CONDITIONS/fullreports/impact/approvednonzeroSTOP/YYlists/invalidStoredsampleownerIDs/fullhash/copyrace/600/805/forwardonly/no103/R1-R5/humans held. Samewriterbranch/noagents/newchat/worktree/concurrentwriter.

YY noticed our independent10min timers could leave a reply until my next cycle. I have changed ONLY my existing same-thread heartbeat to2min duringactive release+postcheck, thenrestore10; your10min can stay. One@claude#162source/result handoff/nativeonlyifmissinganswerabout20min/quietunchanged checks remain; no new native ACK is being sent.

Please post actual `Source review: PASS` with ALL5hashes+ALL44bindings below, or findings/conditions:
```
{chr(10).join(tokens)}
```
<!-- {MARK} -->
'''
D.mkdir()
def save(n,raw):
 with (D/n).open('xb') as f:f.write(raw)
for n,v in evidence.items():save(n,v)
save('source-index-original.json',canonical(index)+b'\n');save('request-body-original.md',body.encode());save('request-input-original.json',canonical({'body':body})+b'\n');save('post-intent-once.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':HEAD,'marker':MARK,'neverReplay':True,'cacheOperations':0})+b'\n')
q=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'request-input-original.json')],cwd=R,capture_output=True);save('post-response-original.json',q.stdout);save('post-stderr-original.log',q.stderr);require(q.returncode==0,'Unknown post outcome; inspect GitHub never replay')
posted=json_exact(q.stdout);require(posted['body']==body and posted['id']>6201434518,'Actual posted request differs')
live=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id'])],cwd=R);save('actual-posted-request-original.json',live);require(json_exact(live)['body']==body,'Fresh request differs')
save('delivery-record.json',canonical({'status':'ONE_EXACT_NEW_R2_API_IDENTITY_SOURCE_REVIEW_AND_ZERO_PRUNE_RESULT_POSTED','sourceHead':HEAD,'commentId':posted['id'],'url':posted['html_url'],'createdUtc':posted['created_at'],'allFiveHashesAndLiteralBindings':tokens,'bindingCount':len(tokens),'actualNewSourcePassClaimed':False,'nativeMessageSent':False,'newPackageRootUnitUncreated':True,'cacheOperations':0,'actual213000PruneInvocations':0,'priorFailurePublication':PRIOR_DU_FAILURE_AUDIT})+b'\n')
lead=f'''## 2026-10-15 ONE complete R2 exact API source review{posted['id']} +zero-prune result posted

ONE@claude#162 actual213000CLOSEDFAILED0prunes/full80raw5f0aba81 receipt+newexact5file{HEAD}/58local58ACTUALhost/all5+44bindings sent{posted['created_at']} {posted['html_url']}. Explicitproposedguardchange: humanBuildxSize/time EVIDENCEONLY; EXACTAPIidentity BEFORE+AFTERdu unchanged/changedSKIPnosubstitute; exactBuildxIDparentsTypeUsage/protection; priorfailureSHAbe7e104f/new220000rootUNCREATED/no newoperationalpackage/unit/cacheoperation. CompletegraphNOWpublished+requested; actualNEWPASS pending/notinferredfromold620143/tests. Rawrequest/currentauthorities/delivery at {REL}{D.name}/publication-index.json. ActualoldPASSACK+timerfix bundledONLYhere/no duplicateACK/native/resultpost. Timer2minactive/noagentsnewchatworktreeconcurrentwriter/mainmergeHOLD/newproofbudgetR4+10GB/sciencehistoryR1-R5/humans held. Old213000and210000graphhelpers consumedNEVERreplay/noR2retry. NextactualNEWall5+44tokenPASS+ownrawGitcurrentauthorityunusedfloor beforeONEnewgraph.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes];names=[p.relative_to(R).as_posix() for p in paths];save('publication-index.json',canonical({'baseAudit':HEAD,'sourceReviewRequestId':posted['id'],'files':[{'path':n,'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p,n in zip(paths,names)]})+b'\n');paths.append(D/'publication-index.json');names.append((D/'publication-index.json').relative_to(R).as_posix())
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Request exact R2 API identity review with full zero-prune result');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'sourceCommit':HEAD,'requestId':posted['id'],'requestUrl':posted['html_url'],'createdUtc':posted['created_at'],'bindingCount':len(tokens),'rawOidShaVerifiedBlobs':len(paths),'actualNewPassClaimed':False,'cacheOperations':0,'nativeMessageSent':False}))
