"""Seal the exact newly approved local package evidence before one launcher."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-startup-forward-cde8-20261015';BASE='858efc75c51312c24f9448e4f5cfe1e32b6aa19e'
sys.path.insert(0,str(S));from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
P=S/('proof-package-'+ROOT_NAME);spec=exact_json((P/'proof-input.json').read_bytes());index=exact_json((P/'tooling-source-index.json').read_bytes());review=exact_json((P/'source-review-original.json').read_bytes());approval(review,index)
require(review['id']==6187743927 and index['head']=='0541865b67af0fbf3232d7cb077ab505896a2ced' and len(list(P.iterdir()))==40 and spec['root']==str(ROOT),'Package identity/count differs')
for n,h in spec['packageHashes'].items():require(sha((P/n).read_bytes())==h,'Package bytes differ')
lead='## 2026-10-15 ONE approved0541865b/6187743927 local090000package retained / notlaunched\n\nActualNEWall12hash/literalSourcePASS6187743927/08:21:47/fullGH+nativeREAD/owncurrentmainCI3audits/nolaterfailure validated+9raw858efc75. ONEapprovedlocal40filepackage preparedbycurrentfrozen0541865b graph;allhashesindependentrawverified. New090000startup-forwardrootunit stillUNCREATED. NEXTONEapprovedlauncher onlyafterfreshmetadata-capacityBEFOREROOTandimmediatelyBEFOREunit/currentauthority/unusedrootunit. UnknownoutcomeinspectSAME/no redispatch. TWOnewjobsOFFstartsonly/NOT_RELEASE_QUALIFIED/noinstallerspolicyreplay/newproductionsnapshot/cleanup. All20inputpins/installed209rawreaderbackupstate/070000assets/inputrechecks/healthderivedCompose/exactprestart/unhealthyimmediate/600s27NOOP0READY26HTTP200200401/stoppedstate/24copies30equiv25percentmin0/3assets/allretentionfloorlogs500MB/memory805blankheapSwap0/readinessheadroom/forwardonlyno103humanhistoryguardshold. No newrootoperatorattemptbythisretainer. IndependentYYlist-only6187300253candidatecapture31rootscompleted08:23:13/noactiveprocessmountrefs/0deletions,derivationpending;doesnotauthorizecleanup. Samewriter/worktree/branch/noagents/newchat/checkout/concurrentwriter/broadstage/resetclean/unrelateddirt.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(P.iterdir())+sorted((S/'approved-package-execution-once').iterdir())+[REPO/'WP/backlog-resume-20261013/execute-reviewed-startup-forward-package-once.py',pathlib.Path(__file__),readme];out=S/'approved-startup-forward-package-index.json';require(not out.exists(),'Consumed package retainer')
with out.open('xb') as f:f.write(canonical({'status':'ONE_APPROVED_LOCAL_STARTUP_PACKAGE_NOT_LAUNCHED','sourceHead':index['head'],'sourcePass':review['id'],'packageFileCount':40,'root':str(ROOT),'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved40file startup-forward package before fresh gates');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'APPROVED40FILE_PACKAGE_RETAINED_NOT_LAUNCHED','head':head,'rawVerifiedBlobs':len(paths)}))
