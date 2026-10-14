"""Prepared read-only retainer for the actual CLOSED same-unit build; never dispatch or replay."""
import base64,datetime,hashlib,json,pathlib,re,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261014T221500Z'
DEST=SOURCE/'first-build-221500-closed-terminal'
UNIT='lims-workflow-batch-build-cde8c889-20261014t221500z'
INVOCATION='2da8e4edfe95494c8c60263ae1b1578b'
def cmd(*args):return subprocess.check_output(args,cwd=REPO)
assert not DEST.exists(), 'Consumed terminal retainer; never replay or overwrite'
assert cmd('git','branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert not cmd('git','diff','--cached','--name-only').strip(), 'Preserve existing staging'
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
spec=json_exact((PACKAGE/'build-input.json').read_bytes());graph_index=json_exact((PACKAGE/'tooling-source-index.json').read_bytes());review=json_exact((PACKAGE/'source-review-original.json').read_bytes())
validate_spec(spec,graph_index,review)
require(graph_index['head']=='2afd192872ce38bfabbaf5c69404d0aa7e679123' and review['id']==6179940139,'Corrected build authority differs')
expected={n:sha((PACKAGE/n).read_bytes()) for n in REQUIRED_ARTIFACTS}
require(expected==json_exact((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes())['packageFileHashes'],'Original uploaded package bytes changed')
probe='''import base64,datetime,hashlib,json,os,pathlib,re,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-build-cde8c889-20261014T221500Z')
unit=UNIT_VALUE
expected=EXPECTED_VALUE
state=subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,ExecMainStartTimestamp,ExecMainExitTimestamp,MainPID,InvocationID,RuntimeMaxUSec']).decode()
properties=dict(line.split('=',1) for line in state.splitlines() if '=' in line)
assert properties['InvocationID']==INVOCATION_VALUE and properties['ActiveState'] in ['inactive','failed'] and properties['MainPID']=='0','Actual same-unit closure required; no active logs captured'
assert root.is_dir() and not root.is_symlink()
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while True:
   chunk=f.read(1048576)
   if not chunk:break
   h.update(chunk)
 return h.hexdigest()
input_facts={}
for n,d in expected.items():
 p=root/n
 assert p.is_file() and not p.is_symlink(),n
 input_facts[n]={'bytes':p.stat().st_size,'sha256':digest(p),'mode':oct(stat.S_IMODE(p.stat().st_mode)),'expectedSha256':d,'matchesOriginal':digest(p)==d}
originals={}
def original(n,raw,mode=None):
 assert len(raw)<=67108864,'Closed artifact exceeds retention bound; preserve remotely and use a new measured retainer'
 originals[n]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':mode,'base64':base64.b64encode(raw).decode()}
for n in ['build-intent.json','docker-build.log','candidate-image.id','image-inspect-original.json','build-receipt.json','build-terminal-failure.json']:
 p=root/n
 if p.exists():
  assert p.is_file() and not p.is_symlink(),n
  original(n,p.read_bytes(),oct(stat.S_IMODE(p.stat().st_mode)))
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise'])
original('journal-original.log',journal)
source=root/'source';application={'status':'SOURCE_DIRECTORY_ABSENT','files':[],'differences':[]}
if source.is_dir() and not source.is_symlink():
 idx=json.loads((root/'source-index.json').read_bytes())
 rows=[v for v in idx['entries'] if 'node_modules' not in pathlib.PurePosixPath(v['path']).parts]
 inventory=set();difference=[];facts=[]
 for parent,dirs,files in os.walk(source,followlinks=False):
  for n in dirs:
   assert not (pathlib.Path(parent)/n).is_symlink(),'Unreviewed extracted directory alias'
  for n in files:
   p=pathlib.Path(parent)/n;assert p.is_file() and not p.is_symlink(),'Unreviewed extracted source alias'
   inventory.add(p.relative_to(source).as_posix())
 for row in rows:
  p=source/row['path'];actual=None
  if p.is_file() and not p.is_symlink():
   raw=p.read_bytes();actual={'path':row['path'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlob':hashlib.sha1(('blob '+str(len(raw))+'\\0').encode()+raw).hexdigest(),'mode':oct(stat.S_IMODE(p.stat().st_mode))}
  wanted='0o755' if row['mode']=='100755' else '0o644'
  if actual is None or actual['bytes']!=row['bytes'] or actual['sha256']!=row['sha256'] or actual['gitBlob']!=row['blob'] or actual['mode']!=wanted:difference.append(row['path'])
  if actual:facts.append(actual)
 expected_inventory={v['path'] for v in rows}
 application={'status':'EXTRACTED_RAW_SOURCE_VERIFIED' if not difference and inventory==expected_inventory else 'EXTRACTED_SOURCE_DIFFERS','files':facts,'differences':difference,'expectedCount':len(rows),'actualInventoryCount':len(inventory),'extraPaths':sorted(inventory-expected_inventory),'missingPaths':sorted(expected_inventory-inventory)}
if (root/'candidate-image.id').is_file():
 image=(root/'candidate-image.id').read_text().strip()
 if re.fullmatch('sha256:[a-f0-9]{64}',image):
  inspect=subprocess.run(['docker','image','inspect',image],capture_output=True)
  original('candidate-image-fresh-inspect-original.json',inspect.stdout);original('candidate-image-fresh-inspect-stderr-original.txt',inspect.stderr)
  inspect_exit=inspect.returncode
 else:inspect_exit=None
else:inspect_exit=None
print(json.dumps({'status':'ACTUAL_CLOSED_SAME_BUILD_UNIT_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'properties':properties,'ownedInventory':sorted(p.name for p in root.iterdir()),'inputFileFacts':input_facts,'extractedApplication':application,'originals':originals,'candidateImageInspectExitCode':inspect_exit,'activeBuildLogsRead':False,'databasePathsOpened':0,'databaseConnections':0,'newBuildsDispatched':0}))
'''.replace('UNIT_VALUE',repr(UNIT)).replace('INVOCATION_VALUE',repr(INVOCATION)).replace('EXPECTED_VALUE',repr(expected))
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('readonly-closed-retainer-source.py',probe.encode())
try:result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=120)
except subprocess.TimeoutExpired as e:
    save('closed-read-response-partial.txt',e.stdout or b'');save('closed-read-stderr-partial.txt',e.stderr or b'');raise
save('closed-read-stderr-original.txt',result.stderr)
require(result.returncode==0,'Closed-original collection refused; retain the failure and inspect same unit, never replay helper')
data=json_exact(result.stdout)
for n,row in data['originals'].items():
    raw=base64.b64decode(row.pop('base64'),validate=True)
    require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Original remote artifact hash differs')
    save(n,raw)
save('remote-closed-original-index.json',(json.dumps(data,indent=2)+'\n').encode())
review_current=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/6179940139');save('actual-source-review-current-original.json',review_current)
current=json_exact(review_current);validate_source_review(current,graph_index['head'],graph_index)
require(current['body']==review['body'] and current['created_at']==review['created_at'],'Actual source verdict changed')
main_raw=cmd('gh','api','repos/yigini/soilfer-lims/git/ref/heads/main');save('current-main-original.json',main_raw)
receipt=json_exact((DEST/'build-receipt.json').read_bytes()) if (DEST/'build-receipt.json').exists() else None
validation_error=None
try:
    require(data['properties']['Result']=='success' and data['properties']['ExecMainStatus']=='0' and receipt is not None,'No successful terminal receipt; retain failure or uncertain unit honestly')
    require(all(v['matchesOriginal'] and v['mode']=='0o400' for v in data['inputFileFacts'].values()),'Original immutable package changed')
    require(data['extractedApplication']['status']=='EXTRACTED_RAW_SOURCE_VERIFIED' and data['extractedApplication']['expectedCount']==1560,'Extracted committed source differs')
    require(receipt['status']=='BUILT_ONLY_NOT_PROVED_OR_DEPLOYED' and receipt['head']==CANDIDATE and receipt['tree']==TREE and receipt['scope']==SCOPE and receipt['toolingCommit']==graph_index['head'] and receipt['sourceReviewId']==6179940139 and receipt['individualAudits']==AUDITS and receipt['mainCiRun']==MAIN_CI,'Built source/review binding differs')
    require(receipt['newBuildCount']==1 and receipt['exitCode']==0 and receipt['error'] is None and receipt['neverRetry'] is True and receipt['rebuildOrRetagAllowed'] is False,'Build count or terminal outcome differs')
    require(all(type(receipt[k]) is int and receipt[k]==0 for k in ['productionDatabaseMounts','productionDatabaseConnections','proofLaunches','productionDeployments']),'Build expanded its reviewed scope')
    require(receipt['builderSha256']==graph_index['files']['batch_build.py']['sha256'] and receipt['archiveSha256']==spec['archiveSha256'] and receipt['applicationIndexSha256']==spec['applicationIndexSha256'] and receipt['toolingSourceIndexSha256']==spec['toolingSourceIndexSha256'] and receipt['sourceReviewRawSha256']==spec['sourceReviewRawSha256'],'Build graph/archive hashes differ')
    require(0<receipt['elapsedSeconds']<BUILD_TIMEOUT and receipt['reserveFloorBytes']==FLOOR and receipt['buildAllocationReserveBytes']==BUILD_ALLOCATION and min(receipt['freeBytesBefore'].values())>=FLOOR+BUILD_ALLOCATION and min(receipt['freeBytesAfter'].values())>=FLOOR,'Build lifetime or reserve boundary differs')
    require(receipt['diskGrowth']['policy']==GROWTH_POLICY and receipt['diskGrowth']['abortBytes']==UNEXPLAINED_GROWTH_ABORT and all(v['unexplainedGrowthBytes']<UNEXPLAINED_GROWTH_ABORT for v in receipt['diskGrowth']['filesystems'].values()),'Build disk-growth evidence differs')
    require(sha((DEST/'docker-build.log').read_bytes())==receipt['dockerBuildLogSha256'] and sha((DEST/'image-inspect-original.json').read_bytes())==receipt['imageInspectSha256'],'Closed log/image metadata differs')
    require(all(data['originals'][n]['mode']=='0o400' for n in ['build-intent.json','docker-build.log','candidate-image.id','image-inspect-original.json','build-receipt.json']),'Original closed artifacts not sealed')
    require(data['candidateImageInspectExitCode']==0 and re.fullmatch('sha256:[a-f0-9]{64}',receipt['image']) and receipt['image']!=PREDECESSOR_IMAGE,'Candidate image missing or historical')
    fresh=json_exact((DEST/'candidate-image-fresh-inspect-original.json').read_bytes())[0]
    require(fresh['Id']==receipt['image'] and fresh['Size']==receipt['imageBytes'] and fresh['Config']['Labels']['org.opencontainers.image.revision']==CANDIDATE and receipt['image'] in (DEST/'candidate-image.id').read_text(),'Actual built candidate identity differs')
except (RuntimeError,KeyError,TypeError,ValueError) as error:validation_error=str(error)
validation={'status':'PASS_BUILD_ONLY_ORIGINAL_CLOSED_UNIT_VERIFIED' if validation_error is None else 'FAILED_OR_UNCERTAIN_BUILD_ONLY_RETAIN_ALL','validationError':validation_error,'closedUtc':data['observedUtc'],'sourceReviewId':6179940139,'toolingCommit':graph_index['head'],'root':data['root'],'unit':UNIT,'invocationId':INVOCATION,'image':receipt.get('image') if receipt else None,'receiptSha256':sha((DEST/'build-receipt.json').read_bytes()) if receipt else None,'currentMain':json_exact(main_raw)['object']['sha'],'candidateStillCurrentMain':json_exact(main_raw)['object']['sha']==CANDIDATE,'originalUploadedInputsUnchanged':all(v['matchesOriginal'] for v in data['inputFileFacts'].values()),'extractedApplicationStatus':data['extractedApplication']['status'],'verifiedApplicationBlobCount':len(data['extractedApplication']['files']),'productionConnections':0,'proofLaunches':0,'productionDeployments':0,'forwardOnlyNeverReplay':True}
save('independent-terminal-validation.json',(json.dumps(validation,indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
lead='## 2026-10-14 first batch build221500 actual CLOSED terminal '+validation['status']+'\n\nSame invocation'+INVOCATION+'; originalunit/closedjournal/buildlog/intent/inputhashes/raw1560source/imageinspect/receipt-or-failure retained at first-build-221500-closed-terminal/index.json. Independent validation '+str(validation_error)+'. No DBconnection/volume/proof/deploy. NEVERrelaunch/rebuild/retag/retry/cleanup originalfirstroot/unit/helpers; failure/uncertain outcomes retain all and require separatelyreviewed forward source. Build-only image is not proof/deploy authority. Next separatelyNEWreviewed stoppedproduction-copy proof/actual214209lists/policyNOOP/disk/YYnonzero/approvedSTOP/finalkit/freshgate.\n\n'
readme.write_bytes(lead.encode()+readme.read_bytes());paths.append(readme)
index_path=DEST/'index.json'
with index_path.open('x',encoding='utf-8') as f:json.dump({'status':validation['status'],'validation':validation,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(index_path);rels=[p.relative_to(REPO).as_posix() for p in paths]
cmd('git','-c','core.autocrlf=false','add','-f','--',*rels)
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
for p,rel in zip(paths,rels):require(cmd('git','show',':'+rel)==p.read_bytes(),'Original staged bytes differ')
cmd('git','commit','-m','Retain actual first batch build terminal originals and independent verdict')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(cmd('git','show',head+':'+rel)==p.read_bytes(),'Original Git bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':validation['status'],'head':head,'verifiedBlobs':len(paths),'validation':validation}))
