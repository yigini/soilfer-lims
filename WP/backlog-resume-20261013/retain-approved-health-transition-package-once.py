"""Seal the exact newly approved local package evidence before one launcher."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-health-transitions-cde8-20261015';BASE='f671adccdc216c1a9d99a38e780ee96e710943bf'
sys.path.insert(0,str(S));from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
P=S/('proof-package-'+ROOT_NAME);spec=exact_json((P/'proof-input.json').read_bytes());index=exact_json((P/'tooling-source-index.json').read_bytes());review=exact_json((P/'source-review-original.json').read_bytes());approval(review,index)
require(review['id']==6188457144 and index['head']=='a748b9dc5d3e5309fe3ef2b5cf4a6c5e7d796ef2' and len(list(P.iterdir()))==40 and spec['root']==str(ROOT),'Package identity/count differs')
for n,h in spec['packageHashes'].items():require(sha((P/n).read_bytes())==h,'Package bytes differ')
lead='## 2026-10-15 ONE approveda748b9dc/6188457144 local100000package retained / notlaunched\n\nActualNEWall12hash/literalSourcePASS6188457144/09:03:11/fullGH+completednativeREAD/owncurrentmainCI3audits/nolaterfailure validated+10rawf671adcc. ONEapprovedlocal40filepackage preparedbyfrozena748b9dc graph/allhashesindependentrawverified. New100000rootunit stillUNCREATED. NEXTONEapprovedlauncherONLYafterfreshmetadata-capacityBEFOREROOT+immediatelyBEFOREunit/currentauthority/unusedrootunit. UnknownoutcomeinspectSAME/no redispatch;nofitSTOPretainall/nocleanup. TWOnewordinaryjobsOFFstartsONLY/NOT_RELEASE_QUALIFIED/noinstallerspolicyimpactreplay/newproductionsnapshot/oldSQL/cleanup. ExactComposehealthunchanged/unhealthyobservable/everypoll0400fullHealth.Log/timing/HARD600afterHTTP/full27NOOP0+26READY0/HTTP200200401/stoppedequality/inputrechecks/N24/30/25percentmin0/3assets/allYYpinsretentionfloorlogs500MB/memory805blankheapSwap0/readinessheadroom/forwardonlyno103humanhistoryguards hold. YYreviewedgroupa5roots3.979GBremovalcardUNANSWEREDbyagent/noYYapprovalobserved/nothingdeletedmovedpruned. No activeproofrunnerretainer. Samewriterbranch/noagents/newchat/worktree/checkout/concurrentwriter/broadstage/resetclean/unrelateddirt.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(P.iterdir())+sorted((S/'approved-package-execution-once').iterdir())+[REPO/'WP/backlog-resume-20261013/execute-reviewed-health-transition-package-once.py',pathlib.Path(__file__),readme];out=S/'approved-startup-forward-package-index.json';require(not out.exists(),'Consumed package retainer')
with out.open('xb') as f:f.write(canonical({'status':'ONE_APPROVED_LOCAL_STARTUP_PACKAGE_NOT_LAUNCHED','sourceHead':index['head'],'sourcePass':review['id'],'packageFileCount':40,'root':str(ROOT),'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved40file startup-forward package before fresh gates');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'APPROVED40FILE_PACKAGE_RETAINED_NOT_LAUNCHED','head':head,'rawVerifiedBlobs':len(paths)}))
