"""Collect exactly one gate using unchanged reviewed kit bytes after actual verdict."""
import datetime
import json
from pathlib import Path
import subprocess
import sys

d=Path(__file__).resolve().parent
k=d.parent/'pr284-frozen-kit-20261012T161000Z'
rid=int(sys.argv[1])
v=json.loads((d/('pr294-kit-pass-'+str(rid)+'-verified.json')).read_bytes())
assert v['status']=='ACTUAL_NEW_EXACT_KIT_PASS_VERIFIED_NOT_EXECUTED'
gate=d/'pr294-production-gate-161000.json';assert not gate.exists()
with (d/'pr294-gate-161000-intent.json').open('x',encoding='utf-8',newline='\n') as out:
 json.dump({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewId':rid,'manifestSha256':v['manifestSha256'],'status':'ONE_SINGLE_USE_GATE_COLLECTION_INTENT_NO_RETRY'},out,indent=2)
result=subprocess.run([sys.executable,'-B',str(k/'collect_import_gate.py'),str(k),str(rid),str(gate)],capture_output=True,timeout=300)
for label,data in [('stdout',result.stdout),('stderr',result.stderr)]:
 with (d/('pr294-gate-161000.'+label)).open('xb') as out: out.write(data)
record={'finishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode,'productionOperations':0}
if result.returncode==0:
 record['actualGate']=json.loads(result.stdout);assert record['actualGate']['status']=='FRESH_GATE_CREATED_NOT_EXECUTED'
with (d/'pr294-gate-161000-result.json').open('x',encoding='utf-8',newline='\n') as out: json.dump(record,out,indent=2)
print(json.dumps(record))
if result.returncode: print(result.stderr.decode(errors='replace'),file=sys.stderr)
sys.exit(result.returncode)
