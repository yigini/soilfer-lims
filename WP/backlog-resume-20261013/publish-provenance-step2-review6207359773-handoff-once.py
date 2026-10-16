"""Retain the actual ONE Step2 request, fresh pending state and source bindings."""
import concurrent.futures,datetime,hashlib,json,os,pathlib,subprocess,tempfile,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-provenance-step2-be837974-20261016/';B=W/REL;D=B/'exact-source-review398-handoff-publication-once';SOURCE='937901c7514437fc3937639454e621d1bfd68dc4'
sys.path.insert(0,str(B));from proof_contract import *
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def batch(ref,names):
    data=git('cat-file','--batch',input=('\n'.join(ref+':'+n for n in names)+'\n').encode());out={};at=0
    for n in names:
        end=data.index(b'\n',at);given,kind,size=data[at:end].decode().split();size=int(size);at=end+1;raw=data[at:at+size];at+=size
        require(kind=='blob' and given==oid(raw) and data[at:at+1]==b'\n','Raw Git framing differs');at+=1;out[n]=raw
    require(at==len(data),'Expanded Git bytes');return out
require(git('rev-parse','HEAD').decode().strip()==SOURCE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused handoff publisher required')
source_index=exact_json((B/'exact-source-review398-once/source-index.json').read_bytes());require(source_index['head']==SOURCE,'Exact source head required')
pubpath=REL+'source398-complete-publication-once/publication-index.json';raw=batch(SOURCE,[pubpath])[pubpath];rows=exact_json(raw)['bindings'];blobs=batch(SOURCE,[r['path'] for r in rows]);require(len(rows)==736,'Complete737 publication required')
for r in rows:require(len(blobs[r['path']])==r['bytes'] and sha(blobs[r['path']])==r['sha256'] and oid(blobs[r['path']])==r['gitBlobOid'],'Source raw binding differs')
for n,p in source_index['files'].items():require(sha((B/n).read_bytes())==p['sha256'] and (B/n).read_bytes()==blobs[REL+n],'Frozen31 source changed')
for folder,idx in [('WP/batch-proof-jobs-intake-be837974-20261016','exact-source-review323-once/tooling-source-index.json'),('WP/jobs-row-diagnostic-private-be837974-20261016','exact-source-review105-private-once/source-index.json'),('WP/jobs-row-diagnostic-be837974-20261016','exact-source-review80-git-aware-once/source-index.json')]:
    ix=exact_json((W/folder/idx).read_bytes())
    for group in ['files','data']:
        for n,p in ix.get(group,{}).items():require(sha((W/folder/n).read_bytes())==p['sha256'],'Old immutable source/data changed')
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333 and all(sha((W/n).read_bytes())==h for n,h in frozen.items()),'Frozen application changed')
delivery=exact_json((B/'exact-source-review398-once/delivery-record.json').read_bytes());require(delivery['commentId']==6207359773 and delivery['bodySha256']=='9c5c0f2a285a9654d9cf11daca6fb4046bf09aa00e004edf3e59a60ff3d2d8eb','Actual delivery differs')
eps=['repos/yigini/soilfer-lims/issues/comments/6207359773','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T03%3A23%3A00Z&per_page=100','repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721','repos/yigini/soilfer-lims/issues/191']
def read(ep):return ep,subprocess.check_output(['gh','api','--paginate','--slurp',ep] if '/comments?' in ep else ['gh','api',ep],cwd=W)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:fresh=dict(pool.map(read,eps))
v={k:exact_json(b) for k,b in fresh.items()};request=v[eps[0]];comments=[c for page in v[eps[1]] for c in page]
require(request['body']==(B/'exact-source-review398-once/body.md').read_text(encoding='utf-8') and request['created_at']==request['updated_at']==delivery['createdUtc'],'Fresh request differs')
answers=[c for c in comments if c['id']>request['id'] and (c.get('performed_via_github_app') or {}).get('id')==1236702 and (SOURCE in c.get('body','') or 'Source review:' in c.get('body',''))]
require(not answers,'Actual new verdict observed: retain/read FULL; do not infer pending or replay this publisher')
ci=v[eps[3]];require(v[eps[2]]['object']['sha']==CANDIDATE and ci['id']==MAIN_CI and ci['head_sha']==CANDIDATE and ci['run_attempt']==1 and ci['event']=='push' and ci['status']=='completed' and ci['conclusion']=='success' and v[eps[4]]['state']=='closed','Current main/CI/191 changed')
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
for i,(ep,raw) in enumerate(fresh.items()):save('fresh-api-'+str(i).zfill(2)+'.json',raw)
save('fresh-api-index.json',canonical([{'endpoint':ep,'file':'fresh-api-'+str(i).zfill(2)+'.json','bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(ep,raw) in enumerate(fresh.items())])+b'\n')
record={**delivery,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewPendingAtCapture':True,'sourcePublicationRawBindings':737,'all31SourcesAnd1333AppAndOldGraphsUnchanged':True,'currentMainCi191Verified':True,'rootCreated':False,'sourcePass':False,'packagePrepared':False,'hostOperations':0,'privateBytesFetched':0}
save('handoff-record.json',canonical(record)+b'\n')
lead=('LATEST ACTUAL NEW STEP2 EXACT SOURCE REVIEW6207359773 POSTED - 2026-10-16T03:23:36Z.\n\nCompleteNEW31-source graph937901c7514437fc3937639454e621d1bfd68dc4/737rawGitOID-SHA256-lengthverified/398LOCAL+398ACTUALhost3.9.23CLOSEDPASS03:17:55.763196/all31unchanged. ONE@claude162 exactSourceReview6207359773 https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6207359773 / markerstep2-provenance398-937901c7-accepted6206990387/bodySHA9c5c0f2a285a9654d9cf11daca6fb4046bf09aa00e004edf3e59a60ff3d2d8eb/ALL31SHA+ALL170tokens. Actualdiagnosticacceptance6206990387 ACK bundledONLYHERE/requestJSON==actualresponse==freshuneditedreadback. ActualNEWSourcePASS PENDING at fresh capture '+record['observedUtc']+'; no duplicateACK/GH/native/source request. Oldresult03:04:35fallback CANCELLED/answered. NEWnativefallbackONLYifTHISsourceanswerstillmissing~20min/noEARLIER03:43:36UTC/freshactualtargetEMPTYcomposer/preservehumans/no duplicates.\nFull request/current authorities/handoff at '+REL+'exact-source-review398-handoff-publication-once/publication-index.json; sourcegraph '+REL+'README.md. New050000rootunit UNCREATEDbyus/no operationalpackage/proofoperator/productionaction. Prepare/launch/run UNEXECUTED exceptcompile/import/closedfakeguards. All26oldproof+8source3data privateDiag+8source3data oldDiag+1333app unchanged; fresh mainbeCI38772398721attempt1pushCLOSEDSUCCESS/4audits6rules2postreboot memorydirection/jobsScope/2diagnosticscopes/privacyfindings/actualdiagnosticacceptance/#191CLOSED/nolaterfailure verified before request. No private diagnostic bytes fetched/keyHOST0400.\nNEXT readFULLactual NEW exact31SHA+170tokens verdict/conditions; actualuneditedapp1236702slugclaude/id>6206990387/created>02:55:36Z. IfPASS retainraw/ownapproval/all737sourcepublicationbindings/all31source/1333app/currentauthorities BEFOREONEnewpackage/publish/launcher/freshR4+10GB beforeROOTimmediatelyUNITruntime/unusedrootunit. SourcePASS is only oneattemptscope; not kit/gate/deploy. Findings=>genuinelyNEWsource+meaningfulguards/newreview/no oldhelper replay. UnknownoperatorinspectSAMEnewrootunitNEVERredispatch. Strictpairing/addedrows/orphans/secondnaturalidempotence/ownunitmemory+exactownerExecStopPost/EVERYcontainer805600/refusals/full11242/science/N25MIN64/floor4GiBlogs10GB/500MB retained. Futurekitgate disclose174newEXPECTED22holds20existingZMB-LAB1/labmanagerimpact/deploycountsmaydiff PLUS9to10minrestart/exactproduction600deadlinefailure. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/noprune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humanfilesdraftcardsheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for r in readmes:
    old=r.read_bytes();r.write_bytes(lead.encode()+old);require(r.read_bytes()[len(lead.encode()):]==old,'Prior history changed')
paths=sorted(p for p in (B/'exact-source-review398-once').iterdir() if p.is_file())+sorted(D.iterdir())+[pathlib.Path(__file__),W/'WP/backlog-resume-20261013/request-provenance-step2-398-exact-source-review-once.py',*readmes]
save('publication-index.json',canonical({'reviewRequestId':6207359773,'bindings':[{'path':p.relative_to(W).as_posix(),'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,manifest=tempfile.mkstemp(prefix='lims-step2-request-',suffix='.paths');os.close(fd);pathlib.Path(manifest).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0');git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+manifest,'--pathspec-file-nul')
require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
for p,n in zip(paths,names):require(git('show',':'+n)==p.read_bytes(),'Staged bytes differ')
git('commit','-m','Retain one exact Step2 source review6207359773 and current handoff');head=git('rev-parse','HEAD').decode().strip();blobs=batch(head,names)
for p,n in zip(paths,names):require(blobs[n]==p.read_bytes(),'Committed bytes differ')
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote handoff differs')
print(json.dumps({'head':head,'rawPublished':len(paths),'sourceHead':SOURCE,'reviewRequestId':6207359773,'sourceBindings':170,'guardsEach':398,'reviewPendingAt':record['observedUtc'],'stagedEmpty':not git('diff','--cached','--name-only').strip(),'hostOperations':0}))
