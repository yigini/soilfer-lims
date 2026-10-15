import json,os,subprocess,datetime
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','BUILDX_BUILDER','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
rows=[]
for args in [['docker','buildx','version'],['docker','buildx','inspect','default'],['docker','buildx','prune','--help'],['docker','context','inspect','default']]:
 r=subprocess.run(args,capture_output=True,timeout=30,env=env)
 assert len(r.stdout)+len(r.stderr)<=2097152
 rows.append({'argv':args,'exitCode':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode()})
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':rows,'mutations':0,'productionDatabaseConnections':0}))
