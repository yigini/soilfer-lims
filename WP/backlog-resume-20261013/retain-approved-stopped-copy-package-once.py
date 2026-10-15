"""Seal and push one prepared approved package before any remote root/launch."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';BASE='617157de553a83dcbd8b0e6b8ad2ad5b4d6e8413'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from proof_files import file_state
from prepare_proof import raw_git,current_evidence
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer/empty staging')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
package=SOURCE/('proof-package-'+ROOT_NAME);spec=exact_json((package/'proof-input.json').read_bytes());index=exact_json((package/'tooling-source-index.json').read_bytes());review=exact_json((package/'source-review-original.json').read_bytes());approval(review,index)
require(review['id']==6182570134 and index['head']=='6a235c68ecf3a8ef8c405d49ff4d3f41bedabe38','Wrong exact approved source')
current_evidence(review,index)
for n,h in spec['packageHashes'].items():require(file_state(package/n)['sha256']==h,'Prepared raw package changed')
lead='''## 2026-10-15 approved6a stopped-copy package PREPARED, remote root still absent

Actual6aSourcePASS6182570134/01:52:36UTC replaces87dfauthority; fullraw/native/currentboundaries retained617157de. One approvedlocal prepare_proof.py6a/6182570134 completed01:57:02.918070UTC/exit0,17immutable package files at WP/batch-proof-cde8-20261015/proof-package-workflow-batch-stopped-copy-cde8c889-20261015T020000Z. All10sourcehashes/rawc03receipt/B5inspect/applicationmanifest/sourcePASS/freshall3appmainCI bound. No SSH/remote root/unit/copy/productionSQL/count/installer/entrypoint/proof yet. Preparer+wrapper consumedneverreplay; launcherUNUSED. Nextoneactualreviewedlauncher afterfreshimmediate allauthority/no-later-failure and unusedrootunit, observeSAMEunit only. JobsOFFupstreamscope only/notreleasequalified/jobsON+broadpostflights+exactkitfreshgate stillrequired. Allotherimmutablehistory/scientific/policy/YY/nonzeroSTOP/container/diskmemoryforwardonlyhuman103guards unchanged.

'''
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in package.iterdir() if p.is_file())+sorted(p for p in (SOURCE/'first-proof-020000-package-once').iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/execute-reviewed-stopped-copy-package-once.py',pathlib.Path(__file__),readme]
out=SOURCE/'first-proof-020000-prepared-package-index.json';require(not out.exists(),'Retainer consumed')
with out.open('xb') as f:f.write(canonical({'status':'APPROVED6A_PACKAGE_PREPARED_REMOTE_UNCREATED','sourceCommit':index['head'],'actualSourcePass':review['id'],'preparedClosedUtc':'2026-10-15T01:57:02.918070+00:00','remoteRootCreated':False,'productionCopies':0,'proofOperatorsExecuted':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one approved immutable stopped-copy proof package before remote launch');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'APPROVED_IMMUTABLE_PACKAGE_PUSHED_REMOTE_UNCREATED','head':head,'verifiedOwnedBlobs':len(paths),'actualSourcePass':review['id'],'productionCopies':0}))
