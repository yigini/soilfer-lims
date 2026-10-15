"""Retain actual closed qualification originals, verify archive/source/image/accounting; never rebuild or prove."""
import base64,datetime,hashlib,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-build-containerd-cde8-20261015'
PACKAGE=SOURCE/'build-package-workflow-batch-build-cde8c889-20261015T010000Z'
DEST=SOURCE/'first-build-010000-closed-success'
UNIT='lims-workflow-batch-build-cde8c889-20261015t010000z'
INVOCATION='a856dfdc5dcf401698724f7ef9459933'
IMAGE='sha256:b5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb'
TOOLING='6608548a58dd4bf581da4330f1cd7b0f68a86973'
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
assert cmd('git','rev-parse','HEAD').decode().strip()=='8955ccc367c13cb96cb4a1465973a3a228b4062f' and not cmd('git','diff','--cached','--name-only').strip() and not DEST.exists()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import *
expected={n:{'bytes':(PACKAGE/n).stat().st_size,'sha256':sha((PACKAGE/n).read_bytes())} for n in REQUIRED_ARTIFACTS}
launch=json_exact((SOURCE/(PACKAGE.name+'-launch')/'launch-record.json').read_bytes());require(launch['packageFileHashes']=={n:v['sha256'] for n,v in expected.items()} and launch['sourceReviewId']==6181452519,'Actual uploaded package binding differs')
probe='''import base64,datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE;invocation=INVOCATION_VALUE;expected=EXPECTED_VALUE;image=IMAGE_VALUE
props=dict(v.split('=',1) for v in subprocess.check_output(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryMax,MemorySwapMax,RuntimeMaxUSec']).decode().splitlines() if '=' in v)
assert props['MainPID']=='0' and props['ActiveState'] in ['inactive','failed'],'Actual closure required'
journal_json=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json']);assert len(journal_json)<=2097152
rows=[json.loads(v) for v in journal_json.splitlines() if v]
identities={v.get('INVOCATION_ID',v.get('_SYSTEMD_INVOCATION_ID')) for v in rows};assert identities=={invocation},identities
assert any(v.get('JOB_RESULT')=='done' and v.get('UNIT')==unit+'.service' for v in rows)
assert any(v.get('MESSAGE')==unit+'.service: Deactivated successfully.' and v.get('UNIT')==unit+'.service' for v in rows)
if props['LoadState']=='not-found':assert props['InvocationID']=='','Unloaded defaults are not executed unit properties'
else:assert props['LoadState']=='loaded' and props['InvocationID']==invocation and props['Result']=='success' and props['ExecMainStatus']=='0'
assert root.is_dir() and not root.is_symlink() and (root/'build-receipt.json').is_file() and not (root/'build-preflight-refusal.json').exists() and not (root/'build-terminal-failure.json').exists()
files={}
for p in sorted(root.iterdir()):
 assert not p.is_symlink()
 if p.name=='source':assert p.is_dir();continue
 assert p.is_file()
 limit=expected[p.name]['bytes'] if p.name in expected else 2097152
 assert p.stat().st_size<=limit,p.name
 data=p.read_bytes();files[p.name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':oct(stat.S_IMODE(p.stat().st_mode)),'base64':base64.b64encode(data).decode()}
for n,v in expected.items():assert files[n]['bytes']==v['bytes'] and files[n]['sha256']==v['sha256'] and files[n]['mode']=='0o400',n
application=json.loads((root/'source-index.json').read_bytes());wanted={v['path']:v for v in application['entries'] if 'node_modules' not in pathlib.PurePosixPath(v['path']).parts}
actual={p.relative_to(root/'source').as_posix():p for p in (root/'source').rglob('*') if p.is_file() or p.is_symlink()};assert set(actual)==set(wanted)
for n,p in actual.items():
 assert not p.is_symlink() and stat.S_IMODE(p.stat().st_mode)==(0o755 if wanted[n]['mode']=='100755' else 0o644)
 h=hashlib.sha256();s=hashlib.sha1(('blob '+str(p.stat().st_size)+'\\0').encode())
 with p.open('rb') as f:
  while True:
   chunk=f.read(1048576)
   if not chunk:break
   h.update(chunk);s.update(chunk)
 assert p.stat().st_size==wanted[n]['bytes'] and h.hexdigest()==wanted[n]['sha256'] and s.hexdigest()==wanted[n]['blob'],n
fresh=subprocess.check_output(['docker','image','inspect',image],timeout=15);assert len(fresh)<=2097152
original=json.loads((root/'image-inspect-original.json').read_bytes())[0];current=json.loads(fresh)[0];assert current==original and current['Id']==image
for n,data in [('journal-original.jsonl',journal_json),('journal-original.log',subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise'])),('candidate-image-fresh-closed-inspect-original.json',fresh)]:
 assert len(data)<=2097152
 files[n]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':None,'base64':base64.b64encode(data).decode()}
print(json.dumps({'status':'ACTUAL_CLOSED_CORRECTED_BUILD_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationIdFromJournal':invocation,'properties':props,'transientUnitUnloadedAfterSuccess':props['LoadState']=='not-found','unloadedDefaultPropertiesAreNotExecutedLimits':props['LoadState']=='not-found','files':files,'extractedSourceFilesVerified':len(actual),'sourceAllRawGitHashesAndModesUnchanged':True,'freshImageMatchesEntireOriginalInspect':True,'freshInspectRole':'DISTINCT_POST_CLOSURE_READONLY_API_RESPONSE_NOT_ORIGINAL_ROOT_FILE','newBuildsLaunched':0,'databaseConnections':0,'proofLaunches':0,'productionDeployments':0}))
'''.replace('ROOT_VALUE',repr(str(safe_build_root(FIRST_BUILD_ROOT_NAME)))).replace('UNIT_VALUE',repr(UNIT)).replace('INVOCATION_VALUE',repr(INVOCATION)).replace('EXPECTED_VALUE',repr(expected)).replace('IMAGE_VALUE',repr(IMAGE))
DEST.mkdir()
def save(n,raw):
    with (DEST/n).open('xb') as f:f.write(raw)
save('readonly-closed-retainer-source.py',probe.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=probe.encode(),capture_output=True,timeout=60)
save('closed-read-stderr-original.txt',r.stderr);require(r.returncode==0,'Actual closed retention refused; inspect same root, never replay helper')
data=json_exact(r.stdout)
for n,v in data['files'].items():
    raw=base64.b64decode(v.pop('base64'),validate=True);require(len(raw)==v['bytes'] and sha(raw)==v['sha256'],'Exact remote bytes/hash differs');save(n,raw)
save('remote-closed-original-index.json',(json.dumps(data,indent=2)+'\n').encode())
receipt=json_exact((DEST/'build-receipt.json').read_bytes());require(receipt['status']=='BUILT_AFTER_EXCLUDED_ACCOUNTING_FAILURE_NOT_PROVED_OR_DEPLOYED' and receipt['sourceReviewId']==6181452519 and receipt['toolingCommit']==TOOLING and receipt['head']==CANDIDATE and receipt['tree']==TREE and receipt['newBuildCount']==1 and receipt['exitCode']==0 and receipt['error'] is None,'Actual successful qualification binding differs')
require(receipt['image']==IMAGE and receipt['imageBytes']==414679214 and receipt['originalFailureRemainsFailed'] and receipt['oldUnexplainedGrowthNotRetroactivelyAttributed'],'New qualification cannot adopt/reclassify first failure')
for key,name in [('dockerBuildLogSha256','docker-build.log'),('imageInspectSha256','image-inspect-original.json')]:require(sha((DEST/name).read_bytes())==receipt[key] and data['files'][name]['mode']=='0o400','Original sealed result differs')
require((DEST/'candidate-image.id').read_text().strip()==IMAGE and data['files']['candidate-image.id']['mode']==data['files']['build-receipt.json']['mode']=='0o400','Sealed ID/receipt differs')
before=json_exact((DEST/'allocation-before-original.json').read_bytes());after=json_exact((DEST/'allocation-after-original.json').read_bytes())
require(before['rows']==receipt['diskGrowth']['beforeAllocations'] and after['rows']==receipt['diskGrowth']['afterAllocations'],'Original physical rows differ')
validate_allocation_inventory(str(safe_build_root(FIRST_BUILD_ROOT_NAME)),before['rows']);validate_allocation_inventory(str(safe_build_root(FIRST_BUILD_ROOT_NAME)),after['rows'])
devices={p:64769 for p in receipt['freeBytesBefore']};growth=build_disk_growth(receipt['freeBytesBefore'],receipt['freeBytesAfter'],devices,before['rows'],after['rows'])
require(growth==receipt['diskGrowth'] and all(v['freeByteDrop']==v['knownAllocatedGrowthBytes']==66723840 and v['unexplainedGrowthBytes']==0 for v in growth['filesystems'].values()),'Independent exact per-device zero residual proof differs')
require(min(receipt['freeBytesAfter'].values())>=FLOOR and receipt['reserveFloorBytes']==FLOOR and receipt['buildAllocationReserveBytes']==BUILD_ALLOCATION,'Actual reserve bounds differ')
require(json_exact((DEST/'storage-topology-before-selected-original.json').read_bytes())==json_exact((DEST/'storage-topology-after-selected-original.json').read_bytes()),'Actual topology changed')
validation={'status':'ACTUAL_CORRECTED_ACCOUNTING_BUILD_QUALIFIED_NOT_PROVED_OR_DEPLOYED','sourceReviewId':6181452519,'toolingCommit':TOOLING,'originalClosedUtc':receipt['closedUtc'],'dockerBuildElapsedSeconds':receipt['elapsedSeconds'],'root':data['root'],'unit':UNIT,'actualInvocationIdFromJournal':INVOCATION,'successfulDeactivationFromJournal':True,'transientUnitUnloadedAfterSuccess':data['transientUnitUnloadedAfterSuccess'],'unloadedDefaultPropertiesAreNotExecutedLimits':True,'actualActiveOpeningMemoryMax':805306368,'actualActiveOpeningMemorySwapMax':0,'actualActiveOpeningRuntimeMax':'45min','packageFiles':24,'applicationIndexEntries':receipt['verifiedApplicationGitBlobCount'],'extractedRawGitSourceFilesVerified':data['extractedSourceFilesVerified'],'allRawGitHashesAndModesUnchanged':True,'image':IMAGE,'imageBytes':receipt['imageBytes'],'originalImageInspectAndFreshEntireObjectEqual':True,'buildReceiptSha256':sha((DEST/'build-receipt.json').read_bytes()),'freeBytesAfter':receipt['freeBytesAfter'],'freeByteDrop':66723840,'ownedRootGrowthBytes':66121728,'containerdGrowthBytes':602112,'allDockerSubstoreGrowthBytes':0,'unexplainedGrowthBytes':0,'original221500FailureStillFailed':True,'oldUnproved3609116672NotCredited':True,'oldImage1dNotAdopted':True,'newBuildCount':1,'proofLaunches':0,'productionDatabaseConnections':0,'productionDeployments':0,'neverReplay':True}
save('independent-closed-qualification-validation.json',(json.dumps(validation,indent=2)+'\n').encode())
paths=sorted(p for p in DEST.iterdir() if p.is_file())+sorted(p for p in (SOURCE/'first-build-010000-opening-observation').iterdir() if p.is_file() and p.name.startswith(('readonly-terminal-','terminal-boundary-')))+[pathlib.Path(__file__)]
readme=REPO/'WP/audit-release-eb6de2e8/README.md'
readme.write_bytes(('## 2026-10-15 corrected-accounting build010000 CLOSED QUALIFIED — not proved/deployed\n\nActual6608SourcePASS6181452519/one24filepackage/oneunitinvocationa856dfdc5dcf401698724f7ef9459933 completed newordinarycachedDockerbuild exit0/4.3378016s; originalreceipt00:27:51.026UTC statusBUILT_AFTER_EXCLUDED_ACCOUNTING_FAILURE_NOT_PROVED_OR_DEPLOYED. Actualimageb5ab0a0a57aeec4fe24dd8095126f3502cbc0c8629a7f4c1ef9e55034893c6fb/414679214B/cde8tree638. Exactphysicalbeforeafter newroot41492480→107614208 (growth66121728) +ctrd43259318272→43259920384 (growth602112); Dockerbuildkit94449664 unchanged/legacyabsent0. All3boundFS same64769 free58684194816→58617470976/drop66723840=known66723840/unexplained0; floor10556150894PASS.24inputs0400/1561indexentries/1560extractedrawGitfiles+allmodesverifiedunchanged; sealedID/log/receipt/originalinspect0400, distinctfreshclosedreadonlyinspectENTIREobjectequal. Source-topologybeforeafterequal/defaultctrdPID/configSHA. Originalunitjournal oneinvocation/startdone/successfuldeactivation; transientunitunloadedafterward/not-founddefaultpropsNOTexecutedlimits, actualOPENmemory805Swap0runtime45min retained. Originalclosedraws/independentverification at first-build-010000-closed-success/index.json. Neverrebuild/retag/replayroot/helper/cleanup. Original221500FAILED/old3.609GBunproved/old1dEXCLUDED/metadata233000STOP/000500evidence+analysis unchanged, noretroPASS/adoption. Newqualification is ONLYcandidate for separatelyreviewed stoppedproduction-copy proof; no proof/productioncounts/DB/installer/defaultentrypoint/kit/gate/deploy/103connection. Future policyPRESENTNOOP0orSTOP/actual214209lists+invalidStoredAnalysisSampleCount/sample-owner/nonzeroYYapprovedSTOP/retainedallocation/exactkitfreshgate required; humanfilesdraftscards/history intact.\n\n').encode()+readme.read_bytes());paths.append(readme)
idx=DEST/'index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'status':validation['status'],'validation':validation,'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(idx);rels=[p.relative_to(REPO).as_posix() for p in paths]
for i in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[i:i+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Staged owner differs')
from prepare_batch_build import raw_git
tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Raw staged bytes differ')
cmd('git','commit','-m','Retain closed corrected build qualification and exact zero-residual containerd accounting')
head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Raw original OID bytes differ')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'status':validation['status'],'head':head,'verifiedBlobs':len(paths),'validation':validation}))
