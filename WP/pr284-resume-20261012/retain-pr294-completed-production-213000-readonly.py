"""Retain terminal evidence once; never open live SQLite or mutate the host."""
import base64
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

expected_receipt = sys.argv[1]
assert re.fullmatch('[a-f0-9]{64}', expected_receipt)
d = Path(__file__).resolve().parent
destination = d / 'completed-production-213000'
assert not destination.exists()
payload = r'''import base64,datetime,hashlib,json,pathlib,subprocess,sys
r=pathlib.Path('/opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z')
sys.path.insert(0,str(r/'frozen'))
import import_release_contract as c
u='lims-release-'+r.name.lower()+'.service'
state=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show',u,'-p','ActiveState','-p','SubState','-p','Result','-p','ExecMainStatus'],text=True,timeout=15).splitlines())
assert state['ActiveState']=='inactive' and state['ExecMainStatus']=='0' and state['Result']=='success'
p=r/'production-receipt.json';raw=p.read_bytes();receipt=json.loads(raw)
assert hashlib.sha256(raw).hexdigest()==EXPECTED_RECEIPT and p.stat().st_mode&0o777==0o400 and not p.is_symlink()
assert receipt['status']=='DEPLOYED_NEW_IMPORT_FORWARD' and receipt['head']=='959d17e11c357266f7c2a41b0c84ab76914c591e'
manifest=json.loads((r/'frozen/prepared-manifest.json').read_bytes());c.frozen_files(r,manifest)
assert c.sha(r/'frozen/prepared-manifest.json')=='39b054dbc89889493ac02984675ca72e5fc0da1593706a6abcab450ed481b76e'
names=['production-receipt.json','production-gate.json','execution-attempt.json','instrument-import-attempt.json',
 'import-dry-copy-authority.json','import-install-preservation.json','import-repeat-preservation.json','disk-allocation-observations.jsonl']
for label in ['import-dry','import-apply','import-repeat']:
 names.extend(label+suffix for suffix in ['.stdout','.stderr','-container.json','-retained-inspect.stdout','-retained-inspect.stderr'])
for label in ['production-jobs-off','production-jobs-on']:
 names.extend(label+suffix for suffix in ['-readiness.json','-startup.stdout','-startup.stderr','-memory.stdout','-memory.stderr'])
for label in ['api-postflight','postflight-roles','postflight-auth','postflight-reference','postflight-qc-runs','postflight-policy','readonly-smoke','reopened-health','reopened-login','reopened-denied-post','final-login','final-denied-post']:
 names.extend(label+suffix for suffix in ['.stdout','.stderr'])
for label in ['original-stopped-seal','after-import-stopped','after-repeat-stopped','candidate-jobs-off-seal']:
 names.extend(label+'/'+suffix for suffix in ['sealed-state.json','raw/original-triple.json'])
files={}
for name in names:
 f=r/name;assert f.is_file() and not f.is_symlink()
 value=f.read_bytes();assert len(value)<=16*1024*1024,name
 files[name]={'data':base64.b64encode(value).decode(),'sha256':hashlib.sha256(value).hexdigest(),'bytes':len(value),'remoteMode':oct(f.stat().st_mode&0o777)}
journal=subprocess.check_output(['journalctl','-u',u,'--no-pager','-o','cat'],timeout=15)
files['unit-journal.txt']={'data':base64.b64encode(journal).decode(),'sha256':hashlib.sha256(journal).hexdigest(),'bytes':len(journal)}
assert p.read_bytes()==raw;c.frozen_files(r,manifest)
print(json.dumps({'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':u,'unitState':state,'receiptSha256':EXPECTED_RECEIPT,'status':'ORIGINAL_TERMINAL_EVIDENCE_RETAINED_READ_ONLY','productionMutations':0,'liveSqliteConnections':0,'files':files}))
'''.replace('EXPECTED_RECEIPT', repr(expected_receipt))
result = subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],
    input=payload.encode(), capture_output=True, timeout=120)
assert result.returncode == 0, result.stderr.decode(errors='replace')
record = json.loads(result.stdout)
destination.mkdir()
for name,row in record['files'].items():
    raw = base64.b64decode(row.pop('data'))
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    path = destination / name
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as out:
        out.write(raw)
with (destination/'retention-index.json').open('x',encoding='utf-8',newline='\n') as out:
    json.dump(record,out,indent=2)
print(json.dumps({k:v for k,v in record.items() if k!='files'}))
