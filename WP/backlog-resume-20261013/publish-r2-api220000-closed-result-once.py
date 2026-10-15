"""Publish complete R2 originals and independent cap-not-reached result; no host calls."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';C=S/'r2-220000-closed-originals-once';D=S/'r2-220000-closed-publication-once'
BASE='01a9f90c9f3e9dd1f0fc38d19c038efad05fe794'
sys.path.insert(0,str(S));from r2_contract import *
from prepare_r2 import current_evidence,gh
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'Same writer/base/one publication required')
v=json_exact((C/'independent-closed-validation.json').read_bytes());require(v['status']=='ACTUAL_R2_CLOSED_CAP_NOT_REACHED_ZERO_REMOVED_NO_RETRY' and v['actualPruneInvocations']==2 and v['itemReceiptCount']==32 and v['removedIdCount']==0 and v['all33PackageHashesAnd0400ModesVerified'] and v['allOriginalAndFreshContainerImagePreservationEqual'] and v['fullUnabridgedSameInvocationJournalAndControllerStdoutVerified'],'Complete independently verified actual closed result required')
remote=json_exact((C/'remote-closed-original-index.json').read_bytes())
for n,row in remote['files'].items():
    raw=(C/n).read_bytes();require(len(raw)==row['bytes'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Retained original identity differs '+n)
fullj=json_exact((C/'fresh-journal-all-once/full-journal-read-index.json').read_bytes())
for n,row in fullj['files'].items():
    raw=(C/'fresh-journal-all-once'/n).read_bytes();require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Full journal bytes differ')
idx=json_exact((S/'reviewed-r2-package-once/source-index.json').read_bytes());review=json_exact((S/'reviewed-r2-package-once/source-review.json').read_bytes())
for n,h in graph(idx).items():require(sha((S/n).read_bytes())==h,'Source changed')
freshreview=gh('repos/yigini/soilfer-lims/issues/comments/6201838855');require(canonical(json_exact(freshreview))==canonical(review),'Actual review edited')
evidence,history=current_evidence();no_later_source_failure(history,review,idx['head'])
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen count differs')
for p,h in frozen.items():require(sha((R/p).read_bytes())==h,'App input changed '+p)
D.mkdir()
def save(n,raw):
    p=D/n;p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
for n,raw in evidence.items():save('fresh-authorities/'+n,raw)
save('fresh-authorities/actual-source-pass-original.json',freshreview)
result={**v,'terminalReceiptSha256':sha((C/'terminal-receipt.json').read_bytes()),'independentValidationSha256':sha((C/'independent-closed-validation.json').read_bytes()),'all159RootOriginalsAnd168InitialRetentionArtifactsVerified':True,'additionalFullUnabridgedJournalArtifacts':2,'all5And1333Unchanged':True,'freshMainCiFourAuditsSixRulesNoLaterFailureVerified':True,'oldAndCurrentR2GraphsConsumedNeverReplay':True,'localValidatorJournalNullRefusalRetainedHonestly':True,'productionSettingsChanges':0,'productionRestarts':0}
save('closed-r2-result.json',canonical(result)+b'\n')
lead=f'''## 2026-10-15 R2 unit220000 CLOSED; two consumed prunes removed ZERO; cap not reached

Actualedfe/PASS6201838855/SAMEinvocationb9eb871451b04dbfb1cc666fe0b4ce83 CLOSED{v['closedUtc']}; originalterminal R2_CAP_NOT_REACHED_ALL_REMAINING_RECORDS_RETAINED_NO_RETRY. TWO exactanchoredIDprunecommands exit0/EMPTYstderr/eachoriginalstdoutTotal0B, 2NOT_REMOVED+30SKIPPED Childstillreferencesthisrecord,32fullitemreceipts/removedIDs0. ALLinitialcacherecordsexactlyUNCHANGED/logical8072154134B/protected5577243796B stillkeptEVENabove5GB. NOreclaimcredit/noadditionalprune/noR2retry. Originaldf28496744448->28470984704B/freshclosed28467814400B SAMEFS64769/nonadditive; declineNOTcache-reclaim. ALL159rootoriginals/168initialartifacts/ALL124events/all33package0400hashes/extra2FULL--alljournaloriginals/qualifiedoriginal0400cd3areceipt+ENTIREacc158inspect/ALLcontainerimageunorderedmountstopped-startpreservation independentlyverified. Full originals/index/validation at WP/r2-cache-api-identity-acc15844-20261015/r2-220000-closed-originals-once; exactresult/publication-index at r2-220000-closed-publication-once. Activeopening805306368Swap0/40min measuredseparately; closedtransientGCnot-found/infinity/sentinel areNOTexecutedlimits/measuredpeak. FirstlocalvalidatorTypeErroronjournalctlMESSAGE:null retainedhonestly; originalnull-bearingrawunchanged, NEWread-only--alljournalandNEWcompletevalidatorverifiedfullcontrollerstdout; no controllerfailure/replay. NOactiveunit/localrunnerretainerafterpublication; rootunitgraphpackagehelpers CONSUMED NEVERretryreplay. NextONE@claude#162result+actualNEWPASSACKONLYthere/no duplicateACK/native/request, thenACTUALLYimplementCOMPLETE NEWacc158cd3a-boundproofgraph/source-derivedALLcopybudget/meaningfullocalhostguards/publish/NEWexactallhashClPASS/freshR4COMPUTED+ADDITIONAL10GBbeforeEACHbuildproof/NEWroot; nofitSTOPqualifiedR1options/notinferfitfrom28.4GB/old42GBcard. All5+1333unchanged/freshmainCI4audits6rules/nolaterfailure/mainmergeHOLD/heartbeat2min/sciencehistoryR1-R5/humans guards held. No productionDB/settings/restart/buildproofR1kitgatedeploy.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
helpers=['observe-r2-api220000-third-readonly-once.py','observe-r2-api220000-fourth-readonly-once.py','retain-r2-api220000-closed-originals-once.py','validate-r2-api220000-closed-originals-once.py','retain-r2-api220000-full-journal-all-once.py','validate-r2-api220000-complete-journal-once.py','execute-r2-api220000-complete-validation-once.py']
paths=[p for folder in [C,S/'third-r2-220000-readonly-observation-once',S/'fourth-r2-220000-readonly-observation-once',D] for p in sorted(folder.rglob('*')) if p.is_file()]+[R/'WP/backlog-resume-20261013'/n for n in helpers]+[pathlib.Path(__file__),*readmes]
names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned path')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':n,'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p,n in zip(paths,names)]})+b'\n');paths.append(D/'publication-index.json');names.append((D/'publication-index.json').relative_to(R).as_posix())
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Publish full R2 closed zero-removal cap-not-reached result');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'closedResultSha256':sha((D/'closed-r2-result.json').read_bytes()),'actualPruneInvocations':2,'itemReceipts':32,'removedIds':0,'capReached':False,'retryAllowed':False}))
