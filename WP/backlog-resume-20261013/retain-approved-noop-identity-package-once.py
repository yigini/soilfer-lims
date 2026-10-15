"""Seal and push one prepared approved package before any remote root/launch."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-noop-identity-cde8-20261015';BASE='788ff75416fef3039315c280c7db61faca5d711c'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_files import file_state
from prepare_proof import raw_git,current_evidence
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer/empty staging')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
package=SOURCE/('proof-package-'+ROOT_NAME);spec=exact_json((package/'proof-input.json').read_bytes());index=exact_json((package/'tooling-source-index.json').read_bytes());review=exact_json((package/'source-review-original.json').read_bytes());approval(review,index)
require(review['id']==6183890910 and index['head']=='09d7e537d90bc8ed17e9d162fd6868a7c34a8e15','Wrong exact approved source')
current_evidence(review,index)
for n,h in spec['packageHashes'].items():require(file_state(package/n)['sha256']==h,'Prepared raw package changed')
lead='## 2026-10-15 approved09d7 local050000 package prepared / remote stilluncreated\n\nActual09d7SourcePASS6183890910/03:43:03UTC retained788ff754. One actualapprovedprepare_proof.py09d7/6183890910 completed03:44:57.368855UTC/exit0;18immutablepackagefiles at WP/batch-proof-noop-identity-cde8-20261015/proof-package-workflow-batch-stopped-copy-cde8c889-20261015T050000Z. All11sourcehashes/c03originalreceipt/B5inspect/applicationmanifest/newSourcePASS/freshall3appmainCI bound; N52/65/25percent/tablea009b22c/newidentityguards. No SSH/root/unit/copy/SQL/count/installer/entrypoint/proof yet. Preparer+wrapper consumed; launcherUNUSED. Next ONEreviewedlaunch afterfreshauthority/nolaterfailure/unusedrootunit/capacitybeforeROOT+immediatelybeforeunit. UpstreamjobsOFFscopeONLY/notreleasequalified; jobsONbroadpostflights/exactkit/freshgate later. Allotherimmutablehistory/sciencepolicy/YYnonzeroapprovedSTOP/allocations/memoryreadiness/allstoppedcontainers/forwardonly/no103/humanguards remain.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in package.iterdir() if p.is_file())+sorted(p for p in (SOURCE/'first-proof-050000-package-once').iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/execute-reviewed-noop-identity-package-once.py',pathlib.Path(__file__),readme]
out=SOURCE/'first-proof-050000-prepared-package-index.json';require(not out.exists(),'Retainer consumed')
with out.open('xb') as f:f.write(canonical({'status':'APPROVED09D7_PACKAGE_PREPARED_REMOTE_UNCREATED','sourceCommit':index['head'],'actualSourcePass':review['id'],'preparedClosedUtc':'2026-10-15T03:44:57.368855+00:00','remoteRootCreated':False,'productionCopies':0,'proofOperatorsExecuted':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved immutable stopped-copy proof package before remote launch');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'APPROVED_IMMUTABLE_PACKAGE_PUSHED_REMOTE_UNCREATED','head':head,'verifiedOwnedBlobs':len(paths),'actualSourcePass':review['id'],'productionCopies':0}))
