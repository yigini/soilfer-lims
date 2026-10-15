"""Retain actual exact structural-name approval before any new package or proof."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-snapshot-handoff-cde8-20261015';DEST=SOURCE/'actual-source-pass-6184578280';BASE='97479b31fbd0595b8c28c18ab08f37f4608dca4a';TOOLING='68633fdd8322243a63b0135f3899963525af7fad'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import current_evidence,raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Consumed boundary or writer changed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote writer moved')
index={'head':TOOLING,'files':{}}
for name in sorted(FILES):
    raw,index['files'][name]=raw_git(TOOLING,'WP/batch-proof-snapshot-handoff-cde8-20261015/'+name);require(raw==(SOURCE/name).read_bytes(),'Actual source changed')
review_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6184578280');review=exact_json(review_raw);approval(review,index);evidence=current_evidence(review,index)
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-source-pass-original.json',review_raw);save('actual-source-pass-readable.txt',review['body'].encode());save('tooling-source-index.json',canonical(index)+b'\n');save('current-boundary-evidence.json',canonical(evidence)+b'\n')
save('native-actual-verdict-read.json',canonical({'status':'ACTUAL_NATIVE_PASS_AND_SCOPE_READ_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan','rightComposerEmpty':True,'centerHumanDraftPreserved':'can you go and ask Pip','actualClaudioSourcePass68633And132TestsBothPythonVersions':True,'nonblockingTelemetryVolumeAndCapacityNotesRead':True,'actualClaudioRestrictsNewScopeToOneUpstreamSnapshotStoppedCopyOnly':True,'newMessageSent':False,'productionOperations':0})+b'\n')
lead='## 2026-10-15 actual68633 SourcePASS6184578280 / one scoped070000 proof authorized\n\nActual04:41:56UTC uneditedCl Source review: PASS binds68633fdd8322243a63b0135f3899963525af7fad/all11hashes/ALLliteralbindings/new070000root/N52/65/tablea009/fullB5c03 and NORMALhealthy959d7a8109. Own approval() and fresh currentmainCI38636615469/all3appaudits/nolaterfailure validated. Cl132tests on3.11+3.9.23/realASTcopyinventory/fiveidenticalfiles accepted. Stable DB and separateassetcopywindow handoffs/UTC/no crossfileatomicity; productionposthandoffownedraw+readerbackupONLY/ownedsourcefullguards unchanged; laterstat-onlyevolution observationneverpredicate; comparedstatesbeforeSTOP; cgroupanonfilebeforeeverybudgetguard accepted. ActualnativePASSscopeREAD/rightEMPTY/centreHUMANDRAFT preserved/no duplicateack.\n\nConditional ONE NEW rawsnapshot+owned206214209installation+jobsOFFstartup ONLY. Referencefree54618963968/required51759760494/slack2859203474; freshmetadata gatesbeforeROOT+beforeunit/controllerbind mandatory. Cl explicitly accepted tensofthousands telemetryfiles chargedby25percentstagephysicalcaps; observerretention mustpermit reviewedvolume safely. Copywindowchange stillSTOP/no retry. No package/root/unit/proof yet. All priorfailedroots/copies/containers and qualifiedB5c03B1 remainimmutable; actual070000counts/scientific214209lists/11242/startupsUNKNOWN. AllYYpins/sciencecanonicalpolicy/nonzeroYYapprovedSTOP/separateforwardremedy/retention/floorlogs500MBdu-x/memoryreadiness/forwardonly/no103/humanhistoryguards hold. NOT_RELEASE_QUALIFIED; jobsONbroadpostflights/exactkit/freshgate later.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__),readme];out=DEST/'index.json'
save(out.name,canonical({'status':'ACTUAL_NEW_SNAPSHOT_HANDOFF_SOURCE_PASS_RETAINED_NO_PROOF_RUN','sourceCommit':TOOLING,'actualReviewId':review['id'],'actualReviewUtc':review['created_at'],'scope':SCOPE,'next':'ONE_SOURCE_BOUND_RAW_SNAPSHOT_AND_OWNED_STOPPED_COPY_PROOF','rootCreated':False,'productionCopies':0,'proofOperatorsExecuted':0,'jobsOnQualificationStillRequired':True,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n');paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged scope differs');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw bytes differ')
cmd('git','commit','-m','Retain actual exact snapshot-handoff source approval and execution boundaries');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote audit differs')
print(json.dumps({'status':'ACTUAL_SOURCE_PASS_RAW_EVIDENCE_PUSHED','head':head,'verifiedOwnedBlobs':len(paths),'actualSourcePass':review['id'],'productionCopies':0,'proofOperatorsExecuted':0}))
