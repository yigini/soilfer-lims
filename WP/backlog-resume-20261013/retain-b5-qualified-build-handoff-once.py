"""Retain one qualification progress notice/native handoff; no proof request or duplicate send."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-proof-cde8-20261015/b5-qualified-build-handoff-once'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='5d9d719aca6614fddce01e15b85ac73ecc21f318' and not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'index.json').exists()
posted=json.loads((DEST/'actual-post-confirmed.json').read_bytes());fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6181815795');assert json.loads(fresh)['body']==posted['body']
with (DEST/'actual-notice-fresh-original.json').open('xb') as f:f.write(fresh)
native=json.loads((DEST/'native-delivery-record.json').read_bytes());assert native['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and native['returnCount']==1 and native['rightComposerEmptyAfter'] and native['humanDraftPreserved']
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/post-b5-qualified-build-boundary-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-15 qualifiedb5 completion notice6181815795/native handoff ONCE\n\nOne actual#162progressnotice6181815795POSTED00:51:20UTC and one native qualification handoff freshClaude7867734/LIMS Audit/Labworkflow/EMPTYright/caret/ownEND+HEAD/oneReturn/actualbubble+emptyright/ClRunning verified; centreHUMANDRAFT preserved. Fullactualtext/delivery/native/notice at WP/batch-proof-cde8-20261015/b5-qualified-build-handoff-once/index.json. Qualifiedb5/receiptc03/b1zero67MBresidual proof, freshnormalhealthy959d/7a/8109metadatadraft5d allhandedoff; no new proofapproval requested or inferred. No duplicate notice/ack/questions/build/metadata/proof replay. NEXT actuallyimplement NEWcomplete closed proof/snapshot source+meaningfulguards+actualSourcePASS; currentauthoritydraftNOTexecutable/allproofkitsnapshotgateslotsNULL. No productionDB/count/volume-file/copy/installer/entrypoint/proof/kit/gate/deploy/103 yet. Bothpins/scientificimpact/policy/accounting/forward-only/allstoppedcontainers/humanhistory guards hold.\n\n').encode()+readme.read_bytes());paths.append(readme)
idx=DEST/'index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_QUALIFIED_BUILD_COMPLETION_NOTICE_NATIVE_RETAINED','noticeId':6181815795,'retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'proofSourceReview':None,'productionDeployments':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(idx);rels=[p.relative_to(REPO).as_posix() for p in paths];cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
def verify(head):
    for p,rel in zip(paths,rels):
        meta,path=cmd('git','ls-tree','-z',head,'--',rel).rstrip(b'\0').split(b'\t',1);mode,kind,oid=meta.decode().split();assert kind=='blob' and path.decode()==rel
        raw=cmd('git','cat-file','blob',oid);assert raw==p.read_bytes() and hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid
verify(cmd('git','write-tree').decode().strip());cmd('git','commit','-m','Retain single qualified build completion notice and actual native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip();verify(head);cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_QUALIFIED_BUILD_COMPLETION_NOTICE_NATIVE','head':head,'verifiedBlobs':len(paths),'noticeId':6181815795,'proofSourceReview':None,'productionDeployments':0}))
