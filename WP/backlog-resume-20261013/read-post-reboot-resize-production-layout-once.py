"""Retain actual YY-via-Cl resumption/conditional growth and fresh read-only host state."""
import datetime,hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parents[2];d=repo/'WP/batch-proof-startup-be837974-20261015/post-reboot-readonly-preflight-once';assert not d.exists();d.mkdir()
for i in [6202595120,6202615241]:
    raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(i)],cwd=repo);v=json.loads(raw);assert v['id']==i and v['created_at']==v['updated_at'] and v['performed_via_github_app']['id']==1236702 and v['performed_via_github_app']['slug']=='claude'
    (d/('actual-authority-'+str(i)+'.json')).write_bytes(raw)
program=r'''import datetime,hashlib,json,pathlib,subprocess,time
def run(args):
 r=subprocess.run(args,capture_output=True,timeout=30)
 return {'argv':args,'exitCode':r.returncode,'stdout':r.stdout.decode('utf-8','strict'),'stderr':r.stderr.decode('utf-8','strict')}
out={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'READ_ONLY_POST_REBOOT_HEALTH_AND_LAYOUT','productionSqliteConnections':0,'mutations':0}
out['lsblk']=run(['lsblk','-b','-J','-o','NAME,KNAME,PATH,TYPE,SIZE,FSTYPE,MOUNTPOINTS,PKNAME'])
out['df']=run(['df','-B1','-T','--','/opt/lims','/var/lib/docker','/var/lib/containerd'])
out['findmnt']=run(['findmnt','-J','-T','/opt/lims','-o','SOURCE,FSTYPE,TARGET,OPTIONS'])
out['dockerPs']=run(['docker','ps','--no-trunc','--format','{{json .}}'])
out['production']=[]
for n in range(3):
 r=subprocess.run(['docker','inspect','soilfer-lims'],capture_output=True,timeout=15)
 assert r.returncode==0 and len(r.stdout)<4*1024**2 and not r.stderr
 v=json.loads(r.stdout)[0];env=dict(s.split('=',1) for s in v['Config']['Env'] if '=' in s)
 safe={'id':v['Id'],'name':v['Name'],'image':v['Image'],'state':v['State'],'restartCount':v['RestartCount'],'memory':v['HostConfig']['Memory'],'swap':v['HostConfig']['MemorySwap'],'revision':v['Config']['Labels'].get('org.opencontainers.image.revision'),'mounts':v['Mounts'],'flags':{k:env.get(k) for k in ['NODE_OPTIONS','DISABLE_BACKGROUND_JOBS','ALLOW_PRISMA_DB_PUSH','ALLOW_AUTO_SEED']},'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 safe['http']=run(['docker','exec',v['Id'],'node','-e',"fetch('http://127.0.0.1:3000/api/health').then(async r=>{const b=await r.json();console.log(JSON.stringify({status:r.status,body:b}));if(r.status!==200||b.status!=='ok')process.exitCode=1}).catch(e=>{console.error(e.message);process.exitCode=1})"])
 out['production'].append(safe)
 if n<2:time.sleep(2)
print(json.dumps(out))
'''
compile(program,'post-reboot-readonly','exec');(d/'remote-readonly-source.py').write_text(program,encoding='utf-8')
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=repo,input=program.encode(),capture_output=True,timeout=120)
(d/'stdout-original.json').write_bytes(r.stdout);(d/'stderr-original.log').write_bytes(r.stderr);(d/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mutations':0,'sourceSha256':hashlib.sha256(program.encode()).hexdigest()})+'\n')
assert r.returncode==0 and not r.stderr
v=json.loads(r.stdout);print(json.dumps({'observedUtc':v['observedUtc'],'lsblk':v['lsblk'],'df':v['df'],'findmnt':v['findmnt'],'production':[{'id':p['id'],'running':p['state']['Running'],'health':p['state'].get('Health',{}).get('Status'),'restarts':p['restartCount'],'startedAt':p['state']['StartedAt'],'http':p['http']} for p in v['production']]},ensure_ascii=True))

