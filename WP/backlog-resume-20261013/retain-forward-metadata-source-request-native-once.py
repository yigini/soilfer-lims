"""Retain the one concrete metadata-source review request and actual native delivery."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-forward-metadata-cde8-20261014/exact-source-review-request-0b01804f'
TOOLING='0b01804f9d409d74a19472c22469824e2df95005'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()==TOOLING
assert not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'index.json').exists()
posted=json.loads((DEST/'actual-request-confirmed.json').read_bytes());fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180795761')
assert posted['id']==6180795761 and json.loads(fresh)['body']==posted['body']
with (DEST/'actual-request-fresh-original.json').open('xb') as f:f.write(fresh)
native=json.loads((DEST/'native-delivery-record.json').read_bytes())
assert native['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and native['returnCount']==1 and native['humanDraftPreserved'] and native['rightComposerEmptyAfter']
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/request-forward-metadata-exact-source-review-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 metadata-only exact-source review6180795761 requested ONCE\n\nSource0b01804f9d409d74a19472c22469824e2df95005/5files/14local+14actualhost3.9guards/all5compile/hashunchanged; request#1626180795761POSTED23:31:40UTC. One actualnativehandoff freshClaude7867734/LIMS Audit/Lab workflow/EMPTYright/caret/ownEND+HEAD/oneReturn/actualbubble+emptyright/ClFrolicking verified; centreHUMANDRAFT preserved. Fullrequest/native raw at WP/batch-forward-metadata-cde8-20261014/exact-source-review-request-0b01804f/index.json. ActualNEWsourcePASS pending, firstmetadata233000root/package/unit UNCREATED; prepare/launcher/collector UNEXECUTED. ScopeEVIDENCEONLY/noadoptionreceipt/imageEligibilityfalse/fullGrowthAttributionfalse. Originalfirstbuildfailed/imageforensic/all6scope+amendedreferences unchanged. Laterfullgrowth validator/source review/receipt/proof/kit/gate required; no production103connection/actions. Neverduplicate request/ack/nativehandoff.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_METADATA_SOURCE_REQUEST_NATIVE_DELIVERY_RETAINED','requestId':6180795761,'toolingCommit':TOOLING,'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'newSourceReview':None,'imageEligibility':False,'newExecutionAuthority':None,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain single bounded metadata exact-source request and native delivery')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_ACTUAL_METADATA_SOURCE_REQUEST_NATIVE_DELIVERY','head':head,'verifiedBlobs':len(paths),'requestId':6180795761,'newSourceReview':None,'imageEligibility':False,'newExecutionAuthority':None}))
