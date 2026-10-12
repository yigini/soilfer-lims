"""Verify only a completed new release; never open live SQLite or mutate the host."""
import base64
import json
from pathlib import Path
import re
import subprocess
import sys

root, manifest_sha, receipt_sha, destination = sys.argv[1:]
assert re.fullmatch('/opt/lims/releases/instrument-import-release-[A-Za-z0-9_-]+', root)
assert all(re.fullmatch('[a-f0-9]{64}', value) for value in [manifest_sha, receipt_sha])
output = Path(destination); assert not output.exists()
payload = base64.b64encode(json.dumps({'root': root, 'manifestSha256': manifest_sha, 'receiptSha256': receipt_sha}).encode()).decode()
code = r'''import base64,datetime,hashlib,json,pathlib,subprocess,sys
p=json.loads(base64.b64decode(PAYLOAD));root=pathlib.Path(p['root']);frozen=root/'frozen';sys.path.insert(0,str(frozen))
assert str(root)=='/opt/lims/releases/instrument-import-release-959d17e1-20261012T202400Z'
import import_release_contract as c
import release_support as s
import startup_common as startup
from import_preservation import verify_import_installation
assert c.sha(frozen/'prepared-manifest.json')==p['manifestSha256']
manifest=json.loads((frozen/'prepared-manifest.json').read_bytes());c.frozen_files(root,manifest)
unit='lims-release-'+root.name.lower()+'.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',unit,'-p','ActiveState','-p','SubState','-p','Result','-p','ExecMainStatus'],text=True,timeout=15).splitlines())
assert state['ActiveState']=='inactive' and state['ExecMainStatus']=='0'
path=root/'production-receipt.json';raw=path.read_bytes();receipt=json.loads(raw)
assert not path.is_symlink() and path.stat().st_mode&0o777==0o400 and hashlib.sha256(raw).hexdigest()==p['receiptSha256']
assert receipt['status']=='DEPLOYED_NEW_IMPORT_FORWARD' and receipt['manifestSha256']==p['manifestSha256']
assert receipt['head']==manifest['head']=='959d17e11c357266f7c2a41b0c84ab76914c591e'
assert receipt['image']==manifest['image']=='sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
assert receipt['proofSourceReviewId']==6126765238 and receipt['auditReviewId']==6125341751
assert receipt['originalProofRoot']=='/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z'
assert receipt['firstProofPolicy']==c.FIRST_PROOF_POLICY and receipt['workloadControl']==c.WORKLOAD_PINS
assert manifest['packagingCommit']=='e4d692a0c0eaed34017f4419172dfcf8db563be0' and manifest['productionBaselineSourceReviewId']==6132295413
assert receipt['entryBinding']==manifest['entryBinding']==c.entry_binding() and receipt['alreadyStoppedEntryNoSecondStop'] is True
assert c.sha(pathlib.Path(c.entry_binding()['failedProductionRoot'])/'production-receipt.json')==c.entry_binding()['failedProductionReceiptSha256']
c.require_build_reuse(receipt);c.native_installation(receipt['nativeImportInstallation'])
assert receipt['repeatPhysicalPolicy']==c.REPEAT_POLICY and receipt['retainedDatabaseAllocationCount']==16
assert c.sha(root/'production-gate.json')==receipt['productionGateSha256']
assert receipt['rehearsalReceiptSha256']==manifest['files']['rehearsal-receipt.json']
assert receipt['coordinatorSha256']==manifest['files']['deploy_import.py']
assert receipt['protectedTableCount']==106 and receipt['protectedReceiptCount']==39
assert receipt['originalProtectedTableCount']==104 and receipt['originalProtectedReceiptCount']==38
assert receipt['databaseChangesBeforeJobs']==0 and receipt['fullLogicalStatePreservedBeforeJobs'] is True
assert receipt['originalRawTriplePreservedInSeals'] is True and receipt['productionObservationSeconds']==660
assert receipt['apiChecks']=={'passed':31,'total':31,'failed':0} and len(receipt['probes'])==6 and receipt['readOnlyProbeChanges']==0
for phase,jobs in [('jobsOff',False),('jobsOn',True)]:
 ready=receipt[phase+'Readiness'];checks=receipt[phase+'Checks']
 assert ready['jobsEnabled'] is jobs and ready['restartCount']==0 and ready['oomKilled'] is False and 0<ready['elapsedSeconds']<=600
 assert len(checks['entrypointInstallers'])==23 and all(row['mode']=='NO_OP' and row['totalChanges']==0 for row in checks['entrypointInstallers'])
 assert checks['entrypointInstallers'][-1]['classification']=='COMPLETE_200'
 assert [row['event'] for row in checks['startupReady']]==[name+'_STARTUP_READY' for name in c.READY_EVENTS]
 assert all(row['totalChanges']==0 for row in checks['startupReady']) and checks['startupChanges']==0
 assert 0<checks['startupMemory']['peakBytes']<=805306368 and checks['startupMemory']['nodeOptions'] is None
 c.import_zero(checks['startupReady'][-1])
 if jobs:assert checks['ownedJobsBoundary']=={'policy':'NORMAL_PRODUCTION_JOBS_AFTER_ZERO_WRITE_SEAL_AND_INGRESS_REOPEN','fullStateZeroClaimed':False}
samples=receipt['normalJobsHealthSamples'];assert samples and all(row['healthy'] is True and row['restartCount']==0 and 0<row['peakBytes']<=805306368 for row in samples)
elapsed=(datetime.datetime.fromisoformat(receipt['timesUtc']['completed'])-datetime.datetime.fromisoformat(receipt['timesUtc']['normalJobsEnabled'])).total_seconds()
assert elapsed>=660 and 0<receipt['peakBytes']<=805306368
assert datetime.datetime.fromisoformat(receipt['timesUtc']['ingressReopenedBeforeJobs'])<datetime.datetime.fromisoformat(receipt['timesUtc']['normalJobsEnabled'])
seals={}
for label,key,tables,receipts in [('original-stopped-seal','originalStoppedSeal',104,38),('candidate-jobs-off-seal','jobsOffStoppedLogicalSeal',106,39)]:
 directory=root/label;evidence=json.loads((directory/'sealed-state.json').read_bytes());assert evidence==receipt[key]
 for name,digest in [('main-only-state.json',evidence['mainOnlyStateSha256']),('wal-aware-state.json',evidence['logicalStateSha256']),('dev-stopped-backup.db',evidence['backupSha256'])]:
  file=directory/name;assert not file.is_symlink() and file.stat().st_mode&0o777==0o400 and c.sha(file)==digest
 logical=json.loads((directory/'wal-aware-state.json').read_bytes())
 assert logical['integrity']=='ok' and logical['foreignKeyViolations']==0 and len(logical['tables'])==tables and logical['tables']['_schema_migrations']['count']==receipts
 for suffix,row in evidence['rawFiles'].items():
  file=directory/'raw'/('dev.db'+suffix)
  if row is None:assert not file.exists()
  else:assert not file.is_symlink() and file.stat().st_mode&0o777==0o400 and file.stat().st_size==row['bytes'] and c.sha(file)==row['sha256']
 physical=json.loads((directory/'raw/original-triple.json').read_bytes());assert physical['before']==physical['after']==evidence['originalFiles']
 seals[label]={'logicalStateSha256':evidence['logicalStateSha256'],'backupSha256':evidence['backupSha256'],'rawHashesAndModesPassed':True,'tables':tables,'receipts':receipts,'integrity':'ok','foreignKeyViolations':0}
assert receipt['jobsOffStoppedLogicalSeal']['matchesExpected'] is True
native=receipt['nativeImportInstallation'];before=root/'original-stopped-seal/dev-stopped-backup.db';after=root/'after-import-stopped/dev-stopped-backup.db'
delta=verify_import_installation(before,after,frozen,native['originalRowsSha256'])
assert delta==json.loads((root/'import-install-preservation.json').read_bytes()) and delta['scientificChanges']==0
repeat=json.loads((root/'after-repeat-stopped/sealed-state.json').read_bytes());installed=json.loads((root/'after-import-stopped/sealed-state.json').read_bytes())
c.readonly_repeat_physical(installed['originalFiles'],repeat['originalFiles'])
assert repeat==native['repeatStoppedSeal'] and repeat['logicalStateSha256']==installed['logicalStateSha256']
assert c.sha(root/'import-repeat-preservation.json')==native['repeatPreservationSha256']
installed_state=json.loads((root/'installed-protected-state.json').read_bytes());startup.exact_state(root/'after-repeat-stopped/dev-stopped-backup.db',installed_state,immutable=True)
assert c.sha(root/'installed-protected-state.json')==receipt['installedProtectedStateSha256']
assert installed_state==json.loads((root/'candidate-jobs-off-seal/wal-aware-state.json').read_bytes())
def inspect_live():return json.loads(subprocess.check_output(['docker','inspect','soilfer-lims'],text=True,timeout=15))[0]
live=inspect_live();env=dict(row.split('=',1) for row in live['Config']['Env']);mounts={row['Destination']:row for row in live['Mounts']}
assert live['Image']==receipt['image'] and live['State']['Running'] and live['State']['Health']['Status']=='healthy' and live['RestartCount']==0 and live['State']['OOMKilled'] is False
assert live['HostConfig']['Memory']==805306368 and env.get('NODE_OPTIONS','')=='' and env['DISABLE_BACKGROUND_JOBS']==env['ALLOW_PRISMA_DB_PUSH']==env['ALLOW_AUTO_SEED']=='false'
assert mounts['/app/server/prisma']['Name']=='lims_lims-data' and mounts['/app/server/uploads']['Name']=='lims_lims-assets'
image=json.loads(subprocess.check_output(['docker','image','inspect',live['Image']],text=True,timeout=15))[0]
assert image['Config']['Labels']['org.opencontainers.image.revision']==receipt['head'] and image['Size']==413806636
assert c.sha(s.CONF)==manifest['files']['apache-before.conf'] and c.sha(pathlib.Path(c.HISTORICAL_ROOT_PATH)/'production-receipt.json')==c.HISTORICAL_RECEIPT_SHA
https={}
for url_path in ['/api/health','/login']:
 result=subprocess.run(['curl','-sS','--max-time','10','-w','\n%{http_code}','https://lims.yigini.net'+url_path],capture_output=True,text=True,timeout=12)
 body,_,status=result.stdout.rpartition('\n');assert result.returncode==0 and status=='200'
 https[url_path]={'httpStatus':200,'tlsVerified':True}
 if url_path=='/api/health':
  value=json.loads(body);assert value['status']=='ok' and value['version']=='1.9.0';https[url_path].update(status=value['status'],version=value['version'])
assert (root/'final-denied-post.stdout').read_text().strip()=='401'
denied=subprocess.run(['curl','-sS','--max-time','10','-X','POST','-w','\n%{http_code}','https://lims.yigini.net/api/v2/data-exchange/receipts'],capture_output=True,text=True,timeout=12)
assert denied.returncode==0 and denied.stdout.rpartition('\n')[2]=='401'
free=s.disk_free();required=receipt['preflight']['requiredIncludingBackupBytes'];assert min(free.values())>=required
final=inspect_live();assert final['Id']==live['Id'] and final['State']['Running'] and final['State']['Health']['Status']=='healthy' and final['RestartCount']==0
assert path.read_bytes()==raw;c.frozen_files(root,manifest)
print(json.dumps({'status':'INDEPENDENT_READ_ONLY_IMPORT_POST_DEPLOY_PASS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'productionMutations':0,'liveSqliteConnections':0,'unitState':state,'root':str(root),'head':receipt['head'],'image':live['Image'],'receiptSha256':hashlib.sha256(raw).hexdigest(),'manifestSha256':p['manifestSha256'],'receiptMode':'0o400','completedUtc':receipt['timesUtc']['completed'],'healthObservationElapsedSeconds':elapsed,'healthSamples':len(samples),'peakBytes':receipt['peakBytes'],'seals':seals,'exactImportDeltaRecomputed':True,'repeatFullStateRecomputed':True,'https':https,'retainedUnauthorizedReceiptPostStatus':401,'freshUnauthorizedReceiptPostStatus':401,'restartCount':0,'nodeOptions':'','jobsEnabled':True,'sameVolumes':['lims_lims-data','lims_lims-assets'],'all66FrozenSourceProofFilesUnchanged':True,'requiredIncludingAllocationBytes':required,'freeBytes':free,'retainedAcceptance':receipt['retainedAcceptance']}))
'''.replace('PAYLOAD', repr(payload))
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
    input=code.encode(), capture_output=True, timeout=300)
assert result.returncode == 0, result.stderr.decode('utf-8', errors='replace')
value = json.loads(result.stdout)
with output.open('x', encoding='utf-8', newline='\n') as stream: json.dump(value, stream, indent=2)
print(json.dumps(value))
