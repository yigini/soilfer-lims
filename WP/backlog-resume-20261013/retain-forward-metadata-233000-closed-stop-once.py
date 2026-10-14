"""Retain actual closed first metadata STOP and all raw files; never replay or adopt image."""
import base64,datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
PACKAGE=SOURCE/'metadata-package-workflow-batch-forward-metadata-cde8c889-20261014T233000Z'
DEST=SOURCE/'first-metadata-233000-closed-stop'
UNIT='lims-workflow-batch-forward-metadata-cde8c889-20261014t233000z'
INVOCATION='89f0de314b2242d7a9036ffa8061bcb5'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='fd130787b8e197939781cbf14b6c0fd2bd98aabb'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists();sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
expected={n:sha((PACKAGE/n).read_bytes()) for n in REQUIRED}
launch=exact_json((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes())
require(launch['packageHashes']==expected and launch['sourceReviewId']==6180876636 and launch['imageEligibility'] is False,'Actual uploaded input binding differs')
probe='''import base64,datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE;expected=EXPECTED_VALUE
raw=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryMax,MemorySwapMax,RuntimeMaxUSec']).decode()
props=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
assert props['InvocationID']==INVOCATION_VALUE and props['MainPID']=='0' and props['ActiveState'] in ['failed','inactive'],'Actual same-unit closure required'
assert root.is_dir() and not root.is_symlink()
files={};directories=[]
for p in sorted(root.iterdir()):
 assert not p.is_symlink()
 if p.is_dir():
  directories.append({'name':p.name,'children':sorted(q.name for q in p.iterdir())});continue
 assert p.is_file() and p.stat().st_size<=2097152,p.name
 data=p.read_bytes();files[p.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':oct(stat.S_IMODE(p.stat().st_mode)),'base64':base64.b64encode(data).decode()}
for n,h in expected.items():assert files[n]['sha256']==h and files[n]['mode']=='0o400','Original metadata input changed'
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise']);assert len(journal)<=2097152
files['journal-original.log']={'bytes':len(journal),'sha256':hashlib.sha256(journal).hexdigest(),'mode':None,'base64':base64.b64encode(journal).decode()}
print(json.dumps({'status':'ACTUAL_CLOSED_METADATA_STOP_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'properties':props,'files':files,'directories':directories,'imageEligibility':False,'newImageInspects':0,'metadataOperatorsDispatched':0,'databaseConnections':0,'imageAdoptions':0}))
'''.replace('ROOT_VALUE',repr(str(safe_root(ROOT_NAME)))).replace('UNIT_VALUE',repr(UNIT)).replace('INVOCATION_VALUE',repr(INVOCATION)).replace('EXPECTED_VALUE',repr(expected))
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('readonly-closed-retainer-source.py',probe.encode())
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=60)
save('closed-read-stderr-original.txt',result.stderr);require(result.returncode==0,'Closed original collection refused; inspect same unit, never replay helper')
data=exact_json(result.stdout)
for n,row in data['files'].items():
    raw=base64.b64decode(row.pop('base64'),validate=True);require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Actual original bytes/hash differ');save(n,raw)
save('remote-closed-original-index.json',(json.dumps(data,indent=2)+'\n').encode())
terminal=exact_json((DEST/'metadata-evidence-terminal.json').read_bytes());evidence_only(terminal)
require(terminal['status']=='STOP_METADATA_INCOMPLETE_IMAGE_EXCLUDED' and terminal['sourceReviewId']==6180876636 and terminal['toolingCommit']=='0b01804f9d409d74a19472c22469824e2df95005' and terminal['fullGrowthAttributionCompleted'] is False,'Actual metadata STOP binding differs')
require(len(terminal['commands'])==8 and all(v['exitCode']==0 and not v['timeoutOrOutputRefused'] for v in terminal['commands']),'Original eight reads differ')
require(terminal['problems']==[{'stage':'metadata-capture','error':'RuntimeError: Snapshot inventory duplicate or exceeds bound; no truncation','required':True}],'Original STOP cause differs')
require(sha((DEST/'000-candidate-image-inspect.stdout').read_bytes())==REFS['candidate-image-fresh-inspect-original.json']['sha256'],'Fresh inspect/reference byte equality differs')
for row in terminal['commands']:
    for stream in ['stdout','stderr']:
        v=row[stream];require(sha((DEST/v['file']).read_bytes())==v['sha256'] and (DEST/v['file']).stat().st_size==v['bytes'],'Closed command original differs')
lines=(DEST/'007-moby-snapshots.stdout').read_text().splitlines();keys=[line.split()[0] for line in lines[1:] if line.split()]
validation={'status':'ACTUAL_METADATA_STOP_RETAINED_IMAGE_EXCLUDED','sourceReviewId':6180876636,'toolingCommit':terminal['toolingCommit'],'originalClosedUtc':terminal['closedUtc'],'unit':UNIT,'invocationId':INVOCATION,'readCalls':8,'allReadCliExitCodes':0,'snapshotRows':len(keys),'uniqueSnapshotKeys':len(set(keys)),'reviewedSnapshotBound':80,'exceedsReviewedBound':len(keys)>80,'freshInspectMatchesFirstForensicBytes':True,'referenceInspectSha256':REFS['candidate-image-fresh-inspect-original.json']['sha256'],'floorPassAllFilesystems':min(v['freeBytes'] for v in terminal['filesystemsAfter'].values())>=FLOOR,'imageEligibility':False,'imageAdoptionReceipts':0,'newValidatorOrSourceAuthority':None,'noTruncation':True,'originalFailedBuildUnchanged':True,'neverReplay':True}
save('independent-stop-validation.json',(json.dumps(validation,indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())
for folder in [PACKAGE,SOURCE/(PACKAGE.name+'-launch'),SOURCE/'reviewed-package-preparation-once',SOURCE/'reviewed-launch-execution-once']:paths.extend(sorted(p for p in folder.iterdir() if p.is_file()))
paths.extend([REPO/'WP/backlog-resume-20261013/execute-reviewed-forward-metadata-package-once.py',REPO/'WP/backlog-resume-20261013/execute-reviewed-forward-metadata-launch-once.py',pathlib.Path(__file__)])
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-14 first metadata233000 CLOSED STOP — image excluded\n\nActual0bSourcePASS6180876636/23:37:37UTC retainedfd130; onepackage23:42:23/oneunitlaunch23:43:20.487UTC. Sameunit/invocation89f0de314b2242d7a9036ffa8061bcb5 CLOSED FAILED23:43:21.814UTC/exit1 after1.62s, exactSTOP_METADATA_INCOMPLETE_IMAGE_EXCLUDED. EightreadonlyCLIcallsALLexit0; freshimageinspectbyte-identicalc4firstforensic; everyFSfloorPASS. Actualmoby snapshotcatalog '+str(len(keys))+'rows/'+str(len(set(keys)))+'unique exceedsreviewed80; NOtruncation/no furtherusage/cache/OCI run. Alloriginal47rootfiles/input0400/readoutputs/callrecords/terminal/stdlogs/journal/prep/launch retained at first-metadata-233000-closed-stop/index.json. Metadata root/helpers consumed, NEVERreplay/restart/recollect/cleanup. Originalfirstbuild221500failure unchanged/imageFORENSICONLY/noadoptionreceipt/proof/kit/gate/deploy/DB/volume. Next analyse RETAINEDcatalog locally and prepare genuinelyNEWtargeted source selection/review before a newmetadata root; no boundraise/sourcechange duringfailedrun.\n\n').encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':validation['status'],'validation':validation,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
for p,rel in zip(paths,rels):require(cmd('git','show',':'+rel)==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain original bounded metadata STOP and complete snapshot catalogue')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(cmd('git','show',head+':'+rel)==p.read_bytes(),'Original Git bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':validation['status'],'head':head,'verifiedBlobs':len(paths),'validation':validation}))
