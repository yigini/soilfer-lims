"""One bounded read-only R2 interface probe and actual new direction retention."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2]
D=R/'WP/r2-cache-cap-acc15844-20261015/interface-and-new-direction-readonly-once'
assert not D.exists();D.mkdir()
def save(n,b):
    with (D/n).open('xb') as f:f.write(b)
save('actual-claudio6200547786-original.json',subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/6200547786'],cwd=R))
probe='''import json,os,subprocess,datetime
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','BUILDX_BUILDER','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
rows=[]
for args in [['docker','buildx','version'],['docker','buildx','inspect','default'],['docker','buildx','prune','--help'],['docker','context','inspect','default']]:
 r=subprocess.run(args,capture_output=True,timeout=30,env=env)
 assert len(r.stdout)+len(r.stderr)<=2097152
 rows.append({'argv':args,'exitCode':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode()})
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':rows,'mutations':0,'productionDatabaseConnections':0}))
'''
save('read-only-host-probe-source.py',probe.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=probe.encode(),capture_output=True,timeout=135,cwd=R)
save('host-stdout-original.json',r.stdout);save('host-stderr-original.log',r.stderr)
save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'cacheOperations':0,'productionConnections':0},indent=2)+'\n').encode())
assert r.returncode==0
v=json.loads(r.stdout);assert all(c['exitCode']==0 and not c['stderr'] for c in v['commands'])
print(json.dumps(v,indent=2))
