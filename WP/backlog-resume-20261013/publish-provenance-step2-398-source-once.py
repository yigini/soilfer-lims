"""Publish only owned NEW source/test evidence; no host/operator execution."""
import ast,datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-provenance-step2-be837974-20261016/';B=W/REL;D=B/'source398-publication-once';BASE='7625655507bd852c1f800c477c7d3d1475d1c110'
def require(v,s):
    if not v:raise RuntimeError(s)
def sha(b):return hashlib.sha256(b).hexdigest()
def canon(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def git(*args,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=W,input=input)
def batch(ref,names):
    raw=git('cat-file','--batch',input=('\n'.join(ref+':'+n for n in names)+'\n').encode());at=0;out={}
    for n in names:
        end=raw.index(b'\n',at);given,kind,count=raw[at:end].decode().split();count=int(count);at=end+1;b=raw[at:at+count];at+=count
        require(kind=='blob' and given==oid(b) and raw[at:at+1]==b'\n','Raw Git framing mismatch');at+=1;out[n]=b
    require(at==len(raw),'Expanded Git response');return out
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused source publisher required')
sys.path.insert(0,str(B));from proof_contract import FILES,ROOT,SCOPE,tokens
from proof_budget import copy_site_guard,EXPECTED_SITES,TOTAL_DB_COPIES,DB_EQUIVALENTS,TABLE_SHA
require(len(FILES)==31,'Complete31-file graph required');raws={n:(B/n).read_bytes() for n in FILES};digests={n:sha(raw) for n,raw in raws.items()};copy_site_guard({n:raws[n] for n in EXPECTED_SITES})
for n,b in raws.items():
    if n.endswith('.py'):ast.parse(b,filename=n,feature_version=(3,9));compile(b,n,'exec')
final=json.loads((B/'source-local-host-step2-refusal-complete-once/exit-original.json').read_bytes());host=json.loads((B/'source-local-host-step2-refusal-complete-once/host-stdout-original.json').read_bytes())
require(final['status']=='PASS' and final['localExitCode']==final['hostExitCode']==0 and final['expectedTests']==host['testsRun']==398 and final['sourceSha256Before']==final['sourceSha256After']==digests and host['sourceSha256']==digests and '3.9.23' in host['pythonVersion'] and host['sourceFilesWritten']==host['actualDockerCalls']==host['proofOperatorsExecuted']==host['productionSqliteConnections']==0,'Final closed398 guards required')
old=W/'WP/batch-proof-jobs-intake-be837974-20261016';oldindex=json.loads((old/'exact-source-review323-once/tooling-source-index.json').read_bytes())
unchanged=[];changed=[]
for n,p in oldindex['files'].items():
    require(sha((old/n).read_bytes())==p['sha256'],'Old proof source changed');(unchanged if digests[n]==p['sha256'] else changed).append(n)
for folder,idx in [('WP/jobs-row-diagnostic-private-be837974-20261016','exact-source-review105-private-once/source-index.json'),('WP/jobs-row-diagnostic-be837974-20261016','exact-source-review80-git-aware-once/source-index.json')]:
    index=json.loads((W/folder/idx).read_bytes())
    for group in ['files','data']:
        for n,p in index.get(group,{}).items():require(sha((W/folder/n).read_bytes())==p['sha256'],'Frozen diagnostic source/data changed')
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333 and all(sha((W/n).read_bytes())==h for n,h in frozen.items()),'Frozen application changed')
apath='WP/jobs-row-diagnostic-private-be837974-20261016/actual-result-accepted6206990387-once/publication-index.json';pubraw=batch(BASE,[apath])[apath];rows=json.loads(pubraw)['bindings'];require(len(rows)==42,'Acceptance publication inventory differs');bound=batch(BASE,[r['path'] for r in rows])
for r in rows:require(sha(bound[r['path']])==r['sha256'] and len(bound[r['path']])==r['bytes'] and oid(bound[r['path']])==r['gitBlobOid'],'Acceptance raw binding differs')
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
record={'status':'COMPLETE_NEW_STEP2_SOURCE398_GUARDS_NO_SOURCE_PASS_OR_OPERATION','closedUtc':final['closedUtc'],'publishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourcePredecessor':oldindex['head'],'sameByteSources':sorted(unchanged),'changedPredecessorSources':sorted(changed),'newSources':sorted(FILES-set(oldindex['files'])),'sourceSha256':digests,'localTests':398,'actualHostTests':398,'hostPython':'3.9.23','sourceUnchangedAtBothTests':True,'allOldSourcesAnd1333AppUnchanged':True,'acceptedDiagnosticId':6206990387,'acceptancePublicationVerified':BASE,'proposedRoot':str(ROOT),'scope':SCOPE,'declaredDbTripleCopies':TOTAL_DB_COPIES,'minimumBudgetEquivalents':DB_EQUIVALENTS,'stageTableSha256':TABLE_SHA,'operatorsExecuted':0,'hostSourceFilesWritten':0,'newRootCreated':False,'packagePrepared':False,'sourcePass':False,'oneAttemptOnlyAfterNewExactSourcePass':True}
save('source-completion-record.json',canon(record)+b'\n')
lead=('LATEST COMPLETE NEW STEP2 PROVENANCE SOURCE /398 LOCAL+398 HOST GUARDS - '+final['closedUtc']+'.\n\nActual Cl diagnostic acceptance6206990387/02:55:36Z fully retained76256555/43raw; native resultfallback CANCELLED/answered/no duplicateACK. Complete genuinelyNEW31-file Step2 source at '+REL+'README.md, derived04c99271; final398LOCAL+398ACTUALhostPython3.9.23 PASS/all31sourceunchanged. Old26proof/8+3privateDiag/8+3oldDiag/1333app unchanged. HostsourceINMEMORY/no remote sourcefiles/realoperatorsBLOCKED/SQLiteONLYnewretainedsyntheticfixtures. Earlier393local391PASS2stale-fixtureclockFAIL,393localPASS/host362PASS31URI-harnessrefusals,393bothPASS and398bothPASS predecessors retained honestly; no helper replay.\nStrict existing+same-sync-new Sample source/fetch/occurrence/hold/audit pairing, exact INTRA pairing/everyaddedclass/no orphanextraaudits or CREATEonoriginal, exact managernotificationcountlink/two-phase totals, secondnaturalidempotence/ALLfirstfetchIDs/newIDsabovemax. Freshprivate32byteHMACkeyHOST0400/publickeyedvalueserrors. Controllerownunit memory.events beforeafter + independent exact-two-owner ExecStopPost afterkill/timeout/OOM/normalexit/300stopdeadline/retainsownedcontainers/stopdespiteoneownerfailure; poststopmemorymandatory. Runtime receipt explicitly AWAITING_EXEC_STOP_POST/no closedPASS inferred. EVERYcontainer805blankheapSwap0/600totalHTTPfinalsample/refusals/full11242/oldinputHASHSTATonly/broad31API6probes/science/budgets unchanged.\nProposed soleNEW050000rootunit UNCREATEDbyus/no package/proofoperator/productionoperation. N25/MIN64/25percent/3assets/fixedschema markers/floor10556150894+4GiBlogs+ADDITIONAL10GB/freshR4beforeROOTimmediatelyUNIT-runtime/exactfuturepackagebeforeROOTONLY. NEW exact all31SHA+alltokens Source review:PASS still required beforeONEattempt; findings=>newsource+meaningfulguards/newreview/noreplay. Concrete source request NEXT; no waitfornonexistentapproval. Futurekitgate MUSTdisclose observed174newEXPECTED+22holds20existingZMB-LAB1/labmanagerimpact/countsmaydiff PLUS9to10minrestart/exactproduction600deadlinefailure. NoYYquestion/kit/gate/deployauthority. MainMERGEHOLD/233000latestpassingKEEPIT/R2complete/noprune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for r in readmes:
    prior=r.read_bytes();r.write_bytes(lead.encode()+prior);require(r.read_bytes()[len(lead.encode()):]==prior,'History changed')
helpers=sorted((W/'WP/backlog-resume-20261013').glob('*provenance-step2*once.py'))
require(len(helpers)==8,'Exact owned new helper inventory required')
paths=sorted(p for p in B.rglob('*') if p.is_file())+helpers+readmes
require(not any(p.suffix in ['.db','.sqlite','.pyc'] or p.name=='private-value-hmac-key.json' for p in paths),'Private/DB/cache content excluded')
save('publication-index.json',canon({'status':record['status'],'bindings':[{'path':p.relative_to(W).as_posix(),'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,manifest=tempfile.mkstemp(prefix='lims-step2-source-',suffix='.paths');os.close(fd);pathlib.Path(manifest).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0');git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+manifest,'--pathspec-file-nul')
require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
for p,n in zip(paths,names):require(git('show',':'+n)==p.read_bytes(),'Staged byte mismatch')
git('commit','-m','Publish new Step2 strict provenance source and398 closed guards');head=git('rev-parse','HEAD').decode().strip();committed=batch(head,names)
for p,n in zip(paths,names):require(committed[n]==p.read_bytes(),'Committed byte mismatch')
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs')
print(json.dumps({'head':head,'rawPublished':len(paths),'sources':len(FILES),'guardsEach':398,'sameByteSources':len(unchanged),'changedSources':len(changed),'newSources':5,'hostOperations':0,'stagedEmpty':not git('diff','--cached','--name-only').strip()}))
