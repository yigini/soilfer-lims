"""Launch once only after actual proof, frozen-kit PASS and fresh unused gate."""
import base64
import json
import subprocess
import sys
from import_release_contract import safe_root, require

# The same complete physical preflight precedes dispatch. Allow its bounded
# 180 s transport budget, the unchanged 20 s systemd dispatch, and 10 s overhead.
# The remote production unit still has its independently enforced 5400 s limit.
LAUNCH_TRANSPORT_TIMEOUT_SECONDS = 210


def main():
    root, unit = sys.argv[1:]
    path = safe_root(root, 'instrument-import-release-')
    require(unit == 'lims-release-' + path.name.lower() + '.service', 'Unexpected single owned production unit')
    payload = base64.b64encode(json.dumps({'root': root, 'unit': unit}).encode()).decode()
    code = '''import base64,hashlib,json,pathlib,subprocess,sys
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['root']);sys.path.insert(0,str(r/'frozen'))
from deploy_import import execution_preflight
from import_release_contract import verify_gate,verify_entry_readiness
m=json.loads((r/'frozen'/'prepared-manifest.json').read_bytes());g=json.loads((r/'production-gate.json').read_bytes())
digest=hashlib.sha256((r/'frozen'/'prepared-manifest.json').read_bytes()).hexdigest()
actual=execution_preflight(r,digest);verify_gate(m,g,digest);verify_entry_readiness(m,g,actual)
assert (r/'production-gate.json').stat().st_mode&0o777==0o400
result=subprocess.run(['systemd-run','--unit='+p['unit'],'--property=Type=exec','--property=RuntimeMaxSec=5400',
 '--property=KillMode=process','--property=StandardOutput=journal',
 '--property=StandardError=journal','/usr/bin/python3','-B',str(r/'frozen'/'deploy_import.py'),
 '--execute-new-reviewed-import-gate'],text=True,capture_output=True,timeout=20)
assert result.returncode==0,result.stderr
print(json.dumps({'root':str(r),'unit':p['unit'],'head':m['head'],'image':m['image'],
 'manifestSha256':digest,'gateSha256':hashlib.sha256((r/'production-gate.json').read_bytes()).hexdigest(),
 'status':'SINGLE_NEW_RELEASE_LAUNCHED_NOT_YET_DEPLOYED'}))
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True,
        timeout=LAUNCH_TRANSPORT_TIMEOUT_SECONDS)
    require(result.returncode == 0, 'Single NEW production launch refused: ' + result.stderr)
    print(result.stdout, end='')


if __name__ == '__main__':
    main()
