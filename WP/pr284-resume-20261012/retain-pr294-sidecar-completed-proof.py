"""Retain only an actual stopped terminal proof; no replay, database or writer action."""
import base64
import datetime
import hashlib
import importlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
target = directory / 'completed-proof-144000'
assert not target.exists(), 'Never overwrite retained original proof evidence'
sys.path.insert(0, str(directory / 'production-source-export-5fa7e65f'))
release = importlib.import_module('import_release_contract')
names = sorted(set(release.PROOF_ARTIFACTS.values()) | {'unit.stdout', 'unit.stderr',
    'import-dry-container.json', 'import-apply-container.json', 'import-repeat-container.json',
    'import-dry.stdout', 'import-dry.stderr', 'import-apply.stdout', 'import-apply.stderr',
    'import-repeat.stdout', 'import-repeat.stderr', 'candidate-jobs-on-stdout.log', 'candidate-jobs-on-stderr.log'})
code = r'''import base64,datetime,hashlib,json,os,pathlib,subprocess
p=json.loads(PAYLOAD);r=pathlib.Path(p['root']);u='lims-owned-'+r.name.lower()+'.service'
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  while block:=stream.read(1024*1024):h.update(block)
 return h.hexdigest()
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,'-p','ActiveState','-p','SubState','-p','ExecMainStatus','-p','Result'],text=True,timeout=15).splitlines())
assert state['ActiveState'] in ['inactive','failed'],'The SAME proof is still active; leave it alone'
receipt=json.loads((r/'rehearsal-receipt.json').read_bytes())
assert (r/'rehearsal-receipt.json').stat().st_mode&0o777==0o400
source=json.loads((r/'source-index.json').read_bytes())
assert source['head']==p['proofSource'] and {n:row['sha256'] for n,row in source['files'].items()}==p['proofHashes']
assert all(sha(r/n)==row['sha256'] and (r/n).stat().st_mode&0o777==0o400 for n,row in source['files'].items())
assert sha(r/'target-pin.json')==p['pinSha256']
containers=[]
for name in [measurement['containerName'] for measurement in receipt.get('nativeImportInstallation',{}).get('measurements',[])]+['lims-owned-'+r.name.lower()+'-'+suffix for suffix in ['jobs-off','jobs-on']]:
 result=subprocess.run(['docker','inspect',name],text=True,capture_output=True,timeout=15)
 if result.returncode:
  assert receipt['status'].startswith('FAILED'),name+' missing from completed PASS'
  continue
 a=json.loads(result.stdout)[0]
 assert not a['State']['Running'],'An owned proof writer remains active'
 containers.append({'name':name,'image':a['Image'],'state':a['State'],'restartCount':a['RestartCount'],'labels':a['Config']['Labels'],'memoryBytes':a['HostConfig']['Memory'],'memorySwapBytes':a['HostConfig']['MemorySwap'],'networkMode':a['HostConfig']['NetworkMode']})
files={}
for name in p['files']:
 path=r/name
 if not path.exists():
  assert receipt['status'].startswith('FAILED'),'Missing original PASS artifact '+name
  continue
 data=path.read_bytes();files[name]={'data':base64.b64encode(data).decode(),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'mode':oct(path.stat().st_mode&0o777)}
ledger=r/'disk-allocation-observations.jsonl'
assert sha(ledger)==receipt['diskAllocationObservationsSha256']
live=json.loads(subprocess.check_output(['docker','inspect','soilfer-lims'],text=True,timeout=15))[0]
assert live['Image']=='sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f' and live['RestartCount']==0 and live['State']['Health']['Status']=='healthy'
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':u,'unitState':state,'files':files,'containers':containers,'ledger':{'sha256':sha(ledger),'bytes':ledger.stat().st_size},'live':{'image':live['Image'],'restartCount':live['RestartCount'],'healthy':True},'freeBytes':os.statvfs('/opt/lims').f_bavail*os.statvfs('/opt/lims').f_frsize,'productionOperations':0,'sqliteConnections':0}))
'''
payload = {'root': release.EXPECTED_PROOF_ROOT, 'proofSource': release.REVIEWED_PROOF_SOURCE,
    'proofHashes': release.REVIEWED_PROOF_FILES,
    'pinSha256': '241bd693b8cfdb3e9a05440716bd925a620a807bdb371206430a4abc2a9481b1', 'files': names}
code = code.replace('PAYLOAD', repr(json.dumps(payload)))
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37', 'python3', '-B', '-'],
    input=code.encode(), capture_output=True, timeout=120)
assert result.returncode == 0, result.stderr.decode('utf-8', errors='replace')
evidence = json.loads(result.stdout)
raw = {name: base64.b64decode(row['data']) for name, row in evidence['files'].items()}
assert all(hashlib.sha256(value).hexdigest() == evidence['files'][name]['sha256'] for name, value in raw.items())
proof = json.loads(raw['rehearsal-receipt.json'])
pin = json.loads(raw['target-pin.json'])
if proof['status'] == 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF':
    assert evidence['unitState']['ActiveState'] == 'inactive' and evidence['unitState']['ExecMainStatus'] == '0'
    release.validate_proof(proof, pin)
    source = json.loads(raw['source-index.json']); authority = json.loads(raw['candidate-rehearsal-authority.json'])
    release.proof_authority(proof, pin, source, authority, hashlib.sha256(raw['candidate-rehearsal-authority.json']).hexdigest())
target.mkdir()
for name, value in raw.items():
    path = target / name; path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as output: output.write(value)
for row in evidence['files'].values(): row.pop('data')
evidence['retainedUtc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
evidence['actualTerminalStatus'] = proof['status']
with (target / 'retention-index.json').open('x', encoding='utf-8', newline='\n') as output: json.dump(evidence, output, indent=2)
print(json.dumps({'status': proof['status'], 'root': evidence['root'], 'unitState': evidence['unitState'],
    'receiptSha256': evidence['files']['rehearsal-receipt.json']['sha256'], 'retainedFiles': len(raw),
    'measuredTimingHeadroom': proof.get('measuredTimingHeadroom'), 'freeBytes': evidence['freeBytes']}))
