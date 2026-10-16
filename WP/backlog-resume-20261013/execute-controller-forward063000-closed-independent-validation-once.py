"""Run new local closed-evidence validation once and retain all command outputs."""
import pathlib,subprocess,json,datetime
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-proof-controller-forward-step2-be837974-20261016';D=S/'controller-forward063000-closed-independent-validation-once'
assert not D.exists();D.mkdir();p=R/'WP/backlog-resume-20261013/validate-controller-forward063000-closed-refusal-once.py'
(D/'validator-source-at-attempt.py').write_bytes(p.read_bytes());args=['python','-B',str(p)]
(D/'command-original.json').write_bytes(json.dumps({'argv':args,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'hostCalls':0,'sqlCalls':0}).encode())
r=subprocess.run(args,cwd=R,capture_output=True,timeout=300)
(D/'stdout-original.log').write_bytes(r.stdout);(D/'stderr-original.log').write_bytes(r.stderr);(D/'exit-original.json').write_bytes(json.dumps({'exitCode':r.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}).encode())
print(r.stdout.decode('utf-8','replace'));print(r.stderr.decode('utf-8','replace'));assert r.returncode==0,'Local validation refused; original bytes retained, no replay'
