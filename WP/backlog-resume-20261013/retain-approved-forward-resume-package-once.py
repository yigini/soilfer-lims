"""Retain the one approved local080000 package before the first remote launch."""
import json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015'
BASE='f12a51c5011709d8edc49523fcc937314986e9e2'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_files import file_state
from prepare_proof import raw_git,current_evidence
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
package=SOURCE/('proof-package-'+ROOT_NAME)
spec=exact_json((package/'proof-input.json').read_bytes());index=exact_json((package/'tooling-source-index.json').read_bytes());review=exact_json((package/'source-review-original.json').read_bytes())
approval(review,index);require(review['id']==6185240820 and index['head']=='b9af37993632ca10b56943ae894fc0a816b8efcc','Wrong approved graph')
current_evidence(review,index)
require(set(spec['packageHashes'])==FILES|set(PRIOR_FILES)|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json'},'Package graph differs')
require({p.name for p in package.iterdir()}==set(spec['packageHashes'])|{'proof-input.json'},'Expanded package')
for n,h in spec['packageHashes'].items():require(file_state(package/n)['sha256']==h,'Prepared raw package changed '+n)
boundary=SOURCE/'first-proof-080000-package-once';closed=exact_json((boundary/'exit-original.json').read_bytes());require(closed['exitCode']==0,'Preparation did not pass')
out=SOURCE/'first-proof-080000-prepared-package-index.json';require(not out.exists(),'Consumed package retainer')
lead='## 2026-10-15 approvedb9af local080000 package prepared / first remote launch pending\n\nActualSourcePASS6185240820/f12a51c5 permitsONEforward214209jobsOFFattempt. ONE b9af prepare_proof completed '+closed['closedUtc']+'/exit0; '+str(len(spec['packageHashes'])+1)+' immutablelocalpackagefiles include12source,22e283priorrawOIDrecords,6authority/buildmetadata andproof-input. Allhashes/newPASS/freshmainCI3audits/nolaterfailure validated. NoSSH/remoteROOT/unit/copy/SQL/installer/entrypoint/proof atthisretention. Preparer/wrapper consumed;launcherUNUSED. NextONEreviewedlaunch withfreshcapacityBEFOREROOT+beforeunit/controllerbind/currentauthority/unusedrootunit. Inputinstalled206RAWTRIPLEcopyONCE/no oldSQL/policy206replay/newproductionsnapshot; prior070000FAIL/e283/10840 remainsimmutable. Actual214209scientificlists/11242/startupsUNKNOWN. N44/55/25percent/min64droppedperCl/3assetreserve/floor10556150894/logs4GiB/500MB/physicaldu-x/remainingbudget/allretention. AllYYsciencepolicy/nonzeroYYapprovedSTOP/separateforwardremedy/memoryreadiness/forwardonly/no103/humanhistoryguards hold. NOT_RELEASE_QUALIFIED/jobsONnaturalintake+broadpostflights/exactkitfreshgate later.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in package.iterdir() if p.is_file())+sorted(p for p in boundary.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/execute-reviewed-forward-resume-package-once.py',pathlib.Path(__file__),readme]
with out.open('xb') as f:f.write(canonical({'status':'APPROVED_FORWARD_PACKAGE_PREPARED_REMOTE_UNCREATED','sourceCommit':index['head'],'actualSourcePass':review['id'],'preparedClosedUtc':closed['closedUtc'],'packageFiles':len(spec['packageHashes'])+1,'remoteRootCreated':False,'proofOperatorsExecuted':0,'productionCopies':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved forward-resume package before remote launch');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'APPROVED_FORWARD_PACKAGE_PUSHED_REMOTE_UNCREATED','head':head,'verifiedOwnedBlobs':len(paths),'actualSourcePass':review['id'],'packageFiles':len(spec['packageHashes'])+1,'productionCopies':0}))
