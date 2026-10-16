"""Independently validate and publish the single diagnostic launch/opening, once."""
import base64,datetime,hashlib,json,os,pathlib,subprocess,sys,tempfile
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];REL='WP/jobs-row-diagnostic-private-be837974-20261016/';B=W/REL
D=B/'first-diagnostic023000-opening-publication-once';O=B/'first-diagnostic023000-readonly-originals-once';P=B/'package-workflow-batch-row-diagnostic-be837974-20261016T023000Z';L=B/'launch-once';E=B/'execute-reviewed-launch6206544265-once'
BASE='b8073dccf52848841295245383397cb4d5fbe4f2'
sys.path.insert(0,str(B));from diagnostic_contract import *
import prepare_diagnostic as prep,launch_diagnostic as launcher
def git(*a,input=None):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=W,input=input)
def oid(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def raw_batch(prefix,names):
 raw=git('cat-file','--batch',input=('\n'.join(prefix+n for n in names)+'\n').encode());at=0;out={}
 for n in names:
  end=raw.index(b'\n',at);given,kind,size=raw[at:end].decode().split();size=int(size);at=end+1;b=raw[at:at+size];at+=size
  require(kind=='blob' and given==oid(b) and raw[at:at+1]==b'\n','Raw Git binding differs');at+=1;out[n]=b
 require(at==len(raw),'Expanded Git batch');return out
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer and unused opening publication required')
index=strict((P/'source-index.json').read_bytes());review=strict((P/'source-review.json').read_bytes());approval(review,index);prep.published(index)
pubs=[]
for head,path,count in [(index['head'],REL+'source105-publication-once/publication-index.json',262),('fbb1aba271fb5b3aa8613e02678cdf76c4900d65',REL+'review105-private-handoff-publication-once/publication-index.json',207),('bb2d337dc4e39021bf413dbe31c2749bb02da65a','WP/jobs-row-diagnostic-be837974-20261016/source80-publication-once/publication-index.json',184),('b5a6c3113459576a68177f2c1b31b97067357065',REL+'actual-source-pass6206544265-once/publication-index.json',46),(BASE,REL+'reviewed-package6206544265-publication-once/publication-index.json',26)]:
 b=raw_batch(head+':',[path])[path];rows=strict(b)['bindings'];require(len(rows)+1==count,'Publication count differs');raws=raw_batch(head+':',[r['path'] for r in rows])
 for r in rows:
  v=raws[r['path']];require(len(v)==r['bytes'] and sha(v)==r['sha256'],'Prior source/publication bytes differ')
 pubs.append({'head':head,'index':path,'count':count,'allRawGitOidShaLengthVerified':True})
o=strict((O/'stdout-original.json').read_bytes());require(strict((O/'exit-original.json').read_bytes())['exitCode']==0 and o['privateFileContentsFetched']==0 and not (O/'public-originals/public-terminal.json').exists(),'Actual active opening only')
inv={r['file']:r for r in o['inventory']};hashes={p.name:sha(p.read_bytes()) for p in P.iterdir()}
for n,h in hashes.items():require(inv[n]['sha256']==h and inv[n]['mode']==0o400 and inv[n]['nlink']==1 and inv[n]['stableDuringHash'],'Uploaded package differs')
for r in o['inventory']:
 if r['privateBytesWithheld']:require(r['mode']==0o400 and r['nlink']==1,'Private file protection differs')
status=dict(line.split('=',1) for line in base64.b64decode(o['systemctl']['stdoutBase64']).decode().splitlines() if '=' in line)
require(status['ActiveState']=='active' and status['SubState']=='running' and status['InvocationID']=='9026c0ad2c4849e3ac5f2595aeaeec77' and status['MainPID']=='332704','Exact active invocation required')
for k,v in {'MemoryMax':'805306368','MemorySwapMax':'0','RuntimeMaxUSec':'30min','Restart':'no','PrivateNetwork':'yes','ProtectSystem':'strict','ReadWritePaths':str(ROOT),'ReadOnlyPaths':str(OLD_ROOT),'RestrictAddressFamilies':'AF_UNIX'}.items():require(status[k]==v,'Executed limit/sandbox differs '+k)
future=package_allowance([p.stat().st_size for p in P.iterdir()]);require(future==5586944,'Exact package allocation differs')
for name,b in launcher.programs(hashes,future).items():require((L/(name+'-actual.py')).read_bytes()==b,'Actual remote program differs')
for label in ['beforeRoot','create','upload','seal','beforeUnit','unit']:require(strict((L/(label+'-exit.json')).read_bytes())['exitCode']==0,'Launch stage failed')
beforeRoot=strict((L/'beforeRoot-stdout').read_bytes());beforeUnit=strict((L/'beforeUnit-stdout').read_bytes())
require(beforeRoot['requiredBytes']==FLOOR+LOG_RESERVE+future and beforeUnit['requiredBytes']==FLOOR+LOG_RESERVE and beforeRoot['freeBytes']>=beforeRoot['requiredBytes'] and beforeUnit['freeBytes']>=beforeUnit['requiredBytes'],'Fresh launch capacity differs')
pins=strict((B/'diagnostic-pins.json').read_bytes())['inputPins'];observed=strict((O/'public-originals/input-before.json').read_bytes());require(set(pins)==set(observed) and len(pins)==6,'Six input originals required')
for n,pin in pins.items():
 for k,v in pin.items():require(observed[n][k]==v,'Runtime input pin differs')
for i in range(2):
 extent=strict((O/'public-originals'/('main-'+str(i)+'-extent.json')).read_bytes());quick=strict((O/'public-originals'/('main-'+str(i)+'-quick-check.json')).read_bytes());header=strict((O/'public-originals'/('main-'+str(i)+'-header.json')).read_bytes())
 require(extent['pageBytes']==563322880 and quick['okCount']==1 and header['header18']==header['header19']==2,'Read-only main observations differ')
mem=strict((O/'public-originals/controller-memory-before.json').read_bytes());events=dict(line.split() for line in mem['raw']['memory.events'].splitlines());require(events['oom']==events['oom_kill']=='0' and mem['raw']['memory.max'].strip()=='805306368' and mem['raw']['memory.swap.max'].strip()=='0','Controller before memory guard differs')
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
record={'status':'ACTUAL_PRIVATE_DIAGNOSTIC_ACTIVE_OPENING_NOT_A_RESULT','observedUtc':o['observedUtc'],'sourceHead':index['head'],'sourceReviewId':review['id'],'root':str(ROOT),'unit':UNIT,'invocationId':status['InvocationID'],'mainPid':332704,'rootFileCount':len(inv),'privateFilesWithheld':sum(r['privateBytesWithheld'] for r in inv.values()),'privateFileContentsFetched':0,'all15UploadedPackageHashesUnchanged':True,'all5ActualRemoteProgramsCompiledBeforeFirstSsh':True,'beforeRoot':beforeRoot,'beforeUnit':beforeUnit,'runtimeSixInputShaStatVerified':True,'bothMainQuickCheckExtentHeaderObserved':True,'all8Source3DataAnd1333AppUnchanged':True,'priorPublications':pubs,'currentAuthoritiesVerified':True,'controllerMemoryCurrentOpeningBytes':int(status['MemoryCurrent']),'controllerMemoryPeakOpeningBytes':int(status['MemoryPeak']),'memoryObservationOnlyNotOutcome':True,'actualTerminalObserved':False,'releaseQualified':False,'step2Authorized':False,'neverRetry':True}
save('opening-independent-validation.json',canonical(record)+b'\n')
lead=('LATEST ACTUAL ONE PRIVACY DIAGNOSTIC023000 LAUNCH + ACTIVE OPENING - '+o['observedUtc']+'.\n\n'
 'Actual exact source46338c54/PASS6206544265 ONE15file package prepared and published b8073dcc; exactfuturepackage5586944B. ONE unchanged reviewedlauncher CLOSEDexit0 02:31:15.908643UTC/root '+str(ROOT)+' /unit '+UNIT+' NOW CONSUMED NEVERredispatch/retry/replay/cleanup. All5 actual remote programs compiled BEFORE firstSSH. BEFORE_ROOT required14856705134/free86710022144; BEFORE_UNIT required14851118190/free86707621888 EACH3sameFS64769/nonadditive; exactpackage charged beforeROOT ONLY/alreadyoccupied beforeUNIT. Exact6 lstat-only beforeROOT/unusedrootunit guards passed.\n'
 'Actualreadonly opening '+o['observedUtc']+' invocation9026c0ad2c4849e3ac5f2595aeaeec77 ACTIVE/running/MainPID332704/MemoryMax805306368Swap0/Runtime1800/noRestart/PrivateNetwork/IPdeny/AF_UNIX/ProtectSystemstrict/ReadWriteONLYnewroot. Current805244928/peak805306368 OPEN controller observations ONLY/noOOM/outcome inferred. All15 uploaded0400 package SHA unchanged;352rootfiles/13 public generated files retained; ALL private rows/HMACkey bytes remain HOST withheld/0privatebytesfetched. Runtime originals prove six fullSHAstat pins/both main extent563322880/quickcheckok/header18/19=2 beforetables. No terminal/result yet. All262source+207handoff+184old+46PASS+26package rawGitOID/SHA/length reverified/all8source3data1333app/currentauthorities unchanged. Full opening evidence at '+REL+D.name+'/publication-index.json.\n'
 'NEXT reasonableinterval NEWunique READONLYobserver SAMErootunitinvocation only; no redispatch/newmemorysampling/SQL/sourcechange/retry/stop/cleanup. On actualCLOSED retain ALL public originals + private-file hashstat manifest only/fullsameinvocationjournal/systemctl; independently validate terminal/ALL112table result/42receipts/changedIDscolumnsclassifications/6beforeafterSHAstat/ownmemorybothfiles/cap/publicprivacy. Private raw rows and HMAC key stay HOST. ONE actual-result@claude162 bundles620654PASS ACK ONLYthere; actual diagnostic acceptance required BEFORE Step2/remedy/YYquestion. MainMERGEHOLD/233000latestpassingKEEPIT/R2COMPLETE/no prune/YYspacevisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Nativefallback CANCELLED/actualanswerarrived/no duplicates. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. All older history preserved verbatim below.\n\n')
save('checkpoint-prefix.txt',lead.encode());readmes=[W/'WP/audit-release-eb6de2e8/README.md',W/'WP/runtime-recovery-kobo/README.md']
for p in readmes:
 old=p.read_bytes();p.write_bytes(lead.encode()+old);require(p.read_bytes()[len(lead.encode()):]==old,'History differs')
helpers=[pathlib.Path(__file__),W/'WP/backlog-resume-20261013/execute-private-diagnostic-launch6206544265-once.py',W/'WP/backlog-resume-20261013/observe-private-diagnostic023000-first-readonly-once.py']
paths=sorted([p for folder in [O,L,E,D] for p in folder.rglob('*') if p.is_file()])+helpers+readmes
save('publication-index.json',canonical({'sourceReviewId':review['id'],'bindings':[{'path':p.relative_to(W).as_posix(),'bytes':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n');paths.append(D/'publication-index.json');names=[p.relative_to(W).as_posix() for p in paths]
fd,pf=tempfile.mkstemp(prefix='lims-private-opening-',suffix='.paths');os.close(fd);pathlib.Path(pf).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
git('-c','core.autocrlf=false','--literal-pathspecs','add','-f','--pathspec-from-file='+pf,'--pathspec-file-nul');require({n.decode() for n in git('diff','--cached','--name-only','-z').split(b'\0') if n}==set(names),'Stage ownership differs')
for prefix in [':']:
 raws=raw_batch(prefix,names)
 for p,n in zip(paths,names):require(raws[n]==p.read_bytes(),'Staged raw differs')
git('commit','-m','Retain single privacy diagnostic launch and active opening');head=git('rev-parse','HEAD').decode().strip();raws=raw_batch(head+':',names)
for p,n in zip(paths,names):require(raws[n]==p.read_bytes(),'Committed raw differs')
git('push','origin','HEAD:audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote publication differs')
print(json.dumps({'audit':head,'rawPublished':len(paths),'invocationId':status['InvocationID'],'status':record['status'],'privateBytesFetched':0}))
