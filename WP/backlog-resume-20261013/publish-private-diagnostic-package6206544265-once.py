"""Publish the exact approved local diagnostic package and originals, once."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/jobs-row-diagnostic-private-be837974-20261016';D=B/'reviewed-package6206544265-publication-once';E=B/'execute-reviewed-package6206544265-once';P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z'
BASE='b5a6c3113459576a68177f2c1b31b97067357065'
sys.path.insert(0,str(B))
from diagnostic_contract import *
import prepare_diagnostic as prep
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused publication required')
closed=strict((E/'exit-original.json').read_bytes());require(closed['status']=='APPROVED_PRIVATE_DIAGNOSTIC_LOCAL_PACKAGE_PREPARED' and closed['exitCode']==0,'Actual closed package required')
index=strict((P/'source-index.json').read_bytes());review=strict((P/'source-review.json').read_bytes());approval(review,index);prep.published(index)
require({p.name for p in P.iterdir()}==FILES|DATA|{'source-index.json','source-review.json','current-evidence.json','diagnostic-spec.json'},'Exact15 package required')
for n,pin in {**index['files'],**index['data']}.items():require((P/n).read_bytes()==(B/n).read_bytes() and sha((P/n).read_bytes())==pin['sha256'],'Package source differs')
hashes={p.name:sha(p.read_bytes()) for p in P.iterdir()};future=package_allowance([p.stat().st_size for p in P.iterdir()])
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
record={'status':'APPROVED_PRIVATE_DIAGNOSTIC_PACKAGE_VERIFIED_NOT_LAUNCHED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceReviewId':review['id'],'sourceHead':index['head'],'packageFileCount':len(hashes),'packageFileHashes':hashes,'futurePackageAllocationBytes':future,'all8Source3DataAnd1333AppUnchanged':True,'hostConnections':0,'actualDiagnosticSql':0}
save('package-publication-validation.json',canonical(record)+b'\n')
lead=('LATEST ACTUAL APPROVED PRIVACY DIAGNOSTIC PACKAGE PREPARED - '+closed['closedUtc']+'.\n\n'
      'ONE reviewed prepare_diagnostic actual invocation CLOSEDexit0; exact15-file localpackage under WP/jobs-row-diagnostic-private-be837974-20261016/'+P.name+' verified against source46338c54/PASS6206544265/all8source3data/1333app unchanged. Futurepackage4096rounded+2MiBdirs='+str(future)+'B charged BEFORE ROOT ONLY/alreadyoccupied beforeUNIT-runtime. Package/publication/closed originals at WP/jobs-row-diagnostic-private-be837974-20261016/reviewed-package6206544265-publication-once/publication-index.json. No host connection/root/unit/diagnostic SQL yet. NEXT ONE unchanged reviewedlauncher with fresh authority/all5remoteprograms compiled BEFORE SSH/floorlogs/unusedrootunit/exact6stat-only BEFORE_ROOT. Refusal consumes attempt; unknowninspectSAMErootunit/no replay. Public files ONLY; private rows/HMACkey withheld HOST. Actual diagnostic result requires Claudio acceptance BEFORE Step2/remedy/YY. MainMERGEHOLD/no kit/gate/deploy/no duplicateACK/native. All prior source/PASS/history constraints preserved verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    prior=p.read_bytes();p.write_bytes(lead.encode()+prior);require(p.read_bytes()[len(lead.encode()):]==prior,'History changed')
paths=sorted(p for p in P.iterdir() if p.is_file())+sorted(p for p in E.iterdir() if p.is_file())+sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),W/'WP/backlog-resume-20261013/execute-private-diagnostic-package6206544265-once.py',*readmes]
save('publication-index.json',canonical({'sourceReviewId':review['id'],'bindings':[{'path':p.relative_to(W).as_posix(),'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,pf=tempfile.mkstemp(prefix='lims-private-package-',suffix='.paths');os.close(fd);pathlib.Path(pf).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+pf,'--pathspec-file-nul');require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
def verify(prefix):
    raw=git('cat-file','--batch',input=('\n'.join(prefix+n for n in names)+'\n').encode());at=0
    for p in paths:
        end=raw.index(b'\n',at);given,kind,size=raw[at:end].decode().split();size=int(size);at=end+1;b=raw[at:at+size];at+=size;require(kind=='blob' and given==oid(b) and b==p.read_bytes() and raw[at:at+1]==b'\n','Publication raw differs');at+=1
    require(at==len(raw),'Expanded publication')
verify(':');git('commit','-m','Publish approved private diagnostic package6206544265');head=git('rev-parse','HEAD').decode().strip();verify(head+':');git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs')
print(json.dumps({'audit':head,'rawPublished':len(paths),'packageFiles':len(hashes),'futurePackageAllocationBytes':future,'hostConnections':0}))
