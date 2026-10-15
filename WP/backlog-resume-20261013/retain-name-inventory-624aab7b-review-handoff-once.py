"""Retain one exact structural-name source request and verified native handoff."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-proof-name-inventory-cde8-20261015'
DEST=SOURCE/'exact-source-review-request-624aab7b'
BASE='624aab7b9219bc7b9986396ce63915c91ad80502'
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
require(original['id']==6184141580 and native['sourceCommit']==BASE and native['requestId']==6184141580 and native['oneReturn'] and native['headAndEndInspected'] and native['sentBubbleVerified'] and native['rightComposerEmpty'] and native['centreHumanDraftPreserved']=='can you go and ask Pip','Actual request/delivery missing')
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6184141580')
fresh=exact_json(raw)
require(fresh['body']==original['body']==(DEST/'actual-request-body.txt').read_text(encoding='utf-8') and fresh['created_at']==fresh['updated_at'],'Original request changed')
save('actual-request-fresh-original.json',raw)
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
save('comments-after-handoff-original.json',history)
later=[c for page in exact_json(history) for c in page if c.get('created_at','')>original['created_at'] and BASE in c.get('body','') and (c.get('performed_via_github_app') or {}).get('slug')=='claude']
record={'status':'ACTUAL_SOURCE_RESPONSE_PRESENT_INSPECTION_REQUIRED' if later else 'ACTUAL_NEW_STRUCTURAL_NAME_SOURCE_PASS_PENDING','sourceCommit':BASE,'requestId':6184141580,'requestUtc':fresh['created_at'],'nativeDeliveredOnce':True,'actualLaterReviewerResponses':[{'id':c['id'],'created_at':c['created_at']} for c in later],'actualNewPassValidated':False,'localTests':113,'actualHostTests':113,'actualHostMetadataContainers':61,'sourceFiles':11,'declaredDbCopies':52,'dbBudgetEquivalents':65,'requiredBytesReference':51759760494,'freeBytesReference':56325103616,'slackBytesReference':4565343122,'capacityFitsReference':True,'previous050000Status':'FAILED_CONTAINER_NAME_GUARD_BEFORE_CREATE_OR_INSTALLER','previous050000ActualBaselineTables':106,'previous050000ActualMigrationReceipts':39,'newPackagePrepared':False,'newRootCreated':False,'proofOperatorsExecuted':0,'productionCopies':0,'productionSqliteConnections':0,'scientificCounts':None,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
save('checkpoint.json',canonical(record)+b'\n')
lead='## 2026-10-15 structural-name source624a / exactreview6184141580 / native ONCE\n\nNEW COMPLETE eleven-file source624aab7b9219bc7b9986396ce63915c91ad80502 published115raw verified blobs;113local+113actualhost3.9.23/all11compile/hashunchanged CLOSED04:01:25.330213UTC. Structural bounded complete ID+every-ID exact-name inventory, mandatory normal predecessor, raw ID-list stdoutstderr exit and safe selected inventory retained BEFOREcreate; transport/daemon/parse/inspect/deadline/duplicate/missingknown/collision STOP, no error-string absence inference.60s inventory plus bounded15s final inspect/75s headroom. Only4of11 changed/7identical; N52/65/3assets and all copy/science/physical/memory/startup/retention guards unchanged. Additional actualhost readonly metadata61containers proved new060000policyname absent/0creates/0installers/0SQL. Initial111PASS/2new fixture-path errors retained honestly, only new fixture childpaths corrected;113successor bothversions PASS. Fresh04:02:04.896164UTC stat-onlyT567558144/A5787648/free56325103616 required51759760494/slack4565343122 REFERENCEFIT. New060000root UNCREATED/no package/unit/proof/copy/SQL/installer/entrypoint.\n\nONE#162exactrequest6184141580 POSTED04:05:04UTC/all11hashes/allliteralbindings. ONEnative fresh7867734/LIMS Audit/Labworkflow/rightEMPTYcaret/ownHEADEND/oneReturn/sentbubbleemptyright/ClTransmuting verified; centreHUMANDRAFT can you go and ask Pip/cards preserved. Actualreview state at exact-source-review-request-624aab7b/checkpoint.json; no duplicateack/request/handoff or oldPASS reuse. Prior050000 CLOSEDFAILED03:50:49.592312 nameguard BEFOREdockercreate/ANYinstaller/entrypoint;537stablehashedrootfiles/2270896128B/18packageunchanged/allhistoricalcontainers and NORMALprod preserved.52closedraw e2d83f589a1487f5a959f52301da6665361c09a1. Actualbaseline106tables39receipts on retained050000 only; freshstage physicalgrowth1704845312<=2134130688 PASS. Original nameprobe raw absent; fresh readonly lowercase diagnostic NOToriginal, old uppercase guard. Allactual214209lists/installed11242/startups UNKNOWN. Old050000/020000/023000 consumed failed neverreplay;040000nevercreated. QualifiedB5c03/B1 immutable; cde8tree638/mainCI38636615469 SUCCESS370/5649/allrealDocker/3appauditsmerges current. Scope UPSTREAM snapshot/owned206214209install/jobsOFFONLY/notreleasequalified; jobsONnaturalintake/broadpostflights/exactkit/freshgate later. AllYYpins/floorlogs500MB/du-x/physicalretention/memory805blankheap/Swap0/readiness600unit5400/headroom60+600/scientificcanonicalpolicy/YYnonzeroapprovedSTOP/separateforwardremedy/103noapply/humanfileshistory hold.\n\n'
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/request-name-inventory-624aab7b-source-review-once.py',readme]
save('index.json',canonical({**record,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(DEST/'index.json');rels=[p.relative_to(REPO).as_posix() for p in paths]
require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs '+rel)
cmd('git','commit','-m','Retain exact structural-name review and one verified native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs '+rel)
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'requestId':6184141580,'laterResponses':record['actualLaterReviewerResponses'],'capacityFitsReference':True,'newOperations':0}))
