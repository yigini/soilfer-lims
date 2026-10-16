"""Read and publish the actual Step 1 acceptance; no old operator imports or calls."""
import ast,concurrent.futures,datetime,hashlib,json,os,pathlib,subprocess,tempfile
W=pathlib.Path(__file__).resolve().parents[2]
REL='WP/jobs-row-diagnostic-private-be837974-20261016/'
B=W/REL; D=B/'actual-result-accepted6206990387-once'
BASE='690cc1b1d3218a9fc1980dc4d015602d88ea582d'
def require(v,s):
    if not v:raise RuntimeError(s)
def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def oid(b):return hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def batch(ref,names):
    raw=git('cat-file','--batch',input=('\n'.join(ref+':'+n for n in names)+'\n').encode());out={};at=0
    for n in names:
        end=raw.index(b'\n',at);o,t,l=raw[at:end].decode().split();at=end+1;l=int(l);b=raw[at:at+l];at+=l
        require(t=='blob' and o==oid(b) and raw[at:at+1]==b'\n','Git framing mismatch');at+=1;out[n]=b
    require(at==len(raw),'Extra Git bytes');return out
def projection(v):return {**{k:v[k] for k in ['id','body','created_at','updated_at']},'app':{k:(v.get('performed_via_github_app') or {}).get(k) for k in ['id','slug']}}
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused retainer required')
publications=[]
for ref,path,count in [(BASE,REL+'actual-result6206867188-handoff-publication-once/publication-index.json',86),('3365c306d937b0b6cf7ca70960be5dc5fb7ecc35',REL+'closed-diagnostic023000-publication-once/publication-index.json',70),('fd0e9eaafd5c82fe26e3fe498ee1f54b806b2ca0',REL+'first-diagnostic023000-complete-opening-publication-once/publication-index.json',94),('b8073dccf52848841295245383397cb4d5fbe4f2',REL+'reviewed-package6206544265-publication-once/publication-index.json',26),('b5a6c3113459576a68177f2c1b31b97067357065',REL+'actual-source-pass6206544265-once/publication-index.json',46),('46338c544e44e56091eb3b18edc515ece5d44095',REL+'source105-publication-once/publication-index.json',262),('fbb1aba271fb5b3aa8613e02678cdf76c4900d65',REL+'review105-private-handoff-publication-once/publication-index.json',207),('bb2d337dc4e39021bf413dbe31c2749bb02da65a','WP/jobs-row-diagnostic-be837974-20261016/source80-publication-once/publication-index.json',184)]:
    raw=batch(ref,[path])[path];index=json.loads(raw);rows=index['bindings'];require(len(rows)+1==count,'Publication count mismatch');blobs=batch(ref,[r['path'] for r in rows])
    for r in rows:
        b=blobs[r['path']];require(len(b)==r['bytes'] and sha(b)==r['sha256'] and oid(b)==r.get('gitBlobOid',oid(b)),'Published binding mismatch')
    publications.append({'head':ref,'path':path,'rawCount':count,'sha256':sha(raw),'gitBlobOid':oid(raw),'allBindingsVerified':True})
for folder,indexpath in [(B,B/'exact-source-review105-private-once/source-index.json'),(W/'WP/jobs-row-diagnostic-be837974-20261016',W/'WP/jobs-row-diagnostic-be837974-20261016/exact-source-review80-git-aware-once/source-index.json'),(W/'WP/batch-proof-jobs-intake-be837974-20261016',W/'WP/batch-proof-jobs-intake-be837974-20261016/exact-source-review323-once/tooling-source-index.json')]:
    index=json.loads(indexpath.read_bytes())
    for group in ['files','data']:
        for n,pin in index.get(group,{}).items():require(sha((folder/n).read_bytes())==pin['sha256'],'Frozen source/data changed '+n)
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333 and all(sha((W/n).read_bytes())==h for n,h in frozen.items()),'Application changed')
# Only literal pins are read from the immutable authority source, never imported.
constants={}
for node in ast.parse((B/'diagnostic_authority.py').read_bytes()).body:
    if isinstance(node,ast.Assign):
        for target in node.targets:
            if isinstance(target,ast.Name):
                try:constants[target.id]=ast.literal_eval(node.value)
                except (ValueError,TypeError):pass
audits=[(295,6146939836,'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','6d750914d8565acdd496767a7dd935811b5a89b2'),(296,6163165778,'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'),(297,6178123314,'6bd516c42a07332d0b0653ed150d1526bf7e424e','cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'),(298,6195167175,'eba02837eaa2ab797cad0572fecada686f660346','be8379745bdfae52ce46496ff26514dc7d729640')]
pins={**constants['RULE_AUTHORITY_PINS'],**constants['POST_REBOOT_PINS'],**constants['DIAGNOSTIC_SCOPE_PINS'],'6202252017':constants['R2_ACCEPTED_SHA'],'6203416404':constants['MEMORY_DIRECTION_SHA'],'6204518776':constants['JOBS_SCOPE_SHA'],'6206214444':constants['PRIVACY_FINDINGS_SHA']}
endpoints=['repos/yigini/soilfer-lims/issues/comments/'+i for i in [*pins,'6206990387','6206544265','6206867188']]+['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721','repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T02%3A44%3A00Z&per_page=100']
for pr,i,_,_ in audits:endpoints += ['repos/yigini/soilfer-lims/pulls/'+str(pr),'repos/yigini/soilfer-lims/issues/comments/'+str(i),'repos/yigini/soilfer-lims/issues/'+str(pr)+'/comments?per_page=100']
def read(ep):
    args=['gh','api']
    if '/comments?' in ep:args+=['--paginate','--slurp']
    return ep,subprocess.check_output(args+[ep],cwd=W)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:raws=dict(pool.map(read,endpoints))
parsed={e:json.loads(b) for e,b in raws.items()}
def comment(i):return parsed['repos/yigini/soilfer-lims/issues/comments/'+str(i)]
for i,pin in pins.items():require(sha(canonical(projection(comment(i))))==pin,'Current authority changed '+i)
v=comment(6206990387);p=projection(v)
require(p['created_at']==p['updated_at']=='2026-10-16T02:55:36Z' and p['app']=={'id':1236702,'slug':'claude'} and v['body'].startswith('Diagnostic result review: ACCEPTED (023000, Step 1 only, not release qualified)') and all(t in v['body'] for t in ['acceptedResult=0dc410dea0be27916082224488a409bb10e99a05ff1ec690e28bc0bd4b69a536','acceptedTerminal=0911f2d5dcd2e519d3bbfa1abf0079ef014417acc5d2aa0d5fd87f559505a25c','sourceHead=46338c544e44e56091eb3b18edc515ece5d44095','step2Authorized=false']),'Actual diagnostic acceptance differs')
main=parsed['repos/yigini/soilfer-lims/git/ref/heads/main'];ci=parsed['repos/yigini/soilfer-lims/actions/runs/38772398721']
require(main['object']['sha']==constants['CANDIDATE'] and ci['head_sha']==constants['CANDIDATE'] and ci['run_attempt']==1 and ci['event']=='push' and ci['status']=='completed' and ci['conclusion']=='success' and parsed['repos/yigini/soilfer-lims/issues/191']['state']=='closed','Main/CI/191 changed')
for pr,i,head,merge in audits:
    r=parsed['repos/yigini/soilfer-lims/pulls/'+str(pr)];a=comment(i);cs=[c for page in parsed['repos/yigini/soilfer-lims/issues/'+str(pr)+'/comments?per_page=100'] for c in page]
    require(r['merged'] is True and r['head']['sha']==head and r['merge_commit_sha']==merge and a['created_at']==a['updated_at'] and a['performed_via_github_app']['id']==1236702 and a['body'].lstrip().startswith('Audit passed: OK to merge and deploy') and head in a['body'] and not any(max(c['created_at'],c['updated_at'])>a['created_at'] and 'audit failed' in c['body'].lower() for c in cs),'Application audit changed')
fresh=read('repos/yigini/soilfer-lims/issues/comments/6206990387')[1];require(projection(json.loads(fresh))==p,'Acceptance changed during capture')
D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
save('actual-acceptance-original.json',fresh);save('actual-acceptance-readable.txt',v['body'].encode());save('actual-prior-step-direction-readable.txt',comment(6205724552)['body'].encode())
for k,(ep,raw) in enumerate(raws.items()):save('api-original-'+str(k).zfill(2)+'.json',raw)
save('api-index.json',canonical([{'endpoint':ep,'file':'api-original-'+str(k).zfill(2)+'.json','bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for k,(ep,raw) in enumerate(raws.items())])+b'\n')
record={'status':'ACTUAL_STEP1_DIAGNOSTIC_ACCEPTED_NEW_STEP2_SOURCE_REQUIRED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'acceptanceId':v['id'],'acceptanceBodySha256':sha(v['body'].encode()),'acceptanceAuthoritySha256':sha(canonical(p)),'publications':publications,'allOldSourcesDataAnd1333AppUnchanged':True,'step2SourceImplemented':False,'newSourcePass':False,'hostCalls':0,'privateBytesFetched':0,'productionActions':0,'nativeFallbackCancelled':True,'reviewConditions':['Strict retained-fetch scope/occurrence/exact hold-conflict-audit pairing applies also to samples created earlier in same sync and intra-submission duplicates','Every added row class exact; orphan/extra audits including create on changed originals refuse; notification count/link exact','Second natural conflict idempotence; new IDs above first fetch maximum only','Exact-root-owner stop after controller kill and own-unit memory.events','Fresh R4+10GB/new root/unit/one attempt/NEW exact source PASS before run','Future kit/gate disclose 174 EXPECTED additions and22 holds20existing observed only; lab-manager impact and deploy counts may differ;9to10min restart and exact600deadline behavior','Main merges held; no YY question/production/kit/gate/deploy authority']}
save('acceptance-record.json',canonical(record)+b'\n')
lead=('LATEST ACTUAL DIAGNOSTIC023000 ACCEPTANCE6206990387 - 2026-10-16T02:55:36Z.\n\nFull actual unedited Claude app1236702/slugclaude verdict Diagnostic result review: ACCEPTED read and retained. Accepts Step1 result0dc410de/terminal0911f2d5/publication3365c306/source46338c54/PASS6206544265; NOT_RELEASE_QUALIFIED/no Step2 operation/kit/gate/deploy. Full actual answer/current authorities/all prior publication bindings and immutable sources verified at '+REL+'actual-result-accepted6206990387-once/publication-index.json. Native03:04:35fallback CANCELLED/actual result answered/no duplicateACK/GH/native.\nNEXT ACTUALLY implement complete genuinelyNEW Step2 source graph/meaningful local+actualhost guards/new exact allhash SourcePASS beforeONEnewrootunit attempt/freshR4+10GB. Strict source-fetch-occurrence-hold-audit pairing also for samples created earlier in SAMEsync/intra-submission duplicates; exact every added-row class/create/hold/audit/notification links/counts; orphan/extra audits including create on changed originals STOP. Second natural conflict idempotence/new IDs above first-fetch maximum; exact-root-ownerstop after controllerkill/ownunitmemory.events/EVERYcontainer805600/refusals/full11242/physicalbudget preserved. Futurekit/gate disclose firstsync observed174newEXPECTED+22provenanceholds20existingZMB-LAB1/labmanager impact/countsmaydiff atdeploy PLUS9to10minrestart/exactproduction600deadlinefailure. No Step2 source/package/root/operator yet; acceptance scope is NOT SourcePASS.\nConsumed023000 diagnostic remains CLOSEDsuccess/no further operator/retry/replay/cleanup/private442rows+32bytekey HOST0400/no privatebytesfetched. Old003000 remains consumedFAILED/233000latestpassingKEEPIT/MainMERGEHOLD/R2COMPLETE/noprune/YY320GiBalreadyvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for r in readmes:
    old=r.read_bytes();r.write_bytes(lead.encode()+old);require(r.read_bytes()[len(lead.encode()):]==old,'History changed')
paths=sorted(D.iterdir())+[pathlib.Path(__file__),*readmes];save('publication-index.json',canonical({'acceptanceId':v['id'],'bindings':[{'path':r.relative_to(W).as_posix(),'bytes':len(r.read_bytes()),'sha256':sha(r.read_bytes()),'gitBlobOid':oid(r.read_bytes())} for r in paths]})+b'\n');paths.append(D/'publication-index.json');names=[r.relative_to(W).as_posix() for r in paths]
fd,manifest=tempfile.mkstemp(prefix='lims-diag-acceptance-',suffix='.paths');os.close(fd);pathlib.Path(manifest).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0');git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+manifest,'--pathspec-file-nul')
require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Staged ownership differs')
for r,n in zip(paths,names):require(git('show',':'+n)==r.read_bytes(),'Staged bytes differ')
git('commit','-m','Retain actual diagnostic acceptance6206990387 and Step2 conditions');head=git('rev-parse','HEAD').decode().strip();blobs=batch(head,names)
for r,n in zip(paths,names):require(blobs[n]==r.read_bytes(),'Committed bytes differ')
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs')
print(json.dumps({'head':head,'rawPublished':len(paths),'acceptanceId':v['id'],'authoritySha256':record['acceptanceAuthoritySha256'],'hostCalls':0,'stagedEmpty':not git('diff','--cached','--name-only').strip()}))
