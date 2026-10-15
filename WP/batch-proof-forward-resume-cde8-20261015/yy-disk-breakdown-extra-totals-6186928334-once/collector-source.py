import datetime,json,subprocess
rows=[]
for name,args in [('docker-summary',['docker','system','df','--format','{{json .}}']),('live-data-and-lims-direct-child-physical-du',['du','-x','-B1','--max-depth=1','--','/var/lib/docker/volumes/lims_lims-data/_data','/opt/lims'])]:
 r=subprocess.run(args,capture_output=True,timeout=120);assert len(r.stdout)<4*1024**2 and len(r.stderr)<4*1024**2;rows.append({'label':name,'argv':args,'exitCode':r.returncode,'stdoutOriginal':r.stdout.decode(),'stderrOriginal':r.stderr.decode()})
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'requestComment':6186928334,'status':'READONLY_EXTRA_SUMMARY_AND_DIRECT_CHILD_METADATA_NOT_REPLAY','commands':rows,'mutations':0,'sqlConnections':0,'cleanup':0}))
