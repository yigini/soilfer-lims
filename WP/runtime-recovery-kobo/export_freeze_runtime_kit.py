"""Export raw Git packaging source and freeze once from a PASSED original proof."""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys
from runtime_release_contract import safe_root, require


def main():
    tooling, proof, package, target = sys.argv[1:]
    require(len(tooling) == 40 and all(char in '0123456789abcdef' for char in tooling), 'Exact packaging commit required')
    safe_root(proof, 'runtime-kobo-proof-'); safe_root(package, 'runtime-kobo-package-'); safe_root(target, 'runtime-kobo-release-')
    paths = {name: 'WP/runtime-recovery-kobo/' + name for name in ['rehearse_runtime.py', 'proof_contract.py',
        'kobo_copy_preservation.py', 'capture_kobo_fetch.py', 'runtime_release_contract.py',
        'deploy_runtime.py', 'freeze_runtime.py', 'collect_runtime_gate.py']}
    paths['known_core_disk_guard.py'] = 'WP/runtime-containment-ae64f169/known_core_disk_guard.py'
    paths.update({name: 'WP/forward-ae64f169/' + name for name in ['release_support.py', 'startup_common.py',
        'postflight-roles.cjs', 'postflight-auth.cjs', 'postflight-reference.cjs', 'postflight-qc-runs.cjs',
        'postflight-policy.cjs', 'readonly-smoke.cjs', 'yy-authorization-evidence.md']})
    files = {}; index = {}
    for name, path in paths.items():
        row = subprocess.check_output(['git', 'ls-tree', tooling, '--', path]).decode().strip()
        mode, kind, blob = row.split('\t')[0].split()
        require(mode in ['100644', '100755'] and kind == 'blob', 'Unexpected packaging source object')
        data = subprocess.check_output(['git', 'cat-file', 'blob', blob])
        require(hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == blob,
            'Raw packaging Git blob differs')
        files[name] = base64.b64encode(data).decode()
        index[name] = {'path': path, 'blob': blob, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    payload = base64.b64encode(json.dumps({'tooling': tooling, 'proof': proof, 'package': package,
        'target': target, 'files': files, 'index': index}).encode()).decode()
    code = '''import base64,hashlib,json,pathlib,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['package']);target=pathlib.Path(p['target'])
assert not r.exists() and not target.exists(),'Never overwrite a package or freeze'
assert r.parent==target.parent==pathlib.Path('/opt/lims/releases')
r.mkdir(mode=0o700)
for name,encoded in p['files'].items():
 assert pathlib.PurePosixPath(name).name==name
 data=base64.b64decode(encoded);assert hashlib.sha256(data).hexdigest()==p['index'][name]['sha256']
 with (r/name).open('xb') as out:out.write(data)
 (r/name).chmod(0o400)
with (r/'packaging-source-index.json').open('x') as out:json.dump({'head':p['tooling'],'files':p['index']},out,indent=2)
(r/'packaging-source-index.json').chmod(0o400)
result=subprocess.run(['/usr/bin/python3','-B',str(r/'freeze_runtime.py'),p['proof'],p['target']],
 text=True,capture_output=True,timeout=300)
for name,data in [('freeze.stdout',result.stdout),('freeze.stderr',result.stderr)]:
 with (r/name).open('x') as out:out.write(data)
print(result.stdout,end='');assert result.returncode==0,result.stderr
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=340)
    require(result.returncode == 0, 'NEW kit freeze refused: ' + result.stderr)
    print(result.stdout, end='')


if __name__ == '__main__':
    main()
