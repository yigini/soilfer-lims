import json,base64
C=json.loads(base64.b64decode('eyJoYXNoZXMiOnsiYmFzZWxpbmUtbG9naWNhbC1vcmlnaW5hbC5qc29uIjoiZGMzZGRmMDc5ZWJhMjRhNDlkY2ZkOGU1ZDUyYmRmNjMzMmUxM2ZiMjNkYjgwMWEwNDQ2YmViNjM1NDdkMDU2NSIsImN1cnJlbnQtZXZpZGVuY2UuanNvbiI6ImI1N2IzMjdlNWE0ZTE3ZTBhZjg1NzY4YWVjZjdhMzNlYmM1NjliODAxN2MxYTg2OWNhY2EyNTZiYzM2YmExNzIiLCJkaWFnbm9zdGljLXBpbnMuanNvbiI6ImFiZjg2ZGI3Y2RjYzhlOGJjODI5YjE2YWE5OGI0YTYwM2U1ZGU1MDgzYjdkMDExYWMzNDI0YWY4ZDlkMmQxYWMiLCJkaWFnbm9zdGljLXNwZWMuanNvbiI6IjM5ZmRiODVmNGFlNzI3MWNmYmE4NmE2MzUxNDkwMmE1MWRiYTkyYTFjYTAxOGYwMmNmMjJkYmZjMjk1Yzk0ZDMiLCJkaWFnbm9zdGljX2F1dGhvcml0eS5weSI6ImJkMjIyZmJiYWU1ZDU5ZmJhODkyOGJjYWMyZjJlYjc5YmZlMWUxZGU1NzY1MDA4Y2E3MjNiYWE2YWFkMmE0MTMiLCJkaWFnbm9zdGljX2NvbXBhcmUucHkiOiJjMDRhYzRlODg5MTgxOTMzZDQ3NzQwZTAwYzdhMjZhMzcxMTI2Y2Q5MWRmZmM5ZDQ0OGFlZDhhMThmNTQ0MTllIiwiZGlhZ25vc3RpY19jb250cmFjdC5weSI6IjAwNTA5MGUwYzk5MjgzZGU0ZGZkMDQwMzA3NThhMDc1OGRlYjQ5NzEwYjEwYmY1NTIyYWUxOWIzYmZhZDY1Y2IiLCJkaWFnbm9zdGljX2lvLnB5IjoiNTZhZmVlMDFlM2I0NzMzYzJmMWE1NDc5ZWIwOTczMWNmMjRiMzM5NzJjN2E2MTY3ZTZkZjA2OWMyMDFiNjIwZSIsImZpcnN0LWZldGNoLW9yaWdpbmFsLmpzb24iOiI2MTliNGUzMDFlMmY2YWI4ZTYyMzg3NmM3NGMwNDk2MmJjMzAxYjMzOGI1MTI5MmE3YWE1YWJkNzdlYjRkY2U5IiwibGF1bmNoX2RpYWdub3N0aWMucHkiOiIyYTFjODQyNTIxYTRjODY3YmMwZWY1MTZmZDBlYzg4ODVmYzVlMWY0ZWUyNjZhYmY3M2M5YjhiYWFjZDYyZGIyIiwicHJlcGFyZV9kaWFnbm9zdGljLnB5IjoiZWUyOTA4OTMwNzEzNGRlZThmOTE3YWVjYzA0MmQ5NTMwMGYwNTdjNDI2MGM4NzliZTc2NGFkOTc0NzhiYWY3YSIsInJ1bl9kaWFnbm9zdGljLnB5IjoiMzdjOWNjNjc1YjVhZDViNjgyYjVhNDUyZDkyNzkwYWJmMWEwZTQxM2YxNjVmOWI4ZTc2NmE3ZTI5NTcwMjVmZiIsInNvdXJjZS1pbmRleC5qc29uIjoiNTVhMmU0YmM4Mjk4Yjc1NTBiMGFlZTNiNzcyYjBhNGMxMzhkOWNiNTk0NzJjOTEzNWVkNjFiNGQzNTQ4MDMyYyIsInNvdXJjZS1yZXZpZXcuanNvbiI6IjFmM2NiODIxZDcwYzE3YzEyY2ZlZTFkYjhmYmFiYWZiOGNjZDg5ODE2YTFmNDZjNzk4YzI2MjU1MjEzMzcyZTAiLCJ2ZXJpZnlfZGlhZ25vc3RpYy5weSI6ImZiMTU2Zjg3NjhiOWEyNmNkMjQ2MWZiMTBlOWYxMWE3NjY3MzM2YWIxZGNiNmExODRhNjVkMmMyOTkyYTkxZjYifSwiaW5wdXRQaW5zIjp7ImZpcnN0LXN5bmMuZGIiOnsiYWxsb2NhdGVkQnl0ZXMiOjU2MzMyNjk3NiwiYnl0ZXMiOjU2MzMyMjg4MCwiZGV2aWNlIjo2NDc2OSwiaW5vZGUiOjIxMjQwNjEsIm1vZGUiOjI1NiwibXRpbWVOcyI6MTc5MjExMTkxNzA4NTM4NTAzNywicGF0aCI6ImZpcnN0LXN5bmMuZGIiLCJzaGEyNTYiOiI2NTgwZTVhM2M3MmNlNDIwZjc4NzExNjQxZGY3NzE5ZTRhNTdkYTY3MDBmNzc3YmQwMmRjZjc5YzBlOTViNmY3In0sImZpcnN0LXN5bmMuZGItc2htIjp7ImFsbG9jYXRlZEJ5dGVzIjozMjc2OCwiYnl0ZXMiOjMyNzY4LCJkZXZpY2UiOjY0NzY5LCJpbm9kZSI6MjEyNDY3MywibW9kZSI6MjU2LCJtdGltZU5zIjoxNzkyMTExOTIxMzY3NDc0NTQyLCJwYXRoIjoiZmlyc3Qtc3luYy5kYi1zaG0iLCJzaGEyNTYiOiJmZDRjOWZkYTljZDNmOWFlN2M5NjJiMGRkZjM3MjMyMjk0ZDU1NTgwZTFhYTE2NWFhMDYxMjliODU0OTM4OWViIn0sImZpcnN0LXN5bmMuZGItd2FsIjp7ImFsbG9jYXRlZEJ5dGVzIjowLCJieXRlcyI6MCwiZGV2aWNlIjo2NDc2OSwiaW5vZGUiOjIxMjQ2NzIsIm1vZGUiOjI1NiwibXRpbWVOcyI6MTc5MjExMTkyMTM2NzQ3NDU0MiwicGF0aCI6ImZpcnN0LXN5bmMuZGItd2FsIiwic2hhMjU2IjoiZTNiMGM0NDI5OGZjMWMxNDlhZmJmNGM4OTk2ZmI5MjQyN2FlNDFlNDY0OWI5MzRjYTQ5NTk5MWI3ODUyYjg1NSJ9LCJzdGFydHVwLTEtc3RvcHBlZC1zZWFsL2JhY2t1cC5kYiI6eyJhbGxvY2F0ZWRCeXRlcyI6NTYzMzI2OTc2LCJieXRlcyI6NTYzMzIyODgwLCJkZXZpY2UiOjY0NzY5LCJpbm9kZSI6MjExODUzMywibW9kZSI6MjU2LCJtdGltZU5zIjoxNzkyMTExMjI4ODU5OTg3Nzk5LCJwYXRoIjoic3RhcnR1cC0xLXN0b3BwZWQtc2VhbC9iYWNrdXAuZGIiLCJzaGEyNTYiOiI5ZGMzYzAwZGM0YWMxNDhkOWVhZTIzYjYzYmQ3MWVmNGU5ZTYwYWRhNDMyYWEyMGJjODk4ZDZmY2Y3Yzg5NDRhIn0sInN0YXJ0dXAtMS1zdG9wcGVkLXNlYWwvYmFja3VwLmRiLXNobSI6eyJhbGxvY2F0ZWRCeXRlcyI6MzI3NjgsImJ5dGVzIjozMjc2OCwiZGV2aWNlIjo2NDc2OSwiaW5vZGUiOjIxMTg1MzUsIm1vZGUiOjI1NiwibXRpbWVOcyI6MTc5MjExMTIyODkzMDk4OTI4NSwicGF0aCI6InN0YXJ0dXAtMS1zdG9wcGVkLXNlYWwvYmFja3VwLmRiLXNobSIsInNoYTI1NiI6ImZkNGM5ZmRhOWNkM2Y5YWU3Yzk2MmIwZGRmMzcyMzIyOTRkNTU1ODBlMWFhMTY1YWEwNjEyOWI4NTQ5Mzg5ZWIifSwic3RhcnR1cC0xLXN0b3BwZWQtc2VhbC9iYWNrdXAuZGItd2FsIjp7ImFsbG9jYXRlZEJ5dGVzIjowLCJieXRlcyI6MCwiZGV2aWNlIjo2NDc2OSwiaW5vZGUiOjIxMTg1MzQsIm1vZGUiOjI1NiwibXRpbWVOcyI6MTc5MjExMTIyODkyOTk4OTI2NCwicGF0aCI6InN0YXJ0dXAtMS1zdG9wcGVkLXNlYWwvYmFja3VwLmRiLXdhbCIsInNoYTI1NiI6ImUzYjBjNDQyOThmYzFjMTQ5YWZiZjRjODk5NmZiOTI0MjdhZTQxZTQ2NDliOTM0Y2E0OTU5OTFiNzg1MmI4NTUifX0sIm1haW5zIjpbInN0YXJ0dXAtMS1zdG9wcGVkLXNlYWwvYmFja3VwLmRiIiwiZmlyc3Qtc3luYy5kYiJdLCJvbGRSb290IjoiL29wdC9saW1zL3JlbGVhc2VzL3dvcmtmbG93LWJhdGNoLWpvYnMtaW50YWtlLWJlODM3OTc0LTIwMjYxMDE2VDAwMzAwMFoiLCJwaGFzZSI6IkJFRk9SRV9VTklUIiwicmVxdWlyZWQiOjE0ODUxMTE4MTkwLCJyb290IjoiL29wdC9saW1zL3JlbGVhc2VzL3dvcmtmbG93LWJhdGNoLXJvdy1kaWFnbm9zdGljLWJlODM3OTc0LTIwMjYxMDE2VDAyMzAwMFoiLCJ1bml0IjoibGltcy13b3JrZmxvdy1iYXRjaC1yb3ctZGlhZ25vc3RpYy1iZTgzNzk3NC0yMDI2MTAxNnQwMjMwMDB6In0='))

import os,pathlib,subprocess,json,stat
r=pathlib.Path(C['root'])
for p in ['/opt/lims/releases','/var/lib/docker','/var/lib/containerd']:
 q=pathlib.Path(p)
 assert str(q)==str(q.resolve()) and all(not x.is_symlink() for x in [q,*q.parents])
 v=os.statvfs(q);assert v.f_frsize==4096 and v.f_bsize==4096
 free=v.f_bavail*v.f_frsize;assert free>=C['required']
 assert q.stat().st_dev==64769
u=subprocess.run(['systemctl','show',C['unit'],'--property=LoadState','--value'],capture_output=True,check=False)
assert u.stdout.strip()==b'not-found' and not u.stderr
if C['phase']=='BEFORE_ROOT':
 assert not r.exists() and not r.is_symlink()
 root=pathlib.Path(C['oldRoot']);mains=C['mains'];pins=C['inputPins']
 expected={m+s for m in mains for s in ('','-wal','-shm')}
 assert len(mains)==2 and set(pins)==expected and len(expected)==6
 assert str(root)==str(root.resolve()) and all(not q.is_symlink() for q in [root,*root.parents])
 def snapshot():
  for m in mains:
   p=root/m
   assert {q.name for q in p.parent.glob(p.name+'*')}=={p.name,p.name+'-wal',p.name+'-shm'}
  values={};identities=set()
  for n in sorted(expected):
   p=root/n
   assert str(p)==str(p.resolve()) and all(not q.is_symlink() for q in [p,*p.parents])
   a=p.lstat();pin=pins[n]
   assert stat.S_ISREG(a.st_mode) and a.st_nlink==1 and (a.st_dev,a.st_ino) not in identities
   identities.add((a.st_dev,a.st_ino))
   v={'bytes':a.st_size,'allocatedBytes':a.st_blocks*512,'device':a.st_dev,'inode':a.st_ino,'mode':stat.S_IMODE(a.st_mode),'mtimeNs':a.st_mtime_ns}
   assert all(v[k]==pin[k] for k in v) and v['mode']==0o400
   if n.endswith('-wal'):assert v['bytes']==v['allocatedBytes']==0
   values[n]={**v,'nlink':a.st_nlink,'ctimeNs':a.st_ctime_ns}
  return values
 assert snapshot()==snapshot()

else:
 assert r.is_dir() and str(r)==str(r.resolve()) and not r.is_symlink()
 assert {p.name for p in r.iterdir()}==set(C['hashes'])
 import hashlib
 for n,h in C['hashes'].items():
  p=r/n;assert p.is_file() and not p.is_symlink() and p.stat().st_nlink==1
  assert hashlib.sha256(p.read_bytes()).hexdigest()==h and p.stat().st_mode&0o777==0o400
print(json.dumps({'phase':C['phase'],'requiredBytes':C['required'],'freeBytes':free,'device':64769,'sameFilesystemNonadditive':True,'unusedUnit':C['unit']}))
