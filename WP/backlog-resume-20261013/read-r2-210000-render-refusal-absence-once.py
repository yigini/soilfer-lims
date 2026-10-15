"""One metadata-only absence observation after remote Python parser refusal; no cache calls."""
import datetime,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';D=S/'failed-render-210000-readonly-absence-once'
assert not D.exists();D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
probe='''import datetime,json,pathlib,subprocess
root=pathlib.Path('/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T210000Z');unit='lims-r2-cache-acc15844-20261015t210000z'
assert not root.exists() and not root.is_symlink(),'Unexpected root; STOP'
r=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,MainPID,InvocationID'],capture_output=True,timeout=15)
assert len(r.stdout)+len(r.stderr)<65536
assert 'LoadState=not-found' in r.stdout.decode(),'Unexpected unit; STOP'
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'rootAbsent':True,'unit':unit,'unitNotFound':True,'systemctl':{'exitCode':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode()},'cacheCalls':0,'fileWrites':0,'productionConnections':0}))
'''
save('readonly-probe-source.py',probe.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=35)
save('stdout-original.json',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'cacheOperations':0},indent=2)+'\n').encode())
assert r.returncode==0
print(r.stdout.decode())
