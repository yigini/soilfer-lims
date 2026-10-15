"""Invoke the approved one-use launcher once; retain original outcome, never retry."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-noop-identity-cde8-20261015';DEST=SOURCE/'first-proof-050000-launch-wrapper-once'
assert not DEST.exists();DEST.mkdir()
intent={'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':'09d7e537d90bc8ed17e9d162fd6868a7c34a8e15','actualSourcePass':6183890910,'root':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T050000Z','neverReplay':True,'productionDeployment':False}
(DEST/'launch-intent.json').write_text(json.dumps(intent,indent=2)+'\n',encoding='utf-8')
args=[sys.executable,'-X','utf8','-B',str(SOURCE/'launch_proof.py'),'--package',str(SOURCE/'proof-package-workflow-batch-stopped-copy-cde8c889-20261015T050000Z')]
try:r=subprocess.run(args,cwd=REPO,capture_output=True,timeout=300)
except subprocess.TimeoutExpired as e:
    (DEST/'stdout-partial.log').write_bytes(e.stdout or b'');(DEST/'stderr-partial.log').write_bytes(e.stderr or b'');(DEST/'unknown-outcome.json').write_text(json.dumps({**intent,'status':'UNKNOWN_INSPECT_SAME_ROOT_UNIT_NEVER_REPLAY'})+'\n');raise
(DEST/'stdout-original.json').write_bytes(r.stdout);(DEST/'stderr-original.log').write_bytes(r.stderr)
(DEST/'exit-original.json').write_text(json.dumps({**intent,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'proofComplete':False},indent=2)+'\n',encoding='utf-8')
assert r.returncode==0,'Inspect same root/unit; never retry launcher';print(r.stdout.decode())
