"""Export exact reviewed raw packaging Git blobs and freeze one original PASS.

Run from the retained flat raw-Git packaging export. Never executes an
installer, build or rehearsal. A refused/failed original cannot feed this kit.
"""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys

from import_source_graph import SOURCE_PATHS, git_source, require_executed_sources
from import_release_contract import *


def main():
    tooling, proof, package, target, review_id = sys.argv[1:]
    safe_root(proof, 'instrument-import-proof-'); safe_root(package, 'instrument-import-package-')
    safe_root(target, 'instrument-import-release-')
    raw, index = git_source(tooling, lambda *args: subprocess.check_output(['git', *args]))
    production_paths = {name: 'WP/pr284-release/' + name for name in PRODUCTION_SOURCE_FILES}
    production_paths['yy-authorization-evidence.md'] = 'WP/forward-ae64f169/yy-authorization-evidence.md'
    for name, path in production_paths.items():
        value = subprocess.check_output(['git', 'ls-tree', tooling, '--', path]).decode().strip()
        metadata, returned = value.split('\t')
        mode, kind, blob = metadata.split()
        require(returned == path and mode in ['100644', '100755'] and kind == 'blob', 'Wrong packaging Git object')
        data = subprocess.check_output(['git', 'cat-file', 'blob', blob])
        require(hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == blob,
            'Raw packaging blob identity differs')
        raw[name] = data
        index['files'][name] = {'path': path, 'blob': blob, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    require(set(raw) == PACKAGE_SOURCE_FILES, 'Exact closed packaging source set required')
    hashes = {name: row['sha256'] for name, row in index['files'].items()}
    # Validate the actual running approval code, never an unbound working-tree
    # contract. This read touches only tooling files, not a production database.
    require_executed_sources({name: hashes[name] for name in SOURCE_FILES},
        pathlib.Path(sys.modules['import_proof_contract'].__file__))
    for name in ['import_release_contract', 'export_freeze_import_kit']:
        path = pathlib.Path(__file__ if name == 'export_freeze_import_kit' else sys.modules[name].__file__)
        require(not path.is_symlink() and sha(path) == hashes[name + '.py'], 'Executed packaging authority changed')
    review_bytes = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/' + review_id])
    review = json.loads(review_bytes)
    production_source_review(review, tooling, hashes)
    comments = json.loads(subprocess.check_output(['gh', 'api',
        'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp']))
    require(not any(has_failed_verdict(row['body'], True) and row['created_at'] > review['created_at']
        for page in comments for row in page), 'Production source approval was superseded')
    require(json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main']))['object']['sha'] ==
        CANDIDATE_HEAD, 'Current application changed before packaging')
    payload = base64.b64encode(json.dumps({'tooling': tooling, 'proof': proof, 'package': package, 'target': target,
        'files': {name: base64.b64encode(data).decode() for name, data in raw.items()}, 'index': index,
        'review': base64.b64encode(review_bytes).decode()}).encode()).decode()
    code = '''import base64,hashlib,json,pathlib,subprocess
p=json.loads(base64.b64decode(PAYLOAD));r=pathlib.Path(p['package']);target=pathlib.Path(p['target'])
assert not r.exists() and not target.exists(),'Never overwrite a package or refreeze a kit'
assert r.parent==target.parent==pathlib.Path('/opt/lims/releases')
r.mkdir(mode=0o700)
for name,encoded in p['files'].items():
 assert pathlib.PurePosixPath(name).name==name
 data=base64.b64decode(encoded);assert hashlib.sha256(data).hexdigest()==p['index']['files'][name]['sha256']
 with (r/name).open('xb') as out:out.write(data)
 (r/name).chmod(0o400)
with (r/'packaging-source-index.json').open('x') as out:json.dump(p['index'],out,indent=2)
(r/'packaging-source-index.json').chmod(0o400)
with (r/'production-baseline-source-review.json').open('xb') as out:out.write(base64.b64decode(p['review']))
(r/'production-baseline-source-review.json').chmod(0o400)
result=subprocess.run(['/usr/bin/python3','-B',str(r/'freeze_import.py'),p['proof'],p['target']],
 text=True,capture_output=True,timeout=300)
for name,data in [('freeze.stdout',result.stdout),('freeze.stderr',result.stderr)]:
 with (r/name).open('x') as out:out.write(data)
print(result.stdout,end='');assert result.returncode==0,result.stderr
'''.replace('PAYLOAD', repr(payload))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=340)
    require(result.returncode == 0, 'New original kit freeze refused: ' + result.stderr)
    print(result.stdout, end='')


if __name__ == '__main__': main()
