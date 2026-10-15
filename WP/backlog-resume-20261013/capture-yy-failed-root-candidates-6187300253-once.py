"""YY list-only task: closed failed release roots metadata, du and owned-root hashes."""
import datetime,json,pathlib,subprocess
REPO=pathlib.Path(__file__).resolve().parents[2];D=REPO/'WP/yy-failed-root-candidates-20261015';assert not D.exists();D.mkdir()
old=REPO/'WP/batch-proof-forward-resume-cde8-20261015/yy-disk-breakdown-6186928334-once/release-roots-derived-corrected.json';rows=json.loads(old.read_bytes())
excluded={'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T070000Z':'REQUIRED070000_RAW_ASSET_INPUT', '/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z':'REQUIRED_INSTALLED209_RAW_READER_BACKUP_LOGICAL_INPUT','/opt/lims/releases/workflow-batch-build-cde8c889-20261015T010000Z':'QUALIFIED_B5_BUILD_INPUT'}
eligible=[r for r in rows if r['outcomeCategory']=='FAILED_OR_STOP' and r['root'] not in excluded]
full=[r['root'] for r in eligible if any(x['publicationRole']=='FULL_CLOSED_RETENTION_RECORD' for x in r['publishedClosedRawEvidence'])]
payload={'candidates':eligible,'excludedOperationalInputs':excluded,'fullClosedRecordRootHashes':full}
(D/'candidate-input-selection.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
script='''import datetime,hashlib,json,os,pathlib,stat,subprocess,sys
selection=SELECTION_VALUE
roots=[pathlib.Path(r['root']) for r in selection['candidates']]
assert roots and len(roots)<=100 and all(p.parent==pathlib.Path('/opt/lims/releases') and p.is_dir() and not p.is_symlink() for p in roots)
sys.path.insert(0,'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z')
from proof_docker import all_containers
from proof_files import file_state
containers=all_containers();records=[];total=0
for original,p in zip(selection['candidates'],roots):
 receipt=p/original['ownOutcomeRecord']['file'];value=json.loads(receipt.read_bytes());assert value['status']==original['ownOutcomeStatus']
 inventory=[]
 for q in sorted(p.rglob('*')):
  assert not q.is_symlink()
  if not q.is_file():continue
  s=q.stat();rel=q.relative_to(p).as_posix();r={'path':rel,'bytes':s.st_size,'allocatedBytes':s.st_blocks*512,'device':s.st_dev,'inode':s.st_ino,'hardLinks':s.st_nlink,'mtimeNs':s.st_mtime_ns,'mode':stat.S_IMODE(s.st_mode)}
  if str(p) in selection['fullClosedRecordRootHashes']:r['stableByteIdentity']=file_state(q)
  inventory.append(r);total+=1;assert total<=200000
 mounts=[]
 for id,v in containers.items():
  for m in v['mounts']:
   src=pathlib.Path(m['Source'])
   if src==p or p in src.parents:mounts.append({'id':id,'name':v['name'],'running':v['running'],'source':m['Source'],'destination':m['Destination']})
 records.append({'root':str(p),'freshOwnOutcome':{'file':str(receipt),'status':value['status'],'closedUtc':value.get('closedUtc')},'fileInventory':inventory,'fileCount':len(inventory),'containerMountConsumers':mounts,'activeContainerMountConsumers':[m for m in mounts if m['running']]})
du=subprocess.run(['du','-x','-B1','-s','--',*[str(p) for p in roots]],capture_output=True,timeout=180);assert len(du.stdout)<=2*1024**2 and len(du.stderr)<=2*1024**2
processes=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdecimal():continue
 try:cmd=(p/'cmdline').read_bytes();matched=[str(r) for r in roots if str(r).encode() in cmd]
 except (PermissionError,FileNotFoundError,ProcessLookupError):continue
 if matched:processes.append({'pid':int(p.name),'matchedCandidateRoots':matched,'fullCommandLineNotStored':True})
print(json.dumps({'status':'READONLY_YY_CANDIDATE_LIST_METADATA_NOT_REMOVAL_AUTHORITY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'requestComment':6187300253,'candidates':records,'excludedOperationalInputs':selection['excludedOperationalInputs'],'safeSelectedContainerMetadata':containers,'candidateRootProcessReferences':processes,'duOriginal':{'argv':['du','-x','-B1','-s','--',*[str(p) for p in roots]],'exitCode':du.returncode,'stdout':du.stdout.decode(),'stderr':du.stderr.decode()},'productionContentOpens':0,'liveSqlConnections':0,'databaseBytesFetched':0,'mutations':0,'filesDeleted':0,'containersChanged':0,'hashesOnlyOfFourOwnedClosedFailedRoots':True}))
'''.replace('SELECTION_VALUE',repr(payload))
(D/'metadata-collector-source.py').write_text(script,encoding='utf-8')
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.encode(),capture_output=True,timeout=300)
for n,b in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr)]:
 with (D/n).open('xb') as f:f.write(b)
(D/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'neverReplay':True,'listOnly':True}),encoding='utf-8')
assert r.returncode==0,'Retain failure, never replay'
v=json.loads(r.stdout);print(json.dumps({'status':v['status'],'observedUtc':v['observedUtc'],'rootCount':len(v['candidates']),'duExit':v['duOriginal']['exitCode'],'processReferences':v['candidateRootProcessReferences'],'activeCandidateMountConsumers':[m for r in v['candidates'] for m in r['activeContainerMountConsumers']],'deletions':0}))
