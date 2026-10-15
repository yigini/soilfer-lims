"""One exact newly-approved local package; no host operation in this wrapper."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-startup-forward-cde8-20261015';D=S/'approved-package-execution-once';assert not D.exists();D.mkdir()
args=[sys.executable,'-X','utf8','-B',str(S/'prepare_proof.py'),'--tooling-commit','0541865b67af0fbf3232d7cb077ab505896a2ced','--source-review-id','6187743927']
(D/'intent.json').write_text(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'args':args,'neverReplay':True,'hostOperations':0}),encoding='utf-8')
r=subprocess.run(args,cwd=REPO,capture_output=True,timeout=180)
for n,b in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr)]:
 with (D/n).open('xb') as f:f.write(b)
(D/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'neverReplay':True}),encoding='utf-8');assert r.returncode==0,'Inspect same outcome; never replay'
print(r.stdout.decode())
