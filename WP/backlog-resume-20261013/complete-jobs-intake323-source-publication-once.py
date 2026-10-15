"""Complete exact owned publication after ignored-log staging refusal. No source/operator replay."""
import hashlib,json,os,pathlib,subprocess,tempfile
W=pathlib.Path(__file__).resolve().parents[2];R='WP/batch-proof-jobs-intake-be837974-20261016';B=W/R
def cmd(*a,input=None):return subprocess.check_output(a,cwd=W,input=input)
def sha(b):return hashlib.sha256(b).hexdigest()
def enc(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()+b'\n'
assert cmd('git','rev-parse','HEAD').strip()==b'9aa32f1a857e8c315a17c9117623763b2de9feca'
ip=R+'/source-publication-index323.json';raw=(W/ip).read_bytes();idx=json.loads(raw)
paths=[r['path'] for r in idx['files']]+[ip];assert len(paths)==len(set(paths))
staged={n.decode() for n in cmd('git','diff','--cached','--name-only','-z').split(b'\0') if n};assert staged<=set(paths),'Unrelated staged files must remain untouched'
for r in idx['files']:
 b=(W/r['path']).read_bytes();assert len(b)==r['length'] and sha(b)==r['sha256']
extra=R+'/publication-completion323-once';D=W/extra;assert not D.exists();D.mkdir()
record={'status':'EXACT_OWNED_STAGING_COMPLETION_NO_SOURCE_TEST_OR_HOST_REPLAY','firstPublisherFailure':'git add returned exit1 for explicit ignored *.log paths; some exact owned paths staged, no commit/push occurred. Original helper and publication index immutable. Completion explicitly force-adds ONLY the indexed owned paths, retains every original raw log, validates all staged bytes before commit.','failureEvidenceRole':'TOOL_OUTPUT_TRANSCRIPTION_NOT_NEW_RAW_CAPTURE','originalIndexSha256':sha(raw),'firstHelper':'WP/backlog-resume-20261013/publish-jobs-intake323-complete-source-once.py','sourceChanged':False,'testsReplayed':False,'hostOperations':0}
(D/'completion-derived-record.json').write_bytes(enc(record));(D/'completion-helper-source.py').write_bytes(pathlib.Path(__file__).read_bytes())
newpaths=[extra+'/completion-derived-record.json',extra+'/completion-helper-source.py','WP/backlog-resume-20261013/'+pathlib.Path(__file__).name]
rows=[]
for n in newpaths:
 b=(W/n).read_bytes();rows.append({'path':n,'length':len(b),'sha256':sha(b),'gitBlobOid':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()})
ci=R+'/source323-publication-completion-index.json';(W/ci).write_bytes(enc({'originalIndex':ip,'originalIndexSha256':sha(raw),'files':rows}))
paths+=newpaths+[ci]
fd,p=tempfile.mkstemp(prefix='lims-jobs323-complete-',suffix='.paths');os.close(fd);pathlib.Path(p).write_bytes(b'\0'.join(x.encode() for x in paths)+b'\0')
cmd('git','-c','core.longpaths=true','-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+p,'--pathspec-file-nul')
staged={n.decode() for n in cmd('git','diff','--cached','--name-only','-z').split(b'\0') if n};assert staged==set(paths)
batch=cmd('git','cat-file','--batch',input=('\n'.join(':'+n for n in paths)+'\n').encode());at=0
for n in paths:
 end=batch.index(b'\n',at);oid,kind,sz=batch[at:end].decode().split();sz=int(sz);at=end+1;b=batch[at:at+sz];at+=sz
 assert kind=='blob' and batch[at:at+1]==b'\n' and b==(W/n).read_bytes(),n;at+=1
 assert hashlib.sha1(('blob '+str(sz)+'\0').encode()+b).hexdigest()==oid
assert at==len(batch)
cmd('git','commit','-m','Publish complete jobs intake qualification source and all 323 local host guard originals')
head=cmd('git','rev-parse','HEAD').decode().strip();assert set(cmd('git','diff-tree','--no-commit-id','--name-only','-r',head).decode().splitlines())==set(paths)
cmd('git','push','origin','HEAD:audit/release-eb6de2e8');assert not cmd('git','diff','--cached','--name-only').strip()
print(json.dumps({'status':'PUBLISHED','head':head,'allRawGitOidShaLengthFilesIncludingBothIndices':len(paths),'testsLocalAndActualHost':323,'sourceFiles':26,'sourceTestsHostOperatorsReplayed':0,'pathspecRetained':p},ensure_ascii=True))
