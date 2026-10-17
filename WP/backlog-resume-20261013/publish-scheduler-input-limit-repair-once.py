from pathlib import Path
import subprocess,json,hashlib
w=Path(r'C:/Users/yigin/.codex/worktrees/audit-qc-integration/soilfer-lims');d=w/'WP/backlog-resume-20261013/scheduler-input-limit-repair-20261017-once'
def git(*args):return subprocess.check_output(['git',*args],cwd=w)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def oid(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def save(name,data):
 p=d/name
 with p.open('xb') as f:f.write(data)
 p.chmod(0o400)
assert git('rev-parse','HEAD').decode().strip()=='dcea0ea56556cc057be910ee72344fc30344900e'
assert not git('diff','--cached','--name-only').strip()
assert not git('diff','--name-only','--','WP/batch-release-kit-be837974-20261016').strip()
record=json.loads((d/'repair-readback.json').read_bytes());assert record['promptCharacters']==11807 and record['historyArchiveVerbatimVerified']
private=['automation-original.toml','prior-automation-prompt-verbatim.txt','selected-native-failure-lines-original.log','automation-repaired.toml']
rows=[]
for name in private:
 raw=(d/name).read_bytes();rows.append({'path':str(d/name),'bytes':len(raw),'sha256':sha(raw),'privateBytesPublished':False})
save('private-history-hash-inventory.json',(json.dumps({'privateHistoryFiles':rows,'allHistoryPreservedVerbatim':True,
 'originalInputCharacters':1051046,'activeInputCharacters':11807,'completeSourceKitUnchanged':True},sort_keys=True,indent=2)+'\n').encode())
paths=[d/n for n in ('diagnosis.json','repair-readback.json','compact-prompt.txt','private-history-hash-inventory.json')]+[Path(__file__).resolve()]
bindings=[]
for p in paths:
 raw=p.read_bytes();bindings.append({'path':p.relative_to(w).as_posix(),'bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)})
save('publication-index.json',(json.dumps({'baseAudit':git('rev-parse','HEAD').decode().strip(),'bindings':bindings,
 'privatePromptAndOriginalNativeLogsAreNotPublished':True,'sourceKitChanged':False},sort_keys=True,indent=2)+'\n').encode())
paths.append(d/'publication-index.json')
forbidden=set(private)
assert not any(p.name in forbidden for p in paths)
rels=[p.relative_to(w).as_posix() for p in paths]
subprocess.run(['git','-c','core.autocrlf=false','add','-f','--pathspec-from-file=-','--pathspec-file-nul'],
 cwd=w,input=b'\0'.join(p.encode() for p in rels)+b'\0',check=True)
staged=set(git('diff','--cached','--name-only','-z').decode().rstrip('\0').split('\0'));assert staged==set(rels)
for p,name in zip(paths,rels):assert git('show',':'+name)==p.read_bytes()
subprocess.run(['git','-c','core.autocrlf=false','commit','-m','fix(automation): keep LIMS heartbeat below input limit'],cwd=w,check=True,stdout=subprocess.PIPE)
head=git('rev-parse','HEAD').decode().strip()
subprocess.run(['git','push','origin','HEAD:refs/heads/audit/release-eb6de2e8'],cwd=w,check=True,stdout=subprocess.PIPE)
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
for p,name in zip(paths,rels):assert git('show',head+':'+name)==p.read_bytes()
assert not git('diff','--cached','--name-only').strip() and not git('diff','--name-only','--','WP/batch-release-kit-be837974-20261016').strip()
print(json.dumps({'head':head,'publishedMetadataFiles':len(paths),'privateHistoryFilesRetainedOnlyLocally':len(private),
 'index':(d/'publication-index.json').relative_to(w).as_posix(),'indexSha256':sha((d/'publication-index.json').read_bytes()),
 'sourceKitUnchanged':True,'stagedEmpty':True,'remoteExactHead':True}))
