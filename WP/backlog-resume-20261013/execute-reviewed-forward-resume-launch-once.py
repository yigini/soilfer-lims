"""Invoke the newly approved080000 launcher once; never replay uncertain outcomes."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015';DEST=SOURCE/'first-proof-080000-launch-wrapper-once'
assert not DEST.exists(),'Consumed launch wrapper';DEST.mkdir()
intent={'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':'b9af37993632ca10b56943ae894fc0a816b8efcc','actualSourcePass':6185240820,'root':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T080000Z','neverReplay':True,'productionDeployment':False}
with (DEST/'launch-intent.json').open('x',encoding='utf-8') as f:f.write(json.dumps(intent,indent=2)+'\n')
args=[sys.executable,'-X','utf8','-B',str(SOURCE/'launch_proof.py'),'--package',str(SOURCE/'proof-package-workflow-batch-stopped-copy-cde8c889-20261015T080000Z')]
try:r=subprocess.run(args,cwd=REPO,capture_output=True,timeout=300)
except subprocess.TimeoutExpired as e:
    with (DEST/'stdout-partial.log').open('xb') as f:f.write(e.stdout or b'')
    with (DEST/'stderr-partial.log').open('xb') as f:f.write(e.stderr or b'')
    with (DEST/'unknown-outcome.json').open('x',encoding='utf-8') as f:f.write(json.dumps({**intent,'status':'UNKNOWN_INSPECT_SAME_ROOT_UNIT_NEVER_REPLAY'})+'\n')
    raise
with (DEST/'stdout-original.json').open('xb') as f:f.write(r.stdout)
with (DEST/'stderr-original.log').open('xb') as f:f.write(r.stderr)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:f.write(json.dumps({**intent,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'proofComplete':False},indent=2)+'\n')
assert r.returncode==0,'Inspect same root/unit; never retry launcher'
print(r.stdout.decode())
