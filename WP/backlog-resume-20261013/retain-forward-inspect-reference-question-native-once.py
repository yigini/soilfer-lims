"""Retain the one missing-reference question and its visually verified native delivery."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-release-cde8-20261014/forward-original-inspect-reference-question-once'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='4c74ee53da24bae9090198b0eb686bf83273d28e'
assert not cmd('git','diff','--cached','--name-only').strip() and not (DEST/'index.json').exists()
posted=json.loads((DEST/'actual-question-confirmed.json').read_bytes());fresh=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180294588')
assert posted['id']==6180294588 and json.loads(fresh)['body']==posted['body']
with (DEST/'actual-question-fresh-original.json').open('xb') as f:f.write(fresh)
native=json.loads((DEST/'native-delivery-record.json').read_bytes())
assert native['status']=='ACTUAL_SENT_ONCE_VISUALLY_VERIFIED' and native['returnCount']==1 and native['humanDraftPreserved'] and native['rightComposerEmptyAfter']
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[REPO/'WP/backlog-resume-20261013/raise-forward-receipt-missing-original-inspect-reference-once.py',pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 forward condition2 original-inspect clarification6180294588 ONCE\n\nActual#162 questionposted22:54:35UTC; one nativehandoff freshClaude7867734/LIMS Audit/Lab workflow/EMPTYright/caret/ownEND+HEAD/oneReturn/actualbubble+emptyright/ClPuzzling verified; centrehumanDraft preserved. Exactquestion/native raw at forward-original-inspect-reference-question-once/index.json. Actualreferenceanswer PENDING; no source/execution/receipt authority. Originalfirstroot image-inspect-original.json ABSENT, gateabortedbeforestep; firstretainer distinctforensicAPIresponsec4b4d2fa.../7229bytes at22:40:05UTC/a514 proposedasreference, no fictionalfile/rootwrite/oldmodechange. Scope6180234041 direction-only/all6conditions/full3,609,116,672B attributedmetadata/no recursiveDU/residual>=500MBSTOP remain. Firstbuildfailedconsumed/imageFORENSICONLY/no proofkitgatedeploy103apply.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':'ACTUAL_REFERENCE_QUESTION_NATIVE_DELIVERY_RETAINED','questionId':6180294588,'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'actualReferenceAnswer':None,'newSourceApproval':None,'newExecutionAuthority':None,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain single original-inspect reference question and native delivery')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':'PUSHED_ACTUAL_REFERENCE_QUESTION_NATIVE_DELIVERY','head':head,'verifiedBlobs':len(paths),'questionId':6180294588,'newSourceApproval':None,'newExecutionAuthority':None}))
