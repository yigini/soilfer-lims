"""Invoke the approved one-use launcher once; retain original outcome, never retry."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-name-inventory-cde8-20261015';DEST=SOURCE/'first-proof-060000-launch-wrapper-once'
assert not DEST.exists();DEST.mkdir()
intent={'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':'624aab7b9219bc7b9986396ce63915c91ad80502','actualSourcePass':6184203154,'root':'/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T060000Z','neverReplay':True,'productionDeployment':False}
(DEST/'launch-intent.json').write_text(json.dumps(intent,indent=2)+'\n',encoding='utf-8')
args=[sys.executable,'-X','utf8','-B',str(SOURCE/'launch_proof.py'),'--package',str(SOURCE/'proof-package-workflow-batch-stopped-copy-cde8c889-20261015T060000Z')]
try:r=subprocess.run(args,cwd=REPO,capture_output=True,timeout=300)
except subprocess.TimeoutExpired as e:
    (DEST/'stdout-partial.log').write_bytes(e.stdout or b'');(DEST/'stderr-partial.log').write_bytes(e.stderr or b'');(DEST/'unknown-outcome.json').write_text(json.dumps({**intent,'status':'UNKNOWN_INSPECT_SAME_ROOT_UNIT_NEVER_REPLAY'})+'\n');raise
(DEST/'stdout-original.json').write_bytes(r.stdout);(DEST/'stderr-original.log').write_bytes(r.stderr)
(DEST/'exit-original.json').write_text(json.dumps({**intent,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'proofComplete':False},indent=2)+'\n',encoding='utf-8')
assert r.returncode==0,'Inspect same root/unit; never retry launcher';print(r.stdout.decode())
