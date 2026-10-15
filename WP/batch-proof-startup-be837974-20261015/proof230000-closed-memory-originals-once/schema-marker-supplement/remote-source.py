import base64,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-startup-be837974-20261015T230000Z')
state=subprocess.check_output(['systemctl','show','lims-workflow-batch-startup-be837974-20261015t230000z','--property=ActiveState,MainPID,InvocationID'],timeout=15).decode()
p=dict(x.split('=',1) for x in state.splitlines());assert p['ActiveState']=='failed' and p['MainPID']=='0' and p['InvocationID']=='b962da09082d4fb49c8b9076181b7f4c'
out=[]
for name in ['startup-1-database/schema.prisma','startup-1-database/.seed_complete']:
 path=root/name
 for a in [path,*path.parents]:assert not a.is_symlink()
 before=path.stat();assert stat.S_ISREG(before.st_mode) and before.st_size<=100000
 raw=path.read_bytes();after=path.stat();assert before==after
 out.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':stat.S_IMODE(after.st_mode),'data':base64.b64encode(raw).decode()})
print(json.dumps({'systemctlOriginal':state,'files':out,'newSqlConnections':0,'newDatabaseFetches':0}))
