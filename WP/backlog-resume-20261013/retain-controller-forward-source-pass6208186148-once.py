"""Retain the exact new controller-forward approval; no host operation."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, tempfile
W = pathlib.Path(__file__).resolve().parents[2]
REL = 'WP/batch-proof-controller-forward-step2-be837974-20261016/'
B = W / REL
D = B / 'actual-source-pass6208186148-once'
BASE = '0876f2b5d85082fcde38239ea48e29da8f6717e2'
SOURCE = '572d8cc94ee5a98c29392f556a57133cedd13128'
sys.dont_write_bytecode = True
sys.path.insert(0, str(B))
from proof_contract import *
import prepare_proof as prep
def git(*a, input=None):
    return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(raw):
    return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one retention required')
index=exact_json((B/'exact-source-review420-once/source-index.json').read_bytes())
require(index['head']==SOURCE and len(index['files'])==31 and len(tokens(index))==179,'Exact31source/179bindings required')
verified_publications=[]
for head,path,count in [(SOURCE,REL+'source420-publication-once/publication-index.json',658),(BASE,REL+'exact-source-review420-handoff-publication-once/publication-index.json',56)]:
    raw=git('show',head+':'+path);pub=exact_json(raw)
    require(len(pub['bindings'])==count,'Complete publication inventory required')
    raws=prep.raw_git_many(head,[r['path'] for r in pub['bindings']])
    for row in pub['bindings']:
        data=raws[row['path']]
        require(len(data)==row['bytes'] and sha(data)==row['sha256'] and oid(data)==row['gitBlobOid'],'Published raw identity differs '+row['path'])
    verified_publications.append({'head':head,'indexPath':path,'indexSha256':sha(raw),'indexedOriginals':count,'totalIncludingIndex':count+1})
    if head==SOURCE:
        source_pubraw=raw
        for name,pin in index['files'].items():
            data=raws[REL+name]
            require(data==(B/name).read_bytes() and len(data)==pin['bytes'] and sha(data)==pin['sha256'] and oid(data)==pin['blob'],'Source changed '+name)
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
require(len(frozen)==1333,'App inventory differs')
for name,digest in frozen.items():require(sha((W/name).read_bytes())==digest,'App changed '+name)
old_graphs=[
 ('937901c7514437fc3937639454e621d1bfd68dc4','WP/batch-proof-provenance-step2-be837974-20261016/','exact-source-review398-once/source-index.json',31,[]),
 ('04c99271e761198937aa798131075f199e86b679','WP/batch-proof-jobs-intake-be837974-20261016/','exact-source-review323-once/tooling-source-index.json',26,[]),
 ('46338c544e44e56091eb3b18edc515ece5d44095','WP/jobs-row-diagnostic-private-be837974-20261016/','exact-source-review105-private-once/source-index.json',8,['diagnostic-pins.json','first-fetch-original.json','baseline-logical-original.json']),
 ('bb2d337dc4e39021bf413dbe31c2749bb02da65a','WP/jobs-row-diagnostic-be837974-20261016/','exact-source-review80-git-aware-once/source-index.json',8,['diagnostic-pins.json','first-fetch-original.json','baseline-logical-original.json'])]
old_verified=[]
for head,rel,idxpath,count,data_names in old_graphs:
    old=exact_json((W/rel/idxpath).read_bytes());require(len(old['files'])==count and old['head']==head,'Old immutable graph differs')
    names=list(old['files'])+data_names;originals=prep.raw_git_many(head,[rel+n for n in names])
    for name in names:
        data=(W/rel/name).read_bytes();require(data==originals[rel+name],'Old immutable bytes differ '+rel+name)
        if name in old['files']:require(sha(data)==old['files'][name]['sha256'],'Old source pin differs '+name)
    old_verified.append({'head':head,'sourceFiles':count,'metadataFiles':len(data_names)})
captures=[];original=prep.command
def capture(*args):
    raw=original(*args)
    if args[:2]==('gh','api'):captures.append((list(args),raw))
    return raw
prep.command=capture
review_raw=capture('gh','api','repos/yigini/soilfer-lims/issues/comments/6208186148');review=exact_json(review_raw)
approval(review,index)
require(review['id']==6208186148 and review['created_at']==review['updated_at']=='2026-10-16T04:37:05Z','Actual new verdict identity differs')
evidence=prep.current_evidence(review,index)
require(exact_json(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed','Issue191 changed')
receipt=prep.raw_git(BUILD_EVIDENCE,prep.BUILD_REL+'build-receipt.json')[0]
inspection=prep.raw_git(BUILD_EVIDENCE,prep.BUILD_REL+'image-inspect-original.json')[0]
qualified(exact_json(receipt),receipt,exact_json(inspection)[0])
D.mkdir()
def save(name,raw):
    with (D/name).open('xb') as f:f.write(raw)
save('actual-source-pass-original.json',review_raw);save('actual-source-pass-readable.txt',review['body'].encode())
save('tooling-source-index.json',canonical(index)+b'\n');save('source-publication-index420-original.json',source_pubraw)
save('current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(_,raw) in enumerate(captures):save('api-original-'+str(i).zfill(2)+'.json',raw)
save('api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':argv,'length':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(argv,raw) in enumerate(captures)])+b'\n')
record={'status':'ACTUAL_NEW_EXACT_STEP2_SOURCE_PASS_VALIDATED_NOT_EXECUTED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':SOURCE,'sourceReviewId':review['id'],'reviewCreatedUtc':review['created_at'],'reviewBodySha256':sha(review['body'].encode()),'all31SourceHashes':graph(index),'literalBindings':179,'completeSourceOriginalCount':659,'all659RawGitOidShaLengthVerified':True,'publicationsVerified':verified_publications,'all1333AppInputsUnchanged':True,'oldImmutableGraphsVerified':old_verified,'currentMainCiFourAuditsSixRulesTwoPostRebootMemoryJobsScopesPrivacyDiagnosticAcceptanceControllerRefusalR2NoLaterFailureVerified':True,'scope':SCOPE,'root':str(ROOT),'unit':'lims-'+ROOT_NAME.lower(),'proofAttemptsAllowed':1,'retryAllowed':False,'packagePrepared':False,'hostOperations':0,'productionSqliteConnections':0,'reviewConditions':['Fresh exact authority/R4+10GB/unused063000 root-unit; one attempt, no retry','Qualification only; no kit/gate/deploy; main merges held','Runtime receipt AWAITING_EXEC_STOP_POST or terminal refusal; both exact owners in stoppedAndRetained (not vacuous), postStopErrors empty, controller OOM0, journal hook exit0','Controller before/after plus raw reads, same membership/cgroup identity/OOM0; first/second/full preservation; reconstructed same-sync labels','Public logs reviewed before publication; both private keys and DBs stay host','Future kit: first-sync impact/counts may differ; 9to10 minute restart and exact600s behavior']}
save('independent-pass-validation.json',canonical(record)+b'\n')
save('routine-output-refusal-derived.json',canonical({'kind':'TOOL_OUTPUT_TRANSCRIPTION','boundary':'Routine read-only GitHub observation before this retention','error':'Two console responses exceeded requested output budgets; JSON parsing refused the truncation warning. A fresh complete ASCII-safe response was obtained and read in full.','affectedReadInterpretation':'No absence or approval inferred from truncated output','sourceChanges':0,'hostOperations':0,'reviewPosts':0})+b'\n')
lead=f'''LATEST ACTUAL EXACT CONTROLLER-FORWARD SOURCE PASS6208186148 - {review['created_at']}.
FULL actual uneditedClaudeapp1236702slugclaude Source review: PASS read; own proof_contract.approval validates exact572d8cc94ee5a98c29392f556a57133cedd13128 / ALL31SHA / ALL179tokens. All659 sourcepublication +57handoff rawGitOID/SHA256/length independently reverified; all31source/old31+26/both8source3data/1333app unchanged. Fresh mainbeCI38772398721attempt1pushCLOSEDSUCCESS/4audits6rules2postreboot memory/jobs/diagnostic privacy+acceptance/controller620791/R2/#191CLOSED/no laterfailure verified. Full actual approval/currentauthorities/independent validation at {REL}actual-source-pass6208186148-once/publication-index.json.
ONE new063000 Step2 qualification attempt permitted conditional fresh exact-package R4+10GB beforeROOT/immediatelyUNIT/runtime + unusedrootunit. No operational package/root/unit/proof yet. NEXT ONE package/publish/unchanged reviewedlauncher. NEW04:50:39 nativefallback CANCELLED/actualSourcePASS answered; no duplicateACK/GH/native/request. Bundle620818PASS ACK ONLY eventual actual result. MainMERGEHOLD; sourcePASS not kit/gate/deploy.
Result requires runtime receipt AWAITING_EXEC_STOP_POST or refusal; controller before/after/raws same membership+cgroup identity/OOM0; stop-post both exact owners stoppedAndRetained NOTVACUOUS/postStopErrorsEMPTY/controllerOOM0/journalExecStopPostexit0; firstsecondfull preservation/reconstructedlabels. Both privateHMACkeys+DBs HOST/withheld; all rawjobsONlogs contentreview before publicGit. Futurekit174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff +9to10minrestart/exact600deadlinefailure. Strictpairing/orphans/secondnaturalidempotence/EVERYcontainer805600/full11242/refusals/science/N25MIN64/floor4GiBlogs10GB/500MB unchanged. All050000/operators/helpers consumed neverretryreplaycleanup. 233000KEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
save('checkpoint-prefix.txt',lead.encode())
readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for path in readmes:
    prior=path.read_bytes();path.write_bytes(lead.encode()+prior);require(path.read_bytes()[len(lead.encode()):]==prior,'Prior history changed')
paths=sorted(D.iterdir())+[pathlib.Path(__file__),*readmes]
save('publication-index.json',canonical({'baseAudit':BASE,'sourceReviewId':review['id'],'files':[{'path':p.relative_to(W).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json')
names=[p.relative_to(W).as_posix() for p in paths]
fd,path_file=tempfile.mkstemp(prefix='lims-controller-pass620818-',suffix='.paths');os.close(fd);pathlib.Path(path_file).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+path_file,'--pathspec-file-nul')
require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
def verify(ref):
    data=git('cat-file','--batch',input=('\n'.join(ref+n for n in names)+'\n').encode());at=0
    for p in paths:
        end=data.index(b'\n',at);given,kind,length=data[at:end].decode().split();length=int(length);at=end+1;raw=data[at:at+length];at+=length
        require(kind=='blob' and raw==p.read_bytes() and oid(raw)==given and data[at:at+1]==b'\n','Raw publication differs');at+=1
    require(at==len(data),'Expanded publication')
verify(':');git('commit','-m','Retain exact controller-forward source PASS6208186148');head=git('rev-parse','HEAD').decode().strip();verify(head+':')
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs');require(not git('diff','--cached','--name-only').strip(),'Staged output remains')
print(json.dumps({'audit':head,'actualPass':review['id'],'sourceOriginalsVerified':659,'handoffOriginalsVerified':57,'literalBindings':179,'sourceFilesVerified':31,'appInputsVerified':1333,'rawGitFilesVerified':len(paths),'serverOperations':0}))
