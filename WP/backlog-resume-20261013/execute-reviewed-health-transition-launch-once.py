"""One exact newly-approved launcher; never replay an uncertain outcome."""
import datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];S=REPO/'WP/batch-proof-health-transitions-cde8-20261015';D=S/'approved-launch-execution-once';assert not D.exists();D.mkdir()
package=S/'proof-package-workflow-batch-startup-forward-cde8c889-20261015T100000Z';args=[sys.executable,'-X','utf8','-B',str(S/'launch_proof.py'),'--package',str(package)]
(D/'intent.json').write_text(json.dumps({'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'args':args,'sourceHead':'a748b9dc5d3e5309fe3ef2b5cf4a6c5e7d796ef2','sourcePass':6188457144,'neverReplay':True}),encoding='utf-8')
r=subprocess.run(args,cwd=REPO,capture_output=True,timeout=360)
for n,b in [('stdout-original.json',r.stdout),('stderr-original.log',r.stderr)]:
 with (D/n).open('xb') as f:f.write(b)
(D/'exit-original.json').write_text(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'neverReplay':True}),encoding='utf-8')
assert r.returncode==0,'Inspect SAME root/unit and exact original failure; never replay launch'
print(r.stdout.decode())
