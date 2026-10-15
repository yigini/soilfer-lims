"""Resolve cache parent field and image references without changing any host object."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];P=R/'WP/yy-host-capacity-options-6gb-20261015';D=P/'cache-parent-and-config-reference-once';assert not D.exists();D.mkdir()
a=json.loads((P/'dependency-and-old-backup-hashes-once/stdout-original.json').read_bytes())
selection={'api':a['dockerVersion']['ApiVersion'],'containers':[c['Id'] for c in a['versionedSafeSelectedContainers'] if c['State']=='running'],'tags':sorted({t for x in a['versionedSafeSelectedImages'] for t in x.get('RepoTags') or []}),'envFiles':sorted({str(pathlib.PurePosixPath(p).parent/'.env') for p in a['configFilesScanned'] if pathlib.PurePosixPath(p).name in ['docker-compose.yml','docker-compose.yaml']}|{'/opt/lims/.env'})}
script=r'''import datetime,http.client,json,pathlib,re,socket
s=SELECTION_VALUE
class C(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(60);self.sock.connect('/var/run/docker.sock')
def get(p):
 assert re.fullmatch(r'/v[0-9]+\.[0-9]+/(system/df|containers/[a-f0-9]{64}/json)',p)
 c=C('localhost');c.request('GET',p)
 try:r=c.getresponse();b=r.read(32*1024**2+1);assert r.status==200 and len(b)<=32*1024**2;return json.loads(b)
 finally:c.close()
prefix='/v'+s['api'];df=get(prefix+'/system/df');cache=[]
for x in df.get('BuildCache',[]):
 keys=[k for k in x if k.strip()=='Parents'];assert len(keys)<=1
 cache.append({'id':x['ID'],'inUse':x['InUse'],'shared':x['Shared'],'size':x['Size'],'actualParentField':keys[0] if keys else None,'parents':x[keys[0]] if keys else None,'allOriginalParentKeysAndValues':{k:x[k] for k in x if 'parent' in k.lower()}})
envrefs=[]
for id in s['containers']:
 x=get(prefix+'/containers/'+id+'/json')
 for line in x.get('Config',{}).get('Env',[]):
  key,_,value=line.partition('=')
  if 'IMAGE' not in key.upper():continue
  matches=[t for t in s['tags'] if t==value or t in value.split()]
  if matches:envrefs.append({'containerId':id,'name':x['Name'],'environmentKey':key,'exactImageTagReferences':matches,'otherEnvironmentNotStored':True})
filerefs=[];scanned=[]
for n in s['envFiles']:
 p=pathlib.Path(n)
 if not p.is_file() or p.is_symlink() or p.stat().st_size>1024**2:continue
 scanned.append(str(p))
 for number,line in enumerate(p.read_text(encoding='utf-8',errors='replace').splitlines(),1):
  key,_,value=line.partition('=');value=value.strip().strip('"').strip("'")
  if 'IMAGE' not in key.upper():continue
  matches=[t for t in s['tags'] if t==value or t in value.split()]
  if matches:filerefs.append({'path':str(p),'line':number,'imageVariableKey':key.strip(),'exactImageTagReferences':matches,'otherEnvironmentNotStored':True})
print(json.dumps({'status':'READONLY_CACHE_PARENT_AND_IMAGE_CONFIGURATION_REFERENCES','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dockerApiVersion':s['api'],'cacheWithActualParentEdges':cache,'runningContainerSelectedImageEnvironmentReferences':envrefs,'composeImageEnvironmentFilesScanned':scanned,'composeSelectedImageEnvironmentReferences':filerefs,'rawFullEnvironmentStored':False,'mutations':0,'hostFilesCreated':0,'filesDeleted':0,'prunes':0,'sqlConnections':0,'neverReplay':True}))
'''.replace('SELECTION_VALUE',repr(selection))
(D/'collector-source.py').write_text(script,encoding='utf-8');compile(script,str(D/'collector-source.py'),'exec')
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=script.encode(),capture_output=True,timeout=180)
for n,b in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr)]:
 with (D/n).open('xb') as f:f.write(b)
(D/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'neverReplay':True}),encoding='utf-8');assert r.returncode==0,'Inspect refusal; never replay'
v=json.loads(r.stdout);print(json.dumps({'status':v['status'],'observedUtc':v['observedUtc'],'cacheCount':len(v['cacheWithActualParentEdges']),'cacheParentFields':sorted({x['actualParentField'] or '<absent>' for x in v['cacheWithActualParentEdges']}),'containerImageEnvReferences':v['runningContainerSelectedImageEnvironmentReferences'],'fileImageEnvReferences':v['composeSelectedImageEnvironmentReferences'],'mutations':0}))
