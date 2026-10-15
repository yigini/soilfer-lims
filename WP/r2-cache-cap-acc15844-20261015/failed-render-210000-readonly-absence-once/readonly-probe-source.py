import datetime,json,pathlib,subprocess
root=pathlib.Path('/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T210000Z');unit='lims-r2-cache-acc15844-20261015t210000z'
assert not root.exists() and not root.is_symlink(),'Unexpected root; STOP'
r=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,MainPID,InvocationID'],capture_output=True,timeout=15)
assert len(r.stdout)+len(r.stderr)<65536
assert 'LoadState=not-found' in r.stdout.decode(),'Unexpected unit; STOP'
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'rootAbsent':True,'unit':unit,'unitNotFound':True,'systemctl':{'exitCode':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode()},'cacheCalls':0,'fileWrites':0,'productionConnections':0}))
