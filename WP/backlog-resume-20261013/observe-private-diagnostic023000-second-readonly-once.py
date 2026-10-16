"""Read the SAME consumed diagnostic root/unit; withhold every private file's bytes."""
import base64,datetime,hashlib,json,pathlib,subprocess,sys
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/jobs-row-diagnostic-private-be837974-20261016';D=B/'second-diagnostic023000-readonly-originals-once'
assert not D.exists();D.mkdir()
REMOTE=r'''
import base64,datetime,hashlib,json,os,pathlib,re,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-row-diagnostic-be837974-20261016T023000Z')
unit='lims-workflow-batch-row-diagnostic-be837974-20261016t023000z'
assert root.is_dir() and str(root)==str(root.resolve()) and all(not p.is_symlink() for p in [root,*root.parents])
def cmd(argv,cap=8388608):
 p=subprocess.run(argv,capture_output=True,timeout=45)
 assert len(p.stdout)<=cap and len(p.stderr)<=65536
 return {'argv':argv,'exitCode':p.returncode,'stdoutBase64':base64.b64encode(p.stdout).decode(),'stderrBase64':base64.b64encode(p.stderr).decode()}
props=['Id','LoadState','ActiveState','SubState','Result','MainPID','ExecMainCode','ExecMainStatus','InvocationID','ActiveEnterTimestamp','InactiveEnterTimestamp','ExecMainStartTimestamp','ExecMainExitTimestamp','MemoryMax','MemorySwapMax','MemoryCurrent','MemoryPeak','RuntimeMaxUSec','Restart','PrivateNetwork','RestrictAddressFamilies','IPAddressDeny','ProtectSystem','ProtectHome','PrivateDevices','NoNewPrivileges','RestrictSUIDSGID','ReadWritePaths','ReadOnlyPaths','InaccessiblePaths','WorkingDirectory','Environment','ExecStart']
status=cmd(['systemctl','show',unit,*['--property='+p for p in props]])
journal=cmd(['journalctl','--all','--no-pager','-o','json','-u',unit])
package=json.loads((root/'source-index.json').read_bytes())
packageNames=set(package['files'])|set(package['data'])|{'source-index.json','source-review.json','current-evidence.json','diagnostic-spec.json'}
public={'diagnostic-intent.json','controller-memory-before.json','controller-memory-after.json','input-before.json','input-after.json','main-0-extent.json','main-1-extent.json','main-0-quick-check.json','main-1-quick-check.json','main-0-header.json','main-1-header.json','main-integrity-before-tables.json','public-diagnostic-result.json','public-terminal.json','unit-launch-intent.json','unit.stdout','unit.stderr'}
records=[];contents={};total=0;allocated=0
for p in sorted(root.iterdir()):
 n=p.name;a=p.lstat();assert stat.S_ISREG(a.st_mode) and not p.is_symlink() and a.st_nlink==1
 private=n=='private-value-hmac-key.json' or re.fullmatch(r'private-row-[0-9]{6}\.json',n) is not None
 assert private or n in packageNames or n in public,n
 h=hashlib.sha256()
 with p.open('rb') as f:
  while True:
   chunk=f.read(1048576)
   if not chunk:break
   h.update(chunk)
 z=p.lstat();stable=(a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns,a.st_nlink)==(z.st_dev,z.st_ino,z.st_size,z.st_mtime_ns,z.st_ctime_ns,z.st_nlink)
 r={'file':n,'bytes':a.st_size,'allocatedBytes':a.st_blocks*512,'sha256':h.hexdigest(),'mode':stat.S_IMODE(a.st_mode),'device':a.st_dev,'inode':a.st_ino,'mtimeNs':a.st_mtime_ns,'ctimeNs':a.st_ctime_ns,'nlink':a.st_nlink,'stableDuringHash':stable,'privateBytesWithheld':bool(private)}
 records.append(r);allocated+=r['allocatedBytes']
 if not private and n in public and stable:
  total+=a.st_size;assert total<=268435456
  b=p.read_bytes();zz=p.lstat()
  assert len(b)==a.st_size and hashlib.sha256(b).hexdigest()==r['sha256'] and (zz.st_ino,zz.st_size,zz.st_mtime_ns,zz.st_ctime_ns)==(a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns)
  contents[n]=base64.b64encode(b).decode()
v=os.statvfs(root)
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctl':status,'journal':journal,'inventory':records,'publicFileBytesBase64':contents,'privateFileContentsFetched':0,'productionSqlConnections':0,'rootAllocatedFileSumBytes':allocated,'freeBytes':v.f_bavail*v.f_frsize,'neverRedispatch':True},separators=(',',':')))
'''
compile(REMOTE,'actual-readonly-diagnostic-observer','exec')
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
save('actual-remote-observer.py',REMOTE.encode())
args=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-']
save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'readonly':True,'sameConsumedRootUnit':True,'privateBytesNeverFetched':True})+'\n').encode())
p=subprocess.run(args,cwd=W,input=REMOTE.encode(),capture_output=True,timeout=180)
save('stdout-original.json',p.stdout);save('stderr-original.log',p.stderr);save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode})+'\n').encode())
assert p.returncode==0,'Read-only observer refused; preserve originals, never replay'
o=json.loads(p.stdout);assert o['privateFileContentsFetched']==0
R=D/'public-originals';R.mkdir()
for n,encoded in o['publicFileBytesBase64'].items():
 assert not n.startswith('private-') and pathlib.Path(n).name==n
 b=base64.b64decode(encoded,validate=True);r=next(x for x in o['inventory'] if x['file']==n)
 assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
 with (R/n).open('xb') as f:f.write(b)
for label in ['systemctl','journal']:
 for stream in ['stdout','stderr']:save(label+'-'+stream+'-original',base64.b64decode(o[label][stream+'Base64'],validate=True))
print(json.dumps({'observedUtc':o['observedUtc'],'fileCount':len(o['inventory']),'publicFilesRetained':len(o['publicFileBytesBase64']),'privateBytesFetched':0,'systemctl':base64.b64decode(o['systemctl']['stdoutBase64']).decode(),'terminalObserved':'public-terminal.json' in o['publicFileBytesBase64']}))
