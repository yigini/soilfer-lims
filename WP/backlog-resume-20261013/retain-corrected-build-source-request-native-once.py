"""Retain one targeted metadata request/native handoff with OID verification; no resends."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-build-containerd-cde8-20261015/exact-source-review-request-6608548a'
TOOLING='6608548a58dd4bf581da4330f1cd7b0f68a86973'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
def raw_git(head,rel):
    meta,path=cmd('git','ls-tree','-z',head,'--',rel).rstrip(b'\0').split(b'\t',1);mode,kind,oid=meta.decode().split();assert kind=='blob' and path.decode()==rel
    raw=cmd('git','cat-file','blob',oid);assert hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()==oid;return raw
assert cmd('git','rev-parse','HEAD').decode().strip()==TOOLING and not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'index.json').exists()
posted=json.loads((DEST/'actual-request-confirmed.json').read_bytes());fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6181415046')
assert posted['id']==6181415046 and json.loads(fresh)['body']==posted['body']
with (DEST/'actual-request-fresh-original.json').open('xb') as f:f.write(fresh)
native=json.loads((DEST/'native-delivery-record.json').read_bytes());assert native['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and native['returnCount']==1 and native['humanDraftPreserved'] and native['rightComposerEmptyAfter']
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/request-corrected-containerd-build-source-review-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes('## 2026-10-15 NEW corrected-accounting build source6608548a review6181415046/native handoff ONCE\n\nActualretainedmetadata000500133reads/476blobs2f and analysis850cc REFUSEADOPTION/missingbeforestate/roundedSharedsizes/unproved3,609,116,672B unchanged. Actual618023fallback usedONLYfor NEWsource review: graph6608548a58dd4bf581da4330f1cd7b0f68a86973/5files/20local+20host3.9guards/all5compile/hashunchanged; source-only request6181415046POSTED00:19:16UTC. FreshactualCl7867734/LIMS Audit/Labworkflow target/EMPTYright/caret/ownEND+HEAD/oneReturn/actualbubbleemptyright/ClPrestidigitating delivery verified; centrehumanDraft preserved. Rawrequest/currentall3audits/mainCI/fallback/oldfailure/excludedanalysis/native at WP/batch-build-containerd-cde8-20261015/exact-source-review-request-6608548a/index.json. NEWactualSourcePASS PENDING;010000root/package/unit UNCREATED/no newbuildauthority. ExactphysicalDocker+REQUIREDctrd/newroot120smeasurement/aliasesmountdevices/topology/500MBguard/samefloor4GiBreserve, reduced1800build/unit2700/controller805swap0/blankouterheap. CachemayyieldSAME1dID explicitlyputtoreviewer; separateNEWreceipt proposed/no oldfailureadoptionorretroPASS. No productionconnection/103/proofkitgatedeploy/cleanup/historicalreplay. Neverduplicate source request/nativehandoff/ack.\n\n'.encode()+readme.read_bytes());paths.append(readme)
index=DEST/'index.json'
with index.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_CORRECTED_BUILD_SOURCE_REQUEST_NATIVE_RETAINED','requestId':6181415046,'toolingCommit':TOOLING,'retainedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'newSourceReview':None,'imageEligibility':False,'newExecutionAuthority':None,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(index);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels);assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):assert raw_git(tree,rel)==p.read_bytes()
cmd('git','commit','-m','Retain single targeted metadata successor source request and native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert raw_git(head,rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_CORRECTED_BUILD_REQUEST_NATIVE_DELIVERY','head':head,'verifiedBlobs':len(paths),'requestId':6181415046,'newSourceReview':None,'newExecutionAuthority':None,'imageEligibility':False}))
