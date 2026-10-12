"""Independently inspect a completed release; never mutate host or live SQLite."""
import base64
import json
import pathlib
import subprocess
import sys


def main():
    root, unit, destination = sys.argv[1:]
    output = pathlib.Path(destination)
    assert not output.exists(), 'Never overwrite independent verification'
    payload = base64.b64encode(json.dumps({'root': root, 'unit': unit}).encode()).decode()
    code = '''import base64,datetime,hashlib,json,pathlib,shutil,subprocess,sys
p=json.loads(base64.b64decode(PAYLOAD));root=pathlib.Path(p['root'])
assert root.parent==pathlib.Path('/opt/lims/releases') and root.name.startswith('runtime-kobo-release-')
assert p['unit']=='lims-release-'+root.name.lower()+'.service'
sys.path.insert(0,str(root))
import runtime_release_contract as c
import release_support as s
unit_state=subprocess.check_output(['systemctl','show',p['unit'],'-p','ActiveState','-p','SubState','-p','ExecMainStatus'],text=True,timeout=15)
assert 'ActiveState=inactive' in unit_state and 'ExecMainStatus=0' in unit_state,unit_state
receipt_path=root/'production-receipt.json';raw=receipt_path.read_bytes();receipt=json.loads(raw)
assert receipt_path.stat().st_mode&0o777==0o400 and not receipt_path.is_symlink()
assert receipt['status']=='DEPLOYED_NEW_RUNTIME_FORWARD'
manifest=json.loads((root/'prepared-manifest.json').read_bytes());c.frozen_files(root,manifest)
assert c.sha(root/'prepared-manifest.json')==receipt['manifestSha256']
assert c.sha(root/'production-gate.json')==receipt['productionGateSha256']
assert receipt['head']==manifest['head']=='f830f900f597f20e12570b583e4e32ce9cb50a1d'
assert receipt['image']==manifest['image']=='sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413'
assert receipt['protectedTableCount']==104 and receipt['protectedReceiptCount']==38
assert receipt['databaseChangesBeforeJobs']==0 and receipt['fullLogicalStatePreservedBeforeJobs'] is True
assert receipt['originalRawTriplePreservedInSeals'] is True and receipt['productionObservationSeconds']==660
assert 0<receipt['peakBytes']<=805306368
assert receipt['workloadControl']==c.WORKLOAD_PINS
assert receipt['apiChecks']=={'passed':31,'total':31,'failed':0}
assert len(receipt['probes'])==6 and receipt['readOnlyProbeChanges']==0
for phase in ['jobsOff','jobsOn']:
 checks=receipt[phase+'Checks'];ready=receipt[phase+'Readiness']
 assert len(checks['startupReady'])==21 and len(checks['entrypointInstallers'])==22 and checks['startupChanges']==0
 assert all(row['totalChanges']==0 for row in checks['startupReady'])
 assert ready['elapsedSeconds']<=600 and ready['restartCount']==0 and ready['oomKilled'] is False
 assert 0<checks['startupMemory']['peakBytes']<=805306368
samples=receipt['normalJobsHealthSamples'];assert samples and all(row['healthy'] and row['restartCount']==0 and 0<row['peakBytes']<=805306368 for row in samples)
elapsed=(datetime.datetime.fromisoformat(receipt['timesUtc']['completed'])-datetime.datetime.fromisoformat(receipt['timesUtc']['normalJobsEnabled'])).total_seconds()
assert elapsed>=660
seals={}
for label,key in [('original-stopped-seal','originalStoppedSeal'),('candidate-jobs-off-seal','jobsOffStoppedLogicalSeal')]:
 directory=root/label;evidence=json.loads((directory/'sealed-state.json').read_bytes());assert evidence==receipt[key]
 for name,digest in [('main-only-state.json',evidence['mainOnlyStateSha256']),('wal-aware-state.json',evidence['logicalStateSha256']),('dev-stopped-backup.db',evidence['backupSha256'])]:
  file=directory/name;assert not file.is_symlink() and file.stat().st_mode&0o777==0o400 and c.sha(file)==digest
 logical=json.loads((directory/'wal-aware-state.json').read_bytes());main_only=json.loads((directory/'main-only-state.json').read_bytes())
 assert logical['integrity']=='ok' and logical['foreignKeyViolations']==0 and len(logical['tables'])==104 and logical['tables']['_schema_migrations']['count']==38
 assert set(logical['tables'])==set(main_only['tables']) and all(row['count']>=main_only['tables'][name]['count'] for name,row in logical['tables'].items())
 for suffix,row in evidence['rawFiles'].items():
  file=directory/'raw'/('dev.db'+suffix)
  if row is None:assert not file.exists()
  else:assert not file.is_symlink() and file.stat().st_mode&0o777==0o400 and file.stat().st_size==row['bytes'] and c.sha(file)==row['sha256']
 assert evidence['logicalStateSha256']==receipt['protectedStateSha256']
 seals[label]={'logicalStateSha256':evidence['logicalStateSha256'],'backupSha256':evidence['backupSha256'],'rawHashesAndModesPassed':True,'tables':104,'receipts':38,'integrity':'ok','foreignKeyViolations':0}
assert receipt['jobsOffStoppedLogicalSeal']['matchesExpected'] is True
def inspect_live():return json.loads(subprocess.check_output(['docker','inspect','soilfer-lims'],text=True,timeout=15))[0]
live=inspect_live();env=dict(value.split('=',1) for value in live['Config']['Env']);mounts={row['Destination']:row for row in live['Mounts']}
assert live['Image']==receipt['image'] and live['State']['Running'] and live['State']['Health']['Status']=='healthy' and live['RestartCount']==0 and live['State']['OOMKilled'] is False
assert live['HostConfig']['Memory']==805306368 and env.get('NODE_OPTIONS','')=='' and env['DISABLE_BACKGROUND_JOBS']==env['ALLOW_PRISMA_DB_PUSH']==env['ALLOW_AUTO_SEED']=='false'
assert mounts['/app/server/prisma']['Name']=='lims_lims-data' and mounts['/app/server/uploads']['Name']=='lims_lims-assets'
image=json.loads(subprocess.check_output(['docker','image','inspect',live['Image']],text=True,timeout=15))[0]
assert image['Config']['Labels']['org.opencontainers.image.revision']==receipt['head']
assert c.sha(s.CONF)==manifest['files']['apache-before.conf']
assert c.sha(pathlib.Path(c.HISTORICAL_ROOT_PATH)/'production-receipt.json')==c.HISTORICAL_RECEIPT_SHA
https={}
for path in ['/api/health','/login']:
 result=subprocess.run(['curl','-sS','--max-time','10','-w','\\n%{http_code}','https://lims.yigini.net'+path],capture_output=True,text=True,timeout=12)
 body,_,status=result.stdout.rpartition('\\n');assert result.returncode==0 and status=='200'
 https[path]={'httpStatus':200,'tlsVerified':True}
 if path=='/api/health':
  value=json.loads(body);assert value['status']=='ok' and value['version']=='1.9.0';https[path].update(status=value['status'],version=value['version'])
unauthorized=(root/'final-denied-post.stdout').read_text();assert unauthorized.rstrip().rpartition('\\n')[2]=='401'
free=s.disk_free();required=receipt['preflight']['requiredIncludingBackupBytes'];assert min(free.values())>=required
final=inspect_live();assert final['Id']==live['Id'] and final['State']['Running'] and final['State']['Health']['Status']=='healthy' and final['RestartCount']==0
assert receipt_path.read_bytes()==raw
print(json.dumps({'status':'INDEPENDENT_READ_ONLY_POST_DEPLOY_PASS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'productionMutations':0,'unitState':unit_state,'root':str(root),'head':receipt['head'],'image':live['Image'],'receiptSha256':hashlib.sha256(raw).hexdigest(),'receiptMode':'0o400','completedUtc':receipt['timesUtc']['completed'],'healthObservationElapsedSeconds':elapsed,'healthSampleCount':len(samples),'peakBytes':receipt['peakBytes'],'seals':seals,'https':https,'unauthorizedReceiptPostStatus':401,'restartCount':0,'nodeOptions':'','jobsEnabled':True,'sameVolumes':['lims_lims-data','lims_lims-assets'],'historicalReceiptUnchanged':True,'all41FrozenSourceProofFilesUnchanged':True,'requiredIncludingAllocationBytes':required,'freeBytes':free,'retainedAcceptance':receipt['retainedAcceptance']}))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
        'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True,
        capture_output=True, timeout=120)
    assert result.returncode == 0, result.stderr
    value = json.loads(result.stdout)
    with output.open('xb') as file:
        file.write((json.dumps(value, indent=2) + '\n').encode())
    print(json.dumps(value))


if __name__ == '__main__':
    main()
