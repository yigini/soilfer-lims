"""Fresh read-only safe Docker metadata for proof-source preparation; no database/volume reads or copies."""
import datetime,hashlib,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2]
DEST=REPO/'WP/batch-proof-cde8-20261015/predecessor-metadata-readonly-once'
assert not DEST.exists();DEST.mkdir(parents=True)
probe='''import datetime,hashlib,json,subprocess
def read(argv):
 r=subprocess.run(argv,capture_output=True,timeout=15);assert r.returncode==0 and len(r.stdout)<=2097152 and len(r.stderr)<=65536
 return r.stdout
ids=read(['docker','ps','--filter','name=^/soilfer-lims$','--format','{{.ID}}']).decode().split();assert len(ids)==1,'Exactly one running known production service required'
raw=read(['docker','inspect',ids[0]]);values=json.loads(raw);assert len(values)==1
c=values[0];env=dict(v.split('=',1) for v in c['Config'].get('Env',[]) if '=' in v)
selected={k:env.get(k) for k in ['NODE_OPTIONS','ALLOW_PRISMA_DB_PUSH','ALLOW_AUTO_SEED','DISABLE_BACKGROUND_JOBS','DATABASE_PATH','DATABASE_URL']}
mounts=[{k:m.get(k) for k in ['Type','Name','Source','Destination','RW','Propagation']} for m in c['Mounts']]
expected={'/app/server/prisma':'lims_lims-data','/app/server/uploads':'lims_lims-assets'}
assert all(len([m for m in mounts if m['Destination']==dst and m['Type']=='volume' and m['Name']==name and m['RW'] is True])==1 for dst,name in expected.items())
state=c['State'];assert c['Name']=='/soilfer-lims' and c['Image']=='sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
assert c['Config']['Labels']['org.opencontainers.image.revision']=='959d17e11c357266f7c2a41b0c84ab76914c591e'
assert state['Running'] is True and state['OOMKilled'] is False and c['RestartCount']==0 and state['Health']['Status']=='healthy'
assert c['HostConfig']['Memory']==805306368 and selected['NODE_OPTIONS'] in [None,''] and selected['ALLOW_PRISMA_DB_PUSH']==selected['ALLOW_AUTO_SEED']=='false' and selected['DISABLE_BACKGROUND_JOBS']=='false'
print(json.dumps({'status':'ACTUAL_NORMAL_HEALTHY_PREDECESSOR_METADATA_READONLY','evidenceKind':'SAFE_SELECTED_DERIVED_DOCKER_INSPECTION_NOT_FULL_RAW_INSPECT','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'containerId':c['Id'],'containerName':c['Name'],'createdUtc':c['Created'],'startedUtc':state['StartedAt'],'image':c['Image'],'revision':c['Config']['Labels']['org.opencontainers.image.revision'],'running':True,'healthy':True,'restartCount':c['RestartCount'],'oomKilled':False,'memoryMax':c['HostConfig']['Memory'],'memorySwap':c['HostConfig']['MemorySwap'],'safeEnvironment':selected,'requiredProductionVolumeMetadata':mounts,'ports':c['NetworkSettings']['Ports'],'fullInspectionRawSha256':hashlib.sha256(raw).hexdigest(),'fullInspectionStored':False,'historicalReceiptIsBaselineEvidenceOnly':True,'productionDatabaseConnections':0,'databaseCountQueries':0,'volumeFilesOpened':0,'filesCopied':0,'containerStartsStopsRestarts':0,'settingsChanged':0,'proofsLaunched':0,'deployments':0}))
'''
with (DEST/'readonly-safe-metadata-probe-source.py').open('x',encoding='utf-8') as f:f.write(probe)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=45)
for n,raw in [('stdout-original-selected-metadata.json',r.stdout),('stderr-original.txt',r.stderr)]:
    with (DEST/n).open('xb') as f:f.write(raw)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:json.dump({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'SAFE_READONLY_CONTAINER_METADATA_ONLY','productionDatabaseConnections':0,'volumeFilesOpened':0,'settingsChanged':0,'neverReplay':True},f,indent=2)
assert r.returncode==0,'Fresh predecessor metadata guard refused; no recovery/restart/settings change'
v=json.loads(r.stdout);print(json.dumps({k:x for k,x in v.items() if k not in ['requiredProductionVolumeMetadata','ports','fullInspectionRawSha256']}))
