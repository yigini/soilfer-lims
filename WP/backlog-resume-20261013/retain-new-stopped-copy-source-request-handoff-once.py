"""Retain one real exact-source request/native delivery; no repeat message or proof operator."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'exact-source-review-request-87dfedc6';BASE='87dfedc68723a19bd25c05bc9f0f262b0239e922'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
require(cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Same writer/empty staging required')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote source moved')
original=exact_json((DEST/'actual-request-confirmed.json').read_bytes());require(original['id']==6182192097 and original['body']==(DEST/'actual-request-body.txt').read_text(encoding='utf-8'),'Actual request differs')
native=exact_json((DEST/'native-delivery-record.json').read_bytes());require(native['actualSentBubbleVerified'] and native['rightComposerEmptyAfterSend'] and native['returnPressCount']==1 and native['centerHumanDraftUntouched'] and native['sourceCommit']==BASE,'Verified one-time native delivery required')
fresh_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6182192097');fresh=exact_json(fresh_raw);require(fresh['body']==original['body'] and fresh['created_at']==fresh['updated_at'],'Posted request changed')
with (DEST/'actual-request-fresh-original.json').open('xb') as f:f.write(fresh_raw)
raw_history=cmd('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
with (DEST/'comments-after-handoff-original.json').open('xb') as f:f.write(raw_history)
comments=[c for page in exact_json(raw_history) for c in page]
later=[{'id':c['id'],'created_at':c['created_at'],'body':c['body']} for c in comments if c.get('created_at','')>original['created_at'] and BASE in c.get('body','') and (c.get('performed_via_github_app') or {}).get('slug')=='claude']
require(not later,'Actual reviewer response exists; inspect and retain separately, never infer pending')
lead='''## 2026-10-15 actual NEW stopped-copy source request6182192097/native handoff ONCE — SourcePASS pending

Implemented NEW ten-file closed snapshot/owned206214209installation/jobs-OFFstartup graph at source87dfedc68723a19bd25c05bc9f0f262b0239e922,134rawOIDverifiedblobs.40local+40ACTUALhostPython3.9tests/all10compile/hashunchanged CLOSED01:17:10.875877UTC/nonempty-WAL/master+rowsreceipts preservation/refusals/syntheticfixturesONLY. One exact#162request6182192097 POSTED01:21:48UTC/full10hashes+literalbindings; one nativehandoff afterfreshClaude7867734/LIMS Audit/Lab workflow/EMPTYright/caret/ownEND+HEAD/oneReturn then actualbubble+emptyright/ClWhatchamacalliting7s verified. CentreHUMANDRAFT preserved. Allactualtext/postedraws/currentappmainCI/guard/native at WP/batch-proof-cde8-20261015/exact-source-review-request-87dfedc6/index.json. No duplicates/ack/request replay. Actual NEWCl exact87df SourcePASS PENDING atfreshretention; ROOT020000/package/unit UNCREATED, productioncopies/connections/counts/installer/entrypoint/proof/kit/gate/deploy ZERO. Do not use oldSourcePASS. Currentgraphscope explicitly UPSTREAM stoppedinstallation/jobs-OFF; jobs-ONnaturalqualification/broaderpostflights/finalexactkitreview/freshgate STILL REQUIRED, terminalNOT_RELEASE_QUALIFIED. BeforeactualnewPASS neverprepare/upload/launchoperators. Onactualreview readFULLbinding/conditions/freshmainCI/source/buildreceipt; iffailed retainhonestly and fixNEWsource/successors, neverreplayoldhelpers. B5/c03/b1 qualifiedbuild immutable, NORMALhealthy959d/7a/8109 separate. CanonicalpolicyPRESENTNOOP0orSTOP/actual214209lists+invalidStoredIDs/primary+secondarysnapshotallocation/approvednonzeroSTOP/YYnonzerolists/separateforwardremedy/allcontainersretained/fullreleasesDockerctrdphysical/128DB+3assets+4GiBlogreserve/floor500MBmem805readiness600unit5400headroom60+600/bothpins/forward-only/human103/history allhold.

'''
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
checkpoint={'status':'EXACT_NEW_SOURCE_REVIEW_REQUESTED_NOT_APPROVED','sourceCommit':BASE,'requestId':6182192097,'requestUtc':fresh['created_at'],'requestUrl':fresh['html_url'],'nativeDeliveredOnce':True,'scope':SCOPE,'localTests':40,'actualHostTests':40,'actualSourcePass':None,'productionCopies':0,'productionConnections':0,'proofOperatorsExecuted':0,'rootCreated':False,'jobsOnQualificationStillRequired':True,'preserveAllStoppedContainers':True,'consumedHelpers':['verify-new-stopped-copy-source-local-host-once.py','verify-new-stopped-copy-canonical-source-local-host-once.py','publish-new-stopped-copy-source-once.py','request-new-stopped-copy-exact-source-review-once.py','retain-new-stopped-copy-source-request-handoff-once.py'],'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
with (DEST/'checkpoint.json').open('xb') as f:f.write(canonical(checkpoint)+b'\n')
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/request-new-stopped-copy-exact-source-review-once.py',pathlib.Path(__file__),readme]
index=DEST/'index.json';require(not index.exists(),'Consumed retainer boundary')
with index.open('xb') as f:f.write(canonical({**checkpoint,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(index);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw blob changed '+rel)
cmd('git','commit','-m','Retain one exact stopped-copy source review request and verified native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw blob changed '+rel)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':'ONE_REQUEST_NATIVE_RAW_EVIDENCE_PUSHED_SOURCE_PASS_PENDING','head':head,'verifiedOwnedBlobs':len(paths),'requestId':6182192097,'productionCopies':0,'proofOperatorsExecuted':0}))
