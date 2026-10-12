"""ONE production unit through the unchanged reviewed launcher after fresh gate."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

d=Path(__file__).resolve().parent
k=d.parent/'pr284-frozen-kit-20261012T161000Z'
g=json.loads((d/'pr294-gate-161000-result.json').read_bytes())
assert g['exitCode']==0 and g['actualGate']['status']=='FRESH_GATE_CREATED_NOT_EXECUTED'
raw=(d/'pr294-production-gate-161000.json').read_bytes();assert hashlib.sha256(raw).hexdigest()==g['actualGate']['gateSha256']
gate=json.loads(raw);assert 0<=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(gate['verifiedUtc'])).total_seconds()<=600
root='/opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z'
unit='lims-release-instrument-import-release-959d17e1-20261012t161000z.service'
with (d/'pr294-production-launch-161000-intent.json').open('x',encoding='utf-8',newline='\n') as out:
 json.dump({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':root,'unit':unit,'gateSha256':g['actualGate']['gateSha256'],'status':'ONE_REVIEWED_FORWARD_LAUNCH_INTENT_NEVER_REPLAY'},out,indent=2)
result=subprocess.run([sys.executable,'-B',str(k/'launch_import_release.py'),root,unit],capture_output=True,timeout=120)
for label,data in [('stdout',result.stdout),('stderr',result.stderr)]:
 with (d/('pr294-production-launch-161000.'+label)).open('xb') as out: out.write(data)
record={'finishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode}
if result.returncode==0:
 record['actualLaunch']=json.loads(result.stdout);assert record['actualLaunch']['status']=='SINGLE_NEW_RELEASE_LAUNCHED_NOT_YET_DEPLOYED'
with (d/'pr294-production-launch-161000-result.json').open('x',encoding='utf-8',newline='\n') as out: json.dump(record,out,indent=2)
print(json.dumps(record))
if result.returncode: print(result.stderr.decode(errors='replace'),file=sys.stderr)
sys.exit(result.returncode)
