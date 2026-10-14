"""Retain actual posted source-review request and the single verified native delivery."""
import datetime, hashlib, json, pathlib, subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/build-only-source-review-request-9ef893b3'
HEAD='9ef893b38fe381061d4dc8aa90968d1d7a4f6fff'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()==HEAD
assert not cmd('git','diff','--cached','--name-only').strip()
assert not (DEST/'index.json').exists(), 'Consumed retention boundary'
posted=json.loads((DEST/'actual-request-confirmed.json').read_bytes())
actual=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6179744847')
assert json.loads(actual)['body']==posted['body'] and posted['id']==6179744847
with (DEST/'actual-request-fresh-original.json').open('xb') as f:f.write(actual)
record=json.loads((DEST/'native-delivery-record.json').read_bytes())
assert record['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and record['returnCount']==1 and record['humanDraftPreserved'] and record['rightComposerEmptyAfter']
assert (DEST/'native-actual-sent.txt').read_text(encoding='utf-8').startswith('Pip: NEW separate BUILD-ONLY source review')
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/request-batch-cde8-build-only-source-review-once.py',pathlib.Path(__file__)]
lead='''## 2026-10-14 batch BUILD-ONLY new source review requested ONCE

Exact tooling9ef893b38fe381061d4dc8aa90968d1d7a4f6fff/five raw source hashes/14guardPASS/exact1561rawGitarchive. Actual #162 review request6179744847 POSTED ONCE22:18:22UTC; one native handoff actualbubble/emptyright/ClPerusing visually verified after freshClaude7867734/LIMS Audit/Lab workflow target/emptycomposer/caret/own draftEND+HEAD/oneReturn. Centre humanDraft can you go and ask Pip preserved. Actualrequest/native originals in WP/batch-release-cde8-20261014/build-only-source-review-request-9ef893b3/index.json. Actual NEWCl Source review PASS still required; never duplicate request/handoff. Firstbuildroot fixed221500Z only. No production connection/counts/build/proof/kit/gate/deploy/103apply; separate new proof/source/fullkit/fresh gate still required. Same writer/worktree/branch; all historical operations remain consumed.

'''
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes());paths.append(readme)
index={'status':'ACTUAL_BUILD_ONLY_REVIEW_REQUEST_AND_NATIVE_DELIVERY_RETAINED','retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'toolingCommit':HEAD,'requestId':6179744847,'newSourceApproval':None,'productionOperations':0,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]}
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump(index,f,indent=2)
paths.append(index_path)
rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes(),rel
cmd('git','commit','-m','Retain single batch build source review request and verified native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes(),rel
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_ACTUAL_BUILD_ONLY_REVIEW_REQUEST_NATIVE_HANDOFF','head':head,'verifiedBlobs':len(paths),'requestId':6179744847,'sourceHead':HEAD,'newSourceApproval':None,'productionOperations':0}))
