"""Retain one actual capacity boundary and native delivery; no production operation."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'reserve-capacity-boundary-023000-once';BASE='e17d1529407b2c809587bef27a943f75073410e2'
sys.path.insert(0,str(SOURCE));from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Writer/staging moved')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE and not (DEST/'index.json').exists(),'Remote moved/retainer consumed')
original=exact_json((DEST/'actual-boundary-confirmed.json').read_bytes());native=exact_json((DEST/'native-delivery-record.json').read_bytes())
require(original['id']==6183190175 and native['returnPressCount']==1 and native['actualSentBubbleVerified'] and native['rightEmptyAfterSend'] and native['humanDraftAndCardsUntouched'],'Actual one-use boundary missing')
fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183190175');require(exact_json(fresh)['body']==original['body']==(DEST/'actual-boundary-body.txt').read_text(encoding='utf-8'),'Original boundary edited');save('actual-boundary-fresh-original.json',fresh)
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');save('comments-after-native-original.json',history)
later=[c for page in exact_json(history) for c in page if c.get('created_at','')>original['created_at'] and (c.get('performed_via_github_app') or {}).get('slug')=='claude']
record={'status':'ACTUAL_CAPACITY_RESPONSE_PRESENT_INSPECTION_REQUIRED' if later else 'ACTUAL_CAPACITY_DIRECTION_PENDING','boundaryId':6183190175,'boundaryUtc':original['created_at'],'nativeDeliveredOnce':True,'actualLaterClaudioResponses':[{'id':c['id'],'created_at':c['created_at']} for c in later],'directionValidated':False,'proof023000ClosedFailed':True,'rootConsumedNeverReplay':True,'sourcePass6183081827Consumed':True,'requiredBytesPostFailure':87515923566,'freeBytesPostFailure':58602573824,'shortfallBytesPostFailure':28913349742,'newOperations':0,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
save('checkpoint.json',canonical(record)+b'\n')
lead=('## 2026-10-15 capacity boundary6183190175/native ONCE after023000 reserve STOP\n\n'
      'Closed023000FAIL02:37:54.846974UTC/unchanged128xreserve;38verifiedrawblobse17d1529; initialoverlaydu-x16viewPASS/0viewcredit. No snapshotcopy/SQL/count/installer/entrypoint/newcontainer. Postfailuremetadata-only DB567558144/assets5787648/floor+128DB+3assets+4GiB requires87515923566B, free58602573824B/all3sameFS, deficit28913349742B. Freshdiagnostic NOT originalfailedbindinputs. All25rootfiles/17packagehashes/historicalcontainers/healthyprod preserved. ONE#162capacityboundary6183190175 POSTED02:42:54UTC/ONEnative fresh7867734/LIMS Audit/Labworkflow/EMPTYright/caret/ownHEADEND/oneReturn/sentbubbleemptyright/ClChurning verified. CentreHUMANDRAFT can you go and ask Pip/cards untouched. Actualtext/freshboundary/history/response state at reserve-capacity-boundary-023000-once/index.json. AskedCl concrete retention-preserving capacity route with128/floor/500MB pinned and identify YY/infrastructure boundary. Actualdirection state in checkpoint; no new capacity/source/root/operator/settings/guard change. Both020000/023000 consumedFAIL/no replay;ea9PASSusedonce cannotapproveanotherroot. QualifiedB5c03 immutable; actualscientific/tablecountsUNKNOWN; allYYsciencepolicyallocationmemoryreadinesscontainerforward-only103humanhistoryguards hold. JobsON/broadpostflights/exactkitfreshgate later. No active runner/retainer. CoordinationACTIVE; never duplicate boundary/handoff/sourcePASSack.\n\n')
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/post-023000-reserve-capacity-boundary-once.py',readme]
save('index.json',canonical({**record,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n');paths.append(DEST/'index.json');rels=[p.relative_to(REPO).as_posix() for p in paths]
require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain one actual stopped-proof capacity boundary and verified native delivery');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':record['status'],'head':head,'verifiedOwnedBlobs':len(paths),'boundaryId':6183190175,'laterResponses':record['actualLaterClaudioResponses'],'newOperations':0}))
