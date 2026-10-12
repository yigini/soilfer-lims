"""Fast-forward only the prepared branch, leaving both checkout branches alone."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[2]
parent = 'd1509febd010a12f14adfef147aa7f88c369119a'
base = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
branch = 'codex/native-workbench-import-forward-fix'
path = 'server/tests/contracts/audit_4_7_instrument_import_install.test.js'
def git(*args, env=None, input=None):
    return subprocess.check_output(['git', *args], cwd=repo, env=env, input=input).decode().strip()
assert git('branch', '--show-current') == 'audit/release-eb6de2e8'
assert git('rev-parse', 'refs/heads/' + branch) == parent
assert git('ls-remote', 'origin', 'refs/heads/' + branch).split()[0] == parent
index = Path(tempfile.mkdtemp(prefix='lims-owned-encoding-application-')) / 'index'
env = {**os.environ, 'GIT_INDEX_FILE': str(index)}
git('read-tree', parent, env=env)
blob = git('hash-object', '-w', '--path=' + path, path)
git('update-index', '--cacheinfo', '100644', blob, path, env=env)
tree = git('write-tree', env=env)
assert git('diff', '--name-only', parent, tree).splitlines() == [path]
head = git('commit-tree', tree, '-p', parent,
    input=b'Restore original Unicode preservation strings in native workbench tests\n')
git('update-ref', 'refs/heads/' + branch, head, parent)
changed = git('diff', '--name-only', base, tree).splitlines()
assert len(changed) == 5
record = {'head': head, 'tree': tree, 'parent': parent, 'mergeBase': base,
    'branch': branch, 'changedApplicationFiles': changed,
    'testFileSha256': hashlib.sha256((repo / path).read_bytes()).hexdigest(),
    'newPullRequestCreated': False, 'humanCheckoutUntouched': True, 'productionMutations': 0}
with (repo / 'WP/pr284-resume-20261012/native-workbench-encoding-corrected-head.json').open('x', encoding='utf-8') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps(record))
