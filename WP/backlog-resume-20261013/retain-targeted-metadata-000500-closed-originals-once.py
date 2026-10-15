"""Retain one actual closed targeted capture and honest transient-unit GC, never recapture/adopt."""
import base64,datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-forward-metadata-cde8-20261014'
PACKAGE=SOURCE/'metadata-package-workflow-batch-forward-metadata-cde8c889-20261015T000500Z'
DEST=SOURCE/'targeted-metadata-000500-closed-originals'
UNIT='lims-workflow-batch-forward-metadata-cde8c889-20261015t000500z'
INVOCATION='1fdffe01c57e4b9f8a26cdc9a1b579fc'
TOOLING='8df9e1261647dcc8ba018c739bd606fe5291f1ca'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='264b032d262e75c79315b5b4002cd3ac489a13ae'
assert not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists();sys.path.insert(0,str(SOURCE))
from forward_metadata_contract import *
expected={n:sha((PACKAGE/n).read_bytes()) for n in REQUIRED}
launch=exact_json((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes())
require(launch['packageHashes']==expected and launch['sourceReviewId']==6181164638 and launch['toolingCommit']==TOOLING and launch['imageEligibility'] is False,'Actual launch binding differs')
probe='''import base64,datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE;expected=EXPECTED_VALUE;invocation=INVOCATION_VALUE
raw=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryMax,MemorySwapMax,RuntimeMaxUSec']).decode()
props=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
assert props['MainPID']=='0' and props['ActiveState'] in ['failed','inactive'],'No active unit may be retained as closed'
journal_json=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json']);assert len(journal_json)<=2097152
rows=[json.loads(v) for v in journal_json.splitlines() if v]
assert rows and all(v.get('UNIT')==unit+'.service' and v.get('INVOCATION_ID')==invocation for v in rows),'Actual one unit/invocation journal required'
assert any(v.get('JOB_RESULT')=='done' and v.get('MESSAGE','').startswith('Started /usr/bin/python3 -B '+str(root)) for v in rows),'Actual launch journal required'
assert any(v.get('MESSAGE')==unit+'.service: Deactivated successfully.' for v in rows),'Actual successful closure required'
if props['LoadState']=='not-found':
 assert props['InvocationID']=='','Unloaded transient unit cannot supply actual executed properties'
elif props['LoadState']=='loaded':
 assert props['InvocationID']==invocation and props['ExecMainStatus']=='0' and props['Result']=='success','Actual closed properties differ'
else:raise RuntimeError('Unknown unit state')
assert root.is_dir() and not root.is_symlink()
files={};directories=[]
for p in sorted(root.iterdir()):
 assert not p.is_symlink()
 if p.is_dir():
  directories.append({'name':p.name,'children':sorted(q.name for q in p.iterdir())});continue
 assert p.is_file() and p.stat().st_size<=2097152,p.name
 data=p.read_bytes();files[p.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':oct(stat.S_IMODE(p.stat().st_mode)),'base64':base64.b64encode(data).decode()}
for n,h in expected.items():assert files[n]['sha256']==h and files[n]['mode']=='0o400','Original package input changed'
for name,data in [('journal-original.jsonl',journal_json),('journal-original.log',subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise']))]:
 assert len(data)<=2097152
 files[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':None,'base64':base64.b64encode(data).decode()}
print(json.dumps({'status':'ACTUAL_CLOSED_TARGETED_METADATA_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationIdFromJournal':invocation,'properties':props,'transientUnitUnloadedAfterSuccess':props['LoadState']=='not-found','unloadedDefaultPropertiesAreNotExecutedLimits':props['LoadState']=='not-found','files':files,'directories':directories,'imageEligibility':False,'newImageInspects':0,'metadataOperatorsDispatched':0,'databaseConnections':0,'imageAdoptions':0}))
'''.replace('ROOT_VALUE',repr(str(safe_root(ROOT_NAME)))).replace('UNIT_VALUE',repr(UNIT)).replace('INVOCATION_VALUE',repr(INVOCATION)).replace('EXPECTED_VALUE',repr(expected))
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('readonly-closed-retainer-source.py',probe.encode())
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=60)
save('closed-read-stderr-original.txt',result.stderr);require(result.returncode==0,'Closed collection refused; inspect same unit, never replay helper')
data=exact_json(result.stdout)
for n,row in data['files'].items():
    raw=base64.b64decode(row.pop('base64'),validate=True);require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Original remote bytes/hash differs');save(n,raw)
save('remote-closed-original-index.json',(json.dumps(data,indent=2)+'\n').encode())
terminal=exact_json((DEST/'metadata-evidence-terminal.json').read_bytes());evidence_only(terminal)
require(terminal['status']=='READONLY_METADATA_EVIDENCE_CAPTURED_NOT_ADOPTED' and terminal['sourceReviewId']==6181164638 and terminal['toolingCommit']==TOOLING and terminal['fullGrowthAttributionCompleted'] is False,'Actual evidence-only closure differs')
require(len(terminal['commands'])==133 and terminal['problems']==[] and all(v['exitCode']==0 and not v['timeoutOrOutputRefused'] for v in terminal['commands']),'All133actual reads required')
for row in terminal['commands']:
    allowed_command(row['argv'])
    for stream in ['stdout','stderr']:
        v=row[stream];require(sha((DEST/v['file']).read_bytes())==v['sha256'] and (DEST/v['file']).stat().st_size==v['bytes'] and data['files'][v['file']]['mode']=='0o400','Closed command original differs')
require(sha((DEST/'000-candidate-image-inspect.stdout').read_bytes())==REFS['candidate-image-fresh-inspect-original.json']['sha256'],'Fresh inspect byte equality differs')
selection=exact_json((DEST/'moby-selected-exact-candidate-chain.json').read_bytes())
require(selection['selectedCount']==59 and len(selection['keys'])==59 and selection['catalogueTruncated'] is False,'Exact59selection missing')
catalogue=(DEST/'007-moby-snapshots.stdout').read_bytes();current=exact_json((DEST/'000-candidate-image-inspect.stdout').read_bytes())[0]
require(selected_snapshot_keys(catalogue.decode(),current['RootFS']['Layers'])==selection['keys'] and sha(catalogue)==selection['completeCatalogueSha256'],'Independent fresh complete-catalogue selection differs')
infos=[v for v in terminal['commands'] if v['label'].startswith('moby-snapshot-info-')];usages=[v for v in terminal['commands'] if v['label'].startswith('moby-snapshot-usage-')]
require(len(infos)==len(usages)==59 and [v['argv'][-1] for v in infos]==[v['argv'][-1] for v in usages]==selection['keys'],'59exact info/usage pairs differ')
require(all(min(v['freeBytes'] for v in terminal[k].values())>=FLOOR for k in ['filesystemsBefore','filesystemsAfter']),'All filesystem floors required')
validation={'status':'ACTUAL_TARGETED_METADATA_EVIDENCE_CLOSED_NOT_ADOPTED','sourceReviewId':6181164638,'toolingCommit':TOOLING,'originalClosedUtc':terminal['closedUtc'],'elapsedSeconds':terminal['elapsedSeconds'],'unit':UNIT,'actualInvocationIdFromJournal':INVOCATION,'successfulClosureFromOriginalJournal':True,'transientUnitUnloadedAfterSuccess':data['transientUnitUnloadedAfterSuccess'],'unloadedDefaultPropertiesAreNotExecutedLimits':data['unloadedDefaultPropertiesAreNotExecutedLimits'],'readCalls':133,'allReadCliExitCodes':0,'selectedCommittedCandidateKeys':59,'exactInfoUsagePairs':59,'completeCatalogueKeys':len([v for v in catalogue.decode().splitlines()[1:] if v.split()]),'catalogueTruncated':False,'freshInspectMatchesFirstForensicBytes':True,'floorPassAllFilesystems':True,'imageEligibility':False,'imageAdoptionReceipts':0,'fullGrowthAttributionCompleted':False,'missingPreBuildContainerdAllocationUnknown':True,'oldMetadata233000StopUnchanged':True,'originalBuild221500FailureUnchanged':True,'newValidatorOrAdoptionAuthority':None,'neverReplay':True}
save('independent-closed-evidence-validation.json',(json.dumps(validation,indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())
for folder in [PACKAGE,SOURCE/(PACKAGE.name+'-launch'),SOURCE/'reviewed-targeted-package-preparation-once',SOURCE/'reviewed-targeted-launch-execution-once',SOURCE/'targeted-metadata-000500-first-observation']:paths.extend(sorted(p for p in folder.iterdir() if p.is_file()))
paths.extend([REPO/'WP/backlog-resume-20261013/execute-reviewed-targeted-metadata-package-once.py',REPO/'WP/backlog-resume-20261013/execute-reviewed-targeted-metadata-launch-once.py',pathlib.Path(__file__)])
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-15 targeted metadata000500 CLOSED evidence success — IMAGE NOT ADOPTED\n\nActual8dfSourcePASS6181164638/00:00UTC retained264b. One19filepackage00:01:56/oneunitlaunch00:02:19UTC. Actualoneinvocation'+INVOCATION+' journal confirms successfuldeactivation00:02:26.328UTC; transientunitGC/not-found afterward, retaineddefaultsystemctl infinity/emptyprops NOTclaimedasexecutedlimits. Actualterminal00:02:26.298UTC/7.431630s READONLY_METADATA_EVIDENCE_CAPTURED_NOT_ADOPTED/133readcallsALLexit0/0problems/freshinspectbyteexactc4/all3FSfloorPASS. Fullcatalogue/no truncation/exact59Committedchain+parents/59info+59usagepairs/BuildKitcache+smallOCI metadata retained at targeted-metadata-000500-closed-originals/index.json. Source/package0400/limits/pins/original221500failure/old233000STOP preserved; neverreplaycapture/helper/root. EVIDENCEONLY/imageexcluded/fullGrowthAttributionfalse/noadoptionreceipt/proof/kit/gate/deploy/DB103. Next LOCALretained-metadata timestamp/size analysis; olderbase layers cannotcountasgrowth onsizealone/missingbeforestateunknown/residual>=500MBSTOP. Later actualfull validator/adoption source review stillrequired. Humanfilesdraftscards/history untouched.\n\n').encode()+readme.read_bytes());paths.append(readme)
indexpath=DEST/'index.json'
with indexpath.open('x',encoding='utf-8') as f:json.dump({'status':validation['status'],'validation':validation,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(indexpath);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner path')
for i in range(0,len(rels),20):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[i:i+20])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
def verify_tree(tree):
    listing=cmd('git','ls-tree','-r','-z',tree,'--','WP/batch-forward-metadata-cde8-20261014','WP/backlog-resume-20261013/execute-reviewed-targeted-metadata-package-once.py','WP/backlog-resume-20261013/execute-reviewed-targeted-metadata-launch-once.py',pathlib.Path(__file__).relative_to(REPO).as_posix(),'WP/audit-release-eb6de2e8/README.md')
    oids={}
    for entry in listing.split(b'\0'):
        if not entry:continue
        meta,path=entry.split(b'\t',1);mode,kind,oid=meta.decode().split()
        if path.decode() in rels:require(kind=='blob','Owned object is not a blob');oids[path.decode()]=oid
    require(set(oids)==set(rels),'Owned tree inventory differs')
    result=subprocess.run(['git','cat-file','--batch'],cwd=REPO,input=('\n'.join(oids[rel] for rel in rels)+'\n').encode(),capture_output=True,check=True).stdout;offset=0
    for p,rel in zip(paths,rels):
        end=result.index(b'\n',offset);oid,kind,size=result[offset:end].decode().split();length=int(size);raw=result[end+1:end+1+length];offset=end+2+length
        require(oid==oids[rel] and kind=='blob' and raw==p.read_bytes() and hashlib.sha1(('blob '+str(length)+'\0').encode()+raw).hexdigest()==oid,'Raw OID bytes differ')
verify_tree(cmd('git','write-tree').decode().strip())
cmd('git','commit','-m','Retain closed targeted metadata originals and honest successful transient-unit closure')
head=cmd('git','rev-parse','HEAD').decode().strip();verify_tree(head)
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':validation['status'],'head':head,'verifiedBlobs':len(paths),'validation':validation}))
