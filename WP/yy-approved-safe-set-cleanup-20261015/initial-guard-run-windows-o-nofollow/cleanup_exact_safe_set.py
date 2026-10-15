"""Single-use cleanup for the exact human-approved list 6189633644 only."""
import datetime,hashlib,http.client,json,os,pathlib,re,socket,stat,subprocess,traceback,urllib.parse
PROOF_NAMES={'workflow-batch-forward-metadata-cde8c889-20261014T233000Z','workflow-batch-stopped-copy-cde8c889-20261015T020000Z','workflow-batch-stopped-copy-cde8c889-20261015T023000Z'}
BACKUP='/opt/lims/backups/failed_db_20261004_031055.db'
KEEPER='/opt/lims/backups/dev_pre_api_dialog218_20261004_031055.db'
IMAGE='sha256:3e90c082c7dad009472e8d911921b4293d6f6fe0c05084737a3b717e75969f96'
TAG='soil-museum:prev-20261014-093649'
RECEIPT_ROOT='/opt/lims/cleanup-receipts/yy-safe-set-6189633644'
class Changed(RuntimeError):pass
def need(value,message):
 if not value:raise Changed(message)
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(b):return hashlib.sha256(b).hexdigest()
def parents(row):return row.get(' Parents') or row.get('Parents') or []
def below(value,root):return value==root or value.startswith(root+'/')
def checked_path(name,expected):
 p=pathlib.Path(name);need(str(p)==expected and p.is_absolute(),'Unapproved or nonabsolute path')
 need(str(p.resolve())==expected,'Path alias or symlink')
 for q in [p,*p.parents]:
  need(not q.is_symlink(),'Symlink in path')
 return p
def cache_problem(row,wanted,all_rows,approved):
 if row is None:return 'ID absent before attempt'
 if row['InUse'] is not False or row['Shared'] is not False:return 'In-use or image-shared record'
 if row['Size']!=wanted['bytes'] or sorted(parents(row))!=sorted(wanted['parents']):return 'Size or parents changed'
 if row.get('LastUsedAt')!=wanted['lastUsedAt']:return 'Last-used timestamp changed'
 if any(row['ID'] in parents(v) and v['ID'] not in approved for v in all_rows):return 'Child outside approved set'
 return None
def validate_plan(plan):
 need(plan['authorityId']==6189633644 and plan['listCommit']=='420919a83fed52ee229caaee32158a0a61eccd59','Wrong authority')
 need(len(plan['cache'])==65 and len({x['id'] for x in plan['cache']})==65,'Cache allowlist differs')
 need(all(re.fullmatch('[a-z0-9]{25}',x['id']) for x in plan['cache']),'Malformed cache ID')
 need({pathlib.PurePosixPath(p['root']).name for p in plan['proofs']}==PROOF_NAMES,'Wrong proof roots')
 need(len(plan['proofs'])==3 and sum(len(p['verifiedCopies']) for p in plan['proofs'])==93,'Proof inventory differs')
 for p in plan['proofs']:
  need(str(pathlib.PurePosixPath(p['root']).parent)=='/opt/lims/releases','Proof outside approved parent')
  need(all('/' not in f['rootRelativePath'] and f['rootRelativePath'] not in ['','.','..'] for f in p['verifiedCopies']),'Non-flat or escaping proof path')
 need(plan['backup']['path']==BACKUP and plan['keeper']['path']==KEEPER,'Wrong backup')
 need(plan['backup']['sha256']==plan['keeper']['sha256']=='2b2cca066472326710dcef5e02518930c0d099fad3786691f5e86710504f1ce9','Wrong backup hashes')
 need(plan['image']['id']==IMAGE and plan['image']['tags']==[TAG],'Wrong image')
class Docker(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(90);self.sock.connect('/var/run/docker.sock')
def docker_get(endpoint):
 need(endpoint=='/version' or re.fullmatch(r'/v1\.52/(system/df|containers/json\?all=1|images/json\?all=1&manifests=true|containers/[a-f0-9]{64}/json|images/[^/]+/json)',endpoint),'Non-whitelisted Docker read')
 c=Docker('localhost')
 try:
  c.request('GET',endpoint);r=c.getresponse();b=r.read(32*1024**2+1);need(r.status==200 and len(b)<=32*1024**2,'Docker read failure or oversized response');return json.loads(b)
 finally:c.close()
def command(args,timeout=90):
 r=subprocess.run(args,capture_output=True,timeout=timeout);need(len(r.stdout)+len(r.stderr)<=2*1024**2,'Oversized command output')
 return {'argv':args,'exitCode':r.returncode,'stdout':r.stdout.decode(errors='replace'),'stderr':r.stderr.decode(errors='replace')}
def df_record():
 r=command(['df','-B1','--output=source,fstype,size,used,avail,target','--','/opt/lims','/var/lib/docker','/var/lib/containerd']);need(r['exitCode']==0,'df failed')
 r['observedUtc']=now();r['availableBytes']={n:os.statvfs(n).f_bavail*os.statvfs(n).f_frsize for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']};return r
def safe_containers():
 rows=docker_get('/v1.52/containers/json?all=1');result=[]
 for r in rows:
  x=docker_get('/v1.52/containers/'+r['Id']+'/json');s=x['State']
  result.append({'Id':x['Id'],'Name':x['Name'],'Image':x['Image'],'ImageManifestDescriptor':r.get('ImageManifestDescriptor'),'Mounts':x['Mounts'],'Labels':x['Config'].get('Labels'),'Status':s['Status'],'StartedAt':s['StartedAt'],'OOMKilled':s['OOMKilled'],'RestartCount':x['RestartCount'],'HealthStatus':(s.get('Health') or {}).get('Status')})
 return result
def current_cache():return docker_get('/v1.52/system/df')['BuildCache']
def meta(p):
 s=p.lstat();need(stat.S_ISREG(s.st_mode) and s.st_nlink==1,'Not a single-link regular file')
 return {k:getattr(s,k) for k in ['st_dev','st_ino','st_size','st_mtime_ns','st_mode','st_nlink']}
def hash_file(p,expected_sha,expected_bytes):
 before=meta(p);need(before['st_size']==expected_bytes,'File length changed');h=hashlib.sha256()
 fd=os.open(str(p),os.O_RDONLY|os.O_NOFOLLOW)
 try:
  with os.fdopen(fd,'rb',closefd=False) as f:
   for block in iter(lambda:f.read(1024**2),b''):h.update(block)
 finally:os.close(fd)
 need(before==meta(p) and h.hexdigest()==expected_sha,'File identity or SHA-256 changed')
 return {'sha256':h.hexdigest(),'bytes':expected_bytes,'metadata':before}
def references(tokens,exclude_root=None):
 refs=[];containers=docker_get('/v1.52/containers/json?all=1')
 path_tokens=[t for t in tokens if t.startswith('/')]
 for c in containers:
  for m in c.get('Mounts',[]):
   source=m.get('Source','');resolved=os.path.realpath(source) if source else ''
   if source and any(below(source,t) or below(t,source) or below(resolved,t) or below(t,resolved) for t in path_tokens):refs.append({'kind':'container-mount','containerId':c['Id'],'source':source})
  if IMAGE in tokens:
   x=docker_get('/v1.52/containers/'+c['Id']+'/json')
   if x['Image']==IMAGE or x['Config'].get('Image') in [IMAGE,TAG]:refs.append({'kind':'container-image','containerId':c['Id']})
   for line in x['Config'].get('Env') or []:
    key,_,value=line.partition('=')
    if 'IMAGE' in key.upper() and (value.strip() in [IMAGE,TAG]):refs.append({'kind':'container-image-env','containerId':c['Id'],'key':key})
 for d in pathlib.Path('/proc').iterdir():
  if not d.name.isdecimal() or int(d.name)==os.getpid():continue
  try:
   cmd=(d/'cmdline').read_bytes()
   if any(t.encode() in cmd for t in tokens):refs.append({'kind':'process-command','pid':int(d.name)})
   for f in (d/'fd').iterdir():
    try:target=os.readlink(f)
    except (FileNotFoundError,PermissionError,ProcessLookupError):continue
    if any(below(target,t) for t in path_tokens):refs.append({'kind':'process-open-file','pid':int(d.name),'target':target})
  except (FileNotFoundError,PermissionError,ProcessLookupError):continue
 files=set(pathlib.Path(x) for x in PLAN['configFiles'])
 for base in ['/etc/systemd/system','/etc/cron.d','/etc/cron.daily','/etc/cron.hourly','/etc/cron.weekly','/etc/cron.monthly']:
  p=pathlib.Path(base)
  if p.is_dir():files.update(q for q in p.rglob('*') if q.is_file() and not q.is_symlink())
 for base in ['/opt/lims','/opt/soil-museum','/opt/soilfer-learn']:
  p=pathlib.Path(base)
  if p.is_dir():files.update(q for q in p.iterdir() if q.is_file() and not q.is_symlink() and (q.suffix in ['.json','.py','.sh','.yml','.yaml','.service'] or q.name=='.env'))
 for root in pathlib.Path('/opt/lims/releases').iterdir():
  if not root.is_dir() or root.is_symlink() or str(root)==exclude_root:continue
  for q in root.iterdir():
   if q.is_file() and not q.is_symlink() and (q.suffix in ['.py','.sh','.service'] or q.suffix=='.json' and any(w in q.name.lower() for w in ['receipt','manifest','input','spec','authority','intent','plan'])):files.add(q)
 for p in sorted(files):
  if not p.exists() or p.is_symlink() or not p.is_file():continue
  need(p.stat().st_size<=16*1024**2,'Reference input oversized: '+str(p))
  text=p.read_text(encoding='utf-8',errors='replace');hits=set()
  if p.suffix=='.json':
   try:v=json.loads(text)
   except ValueError:v=None
   def visit(v,key=''):
    if key.lower() in ['body','stdout','stderr','journal','journaloriginal','systemctloriginal','env','environment','config']:return
    if isinstance(v,dict):
     for k,x in v.items():visit(x,k)
    elif isinstance(v,list):
     for x in v:visit(x,key)
    elif isinstance(v,str):hits.update(t for t in tokens if t in v)
   if v is not None:visit(v)
   else:hits.update(t for t in tokens if t in text)
  else:hits.update(t for t in tokens if t in text)
  if hits:refs.append({'kind':'configuration-or-retained-authority','path':str(p),'exactTokens':sorted(hits)})
 return refs
def main():
 validate_plan(PLAN);need(docker_get('/version')['ApiVersion']=='1.52','Docker API changed')
 root=pathlib.Path(RECEIPT_ROOT);need(str(root.resolve())==RECEIPT_ROOT and not root.exists(),'Cleanup intent consumed or aliased');root.parent.mkdir(mode=0o700,exist_ok=True);root.mkdir(mode=0o700)
 def save(name,v):
  with (root/name).open('x',encoding='utf-8') as f:json.dump(v,f,sort_keys=True,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
  (root/name).chmod(0o400)
 def journal(v):
  with (root/'item-results.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps(v,sort_keys=True)+'\n');f.flush();os.fsync(f.fileno())
 receipt={'authorityId':6189633644,'listCommit':PLAN['listCommit'],'startedUtc':now(),'status':'ACTIVE_EXACT_SAFE_SET_ONLY','items':[],'blanketPrune':False,'noSqlConnections':True,'otherBackupRestorePointsRetained':PLAN['heldBackupPaths']}
 save('approval-and-plan.json',PLAN)
 try:
  receipt['dfBefore']=df_record();receipt['containersBefore']=safe_containers();save('before.json',{'df':receipt['dfBefore'],'containers':receipt['containersBefore']})
  ids={x['id'] for x in PLAN['cache']};remaining={x['id']:x for x in PLAN['cache']}
  # Leaves first: each individual invocation has one anchored full-ID filter.
  ordered=[];seen=set()
  def add(id):
   need(id not in seen,'Cache dependency cycle');seen.add(id)
   for x in PLAN['cache']:
    if id in x['parents'] and x['id'] not in ordered:add(x['id'])
   ordered.append(id);seen.remove(id)
  for id in sorted(ids):
   if id not in ordered:add(id)
  before_all=current_cache();save('cache-before-original.json',before_all)
  for id in ordered:
   item={'category':'cache','id':id,'bytes':remaining[id]['bytes'],'checkedUtc':now()};rows=current_cache();row=next((x for x in rows if x['ID']==id),None);problem=cache_problem(row,remaining[id],rows,ids)
   if problem:item.update(status='SKIPPED_CHANGED',reason=problem)
   else:
    item['immediatePreRemovalState']=row
    argv=['docker','buildx','--builder','default','du','--filter','id=^'+id+'$','--format','json'];check=command(argv);item['exactFilterReadonlyCheck']=check
    selected=[json.loads(s) for s in check['stdout'].splitlines() if s.strip()]
    if check['exitCode'] or len(selected)!=1 or selected[0]['ID']!=id or selected[0]['Shared'] is not False or selected[0]['Reclaimable'] is not True:item.update(status='SKIPPED_FILTER_OR_STATE_MISMATCH')
    else:
     fresh=current_cache();problem=cache_problem(next((x for x in fresh if x['ID']==id),None),remaining[id],fresh,ids)
     if problem:item.update(status='SKIPPED_CHANGED',reason=problem)
     else:
      journal({**item,'status':'ATTEMPT_INTENT_SINGLE_ANCHORED_ID'})
      op=command(['docker','buildx','--builder','default','prune','--force','--all','--filter','id=^'+id+'$','--verbose'],timeout=120);item['operation']=op
      after=current_cache();removed={x['ID'] for x in fresh}-{x['ID'] for x in after};reported=set(re.findall(r'^ID:\s+(\S+)',op['stdout'],re.M))
      item['observedIdsRemoved']=sorted(removed);item['reportedIdsRemoved']=sorted(reported);journal({**item,'status':'SINGLE_ID_COMMAND_RETURNED'})
      need(removed<={id} and reported<={id},'Unexpected cache deletion outside exact ID')
      item['status']='REMOVED' if op['exitCode']==0 and removed=={id} else 'NOT_REMOVED_OR_COMMAND_REFUSED'
   receipt['items'].append(item);journal(item)
  for spec in PLAN['proofs']:
   item={'category':'proof-folder','path':spec['root'],'bytes':spec['physicalDuXBytes'],'checkedUtc':now(),'filesRemoved':[]}
   try:
    p=checked_path(spec['root'],'/opt/lims/releases/'+pathlib.PurePosixPath(spec['root']).name);need(p.name in PROOF_NAMES and p.is_dir(),'Not an approved proof folder')
    refs=references([str(p)],str(p));item['referenceChecks']=refs;need(not refs,'New proof dependency')
    need(not any(below(line.split()[4],str(p)) for line in pathlib.Path('/proc/self/mountinfo').read_text().splitlines()),'Mounted proof root')
    wanted={x['rootRelativePath']:x for x in spec['verifiedCopies']};need(set(q.name for q in p.iterdir())==set(wanted),'Proof file inventory changed')
    verified={}
    for name,v in wanted.items():verified[name]=hash_file(p/name,v['sha256'],v['bytes'])
    item['immediateVerifiedFileStates']=verified;journal({**item,'status':'ATTEMPT_INTENT_VERIFIED_FLAT_ROOT_ONLY'})
    fd=os.open(str(p),os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
     for name in sorted(wanted):
      need(meta(p/name)==verified[name]['metadata'],'Proof file metadata changed before unlink');os.unlink(name,dir_fd=fd);item['filesRemoved'].append(name)
    finally:os.close(fd)
    os.rmdir(str(p));item['status']='REMOVED'
   except Changed as e:
    if item['filesRemoved']:item.update(status='PARTIALLY_REMOVED_STOP',reason=str(e));receipt['items'].append(item);journal(item);raise
    item.update(status='SKIPPED_CHANGED',reason=str(e))
   receipt['items'].append(item);journal(item)
  item={'category':'old-backup','path':BACKUP,'bytes':PLAN['backup']['allocatedBytes'],'checkedUtc':now()}
  try:
   p=checked_path(BACKUP,BACKUP);keeper=checked_path(KEEPER,KEEPER);refs=references([BACKUP]);item['referenceChecks']=refs;need(not refs,'New backup dependency')
   item['keeperBefore']=hash_file(keeper,PLAN['keeper']['sha256'],PLAN['keeper']['bytes']);item['backupBefore']=hash_file(p,PLAN['backup']['sha256'],PLAN['backup']['bytes'])
   for key,field in [('device','st_dev'),('inode','st_ino'),('mtimeNs','st_mtime_ns')]:need(item['backupBefore']['metadata'][field]==PLAN['backup'][key] and item['keeperBefore']['metadata'][field]==PLAN['keeper'][key],'Backup identity differs from approved list')
   journal({**item,'status':'ATTEMPT_INTENT_EXACT_DUPLICATE_BACKUP_ONLY'});need(meta(keeper)==item['keeperBefore']['metadata'] and meta(p)==item['backupBefore']['metadata'],'Backup metadata changed before unlink')
   fd=os.open(str(p.parent),os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
   try:os.unlink(p.name,dir_fd=fd)
   finally:os.close(fd)
   item['status']='REMOVED';item['keeperAfter']=hash_file(keeper,PLAN['keeper']['sha256'],PLAN['keeper']['bytes'])
  except Changed as e:
   if item.get('status')=='REMOVED':item.update(status='REMOVED_KEEPER_POSTCHECK_FAILED_STOP',reason=str(e));receipt['items'].append(item);journal(item);raise
   item.update(status='SKIPPED_CHANGED',reason=str(e))
  receipt['items'].append(item);journal(item)
  item={'category':'unused-image','id':IMAGE,'tag':TAG,'estimatedUniqueBytes':PLAN['image']['estimatedUniqueBytes'],'checkedUtc':now()}
  try:
   refs=references([IMAGE,TAG]);item['referenceChecks']=refs;need(not refs,'New image dependency')
   images=docker_get('/v1.52/images/json?all=1&manifests=true');target=next((x for x in images if x['Id']==IMAGE),None);need(target is not None and target.get('RepoTags')==[TAG] and target.get('Containers')==0,'Image tags or consumers changed')
   need(not any((m.get('ImageData') or {}).get('Containers') for m in target.get('Manifests') or []),'OCI manifest consumers')
   item['immediatePreRemovalState']=target;journal({**item,'status':'ATTEMPT_INTENT_EXACT_IMAGE_ONLY'})
   op=command(['docker','image','rm','--no-prune',IMAGE]);item['operation']=op
   after=docker_get('/v1.52/images/json?all=1&manifests=true');removed={x['Id'] for x in images}-{x['Id'] for x in after};item['observedImageIdsRemoved']=sorted(removed);journal({**item,'status':'EXACT_IMAGE_COMMAND_RETURNED'});need(removed<={IMAGE},'Unexpected additional image removed')
   item['status']='REMOVED' if op['exitCode']==0 and removed=={IMAGE} else 'NOT_REMOVED_OR_COMMAND_REFUSED'
  except Changed as e:item.update(status='SKIPPED_CHANGED',reason=str(e))
  receipt['items'].append(item);journal(item)
  receipt['heldBackupMetadataAfter']={n:meta(pathlib.Path(n)) for n in PLAN['heldBackupPaths']};receipt['containersAfter']=safe_containers();receipt['dfAfter']=df_record()
  receipt['observedFreeIncreaseBytes']={n:receipt['dfAfter']['availableBytes'][n]-receipt['dfBefore']['availableBytes'][n] for n in receipt['dfBefore']['availableBytes']}
  receipt['cacheAfter']=current_cache();receipt['sameContainerIds']=sorted(x['Id'] for x in receipt['containersBefore'])==sorted(x['Id'] for x in receipt['containersAfter'])
  receipt['status']='CLOSED_EXACT_APPROVED_SAFE_SET_ATTEMPTED_WITH_ITEM_RESULTS';receipt['closedUtc']=now()
 except BaseException as e:
  receipt.update(status='FAILED_OR_PARTIAL_RETAIN_RECEIPT_NEVER_REPLAY',closedUtc=now(),error=repr(e),traceback=traceback.format_exc())
  try:receipt['dfAfterFailure']=df_record()
  except BaseException as x:receipt['dfAfterFailureError']=repr(x)
 finally:
  save('receipt.json',receipt);(root/'item-results.jsonl').chmod(0o400)
  print(json.dumps(receipt));
 return 0 if receipt['status'].startswith('CLOSED') else 1
if __name__=='__main__':raise SystemExit(main())
