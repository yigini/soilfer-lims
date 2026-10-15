"""Retain the one approved060000 local package before any remote root or unit."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-name-inventory-cde8-20261015';BASE='e064ad8229f3df70dec6fa4562177a590660b31b'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_files import file_state
from prepare_proof import raw_git,current_evidence
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer/empty staging')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
package=SOURCE/('proof-package-'+ROOT_NAME);spec=exact_json((package/'proof-input.json').read_bytes());index=exact_json((package/'tooling-source-index.json').read_bytes());review=exact_json((package/'source-review-original.json').read_bytes());approval(review,index)
require(review['id']==6184203154 and index['head']=='624aab7b9219bc7b9986396ce63915c91ad80502','Wrong approved graph')
current_evidence(review,index)
for n,h in spec['packageHashes'].items():require(file_state(package/n)['sha256']==h,'Prepared raw package changed')
boundary=SOURCE/'first-proof-060000-package-once';closed=exact_json((boundary/'exit-original.json').read_bytes());require(closed['exitCode']==0,'Preparation did not pass')
lead='## 2026-10-15 approved624a local060000 package prepared / remote stilluncreated\n\nActual624aSourcePASS6184203154/04:10:07UTC retained8raw e064ad8229f3df70dec6fa4562177a590660b31b. ONE approvedprepare_proof.py624a/6184203154 completed'+closed['closedUtc']+'/exit0;18immutablepackagefiles at WP/batch-proof-name-inventory-cde8-20261015/proof-package-workflow-batch-stopped-copy-cde8c889-20261015T060000Z. All11sourcehashes/c03originalreceipt/B5inspect/applicationmanifest/newSourcePASS/fresh3appmainCI bound; structuralnameinventory/rawIDretention/N52/65/tablea009. No SSH/root/unit/copy/SQL/count/installer/entrypoint/proof yet. Preparer+wrapper consumed; launcherUNUSED. Next ONEreviewedlaunch afterfreshauthority/nolaterfailure/unusedrootunit/capacityBEFOREROOT+immediatelybeforeunit. UpstreamjobsOFFscopeONLY/notreleasequalified; jobsONbroadpostflights/exactkit/freshgate later. Allimmutablehistory/sciencepolicy/YYnonzeroapprovedSTOP/allocations/memoryreadiness/allstoppedcontainers/forwardonly/no103/humanguards remain.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in package.iterdir() if p.is_file())+sorted(p for p in boundary.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/execute-reviewed-name-inventory-package-once.py',pathlib.Path(__file__),readme]
out=SOURCE/'first-proof-060000-prepared-package-index.json';require(not out.exists(),'Consumed package retainer')
with out.open('xb') as f:f.write(canonical({'status':'APPROVED624A_PACKAGE_PREPARED_REMOTE_UNCREATED','sourceCommit':index['head'],'actualSourcePass':review['id'],'preparedClosedUtc':closed['closedUtc'],'remoteRootCreated':False,'productionCopies':0,'proofOperatorsExecuted':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved structural-name stopped-copy package before remote launch');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'APPROVED_IMMUTABLE_PACKAGE_PUSHED_REMOTE_UNCREATED','head':head,'verifiedOwnedBlobs':len(paths),'actualSourcePass':review['id'],'productionCopies':0}))
