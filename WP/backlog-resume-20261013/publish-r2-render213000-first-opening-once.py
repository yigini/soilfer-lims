"""Publish actual corrected R2 launch and first read-only opening; no host calls."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015';D=S/'first-r2-213000-opening-publication-once'
BASE='5442136b8fcc36ed57fb7d68c0f39874c665d8b9'
sys.path.insert(0,str(S));from r2_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
closed=json_exact((S/'execute-reviewed-launch6201434518-once/exit-original.json').read_bytes());require(closed['exitCode']==0 and closed['status']=='REVIEWED_R2_LAUNCHER_CLOSED_INSPECT_SAME_UNIT','Actual launcher closed success required')
observe=json_exact((S/'first-r2-213000-readonly-observation-once/stdout-original.json').read_bytes());props=dict(v.split('=',1) for v in observe['systemctl']['stdout'].splitlines())
require(observe['root']==ROOT and observe['unit']==UNIT and props['ActiveState']=='active' and props['SubState']=='running' and props['MemoryMax']==str(MEMORY) and props['MemorySwapMax']=='0' and props['RuntimeMaxUSec']=='40min' and props['InvocationID']=='48c3692ef7364f96a48bca020c6c9cff','Exact actual opening required')
require('terminal-receipt.json' not in observe['selectedOriginalUtf8'] and 'terminal-failure.json' not in observe['selectedOriginalUtf8'],'This publisher is opening only')
upload=json_exact((S/'launch-reviewed-r2-once/exclusive-root-upload-stdout.json').read_bytes());package={p.name:sha(p.read_bytes()) for p in (S/'reviewed-r2-package-once').iterdir() if p.is_file()};require(upload['fileSha256']==package,'Remote original package differs')
idx=json_exact((S/'reviewed-r2-package-once/source-index.json').read_bytes())
for n,h in graph(idx).items():require(sha((S/n).read_bytes())==h,'Source changed')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,h in frozen.items():require(sha((R/p).read_bytes())==h,'Frozen app input changed '+p)
D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
save('opening-record.json',canonical({'status':'ACTUAL_ONE_CORRECTED_R2_UNIT_ACTIVE_OPENING_NOT_TERMINAL','retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observedUtc':observe['observedUtc'],'root':ROOT,'unit':UNIT,'invocationId':props['InvocationID'],'actualOpeningProperties':props,'sourceHead':idx['head'],'sourceReviewId':6201434518,'approvedPackagePublication':BASE,'all32RemotePackageHashesMatch':True,'fileCountAtOpening':len(observe['fileMetadata']),'eventCountAtOpening':observe['eventCount'],'cacheMutationCountAtOpeningNotYetObserved':True,'retryAllowed':False,'old210000GraphNeverReplayed':True,'ourHeartbeatMinutes':2,'claudioTimerUnchanged':True,'noDuplicateGitHubOrNativeAck':True,'all5SourceAnd1333AppInputsUnchanged':True,'next':'Observe same213000rootunit with new unique readonly helper; on actual closure retain full originals and publish one @claude #162 result; never retry'})+b'\n')
lead=f'''## 2026-10-15 ONE corrected R2 unit213000 ACTUALLY ACTIVE; two-minute timer fix applied

ONE exact4ecc/PASS6201434518/32filepackage5442136b reviewedlauncher CLOSED20:24:28.546576UTC exit0; freshsource/currentmainCI4audits6rules/no-later-failure/unusedrootunit/floor guards passed beforeROOT andbeforeUNIT. NEWroot{ROOT}/unit{UNIT} CONSUMED NEVERretryreplay. ActualreadonlyOPEN{observe['observedUtc']} invocation48c3692ef7364f96a48bca020c6c9cff ACTIVE/running/MemoryMax805306368Swap0Runtime40min/current52142080peak53919744 OPENONLY/43files10events/noterminalreceipt. ActiveResultsuccess/ExecMainStatus0 NOTterminalPASS; actualprunecount/outcome notyetobserved. Fulluploadedpackagehashes32match/launchscripts/raws/firstobservation at WP/r2-cache-cap-render-acc15844-20261015/first-r2-213000-opening-publication-once/publication-index.json. Old210000parsefailure remains0operations/consumed; newcorrected213000isONEseparatelyreviewedgraph, notR2retry. NEXTreasonableintervalobserveSAMErootunitNEWuniquehelper; unknowninspectneverredispatch. ActualCLOSEDretainALLraws/itemreceipts/journals/packagehashes/preservation/df/publish+ONE@claude#162result. No duplicateACK/native/source request. YYtimerfix sameheartbeatACTUAL2min duringactivebe837974release+postcheck thenrestore10min; Clreported10unchanged. No localrunnerretainerafterpublication/ONEremoteR2activeatopening. No proof/build/R1kitgatedeploy/productionDB/configrestart/mainmerge. All5+1333unchanged/sciencehistoryR1-R5/newproofbudgetR4+10GB/humans guards held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
folders=[S/'launch-reviewed-r2-once',S/'execute-reviewed-launch6201434518-once',S/'first-r2-213000-readonly-observation-once',D]
paths=[p for folder in folders for p in sorted(folder.iterdir()) if p.is_file()]+[R/'WP/backlog-resume-20261013/execute-r2-render-reviewed-launch6201434518-once.py',R/'WP/backlog-resume-20261013/observe-r2-render213000-first-readonly-once.py',pathlib.Path(__file__),*readmes]
names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned path')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':n,'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p,n in zip(paths,names)]})+b'\n');paths.append(D/'publication-index.json');names.append((D/'publication-index.json').relative_to(R).as_posix())
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Retain actual corrected R2 launch and opening limits');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published head differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'sourceReviewId':6201434518,'actualR2StateAtOpening':'active/running','invocationId':props['InvocationID'],'terminalResultClaimed':False,'ourHeartbeatMinutes':2}))
