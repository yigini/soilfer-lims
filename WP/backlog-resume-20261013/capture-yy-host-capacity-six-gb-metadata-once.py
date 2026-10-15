"""New YY read-only capacity inventory. No host files, objects or settings changed."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-host-capacity-options-6gb-20261015';assert not D.exists();D.mkdir()
old=json.loads((R/'WP/yy-failed-root-candidates-20261015/review-only-root-list.json').read_bytes())
proofs=[v for v in old['rows'] if v['group']=='a' and '20261015T050000Z' not in v['root'] and '20261015T060000Z' not in v['root']]
assert len(proofs)==3
(D/'prior-proven-small-proof-selection.json').write_text(json.dumps(proofs,indent=2),encoding='utf-8')
script=r'''import datetime,hashlib,http.client,json,os,pathlib,shutil,socket,stat,subprocess,urllib.parse
START=datetime.datetime.now(datetime.timezone.utc).isoformat()
class UnixDocker(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(60);self.sock.connect('/var/run/docker.sock')
def get(endpoint):
 assert endpoint in ['/system/df','/containers/json?all=1','/images/json?all=1']
 c=UnixDocker('localhost',timeout=60)
 try:
  c.request('GET',endpoint);r=c.getresponse();b=r.read(32*1024**2+1);assert r.status==200 and len(b)<=32*1024**2;return json.loads(b)
 finally:c.close()
df=get('/system/df');containers=get('/containers/json?all=1');images=get('/images/json?all=1')
safe_containers=[{k:v.get(k) for k in ['Id','Names','Image','ImageID','State','Status','Labels','Created','Mounts']} for v in containers]
normal=[v for v in safe_containers if v['Id']=='8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b'];assert len(normal)==1 and normal[0]['State']=='running'
live_images={v['ImageID'] for v in safe_containers if v['State']=='running'}
image_fields=['Id','ParentId','RepoTags','RepoDigests','Created','Size','SharedSize','VirtualSize','Containers','Labels']
safe_images=[]
df_images={v['Id']:v for v in df.get('Images',[])}
for v in images:
 x={k:v.get(k) for k in image_fields};x['systemDfSelected']={k:df_images.get(v['Id'],{}).get(k) for k in image_fields}
 x['containerConsumers']=[{k:c.get(k) for k in ['Id','Names','State','Image']} for c in safe_containers if c['ImageID']==v['Id']]
 x['excludedRunningImage']=v['Id'] in live_images;safe_images.append(x)
cache=[{k:v.get(k) for k in ['ID','Parent','Parents','Type','Description','InUse','Shared','Size','CreatedAt','LastUsedAt','UsageCount']} for v in df.get('BuildCache',[])]
def metadata(p):
 s=p.lstat();assert not stat.S_ISLNK(s.st_mode)
 return {'path':str(p),'bytes':s.st_size,'allocatedBytes':getattr(s,'st_blocks',0)*512,'device':s.st_dev,'inode':s.st_ino,'hardLinks':s.st_nlink,'mtimeNs':s.st_mtime_ns,'mode':stat.S_IMODE(s.st_mode)}
backup_groups=[];file_bound=0
locations=[('/opt/lims/backups',True),('/opt/lims/audit-backups',True),('/opt/lims/server/backups',True),('/var/lib/docker/volumes/lims_lims-data/_data',False)]
for name,recursive in locations:
 p=pathlib.Path(name);rows=[];skipped=[]
 if not p.is_dir():backup_groups.append({'directory':name,'exists':False});continue
 for base,dirs,files in os.walk(p,followlinks=False):
  dirs[:]=[n for n in dirs if not (pathlib.Path(base)/n).is_symlink()] if recursive else []
  for n in sorted(files):
   q=pathlib.Path(base)/n;file_bound+=1;assert file_bound<=200000
   if q.is_symlink():skipped.append(str(q));continue
   if not q.is_file():continue
   if not recursive and (n in ['dev.db','dev.db-wal','dev.db-shm'] or not any(w in n.lower() for w in ['backup','.bak','snapshot'])):continue
   rows.append(metadata(q))
 # Protect the newest file in each independent backup location, conservatively.
 newest=max(rows,key=lambda v:v['mtimeNs'])['path'] if rows else None
 for v in rows:v['protectedNewestInThisBackupLocation']=v['path']==newest
 backup_groups.append({'directory':name,'exists':True,'files':rows,'protectedNewestPath':newest,'skippedSymlinks':skipped,'allMetadataOnly':True})
proof_roots=PROOF_ROOTS_VALUE
proof_records=[]
for root_name in proof_roots:
 p=pathlib.Path(root_name);assert p.parent==pathlib.Path('/opt/lims/releases') and p.is_dir() and not p.is_symlink()
 rows=[]
 for q in sorted(p.rglob('*')):
  assert not q.is_symlink()
  if not q.is_file():continue
  m=metadata(q);assert m['bytes']<=64*1024**2
  before=q.stat();h=hashlib.sha256()
  with q.open('rb') as f:
   for b in iter(lambda:f.read(1024**2),b''):h.update(b)
  after=q.stat();assert all(getattr(before,k)==getattr(after,k) for k in ['st_dev','st_ino','st_size','st_mtime_ns','st_mode'])
  rows.append({**m,'relativePath':q.relative_to(p).as_posix(),'sha256':h.hexdigest()})
  assert len(rows)<=10000
 du=subprocess.run(['du','-x','-B1','-s','--',str(p)],capture_output=True,timeout=60);assert du.returncode==0 and len(du.stdout)+len(du.stderr)<65536
 proof_records.append({'root':str(p),'files':rows,'physicalDuXOriginal':du.stdout.decode(),'physicalDuXBytes':int(du.stdout.split()[0]),'duStderr':du.stderr.decode()})
release_index=[];text_records=[];text_total=0
base=pathlib.Path('/opt/lims/releases')
for p in sorted(base.iterdir()):
 if not p.is_dir() or p.is_symlink():continue
 files=[]
 for q in sorted(p.iterdir()):
  if not q.is_file() or q.is_symlink():continue
  n=q.name.lower();selected=q.suffix in ['.py','.sh','.service'] or q.suffix=='.json' and any(word in n for word in ['receipt','manifest','input','spec','authority','intent','plan'])
  if not selected:continue
  m=metadata(q);files.append(m)
  if m['bytes']>16*1024**2:continue
  b=q.read_bytes();text_total+=len(b);assert text_total<=256*1024**2
  try:value=json.loads(b) if q.suffix=='.json' else None
  except (UnicodeError,ValueError):value=None
  # Retain path-bearing structured values, not full copied GH bodies/logs/env.
  strings=[]
  def visit(x,key=''):
   if key.lower() in ['body','stdout','stderr','journal','journaloriginal','systemctloriginal','env','environment','config']:return
   if isinstance(x,dict):
    for k,v in x.items():visit(v,k)
   elif isinstance(x,list):
    for v in x:visit(v,key)
   elif isinstance(x,str) and ('/opt/' in x or '/var/' in x or 'sha256:' in x):strings.append({'key':key,'value':x[:16384]})
  if value is not None:visit(value)
  else:
   text=b.decode('utf-8',errors='replace')
   for line in text.splitlines():
    if '/opt/lims/' in line or 'sha256:' in line:strings.append({'key':'sourceLine','value':line[:16384]})
  if strings:text_records.append({'path':str(q),'structuredPathImageReferences':strings,'sourceSha256':hashlib.sha256(b).hexdigest()})
 release_index.append({'root':str(p),'selectedTopLevelAuthorityMetadata':files})
process_refs=[];backup_roots=[v[0] for v in locations]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdecimal():continue
 try:
  data=(p/'cmdline').read_bytes();matches=[x for x in ['/opt/lims/releases',*backup_roots] if x.encode() in data]
  fds=[]
  for fd in (p/'fd').iterdir():
   try:target=os.readlink(fd)
   except (FileNotFoundError,PermissionError,ProcessLookupError):continue
   if any(target==x or target.startswith(x+'/') for x in ['/opt/lims/releases',*backup_roots]):fds.append(target)
 except (FileNotFoundError,PermissionError,ProcessLookupError):continue
 if matches or fds:process_refs.append({'pid':int(p.name),'commandReferenceLocationsOnly':matches,'openFileTargets':sorted(set(fds)),'fullCommandLineNotStored':True})
result={'status':'READONLY_YY_SIX_GB_OPTIONS_METADATA_NOT_REMOVAL_AUTHORITY','startedUtc':START,'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'filesystemFreeBytes':{n:shutil.disk_usage(n).free for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']},'safeSelectedContainerMetadata':safe_containers,'safeSelectedImagesWithConsumers':safe_images,'buildCacheRecords':cache,'dockerAccounting':{'layersSize':df.get('LayersSize'),'builderSize':df.get('BuilderSize'),'imageCount':len(safe_images),'cacheCount':len(cache),'containerCount':len(safe_containers),'sizesAreDockerLogicalAccountingNotIndependentPhysicalReclaim':True},'backupMetadataGroups':backup_groups,'proofFoldersFreshStableHashes':proof_records,'releaseTopLevelAuthorityIndex':release_index,'releaseAuthorityPathImageReferences':text_records,'processPathAndOpenFileReferences':process_refs,'dependencyScanScope':'All containers, Docker image/cache metadata, selected top-level release authority JSON/scripts, process cmdline location matches and file-descriptor targets. No full command lines, raw env or DB content retained.','excludedProofRawNoOtherVerifiedCopy':['/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T050000Z','/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T060000Z'],'mutations':0,'filesDeleted':0,'prunes':0,'productionSqlConnections':0,'databaseContentsOpenedOrFetched':0,'hashesOnlyOfThreeClosedMetadataOnlyProofRoots':True,'hostFilesCreated':0,'neverReplay':True}
print(json.dumps(result))
'''.replace('PROOF_ROOTS_VALUE',repr([v['root'] for v in proofs]))
(D/'metadata-collector-source.py').write_text(script,encoding='utf-8');compile(script,str(D/'metadata-collector-source.py'),'exec')
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=script.encode(),capture_output=True,timeout=360)
for n,b in [('metadata-stdout-original.json',r.stdout),('metadata-stderr-original.log',r.stderr)]:
 with (D/n).open('xb') as f:f.write(b)
(D/'metadata-exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'neverReplay':True}),encoding='utf-8');assert r.returncode==0,'Inspect original diagnostic refusal; never replay'
v=json.loads(r.stdout);print(json.dumps({'status':v['status'],'observedUtc':v['observedUtc'],'dockerAccounting':v['dockerAccounting'],'backupGroups':[{k:x.get(k) for k in ['directory','protectedNewestPath']}|{'fileCount':len(x.get('files',[]))} for x in v['backupMetadataGroups']],'smallProofRoots':[{'root':x['root'],'bytes':x['physicalDuXBytes'],'files':len(x['files'])} for x in v['proofFoldersFreshStableHashes']],'freeBytes':v['filesystemFreeBytes'],'mutations':0}))
