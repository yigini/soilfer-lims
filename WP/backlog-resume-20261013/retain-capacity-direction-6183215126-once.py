"""Retain actual model direction and source-only copy-site accounting before successor work."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'actual-capacity-direction-6183215126';BASE='25fd4c34b360ea3c037f32e819f2ff39006ac868'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from prepare_proof import current_evidence,raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved or boundary consumed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183215126');answer=exact_json(raw)
require(answer['id']==6183215126 and answer['created_at']==answer['updated_at']=='2026-10-15T02:45:02Z' and answer['performed_via_github_app']['slug']=='claude','Actual unedited direction differs')
require(all(t in answer['body'] for t in ['128x multiplier is not a YY pin','enumerated stage budget','25% margin','minimum of 64','consumption-aware','new exact review']),'Direction incomplete')
evidence=current_evidence();DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-direction-original.json',raw);save('actual-direction-readable.txt',answer['body'].encode());save('current-app-boundaries.json',canonical(evidence)+b'\n')
save('native-actual-direction-read.json',canonical({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'windowId':7867734,'project':'LIMS Audit','thread':'Lab workflow audit and plan','rightComposerEmpty':True,'centreHumanDraft':'can you go and ask Pip','actualNativeDirectionRead':True,'noMessageSent':True,'noHumanCardAnswered':True})+b'\n')
analysis=SOURCE/'budget-copy-site-analysis-before-implementation.json';table=exact_json(analysis.read_bytes())
require(table['declaredMaximumDbTripleCount']==70 and table['derivedDbEquivalents']==88,'Initial exact copy accounting differs')
lead=('## 2026-10-15 actualcapacity direction6183215126 / derived model successor required\n\n'
      'Clactual02:45:02UTC direction says128 is chosen-source margin, NOTYYpin; identifies fixed running reserve double-counting own retained consumption. Requests enumeratedcopy-site/stage/TMPDIR maxima budget,25percent margin roundedup/min64DB-equivalents, consumption-aware remaining checks and measuredstagegrowthcaps; floor10556150894/logs4GiB/assets3x/500MB/du-x/allrawsnapshotscontainers/YYpins/scientificgates unchanged; freshunusedroot/newexactreview. No host change currently required by that direction; no newsourcePASS/operation authority. Fullactualbody/currentapp/nativeREAD here. No duplicateack or capacityquestion.\n\n'
      'Retained-source-only deepercount PRELIMINARY shows70DBtriple equivalents/3assets, min25percent budget88, required64813597806B usingpostfailureT567558144/A5787648/free58602573824 (remainingdeficit6211023982B). Extra actualsites missed in approximate47 count:214threeCLI policy snapshots;209threeCLI eachprimary+secondarypolicy snapshots;each ordinary startup retains4entrypoint +4server-readiness policy snapshots, plusclone+3copyseal=12 perstart. Chart impact copies0DBs. All7actualapplicationrawGitblobSHA pins recordedin budget-copy-site-analysis-before-implementation.json. This count needs exhaustive successor implementation/guards/review, not permission to run or claimfits. No application/scientificsource change; no newbudgetcode/root/operator yet. NEXT build genuinelyNEW complete graph with enumeratedallcopy sites/consumption-awareallocator and meaningfullocal+hostguards; ifderivedbudgetdoesnotfit keepSTOP and surfaceconcrete source/table inreview. Neveruse47/64 asobservedcompletecount. Existing023000 and020000 rootsremainCONSUMEDFAIL/neverreplay;ea9PASSconsumed. QualifiedB5c03/currenthealthy959d7a separate; actualscientificcountsUNKNOWN. Sameworktreewriterbranch/noagents/newchat/concurrentwriter/cleanup/103/humanchanges; allotherguards/history remain.\n\n')
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[analysis,pathlib.Path(__file__),readme]
save('index.json',canonical({'status':'ACTUAL_DIRECTION_RETAINED_NEW_SOURCE_REQUIRED_NOT_APPROVED','directionId':6183215126,'directionUtc':answer['created_at'],'preliminaryDeclaredDbCopies':70,'preliminaryBudgetDbEquivalents':88,'budgetSourceImplemented':False,'newRootCreated':False,'newOperations':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n');paths.append(DEST/'index.json');rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain actual consumption-aware reserve direction and complete-copy-count investigation');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'ACTUAL_CAPACITY_DIRECTION_RETAINED_NEW_GRAPH_REQUIRED','head':head,'verifiedOwnedBlobs':len(paths),'directionId':6183215126,'newOperations':0}))
