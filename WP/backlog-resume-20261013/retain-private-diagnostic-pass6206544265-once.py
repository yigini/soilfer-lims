"""Retain the actual exact privacy-source PASS and independent bindings, once."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2]
REL='WP/jobs-row-diagnostic-private-be837974-20261016/'
B=W/REL
D=B/'actual-source-pass6206544265-once'
BASE='fbb1aba271fb5b3aa8613e02678cdf76c4900d65'
SOURCE='46338c544e44e56091eb3b18edc515ece5d44095'
sys.path.insert(0,str(B))
from diagnostic_contract import *
import prepare_diagnostic as prep
def git(*args,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=W,input=input)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
def batch(ref,names):
    data=git('cat-file','--batch',input=('\n'.join(ref+':'+n for n in names)+'\n').encode());at=0;out={}
    for n in names:
        end=data.index(b'\n',at);given,kind,size=data[at:end].decode().split();size=int(size);at=end+1
        raw=data[at:at+size];at+=size
        require(kind=='blob' and given==oid(raw) and data[at:at+1]==b'\n','Raw Git object differs');at+=1;out[n]=raw
    require(at==len(data),'Expanded raw publication');return out
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused retention required')
index=strict((B/'exact-source-review105-private-once/source-index.json').read_bytes())
require(index['head']==SOURCE and len(index['files'])==8 and len(index['data'])==3 and len(tokens(index))==44,'Exact privacy graph required')
verified=[];index_originals=[]
for ref,path,count in [(SOURCE,REL+'source105-publication-once/publication-index.json',262),(BASE,REL+'review105-private-handoff-publication-once/publication-index.json',207),('bb2d337dc4e39021bf413dbe31c2749bb02da65a','WP/jobs-row-diagnostic-be837974-20261016/source80-publication-once/publication-index.json',184)]:
    raw=batch(ref,[path])[path];pub=strict(raw);rows=pub['bindings'];require(len(rows)+1==count,'Publication count differs')
    raws=batch(ref,[r['path'] for r in rows])
    for r in rows:
        b=raws[r['path']];require(len(b)==r['bytes'] and sha(b)==r['sha256'],'Publication byte binding differs '+r['path'])
    verified.append({'head':ref,'index':path,'countIncludingIndex':count,'indexSha256':sha(raw),'indexGitBlobOid':oid(raw),'allRawGitOidShaLengthVerified':True})
    index_originals.append(raw)
prep.published(index)
old=strict((W/'WP/batch-proof-jobs-intake-be837974-20261016/exact-source-review323-once/tooling-source-index.json').read_bytes())
require(len(old['files'])==26,'Old proof inventory differs')
for n,p in old['files'].items():require(sha((W/'WP/batch-proof-jobs-intake-be837974-20261016'/n).read_bytes())==p['sha256'],'Old proof source changed '+n)
old_diag=strict((W/'WP/jobs-row-diagnostic-be837974-20261016/exact-source-review80-git-aware-once/source-index.json').read_bytes())
for group in ['files','data']:
    for n,p in old_diag[group].items():require(sha((W/'WP/jobs-row-diagnostic-be837974-20261016'/n).read_bytes())==p['sha256'],'Old diagnostic source/data changed '+n)
captures=[];original=prep.command
def capture(*args):
    raw=original(*args)
    if args[:2]==('gh','api'):captures.append((list(args),raw))
    return raw
prep.command=capture
review_raw=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6206544265');review=strict(review_raw)
approval(review,index)
require(review['id']==6206544265 and review['created_at']==review['updated_at']=='2026-10-16T02:16:57Z','Actual PASS identity differs')
evidence=prep.current_evidence(review,index)
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
save('actual-source-pass-original.json',review_raw);save('actual-source-pass-readable.txt',review['body'].encode())
save('source-index.json',canonical(index)+b'\n');save('current-authority-evidence.json',canonical(evidence)+b'\n')
for k,raw in enumerate(index_originals):save('prior-publication-index-'+str(k)+'.json',raw)
for k,(_,raw) in enumerate(captures):save('api-original-'+str(k).zfill(2)+'.json',raw)
save('api-command-index.json',canonical([{'file':'api-original-'+str(k).zfill(2)+'.json','argv':a,'bytes':len(b),'sha256':sha(b),'gitBlobOid':oid(b)} for k,(a,b) in enumerate(captures)])+b'\n')
record={'status':'ACTUAL_EXACT_PRIVATE_DIAGNOSTIC_SOURCE_PASS_VALIDATED_NOT_EXECUTED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':SOURCE,'sourceReviewId':review['id'],'reviewCreatedUtc':review['created_at'],'reviewBodySha256':sha(review['body'].encode()),'literalBindings':44,'publications':verified,'all8Source3DataAnd1333AppUnchanged':True,'all26OldProofSourcesAndOld8Source3DataUnchanged':True,'currentAuthoritiesVerified':True,'root':str(ROOT),'unit':UNIT,'attemptsAllowed':1,'retryAllowed':False,'packagePrepared':False,'hostOperations':0,'actualDiagnosticSql':0,'reviewConditions':['One exact graph attempt; any refusal consumes it; unknown outcome inspect same root/unit, never redispatch','Fresh floor plus existing 4GiB logs, exact package before ROOT only; unused root/unit and exact six stat-only inputs','Only public diagnostic files may be published; all private row files and HMAC key remain withheld on host','Actual diagnostic result requires Claudio acceptance before Step2; main held; no kit/gate/deploy or YY question']}
save('independent-pass-validation.json',canonical(record)+b'\n')
lead=('LATEST ACTUAL EXACT PRIVACY DIAGNOSTIC SOURCE PASS6206544265 - 2026-10-16T02:16:57Z.\n\n'
      'Full actual unedited Claude app1236702/slugclaude Source review: PASS read; own diagnostic_contract.approval validates exact46338c544e44e56091eb3b18edc515ece5d44095/ALL8SHA+ALL44tokens+3data. ALL262source publication,207handoff and184old publication rawGitOID/SHA/length bindings independently reverified;8source3data/1333app/26oldproof/old8source3data unchanged. Fresh currentbe/mainCI38772398721 attempt1 push CLOSED SUCCESS/4audits6rules2postreboot memorydirection/jobsScope/R2accepted/2diagnosticscopes/privacyfindings/#191CLOSED/no laterfailure verified. Full raw PASS and current authority at '+REL+'actual-source-pass6206544265-once/publication-index.json.\n'
      'ONE exact new023000 diagnostic attempt permitted conditional fresh floor10556150894+4GiBlogs/exactfuturepackage charged beforeROOT only/six stat-only pins/unusedrootunit. No package/remote root/unit/actual diagnostic SQL yet. Prepare and publish ONE package then reviewed launcher. Every refusal consumes attempt; unknown inspect SAME root/unit, never redispatch. Publish ONLY public files; private row files and HMAC key remain withheld HOST. Diagnostic RESULT needs actual Claudio acceptance BEFORE Step2/remedy/YY question. MainMERGEHOLD/no kit/gate/deploy. Nativefallback CANCELLED/answer arrived/no duplicateACK/GH/native; bundle620654PASS ACK ONLY actual result. 233000latestpassingKEEPIT/R2COMPLETE/no prune/YYspacealreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10 ONLY actualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode())
readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    prior=p.read_bytes();p.write_bytes(lead.encode()+prior);require(p.read_bytes()[len(lead.encode()):]==prior,'Prior history changed')
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes]
save('publication-index.json',canonical({'sourceReviewId':review['id'],'bindings':[{'path':p.relative_to(W).as_posix(),'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json')
names=[p.relative_to(W).as_posix() for p in paths];fd,pf=tempfile.mkstemp(prefix='lims-private-pass-',suffix='.paths');os.close(fd);pathlib.Path(pf).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+pf,'--pathspec-file-nul')
require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
def verify(ref):
    raws=batch(ref,names) if ref else None
    if ref:
        for p,n in zip(paths,names):require(raws[n]==p.read_bytes(),'Committed bytes differ')
    else:
        for p,n in zip(paths,names):require(git('show',':'+n)==p.read_bytes(),'Staged bytes differ')
verify(None);git('commit','-m','Retain exact privacy diagnostic source PASS6206544265');head=git('rev-parse','HEAD').decode().strip();verify(head)
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs')
print(json.dumps({'audit':head,'pass':review['id'],'rawPublished':len(paths),'bindings':44,'sourcePublicationCount':262,'hostOperations':0}))
