import datetime,json,pathlib,stat
result={}
for name in ['/opt/lims/releases','/var/lib/docker/volumes/lims_lims-data/_data']:
 p=pathlib.Path(name);rows=[]
 for q in sorted(p.iterdir()):
  s=q.lstat()
  if stat.S_ISREG(s.st_mode):rows.append({'name':q.name,'bytes':s.st_size,'allocatedBytes':s.st_blocks*512,'mtimeNs':s.st_mtime_ns,'mode':stat.S_IMODE(s.st_mode)})
 assert len(rows)<=10000;result[name]=rows
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'READONLY_ROOT_FILE_STAT_NO_CONTENT_OPEN','requestComment':6186928334,'rootRegularFiles':result,'sqlConnections':0,'mutations':0}))
