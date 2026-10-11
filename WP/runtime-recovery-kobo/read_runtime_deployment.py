"""Retain a single forward release's original evidence via read-only access.

This observer never launches, stops, retries, restores, or modifies a host file.
Public requests are GETs; protected POST verification remains in the reviewed
coordinator. A running observation is not a completed deployment verdict.
"""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys

from runtime_release_contract import require, safe_root


def main():
    root, unit, destination = sys.argv[1:]
    remote = safe_root(root, 'runtime-kobo-release-')
    require(unit == 'lims-release-' + remote.name.lower() + '.service', 'Unexpected release unit')
    output = pathlib.Path(destination)
    require(not output.exists(), 'Never overwrite retained release evidence')
    payload = base64.b64encode(json.dumps({'root': root, 'unit': unit}).encode()).decode()
    code = '''import base64,datetime,hashlib,json,pathlib,shutil,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root'])
o={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),
 'unit':p['unit'],'productionMutations':0,'files':{},
 'unitState':subprocess.check_output(['systemctl','show',p['unit'],'-p','ActiveState',
 '-p','SubState','-p','ExecMainStatus'],text=True,timeout=15)}
for name in ['prepared-manifest.json','production-gate.json','execution-attempt.json',
 'production-receipt.json','production-protected-state.json']:
 f=r/name
 if f.exists():
  data=f.read_bytes();o['files'][name]={'bytes':len(data),'mode':oct(f.stat().st_mode&0o777),
   'sha256':hashlib.sha256(data).hexdigest(),'base64':base64.b64encode(data).decode()}
j=subprocess.check_output(['journalctl','-u',p['unit'],'--no-pager','-n','100','-o','short-iso'],
 text=True,timeout=15);o['journalTail']=j
c=json.loads(subprocess.check_output(['docker','inspect','soilfer-lims'],text=True,timeout=15))[0]
env=dict(value.split('=',1) for value in c['Config']['Env'])
image=json.loads(subprocess.check_output(['docker','image','inspect',c['Image']],text=True,timeout=15))[0]
o['live']={'image':c['Image'],'revision':image['Config']['Labels'].get('org.opencontainers.image.revision'),
 'running':c['State']['Running'],'health':c['State'].get('Health',{}).get('Status'),
 'restartCount':c['RestartCount'],'oomKilled':c['State']['OOMKilled'],
 'memoryLimitBytes':c['HostConfig']['Memory'],'nodeOptions':env.get('NODE_OPTIONS',''),
 'jobsDisabled':env.get('DISABLE_BACKGROUND_JOBS'),'autoPush':env.get('ALLOW_PRISMA_DB_PUSH'),
 'autoSeed':env.get('ALLOW_AUTO_SEED'),
 'volumes':[{'destination':m['Destination'],'name':m.get('Name'),'type':m['Type']} for m in c['Mounts']]}
o['freeBytes']=shutil.disk_usage('/opt/lims').free
o['httpsGet']={}
for path in ['/api/health','/login']:
 response=subprocess.run(['curl','-sS','--max-time','10','-w','\\n%{http_code}',
  'https://lims.yigini.net'+path],text=True,capture_output=True,timeout=12)
 body,_,status=response.stdout.rpartition('\\n')
 row={'curlExit':response.returncode,'httpStatus':status}
 if path=='/api/health':
  try:
   health=json.loads(body);row['health']={k:health[k] for k in ['status','version','uptime'] if k in health}
  except ValueError:row['health']=None
 o['httpsGet'][path]=row
print(json.dumps(o))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
        'root@46.19.33.37', 'python3', '-B', '-'], input=code, text=True,
        capture_output=True, timeout=60)
    require(result.returncode == 0, 'Read-only release observation failed: ' + result.stderr)
    value = json.loads(result.stdout)
    output.mkdir()
    records = value.pop('files')
    for name, row in records.items():
        data = base64.b64decode(row.pop('base64'))
        require(pathlib.PurePosixPath(name).name == name and
            hashlib.sha256(data).hexdigest() == row['sha256'], 'Original evidence transport differs')
        (output / name).write_bytes(data)
    value['files'] = records
    (output / 'observation.json').write_bytes((json.dumps(value, indent=2) + '\n').encode())
    print(json.dumps(value), flush=True)


if __name__ == '__main__':
    main()
