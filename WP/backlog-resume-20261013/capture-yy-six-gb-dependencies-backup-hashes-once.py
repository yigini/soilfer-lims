"""Read versioned Docker dependency metadata, config references and old backup hashes."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-host-capacity-options-6gb-20261015/dependency-and-old-backup-hashes-once';assert not D.exists();D.mkdir()
v=json.loads((D.parent/'metadata-stdout-original.json').read_bytes())
images=[{'id':x['Id'],'tags':x['RepoTags'] or []} for x in v['safeSelectedImagesWithConsumers'] if not x['excludedRunningImage']]
configs=sorted({p for c in v['safeSelectedContainerMetadata'] for p in (c.get('Labels') or {}).get('com.docker.compose.project.config_files','').split(',') if p})
old_backups=[x for g in v['backupMetadataGroups'] if g['directory']=='/opt/lims/backups' for x in g['files'] if x['path'].endswith('.db') and pathlib.PurePosixPath(x['path']).parent.as_posix()==g['directory'] and x['allocatedBytes']>=500000000]
assert len(old_backups)==8
selection={'images':images,'configFiles':configs,'oldBackupRows':old_backups,'proofRoots':[x['root'] for x in v['proofFoldersFreshStableHashes']]}
(D/'selection.json').write_text(json.dumps(selection,indent=2),encoding='utf-8')
script=r'''import datetime,hashlib,http.client,json,os,pathlib,re,socket,stat,urllib.parse
selection=SELECTION_VALUE
class C(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(60);self.sock.connect('/var/run/docker.sock')
def get(p):
 assert p=='/version' or re.fullmatch(r'/v[0-9]+\.[0-9]+/(system/df|containers/json\?all=1|images/json\?all=1&manifests=true|images/[^/]+/json)',p)
 c=C('localhost',timeout=60)
 try:
  c.request('GET',p);r=c.getresponse();b=r.read(32*1024**2+1);assert r.status==200 and len(b)<=32*1024**2;return json.loads(b)
 finally:c.close()
version=get('/version');api=version['ApiVersion'];assert re.fullmatch('[0-9]+\.[0-9]+',api);prefix='/v'+api
df=get(prefix+'/system/df');containers=get(prefix+'/containers/json?all=1');images=get(prefix+'/images/json?all=1&manifests=true')
safe_containers=[{k:x.get(k) for k in ['Id','Names','Image','ImageID','ImageManifestDescriptor','State','Status','Created','Labels','Mounts']} for x in containers]
safe_images=[{k:x.get(k) for k in ['Id','ParentId','RepoTags','RepoDigests','Created','Size','SharedSize','Containers','Labels','Manifests']} for x in images]
safe_df_images=[{k:x.get(k) for k in ['Id','ParentId','RepoTags','RepoDigests','Created','Size','SharedSize','Containers','Manifests']} for x in df.get('Images',[])]
cache=df.get('BuildCache',[])
cache_fields=['ID','Parent','ParentID','Parents','Type','Description','InUse','Shared','Size','CreatedAt','LastUsedAt','UsageCount']
safe_cache=[{k:x.get(k) for k in cache_fields if k in x} for x in cache]
inspect=[]
for x in selection['images']:
 a=get(prefix+'/images/'+urllib.parse.quote(x['id'],safe='')+'/json')
 inspect.append({'requestedId':x['id'],**{k:a.get(k) for k in ['Id','RepoTags','RepoDigests','Descriptor','Manifests','Size','Parent','RootFS','Created']}})
tokens={x['id'] for x in selection['images']}|{t for x in selection['images'] for t in x['tags']}|set(selection['proofRoots'])|{x['path'] for x in selection['oldBackupRows']}
repos={t.rsplit(':',1)[0] for x in selection['images'] for t in x['tags']}
configs={pathlib.Path(x) for x in selection['configFiles']}
for location in ['/etc/systemd/system','/etc/cron.d','/etc/cron.daily','/etc/cron.hourly','/etc/cron.weekly','/etc/cron.monthly']:
 p=pathlib.Path(location)
 if p.is_dir():configs.update(q for q in p.rglob('*') if q.is_file() and not q.is_symlink())
for n in ['/etc/crontab','/var/spool/cron/crontabs/root']:
 p=pathlib.Path(n)
 if p.is_file() and not p.is_symlink():configs.add(p)
for location in ['/opt/lims','/opt/soil-museum','/opt/soilfer-learn']:
 p=pathlib.Path(location)
 if not p.is_dir():continue
 for q in p.iterdir():
  if q.is_file() and not q.is_symlink() and q.suffix in ['.yml','.yaml','.sh','.py','.service','.json']:configs.add(q)
references=[];scanned=[]
for p in sorted(configs):
 if not p.is_file() or p.is_symlink() or p.stat().st_size>2*1024**2:continue
 text=p.read_text(encoding='utf-8',errors='replace');scanned.append(str(p))
 for number,line in enumerate(text.splitlines(),1):
  exact=sorted(t for t in tokens if t in line);repo=sorted(t for t in repos if t in line)
  if exact or repo:references.append({'path':str(p),'line':number,'exactReferenceTokens':exact,'repositoryReferenceTokens':repo,'rawLineNotStored':True})
hashes=[]
for original in selection['oldBackupRows']:
 p=pathlib.Path(original['path']);assert p.parent==pathlib.Path('/opt/lims/backups') and p.suffix=='.db' and not p.is_symlink()
 before=p.stat();assert before.st_size==original['bytes'] and before.st_mtime_ns==original['mtimeNs'] and before.st_ino==original['inode'] and before.st_dev==original['device']
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024**2),b''):h.update(b)
 after=p.stat();assert all(getattr(before,k)==getattr(after,k) for k in ['st_dev','st_ino','st_size','st_mtime_ns','st_mode'])
 hashes.append({**original,'sha256':h.hexdigest(),'stableBeforeAfterMetadata':True,'sqlConnections':0,'bytesFetchedOffHost':0})
print(json.dumps({'status':'READONLY_DEPENDENCIES_AND_OLD_BACKUP_HASHES_NOT_DELETION_AUTHORITY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dockerVersion':{k:version.get(k) for k in ['Version','ApiVersion','MinAPIVersion']},'versionedSafeSelectedContainers':safe_containers,'versionedSafeSelectedImages':safe_images,'versionedSystemDfSafeImages':safe_df_images,'versionedBuildCacheRecords':safe_cache,'rawCacheRecordKeys':sorted({k for x in cache for k in x}),'unusedImageInspectSafeSelected':inspect,'configFilesScanned':scanned,'exactAndRepositoryConfigReferences':references,'oldBackupStableHashes':hashes,'fullRawImageOrContainerEnvironmentStored':False,'backupContentsFetchedOffHost':0,'liveDatabaseFilesOpened':0,'sqlConnections':0,'mutations':0,'hostFilesCreated':0,'filesDeleted':0,'prunes':0,'neverReplay':True}))
'''.replace('SELECTION_VALUE',repr(selection))
(D/'collector-source.py').write_text(script,encoding='utf-8');compile(script,str(D/'collector-source.py'),'exec')
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=script.encode(),cwd=R,capture_output=True,timeout=360)
for n,b in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr)]:
 with (D/n).open('xb') as f:f.write(b)
(D/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readonly':True,'neverReplay':True}),encoding='utf-8');assert r.returncode==0,'Retain diagnostic refusal; never replay'
v=json.loads(r.stdout);print(json.dumps({'status':v['status'],'observedUtc':v['observedUtc'],'dockerVersion':v['dockerVersion'],'cacheKeys':v['rawCacheRecordKeys'],'cacheCount':len(v['versionedBuildCacheRecords']),'imageInspectCount':len(v['unusedImageInspectSafeSelected']),'configFilesScanned':len(v['configFilesScanned']),'configReferences':len(v['exactAndRepositoryConfigReferences']),'oldBackupHashes':len(v['oldBackupStableHashes']),'uniqueBackupHashes':len({x['sha256'] for x in v['oldBackupStableHashes']}),'mutations':0}))
