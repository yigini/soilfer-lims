"""Prepare a source-only review commit while keeping the audit checkout in place."""
import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
review_ref = 'refs/heads/codex/issue-206-containers'
source_base = '2f10acf1ae6ddd87067ffea96d9f23437aebd96f'
paths = json.loads((evidence / 'issue-206-source-paths.json').read_text(encoding='utf-8'))

def git(*args, env=None, input=None):
    return subprocess.run(['git', *args], cwd=root, env=env, input=input,
        text=True, encoding='utf-8', capture_output=True, check=True).stdout.strip()

assert git('branch', '--show-current') == 'audit/release-eb6de2e8'
source = git('rev-parse', 'HEAD')
changed = git('diff', '--name-only', source_base, source).splitlines()
assert sorted(changed) == sorted(paths), 'Source commit contains unexpected paths.'
assert git('diff', '--name-only', base, source, '--', '.', ':!WP', *[':!' + p for p in paths]) == '', 'Unexpected application divergence.'
prior = subprocess.run(['git', 'show-ref', '--verify', '--quiet', review_ref], cwd=root)
assert prior.returncode == 1, 'Review ref already exists; inspect its identity before reuse.'
index = evidence / 'issue-206-review.index'
assert not index.exists(), 'Review index already exists; preserve and inspect it.'
env = dict(os.environ, GIT_INDEX_FILE=str(index))
git('read-tree', base, env=env)
for path in paths:
    entry = git('ls-tree', source, '--', path)
    mode, kind, blob_path = entry.split(' ', 2)
    blob, listed_path = blob_path.split('\t', 1)
    assert kind == 'blob' and listed_path == path
    if path == '.gitattributes':
        # Historical WP retention attributes stay on the audit branch. Include
        # only the two new application byte pins in the source review.
        before = git('show', base + ':.gitattributes')
        after = git('show', source + ':.gitattributes')
        app_lines = lambda value: [line for line in value.splitlines() if line.strip() and not line.startswith(('#', 'WP/'))]
        additions = ['server/prisma/migrations/20261013000100_sample_containers/migration.sql text eol=lf',
            'server/services/sampleContainerMigrationSource.js text eol=lf']
        assert app_lines(after) == app_lines(before) + additions
        blob = git('hash-object', '-w', '--stdin', input=before + '\n' + '\n'.join(additions) + '\n')
    git('update-index', '--add', '--cacheinfo', mode + ',' + blob + ',' + path, env=env)
tree = git('write-tree', env=env)
assert sorted(git('diff', '--name-only', base, tree).splitlines()) == sorted(paths)
assert git('diff', '--name-only', source, tree, '--', '.', ':!WP', ':!.gitattributes') == ''
head = git('commit-tree', tree, '-p', base,
    input='feat(206): add physical containers and immutable aliquot links\n\nAdd scoped physical container identities, independent lab numbering, printable labels and insert-only aliquot links. Preserve historical scientific rows and existing attempt guards.\n')
assert git('rev-parse', head + '^') == base
git('update-ref', review_ref, head, '0' * 40)
record = dict(sourceCommit=source, base=base, reviewHead=head, reviewTree=tree,
    reviewRef=review_ref, paths=paths, applicationEqualityVerified=True,
    auditCheckoutUnchanged=True, attributesDifference='Historical WP byte-retention paths excluded; both #206 LF pins included.',
    newWorktrees=0, productionMutations=0)
(evidence / 'issue-206-review-ref.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record, indent=2))
