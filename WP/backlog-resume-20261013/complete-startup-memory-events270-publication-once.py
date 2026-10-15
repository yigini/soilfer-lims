"""Complete unpublished270 source publication after LOCAL changed-vs-unchanged staging assertion."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-memory-events-be837974-20261015';BASE='f9df1588a46dbfdf819a9ff81ef15f5fc6b4566a';BRANCH='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from proof_contract import canonical,sha,FILES
def git(*a,payload=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R,input=payload)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()==BRANCH and git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==BASE
indexpath=S/'source-publication-index270.json';index=json.loads(indexpath.read_bytes());paths=[R/x['path'] for x in index['files']]+[indexpath];names=[p.relative_to(R).as_posix() for p in paths]
for x in index['files']:
 raw=(R/x['path']).read_bytes();assert len(raw)==x['length'] and sha(raw)==x['sha256'] and oid(raw)==x['gitBlobOid']
test=json.loads((S/'source-local-host270-complete-once/exit-original.json').read_bytes());assert test['status']=='PASS' and test['sourceSha256After']=={n:sha((S/n).read_bytes()) for n in FILES}
headrows={}
for row in git('ls-tree','-rz',BASE).split(b'\0'):
 if row:
  meta,name=row.split(b'\t',1);headrows[name.decode()]=meta.decode().split()[2]
changed={n for n,p in zip(names,paths) if headrows.get(n)!=oid(p.read_bytes())};staged=set(git('diff','--cached','--name-only').decode().splitlines());assert staged==changed,'Only exact owned changed paths may be staged'
record={'kind':'DERIVED_LOCAL_PUBLICATION_COMPLETION_RECORD','priorHelper':'publish-startup-memory-events270-complete-source-once.py','priorOutcome':'LOCAL_ASSERTION_AFTER_OWNED_STAGING_BEFORE_COMMIT','cause':'Prior publisher required all indexed names to be staged, including previously committed byte-identical paths. Git stages only changed/new paths. All actual staged paths are exactly the independently computed owned changes.','sourceOrTestsChanged':False,'all270LocalAnd270ActualHostGuardsRemainPass':True,'hostOrProofOperatorCalls':0,'oldHelperNeverReplayed':True,'indexedFilesBeforeCompletion':len(paths),'actualOwnedChangedFiles':len(changed),'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
recordpath=S/'source270-publication-completion-record.json';assert not recordpath.exists();recordpath.write_bytes(canonical(record)+b'\n')
extra=[recordpath,pathlib.Path(__file__)];extraindex=S/'source270-publication-completion-index.json'
extraindex.write_bytes(canonical({'sourceIndexSha256':sha(indexpath.read_bytes()),'sourceIndexPath':indexpath.relative_to(R).as_posix(),'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in extra]})+b'\n');extra.append(extraindex);paths+=extra;names=[p.relative_to(R).as_posix() for p in paths]
git('-c','core.autocrlf=false','add','-f','--',*[p.relative_to(R).as_posix() for p in extra]);assert set(git('diff','--cached','--name-only').decode().splitlines())==changed|{p.relative_to(R).as_posix() for p in extra}
def verify(ref):
 batch=git('cat-file','--batch',payload=('\n'.join(ref+':'+n for n in names)+'\n').encode());at=0
 for p in paths:
  end=batch.index(b'\n',at);obj,kind,size=batch[at:end].decode().split();size=int(size);raw=batch[end+1:end+1+size];at=end+2+size
  assert kind=='blob' and batch[at-1:at]==b'\n' and raw==p.read_bytes() and oid(raw)==obj
 assert at==len(batch)
verify(git('write-tree').decode().strip());git('commit','-m','Complete exact270 source publication with owned changed-path validation');head=git('rev-parse','HEAD').decode().strip();verify(head);git('push','origin',BRANCH)
assert git('ls-remote','origin','refs/heads/'+BRANCH).decode().split()[0]==head and not git('diff','--cached','--name-only').strip()
print(json.dumps({'sourceHead':head,'verifiedRawOidShaLengthFiles':len(paths),'all15SourceHashesUnchanged':True,'localAndHostGuards':270,'operatorsExecuted':0},ensure_ascii=True))
