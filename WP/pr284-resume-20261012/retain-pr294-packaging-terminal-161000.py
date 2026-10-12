"""Retain the completed one-shot package streams and result without host writes."""
import base64
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
payload = r'''import base64,hashlib,json,pathlib
r=pathlib.Path('/opt/lims/releases/instrument-import-package-959d17e1-20261012T161000Z')
rows={}
for n in ['freeze.stdout','freeze.stderr','freeze-result.json']:
 f=r/n; d=f.read_bytes(); assert f.stat().st_mode&0o777==0o400
 rows[n]={'data':base64.b64encode(d).decode(),'sha256':hashlib.sha256(d).hexdigest(),'bytes':len(d),'mode':'0o400'}
j=json.loads(base64.b64decode(rows['freeze-result.json']['data']))
print(json.dumps({'root':str(r),'files':rows,'terminalResult':j}))
'''
result = subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'], input=payload.encode(), capture_output=True, timeout=90)
assert result.returncode==0, result.stderr.decode(errors='replace')
record=json.loads(result.stdout)
target=directory/'packaging-terminal-161000'
assert not target.exists()
target.mkdir()
for n,row in record['files'].items():
 data=base64.b64decode(row.pop('data'))
 assert hashlib.sha256(data).hexdigest()==row['sha256']
 with (target/n).open('xb') as stream: stream.write(data)
record['observedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
record['productionOperations']=0
with (target/'retention-index.json').open('x',encoding='utf-8',newline='\n') as stream: json.dump(record,stream,indent=2)
print(json.dumps(record))
