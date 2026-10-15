"""Retain existing exact review/delivery records and fresh public review metadata."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-proof-cde8-20261015'
DEST=SOURCE/'exact-overlay-review-request-ea9ce209'
BASE='ea9ce209d85305f863378d689b443d3134cbb4cf'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer and empty staging required')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote moved')
require(not (DEST/'index.json').exists(),'Retention consumed')
original=exact_json((DEST/'actual-request-confirmed.json').read_bytes())
native=exact_json((DEST/'native-delivery-record.json').read_bytes())
require(original['id']==6183048107 and original['body']==(DEST/'actual-request-body.txt').read_text(encoding='utf-8'),'Original request differs')
require(native['actualSentBubbleVerified'] and native['rightEmptyAfterSend'] and native['returnPressCount']==1 and native['humanDraftAndCardsUntouched'],'Actual delivery missing')
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6183048107');fresh=exact_json(raw)
require(fresh['body']==original['body'] and fresh['created_at']==fresh['updated_at'],'Request changed')
save('actual-request-fresh-original.json',raw)
history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
save('comments-after-handoff-original.json',history)
later=[c for page in exact_json(history) for c in page if c.get('created_at','')>original['created_at'] and BASE in c.get('body','') and (c.get('performed_via_github_app') or {}).get('slug')=='claude']
checkpoint={'status':'ACTUAL_SOURCE_RESPONSE_PRESENT_INSPECTION_REQUIRED' if later else 'ACTUAL_NEW_OVERLAY_SOURCE_PASS_PENDING','sourceCommit':BASE,'reviewRequestId':6183048107,'requestUtc':fresh['created_at'],'nativeDeliveredOnce':True,'actualLaterReviewerResponses':[{'id':c['id'],'created_at':c['created_at']} for c in later],'actualNewPassValidated':False,'localTests':61,'actualHostTests':61,'productionCopies':0,'productionConnections':0,'proofOperatorsExecuted':0,'newRootCreated':False,'jobsOnQualificationStillRequired':True,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'syntheticFixturesRemainRetainedOnHost':['/tmp/lims-owned-stopped-copy-source-guards-20261015T023500Z','/tmp/lims-owned-stopped-copy-source-guards-20261015T025000Z'],'newSyntheticRawFileFetchPerformed':False,'combinedRetentionCommandRejectedBeforeExecution':'blocked by policy'}
save('checkpoint.json',canonical(checkpoint)+b'\n')
lead=('## New overlay accounting source ea9ce209 / exact review6183048107 / native ONCE\n\n'
      'Source ea9ce209d85305f863378d689b443d3134cbb4cf: ten files, four changed/six identical to6a;119raw verified blobs.61local+61actualhost3.9 guards/all10compile/rawSHA256 unchanged CLOSED02:25:07.019626UTC. Known Docker overlay views require strict paths/options/owners and containerd backing-directory device/ancestor-alias checks before+after one physical du-x. Compact numeric lowerdirs map only to the counted snapshot root (explicit official-containerd inference); unknown/mixed/foreign/duplicate/escape STOP. Full exact mount objects compare unordered; missing/changed/duplicate objects and identity/state/starttime changes STOP. Retained-only16views/7API permutations show actual historical stopped preservation. Original020000 remains FAILED beforedu/copy/SQL/installer/entrypoint/newcontainer; root/helpers consumed forever.\n\n'
      'ONE #162request6183048107 posted02:30:47UTC/full10hashes/allbindings; ONEnative handoff fresh7867734/LIMS Audit/Labworkflow/EMPTYright/caret/ownHEAD+END/oneReturn/actualbubbleemptyright/ClFrolicking verified. Centre HUMAN DRAFT can you go and ask Pip/cards untouched. Actualrequest/text/delivery/freshhistory at exact-overlay-review-request-ea9ce209/index.json; actual response state in checkpoint, never inferPASS from6a/87df. NEW023000root/package/unit uncreated/unexecuted. No newcopy/count/SQL/installer/entrypoint/proof. Allcounts/scientificlistsUNKNOWN/source10639to11242 not observations. Source scope upstream snapshot/owned206214209install/jobsOFF only/notreleasequalified. JobsONnaturalintake/broadpostflights/exactkit/freshsingleusegate later. QualifiedB5/c03 immutable; normal959d7a8109 separate. BothYYpins/policyPRESENTcanonicalNOOPorSTOP/readonlydryrun/approvednonzeroSTOPbefore209/YYallnonzerolists/separateforwardremedy/primarysecondarysnapshots/128DB3assets4GiB/floor10556150894/500MB/memory805blankheap/readiness600unit5400/headroom60+600/allstoppedcontainers/forwardonly/no103/humanfileshistory hold. Earlier AST/publisher/helper bookkeeping refusals preserved; current61 raw record historical sourceSha261 keys are labels only, actual hashlib.sha256 and independent raw Git SHA checks. All synthetic host fixtures remain; combined retention command was automatically rejected beforeexecution, narrowed existing-record retention did no SSH or remote writes.\n\n')
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+[pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/request-stopped-copy-overlay-exact-source-review-once.py',readme]
save('index.json',canonical({**checkpoint,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(DEST/'index.json');rels=[p.relative_to(REPO).as_posix() for p in paths]
require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned staging')
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs '+rel)
cmd('git','commit','-m','Retain exact overlay source review and one verified native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs '+rel)
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':checkpoint['status'],'head':head,'verifiedOwnedBlobs':len(paths),'reviewRequestId':6183048107,'laterResponses':checkpoint['actualLaterReviewerResponses'],'productionCopies':0,'newRootCreated':False}))
