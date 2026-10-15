"""Prepare one newly approved local forward package; no SSH or proof execution."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-forward-resume-cde8-20261015';DEST=SOURCE/'first-proof-080000-package-once'
assert not DEST.exists(),'Consumed package boundary';DEST.mkdir()
intent={'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':'b9af37993632ca10b56943ae894fc0a816b8efcc','actualSourcePass':6185240820,'scope':'LOCAL_APPROVED_FORWARD_PACKAGE_ONLY','neverReplay':True,'productionCopies':0}
with (DEST/'intent.json').open('x',encoding='utf-8') as f:f.write(json.dumps(intent,indent=2)+'\n')
args=[sys.executable,'-X','utf8','-B',str(SOURCE/'prepare_proof.py'),'--tooling-commit',intent['toolingCommit'],'--source-review-id',str(intent['actualSourcePass'])]
r=subprocess.run(args,cwd=REPO,capture_output=True,timeout=180)
with (DEST/'stdout-original.json').open('xb') as f:f.write(r.stdout)
with (DEST/'stderr-original.log').open('xb') as f:f.write(r.stderr)
with (DEST/'exit-original.json').open('x',encoding='utf-8') as f:f.write(json.dumps({**intent,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'productionCopies':0},indent=2)+'\n')
assert r.returncode==0,'Retain original preparation refusal; never replay'
print(r.stdout.decode())
