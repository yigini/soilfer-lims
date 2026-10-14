"""Retain the one posted scope question and actual native failure handoff."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/containerd-forward-scope-question-once'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='b219d425606d70bb4ac28977cbea4396edfa9f36'
assert not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'index.json').exists()
posted=json.loads((DEST/'actual-question-confirmed.json').read_bytes());fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180207219')
assert posted['id']==6180207219 and json.loads(fresh)['body']==posted['body']
with (DEST/'actual-question-fresh-original.json').open('xb') as f:f.write(fresh)
native=json.loads((DEST/'native-delivery-record.json').read_bytes())
assert native['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and native['returnCount']==1 and native['humanDraftPreserved'] and native['rightComposerEmptyAfter']
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/raise-batch-build-containerd-forward-scope-boundary-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 failed-build accounting forward-scope question6180207219 ONCE\n\nActual#162 questionposted22:47:54UTC; one native failure/scopehandoff actualbubble+emptyright/ClHyperspacing verified after freshreturnedClaude7867734/LIMS Audit/Lab workflow/EMPTYcomposer/caret/ownEND+HEAD/oneReturn; centreHUMANDRAFT preserved. Fullactualquestion/native records at containerd-forward-scope-question-once/index.json. ActualCl scopeanswer PENDING; no newexecution/source/receipt authority, neverduplicate question/ack. Proposed separatelyreviewed read-only existing-image forwardreceipt route, no rebuild/retag/start/DB/volume/originalrootwrite/gateoverride/oldfailurePASS. Originalfailed221500unit/image/source/logs/500MBgate preserveda514; actualomittedcontainerdstore+missingbeforestate+topologytimeout/noDUfacts b219. No DBconnection/counts/proof/kit/gate/deploy/103apply.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_CONTAINERD_SCOPE_QUESTION_NATIVE_DELIVERY_RETAINED','questionId':6180207219,'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'actualDirection':None,'newExecutionAuthority':None,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain single failed-build forward-scope question and native handoff')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_ACTUAL_SCOPE_QUESTION_NATIVE_DELIVERY','head':head,'verifiedBlobs':len(paths),'questionId':6180207219,'actualDirection':None,'newExecutionAuthority':None,'productionOperations':0}))
