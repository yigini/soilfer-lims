"""Retain this exact budget source request and one verified native delivery only."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-proof-budget-cde8-20261015'
DEST=SOURCE/'exact-source-review-request-932e764a'
BASE='932e764ad68d5de2ca136e1172fb72ae7afa7edc'
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
require(original['id']==6183441071 and native['oneReturn'] and native['headAndEndInspected'] and native['sentBubbleVerified'] and native['rightComposerEmpty'] and native['centreHumanDraftPreserved']=='can you go and ask Pip','Actual request/delivery missing')
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183441071')
fresh=exact_json(raw)
require(fresh['body']==original['body']==(DEST/'actual-request-body.txt').read_text(encoding='utf-8') and fresh['created_at']==fresh['updated_at'],'Original request changed')
save('actual-request-fresh-original.json',raw)
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
save('comments-after-handoff-original.json',history)
later=[c for page in exact_json(history) for c in page if c.get('created_at','')>original['created_at'] and BASE in c.get('body','') and (c.get('performed_via_github_app') or {}).get('slug')=='claude']
record={'status':'ACTUAL_SOURCE_RESPONSE_PRESENT_INSPECTION_REQUIRED' if later else 'ACTUAL_NEW_BUDGET_SOURCE_PASS_PENDING','sourceCommit':BASE,'requestId':6183441071,'requestUtc':fresh['created_at'],'nativeDeliveredOnce':True,'actualLaterReviewerResponses':[{'id':c['id'],'created_at':c['created_at']} for c in later],'actualNewPassValidated':False,'localTests':82,'actualHostTests':82,'sourceFiles':11,'declaredDbCopies':70,'dbBudgetEquivalents':88,'requiredBytesReference':64813597806,'freeBytesReference':58601160704,'shortfallBytesReference':6212437102,'capacityFitsReference':False,'newPackagePrepared':False,'newRootCreated':False,'proofOperatorsExecuted':0,'productionCopies':0,'productionSqliteConnections':0,'scientificCounts':None,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
save('checkpoint.json',canonical(record)+b'\n')
lead=('## 2026-10-15 complete budget source932e / exact review6183441071 / native ONCE\n\n'
      'NEW complete eleven-file source932e764ad68d5de2ca136e1172fb72ae7afa7edc published100raw verified blobs;82local+82actualhostPython3.9.23/all11compile/hashunchanged CLOSED03:00:18.320853UTC. Implements actual6183215126 with exhaustive nested70DB/3assets,25percent=>88equivalents, perstage claims/copy-site AST inventory/TMPDIR maxima/remaining-consumption checks/physicalgrowth caps. Floor10556150894/logs4GiB/3assets/500MB/du-x/allretainedsnapshotscontainers/YYpins/science preserved. Fresh stat-only reference02:58:31 T567558144/A5787648/free58601160704; required64813597806, shortfall6212437102. Capacity DOES NOT FIT; launcher refuses BEFOREremoteROOT and rechecks beforeunit. SourcePASS alone cannot make capacity pass. No newpackage/root040000/unit/proof/copy/SQL/installer/entrypoint/settings action.\n\n'
      'ONE exact#162request6183441071 POSTED03:04:01UTC, ONE verified nativehandoff fresh7867734/LIMS Audit/Labworkflow/ownHEAD+END/oneReturn/sentbubble/emptyright/ClFrolicking; centre HUMAN DRAFT can you go and ask Pip/cards preserved. Actualreview state in exact-source-review-request-932e764a/checkpoint.json; no oldPASS reuse/duplicate request or acknowledgement. QualifiedB5c03/B1 complete; normalhealthy959d7a8109 separate; old020000/023000 consumedFAILED neverreplay/cleanup. Currentcde8tree638/mainCI38636615469 SUCCESS370/5649/allrealDocker/all3appauditsmerges unchanged. Actual214209scientific/tablecountsUNKNOWN. Scope UPSTREAM rawsnapshot/owned206214209install/jobsOFF ONLY/notreleasequalified; jobsONnaturalintake/broadpostflights/exactkit/freshsingleusegate later. Forward-only/allrawDBWALSHM/allocation/memoryreadiness/policycanonical/YYnonzero/approvednonzeroSTOP/separateforwardremedy/103noapply/humanfileshistory hold.\n\n')
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/request-budget-932e764a-exact-source-review-once.py',readme]
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
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'requestId':6183441071,'laterResponses':record['actualLaterReviewerResponses'],'capacityFitsReference':False,'newOperations':0}))
