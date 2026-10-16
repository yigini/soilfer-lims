"""Publish validated closed diagnostic public evidence and fresh authorities, once."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/jobs-row-diagnostic-private-be837974-20261016/';B=W/REL;D=B/'closed-diagnostic023000-publication-once';O=B/'second-diagnostic023000-readonly-originals-once';V=B/'closed-diagnostic023000-independent-validation-once';P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z'
BASE='fd0e9eaafd5c82fe26e3fe498ee1f54b806b2ca0'
sys.path.insert(0,str(B));from diagnostic_contract import *
import prepare_diagnostic as prep
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def batch(prefix,names):
 raw=git('cat-file','--batch',input=('\n'.join(prefix+n for n in names)+'\n').encode());at=0;out={}
 for n in names:
  end=raw.index(b'\n',at);given,kind,size=raw[at:end].decode().split();size=int(size);at=end+1;b=raw[at:at+size];at+=size
  require(kind=='blob' and given==oid(b) and raw[at:at+1]==b'\n','Raw publication differs');at+=1;out[n]=b
 require(at==len(raw),'Expanded raw batch');return out
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused publication required')
record=strict((V/'closed-independent-result.json').read_bytes());require(record['status']=='CLOSED_PRIVATE_DIAGNOSTIC_PUBLIC_EVIDENCE_VALIDATED_AWAITING_CLAUDIO_ACCEPTANCE' and record['stopClassifications']==[] and record['privateFileContentsFetched']==0,'Actual validated diagnostic required')
require(sha((O/'public-originals/public-terminal.json').read_bytes())==record['terminalSha256'] and sha((O/'public-originals/public-diagnostic-result.json').read_bytes())==record['resultSha256'],'Validated originals changed')
index=strict((P/'source-index.json').read_bytes());review=strict((P/'source-review.json').read_bytes());approval(review,index);prep.published(index)
pubs=[]
for head,path,count in [(index['head'],REL+'source105-publication-once/publication-index.json',262),('fbb1aba271fb5b3aa8613e02678cdf76c4900d65',REL+'review105-private-handoff-publication-once/publication-index.json',207),('bb2d337dc4e39021bf413dbe31c2749bb02da65a','WP/jobs-row-diagnostic-be837974-20261016/source80-publication-once/publication-index.json',184),('b5a6c3113459576a68177f2c1b31b97067357065',REL+'actual-source-pass6206544265-once/publication-index.json',46),('b8073dccf52848841295245383397cb4d5fbe4f2',REL+'reviewed-package6206544265-publication-once/publication-index.json',26),(BASE,REL+'first-diagnostic023000-complete-opening-publication-once/publication-index.json',94)]:
 b=batch(head+':',[path])[path];rows=strict(b)['bindings'];require(len(rows)+1==count,'Prior publication count differs');raws=batch(head+':',[r['path'] for r in rows])
 for r in rows:
  v=raws[r['path']];require(len(v)==r['bytes'] and sha(v)==r['sha256'],'Prior publication bytes differ')
 pubs.append({'head':head,'index':path,'rawFiles':count,'allRawGitOidShaLengthVerified':True})
captures=[];original=prep.command
def capture(*a):
 b=original(*a)
 if a[:2]==('gh','api'):captures.append((list(a),b))
 return b
prep.command=capture;evidence=prep.current_evidence(review,index)
D.mkdir()
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
save('current-authority-evidence.json',canonical(evidence)+b'\n')
for k,(_,b) in enumerate(captures):save('api-original-'+str(k).zfill(2)+'.json',b)
save('api-command-index.json',canonical([{'file':'api-original-'+str(k).zfill(2)+'.json','argv':a,'bytes':len(b),'sha256':sha(b),'gitBlobOid':oid(b)} for k,(a,b) in enumerate(captures)])+b'\n')
save('closed-publication-validation.json',canonical({'verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':record['status'],'independentResultSha256':sha((V/'closed-independent-result.json').read_bytes()),'publicTerminalSha256':record['terminalSha256'],'publicDiagnosticResultSha256':record['resultSha256'],'priorPublications':pubs,'currentAuthoritiesVerified':True,'onlyPublicContentsPublished':True,'privateContentsFetched':0,'step2Authorized':False,'releaseQualified':False})+b'\n')
lead=('LATEST ACTUAL CLOSED PRIVACY DIAGNOSTIC023000 CLASSIFIED RESULT - '+record['actualClosedUtc']+' / independent public validation '+record['validatedUtc']+'.\n\n'
 'SAME ONE46338c54/PASS6206544265/root '+str(ROOT)+' /unit '+UNIT+' /invocation9026c0ad2c4849e3ac5f2595aeaeec77 ACTUALLY CLOSED success02:32:56.577631UTC; started02:31:15.569835UTC/101.007796s. Original0400 public-terminal SHA0911f2d5dcd2e519d3bbfa1abf0079ef014417acc5d2aa0d5fd87f559505a25c; public-result SHA0dc410dea0be27916082224488a409bb10e99a05ff1ec690e28bc0bd4b69a536/status DIAGNOSTIC_OBSERVED_CLASSIFIED_AWAITING_CLAUDIO_ACCEPTANCE/failure null/stopClasses[]/inputAfterVerifiedCount=resultValidCount=1/releasefalse/Step2false/retryfalse. Root/unit/PASS/package/operators consumed NEVERretryreplaycleanup.\n'
 'ALL112tables/schema unchanged/42receipts unchanged/0deleted. Existing Sample20 CHANGED ALL CROSS_SUBMISSION_DUPLICATE; columns EXACTmetadata,rejectionReason,updatedAt ONLY/EXPECTED beforeafter/oldvaluesretained/fieldMetadata unchanged. EACHadds conflictingSubmissions+provenanceHold, one source-bound retained-fetch submission/nonrefusal config, exact newPROVENANCEhold+HOLD_RAISED+KOBO_CONFLICTING_PROVENANCE pair by unchanged reviewed runtime. Public IDs/columns/paths/HMACs and20hold40audit pair IDs independently crosschecked against alladded row IDs. Added Sample174(39280->39454), AuditLog218(13209->13427), SampleHold22(12->34), Notification1(242->243); KoboConfig7 of11 onlylastSyncAt/updatedAt and one lastSubmissionId; all4refusalconfig IDs unchanged. All107other tables rowstreams identical.442 totalrowdiffs/442private-row originals+one private32byte HMACkey remain HOST ONLY/0400/no private bytes fetched. Publicshape EVERYrow/all20classifiers fully checked; no rawpayload/coords/names/keymaterial published. HMAC/rawrow predicates computed by unchanged exact reviewed runtime, not independently recomputed via privatekey/SQL replay.\n'
 'ALL6 input main/WAL/SHM fullSHAstat/ctime/nlink equal BEFOREAFTER/uniqueidentities; bothmain563322880 pageextent/quickcheckok/header18/19=2 observations preserved. ALL475rootfileSHAstatstable/all15uploadedpackage unchanged;473files0400+unitstdoutstderr0600. BOTH controller-memory files included shared terminalfiles[]/sharedsink4204211B inclterminal<268435456; ownunit oom=oom_kill0 BEFOREAFTER/memorymax805306368Swap0/afterpeak805306368/maxevents6859 observationsONLY. Fullsameinvocation4PID1journal records start/started/deactivatedsuccessfully/CPU preserved; unitGC/not-found/inactive/dead/defaultinfinity/sentinelpeak are CLOSEDdefaults NOTactualexecutedlimits. Actual active limits/sandbox retained in opening94rawfd0e9eaa. Rootallocatedfiles8839168B ONLY/notwhole-store growth; laterfree86701916160B observationONLY/notfuturecapacity. No newSQL/copy/du/productionmemorysampling byretainer.\n'
 'All262source+207handoff+184old+46PASS+26package+94opening rawGitOID/SHA/length reverified/8source3data1333app/26oldproofold8source3data unchanged/currentbeCI38772398721attempt1pushCLOSEDSUCCESS/4audits6rules2postreboot memorydirection/jobsScope/R2accepted/2diagnosticscopes/privacyfindings/#191CLOSED/no laterfailure fresh. Full public originals/independent validation at '+REL+D.name+'/publication-index.json. NEXT ONE@claude162 actualdiagnosticRESULT requesting acceptance, bundle620654PASS ACK ONLYthere. NO Step2 allowance/proof/remedy/YYquestion BEFORE actualClacceptsdiagnostic. No nativefallback/duplicateGH/ACK. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/no prune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
 old=p.read_bytes();p.write_bytes(lead.encode()+old);require(p.read_bytes()[len(lead.encode()):]==old,'History differs')
helpers=[pathlib.Path(__file__),W/'WP/backlog-resume-20261013/observe-private-diagnostic023000-second-readonly-once.py',W/'WP/backlog-resume-20261013/validate-private-diagnostic023000-closed-public-once.py']
paths=sorted([p for folder in [O,V,D] for p in folder.rglob('*') if p.is_file()])+helpers+readmes
require(not any(p.name.startswith('private-row-') or p.name=='private-value-hmac-key.json' for p in paths),'Private content publication refused')
save('publication-index.json',canonical({'sourceReviewId':review['id'],'bindings':[{'path':p.relative_to(W).as_posix(),'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,pf=tempfile.mkstemp(prefix='lims-diagnostic-closed-',suffix='.paths');os.close(fd);pathlib.Path(pf).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+pf,'--pathspec-file-nul');require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
raws=batch(':',names)
for p,n in zip(paths,names):require(raws[n]==p.read_bytes(),'Staged bytes differ')
git('commit','-m','Publish closed privacy diagnostic classified public result');head=git('rev-parse','HEAD').decode().strip();raws=batch(head+':',names)
for p,n in zip(paths,names):require(raws[n]==p.read_bytes(),'Committed bytes differ')
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs')
print(json.dumps({'audit':head,'rawPublished':len(paths),'status':record['status'],'privateContentsFetched':0,'actualDiagnosticClosed':True}))
