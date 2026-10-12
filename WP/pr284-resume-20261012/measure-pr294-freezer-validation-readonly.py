"""Measure retained immutable backup validators; never invoke the freezer."""
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
prefix = directory / 'pr294-packaging-readonly-measurement-1600'
code = r'''import datetime,hashlib,json,pathlib,stat,sys,time
proof=pathlib.Path('/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z')
sys.path.insert(0,str(proof))
import startup_common as c
from import_preservation import verify_import_installation
from kobo_copy_preservation import verify_copy
from import_proof_contract import expected_refusals,TARGET_CONFIG
import sqlite3,contextlib
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  while block:=stream.read(1024*1024):h.update(block)
 return h.hexdigest()
receipt_sha=sha(proof/'rehearsal-receipt.json')
assert receipt_sha=='f2aff1624aa6b11abeca36374ffe45fc3b06c9ab78727b48b877512ba9f2fbce'
receipt=json.loads((proof/'rehearsal-receipt.json').read_bytes())
assert receipt['status']=='PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF'
for name,row in json.loads((proof/'source-index.json').read_bytes())['files'].items():
 assert sha(proof/name)==row['sha256']
original=proof/'fresh-live-backup.db';installed=proof/'after-import-stopped/dev-stopped-backup.db'
repeat=proof/'after-repeat-stopped/dev-stopped-backup.db';first=proof/'after-first-sync.db'
final=proof/'after-second-stopped/dev-stopped-backup.db'
paths=[original,installed,repeat,first,final,proof/'after-jobs-off-stopped/dev-stopped-backup.db']
before={str(p):{'sha256':sha(p),'bytes':p.stat().st_size,'mode':stat.S_IMODE(p.stat().st_mode),'mtimeNs':p.stat().st_mtime_ns} for p in paths}
assert all(row['mode']==0o400 for row in before.values())
with contextlib.closing(sqlite3.connect(original.as_uri()+'?mode=ro&immutable=1',uri=True)) as db:
 db.row_factory=sqlite3.Row
 refusals=expected_refusals([dict(r) for r in db.execute('SELECT id,labId,projectCode,isActive FROM KoboConfig')],
  [dict(r) for r in db.execute('SELECT id,code,name,isActive FROM Lab')],[dict(r) for r in db.execute('SELECT code FROM Project')])
refusal_ids=[r['configId'] for r in refusals]
first_ids={k:r['submissionIds'] for k,r in json.loads((proof/'upstream-first-completion.json').read_bytes()).items()}
final_ids={k:r['submissionIds'] for k,r in json.loads((proof/'upstream-second-completion.json').read_bytes()).items()}
measurements=[];started=time.monotonic()
def stage(name,operation):
 start=time.monotonic();print(json.dumps({'event':'START','stage':name,'elapsedSeconds':start-started}),flush=True)
 operation();elapsed=time.monotonic()-start;measurements.append({'stage':name,'elapsedSeconds':elapsed})
 print(json.dumps({'event':'PASSED','stage':name,'elapsedSeconds':elapsed,'totalElapsedSeconds':time.monotonic()-started}),flush=True)
def equal(actual,path):assert actual==json.loads(path.read_bytes()),str(path)
stage('native-installation-full104-original-rows',lambda:equal(verify_import_installation(original,installed,proof,
 receipt['nativeImportInstallation']['originalRowsSha256']),proof/'import-install-preservation.json'))
stage('repeat-full106-table-state',lambda:c.exact_state(repeat,json.loads((proof/'installed-protected-state.json').read_bytes()),immutable=True))
stage('first-natural-full106-preservation',lambda:equal(verify_copy(installed,first,expected_table_count=106,
 fetched_ids=first_ids,refusal_configs=refusal_ids),proof/'first-sync-preservation.json'))
stage('second-natural-full106-preservation',lambda:equal(verify_copy(first,final,expected_table_count=106,
 prior_fetched_ids=receipt['priorFetchedIds'],fetched_ids=final_ids,refusal_configs=refusal_ids),proof/'second-sync-preservation.json'))
stage('full-installed-to-final106-preservation',lambda:equal(verify_copy(installed,final,expected_table_count=106,
 fetched_ids=final_ids,refusal_configs=refusal_ids),proof/'full-copy-preservation.json'))
def rehash():
 after={str(p):{'sha256':sha(p),'bytes':p.stat().st_size,'mode':stat.S_IMODE(p.stat().st_mode),'mtimeNs':p.stat().st_mtime_ns} for p in paths}
 assert after==before and sha(proof/'rehearsal-receipt.json')==receipt_sha
stage('six-original-backup-hashes-and-attributes',rehash)
print(json.dumps({'status':'READ_ONLY_PACKAGING_VALIDATOR_TIMING_PASS','completedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'proofRoot':str(proof),'receiptSha256':receipt_sha,'stages':measurements,'measuredSeconds':sum(r['elapsedSeconds'] for r in measurements),
 'allOriginalBackupBytesModesAttributesPreserved':True,'freezerInvocations':0,'newProofs':0,'productionOperations':0}),flush=True)
'''
with prefix.with_suffix('.intent.json').open('x', encoding='utf-8') as out:
    json.dump({'status': 'READ_ONLY_VALIDATION_MEASUREMENT_NO_FREEZER', 'deadlineSeconds': 1800,
               'codeSha256': hashlib.sha256(code.encode()).hexdigest()}, out)
with prefix.with_suffix('.stdout.log').open('xb') as stdout, prefix.with_suffix('.stderr.log').open('xb') as stderr:
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
                             'python3', '-B', '-'], input=code.encode(), stdout=stdout, stderr=stderr, timeout=1800)
assert result.returncode == 0, prefix.with_suffix('.stderr.log').read_text()
value = json.loads(prefix.with_suffix('.stdout.log').read_text().splitlines()[-1])
assert value['status'] == 'READ_ONLY_PACKAGING_VALIDATOR_TIMING_PASS'
with prefix.with_suffix('.result.json').open('x', encoding='utf-8') as out: json.dump(value, out, indent=2)
print(json.dumps(value))
