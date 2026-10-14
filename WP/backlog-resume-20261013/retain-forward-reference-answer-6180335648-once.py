"""Retain the actual reference correction; it grants no adoption source or execution PASS."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'actual-forward-reference-answer-6180335648'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='90a4446e33d0ee2a7583500ffa866b7ec6f09574'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180335648');answer=json.loads(raw)
assert answer['id']==6180335648 and answer['performed_via_github_app']['slug']=='claude' and answer['created_at']==answer['updated_at'] and answer['body'].startswith('On 6180294588: yes.')
assert 'This is still direction only.' in answer['body'] and 'concrete exact-source PASS' in answer['body'] and 'candidate-image-fresh-inspect-original.json' in answer['body']
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-reference-answer-original.json',raw);save('actual-reference-answer-readable.txt',answer['body'].encode())
save('actual-scope-direction-current-original.json',cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180234041'))
save('current-main-original.json',cmd('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main'))
reference={'status':'ACTUAL_REFERENCE_SET_CORRECTED_DIRECTION_ONLY','scopeDirectionId':6180234041,'referenceAnswerId':6180335648,'actualAnswerUtc':answer['created_at'],'referenceAudit':'a514c0a49a7487f44b33e27a7390972926a56307','originalImageInspectFilePresent':False,'forensicInspectRole':'DISTINCT_FIRST_POST_CLOSURE_READONLY_API_RESPONSE_NOT_ORIGINAL_INSPECT_FILE','references':{'candidate-image.id':{'bytes':71,'sha256':'6bb4227f82debcf97845874330ae261d044b749819d2f2193a0fc0c3935967e3','originalMode':'0o600'},'docker-build.log':{'bytes':28713,'sha256':'5a7736d9d36aaccafa9d98d84c3d1a537af4ee29b5255022d2565d78792db0f4','originalMode':'0o400'},'candidate-image-fresh-inspect-original.json':{'bytes':7229,'sha256':'c4b4d2fabe2783adf0eb6f842bb424982fcb6a7d53753b3dde2c79800f821c14','originalMode':None}},'requiredMatches':['Original candidate ID equals first forensic response Id','Successful original build log exported image ID equals the same ID','New fresh inspect matches first forensic Id/RootFS layers/revision/all Config','Any reference bytes/image difference STOP','New receipt records actual reference roles and absent original inspect honestly'],'originalRootWrites':0,'otherFiveScopeConditionsUnchanged':True,'newToolingSource':None,'newSourceReview':None,'newReceipt':None,'newExecutionAuthority':None}
save('corrected-reference-set.json',(json.dumps(reference,indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 actualCl referenceanswer6180335648 — source preparation authorized, execution NOT\n\nActualCl22:57:41UTC correctscondition2 filename mistake: originalinspectfile remainsABSENT, reference originalcandidateid600/sealedlog400 + explicitlydistinctfirstforensicinspectc4b4d2fa.../7229B/a514. BindoriginalcandidateId=forensicId=successfulbuildlogexportedId; freshinspectId/RootFSlayers/revision/Config exactmatch; anybytes/mismatchSTOP; newreceipt roles/absencehonest. Other5scope618023 conditions unchanged/full3,609,116,672B boundednonDUattribution/residual>=500MBSTOP/currentallFSfloor/zerooperations. Direction ONLY: concrete NEWexact-sourcePASS required before anythingadopts/runs. Fullrawanswer/currentdirection/referenceJSON at actual-forward-reference-answer-6180335648/index.json. Neverduplicate618029question/answerack or oldscopequestion. Firstfailedroot/image/gate unchanged; no newsource/receipt/execution/proof/kit/gate/deploy.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':reference['status'],'referenceAnswerId':6180335648,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],'newSourceReview':None,'newExecutionAuthority':None},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain actual forensic reference direction without adoption authority')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':reference['status'],'head':head,'verifiedBlobs':len(paths),'referenceAnswerId':6180335648,'newSourceReview':None,'newExecutionAuthority':None}))
