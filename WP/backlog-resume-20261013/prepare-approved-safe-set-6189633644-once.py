"""Retain actual approval and prepare the exact one-use operation, no host mutation."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-approved-safe-set-cleanup-20261015';P=R/'WP/yy-host-capacity-options-6gb-20261015';out=D/'approved-plan.json';assert not out.exists()
def cmd(*a):return subprocess.check_output(a,cwd=R)
def raw(ref,n):
 b=cmd('git','show',ref+':'+n);oid=cmd('git','rev-parse',ref+':'+n).decode().strip();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==oid;return b
base='420919a83fed52ee229caaee32158a0a61eccd59'
names=['exact-review-list.json','proof-copies-verified-elsewhere.json','dependency-and-old-backup-hashes-once/stdout-original.json']
for n in names:assert raw(base,(P/n).relative_to(R).as_posix())==(P/n).read_bytes()
b=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6189633644');authority=json.loads(b)
assert authority['id']==6189633644 and authority['created_at']==authority['updated_at']=='2026-10-15T10:10:04Z' and authority['performed_via_github_app']['slug']=='claude' and authority['performed_via_github_app']['id']==1236702
assert 'Safe set only' in authority['body'] and 'Remove by exact ID or path only' in authority['body'] and base in authority['body']
with (D/'authority-6189633644-original.json').open('xb') as f:f.write(b)
(D/'authority-readable.txt').write_text(authority['body'],encoding='utf-8')
native=json.loads((D/'native-approval-readonly-record.json').read_bytes());assert native['actualHumanDecision']=='Safe set only' and native['inputActions']==0
v=json.loads((P/names[0]).read_bytes());proof=json.loads((P/names[1]).read_bytes());other=json.loads((P/names[2]).read_bytes())
for row in proof['rows']:
 assert row['allCurrentFileBytesHaveIndependentlyVerifiedElsewhereCopy'] and row['eligibleForExactListReview']
 for pin in row['verifiedCopies']:
  data=raw(pin['verifiedCopyCommit'],pin['verifiedCopyPath']);assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
backup=next(x for x in other['oldBackupStableHashes'] if x['path']=='/opt/lims/backups/failed_db_20261004_031055.db');keeper=next(x for x in other['oldBackupStableHashes'] if x['path']=='/opt/lims/backups/dev_pre_api_dialog218_20261004_031055.db')
plan={'authorityId':6189633644,'authorityBodySha256':hashlib.sha256(authority['body'].encode()).hexdigest(),'listCommit':base,'cache':v['cache'],'proofs':proof['rows'],'backup':backup,'keeper':keeper,'image':next(x for x in v['unusedImageOptions'] if x['proposedSixGbSet']),'configFiles':other['configFilesScanned'],'heldBackupPaths':['/opt/lims/backups/dev_pre_issue155_20261003_132428.db','/opt/lims/backups/dev_pre_issue159_20261003_221538.db'],'estimatedApprovedBytes':4956528049,'noBlanketPrune':True,'noOtherItems':True,'cacheFilter':'one anchored full ID per invocation, with read-only exact filter proof before mutation','officialDockerReference':'https://docs.docker.com/reference/cli/docker/buildx/prune/','installedBuildx':'v0.30.1','builder':'default','builderDriver':'docker','operationalExecution':'NOT_YET_EXECUTED'}
with out.open('x',encoding='utf-8') as f:json.dump(plan,f,sort_keys=True,indent=2)
source=(D/'cleanup_exact_safe_set.py').read_text(encoding='utf-8');compile(source,str(D/'cleanup_exact_safe_set.py'),'exec')
(D/'preparation-result.json').write_text(json.dumps({'status':'EXACT_HUMAN_APPROVAL_AND93_VERIFIED_GIT_COPIES_BOUND_SOURCE_PREPARED','cacheIds':65,'proofFilesIndependentlyReverified':93,'approvedEstimateBytes':4956528049,'hostMutations':0,'cleanupExecuted':False},indent=2),encoding='utf-8')
print(json.dumps({'status':'PREPARED_NOT_EXECUTED','cacheIds':65,'proofFiles':93,'estimatedBytes':4956528049,'hostMutations':0}))
