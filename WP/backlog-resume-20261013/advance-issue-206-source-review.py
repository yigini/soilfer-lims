"""Bind the actual Claudio corrections to a source-only successor, without checkout changes."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
prior = '7b893c5f8f43bbbe2af1994d53306b3fd3cb0e34'
ref = 'refs/heads/codex/issue-206-containers'

def git(*args, env=None, payload=None):
    return subprocess.run(['git', *args], cwd=root, env=env, input=payload,
        capture_output=True, check=True).stdout

def value(*args, env=None, payload=None):
    return git(*args, env=env, payload=payload).decode('utf-8').strip()

assert value('branch', '--show-current') == 'audit/release-eb6de2e8'
assert value('rev-parse', ref) == prior
source = value('rev-parse', 'HEAD')
index = evidence / 'issue-206-corrected-review.index'
assert not index.exists(), 'Preserve an existing preparation; do not replay.'
env = dict(os.environ, GIT_INDEX_FILE=str(index))
value('read-tree', prior, env=env)
for path in ['server/app.js', 'server/tests/contracts/audit_4_3_keyboard_playwright.test.js',
             'docs/audit/206-containers-and-aliquots.md']:
    entry = value('ls-tree', source, '--', path)
    mode, kind, remainder = entry.split(' ', 2)
    blob, listed = remainder.split('\t', 1)
    assert kind == 'blob' and listed == path
    value('update-index', '--add', '--cacheinfo', f'{mode},{blob},{path}', env=env)

# Binary stdin is essential on Windows: text-mode subprocess pipes expand LF.
attrs = git('show', base + ':.gitattributes')
assert b'\r' not in attrs and attrs.endswith(b'\n')
additions = (b'server/prisma/migrations/20261013000100_sample_containers/migration.sql text eol=lf\n'
             b'server/services/sampleContainerMigrationSource.js text eol=lf\n')
attrs += additions
blob = value('hash-object', '-w', '--stdin', payload=attrs)
value('update-index', '--add', '--cacheinfo', f'100644,{blob},.gitattributes', env=env)
tree = value('write-tree', env=env)
assert git('show', tree + ':.gitattributes') == attrs
assert git('show', tree + ':server/app.js') == git('show', base + ':server/app.js')
assert value('diff', '--name-only', source, tree, '--', '.', ':!WP', ':!.gitattributes') == ''
paths = value('diff', '--name-only', base, tree).splitlines()
assert len(paths) == 51 and 'server/app.js' not in paths
assert not any(path.startswith('WP/') for path in paths)
head = value('commit-tree', tree, '-p', prior, payload=(
    b'fix(206): correct review byte pins and keep SPA source unchanged\n\n'
    b'Preserve LF in the two added attributes, move the hidden-checkout asset path workaround '
    b'into the owned keyboard fixture, and document physical parentage without kind ordering.\n'))
value('update-ref', ref, head, prior)
record = dict(priorHead=prior, reviewHead=head, reviewTree=tree, auditSource=source,
    base=base, paths=paths, attributesSha256=hashlib.sha256(attrs).hexdigest(),
    attributesCRBytes=0, attributesAddedLines=2, appEqualsMain=True,
    applicationEqualityVerified=True, auditCheckoutUnchanged=True,
    productionMutations=0, newWorktrees=0)
destination = evidence / 'issue-206-corrected-review-ref.json'
assert not destination.exists()
destination.write_bytes((json.dumps(record, indent=2) + '\n').encode())
print(json.dumps(record, indent=2))
