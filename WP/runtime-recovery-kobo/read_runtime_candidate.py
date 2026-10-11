"""Retain exact original build/proof evidence through read-only host access."""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys
from runtime_release_contract import safe_root, require


def main():
    mode, root, unit, output = sys.argv[1:]
    require(mode in ['build', 'proof'], 'Only owned build/proof observations')
    remote = safe_root(root, 'runtime-kobo-' + mode + '-')
    require(unit == ('lims-build-' if mode == 'build' else 'lims-owned-') + remote.name.lower() + '.service',
        'Unexpected owned unit')
    output = pathlib.Path(output); require(not output.exists(), 'Never overwrite retained evidence')
    payload = base64.b64encode(json.dumps({'mode': mode, 'root': root, 'unit': unit}).encode()).decode()
    code = '''import base64,datetime,hashlib,json,pathlib,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root'])
o={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':p['unit'],
 'productionMutations':0,'unitState':subprocess.check_output(['systemctl','show',p['unit'],
 '-p','ActiveState','-p','SubState','-p','ExecMainStatus'],text=True,timeout=15),'files':{}}
names=['build-input.json','build-receipt.json','source-index.json'] if p['mode']=='build' else [
 'rehearsal-receipt.json','target-pin.json','source-index.json','first-sync-preservation.json',
 'second-sync-preservation.json','full-copy-preservation.json','upstream-before-start.json',
 'upstream-first-completion.json','upstream-second-completion.json']
for name in names:
 f=r/name
 if f.exists():
  data=f.read_bytes();o['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
   'mode':oct(f.stat().st_mode&0o777),'base64':base64.b64encode(data).decode()}
for name in ['unit.stdout','unit.stderr']:
 f=r/name
 if f.exists():o[name+'Tail']=f.read_text(errors='replace')[-3500:]
if p['mode']=='build' and (r/'build-receipt.json').exists():
 receipt=json.loads((r/'build-receipt.json').read_bytes())
 image=json.loads(subprocess.check_output(['docker','image','inspect',receipt['image']],text=True,timeout=15))[0]
 o['imageIdentity']={'Id':image['Id'],'Size':image['Size'],'Config':{'Labels':image['Config']['Labels']}}
print(json.dumps(o))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=60)
    require(result.returncode == 0, 'Read-only owned evidence failed: ' + result.stderr)
    value = json.loads(result.stdout); output.mkdir()
    records = {}
    for name, row in value.pop('files').items():
        data = base64.b64decode(row.pop('base64'))
        require(pathlib.PurePosixPath(name).name == name and hashlib.sha256(data).hexdigest() == row['sha256'],
            'Original evidence transport differs')
        (output / name).write_bytes(data); records[name] = row
    value['files'] = records
    (output / 'observation.json').write_text(json.dumps(value, indent=2), encoding='utf-8')
    print(json.dumps(value), flush=True)


if __name__ == '__main__':
    main()
