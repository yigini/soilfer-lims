"""Retain one targeted metadata request/native handoff with OID verification; no resends."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-forward-metadata-cde8-20261014/targeted-source-review-request-8df9e126'
TOOLING='8df9e1261647dcc8ba018c739bd606fe5291f1ca'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
def raw_git(head,rel):
    meta,path=cmd('git','ls-tree','-z',head,'--',rel).rstrip(b'\0').split(b'\t',1);mode,kind,oid=meta.decode().split();assert kind=='blob' and path.decode()==rel
    raw=cmd('git','cat-file','blob',oid);assert hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid;return raw
assert cmd('git','rev-parse','HEAD').decode().strip()==TOOLING and not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'index.json').exists()
posted=json.loads((DEST/'actual-request-confirmed.json').read_bytes());fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6181142228')
assert posted['id']==6181142228 and json.loads(fresh)['body']==posted['body']
with (DEST/'actual-request-fresh-original.json').open('xb') as f:f.write(fresh)
native=json.loads((DEST/'native-delivery-record.json').read_bytes());assert native['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and native['returnCount']==1 and native['humanDraftPreserved'] and native['rightComposerEmptyAfter']
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/request-targeted-forward-metadata-chain-source-review-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 targeted metadata source8df review6181142228/native request ONCE\n\nConcrete targeted8df9e1261647dcc8ba018c739bd606fe5291f1ca/5files/18local+18actualhost3.9guards/actual1526catalogue59Committedexactparents; review#1626181142228POSTED23:58:13UTC. One native handoff freshClaude7867734/LIMS Audit/Lab workflow/EMPTYright/caret/ownEND+HEAD/oneReturn/actualbubble+emptyright/ClBloviating verified; oldactual0bSourcePASS read, centreHUMANDRAFT preserved. Request/native raws at WP/batch-forward-metadata-cde8-20261014/targeted-source-review-request-8df9e126/index.json. NEW actual exact-sourcePASS pending;000500root/package/unit UNCREATED, no collector authority/adoption. Old233000STOP honest immutable/e8f1da/never replay; originalbuild500MBfailure/residualunknown/all6directions/limits/pins/imageforensic/zeroDB103/proofkitgatedeploy hold. Never duplicate request/nativehandoff/ack.\n\n').encode()+readme.read_bytes());paths.append(readme)
index=DEST/'index.json'
with index.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_TARGETED_METADATA_SOURCE_REQUEST_NATIVE_RETAINED','requestId':6181142228,'toolingCommit':TOOLING,'retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'newSourceReview':None,'imageEligibility':False,'newExecutionAuthority':None,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(index);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):assert raw_git(tree,rel)==p.read_bytes()
cmd('git','commit','-m','Retain single targeted metadata successor source request and native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert raw_git(head,rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_TARGETED_METADATA_REQUEST_NATIVE_DELIVERY','head':head,'verifiedBlobs':len(paths),'requestId':6181142228,'newSourceReview':None,'newExecutionAuthority':None,'imageEligibility':False}))
