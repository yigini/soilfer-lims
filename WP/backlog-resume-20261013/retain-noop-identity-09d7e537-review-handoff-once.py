"""Retain this exact budget source request and one verified native delivery only."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-proof-noop-identity-cde8-20261015'
DEST=SOURCE/'exact-source-review-request-09d7e537'
BASE='09d7e537d90bc8ed17e9d162fd6868a7c34a8e15'
sys.path.insert(0,str(SOURCE))
from proof_contract import canonical,exact_json,require,sha
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
require(cmd('git','rev-parse','--abbrev-ref','HEAD').decode().strip()=='audit/release-eb6de2e8','Wrong writer branch')
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE and not (DEST/'index.json').exists(),'Remote moved/retainer consumed')
original=exact_json((DEST/'actual-request-confirmed.json').read_bytes())
native=exact_json((DEST/'native-delivery-record.json').read_bytes())
require(original['id']==6183727594 and native['oneReturn'] and native['headAndEndInspected'] and native['sentBubbleVerified'] and native['rightComposerEmpty'] and native['centreHumanDraftPreserved']=='can you go and ask Pip','Actual request/delivery missing')
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183727594')
fresh=exact_json(raw)
require(fresh['body']==original['body']==(DEST/'actual-request-body.txt').read_text(encoding='utf-8') and fresh['created_at']==fresh['updated_at'],'Original request changed')
save('actual-request-fresh-original.json',raw)
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
save('comments-after-handoff-original.json',history)
later=[c for page in exact_json(history) for c in page if c.get('created_at','')>original['created_at'] and BASE in c.get('body','') and (c.get('performed_via_github_app') or {}).get('slug')=='claude']
record={'status':'ACTUAL_SOURCE_RESPONSE_PRESENT_INSPECTION_REQUIRED' if later else 'ACTUAL_NEW_NOOP_IDENTITY_SOURCE_PASS_PENDING','sourceCommit':BASE,'requestId':6183727594,'requestUtc':fresh['created_at'],'nativeDeliveredOnce':True,'actualLaterReviewerResponses':[{'id':c['id'],'created_at':c['created_at']} for c in later],'actualNewPassValidated':False,'localTests':96,'actualHostTests':96,'sourceFiles':11,'declaredDbCopies':52,'dbBudgetEquivalents':65,'requiredBytesReference':51759760494,'freeBytesReference':58598653952,'slackBytesReference':6838893458,'capacityFitsReference':True,'newPackagePrepared':False,'newRootCreated':False,'proofOperatorsExecuted':0,'productionCopies':0,'productionSqliteConnections':0,'scientificCounts':None,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
save('checkpoint.json',canonical(record)+b'\n')
lead='## 2026-10-15 new52-copy source09d7 / exactreview6183727594 / native ONCE\n\nNEW COMPLETE eleven-file source09d7e537d90bc8ed17e9d162fd6868a7c34a8e15 published72raw verified blobs;96local+96actualhost3.9.23/all11compile/hashunchanged CLOSED03:25:57.808029UTC. Implements actual6183663456: only FUTURE dry/repeat seals replaced by strict main identity+emptyWAL and exact main/WAL NO_OP0identity guards; installed fullseals unchanged and becomenext previous. Fresh fullseal/CLI primarysecondarysnapshots/BOTHstarts retained. N52/3assets=>65equivalents with25percent/min64; ASToneinstallseal/runtimeclaims/stagephysicalcaps/remainingchecks/floorlogs500MBdu-x/allretention/YYscienceguards hold. Fresh03:26:21.662900UTC stat-onlyT567558144/A5787648/free58598653952 required51759760494/slack6838893458 REFERENCEFIT; actualgatebeforeROOTandbeforeunit remains. No package/050000root/unit/proof/copy/SQL/installer/entrypoint/settings action.\n\nONE#162exactrequest6183727594 POSTED03:28:25UTC/all11hashes/allliteralbindings. ONEnative fresh7867734/LIMS Audit/Labworkflow/rightEMPTYcaret/ownHEADEND/oneReturn/sentbubbleemptyright/ClMetamorphosing54s verified; centreHUMANDRAFT can you go and ask Pip/cards preserved. Actualreview state at exact-source-review-request-09d7e537/checkpoint.json; no duplicateack/request/handoff or oldPASS reuse. Actual618366direction gives NO verdict on932e;932e040000unexecuted/superseded;020000/023000 immutableconsumedFAIL. QualifiedB5c03/B1 complete; normalhealthy959d7a8109 separate; cde8tree638/mainCI38636615469 SUCCESS370/5649/allrealDocker/all3appauditsmerges unchanged. Actualscientific/tablecountsUNKNOWN. Scope UPSTREAM snapshot/owned206214209install/jobsOFFONLY/notreleasequalified; jobsONnaturalintake/broadpostflights/exactkit/freshgate later. Allsource/science/policycanonical/YYnonzero/approvedSTOP/primarysecondaryallocations/memoryreadiness/allstoppedcontainers/forwardonly/no103/humanfileshistoryguards hold.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/request-noop-identity-09d7e537-source-review-once.py',readme]
save('index.json',canonical({**record,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(DEST/'index.json');rels=[p.relative_to(REPO).as_posix() for p in paths]
require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs '+rel)
cmd('git','commit','-m','Retain exact budget source review and one verified native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs '+rel)
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'requestId':6183727594,'laterResponses':record['actualLaterReviewerResponses'],'capacityFitsReference':True,'newOperations':0}))
