import base64,hashlib,json,os,pathlib,stat
root=pathlib.Path('/tmp/lims-owned-stopped-copy-source-guards-20261015T021000Z');assert root.is_dir() and not root.is_symlink()
rows=[];total=0
for directory,children,files in os.walk(root,followlinks=False):
 children.sort();files.sort();d=pathlib.Path(directory);assert not d.is_symlink()
 for n in children:assert not (d/n).is_symlink()
 for n in files:
  p=d/n;a=p.stat();assert p.is_file() and not p.is_symlink() and a.st_size<=1048576
  raw=p.read_bytes();b=p.stat();assert (a.st_size,a.st_mtime_ns,a.st_mode,a.st_ino)==(b.st_size,b.st_mtime_ns,b.st_mode,b.st_ino)
  total+=len(raw);assert total<=8388608 and len(rows)<256
  rows.append({'path':p.relative_to(root).as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':stat.S_IMODE(b.st_mode),'data':base64.b64encode(raw).decode()})
print(json.dumps({'status':'READONLY_SYNTHETIC44_HOST_FIXTURE_RAW_RETENTION','root':str(root),'files':rows,'productionConnections':0,'productionCopies':0,'noCleanup':True}))
