"""Publish corrected predipatch controller and all original synthetic guard evidence. No operator."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';BASE='8c0039be170c01c5cb5b77ff4286ef74db1be8e0'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer, empty stage required')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote audit moved')
proof=exact_json((SOURCE/'source-local-host-verification-preflight-stop-short-once/exit-original.json').read_bytes());require(proof['localTests']==proof['actualHostTests']==44 and proof['sourceUnchanged'],'Fresh corrected44 guard proof required')
for n,h in proof['sourceSha256After'].items():require(sha((SOURCE/n).read_bytes())==h,'Source changed since44 proof')
failed=SOURCE/'source-local-host-verification-preflight-stop-once';log=(failed/'local-stderr-original.log').read_bytes();require(b'Ran 44 tests' in log and b'FAILED (errors=1)' in log and b'FileNotFoundError' in log,'Original failed fixture evidence missing')
with (failed/'terminal-index.json').open('xb') as f:f.write(canonical({'status':'LOCAL44_43PASS_1_WINDOWS_PATH_OUTPUT_ERROR_HOST_NOT_RUN','rootCause':'Retained mock-owned-stop output path264 characters exceeded Windows path handling; stop mock itself already completed. Corrected only NEW fixture directory names to short hash IDs.','originalSourceSha256':exact_json((failed/'command-original.json').read_bytes())['sourceSha256Before'],'localTests':44,'hostTests':None,'productionCopies':0,'productionConnections':0,'sourceOperatorsRun':0,'neverReplay':True})+b'\n')
docs=SOURCE/'SOURCE_REVIEW.md'
intro='''# Controller successor after pre-dispatch safety corrections

The approved predecessor87df / actual SourcePASS6182389127 remains immutable and **UNEXECUTED**. Before creating any package/root or collecting production bytes, I found and corrected two controller errors: policy preflight had called `--apply`, so ABSENT policy storage on a copy could receive DDL before the gate refused; and `Docker.stop` used the ordinary command adapter whose failed reserve/headroom checks could obstruct an emergency owned stop. The successor uses the unchanged installer `--dry-run` (PRESENT still gives canonical NO_OP0; ABSENT refuses before any policy write), and a bounded stop restricted to ids created by THIS controller plus exact b5/owner labels, independent of reserve/headroom. The stop occurs before output retention so even full disk cannot prevent it. Input file checks also reject every ancestor alias before opening.

All ten source files remain a closed graph; five are byte-identical to the approved predecessor. App/Dockerfile/CI/scientific source is unchanged. New literal review bindings add `policyPreflightMode=READONLY_DRY_RUN`, `ownedStopIndependentOfReserveHeadroom=true`, and `allInputPathAncestorsRejectAliases=true`. A NEW exact source pass is required before any preparer/launcher/operator runs. The020000 root/package/unit is still UNUSED/UNCREATED; the old actual PASS is not a review of this successor.

Current CLOSED verification44/44 local +44/44 actual host Python3.9, all ten compiled/hash unchanged,01:44:34.381557UTC, source-local-host-verification-preflight-stop-short-once/exit-original.json. Added tests exercise ABSENT preflight leaving its copy unchanged, emergency stop after both reserve and headroom failure, refusal before inspecting an untracked container, and ancestor alias rejection before file open. All other40 guards and synthetic WAL/preservation tests still pass. First new44 local attempt closed43PASS/1 retained output-path error264characters on Windows; host was not run. Full failed logs/original ten source bytes/fixture originals remain. NEW short hashed fixture directories corrected that verification storage issue only; no runtime guard was weakened. Host synthetic fixtures /tmp/lims-owned-stopped-copy-source-guards-20261015T021000Z remain retained. No production file copy/connection/imageinspect/installer/entrypoint/proof operator ran.

This is still the upstream raw-snapshot/owned installation/jobs-OFF startup proof only. Jobs-ON natural qualification/broader postflights/final exact-kit/fresh single-use gate remain required, and no production deploy authority is granted. All original failures/oldPASS/build/root/receipts/scientific lists/YY pins/containers/human drafts/history remain unchanged.

The predecessor graph description and all earlier closed evidence are retained below as provenance; current policy preflight is read-only and emergency stop is independently guarded.

'''
docs.write_bytes(intro.encode()+docs.read_bytes())
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(('''## 2026-10-15 stopped-copy controller successor44local+44host — NEW exact review required, no dispatch

ActualSourcePASS6182389127 on87df retained8c0039be butgraphUNEXECUTED/root020000packageunitUNCREATED. Predispatch fixes: policypreflight --dry-run avoids ABSENTcopyschemaDDL beforeSTOP; emergencyownedstop ignores failedreserve/headroom but requires THIScontrollercreatedID+exactb5/owner, stopsbeforeoutputretention; inputfilesallancestoraliasesrefuse. Fivecodepaths changed/fivebyteidentical/appCIscienceunchanged.44local+44ACTUALhost3.9 PASS/all10compile/hashunchanged CLOSED01:44:34.381557UTC; priornew44closed43PASS1Windows264charretentionpatherror/HOSTNOTRUN honestimmutable/fulloldsource preserved, correctedNEWshortfixtureIDs only. NewsuccessorSourcePASSneeded beforeoperators; oldPASSnotnewcodeapproval. Source scope upstream snapshot/ownedinstall/jobsOFF only/jobsONbroaderpostflightskitfreshgate later. No productioncopies/connections/counts/installer/entrypoint/proof/root/kit/gate/deploy. No newreviewrequest yet atpublication. AllstandingsciencepolicyapprovedSTOPYYlists/physicalretainedDockerctrd/floor500MB128DB3assets4GiBlogs/mem805readinessunitheadroom/pins/allstoppedcontainers/forwardonly/human103/history hold.

''').encode()+readme.read_bytes())
paths=[SOURCE/n for n in sorted(FILES)]+[docs,readme,pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/publish-stopped-copy-controller-successor-once.py',REPO/'WP/backlog-resume-20261013/verify-stopped-copy-preflight-stop-source-local-host-once.py',REPO/'WP/backlog-resume-20261013/verify-stopped-copy-preflight-stop-short-fixtures-source-local-host-once.py']
for d in ['source-local-host-verification-preflight-stop-once','source-local-host-verification-preflight-stop-short-once']:paths.extend(sorted(p for p in (SOURCE/d).rglob('*') if p.is_file()))
idx=SOURCE/'controller-successor-publication-index.json';require(not idx.exists(),'Publisher consumed')
with idx.open('xb') as f:f.write(canonical({'status':'NEW_CONTROLLER_SUCCESSOR_REVIEW_READY_NOT_APPROVED','createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'predecessor':'87dfedc68723a19bd25c05bc9f0f262b0239e922','actualPredecessorPass':6182389127,'predecessorUnexecuted':True,'scope':SCOPE,'sourceSha256':proof['sourceSha256After'],'localTests':44,'actualHostTests':44,'newSourceReview':None,'rootCreated':False,'productionCopies':0,'proofsRun':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(idx);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owned path')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
# Unchanged five source files do not appear in the staged delta; forbid every unowned path.
staged=set(cmd('git','diff','--cached','--name-only').decode().splitlines());require(staged and staged<=set(rels),'Staged unowned path')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw bytes differ '+rel)
cmd('git','commit','-m','Correct read-only policy preflight and unconditional strictly-owned emergency stop before dispatch');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw bytes differ '+rel)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'CONTROLLER_SUCCESSOR_SOURCE_PUSHED_REVIEW_REQUIRED','head':head,'verifiedOwnedBlobs':len(paths),'changedOwnedBlobs':len(staged),'localTests':44,'hostTests':44,'productionCopies':0,'rootCreated':False}))
