"""Capture the new complete-journal retained-only validator once; no host calls."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-api-identity-acc15844-20261015';D=S/'r2-220000-closed-originals-once/complete-validation-run-once';V=R/'WP/backlog-resume-20261013/validate-r2-api220000-complete-journal-once.py'
assert not D.exists();D.mkdir()
def save(n,v):
    with (D/n).open('xb') as f:f.write(v)
args=[sys.executable,'-B',str(V)];save('intent-once.json',(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':args,'sourceSha256':hashlib.sha256(V.read_bytes()).hexdigest(),'hostConnections':0,'neverReplay':True})+'\n').encode())
r=subprocess.run(args,cwd=R,capture_output=True,timeout=120);save('stdout-original.json',r.stdout);save('stderr-original.log',r.stderr);save('exit-original.json',(json.dumps({'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'hostConnections':0})+'\n').encode())
print(r.stdout.decode());print(r.stderr.decode(),file=sys.stderr);raise SystemExit(r.returncode)
