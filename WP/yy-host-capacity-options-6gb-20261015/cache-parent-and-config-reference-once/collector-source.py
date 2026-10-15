import datetime,http.client,json,pathlib,re,socket
s={'api': '1.52', 'containers': ['a50b808127315074d0a76680b0d609e816670ae6d62e846d4b088eba3964ed37', '8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b', 'ff8e50fb14ce753932f14ac00c560c3c00c7e98045affb9a9899b37f47a082bc', 'd0db5ec747d0509a717c5ad731a2ba4cae678e0d291dab53eff95bf7f243f604', 'eb5bce55691fed1fc571c2752eeda8963d26a862954a7ceee963a960cc1e3488', '861b523387a6abc3385e8c560f53405da5dc0756b9d211aba891b715c3b62749', '52ca56d4efadbb6a18b32dc9c34315d4edbc7be84e0eb7459a320f28ca91b751', '68af202d41d53af02dd880c25ae1649950ef48fe09b2c53e9f6c66ba8eb80797', 'a3d7b230f1ebfbf462db04189e5edf2ae080610b3a42bab51448965459b10620', 'eab13499643b6cd6166c3ef85a0f53b8c8e23be27cd37fb795014b3689c71ced', '3860d1a6c0aaa27de6c71189b3209bcdc17da633136f5dff3b860871acb90011', 'df6d61097e090f8755751d8dcdbc3c779abe870724e5aab696a13d80f0bc84d4', '4a96937e5c61465cf8b356863a76faf0fc6cea6bb507d7546a11e1826bf66c86', 'a6f266f1e3d1dc5acfb17da3cf70070bc38d26042ed9d51146bcd54da21f6c65', 'f101805eb27b290d3e694b3d24712e053e06185851b78d1eb295d72d6ab1d9bb', 'bb55005c9b9a72bc43b3f884a87b4ffe63806c90d9ed40414947fb4fd2c6dd91'], 'tags': ['alitt-api:foundation-20261002', 'alitt-web:foundation-20261002', 'chrislusf/seaweedfs:4.48', 'lims-qc188:6f72590', 'lims-qc189:dfac90e', 'littv2-dynamic-app:latest', 'littv2-subdomain-app:latest', 'littv3-app:latest', 'postgis/postgis:16-3.4', 'postgis/postgis:16-3.5', 'soil-museum:latest', 'soil-museum:prev-20261014-085302', 'soil-museum:prev-20261014-093649', 'soilfer-lims:1.9.0-319ade7', 'soilfer-lims:1.9.0-9f298cc', 'soilfer-lims:1.9.0-bbd1683', 'soilfer-lims:audit-187-a14ff63', 'soilfer-lims:audit-combined-eb6de2e8-main-feac6534-retry-20261010210829Z', 'soilfer-lims:audit-combined-eb6de2e8-repair-pr-0685d34d-20261010T164000Z', 'soilfer-lims:audit-combined-eb6de2e8-repair-pr-0685d34d-verified-20261010T170400Z', 'soilfer-lims:audit-instrument-import-build-5dd5488d-20261012T104515Z', 'soilfer-lims:audit-instrument-import-build-959d17e1-20261012T135400Z', 'soilfer-lims:audit-preparation-ae64f169-build-20261011T110500Z', 'soilfer-lims:audit-runtime-kobo-build-171dd36c-20261011T193050Z', 'soilfer-lims:audit-runtime-kobo-build-51f67988-20261012T035200Z', 'soilfer-lims:audit-runtime-kobo-build-f830f900-20261011T231018Z', 'soilfer-lims:audit-workflow-batch-build-cde8c889-20261014T221500Z', 'soilfer-lims:audit-workflow-batch-build-cde8c889-20261015T010000Z', 'soilfer-lims:rollback-pre-audit23-9f298cc', 'soilfer/gateway:latest', 'soilfer/hub:5.5.2', 'soilfer/lab:2026.10b', 'soilfer/manual-sync:latest', 'temporalio/admin-tools:1.32.0', 'temporalio/server:1.32.0'], 'envFiles': ['/opt/alitt/.env', '/opt/lims/.env', '/opt/littv2-dynamic/.env', '/opt/littv2-subdomain/.env', '/opt/littv3/.env', '/opt/soil-museum/.env', '/opt/soilfer-learn/.env']}
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
