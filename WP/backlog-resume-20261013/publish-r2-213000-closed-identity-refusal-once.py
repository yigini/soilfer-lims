"""Publish full actual closed R2 identity refusal; no remote operator or retry."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015';C=S/'r2-213000-closed-identity-refusal-originals-once';D=S/'r2-213000-closed-identity-refusal-publication-once'
BASE='8634338456067cc0e4377c12f480fd91aebb1f43'
sys.path.insert(0,str(S));from r2_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'Same writer/base/one publication required')
v=json_exact((C/'independent-closed-validation.json').read_bytes());require(v['status']=='ACTUAL_R2_CLOSED_FAILED_BEFORE_FIRST_PRUNE_NO_RETRY' and v['actualPruneInvocations']==v['pruneIntentCount']==v['itemReceiptCount']==0 and v['all32PackageHashesAnd0400ModesVerified'] and v['freshClosedAllContainerAndImagePreservationEqual'],'Exact independent closed refusal required')
remote=json_exact((C/'remote-closed-original-index.json').read_bytes());require(remote['originalRootFileCount']==55 and len(remote['files'])==64,'Full actual root and fresh originals required')
for n,row in remote['files'].items():
 raw=(C/n).read_bytes();require(len(raw)==row['bytes'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Original retained bytes differ '+n)
idx=json_exact((S/'reviewed-r2-package-once/source-index.json').read_bytes())
for n,h in graph(idx).items():require(sha((S/n).read_bytes())==h,'Source changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,h in frozen.items():require(sha((R/p).read_bytes())==h,'App input changed '+p)
D.mkdir()
def save(n,raw):
 with (D/n).open('xb') as f:f.write(raw)
failure={'status':'ACTUAL_R2_CLOSED_FAILED_BEFORE_FIRST_PRUNE_NO_RETRY','closedUtc':v['closedUtc'],'root':ROOT,'unit':UNIT,'invocationId':v['actualInvocationId'],'sourceHead':idx['head'],'sourceReviewId':6201434518,'actualPruneInvocations':0,'pruneIntentCount':0,'itemReceiptCount':0,'all32PackageHashesVerified':True,'all55RootOriginalsRetained':True,'allOriginalAndFreshPreservationEqual':True,'qualifiedBuildReceiptSha256':BUILD_RECEIPT_SHA,'failure':'Buildx/API identity differs','causeProvedByOriginals':'Buildx v0.30.1 JSON emits human-formatted Size, CreatedAt and LastUsedAt; strict comparison with exact API fields refused','actualApiVsBuildxFields':v['actualApiVsBuildxFields'],'independentValidationSha256':sha((C/'independent-closed-validation.json').read_bytes()),'retryAllowed':False,'oldRootAndHelpersConsumedNeverReplay':True}
save('closed-identity-refusal.json',canonical(failure)+b'\n')
lead=f'''## 2026-10-15 R2 unit213000 CLOSED FAILED before first prune; full originals retained

Actual213000/4ecc/PASS6201434518 invocation48c3692ef7364f96a48bca020c6c9cff CLOSED{v['closedUtc']} exit1/Resultexit-code/MainPID0/Peak53919744Max805306368Swap0Runtime40min. ErrorBuildx/APIidentitydiffers BEFOREANYpruneintent/invocation/itemreceipt: ALLTHREE0. Firstm9vvg49d732cuosbze2cou31j API33165312B/CreatedRFC3339nano/LastRFC3339nano versusBuildxJSON33.17MB/Gotime.String/2hoursago; IDandparentsagree. RoundedhumanoutputsNEVERacceptedasinteger/exacttime. ALL55rootoriginals+9freshmetadataartifacts64raw/fulljournals/sameinvocation/all32package0400hashes/unchangedqualifiedcd3areceipt+ENTIREacc158inspect/ALLcontainerimageunorderedmountstopped-startpreservation verified. Fullrawretention at WP/r2-cache-cap-render-acc15844-20261015/r2-213000-closed-identity-refusal-originals-once/remote-closed-original-index.json and publication/index at newfolder/r2-213000-closed-identity-refusal-publication-once. Originaldf28503085056/freshclosed28501757952sameFS64769/notadditive/NOcache-reclaimcreditbecauseZEROprunes. Rootunitgraphpackagehelpers CONSUMED NEVERretryreplay; old210000failureimmutable0ops. NoactiveR2/localrunnerretainerafterpublication. NeedgenuinelyNEWcompleteexactinterfacecorrection/meaningfulactualformatter+APIraceguards/publish/NEWallhashClreview/freshunusedrootunitfloor beforeANYnewcacheoperation; no oldPASSeverauthorizesnewsource. ActualPASSACK/result/timerfix bundleONLYnextONE@claude#162meaningfulhandoff/no duplicateACK/native. Existingheartbeat2min/restores10afteractualbe837974deploy+postcheck; mainmergeHOLD/newproofbudgetR4+10GB/sciencehistoryR1-R5/humans guards held. No proof/build/R1kitgatedeploy/productionDB/settings/restart.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=[p for folder in [C,S/'second-r2-213000-readonly-observation-once',D] for p in sorted(folder.rglob('*')) if p.is_file()]+[R/'WP/backlog-resume-20261013/observe-r2-render213000-second-readonly-once.py',R/'WP/backlog-resume-20261013/retain-r2-render213000-closed-identity-refusal-once.py',pathlib.Path(__file__),*readmes]
names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned path');save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':n,'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p,n in zip(paths,names)]})+b'\n');paths.append(D/'publication-index.json');names.append((D/'publication-index.json').relative_to(R).as_posix())
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain full R2 identity refusal before any prune');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'failureRecordSha256':sha((D/'closed-identity-refusal.json').read_bytes()),'actualPruneInvocations':0,'originalRootFiles':55,'retainedRemoteArtifacts':64,'retryAllowed':False}))
