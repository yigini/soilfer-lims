"""Retain the one actual diagnostic-result delivery and current handoff, once."""
import datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/jobs-row-diagnostic-private-be837974-20261016/';B=W/REL;D=B/'actual-result6206867188-handoff-publication-once';A=B/'actual-diagnostic023000-result-request-once';P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z';BASE='3365c306d937b0b6cf7ca70960be5dc5fb7ecc35'
sys.path.insert(0,str(B));from diagnostic_contract import *
import prepare_diagnostic as prep
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def batch(prefix,names):
 raw=git('cat-file','--batch',input=('\n'.join(prefix+n for n in names)+'\n').encode());at=0;out={}
 for n in names:
  end=raw.index(b'\n',at);given,kind,size=raw[at:end].decode().split();size=int(size);at=end+1;b=raw[at:at+size];at+=size
  require(kind=='blob' and given==oid(b) and raw[at:at+1]==b'\n','Raw publication differs');at+=1;out[n]=b
 require(at==len(raw),'Expanded publication');return out
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused handoff required')
delivery=strict((A/'delivery-record.json').read_bytes());require(delivery['commentId']==6206867188 and delivery['requestJsonEqualsActualResponseEqualsFreshUneditedReadback'] is True,'Actual verified result delivery required')
req=strict((A/'request.json').read_bytes());posted=strict((A/'actual-post-response-original.json').read_bytes());readback=strict((A/'fresh-unedited-readback-original.json').read_bytes());require(req['body']==posted['body']==readback['body'] and sha(req['body'].encode())==delivery['bodySha256'],'Actual delivered bytes differ')
pubpath=REL+'closed-diagnostic023000-publication-once/publication-index.json';pubraw=batch(BASE+':',[pubpath])[pubpath];pub=strict(pubraw);require(len(pub['bindings'])+1==70,'Closed publication inventory differs');raws=batch(BASE+':',[r['path'] for r in pub['bindings']])
for r in pub['bindings']:require(len(raws[r['path']])==r['bytes'] and sha(raws[r['path']])==r['sha256'],'Closed result publication differs')
idx=strict((P/'source-index.json').read_bytes());review=strict((P/'source-review.json').read_bytes());approval(review,idx);prep.published(idx)
captures=[];original=prep.command
def capture(*a):
 b=original(*a)
 if a[:2]==('gh','api'):captures.append((list(a),b))
 return b
prep.command=capture;evidence=prep.current_evidence(review,idx)
fresh=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6206867188');actual=strict(fresh);require(actual['body']==req['body'] and actual['created_at']==actual['updated_at'],'Result request was edited')
later_raw=capture('gh','api','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T02%3A44%3A00Z&per_page=100');later=strict(later_raw);require(len(later)<100,'Fresh target window requires pagination')
candidates=[c for c in later if c['id']>6206867188 and (c.get('performed_via_github_app') or {}).get('id')==1236702]
D.mkdir()
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
save('fresh-result-request-original.json',fresh);save('fresh-target-comments-original.json',later_raw);save('current-authority-evidence.json',canonical(evidence)+b'\n')
for k,(_,b) in enumerate(captures):save('api-original-'+str(k).zfill(2)+'.json',b)
save('api-command-index.json',canonical([{'file':'api-original-'+str(k).zfill(2)+'.json','argv':a,'bytes':len(b),'sha256':sha(b)} for k,(a,b) in enumerate(captures)])+b'\n')
state='ACTUAL_NEW_CLAUDE_REVIEW_PRESENT_READ_FULL_NO_APPROVAL_INFERRED' if candidates else 'ACTUAL_DIAGNOSTIC_RESULT_REVIEW_PENDING_AT_FRESH_CAPTURE'
record={'capturedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':state,'commentId':6206867188,'url':delivery['url'],'requestBodySha256':delivery['bodySha256'],'sameRequestResponseFreshUneditedReadback':True,'resultPublication':BASE,'sourcePassAckOnlyHere':6206544265,'reviewCandidateIds':[c['id'] for c in candidates],'currentSourceAppAuthoritiesVerified':True,'diagnosticClosed':True,'step2Authorized':False,'noActiveRemoteDiagnosticOrLocalOperator':True,'nativeFallbackNoEarlierUtc':'2026-10-16T03:04:35+00:00'}
save('handoff-record.json',canonical(record)+b'\n')
pending='Fresh capture has NO later actual Claude answer; actual diagnostic acceptance PENDING.' if not candidates else 'Fresh later Claude review candidates '+','.join(str(c['id']) for c in candidates)+' retained FULL; read full actual answer and all conditions before any next work. No acceptance inferred by this publisher.'
lead=('LATEST ONE ACTUAL PRIVACY DIAGNOSTIC RESULT REVIEW6206867188 POSTED - 2026-10-16T02:44:35Z.\n\n'
 'Actual closed diagnostic result3365c306/70raw delivered ONCE @claude162 https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6206867188 /markerrow-diagnostic023000-46338c54-result-0911f2d5/bodySHAb55f8df86d94d2129d377b8715e36038d3ad585b513a522e12809a9449a81c7d. requestJSON==actualresponse==freshuneditedreadback. SourcePASS6206544265 ACK bundledONLYHERE/no duplicateACK/GH/native/source/resultrequest. '+pending+' NativefallbackONLYifTHISactualresultanswerstillmissing~20min/noEARLIER2026-10-16T03:04:35+00:00/freshactualtargetEMPTYcomposer/preservehumans/no duplicates. Old sourcefallback02:25:32 CANCELLED/actualPASS answered.\n'
 'SAMEONE46338c54/PASS6206544265/new023000rootunit/inv9026c0ad2c4849e3ac5f2595aeaeec77 CLOSEDsuccess02:32:56.577631UTC/101.007796s; terminal0911f2d5/result0dc410de/independentclosedpublicvalidation PASS02:40:21UTC. ALL112tables/schema42receipts preserved/0deleted/107other tablesidentical. ExistingSample20 allCROSS_SUBMISSION_DUPLICATE/columnsmetadata,rejectionReason,updatedAt ONLY/EXPECTEDbeforeafter/oldvaluesretained/fieldMetadataunchanged/eachnewpaired1hold+2audits. AddedSample174/AuditLog218/SampleHold22/Notification1;KoboConfig7onlyclocks+onecursor/4refusals unchanged.442rowdiffs;442private-row originals+fresh32byteHMACkey remainHOST0400/0privatebytesfetched. ALL6beforeafter fullSHAstatctimenlink equal. ALL475rootfilesstable/all15package unchanged. BOTHownmemoryfiles sharedsink4204211B<256MiB/OOM0/max805Swap0/peak805306368+maxevents6859 observationsONLY. Fulljournal4PID1sameinv start/started/successfuldeactivation/CPU; GCdefaultinfinity/sentinel notexecutedlimits.\n'
 'Fullresult70raw at '+REL+'closed-diagnostic023000-publication-once/publication-index.json; actualdelivery/currentauthority originals at '+REL+D.name+'/publication-index.json. All8source3data/1333app/26oldproof/old8source3data unchanged/allsourcepublicationbindings verified/currentbeCI38772398721attempt1pushCLOSEDSUCCESS/4audits6rules2postreboot memorydirection/jobsScope/R2accepted/2diagnosticscopes/privacyfindings/#191CLOSED/no laterfailure. Noactive diagnostic/localrunnerretainer afterpublication. Root/unit/PASS/package/operators and ALLoncehelpers consumed NEVERretryreplaycleanup; privatefiles remainHOST/no key/SQLreplay.\n'
 'NEXT readFULLactualCl diagnostic-result verdict/conditions, retainraw/authority. NO Step2 allowance/proof/remedy/YYquestion BEFORE actual diagnostic acceptance. Afteracceptance mustACTUALLYimplement genuinelyNEW reviewed Step2graph/meaningfulguards/newexactSourcePASS; source/resultacceptance notoperation/kit/gate/deploy. FutureStep2 exactownerstopaftercontrollerkill+ownunitmemoryevents/EVERYcontainer805600/refusals42receipts/secondnaturalidempotence/newfetchIDsabovemax/R4+10GB/newrootoneattempt. Futurekit/gate disclose9-to10minrestartwindow/exactproduction600deadlinefailurebehavior. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/no prune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/broadstage/resetclean/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
 old=p.read_bytes();p.write_bytes(lead.encode()+old);require(p.read_bytes()[len(lead.encode()):]==old,'History differs')
paths=sorted([p for folder in [A,D] for p in folder.rglob('*') if p.is_file()])+[pathlib.Path(__file__),W/'WP/backlog-resume-20261013/post-private-diagnostic023000-actual-result-once.py',*readmes]
save('publication-index.json',canonical({'actualResultRequestId':6206867188,'bindings':[{'path':p.relative_to(W).as_posix(),'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,pf=tempfile.mkstemp(prefix='lims-diagnostic-handoff-',suffix='.paths');os.close(fd);pathlib.Path(pf).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0');git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+pf,'--pathspec-file-nul');require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
raws=batch(':',names)
for p,n in zip(paths,names):require(raws[n]==p.read_bytes(),'Staged raw differs')
git('commit','-m','Retain one actual diagnostic result6206867188 review handoff');head=git('rev-parse','HEAD').decode().strip();raws=batch(head+':',names)
for p,n in zip(paths,names):require(raws[n]==p.read_bytes(),'Committed raw differs')
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs')
print(json.dumps({'audit':head,'rawPublished':len(paths),'status':state,'actualResultRequestId':6206867188,'reviewCandidates':[{'id':c['id'],'created_at':c['created_at'],'updated_at':c['updated_at'],'app':c.get('performed_via_github_app'),'body':c['body']} for c in candidates]}))
