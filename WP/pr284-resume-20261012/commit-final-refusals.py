import datetime
import hashlib
import json
import os
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
parent = '36ee761789a1eb42bceee537ff419456f6cd484d'
branch = 'audit/4.7-instrument-file-import'
paths = ['server/app.js', 'server/controllers/spectralController.js',
         'server/tests/contracts/audit_4_7_import_commit.test.js',
         'server/tests/contracts/audit_4_7_calculation_import.test.js',
         'server/tests/contracts/audit_4_7_import_templates.test.js']
env = os.environ.copy()
env['GIT_INDEX_FILE'] = str(root / 'WP/pr284-resume-20261012/clean-application.index')
def git(*args, raw=False, isolated=False):
    value = subprocess.check_output(['git', *args], cwd=root, env=env if isolated else None)
    return value if raw else value.decode().strip()
remote = git('ls-remote', 'origin', 'refs/heads/' + branch).split()[0]
if remote != parent:
    raise RuntimeError('Existing PR head changed; refuse to overwrite')
git('read-tree', parent, isolated=True)
files = {}
for name in paths:
    blob = git('hash-object', '-w', '--path=' + name, name)
    if name in paths[:2] and blob != git('rev-parse', '217a623bea0766688cd1e76c9344d19ec3f0ed12:' + name):
        raise RuntimeError('Delivery scope restoration is not byte-identical to integrated predecessor')
    git('update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + name, isolated=True)
    files[name] = {'blob': blob, 'sha256': hashlib.sha256((root / name).read_bytes()).hexdigest()}
tree = git('write-tree', isolated=True)
message = root / 'WP/pr284-resume-20261012/final-refusals-commit-message.txt'
message.write_text('Cover pinned import refusals and retain existing file delivery\n\nRefs #200. Keep started-run instrumentation and mapping immutability intact; verify actual HTTP mismatch, direct/QC dilution, input-only QC, revision and unit refusals with zero writes. Restore unchanged SPA and spectral delivery scope.\n', encoding='utf-8')
head = git('commit-tree', tree, '-p', parent, '-F', str(message))
changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', head).splitlines()
if sorted(changed) != sorted(paths):
    raise RuntimeError('Unexpected clean application delta')
record = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'head': head, 'tree': tree, 'parent': parent, 'existingBranch': branch,
          'files': files, 'focusedSuites': 8, 'focusedTests': 146,
          'fullValidation': 'PENDING_FINAL_HEAD', 'newWorktree': False, 'productionMutation': False}
target = root / 'WP/pr284-resume-20261012/final-refusals-application-commit.json'
target.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
git('push', 'origin', head + ':refs/heads/' + branch)
record['pushedUtc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
target.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record, indent=2))
