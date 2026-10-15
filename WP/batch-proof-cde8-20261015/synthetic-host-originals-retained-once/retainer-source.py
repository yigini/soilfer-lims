import base64,hashlib,json,os,pathlib,stat
roots=['/tmp/lims-owned-stopped-copy-source-guards-20261015T013000Z','/tmp/lims-owned-stopped-copy-source-guards-20261015T013500Z']
rows=[];total=0
for number,root in enumerate(roots):
 p=pathlib.Path(root);assert p.is_dir() and not p.is_symlink()
 for directory,children,files in os.walk(p,followlinks=False):
  children.sort();files.sort();d=pathlib.Path(directory);assert not d.is_symlink()
  for child in children:assert not (d/child).is_symlink()
  for name in files:
   f=d/name;a=f.stat();assert f.is_file() and not f.is_symlink() and a.st_size<=1048576
   raw=f.read_bytes();b=f.stat();assert (a.st_size,a.st_mtime_ns,a.st_ino,a.st_mode)==(b.st_size,b.st_mtime_ns,b.st_ino,b.st_mode)
   total+=len(raw);assert total<=8388608 and len(rows)<256
   rows.append({'path':str(number)+'/'+f.relative_to(p).as_posix(),'source':str(f),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':stat.S_IMODE(b.st_mode),'data':base64.b64encode(raw).decode()})
print(json.dumps({'status':'SYNTHETIC_GUARD_FIXTURE_RAW_FILES_ONLY','roots':roots,'files':rows,'productionConnections':0,'productionOperations':0,'noCleanup':True}))
