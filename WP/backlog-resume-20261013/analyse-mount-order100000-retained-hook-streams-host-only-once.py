"""Independently analyze original private hook streams on HOST; return safe selected evidence only."""
import pathlib,json,subprocess,datetime
w=pathlib.Path(__file__).resolve().parents[2];b=w/'WP/batch-proof-mount-order-forward-be837974-20261016';d=b/'closed-hook-streams-host-only-analysis-once';assert not d.exists()
r=json.loads((b/'mount-order100000-closed-originals-once/closed-retention-record.json').read_bytes());rows={x['path']:x for x in r['rootFileInventoryWithStableHashes']}
pins={n:row for n,row in rows.items() if n.startswith('private-docker-call-') or __import__('re').fullmatch('docker-call-[0-9]{3}[.]json',n)};assert len(pins)==18
program=r"""import json,pathlib,sys,hashlib,stat,re
root=pathlib.Path('/opt/lims/releases/workflow-batch-mount-order-forward-be837974-20261016T100000Z');sys.path.insert(0,str(root))
from stop_owned import selected,OWNERS
pins=PIN_VALUE
for n,row in pins.items():
 p=root/n;a=p.stat();assert not p.is_symlink() and stat.S_IMODE(a.st_mode)==0o400 and (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns)==(row['device'],row['inode'],row['bytes'],row['mtimeNs']);data=p.read_bytes();z=p.stat();assert a==z and hashlib.sha256(data).hexdigest()==row['sha256']
metadata=[json.loads((root/('docker-call-'+str(i).zfill(3)+'.json')).read_bytes()) for i in range(1,7)];out=[]
for i,owner in enumerate(sorted(OWNERS)):
 calls=metadata[i*3:i*3+3];inventory=calls[0];assert inventory['argv']==['docker','ps','-aq','--no-trunc','--filter','label=io.soilfer.release-owned='+owner]
 ids=(root/inventory['streams']['stdout']['path']).read_bytes().decode('ascii').splitlines();assert len(ids)==1 and re.fullmatch('[a-f0-9]{64}',ids[0]);cid=ids[0];objects=[]
 for call in calls:
  assert call['returnCode']==0 and call['transportErrorType'] is None and 0<=call['elapsedSeconds']<=30 and call['streams']['stderr']['bytes']==0 and call['rawInspectStdoutNeverFetched'] is True
  for stream,entry in call['streams'].items():assert entry['hostOnly'] is True and entry['mode']==0o400 and pins[entry['path']]['sha256']==entry['sha256'] and pins[entry['path']]['bytes']==entry['bytes']
 for call in calls[1:]:
  assert call['argv']==['docker','inspect',cid];v=json.loads((root/call['streams']['stdout']['path']).read_bytes());assert len(v)==1 and v[0]['Id']==cid;obj=v[0];objects.append(selected(obj,owner));assert obj['State']['Running'] is False and obj['State']['OOMKilled'] is False and obj['State']['ExitCode']==137 and obj['RestartCount']==0 and obj['HostConfig']['Memory']==obj['HostConfig']['MemorySwap']==805306368
 assert objects[0]==objects[1];out.append({'before':objects[0],'after':objects[1],'retained':True})
hook=json.loads((root/'stop-post-result.json').read_bytes());assert out==hook['stoppedAndRetained'] and hook['errors']==[] and hook['postStopErrors']==[]
print(json.dumps({'status':'ORIGINAL_SIX_REAL_DOCKER_PS_INSPECT_HOOK_CALLS_INDEPENDENTLY_VERIFIED_HOST_ONLY','calls':metadata,'safeSelectedPairs':out,'originalPrivateStreams':12,'privateHmacKeysRead':0,'privateStreamBytesFetched':0,'newDockerCalls':0,'sqlConnections':0,'hostWrites':0,'allExactTwoOwnersStoppedRetained':True,'sourceRawFilesUnchanged':True}))
""".replace('PIN_VALUE',repr(pins))
compile(program,'host-only-retained-hook-stream-analysis.py','exec');d.mkdir();(d/'remote-source.py').write_text(program,encoding='utf-8',newline='\n');args=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-']
(d/'command-original.json').write_text(json.dumps({'argv':args,'hostWrites':0,'newDockerCalls':0,'privateKeysRead':0})+'\n',encoding='utf-8')
x=subprocess.run(args,cwd=w,input=program.encode(),capture_output=True,timeout=60)
for n,data in [('stdout-original.json',x.stdout),('stderr-original.log',x.stderr)]:
 with (d/n).open('xb') as f:f.write(data)
(d/'exit-original.json').write_text(json.dumps({'exitCode':x.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})+'\n',encoding='utf-8');assert x.returncode==0,x.stderr.decode()
v=json.loads(x.stdout);print(json.dumps({k:v[k] for k in ['status','originalPrivateStreams','privateHmacKeysRead','privateStreamBytesFetched','newDockerCalls','allExactTwoOwnersStoppedRetained']}))
