"""Bind the tested item-context reset to a new source-only review head."""
import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
prior = '61d1798524315032da62ca4f51cd08c7611a555a'
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
ref = 'refs/heads/codex/issue-206-containers'
changes = ['client/src/components/workbench/ResultValueActions.jsx',
    'server/tests/contracts/issue_206_container_components.test.js']

def git(*args, env=None, payload=None):
    return subprocess.run(['git', *args], cwd=root, env=env, input=payload,
        capture_output=True, check=True).stdout

def value(*args, env=None, payload=None):
    return git(*args, env=env, payload=payload).decode().strip()

assert value('branch', '--show-current') == 'audit/release-eb6de2e8'
assert value('rev-parse', ref) == prior
source = value('rev-parse', 'HEAD')
assert sorted(value('diff', '--name-only', '01e05ccfa8d469122203218e939e07c0ad688c77', source,
    '--', '.', ':!WP').splitlines()) == sorted(changes)
index = evidence / 'issue-206-context-review.index'
assert not index.exists(), 'Preserve prior preparations; no replay.'
env = dict(os.environ, GIT_INDEX_FILE=str(index))
value('read-tree', prior, env=env)
for path in changes:
    mode, kind, remainder = value('ls-tree', source, '--', path).split(' ', 2)
    blob, listed = remainder.split('\t', 1)
    assert kind == 'blob' and listed == path
    value('update-index', '--add', '--cacheinfo', f'{mode},{blob},{path}', env=env)
tree = value('write-tree', env=env)
assert value('diff', '--name-only', source, tree, '--', '.', ':!WP', ':!.gitattributes') == ''
assert git('show', tree + ':.gitattributes') == git('show', prior + ':.gitattributes')
assert b'\r' not in git('show', tree + ':.gitattributes')
assert git('show', tree + ':server/app.js') == git('show', base + ':server/app.js')
paths = value('diff', '--name-only', base, tree).splitlines()
assert len(paths) == 51 and not any(path.startswith('WP/') for path in paths)
head = value('commit-tree', tree, '-p', prior, payload=(
    b'fix(206): reset dilution aliquot when the work item changes\n\n'
    b'Clear the prior physical selection before acting on another work item. '
    b'Cover the context switch and verify the second repeat omits an unselected aliquot.\n'))
value('update-ref', ref, head, prior)
record = dict(priorHead=prior, reviewHead=head, reviewTree=tree, auditSource=source, base=base,
    paths=paths, changedPaths=changes, attributesCRBytes=0, attributesAddedLines=2,
    appEqualsMain=True, applicationEqualityVerified=True, auditCheckoutUnchanged=True,
    productionMutations=0, newWorktrees=0)
destination = evidence / 'issue-206-context-review-ref.json'
assert not destination.exists()
destination.write_bytes((json.dumps(record, indent=2) + '\n').encode())
print(json.dumps({key: val for key, val in record.items() if key != 'paths'}, indent=2))
