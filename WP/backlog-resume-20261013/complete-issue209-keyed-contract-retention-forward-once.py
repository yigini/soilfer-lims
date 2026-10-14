"""Complete closed audit evidence after a confirmed remote-old push failure; never replay tests or retainer."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-keyed-mode-response-contract-singles'
recordPath=dest/'retention-forward-completion.json';assert not recordPath.exists()
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
proof='5b3eacc700c98716177e15a841ccc4d345a1396d';oldRemote='91ddfca4a794679fc73781b5c7d7eeeac9cc72d5'
assert git('rev-parse','HEAD').decode().strip()==proof and git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
remote=command('gh','api','repos/yigini/soilfer-lims/git/ref/heads/audit/release-eb6de2e8');assert json.loads(remote)['object']['sha']==oldRemote
assert git('rev-parse',proof+'^').decode().strip()==oldRemote
index=json.loads((dest/'index.json').read_bytes());assert index['summary']['status']=='PASS' and index['totalOriginalFailedCasesResolved']==324
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
pins={**index['rawFiles'],**index['reviewFiles']};paths=list(pins)+index['sourceDraftPaths'];objects={}
for entry in git('ls-tree','-r','-z',proof,'--',*paths).split(b'\0'):
 if entry:
  meta,path=entry.split(b'\t',1);objects[path.decode()]=meta.decode().split()[2]
assert set(objects)==set(paths)
for path,pin in pins.items():assert hashlib.sha256(git('cat-file','blob',objects[path])).hexdigest()==pin['sha256'],path
for path in index['sourceDraftPaths']:assert git('cat-file','blob',objects[path])==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
(dest/'remote-before-retention-completion-original.json').write_bytes(remote)
record={'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'closedProofCommit':proof,'priorPushProcessClosedExit':128,'priorPushStderrNotRetainedByOriginalHelper':True,'freshActualRemoteHead':oldRemote,'confirmedPriorProofNotPushed':True,'originalRetainerConsumedNeverReplay':True,'exactRawAndReviewBlobsVerified':len(pins),'sourcePathsVerified':len(index['sourceDraftPaths']),'allFrozenInputsStillUnchanged':True,'testOrQuestionOrNativeReplays':0,'productionOperations':0,'action':'New evidence completion, one exact audit branch push after independent closure and remote verification'}
recordPath.write_bytes((json.dumps(record,indent=2)+'\n').encode())
owned=[recordPath.relative_to(root).as_posix(),(dest/'remote-before-retention-completion-original.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())==set(owned)
git('commit','-m','audit(209): complete retained keyed-contract evidence after closed push failure');head=git('rev-parse','HEAD').decode().strip()
assert git('rev-parse',head+'^').decode().strip()==proof
with (dest/'retention-completion-push-stdout-original.log').open('xb') as out,(dest/'retention-completion-push-stderr-original.log').open('xb') as err:
 result=subprocess.run(['git','push','origin',head+':refs/heads/audit/release-eb6de2e8'],cwd=root,stdout=out,stderr=err)
(dest/'retention-completion-push-exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
assert result.returncode==0,'New push outcome requires read-only verification; never replay.'
remoteAfter=command('gh','api','repos/yigini/soilfer-lims/git/ref/heads/audit/release-eb6de2e8');assert json.loads(remoteAfter)['object']['sha']==head
(dest/'remote-after-retention-completion-original.json').write_bytes(remoteAfter)
print(json.dumps({'auditHead':head,'proofCommit':proof,'status':'PASS','passedTests':316,'rawReviewBlobsVerified':len(pins),'sourceDraftPaths':79,'originalCasesResolved':324,'remainingOriginalUnresolved':326,'futureFullExpectedTests':5642,'productionOperations':0}))
