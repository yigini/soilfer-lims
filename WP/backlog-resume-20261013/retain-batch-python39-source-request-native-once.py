"""Retain the single new Python3.9 exact-source review request/native handoff."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/build-only-python39-source-review-request-2afd1928'
TOOLING='2afd192872ce38bfabbaf5c69404d0aa7e679123'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()==TOOLING
assert not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'index.json').exists()
posted=json.loads((DEST/'actual-request-confirmed.json').read_bytes());fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6179895406')
assert posted['id']==6179895406 and json.loads(fresh)['body']==posted['body']
with (DEST/'actual-request-fresh-original.json').open('xb') as f:f.write(fresh)
native=json.loads((DEST/'native-delivery-record.json').read_bytes())
assert native['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and native['returnCount']==1 and native['rightComposerEmptyAfter'] and native['humanDraftPreserved']
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/request-batch-build-python39-exact-source-review-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 corrected2afd build-only source review requested ONCE\n\nNEW#162 request6179895406/22:27:02UTC binds2afd192872ce38bfabbaf5c69404d0aa7e679123/all5hashes. ONLY2builderUTCcalls corrected;14local+14actualhost3.9 pureguards/all5compile/hashunchanged. Actualnative handoff ONCE/freshreturnedClaude7867734/correcttarget/EMPTYright/caret/ownEND+HEAD/oneReturn/actualbubble+emptyright/ClGitifying; centrehumanDraft preserved. Exactrequest/native raw26blobs at build-only-python39-source-review-request-2afd1928/index.json. NEW actualCl exact2afdPASS required beforefirstbuild; old9efPASS6179796996/actualhostrefusal immutablee4e. Firstroot221500stilluncreated/0builds/0DBconnections. No oldhelper/request/handoff replay; futureproof/impact/kit/gate/deploy unapproved.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_NEW_PYTHON39_REQUEST_NATIVE_DELIVERY_RETAINED','requestId':6179895406,'toolingCommit':TOOLING,'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'newExactSourcePassObserved':False,'buildsLaunched':0,'productionConnections':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain single corrected batch build source request and native delivery')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_ACTUAL_PYTHON39_REVIEW_REQUEST_NATIVE_DELIVERY','head':head,'verifiedBlobs':len(paths),'requestId':6179895406,'sourceHead':TOOLING,'buildsLaunched':0,'productionConnections':0}))
