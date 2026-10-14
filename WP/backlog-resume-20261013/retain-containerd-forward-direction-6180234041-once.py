"""Retain actual forward scope and the missing-original-inspect boundary without inventing it."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'actual-containerd-forward-direction-6180234041'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='eec2b9b5b33aff97884a940aad175db583948591'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
answer_raw=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6180234041');answer=json.loads(answer_raw)
assert answer['id']==6180234041 and answer['performed_via_github_app']['slug']=='claude' and answer['created_at']==answer['updated_at'] and answer['body'].startswith('Scope direction on 6180207219:')
assert 'in scope' in answer['body'] and 'This is direction only.' in answer['body'] and 'approves no source, execution or receipt yet.' in answer['body'] and '3,609,116,672' in answer['body']
closed=SOURCE/'first-build-221500-closed-terminal';facts=json.loads((closed/'remote-closed-original-index.json').read_bytes())
assert 'image-inspect-original.json' not in facts['ownedInventory'] and 'image-inspect-original.json' not in facts['originals']
assert facts['originals']['docker-build.log']['mode']=='0o400'
inspect=closed/'candidate-image-fresh-inspect-original.json';inspect_sha=hashlib.sha256(inspect.read_bytes()).hexdigest()
assert inspect_sha==facts['originals']['candidate-image-fresh-inspect-original.json']['sha256']
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('actual-direction-original.json',answer_raw);save('actual-direction-readable.txt',answer['body'].encode())
save('current-main-original.json',cmd('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main'))
boundary={'status':'ACTUAL_SCOPE_IN_SCOPE_NO_EXECUTION_MISSING_ORIGINAL_INSPECT_NEEDS_REFERENCE_CLARIFICATION','directionId':6180234041,'directionUtc':answer['created_at'],'originalRoot':facts['root'],'originalClosedInspectionUtc':facts['observedUtc'],'originalImageInspectFilePresent':False,'originalBuildCodeAbortedBeforeImageInspectStep':True,'originalCandidateIdFact':facts['originals']['candidate-image.id'],'originalBuildLogFact':facts['originals']['docker-build.log'],'firstRetainedForensicInspectPath':inspect.relative_to(REPO).as_posix(),'firstRetainedForensicInspectSha256':inspect_sha,'firstRetainedForensicInspectGitAudit':'a514c0a49a7487f44b33e27a7390972926a56307','forensicInspectIsOriginalFailedRootFile':False,'originalRootWrites':0,'newSourceReview':None,'newExecutionAuthority':None,'newReceipt':None,'attributionRequiredBytes':3609116672,'unexplainedStopThresholdBytes':500000000,'recursiveDuAllowed':False,'containerdAndDockerRequiredInFutureFilesystemSet':True,'ifConditions2to4Unproved':'STOP_IMAGE_EXCLUDED'}
save('original-inspect-reference-boundary.json',(json.dumps(boundary,indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 actualCl forward scope6180234041 — direction ONLY, missing inspect reference\n\nActualCl22:49:57UTC says read-only existingoncebuiltimage forwardreceipt route INscope, but NOsource/execution/receipt approval. All6conditions apply: originalfailureunchanged; imageID/RootFS/Config/sealedlog match; boundedmetadata-only attribute3,609,116,672B containerd candidate/base snapshots/content, residual>=500MBSTOP/no recursivedu; currentallfilesystemsfloor includingcontainerd; ZERO buildretagpullpushsaveloadstartpruneDBvolumedaemonconfig/outside-newrootwrite; separatefutureproof/kit/gate. Actualfailedroot nevercreatedimage-inspect-original.json becausegateabortedbeforethatstep. Firstretainer forensicinspectc4b4d2fa... at22:40:05UTC/a514 is differentoriginalartifact; no fictionalfailedrootfile/permissioninferred. Need narrowClreferenceclarification forcondition2 before anyadoption. Fullrawdirection/boundary at actual-containerd-forward-direction-6180234041/index.json. No newsource/root/receipt/executionauthority; originalfirstbuild consumedfailed.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':boundary['status'],'directionId':6180234041,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],'newExecutionAuthority':None},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels)
for p,rel in zip(paths,rels):assert cmd('git','show',':'+rel)==p.read_bytes()
cmd('git','commit','-m','Retain actual forward direction and missing original image-inspect reference')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):assert cmd('git','show',head+':'+rel)==p.read_bytes()
cmd('git','push','origin','audit/release-eb6de2e8')
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'status':boundary['status'],'head':head,'verifiedBlobs':len(paths),'directionId':6180234041,'firstForensicInspectSha256':inspect_sha,'newExecutionAuthority':None}))
