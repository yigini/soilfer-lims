"""One read-only timing observation; never collect a gate or deploy.

The 180-second local diagnostic transport budget does not change any reviewed
collector, installer, readiness, gate or deployment limit. All reviewed checks
run unchanged. Timing wrappers only emit events around the original calls.
"""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import time

dest = Path(__file__).resolve().parent / 'held-preflight-60s-diagnosis'
dest.mkdir(exist_ok=False)
root = '/opt/lims/releases/instrument-import-release-959d17e1-20261012T202400Z'
manifest_sha = '02d67dede9fd160f723ff1949353b7a36991d41a34e6c255884282ed07da8bad'
code = '''import datetime,json,pathlib,sys,time
root=pathlib.Path(ROOT);sys.path.insert(0,str(root/'frozen'))
import deploy_import as d
started=time.monotonic()
def event(kind,label,**fields):
    print(json.dumps(dict(kind=kind,label=label,elapsedSeconds=time.monotonic()-started,
        observedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),**fields)),flush=True)
def timed(label,original):
    def call(*args,**kwargs):
        before=time.monotonic();event('START',label)
        try:
            result=original(*args,**kwargs)
        except BaseException as exc:
            event('REFUSED',label,durationSeconds=time.monotonic()-before,errorType=type(exc).__name__)
            raise
        event('PASSED',label,durationSeconds=time.monotonic()-before)
        return result
    return call
for name in ['frozen_files','original_proof_files','observe_entry_state','all_writers_stopped','triple_state']:
    setattr(d,name,timed(name,getattr(d,name)))
event('START','execution_preflight',readOnly=True,productionMutations=0,diagnosticOnly=True)
result=d.execution_preflight(root,MANIFEST_SHA,require_unused_gate=True)
event('PASSED','execution_preflight',readiness=result,productionMutations=0,diagnosticOnly=True)
'''.replace('ROOT', repr(root)).replace('MANIFEST_SHA', repr(manifest_sha))
compile(code, '<read-only-preflight-timing>', 'exec')
(dest / 'remote-query.py').write_text(code, encoding='utf-8', newline='\n')
intent = {'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'role': 'READ_ONLY_DIAGNOSTIC_NO_GATE_NO_EXECUTION', 'root': root,
    'manifestSha256': manifest_sha, 'diagnosticTransportLimitSeconds': 180,
    'reviewedCollectorTransportLimitSeconds': 60,
    'priorReadOnlyCall': 'LOCAL_SSH_TIMEOUT_AFTER_60_SECONDS_NO_JSON_RESULT',
    'priorCallRemoteProcessEnded': True, 'productionMutations': 0}
(dest / 'intent.json').write_text(json.dumps(intent, indent=2), encoding='utf-8', newline='\n')
start = time.monotonic()
with (dest / 'stdout.jsonl').open('xb') as out, (dest / 'stderr.txt').open('xb') as err:
    proc = subprocess.Popen(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
        'root@46.19.33.37', 'python3', '-B', '-u', '-'], stdin=subprocess.PIPE, stdout=out, stderr=err)
    proc.stdin.write(code.encode()); proc.stdin.close()
    try:
        rc = proc.wait(timeout=180)
        status = 'COMPLETED_READ_ONLY_DIAGNOSIS' if rc == 0 else 'READ_ONLY_DIAGNOSIS_REFUSED'
    except subprocess.TimeoutExpired:
        proc.kill(); rc = proc.wait(); status = 'READ_ONLY_DIAGNOSTIC_TRANSPORT_TIMEOUT'
result = dict(intent, finishedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    elapsedSeconds=time.monotonic()-start, status=status, exitCode=rc,
    stdoutSha256=hashlib.sha256((dest/'stdout.jsonl').read_bytes()).hexdigest(),
    stderrSha256=hashlib.sha256((dest/'stderr.txt').read_bytes()).hexdigest())
(dest / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8', newline='\n')
print(json.dumps(result), flush=True)
raise SystemExit(0 if rc == 0 else 1)
