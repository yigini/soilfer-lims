import base64,datetime,hashlib,http.client,json,os,pathlib,re,socket,stat,subprocess
root=pathlib.Path('/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T220000Z');unit='lims-r2-cache-acc15844-20261015t220000z';inv='b9eb871451b04dbfb1cc666fe0b4ce83';expected={'authority-6189025975-original.json': {'bytes': 6545, 'sha256': '16e9b64f1e0729e6c8d66a18e5099b2ac88d00ee1199bea528df8c28563a6b34'}, 'authority-6189658753-original.json': {'bytes': 6654, 'sha256': '433dee0b65e0a046bf905aa59f8a2c6821f484026a08674def660fb2a0a55607'}, 'authority-6189669837-original.json': {'bytes': 4262, 'sha256': 'e6ea6a6dc2a0f13769eecd0f60780072b8a2902952d3ca30c7cae76017703dcf'}, 'authority-6191219093-original.json': {'bytes': 5365, 'sha256': '1c74e5f354e8f2c434d333b1fcf5830d01224866b4c93bc44bfd83975510ab71'}, 'authority-6198899941-original.json': {'bytes': 5566, 'sha256': 'e257fdab5780d1b5dab8d897a09e14c49fdfa862bdb0916a40db2c658116fb10'}, 'authority-6200547786-original.json': {'bytes': 6372, 'sha256': '3c6437ccb93913449b4671ca4ee919caba289749b54e76d25798f33f95adf3ca'}, 'coordination-history.json': {'bytes': 2349018, 'sha256': '06b71fe23a22828d9c7a6ce1e76241c0a152a95b605247a991e7aba63e30b6f8'}, 'launch_r2.py': {'bytes': 6893, 'sha256': '52ce9dda434305a3e32bf791921e19376490590250bde392c50d13781af142b8'}, 'main-ci-original.json': {'bytes': 12122, 'sha256': '2c90f06107206bb4bdb799a458e15a3d80a58f486c6c741ca9841a70daca5388'}, 'main-original.json': {'bytes': 336, 'sha256': '5dbe45b3d22a65a8a14dc291df3e7fc536f7465cceca1682788cdb46d6448679'}, 'package-input.json': {'bytes': 4417, 'sha256': '81e468ad7559278939363501a2f37a327777560b39bfe43953d437d197d8b916'}, 'pr295-actual-pass.json': {'bytes': 6787, 'sha256': '3d504670dbe3035c87ff67d73c50782e005a1893c4665de338de9fb57ce0a25a'}, 'pr295-comments.json': {'bytes': 10375, 'sha256': '9208e63aabaef722d325581ca85c0e5523ff68b6e0950f321829826b071bcf7f'}, 'pr295-original.json': {'bytes': 23239, 'sha256': 'da41a662a90b71bb45d63745a2e01a867f3e57165842467e1cd5058340022615'}, 'pr296-actual-pass.json': {'bytes': 8178, 'sha256': '83293fdf38e293253ec6ae50ff81dc3a9b61cd87fe863d04eaa465f99a8b9f47'}, 'pr296-comments.json': {'bytes': 13440, 'sha256': '4a930648a2fd0569f6125d31ac2a632e2dd0632f19218b03f4107c3a9a614c08'}, 'pr296-original.json': {'bytes': 65850, 'sha256': '285d5824a01340ae2f6e95582807a7500a86c8eadebeda1cf7f85a8179a1de97'}, 'pr297-actual-pass.json': {'bytes': 5571, 'sha256': '2272d318b7d824d7341e90cd340b53bfeb81dc5cbec26150f857b4db8251a167'}, 'pr297-comments.json': {'bytes': 19803, 'sha256': '948d319244b8b69d44aed4b3a4585174723cc3257bf152b434eddaeb95538c4a'}, 'pr297-original.json': {'bytes': 33502, 'sha256': '0c3885cbc43d8d2c007bdc172858c775da15ba9ff7434621b963443a698a5b6a'}, 'pr298-actual-pass.json': {'bytes': 8010, 'sha256': '184b61b81a83ee40832800c1ade276ccebaf1542e534bb6a12e0cfed19fa024c'}, 'pr298-comments.json': {'bytes': 14359, 'sha256': '611a35c29ee09343250b11ca49f7387017712e27e5d010d66fe76ecd53726d7b'}, 'pr298-original.json': {'bytes': 31968, 'sha256': '491d005383b5e66e7d18134de71d8f9d0da38fda5b3734112bc17e85a109f12e'}, 'prepare_r2.py': {'bytes': 4816, 'sha256': '9223aec1aae8d5d14e59d3888c81fe47dcf9a66eb69fc4df7cd8e2261faa22a2'}, 'prior-r2-du-refusal.json': {'bytes': 1480, 'sha256': 'be7e104fbd7617f75f11fadd5142bc23a2049aaf463f3d37f51a6235d1b496a1'}, 'prior-r2-render-refusal.json': {'bytes': 1220, 'sha256': '4f7fa58ae5225f03929a3df10d6cc793edc9b2e75ad75c4521025ce48c50be23'}, 'qualified-build-receipt.json': {'bytes': 7893, 'sha256': 'cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'}, 'qualified-image-inspect.json': {'bytes': 7229, 'sha256': '3cd29d941248204a6709939c80ba7c5f1fc673e374e2fc413eda74935eab35c3'}, 'r2_cache.py': {'bytes': 14856, 'sha256': '6b4252dc46a78ee085713c1fe732a7e9d49ab6a2f36caf2654b68c616dae5f4c'}, 'r2_contract.py': {'bytes': 18706, 'sha256': '318815e2b2cd01a9651904fe60709e1fc4659541c9e67e203d374015aa072208'}, 'source-index.json': {'bytes': 1254, 'sha256': '47c51a806973fa61072692fac7ee30408053628d697b1c014691d10affbc5406'}, 'source-review.json': {'bytes': 8742, 'sha256': 'c69c3efca094f4cd4a97d24ddbb1f4bb98dbbc23d600d1e95a2a3dccfd0a4dba'}, 'verify_r2.py': {'bytes': 19577, 'sha256': 'c07b19e936a1bcd05233409fd2ebbb4ae76a93657f45117698d8e67fcbcf734d'}};image='sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a';buildroot=pathlib.Path('/opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z');receiptsha='cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'
assert root.is_dir() and root.resolve()==root and not root.is_symlink()
propsraw=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec'],capture_output=True,timeout=15)
assert propsraw.returncode==0 and not propsraw.stderr and len(propsraw.stdout)<65536
props=dict(v.split('=',1) for v in propsraw.stdout.decode().splitlines())
assert props['MainPID']=='0' and props['ActiveState'] in ['failed','inactive'] and (props['InvocationID']==inv or (props['LoadState']=='not-found' and props['InvocationID']==''))
assert sum((root/n).is_file() for n in ['terminal-failure.json','terminal-receipt.json'])==1,'One actual terminal record required'
names=sorted(p.relative_to(root).as_posix() for p in root.rglob('*'));assert len(names)<=10000
files={};captured={};total=0
def capture(n,raw,mode=None):
 global total
 total+=len(raw);assert len(raw)<=32*1024**2 and total<=544*1024**2
 files[n]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlobOid':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest(),'mode':mode};captured[n]=base64.b64encode(raw).decode()
for n in names:
 p=root/n;assert not p.is_symlink()
 if p.is_dir():continue
 a=p.stat();assert stat.S_ISREG(a.st_mode) and a.st_size<=32*1024**2
 raw=p.read_bytes();b=p.stat();assert (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns)==(b.st_dev,b.st_ino,b.st_size,b.st_mtime_ns)
 capture(n,raw,oct(stat.S_IMODE(a.st_mode)))
 if n in expected:assert len(raw)==expected[n]['bytes'] and files[n]['sha256']==expected[n]['sha256'] and files[n]['mode']=='0o400',n
assert set(expected)<=set(files) and sorted(p.relative_to(root).as_posix() for p in root.rglob('*'))==names
for n in ['journal-original.jsonl','journal-original.log']:
 output='json' if n.endswith('jsonl') else 'short-iso-precise'
 q=subprocess.run(['journalctl','-u',unit,'--no-pager','-o',output],capture_output=True,timeout=15);assert q.returncode==0 and not q.stderr and len(q.stdout)<=8388608;capture('fresh-closed/'+n,q.stdout)
jrows=[json.loads(x) for x in base64.b64decode(captured['fresh-closed/journal-original.jsonl']).splitlines() if x]
assert {x.get('INVOCATION_ID',x.get('_SYSTEMD_INVOCATION_ID')) for x in jrows}=={inv}
capture('fresh-closed/systemctl-original.stdout',propsraw.stdout);capture('fresh-closed/systemctl-original.stderr',propsraw.stderr)
original=buildroot/'build-receipt.json';a=original.stat();raw=original.read_bytes();b=original.stat();assert not original.is_symlink() and stat.S_IMODE(a.st_mode)==0o400 and (a.st_ino,a.st_size,a.st_mtime_ns)==(b.st_ino,b.st_size,b.st_mtime_ns) and hashlib.sha256(raw).hexdigest()==receiptsha
capture('fresh-closed/qualified-build-receipt-original.json',raw,'0o400')
q=subprocess.run(['docker','image','inspect',image],capture_output=True,timeout=20);assert q.returncode==0 and not q.stderr and len(q.stdout)<=2097152 and json.loads(q.stdout)==json.loads((root/'qualified-image-inspect.json').read_bytes());capture('fresh-closed/qualified-image-entire-inspect-original.json',q.stdout)
class UnixDocker(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(20);self.sock.connect('/var/run/docker.sock')
def get(path):
 c=UnixDocker('localhost',timeout=20)
 try:
  c.request('GET',path);q=c.getresponse();raw=q.read(32*1024**2+1);assert q.status==200 and len(raw)<=32*1024**2;return json.loads(raw)
 finally:c.close()
rows=get('/v1.52/containers/json?all=1');assert type(rows) is list and len(rows)<=256
containers={}
def canon(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
for row in rows:
 ident=row['Id'];assert re.fullmatch('[a-f0-9]{64}',ident) and ident not in containers
 v=get('/v1.52/containers/'+ident+'/json');assert v['Id']==ident
 mounts=sorted(canon(x) for x in v['Mounts']);assert len(mounts)==len(set(mounts));state=v['State']
 containers[ident]={'Id':ident,'Name':v['Name'],'Image':v['Image'],'Labels':v['Config'].get('Labels'),'Mounts':mounts,'Status':state['Status'],'StartedAt':state['StartedAt'],'OOMKilled':state['OOMKilled'],'RestartCount':v['RestartCount']}
rows=get('/v1.52/images/json?all=1&manifests=true');assert type(rows) is list and len(rows)<=1024;images={}
for row in rows:
 ident=row['Id'];assert re.fullmatch('sha256:[a-f0-9]{64}',ident) and ident not in images
 images[ident]={k:v for k,v in row.items() if k not in ['Containers','SharedSize','VirtualSize']}
 for key in ['RepoTags','RepoDigests']:
  if images[ident].get(key) is not None:images[ident][key]=sorted(images[ident][key])
preservation={'containers':containers,'images':images};capture('fresh-closed/safe-selected-preservation-derived.json',(canon({'value':preservation,'rawContainerConfigAndEnvironmentRetained':False})+'\n').encode())
df={}
for n in ['/opt/lims','/var/lib/docker','/var/lib/containerd']:
 p=pathlib.Path(n);assert p.resolve()==p and not any(x.is_symlink() for x in [p,*p.parents]);v=os.statvfs(p);df[n]={'realpath':str(p.resolve()),'device':p.stat().st_dev,'block':v.f_frsize,'available':v.f_bavail*v.f_frsize}
q=subprocess.run(['df','-B1','--output=source,fstype,size,used,avail,target','/opt/lims','/var/lib/docker','/var/lib/containerd'],capture_output=True,timeout=15);assert q.returncode==0 and not q.stderr
capture('fresh-closed/df-original.stdout',q.stdout);capture('fresh-closed/statvfs-original.json',(canon(df)+'\n').encode())
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationId':inv,'properties':props,'originalRootFileCount':sum(not n.startswith('fresh-closed/') for n in files),'files':files,'capturedBase64':captured,'cacheMutationsByRetainer':0,'productionDatabaseConnections':0,'rawContainerConfigAndEnvironmentRetained':False}))
