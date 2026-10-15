"""Retain actual new snapshot-boundary scope; no new operator or source approval."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-name-inventory-cde8-20261015';DEST=SOURCE/'actual-snapshot-boundary-direction-6184356993';BASE='136a9b7ef37ddb2c89d2381a287ca313596100a7'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from prepare_proof import current_evidence,raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Consumed boundary/writer moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6184356993');answer=exact_json(raw)
require(answer['id']==6184356993 and answer['created_at']==answer['updated_at']=='2026-10-15T04:22:56Z' and answer['performed_via_github_app']['slug']=='claude','Actual unedited direction differs')
require(all(t in answer['body'] for t in ['snapshot-handoff.json','but only for the production seal','do not claim cross-file atomicity','Every equality guard','memory.stat','A genuinely new graph']),'Direction incomplete')
evidence=current_evidence();DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-direction-original.json',raw);save('actual-direction-readable.txt',answer['body'].encode());save('current-app-boundaries.json',canonical(evidence)+b'\n')
save('native-actual-direction-read.json',canonical({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan','rightComposerEmpty':True,'centreHumanDraft':'can you go and ask Pip','actualNativeDirectionRead':True,'noMessageSent':True,'noHumanCardAnswered':True})+b'\n')
lead='## 2026-10-15 actualsnapshot direction6184356993 / new complete source required\n\nActual04:22:56UTC scope accepts production consistency ONLYrawcopywindow: fullbefore/copy/fullafter-equal orSTOP/no retry and immediate0400snapshot-handoff beforeafter/rawbyteidentity/UTC. Afterhandoff immutable rawbytes+ownedreaderbackup equivalence; remove live source equality ONLYproductionseal/ownedsourceguards unchanged. Assetsownstablewindow+separatehandoff/UTC/no crossfileatomicity; laterstat-only liveDB/assets observations aftersnapshot+terminal neverSTOP/neverauthority. EVERYliveequalitySTOPsealsbothstatesbeforethrow. Tests livechangeDURINGcopySTOP+evidence/AFTERhandoffobservationONLY/rawtamperSTOP/assetslatechangeobservationONLY. Recordcgroupmemory.stat anon/file ateachbudgetcheckpoint; pagecache is ClINFERENCEnotmeasuredfact. Allcopies/YYpins/budget/science/predhealth/retention/memory remain. This is SCOPEONLY/noSourcePASS/operation; NEXTimplementgenuinelyNEWcompletegraph forfreshunusedroot/newtests/freshT-A-free/newexactreview beforeanypackage/copy/proof. No merewaitforapprovalofnonexistentgraph. Fullactualraw/nativeREAD/currentapp retained. No duplicatequestion orack; bundleatconcretenewsourcehandoff.060000closedFAIL681e3a35/rawmastermatches/exactliveafterunknown/allretained unchanged. No activeproof/runnerretainer; allhistory/103humanforwardonlyguards hold.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__),readme]
save('index.json',canonical({'status':'ACTUAL_DIRECTION_RETAINED_NEW_GRAPH_REQUIRED_NOT_APPROVED','directionId':6184356993,'directionUtc':answer['created_at'],'newGraphImplemented':False,'newRootCreated':False,'newOperations':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n');paths.append(DEST/'index.json');rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain actual stable snapshot-window direction before new source implementation');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'ACTUAL_SNAPSHOT_DIRECTION_RETAINED_NEW_GRAPH_REQUIRED','head':head,'verifiedOwnedBlobs':len(paths),'directionId':6184356993,'newOperations':0}))
