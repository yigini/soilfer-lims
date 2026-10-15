"""Read and retain closed same-build originals; no build/proof/cleanup/DB operations."""
import base64,datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-stable-accounting-be837974-20261015'
P=S/'build-package-workflow-batch-build-be837974-20261015T190000Z';D=S/'first-build-190000-closed-originals-once'
ROOT='/opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z';UNIT='lims-workflow-batch-build-be837974-20261015t190000z';INV='54ec282a37d34dd3997c3274c5587abf'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert not D.exists() and not git('diff','--cached','--name-only').strip()
BASE=git('rev-parse','HEAD').decode().strip();assert git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
sys.path.insert(0,str(S));from batch_build_contract import *
spec,index,review=[json_exact((P/n).read_bytes()) for n in ['build-input.json','tooling-source-index.json','source-review-original.json']]
validate_spec(spec,index,review);require(review['id']==6200145007,'Exact PASS differs')
expected={n:{'bytes':(P/n).stat().st_size,'sha256':sha((P/n).read_bytes())} for n in REQUIRED_ARTIFACTS}
launch=json_exact((S/(P.name+'-launch')/'launch-record.json').read_bytes());require(launch['packageFileHashes']=={n:v['sha256'] for n,v in expected.items()},'Uploaded package differs')
probe=r'''import base64,datetime,hashlib,json,pathlib,re,stat,subprocess
root=pathlib.Path(ROOT_VALUE);unit=UNIT_VALUE;inv=INV_VALUE;expected=EXPECTED_VALUE
assert root.is_dir() and not root.is_symlink()
propsraw=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,MainPID,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec'],capture_output=True,timeout=15)
assert len(propsraw.stdout)<=65536 and len(propsraw.stderr)<=65536
props=dict(v.split('=',1) for v in propsraw.stdout.decode().splitlines() if '=' in v)
assert props.get('MainPID')=='0' and props.get('ActiveState') in ['inactive','failed'],'Build not closed; never retry this helper'
journal=subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','json'],timeout=15);assert len(journal)<=4*1024**2
jrows=[json.loads(v) for v in journal.splitlines() if v]
identities={v.get('INVOCATION_ID',v.get('_SYSTEMD_INVOCATION_ID')) for v in jrows};assert identities=={inv},identities
assert any(v.get('JOB_RESULT')=='done' and v.get('UNIT')==unit+'.service' for v in jrows),'No actual same-unit start/done journal'
success_deactivation=any(v.get('MESSAGE')==unit+'.service: Deactivated successfully.' and v.get('UNIT')==unit+'.service' for v in jrows)
terminal=[n for n in ['build-receipt.json','build-preflight-refusal.json','build-terminal-failure.json'] if (root/n).is_file()]
assert len(terminal)==1,'Expected one honest terminal record'
receipt=json.loads((root/terminal[0]).read_bytes());success=terminal==['build-receipt.json']
if success:
 assert success_deactivation
 if props['LoadState']=='loaded':assert props['InvocationID']==inv and props['Result']=='success' and props['ExecMainStatus']=='0'
 else:assert props['LoadState']=='not-found' and props['InvocationID']==''
files={};captured={};total=0
def read_file(p):
 before=p.stat();assert stat.S_ISREG(before.st_mode) and not p.is_symlink()
 h=hashlib.sha256();o=hashlib.sha1(('blob '+str(before.st_size)+'\0').encode())
 with p.open('rb') as f:
  while True:
   v=f.read(1048576)
   if not v:break
   h.update(v);o.update(v)
 after=p.stat();assert (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns)
 return {'bytes':before.st_size,'sha256':h.hexdigest(),'gitBlobOid':o.hexdigest(),'mode':oct(stat.S_IMODE(before.st_mode))}
names=sorted(p.name for p in root.iterdir());assert len(names)<=256
for p in sorted(root.iterdir()):
 assert not p.is_symlink()
 if p.name=='source':assert p.is_dir();continue
 row=read_file(p);files[p.name]=row
 if p.name in expected:assert row['bytes']==expected[p.name]['bytes'] and row['sha256']==expected[p.name]['sha256'] and row['mode']=='0o400',p.name
 else:
  assert row['bytes']<=16*1024**2,p.name
  raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256'];total+=len(raw);assert total<=64*1024**2
  captured[p.name]=base64.b64encode(raw).decode()
assert set(expected)<=set(files)
application=json.loads((root/'source-index.json').read_bytes());wanted={v['path']:v for v in application['entries'] if 'node_modules' not in pathlib.PurePosixPath(v['path']).parts}
source_rows={}
if (root/'source').is_dir():
 for p in sorted((root/'source').rglob('*')):
  assert not p.is_symlink()
  if p.is_dir():continue
  n=p.relative_to(root/'source').as_posix();assert n in wanted
  row=read_file(p);v=wanted[n]
  assert row['bytes']==v['bytes'] and row['sha256']==v['sha256'] and row['gitBlobOid']==v['blob'] and row['mode']==('0o755' if v['mode']=='100755' else '0o644'),n
  source_rows[n]=row
assert len(source_rows)<=10000
if success:assert set(source_rows)==set(wanted),'Incomplete extracted source'
assert sorted(p.name for p in root.iterdir())==names,'Closed top-level inventory changed'
extra={'journal-original.jsonl':journal,'journal-original.log':subprocess.check_output(['journalctl','-u',unit,'--no-pager','-o','short-iso-precise'],timeout=15),'systemctl-original.stdout':propsraw.stdout,'systemctl-original.stderr':propsraw.stderr}
fresh_equal=False
if success:
 image=receipt['image'];assert re.fullmatch('sha256:[a-f0-9]{64}',image)
 fresh=subprocess.check_output(['docker','image','inspect',image],timeout=15);assert len(fresh)<=2097152
 assert json.loads(fresh)==json.loads((root/'image-inspect-original.json').read_bytes()),'Fresh whole image differs'
 extra['candidate-image-fresh-closed-inspect-original.json']=fresh;fresh_equal=True
for n,raw in extra.items():
 assert len(raw)<=4*1024**2
 files[n]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlobOid':hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest(),'mode':None};captured[n]=base64.b64encode(raw).decode()
print(json.dumps({'status':'ACTUAL_CLOSED_STARTUP_BUILD_ORIGINALS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'actualInvocationId':inv,'properties':props,'successfulDeactivationFromJournal':success_deactivation,'transientUnitUnloaded':props['LoadState']=='not-found','unloadedDefaultsAreNotExecutedLimits':props['LoadState']=='not-found','terminalName':terminal[0],'files':files,'capturedBase64':captured,'publishedPackageFilesVerifiedWithoutDuplicateFetch':len(expected),'sourceAllRawGitHashesAndModesVerified':True,'sourceComplete':set(source_rows)==set(wanted),'extractedSourceFiles':source_rows,'freshImageEntireOriginalEqual':fresh_equal,'retainerBuildsProofsCleanupProductionOperations':0}))
'''.replace('ROOT_VALUE',repr(ROOT)).replace('UNIT_VALUE',repr(UNIT)).replace('INV_VALUE',repr(INV)).replace('EXPECTED_VALUE',repr(expected))
D.mkdir()
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
def js(n,v):save(n,(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode())
save('readonly-closed-retainer-source.py',probe.encode())
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=R,input=probe.encode(),capture_output=True,timeout=75)
save('closed-read-stderr-original.log',r.stderr);save('closed-read-exit-original.json',(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})+'\n').encode())
if r.returncode!=0:save('closed-read-stdout-refused-original.log',r.stdout)
require(r.returncode==0,'Closed retention refused; retain all, inspect same root with a new unique successor')
data=json_exact(r.stdout);captured=data.pop('capturedBase64')
for n,b64 in captured.items():
 v=base64.b64decode(b64,validate=True);row=data['files'][n];require(len(v)==row['bytes'] and sha(v)==row['sha256'] and oid(v)==row['gitBlobOid'],'Original remote bytes differ '+n);save(n,v)
js('remote-closed-original-index.json',data)
terminal=json_exact((D/data['terminalName']).read_bytes());qualified=data['terminalName']=='build-receipt.json'
validation={'status':'ACTUAL_NEW_STARTUP_BUILD_CLOSED_FAILED_OR_REFUSED_RETAIN_ALL','root':ROOT,'unit':UNIT,'actualInvocationId':INV,'terminalName':data['terminalName'],'terminal':terminal,'qualified':False,'sourceReviewId':review['id'],'toolingCommit':index['head'],'newBuildsLaunchedByRetainer':0,'proofs':0,'cleanup':0,'productionOperations':0,'neverReplay':True}
if qualified:
 require(terminal['status']=='NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED' and terminal['toolingCommit']==index['head'] and terminal['sourceReviewId']==review['id'] and terminal['head']==CANDIDATE and terminal['tree']==TREE and terminal['newBuildCount']==1 and terminal['exitCode']==0 and terminal['error'] is None,'Actual receipt differs')
 require(terminal['cachePruningPerformed'] is False and terminal['proofDatabaseRemovalPerformed'] is False and terminal['r4AdditionalHeadroomBytes']==R4_HEADROOM,'Scope or capacity changed')
 require(data['sourceComplete'] and data['freshImageEntireOriginalEqual'],'Source/image qualification incomplete')
 require((D/'candidate-image.id').read_text().strip()==terminal['image'],'Sealed image ID differs')
 for key,name in [('dockerBuildLogSha256','docker-build.log'),('imageInspectSha256','image-inspect-original.json')]:require(sha((D/name).read_bytes())==terminal[key] and data['files'][name]['mode']=='0o400','Original result hash/mode differs')
 require(data['files']['candidate-image.id']['mode']==data['files']['build-receipt.json']['mode']=='0o400','Original ID/receipt not sealed')
 before=json_exact((D/'allocation-before-original.json').read_bytes());after=json_exact((D/'allocation-after-original.json').read_bytes())
 validate_allocation_inventory(ROOT,before['rows']);validate_allocation_inventory(ROOT,after['rows'])
 for phase,measurement in [('before',before),('after',after)]:
  accepted=measurement['acceptedCompleteAttempt'];attempts=measurement['allAttempts']
  require(type(accepted) is int and 1<=accepted<=(1 if phase=='before' else 2) and len(attempts)==accepted and measurement['partialTotalsNeverCredited'] is True,'Measurement attempts differ')
  for i,a in enumerate(attempts,1):
   prefix='allocation-'+phase+'-attempt-'+str(i)
   intent=json_exact((D/(prefix+'-intent.json')).read_bytes());result=json_exact((D/(prefix+'-result.json')).read_bytes())
   out=(D/(prefix+'-stdout.log')).read_bytes();err=(D/(prefix+'-stderr.log')).read_bytes()
   require(a['attempt']==i and result['attempt']==i and intent['stage']==phase and intent['attempt']==i and intent['timeoutSeconds']==MEASUREMENT_TIMEOUT and intent['partialTotalsAccepted'] is False,'Actual attempt identity/bounds differ')
   require(a['stdoutSha256']==result['stdoutSha256']==sha(out) and a['stderrSha256']==result['stderrSha256']==sha(err) and a['exitCode']==result['exitCode'],'Original attempt byte identities differ')
   require(len(out)<=65536 and len(err)<=65536 and a['accepted'] is (i==accepted),'Bounded attempt acceptance differs')
   for suffix in ['-intent.json','-result.json','-stdout.log','-stderr.log']:require(data['files'][prefix+suffix]['mode']=='0o400','Attempt evidence not sealed')
   if i==accepted:
    require(a['exitCode']==0 and err==b'' and result['commandExit0WithEmptyStderr'] is True,'Accepted measurement incomplete/noisy')
    present={p for p,v in measurement['rows'].items() if v['exists']}
    require(parse_complete_allocation_rows(out.decode(),present,measurement['rows'])==measurement['rows'],'Accepted full raw inventory differs')
   else:
    require(phase=='after' and i==1 and a['accepted'] is False,'Unexpected additional measurement')
    missing_snapshot_measurement_paths(phase,i,a['exitCode'],err.decode())
    observation=json_exact((D/(prefix+'-narrow-missing-directory-observation.json')).read_bytes())
    require(observation['partialTotalsCredited'] is False and observation['parentRealNonaliasSameDevice'] is True and observation['allMissingPathsStillAbsent'] is True,'Additional measurement observation differs')

 for phase in ['before-root','before-unit']:
  fresh_gate=json_exact((S/(P.name+'-launch')/('capacity-'+phase+'-original.stdout')).read_bytes())
  validate_capacity_observation(spec['capacityPlan'],phase,fresh_gate['paths'])
  require(fresh_gate['requiredFreeBytes']==capacity_requirement(spec['capacityPlan'],phase),'Fresh launcher gate changed')
 opening=json_exact((S/'first-build-190000-opening-observation-once/stdout-original.json').read_bytes())
 require(opening['properties']['InvocationID']==INV and opening['properties']['MemoryMax']=='805306368' and opening['properties']['MemorySwapMax']=='0' and opening['properties']['RuntimeMaxUSec']=='45min','Actual active execution limits differ')
 for n,row in index['files'].items():require(sha((S/n).read_bytes())==row['sha256'],'Frozen reviewed tooling changed '+n)
 unit_gate=json_exact((S/(P.name+'-launch')/'capacity-before-unit-original.stdout').read_bytes())
 devices={p:unit_gate['paths'][p]['device'] for p in terminal['freeBytesBefore']}
 growth=build_disk_growth(terminal['freeBytesBefore'],terminal['freeBytesAfter'],devices,before['rows'],after['rows'])
 require(growth==terminal['diskGrowth'],'Independent disk growth differs')
 require(min(terminal['freeBytesAfter'].values())>=FLOOR,'Closed floor refused')
 require(json_exact((D/'storage-topology-before-selected-original.json').read_bytes())==json_exact((D/'storage-topology-after-selected-original.json').read_bytes()),'Actual storage topology changed')
 gate=json_exact((D/'capacity-before-build-original.json').read_bytes())
 require(gate['phase']=='before-build' and gate['requiredFreeBytes']==capacity_requirement(spec['capacityPlan'],'before-build') and min(gate['freeBytes'].values())>=gate['requiredFreeBytes'],'Fresh before-build R4 differs')
 frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen source inventory differs')
 for p,s in frozen.items():require(sha((R/p).read_bytes())==s,'Frozen application input changed '+p)
 validation.update(status='ACTUAL_NEW_STARTUP_BUILD_QUALIFIED_NOT_PROVED_OR_DEPLOYED',qualified=True,image=terminal['image'],imageBytes=terminal['imageBytes'],receiptSha256=sha((D/'build-receipt.json').read_bytes()),buildElapsedSeconds=terminal['elapsedSeconds'],actualReceiptClosedUtc=terminal['closedUtc'],all1333ApplicationInputsUnchanged=True,extractedRawGitFilesVerified=len(data['extractedSourceFiles']),independentDiskGrowth=growth,beforeBuildCapacity=gate,originalFailureStillFailed=terminal['originalFailureRemainsFailed'],oldGrowthNotRetroactivelyCredited=terminal['oldUnexplainedGrowthNotRetroactivelyAttributed'],r2BoundedSourceReviewAndItemReceiptStillRequired=True)
js('independent-closed-validation.json',validation)
js('package-original-byte-locations.json',{'publishedPackageAudit':'c8839c1c4f597a0c145cc06ec26537d7173bb7c7','packagePublicationIndex':'WP/batch-build-stable-accounting-be837974-20261015/reviewed-package-publication-6200145007-once/publication-index.json','remotePackageFilesVerified':expected,'all32RemoteBytesMatchPublishedLocalOriginals':True,'duplicateRemotePackageFetch':False})
from prepare_batch_build import current_evidence
current=current_evidence()
for n,v in current.items():save('current-closure-'+n,v)
fresh_review_raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/6200145007'],cwd=R)
fresh_review=json_exact(fresh_review_raw);validate_source_review(fresh_review,index['head'],index)
require({k:fresh_review[k] for k in ['id','body','created_at','updated_at']}=={k:review[k] for k in ['id','body','created_at','updated_at']},'Actual approval changed after execution')
require(fresh_review['performed_via_github_app']['id']==1236702,'Actual Claude app changed')
save('current-closure-source-review-original.json',fresh_review_raw)
history=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100'],cwd=R)
no_later_source_failure([v for page in json_exact(history) for v in page],review,index['head']);save('current-closure-coordination-history-original.json',history)
lead=f'''## 2026-10-15 stable-accounting build190000 ACTUAL CLOSED — {validation['status']}

ONE reviewed source4de3e334/actualPASS6200145007/new190000unitinvocation{INV} closed{terminal.get('closedUtc')}; Dockerexit{terminal.get('exitCode')}/elapsed{terminal.get('elapsedSeconds')}s. Qualified={qualified}; actualstatus={terminal['status']}. Fulloriginalreceipt/ID/imageinspect/allrawattemptstdoutstderrintentresults/journals/systemctl/32remoteinputhashes/completeextractedrawGitOID+SHA+modes independently verified and retained at WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-closed-originals-once/publication-index.json. {('NEWimage='+terminal['image']+' bytes='+str(terminal['imageBytes'])+' receiptSHA256='+validation['receiptSha256']+'. Both complete measurements accepted firstattempt; no additional attempt needed. Original partial attempts from failed180000 are never measured/adopted/credited. Independentgrowth='+str(validation['independentDiskGrowth']['filesystems'])+'. Actualbefore-buildR4 passed; ALL1333app/all5tooling unchanged/freshmainCI4audits/rules/actualapproval/no laterfailure verified. NEWimage is candidate only, NOT proved/deployed. R2 after-qualified-build actualmax-used-space5GB/sharedinuse protection still requires separate bounded-source/review/itemreceipt. ThenNEWimage-boundcompleteprooftooling/allhashClPASS/freshR4computed+10GB/NEWproofroot; NEVERcde8/B5/100000retry.') if qualified else 'FAILED/REFUSED retained honestly; separately reviewed forward correction only, no retry/adoption.'} No proof/cleanup/kit/gate/deploy/productionDBoperation. Root/unit/package/sourcePASS/helpers consumed NEVERrebuild/retag/retry/replay/cleanup. Failed180000/a61and221500/oldresidual/B5/allhistoricalroots and containers preserved/excluded as applicable. CurrentR1amend/R2-R5/science/refusal/report/hash/copyrace/600/805/forwardonly/no103/humanhistory hold.

Transientunit GC/not-found and infinity/emptyproperties/sentinelpeak atclosedread are NOT executedlimits/measuredpeak. Actual active opening19:18:45UTC805306368/Swap0/45min plus sameinvocation start/done/successfuldeactivation journal bind execution. Build started19:18:30UTC=21:18:30CEST; originalraws untouched.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())
for label in ['second','third','fourth','fifth','sixth']:
 folder=S/(label+'-build-190000-readonly-observation-once')
 if folder.exists():paths += sorted(p for p in folder.iterdir() if p.is_file())
 helper=R/('WP/backlog-resume-20261013/observe-stable-accounting-build190000-'+label+'-readonly-once.py')
 if helper.exists():paths.append(helper)
paths += [pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json';js('publication-index.json',{'baseAudit':BASE,'sourceReviewId':review['id'],'toolingCommit':index['head'],'status':validation['status'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})
paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged owner differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw bytes differ')
git('commit','-m','Retain actual closed startup build190000 originals and independent qualification')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'status':validation['status'],'image':validation.get('image'),'receiptSha256':validation.get('receiptSha256'),'actualClosedUtc':terminal.get('closedUtc'),'elapsedSeconds':terminal.get('elapsedSeconds'),'freeAfter':terminal.get('freeBytesAfter'),'diskGrowth':validation.get('independentDiskGrowth'),'noActiveBuildRetry':True}))
