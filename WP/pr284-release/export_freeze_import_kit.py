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

# Six read-only stages measured 253.819322 seconds on the original stopped
# backups. Round (2 * measured + 300 seconds unmeasured overhead) up to five
# minutes. This is packaging time only, never an installer/readiness limit.
PACKAGING_READ_ONLY_TIMEOUT_SECONDS = 900
PACKAGING_SSH_TIMEOUT_SECONDS = PACKAGING_READ_ONLY_TIMEOUT_SECONDS + 60

# This exact source runs remotely. Logs exist before validation starts, so a
# refusal/deadline retains the last completed stage without retrying anything.
FREEZER_RUNNER = '''def run_freezer(command, root, deadline):
 start=time.monotonic();timed_out=False;returncode=None
 with (root/'freeze.stdout').open('xb') as stdout,(root/'freeze.stderr').open('xb') as stderr:
  try:
   result=subprocess.run(command,stdout=stdout,stderr=stderr,timeout=deadline)
   returncode=result.returncode
  except subprocess.TimeoutExpired:
   timed_out=True
 for name in ['freeze.stdout','freeze.stderr']:(root/name).chmod(0o400)
 record={'status':'TIMED_OUT' if timed_out else ('PASSED' if returncode==0 else 'REFUSED'),
  'returncode':returncode,'timeoutSeconds':deadline,'elapsedSeconds':time.monotonic()-start,
  'attemptCount':1,'retried':False}
 with (root/'freeze-result.json').open('x') as out:json.dump(record,out,indent=2)
 (root/'freeze-result.json').chmod(0o400)
 print((root/'freeze.stdout').read_text(),end='',flush=True)
 if timed_out:raise RuntimeError('Read-only packaging deadline; stopped child, retained logs, never retry')
 if returncode!=0:raise RuntimeError('Read-only packaging refused: '+(root/'freeze.stderr').read_text())
 return record
'''


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
    code = 'import base64,hashlib,json,pathlib,subprocess,time\n' + FREEZER_RUNNER + '''
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
run_freezer(['/usr/bin/python3','-B',str(r/'freeze_import.py'),p['proof'],p['target']],r,READ_ONLY_DEADLINE)
'''.replace('PAYLOAD', repr(payload)).replace('READ_ONLY_DEADLINE', str(PACKAGING_READ_ONLY_TIMEOUT_SECONDS))
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'root@46.19.33.37',
        'python3', '-B', '-'], input=code, text=True, capture_output=True, timeout=PACKAGING_SSH_TIMEOUT_SECONDS)
    print(result.stdout, end='')
    require(result.returncode == 0, 'New original kit freeze refused: ' + result.stderr)


if __name__ == '__main__': main()
