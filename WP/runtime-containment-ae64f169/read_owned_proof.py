"""Read-only observation of the one new owned proof; never starts/retries it."""
import base64
import json
import pathlib
import subprocess
import sys

root = sys.argv[1]
path = pathlib.PurePosixPath(root)
if path.parent != pathlib.PurePosixPath('/opt/lims/releases') or not path.name.startswith('runtime-jobs-off-ae64f169-proof-'):
    raise RuntimeError('Unexpected owned proof root')
code = '''import datetime,hashlib,json,pathlib,subprocess
r=pathlib.Path(ROOT)
unit='lims-owned-'+r.name.lower()+'.service'
name='lims-owned-'+r.name.removeprefix('runtime-').lower()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
state=subprocess.check_output(['systemctl','show',unit,'-p','ActiveState','-p','SubState','-p','ExecMainStatus'],text=True)
out={'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(r),'unit':unit,'unitState':dict(line.split('=',1) for line in state.splitlines())}
source=json.loads((r/'source-index.json').read_bytes())
out['sourceCommit']=source['head'];out['sourceIndexSha256']=sha(r/'source-index.json')
out['sourceBytesStillMatch']=all(sha(r/n)==v['sha256'] for n,v in source['files'].items())
out['sourceModes0400']=all((r/n).stat().st_mode&0o777==0o400 for n in source['files'])
p=subprocess.run(['docker','inspect',name],text=True,capture_output=True,timeout=15)
if p.returncode==0:
 c=json.loads(p.stdout)[0];e=dict(v.split('=',1) for v in c['Config']['Env'])
 out['container']={'name':name,'image':c['Image'],'running':c['State']['Running'],'health':c['State'].get('Health',{}).get('Status'),'oomKilled':c['State']['OOMKilled'],'restartCount':c['RestartCount'],'memoryLimitBytes':c['HostConfig']['Memory'],'nodeOptions':e.get('NODE_OPTIONS'),'jobsDisabled':e.get('DISABLE_BACKGROUND_JOBS'),'bindMounts':[{'destination':m['Destination'],'type':m['Type'],'source':m['Source']} for m in c['Mounts']]}
for n in ['owned-jobs-off-readiness.json','rehearsal-receipt.json']:
 p=r/n
 if p.exists():
  v=json.loads(p.read_bytes());out[n]={'sha256':sha(p),'mode':oct(p.stat().st_mode&0o777),'status':v.get('status'),'readyUtc':v.get('readyUtc'),'completedUtc':v.get('completedUtc'),'failedUtc':v.get('failedUtc'),'error':v.get('error'),'peakBytes':v.get('peakBytes'),'databaseChanges':v.get('databaseChanges'),'baselineEnumerationErrorCount':v.get('baselineEnumerationErrorCount'),'ownedWriterStopped':v.get('ownedWriterStopped'),'soakElapsedSeconds':v.get('soakElapsedSeconds')}
lines=(r/'unit.stdout').read_text().splitlines() if (r/'unit.stdout').exists() else []
out['lastProgress']=[json.loads(line) for line in lines if line.startswith('{')][-3:]
out['stderrTail']=(r/'unit.stderr').read_text().splitlines()[-8:] if (r/'unit.stderr').exists() else []
print(json.dumps(out))
'''.replace('ROOT', repr(root))
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
    'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=40)
if result.returncode:
    raise RuntimeError('Read-only observation failed: ' + result.stderr)
print(result.stdout, end='')
