"""Finish retained PASS after Git-show long-filename refusal; verify blobs by exact object ids, once."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-result-policy-qc-cancellation-query-corrected-singles'
recordPath=dest/'retention-objectid-recovery.json';assert not recordPath.exists()
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
expected='28d85ba985ad80d6c1186afa4b995f6f9faeb0fd'
assert git('rev-parse','HEAD').decode().strip()==expected and git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]=='ec797f9dc9322abdae12ff7f4136526433f5b73a'
index=json.loads((dest/'index.json').read_bytes());assert index['summary']['status']=='PASS' and index['totalOriginalFailedCasesResolved']==320
pins={**index['rawFiles'],**index['reviewFiles'],**index['nativeFiles']}
paths=list(pins)+index['sourceDraftPaths']
entries={}
for entry in git('ls-tree','-r','-z',expected,'--',*paths).split(b'\0'):
 if not entry:continue
 meta,path=entry.split(b'\t',1);mode,kind,oid=meta.decode().split();assert kind=='blob';entries[path.decode()]={'oid':oid,'mode':mode}
assert set(entries)==set(paths)
verified=[]
for path,pin in pins.items():
 raw=git('cat-file','blob',entries[path]['oid']);assert hashlib.sha256(raw).hexdigest()==pin['sha256'] and len(raw)==pin['bytes'],path
 assert raw==(root/path).read_bytes(),path
 verified.append({'path':path,'blobOid':entries[path]['oid'],'sha256':pin['sha256'],'bytes':len(raw)})
for path in index['sourceDraftPaths']:assert git('cat-file','blob',entries[path]['oid'])==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'closedProofCommit':expected,'originalRetainerConsumed':True,'originalFailure':'git show fullSHA:path failed to stat: Filename too long, AFTER local commit, BEFORE any push; paths exist in committed tree','verificationMethod':'git ls-tree exact commit and git cat-file blob by returned immutable object id; no Git configuration change','rawAndReviewAndNativeBlobsVerified':verified,'sourcePathsVerified':len(index['sourceDraftPaths']),'applicationTestFailure':False,'productionOperations':0,'runnerReplays':0,'questionOrNativeReplays':0}
recordPath.write_bytes((json.dumps(record,indent=2)+'\n').encode())
owned=[recordPath.relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())==set(owned)
git('commit','-m','audit(209): verify retained PASS blobs by object id after path limit');head=git('rev-parse','HEAD').decode().strip()
for entry in git('ls-tree','-r','-z',head,'--',*paths).split(b'\0'):
 if not entry:continue
 meta,path=entry.split(b'\t',1);assert meta.decode().split()[2]==entries[path.decode()]['oid']
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'auditHead':head,'closedProofCommit':expected,'passedTests':437,'closedSingleSuites':7,'rawReviewNativeGitBlobsVerified':len(verified),'sourceDraftPaths':78,'originalCasesResolved':320,'remainingOriginalUnresolved':330,'productionOperations':0}))
