"""Retain the original failed proof evidence without opening a database."""
import base64
import hashlib
import json
import pathlib
import subprocess

ROOT = '/opt/lims/releases/instrument-import-proof-5dd5488d-20261012T105200Z'
NAMES = ['rehearsal-receipt.json', 'import-dry.stderr', 'import-dry.stdout',
    'import-dry-container.json', 'candidate-rehearsal-authority.json',
    'target-pin.json', 'source-index.json', 'disk-allocation-observations.jsonl']

def main():
    destination = pathlib.Path(__file__).resolve().parent / 'failed-proof-105200'
    destination.mkdir(exist_ok=False)
    code = '''import base64,hashlib,json,pathlib,subprocess
r=pathlib.Path(ROOT)
assert r.is_dir() and not r.is_symlink()
files={}
for name in NAMES:
 p=r/name
 assert p.is_file() and not p.is_symlink()
 b=p.read_bytes()
 assert p.stat().st_mode&0o777==0o400
 files[name]={'base64':base64.b64encode(b).decode(),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'mode':'0400'}
m=json.loads((r/'import-dry-container.json').read_bytes())
c=json.loads(subprocess.check_output(['docker','inspect',m['containerName']],text=True,timeout=15))[0]
state=json.loads((r/'fresh-protected-state.json').read_bytes())
print(json.dumps({'files':files,'container':c,'protectedState':state,'rootFileNames':[p.name for p in r.iterdir()]}))
'''.replace('ROOT', repr(ROOT)).replace('NAMES', repr(NAMES))
    result = subprocess.run(['ssh','-o','BatchMode=yes','root@46.19.33.37','python3','-B','-'],
        input=code,text=True,encoding='utf-8',capture_output=True,timeout=60)
    assert result.returncode == 0, result.stderr
    value = json.loads(result.stdout)
    for name,row in value['files'].items():
        raw=base64.b64decode(row.pop('base64'))
        assert hashlib.sha256(raw).hexdigest()==row['sha256']
        with (destination/name).open('xb') as stream: stream.write(raw)
    for name,key in [('retained-cli-inspect.json','container'),('fresh-protected-state.json','protectedState')]:
        with (destination/name).open('xb') as stream:
            stream.write((json.dumps(value.pop(key),indent=2)+'\n').encode())
    with (destination/'retention-index.json').open('xb') as stream:
        stream.write((json.dumps(value,indent=2)+'\n').encode())
    print(json.dumps({'destination':str(destination),'files':value['files'],'rootFileNames':value['rootFileNames']}))

if __name__=='__main__': main()
