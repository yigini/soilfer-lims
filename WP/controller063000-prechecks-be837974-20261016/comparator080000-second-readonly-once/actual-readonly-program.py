import base64,datetime,hashlib,json,os,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-prechecks-be837974-20261016T080000Z')
units={m:'lims-workflow-batch-prechecks-be837974-20261016t080000z-'+m+'.service' for m in ['comparator','hook']}
def sha(b):return hashlib.sha256(b).hexdigest()
def state(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 return {'bytes':s.st_size,'allocatedBytes':s.st_blocks*512,'mode':stat.S_IMODE(s.st_mode),'device':s.st_dev,'inode':s.st_ino,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns,'nlink':s.st_nlink}
assert root.is_dir() and not root.is_symlink()
for p in root.parents:assert not p.is_symlink()
out={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'units':{},'files':{},'publicFiles':{},'privateBytesFetched':0,'sqlConnections':0,'newMemorySamples':0}
for mode,unit in units.items():
 for kind,args in [('show',['systemctl','show',unit]),('journal',['journalctl','--no-pager','--output=json','-u',unit])]:
  r=subprocess.run(args,capture_output=True,timeout=30);assert len(r.stdout)<8*1024**2 and len(r.stderr)<65536
  out['units'][mode+'-'+kind]={'argv':args,'exitCode':r.returncode,'stdoutBase64':base64.b64encode(r.stdout).decode(),'stderrBase64':base64.b64encode(r.stderr).decode()}
count=0
for directory,dirs,files in os.walk(root,followlinks=False):
 for n in dirs:assert not (pathlib.Path(directory)/n).is_symlink()
 for n in sorted(files):
  p=pathlib.Path(directory)/n;assert not p.is_symlink();count+=1;assert count<=20000
  before=state(p);h=hashlib.sha256()
  with p.open('rb') as f:
   for chunk in iter(lambda:f.read(1024**2),b''):h.update(chunk)
  after=state(p);assert before==after
  relative=p.relative_to(root).as_posix();private=n.startswith('private-') or '.db' in n or n.endswith(('-wal','-shm','-journal'))
  out['files'][relative]={**before,'sha256':h.hexdigest(),'hostOnly':private}
  if not private:
   assert before['bytes']<8*1024**2
   raw=p.read_bytes();assert len(raw)==before['bytes'] and sha(raw)==h.hexdigest() and state(p)==before
   out['publicFiles'][relative]=base64.b64encode(raw).decode()
print(json.dumps(out,sort_keys=True,separators=(',',':')))
