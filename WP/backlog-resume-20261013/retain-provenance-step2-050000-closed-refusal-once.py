"""Read-only retention of the consumed 050000 unit; never import or rerun its code."""
import base64, datetime, hashlib, json, pathlib, subprocess
W = pathlib.Path(__file__).resolve().parents[2]
B = W / 'WP/batch-proof-provenance-step2-be837974-20261016'
D = B / 'step2-050000-closed-refusal-originals-once'
assert not D.exists()
D.mkdir()
def save(n, b):
    with (D / n).open('xb') as f: f.write(b)
probe = r'''import base64,datetime,hashlib,json,os,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-provenance-step2-be837974-20261016T050000Z')
unit='lims-workflow-batch-provenance-step2-be837974-20261016t050000z'
inv='0d1bb46846ba427196e14434fcc3c3a2'
assert root.is_dir() and root.resolve(strict=True)==root and not root.is_symlink()
def call(args,bound=32*1024**2):
 r=subprocess.run(args,capture_output=True,timeout=30)
 assert r.returncode==0 and len(r.stdout)+len(r.stderr)<=bound,(args,r.returncode)
 return {'argv':args,'exitCode':r.returncode,'stdout':r.stdout.decode('utf-8','strict'),'stderr':r.stderr.decode('utf-8','strict')}
state=call(['systemctl','show',unit,'--all'])
props=dict(l.split('=',1) for l in state['stdout'].splitlines() if '=' in l)
assert props['ActiveState']=='failed' and props['SubState']=='failed' and props['MainPID']=='0' and props['Result']=='exit-code' and props['ExecMainStatus']=='1' and props['InvocationID']==inv
assert 'status=1' in props['ExecStopPost'] and 'code=exited' in props['ExecStopPost']
journal=call(['journalctl','--all','-u',unit,'--no-pager','--output=json'])
records=[json.loads(l) for l in journal['stdout'].splitlines() if l]
assert records and all(r.get('_SYSTEMD_INVOCATION_ID',r.get('INVOCATION_ID'))==inv for r in records)
def meta(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and not p.is_symlink()
 return {'bytes':s.st_size,'allocatedBytes':s.st_blocks*512,'mode':oct(stat.S_IMODE(s.st_mode)),'device':s.st_dev,'inode':s.st_ino,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns,'nlink':s.st_nlink}
files={};public={};total=0
for p in sorted(root.rglob('*')):
 assert p.parent==root and not p.is_symlink() and len(files)<200000,'Unexpected nested or alias root entry'
 before=meta(p);assert before['mode']=='0o400' and before['bytes']<=16*1024**2
 raw=p.read_bytes();after=meta(p);assert before==after and len(raw)==before['bytes']
 n=p.relative_to(root).as_posix();files[n]={'stat':before,'sha256':hashlib.sha256(raw).hexdigest()};total+=len(raw);assert total<=128*1024**2
 if n!='private-value-hmac-key.json':public[n]=base64.b64encode(raw).decode('ascii')
assert len(files)==64 and set(files)-set(public)=={'private-value-hmac-key.json'}
spec=json.loads(base64.b64decode(public['proof-input.json']));expected=dict(spec['packageHashes']);expected['proof-input.json']=hashlib.sha256(base64.b64decode(public['proof-input.json'])).hexdigest()
assert len(expected)==59 and all(files[n]['sha256']==d for n,d in expected.items())
assert set(files)-set(expected)=={'private-value-hmac-key.json','proof-intent.json','proof-terminal-refusal.json','live-evolution-terminal.json','stop-post-result.json'}
terminal=json.loads(base64.b64decode(public['proof-terminal-refusal.json']));stop=json.loads(base64.b64decode(public['stop-post-result.json']))
assert terminal['status']=='FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY' and terminal['neverRetry'] is True and terminal['productionMutations']==terminal['productionSqliteConnections']==terminal['newProductionSnapshots']==0
assert stop['allExactOwnedStopped'] is True and stop['stoppedAndRetained']==stop['errors']==[] and stop['controllerMemory'] is None and stop['controllerMemoryErrorType']=='RuntimeError'
listing=call(['docker','ps','-aq','--no-trunc']);ids=listing['stdout'].splitlines();assert len(ids)<=4096 and len(ids)==len(set(ids))
containers=[]
for cid in ids:
 assert len(cid)==64 and all(c in '0123456789abcdef' for c in cid)
 raw=call(['docker','inspect',cid]);rows=json.loads(raw['stdout']);assert len(rows)==1 and rows[0]['Id']==cid
 v=rows[0];h=v['HostConfig'];env=v['Config'].get('Env',[]);allowed=['NODE_OPTIONS','PRISMA_AUTO_PUSH','PRISMA_AUTO_SEED','ENABLE_BACKGROUND_JOBS']
 selected={k:next((x.split('=',1)[1] for x in env if x.startswith(k+'=')),None) for k in allowed}
 containers.append({'Id':v['Id'],'Name':v['Name'],'Image':v['Image'],'Labels':v['Config'].get('Labels',{}),'Mounts':v['Mounts'],'State':v['State'],'RestartCount':v['RestartCount'],'HostConfig':{k:h.get(k) for k in ['Memory','MemorySwap','RestartPolicy','NetworkMode','PortBindings']},'selectedEnvironment':selected})
owners={str(root)+':startup-1',str(root)+':startup-2'}
assert not any(c['Labels'].get('io.soilfer.release-owned') in owners for c in containers)
normal=next(c for c in containers if c['Id']=='8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b')
assert normal['State']['Running'] and normal['State']['Health']['Status']=='healthy' and normal['RestartCount']==0 and normal['State']['OOMKilled'] is False
st=os.lstat('/proc/self');procself={'kind':'FRESH_READONLY_RETAINER_METADATA_NOT_ORIGINAL_FAILURE_SAMPLE','path':'/proc/self','mode':oct(stat.S_IMODE(st.st_mode)),'isSymlink':stat.S_ISLNK(st.st_mode),'linkTarget':os.readlink('/proc/self')}
print(json.dumps({'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'invocationId':inv,'systemctl':state,'journal':journal,'files':files,'publicFilesBase64':public,'privateWithheld':['private-value-hmac-key.json'],'packageFilesVerified':59,'allCurrentContainersSelectedDerived':containers,'normalSelectedDerived':normal,'exactRootOwnedContainers':[],'procSelfFreshMetadata':procself,'fileAllocatedSumOnly':sum(x['stat']['allocatedBytes'] for x in files.values()),'privateBytesFetched':0,'sqlConnections':0,'operatorReplays':0,'newDuCalls':0,'noWholeStoreAccountingClaim':True}))
'''
compile(probe, 'closed-step2-050000-readonly.py', 'exec')
save('readonly-retainer-source.py', probe.encode())
args = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-']
save('command-original.json', (json.dumps({'argv': args, 'readonly': True, 'operatorReplays': 0, 'privateBytesFetched': 0}) + '\n').encode())
r = subprocess.run(args, cwd=W, input=probe.encode(), capture_output=True, timeout=120)
save('stdout-original.json', r.stdout); save('stderr-original.log', r.stderr)
save('exit-original.json', (json.dumps({'closedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exitCode': r.returncode, 'operatorReplays': 0}) + '\n').encode())
assert r.returncode == 0, 'Retainer refused; original evidence retained, never replay'
v = json.loads(r.stdout)
out = D / 'public-originals'; out.mkdir()
for n, encoded in v['publicFilesBase64'].items():
    assert pathlib.PurePosixPath(n).name == n
    raw = base64.b64decode(encoded, validate=True)
    assert len(raw) == v['files'][n]['stat']['bytes'] and hashlib.sha256(raw).hexdigest() == v['files'][n]['sha256']
    with (out / n).open('xb') as f: f.write(raw)
save('full-systemctl-original.txt', v['systemctl']['stdout'].encode())
save('full-journal-original.jsonl', v['journal']['stdout'].encode())
manifest = {k: x for k, x in v.items() if k != 'publicFilesBase64'}
save('closed-retention-record.json', (json.dumps(manifest, indent=2) + '\n').encode())
print(json.dumps({'observedAt': v['observedAt'], 'closedFailure': True, 'rootFiles': len(v['files']), 'publicOriginalsRetained': len(v['publicFilesBase64']), 'privateBytesFetched': 0, 'packageFilesVerified': v['packageFilesVerified'], 'exactRootOwnedContainers': [], 'normalHealthy': True, 'procSelfFreshMetadata': v['procSelfFreshMetadata'], 'fileAllocatedSumOnly': v['fileAllocatedSumOnly'], 'operatorReplays': 0}))
