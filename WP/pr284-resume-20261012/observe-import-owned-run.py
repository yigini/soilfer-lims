"""Read an owned import unit and retained files; never start/stop a writer."""
import base64
import json
import pathlib
import re
import subprocess
import sys


def main():
    root, unit, destination = sys.argv[1:]
    remote = pathlib.PurePosixPath(root)
    assert remote.parent == pathlib.PurePosixPath('/opt/lims/releases')
    assert re.fullmatch(r'instrument-import-(build|proof|release)-[A-Za-z0-9_-]+', remote.name)
    phase = remote.name.split('-')[2]
    prefix = {'build': 'lims-build-', 'proof': 'lims-owned-', 'release': 'lims-release-'}[phase]
    assert unit == prefix + remote.name.lower() + '.service'
    output = pathlib.Path(destination)
    assert not output.exists(), 'Never overwrite an observation'
    payload = base64.b64encode(json.dumps({'root': root, 'unit': unit, 'phase': phase}).encode()).decode()
    code = '''import base64,datetime,hashlib,json,pathlib,shutil,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root'])
assert r.is_dir() and not r.is_symlink()
state=subprocess.check_output(['systemctl','show',p['unit'],'-p','ActiveState','-p','SubState','-p','ExecMainStatus','-p','Result'],text=True,timeout=15)
files={}
for name in ['build-receipt.json','rehearsal-receipt.json','production-receipt.json','target-pin.json','build-input.json','source-index.json','tooling-source-index.json','disk-allocation-observations.jsonl']:
 f=r/name
 if f.exists():
  assert f.is_file() and not f.is_symlink()
  raw=f.read_bytes();row={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':oct(f.stat().st_mode&0o777)}
  if name.endswith('-receipt.json'):row['receipt']=json.loads(raw)
  files[name]=row
tails={}
for name in ['unit.stdout','unit.stderr','docker-build.log']:
 f=r/name
 if f.exists():
  assert f.is_file() and not f.is_symlink()
  with f.open('rb') as stream:
   stream.seek(max(0,f.stat().st_size-6000));tails[name]=stream.read().decode('utf-8',errors='replace')
names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True,timeout=15).splitlines()
owned=[n for n in names if n.startswith('lims-owned-'+r.name.lower()+'-')]
containers=[]
if owned:
 for c in json.loads(subprocess.check_output(['docker','inspect',*owned],text=True,timeout=15)):
  containers.append({'name':c['Name'],'image':c['Image'],'running':c['State']['Running'],'status':c['State']['Status'],'health':c['State'].get('Health',{}).get('Status'),'exitCode':c['State']['ExitCode'],'oomKilled':c['State']['OOMKilled'],'restartCount':c['RestartCount'],'memoryLimitBytes':c['HostConfig']['Memory']})
print(json.dumps({'status':'READ_ONLY_OWNED_RUN_OBSERVATION','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':p['unit'],'unitState':state,'files':files,'tails':tails,'containers':containers,'freeBytes':{v:shutil.disk_usage(v).free for v in ['/opt/lims','/var/lib/docker']},'productionMutations':0}))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
        'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True,
        encoding='utf-8', capture_output=True, timeout=45)
    assert result.returncode == 0, result.stderr
    value = json.loads(result.stdout)
    with output.open('xb') as stream:
        stream.write((json.dumps(value, indent=2) + '\n').encode())
    print(json.dumps({key: value[key] for key in ['observedUtc', 'root', 'unit', 'unitState', 'containers', 'freeBytes']}))
    print(json.dumps({'receipts': {name: {'sha256': row['sha256'], 'mode': row['mode'],
        'status': row['receipt']['status']} for name, row in value['files'].items() if 'receipt' in row},
        'tails': value['tails']}))


if __name__ == '__main__':
    main()
