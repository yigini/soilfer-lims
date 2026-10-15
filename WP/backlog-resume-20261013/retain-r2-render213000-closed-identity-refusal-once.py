"""Retain closed corrected R2 originals plus fresh read-only metadata; never prune."""
import base64,datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-render-acc15844-20261015';D=S/'r2-213000-closed-identity-refusal-originals-once'
BASE='8634338456067cc0e4377c12f480fd91aebb1f43';INV='48c3692ef7364f96a48bca020c6c9cff'
sys.path.insert(0,str(S));from r2_contract import *
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
require(not D.exists() and git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip(),'Same writer/base/one retention required')
P=S/'reviewed-r2-package-once';expected={p.name:{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in P.iterdir() if p.is_file()};require(len(expected)==32,'Exact approved package required')
probe=r'''import base64,datetime,hashlib,http.client,json,os,pathlib,re,socket,stat,subprocess
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE;inv=INV_VALUE;expected=EXPECTED_VALUE;image=IMAGE_VALUE;buildroot=pathlib.Path(BUILDROOT_VALUE);receiptsha=RECEIPT_VALUE
assert root.is_dir() and root.resolve()==root and not root.is_symlink()
propsraw=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec'],capture_output=True,timeout=15)
assert propsraw.returncode==0 and not propsraw.stderr and len(propsraw.stdout)<65536
props=dict(v.split('=',1) for v in propsraw.stdout.decode().splitlines())
assert props['MainPID']=='0' and props['ActiveState']=='failed' and props['InvocationID']==inv and props['Result']=='exit-code' and props['ExecMainStatus']=='1'
assert (root/'terminal-failure.json').is_file() and not (root/'terminal-receipt.json').exists()
names=sorted(p.relative_to(root).as_posix() for p in root.rglob('*'));assert len(names)<=10000
files={};captured={};total=0
def capture(n,raw,mode=None):
 global total
 total+=len(raw);assert len(raw)<=32*1024**2 and total<=544*1024**2
 files[n]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlobOid':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest(),'mode':mode};captured[n]=base64.b64encode(raw).decode()
for n in names:
 p=root/n;assert not p.is_symlink()
 if p.is_dir():continue
 a=p.stat();assert stat.S_ISREG(a.st_mode) and a.st_size<=32*1024**2
 raw=p.read_bytes();b=p.stat();assert (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns)==(b.st_dev,b.st_ino,b.st_size,b.st_mtime_ns)
 capture(n,raw,oct(stat.S_IMODE(a.st_mode)))
 if n in expected:assert len(raw)==expected[n]['bytes'] and files[n]['sha256']==expected[n]['sha256'] and files[n]['mode']=='0o400',n
assert set(expected)<=set(files) and sorted(p.relative_to(root).as_posix() for p in root.rglob('*'))==names
assert not list(root.glob('*-prune-intent.json')) and not list(root.glob('*-item-receipt.json')),'Unexpected mutation intent/item'
for n in ['journal-original.jsonl','journal-original.log']:
 output='json' if n.endswith('jsonl') else 'short-iso-precise'
 q=subprocess.run(['journalctl','-u',unit,'--no-pager','-o',output],capture_output=True,timeout=15);assert q.returncode==0 and not q.stderr and len(q.stdout)<=8388608;capture('fresh-closed/'+n,q.stdout)
jrows=[json.loads(x) for x in base64.b64decode(captured['fresh-closed/journal-original.jsonl']).splitlines() if x]
assert {x.get('INVOCATION_ID',x.get('_SYSTEMD_INVOCATION_ID')) for x in jrows}=={inv}
capture('fresh-closed/systemctl-original.stdout',propsraw.stdout);capture('fresh-closed/systemctl-original.stderr',propsraw.stderr)
original=buildroot/'build-receipt.json';a=original.stat();raw=original.read_bytes();b=original.stat();assert not original.is_symlink() and stat.S_IMODE(a.st_mode)==0o400 and (a.st_ino,a.st_size,a.st_mtime_ns)==(b.st_ino,b.st_size,b.st_mtime_ns) and hashlib.sha256(raw).hexdigest()==receiptsha
capture('fresh-closed/qualified-build-receipt-original.json',raw,'0o400')
q=subprocess.run(['docker','image','inspect',image],capture_output=True,timeout=20);assert q.returncode==0 and not q.stderr and len(q.stdout)<=2097152 and json.loads(q.stdout)==json.loads((root/'qualified-image-inspect.json').read_bytes());capture('fresh-closed/qualified-image-entire-inspect-original.json',q.stdout)
class UnixDocker(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(20);self.sock.connect('/var/run/docker.sock')
def get(path):
 c=UnixDocker('localhost',timeout=20)
 try:
  c.request('GET',path);q=c.getresponse();raw=q.read(32*1024**2+1);assert q.status==200 and len(raw)<=32*1024**2;return json.loads(raw)
 finally:c.close()
rows=get('/v1.52/containers/json?all=1');assert type(rows) is list and len(rows)<=256
containers={}
def canon(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
for row in rows:
 ident=row['Id'];assert re.fullmatch('[a-f0-9]{64}',ident) and ident not in containers
 v=get('/v1.52/containers/'+ident+'/json');assert v['Id']==ident
 mounts=sorted(canon(x) for x in v['Mounts']);assert len(mounts)==len(set(mounts));state=v['State']
 containers[ident]={'Id':ident,'Name':v['Name'],'Image':v['Image'],'Labels':v['Config'].get('Labels'),'Mounts':mounts,'Status':state['Status'],'StartedAt':state['StartedAt'],'OOMKilled':state['OOMKilled'],'RestartCount':v['RestartCount']}
rows=get('/v1.52/images/json?all=1&manifests=true');assert type(rows) is list and len(rows)<=1024;images={}
for row in rows:
 ident=row['Id'];assert re.fullmatch('sha256:[a-f0-9]{64}',ident) and ident not in images
 images[ident]={k:v for k,v in row.items() if k not in ['Containers','SharedSize','VirtualSize']}
 for key in ['RepoTags','RepoDigests']:
  if images[ident].get(key) is not None:images[ident][key]=sorted(images[ident][key])
preservation={'containers':containers,'images':images};capture('fresh-closed/safe-selected-preservation-derived.json',(canon({'value':preservation,'rawContainerConfigAndEnvironmentRetained':False})+'\n').encode())
df={}
for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
 p=pathlib.Path(n);assert p.resolve()==p and not any(x.is_symlink() for x in [p,*p.parents]);v=os.statvfs(p);df[n]={'realpath':str(p.resolve()),'device':p.stat().st_dev,'block':v.f_frsize,'available':v.f_bavail*v.f_frsize}
q=subprocess.run(['df','-B1','--output=source,fstype,size,used,avail,target','/opt/lims','/var/lib/docker','/var/lib/containerd'],capture_output=True,timeout=15);assert q.returncode==0 and not q.stderr
capture('fresh-closed/df-original.stdout',q.stdout);capture('fresh-closed/statvfs-original.json',(canon(df)+'\n').encode())
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationId':inv,'properties':props,'originalRootFileCount':sum(not n.startswith('fresh-closed/') for n in files),'files':files,'capturedBase64':captured,'cacheMutationsByRetainer':0,'productionDatabaseConnections':0,'rawContainerConfigAndEnvironmentRetained':False}))
'''
probe=render_remote_source(probe,{'ROOT_VALUE':repr(ROOT),'UNIT_VALUE':repr(UNIT),'INV_VALUE':repr(INV),'EXPECTED_VALUE':repr(expected),'IMAGE_VALUE':repr(IMAGE),'BUILDROOT_VALUE':repr(BUILD_ROOT),'RECEIPT_VALUE':repr(BUILD_RECEIPT_SHA)})
D.mkdir()
def save(n,v):
 p=D/n;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb') as f:f.write(v)
save('readonly-closed-retainer-source.py',probe.encode())
q=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=180)
save('closed-read-stderr-original.log',q.stderr);save('closed-read-exit-original.json',canonical({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':q.returncode})+b'\n')
if q.returncode!=0:save('closed-read-refused-stdout-original.log',q.stdout)
require(q.returncode==0,'Read-only closed retention refused; new unique successor only')
data=json_exact(q.stdout);captured=data.pop('capturedBase64')
for n,b64 in captured.items():
 raw=base64.b64decode(b64,validate=True);row=data['files'][n];require(len(raw)==row['bytes'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlobOid'],'Retained raw bytes differ '+n);save(n,raw)
save('remote-closed-original-index.json',canonical(data)+b'\n')
events=[json_exact((D/n).read_bytes()) for n in sorted(data['files']) if re.fullmatch(r'\d{5}-[^/]+\.json',n)]
intents=[v for v in events if 'argv' in v and v.get('neverRetry') is True];require(not any('prune' in v['argv'] for v in intents),'Prune intent present; inspect honestly')
planrow=json_exact((D/'00016-closed-plan.json').read_bytes());wanted=planrow['items'][0]
du=json_exact((D/'00021-command-result.json').read_bytes());require(du['exitCode']==0 and du['stderr']=='' and du['error'] is None and not du['outputTruncated'],'Actual du failed differently')
durow=json_exact(du['stdout']);require(durow['ID']==wanted['ID'],'Different queried cache ID')
comparisons={k:{'api':wanted[k],'buildx':durow.get(k),'equal':durow.get(k)==wanted[k]} for k in ['ID','Size','Parents','CreatedAt','LastUsedAt']}
preservations=[v['value'] for v in events if 'value' in v and 'rawContainerConfigAndEnvironmentRetained' in v];require(len(preservations)==2 and preservations[0]==preservations[1],'Original before-operation preservation differs')
fresh=json_exact((D/'fresh-closed/safe-selected-preservation-derived.json').read_bytes())['value'];require(fresh==preservations[0],'Fresh closed container/image preservation differs')
validate_build((D/'fresh-closed/qualified-build-receipt-original.json').read_bytes(),(D/'qualified-image-inspect.json').read_bytes());require(json_exact((D/'fresh-closed/qualified-image-entire-inspect-original.json').read_bytes())==json_exact((D/'qualified-image-inspect.json').read_bytes()),'Entire qualified image changed')
dfs=[v['statvfs'] for v in events if 'statvfs' in v];require(len(dfs)==1,'One original pre-operation df required');before=validate_df(dfs[0]);freshdf=validate_df(json_exact((D/'fresh-closed/statvfs-original.json').read_bytes()))
validation={'status':'ACTUAL_R2_CLOSED_FAILED_BEFORE_FIRST_PRUNE_NO_RETRY','closedUtc':json_exact((D/'terminal-failure.json').read_bytes())['closedUtc'],'sourceReviewId':6201434518,'sourceHead':'4eccae1525af20b4d40c7b1cbfbf6c1b931e1e97','root':ROOT,'unit':UNIT,'actualInvocationId':INV,'originalRootFileCount':data['originalRootFileCount'],'all32PackageHashesAnd0400ModesVerified':True,'pruneIntentCount':0,'itemReceiptCount':0,'actualPruneInvocations':0,'failure':'Buildx/API identity differs','firstPlannedID':wanted['ID'],'actualApiVsBuildxFields':comparisons,'originalPreservationSnapshotsEqual':True,'freshClosedAllContainerAndImagePreservationEqual':True,'qualifiedImageEntireInspectEqual':True,'qualifiedBuildReceiptUnchanged':True,'initialLogicalCacheBytes':planrow['initialLogicalCacheBytes'],'protectedLogicalBytes':planrow['protectedLogicalBytes'],'dfBefore':before,'freshClosedDf':freshdf,'dfChangeNotCacheReclaimBecauseZeroPrunes':True,'retryAllowed':False,'remoteRootWritesByRetainer':0,'productionDatabaseConnections':0}
save('independent-closed-validation.json',canonical(validation)+b'\n');print(json.dumps(validation))
