"""One read-only source-review reference. No root creation, SQLite, or proof."""
import datetime,json,pathlib,subprocess,sys
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/batch-proof-jobs-intake-be837974-20261016'
D=B/'fresh-r4-unused-root-reference-once';assert not D.exists();D.mkdir()
sys.path.insert(0,str(B))
from proof_contract import *
from proof_budget import capacity_probe_source,capacity_gate
cap=capacity_probe_source(PRIOR_RAW_DATA,PRIOR_RAW_ASSETS,PRIOR_BACKUP,'RUNTIME_BIND',0)
program=('import pathlib,subprocess,json,io,contextlib\nroot=pathlib.Path('+repr(str(ROOT))+')\n'
    "for p in [root,*root.parents]:assert not p.is_symlink()\n"
    "assert not root.exists(),'Reference root already consumed'\n"
    "u=subprocess.run(['systemctl','show',"+repr('lims-'+ROOT_NAME.lower())+",'--property=LoadState','--value'],capture_output=True,timeout=15)\n"
    "assert u.returncode==0 and u.stdout.strip()==b'not-found' and not u.stderr\n"
    "buf=io.StringIO()\nwith contextlib.redirect_stdout(buf):exec(compile("+repr(cap.decode())+",'capacity-reference-only','exec'),{})\n"
    "v=json.loads(buf.getvalue());v.update({'referenceOnlyNotLaunchAuthority':True,'proposedRoot':str(root),'rootAbsent':True,'unitLoadState':'not-found','sourceFilesWritten':0,'proofOperators':0});print(json.dumps(v))\n").encode()
compile(program,'readonly-reference','exec');(D/'remote-readonly-source.py').write_bytes(program)
(D/'helper-source-at-attempt.py').write_bytes(pathlib.Path(__file__).read_bytes())
result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=W,input=program,capture_output=True,timeout=60)
for n,b in [('stdout-original.json',result.stdout),('stderr-original.log',result.stderr)]:(D/n).write_bytes(b)
(D/'exit-original.json').write_bytes(canonical({'exitCode':result.returncode,'closedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'referenceOnly':True})+b'\n')
assert result.returncode==0
v=exact_json(result.stdout);capacity_gate(v,'RUNTIME_BIND',0)
print(json.dumps({k:v[k] for k in ['observedUtc','requiredBytes','freeBytes','dbEquivalents','databaseReserveBytes','assetReserveBytes','rootAbsent','unitLoadState','referenceOnlyNotLaunchAuthority']},ensure_ascii=True))
