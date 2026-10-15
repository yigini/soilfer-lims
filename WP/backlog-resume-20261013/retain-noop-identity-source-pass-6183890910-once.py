"""Retain actual exact source approval and current boundaries before any copy/proof."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-noop-identity-cde8-20261015';DEST=SOURCE/'actual-source-pass-6183890910';BASE='e7340e7cd9f8d8d003402148b7620d46afb4e5ff';TOOLING='09d7e537d90bc8ed17e9d162fd6868a7c34a8e15'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import current_evidence,raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Consumed boundary or writer changed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
index={'head':TOOLING,'files':{}}
for name in sorted(FILES):
    raw,index['files'][name]=raw_git(TOOLING,'WP/batch-proof-noop-identity-cde8-20261015/'+name);require(raw==(SOURCE/name).read_bytes(),'Actual source changed')
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183890910');review=exact_json(review_raw);approval(review,index);evidence=current_evidence(review,index)
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-source-pass-original.json',review_raw);save('actual-source-pass-readable.txt',review['body'].encode());save('tooling-source-index.json',canonical(index)+b'\n');save('current-boundary-evidence.json',canonical(evidence)+b'\n')
save('native-actual-verdict-read.json',canonical({'status':'ACTUAL_NATIVE_PASS_AND_SCOPE_READ_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan','rightComposerEmpty':True,'centerHumanDraftPreserved':'can you go and ask Pip','actualClaudioSaysSourcePassOn09d7AndOwnValidatorPasses96':True,'twoNonblockingSafeStopsRead':True,'actualClaudioRestrictsNewScopeToUpstreamSnapshotStoppedCopyOnly':True,'newMessageSent':False,'productionOperations':0})+b'\n')
lead='## 2026-10-15 actual09d7 SourcePASS6183890910 / one scoped050000 proof authorized\n\nActual03:43:03UTC uneditedCl Source review: PASS binds09d7e537d90bc8ed17e9d162fd6868a7c34a8e15/all11hashes/new050000root/N52/65equivalents/25percent/min64/tablea009b22c/fullB5c03+healthy959d7a8109/allYYscopeandlimits. Actualapproval accepts one NEW rawsnapshot/ownedstoppedinstallation/jobsOFFstartup ONLY conditionalonfreshmetadata-capacitybeforeROOTandbeforeunit.96tests3.11+3.9.23/realcopy-siteinventory/all8stagesimulation/dryrepeatidentity/installedprevious/allguards checked byCl; own validator accepts. Earlierpasses/932e authorize nothing;932e neverhadPASS. Fullraw/currentapp/nativeREAD here; no duplicateack.\n\nReference03:26:21 T567558144/A5787648/free58598653952 requires51759760494/slack6838893458, referenceonly; launcher mustremeasure. Strictidentity/overlayoptions may safeSTOP; capacitymayrefusegrowth; preserveall/no retry. No newpackage/root/unit/proof/copy/SQL/count/installer/entrypoint yet. NEXTprepareNEWexactapprovedpackage thenonefreshreviewed050000launch afterfreshcurrentmainCI/all3audits/PASS/nolaterfailure/unusedrootunit/capacity. Allsciencepolicycanonical/YYnonzeroapprovedSTOP/separateforwardremedy/primarysecondaryallocations/memory805blankheap/Swap0/readiness600unit5400/headroom60+600/floorlogs500MB/du-x/allstoppedcontainers/forwardonly/103noapply/humanfileshistory hold. JobsONnaturalintake/broadpostflights/exactkit/freshgate later; countsUNKNOWN/source10639to11242 prospectiveonly. QualifiedB5c03/B1 immutable; old020000/023000consumedFAIL/040000nevercreated.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__),readme];out=DEST/'index.json'
save(out.name,canonical({'status':'ACTUAL_NEW_STOPPED_COPY_SOURCE_PASS_RETAINED_NO_PROOF_RUN','sourceCommit':TOOLING,'actualReviewId':review['id'],'actualReviewUtc':review['created_at'],'scope':SCOPE,'next':'ONE_SOURCE_BOUND_RAW_SNAPSHOT_AND_OWNED_STOPPED_COPY_PROOF','rootCreated':False,'productionCopies':0,'proofOperatorsExecuted':0,'jobsOnQualificationStillRequired':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n');paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged scope differs');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw bytes differ')
cmd('git','commit','-m','Retain actual exact stopped-copy source approval and unchanged execution boundaries');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote audit differs')
print(json.dumps({'status':'ACTUAL_SOURCE_PASS_RAW_EVIDENCE_PUSHED','head':head,'verifiedOwnedBlobs':len(paths),'actualSourcePass':review['id'],'productionCopies':0,'proofOperatorsExecuted':0}))
