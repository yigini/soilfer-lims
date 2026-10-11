"""Launch one NEW isolated proof from reviewed raw Git source. No live mode."""
import base64, hashlib, json, pathlib, subprocess, sys

head, root, unit = sys.argv[1:]
assert len(head) == 40 and all(c in '0123456789abcdef' for c in head)
remote = pathlib.PurePosixPath(root)
assert remote.parent == pathlib.PurePosixPath('/opt/lims/releases')
assert remote.name.startswith('runtime-jobs-off-ae64f169-proof-')
assert unit == 'lims-owned-' + remote.name.lower() + '.service'
paths = {
    'rehearse_jobs_hold.py': 'WP/runtime-containment-ae64f169/rehearse_jobs_hold.py',
    'known_core_disk_guard.py': 'WP/runtime-containment-ae64f169/known_core_disk_guard.py',
    'release_support.py': 'WP/forward-ae64f169/release_support.py',
    'startup_common.py': 'WP/forward-ae64f169/startup_common.py',
}
for name in ['postflight-roles.cjs', 'postflight-auth.cjs', 'postflight-reference.cjs',
    'postflight-qc-runs.cjs', 'postflight-policy.cjs', 'readonly-smoke.cjs']:
    paths[name] = 'WP/forward-ae64f169/' + name
files, index = {}, {}
for name, git_path in paths.items():
    row = subprocess.check_output(['git', 'ls-tree', head, '--', git_path]).decode().strip()
    mode, kind, blob = row.split('\t')[0].split()
    assert mode in ['100644', '100755'] and kind == 'blob'
    data = subprocess.check_output(['git', 'cat-file', 'blob', blob])
    assert hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == blob
    files[name] = base64.b64encode(data).decode()
    index[name] = {'path': git_path, 'blob': blob, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
payload = base64.b64encode(json.dumps({'root':root, 'unit':unit, 'files':files,
    'index':{'head':head, 'files':index}}).encode()).decode()
code = """import base64,hashlib,json,pathlib,subprocess
p=json.loads(base64.b64decode(PAYLOAD))
r=pathlib.Path(p['root']);u=p['unit']
assert r.parent.resolve()==pathlib.Path('/opt/lims/releases').resolve() and not r.exists()
names=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines()
assert not any(n.startswith('lims-owned-') for n in names), 'Another owned proof is active'
r.mkdir(mode=0o700)
for name,encoded in p['files'].items():
 assert pathlib.PurePosixPath(name).name==name
 data=base64.b64decode(encoded);assert hashlib.sha256(data).hexdigest()==p['index']['files'][name]['sha256']
 with (r/name).open('xb') as f:f.write(data)
 (r/name).chmod(0o400)
with (r/'source-index.json').open('x',encoding='utf-8') as f:json.dump(p['index'],f,indent=2)
(r/'source-index.json').chmod(0o400)
args=['systemd-run','--unit='+u,'--property=Type=exec','--property=RuntimeMaxSec=1500',
 '--property=KillMode=process','--property=StandardOutput=append:'+str(r/'unit.stdout'),
 '--property=StandardError=append:'+str(r/'unit.stderr'),'/usr/bin/python3','-B',
 str(r/'rehearse_jobs_hold.py'),'--new-owned-proof']
result=subprocess.run(args,text=True,capture_output=True,timeout=20)
assert result.returncode==0,result.stderr
print(json.dumps({'root':str(r),'unit':u,'sourceCommit':p['index']['head'],
 'sourceIndexSha256':hashlib.sha256((r/'source-index.json').read_bytes()).hexdigest(),
 'coordinatorSha256':p['index']['files']['rehearse_jobs_hold.py']['sha256'],
 'diskGuardSha256':p['index']['files']['known_core_disk_guard.py']['sha256'],
 'productionMutations':0}))
""".replace('PAYLOAD', repr(payload))
result = subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37',
    'python3','-B','-'], input=code, text=True, capture_output=True, timeout=40)
assert result.returncode == 0, result.stderr
print(result.stdout, end='')
