"""Retain a later actual read-only opening without claiming terminal results."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';O=S/'second-r2-220000-readonly-observation-once';D=S/'second-r2-220000-opening-publication-once'
BASE='b8cbbf2f2dccc63214094106bc8942a55af845a3';INV='b9eb871451b04dbfb1cc666fe0b4ce83'
sys.path.insert(0,str(S));from r2_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'Same writer/base/one publication required')
v=json_exact((O/'stdout-original.json').read_bytes());p=dict(x.split('=',1) for x in v['systemctl']['stdout'].splitlines())
require(v['root']==ROOT and v['unit']==UNIT and p['ActiveState']=='active' and p['SubState']=='running' and p['InvocationID']==INV and p['MemoryMax']==str(MEMORY) and p['MemorySwapMax']=='0' and p['RuntimeMaxUSec']=='40min','Same active unit and limits required')
require(not any(n.startswith('terminal-') for n in v['selectedOriginalUtf8']),'Opening only; never mislabel terminal')
index=json_exact((S/'reviewed-r2-package-once/source-index.json').read_bytes())
for n,h in graph(index).items():require(sha((S/n).read_bytes())==h,'Source changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen count differs')
for n,h in frozen.items():require(sha((R/n).read_bytes())==h,'Frozen app input changed '+n)
D.mkdir()
record={'status':'ACTUAL_SAME_R2_UNIT_ACTIVE_LATER_OPENING_NOT_TERMINAL','observedUtc':v['observedUtc'],'root':ROOT,'unit':UNIT,'invocationId':INV,'actualProperties':p,'fileCount':len(v['fileMetadata']),'eventCount':v['eventCount'],'pruneIntentFilesObserved':v['pruneIntentFilesObserved'],'itemReceiptFilesObserved':v['itemReceiptFilesObserved'],'terminalResultClaimed':False,'cacheRemovalCountNotInferredFromMetadata':True,'retryAllowed':False,'all5And1333Unchanged':True}
with (D/'later-opening-record.json').open('xb') as f:f.write(canonical(record)+b'\n')
lead=f'''## 2026-10-15 same NEW R2 unit220000 later observation STILL ACTIVE, no terminal conclusion

Actualreadonly{v['observedUtc']} SAMEedfe/PASS6201838855/unit{INV} ACTIVE/running/MainPID{p['MainPID']}/MemoryMax805306368Swap0Runtime40min/current{p['MemoryCurrent']}peak{p['MemoryPeak']}. {len(v['fileMetadata'])}files/{v['eventCount']}events/{v['pruneIntentFilesObserved']}prune-intentfiles/{v['itemReceiptFilesObserved']}itemreceiptfiles observed, includingSKIPPED; no terminalreceipt/failure atthisopening. Metadata counts doNOTprove actualremovedIDs/reclaim/finalPASS. Full laterreadonlyraws at WP/r2-cache-api-identity-acc15844-20261015/second-r2-220000-opening-publication-once/publication-index.json. Full launch/opening65rawb8cbbf2f and approvedpackage43raw509fcd05/actualPASS30rawe271611f unchanged. Rootunitgraphpackagehelpers CONSUMED NEVERretryreplay. Nextreasonableinterval NEWuniqueREADONLYsameunit; actualCLOSEDretainALLoriginals/itemreceipts/commands/journals/all33packagehashes/qualifiedcd3a+ENTIREacc158inspect/ALLcontainerimageunorderedmountstopped-startpreservation/df thenindependentvalidation/publication+ONE@claude#162result. No duplicateACK/native/source request. All5+1333unchanged/stagedEMPTYafterpublication/heartbeat2min/mainmergeHOLD/newproofbudgetR4+10GB/sciencehistoryR1-R5/humans guards held. No productionDB/settings/restart/buildproofR1kitgatedeploy/no localrunnerretainerafterpublication.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for x in readmes:x.write_bytes(lead.encode()+x.read_bytes())
paths=[x for folder in [O,D] for x in sorted(folder.iterdir()) if x.is_file()]+[R/'WP/backlog-resume-20261013/observe-r2-api220000-second-readonly-once.py',pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json'
with idx.open('xb') as f:f.write(canonical({'baseAudit':BASE,'files':[{'path':x.relative_to(R).as_posix(),'length':len(x.read_bytes()),'sha256':sha(x.read_bytes()),'gitBlobOid':oid(x.read_bytes())} for x in paths]})+b'\n')
paths.append(idx);names=[x.relative_to(R).as_posix() for x in paths]
require(len(names)==len(set(names)),'Duplicate owned path')
git('-c','core.autocrlf=false','add','-f','--',*names);require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for x,n in zip(paths,names):require(git('show',tree+':'+n)==x.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(x.read_bytes()),'Raw staged identity differs')
git('commit','-m','Retain later active R2 observation without terminal claim');head=git('rev-parse','HEAD').decode().strip()
for x,n in zip(paths,names):require(git('show',head+':'+n)==x.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed head differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'observedUtc':v['observedUtc'],'actualState':'active/running','terminalResultClaimed':False}))
