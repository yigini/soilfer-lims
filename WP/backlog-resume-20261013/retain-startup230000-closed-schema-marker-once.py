"""Retain two remaining non-database small originals omitted by extension selection."""
import base64,datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-proof-startup-be837974-20261015/proof230000-closed-memory-originals-once'
record=json.loads((DEST/'closed-retention-record.json').read_bytes())
names=['startup-1-database/schema.prisma','startup-1-database/.seed_complete']
rows={r['path']:r for r in record['rootFileInventoryWithStableHashes']}
source="""import base64,hashlib,json,pathlib,stat,subprocess
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
"""
out=DEST/'schema-marker-supplement';out.mkdir()
(out/'remote-source.py').write_bytes(source.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=source.encode(),capture_output=True,timeout=60)
(out/'stdout-original.json').write_bytes(r.stdout);(out/'stderr-original.log').write_bytes(r.stderr)
(out/'exit-original.json').write_bytes(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}).encode())
assert r.returncode==0,'Retain refusal; never replay'
value=json.loads(r.stdout);assert [x['path'] for x in value['files']]==names
for item in value['files']:
 raw=base64.b64decode(item.pop('data'));assert len(raw)==rows[item['path']]['bytes']==item['bytes'] and hashlib.sha256(raw).hexdigest()==rows[item['path']]['sha256']==item['sha256'] and item['mode']==rows[item['path']]['mode']
 p=DEST/'remote-originals'/item['path'];p.parent.mkdir(exist_ok=True)
 with p.open('xb') as f:f.write(raw)
(out/'verified-supplement.json').write_bytes(json.dumps(value,sort_keys=True).encode())
print(json.dumps({'retainedSmallOriginals':names,'databaseBytesFetched':0}))
