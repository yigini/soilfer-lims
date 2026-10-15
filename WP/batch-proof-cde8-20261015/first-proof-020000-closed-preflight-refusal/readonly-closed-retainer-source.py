import base64,datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T020000Z');unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t020000z'
state=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp'],capture_output=True,text=True,timeout=15)
props=dict(l.split('=',1) for l in state.stdout.splitlines() if '=' in l)
assert props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['InvocationID']=='565babf8c28d4c15b77a39d38f269dcb'
original=json.loads((root/'proof-terminal-refusal.json').read_bytes());assert original['error']=='RuntimeError: Descendant mount makes accounting incomplete' and original['closedUtc']=='2026-10-15T02:01:30.448385+00:00'
assert not (root/'fresh-production-snapshot').exists() and not (root/'installation-target').exists() and not (root/'fresh-actual-baseline.json').exists()
rows=[];total=0
for p in sorted(root.rglob('*')):
 assert not p.is_symlink()
 if p.is_file():
  a=p.stat();assert stat.S_IMODE(a.st_mode)==0o400 and a.st_size<=33554432
  raw=p.read_bytes();b=p.stat();assert (a.st_size,a.st_mtime_ns,a.st_mode,a.st_ino)==(b.st_size,b.st_mtime_ns,b.st_mode,b.st_ino)
  total+=len(raw);assert total<=67108864
  rows.append({'path':p.relative_to(root).as_posix(),'bytes':len(raw),'mode':stat.S_IMODE(b.st_mode),'sha256':hashlib.sha256(raw).hexdigest(),'data':base64.b64encode(raw).decode()})
assert len(rows)==22
spec=json.loads((root/'proof-input.json').read_bytes());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert all(sha(root/n)==h for n,h in spec['packageHashes'].items())
journal=subprocess.run(['journalctl','-u',unit,'--no-pager','-o','json','-n','1000'],capture_output=True,text=True,timeout=15);assert journal.returncode==0
mountinfo=pathlib.Path('/proc/self/mountinfo').read_text();assert len(mountinfo.encode())<=2097152
descendants=[]
for line in mountinfo.splitlines():
 fields=line.split();separator=fields.index('-');mount=pathlib.PurePosixPath(fields[4])
 for top in ['/opt/lims/releases','/var/lib/docker','/var/lib/containerd']:
  if pathlib.PurePosixPath(top) in mount.parents:descendants.append({'root':top,'mountId':fields[0],'parentId':fields[1],'device':fields[2],'mountRoot':fields[3],'mountPoint':fields[4],'filesystem':fields[separator+1],'source':fields[separator+2],'options':fields[5],'superOptions':fields[separator+3],'rawLine':line})
# Selected derived normal predecessor metadata only; no full env persisted.
v=json.loads(subprocess.check_output(['docker','inspect','8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b'],timeout=15))[0]
env=dict(s.split('=',1) for s in v['Config']['Env'] if '=' in s)
safe={'status':'SAFE_SELECTED_DERIVED_DOCKER_INSPECTION_NOT_FULL_RAW','id':v['Id'],'image':v['Image'],'revision':v['Config']['Labels'].get('org.opencontainers.image.revision'),'running':v['State']['Running'],'health':v['State']['Health']['Status'],'restarts':v['RestartCount'],'oom':v['State']['OOMKilled'],'memory':v['HostConfig']['Memory'],'swap':v['HostConfig']['MemorySwap'],'shmBytes':v['HostConfig']['ShmSize'],'flags':{k:env.get(k) for k in ['NODE_OPTIONS','ALLOW_PRISMA_DB_PUSH','ALLOW_AUTO_SEED','DISABLE_BACKGROUND_JOBS']},'mounts':v['Mounts']}
ids=subprocess.check_output(['docker','ps','-aq','--no-trunc'],timeout=15).decode().splitlines();before=json.loads((root/'container-inventory-before.json').read_bytes());assert set(before)<=set(ids)
changed=[];new_proof=[]
for id in ids:
 d=json.loads(subprocess.check_output(['docker','inspect',id],timeout=15))[0];labels=d['Config'].get('Labels') or {}
 if labels.get('io.soilfer.release-owned','').startswith(str(root)+':'):new_proof.append(id)
 if id in before:
  p=before[id]
  if p['name']!=d['Name'] or p['image']!=d['Image'] or p['labels']!=labels or p['mounts']!=d['Mounts'] or (not p['running'] and (d['State']['Running'] or p['startedAt']!=d['State']['StartedAt'])):changed.append(id)
assert not new_proof and not changed
print(json.dumps({'status':'CLOSED_PREFLIGHT_REFUSAL_ALL_ORIGINALS_READONLY_RETAINED_NOT_REPLAYED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state.stdout,'journalOriginal':journal.stdout,'mountinfoOriginal':mountinfo,'descendantMountMetadata':descendants,'normalPredecessorSelected':safe,'files':rows,'packageUnchanged':True,'productionCopies':0,'productionSqliteConnections':0,'installerAttempts':0,'defaultEntrypointAttempts':0,'newOwnedContainers':new_proof,'allHistoricalStoppedContainersPreserved':True,'productionMutations':0,'neverReplay':True}))
