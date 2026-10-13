"""Apply only Claudio's approved test-script delta and bind its source ref."""
import datetime
import hashlib
import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent
destination = evidence / 'issue-206-harness-review-ref.json'
assert not destination.exists(), 'Preserve this one-time preparation.'
prior = '9ae02f6ab7651d2ca887a98722f6a20ace3cc471'
ref = 'refs/heads/codex/issue-206-containers'
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
def git(*args, env=None, payload=None):
    return subprocess.run(['git', *args], cwd=root, env=env, input=payload,
                          capture_output=True, check=True).stdout
def value(*args, env=None, payload=None):
    return git(*args, env=env, payload=payload).decode().strip()
assert value('branch', '--show-current') == 'audit/release-eb6de2e8'
assert value('rev-parse', ref) == prior
assert not value('diff', '--cached', '--name-only')
raw_scope = subprocess.check_output(['gh', 'api',
    'repos/yigini/soilfer-lims/issues/comments/6145765510'], cwd=root)
scope = json.loads(raw_scope)
assert scope['id'] == 6145765510 and 'test-only change can stay in PR295' in scope['body']
assert 'Change only the server `test` script, nothing else.' in scope['body']
scope_path = evidence / 'issue-206-harness-scope-6145765510-raw.json'
assert not scope_path.exists()
scope_path.write_bytes(raw_scope)
native_path = evidence / 'native-ci-failure-scope-206.json'
assert not native_path.exists()
native_path.write_bytes((json.dumps(dict(
    observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    target='Claude / LIMS Audit / Lab workflow audit and plan',
    failureBoundaryMessage='Delivered once and visually verified with exact head/run, raw evidence and scope question6145723989',
    beforeSend='Fresh actual window, right thread, empty composers, focused empty right composer, full draft inspected before Return',
    actualScopeReply='Yes, Jest change can stay in PR295; only server test script; config and 8GB heap unchanged; same full count, no skipped tests; document change; exact-head audit waits for green CI',
    githubScopeCommentId=6145765510,
    minimizedWindowRecovery='Activated actual returned Claude window, rehydrated current window and captured fresh state',
    humanCards='Unanswered #103 See first / Approve now card and human drafts untouched',
    finalAuditHandoff=False, actualFinalAuditPass=False, productionMutations=0), indent=2)+'\n').encode())

package = root / 'server/package.json'
before = package.read_bytes()
canonical_before = git('show', prior + ':server/package.json')
assert before.replace(b'\r\n', b'\n') == canonical_before
old = b'"test": "jest --runInBand"'
new = b'"test": "jest --maxWorkers=1 --workerIdleMemoryLimit=512MB"'
assert before.count(old) == 1
after = before.replace(old, new)
package.write_bytes(after)
canonical_after = canonical_before.replace(old, new)
assert after.replace(b'\r\n', b'\n') == canonical_after
subprocess.check_call(['git', 'add', '--', 'server/package.json'], cwd=root)
assert git('show', ':server/package.json') == canonical_after
paths = ['server/package.json', str(scope_path.relative_to(root)).replace('\\','/'),
         str(native_path.relative_to(root)).replace('\\','/'),
         str(Path(__file__).relative_to(root)).replace('\\','/')]
subprocess.check_call(['git', 'add', '-f', '--', *paths[1:]], cwd=root)
assert set(value('diff', '--cached', '--name-only').splitlines()) == set(paths)
subprocess.check_call(['git','diff','--cached','--check','--','server/package.json'],cwd=root)
subprocess.check_call(['git','commit','-m','test(206): recycle one serial Jest worker after CI heap failure'],cwd=root)
audit_source = value('rev-parse', 'HEAD')

index = evidence / 'issue-206-harness-review.index'
assert not index.exists()
env = dict(os.environ, GIT_INDEX_FILE=str(index))
value('read-tree', prior, env=env)
blob = value('rev-parse', audit_source + ':server/package.json')
value('update-index', '--add', '--cacheinfo', f'100644,{blob},server/package.json', env=env)
tree = value('write-tree', env=env)
assert value('diff', '--name-only', prior, tree) == 'server/package.json'
assert git('show', tree + ':server/package.json') == canonical_after
assert git('show', tree + ':server/jest.config.js') == git('show', prior + ':server/jest.config.js')
assert git('show', tree + ':.github/workflows/ci.yml') == git('show', prior + ':.github/workflows/ci.yml')
source_paths = value('diff', '--name-only', base, tree).splitlines()
assert len(source_paths) == 52 and not any(path.startswith('WP/') for path in source_paths)
head = value('commit-tree', tree, '-p', prior, payload=(
    b'test(206): recycle one serial Jest worker after CI heap failure\n\n'
    b'Apply the server test-script-only correction accepted by Claudio in issue206 comment6145765510. '
    b'Keep stock Jest setup, assertions, CI heap, and production unchanged.\n'))
value('update-ref', ref, head, prior)
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(),
    priorHead=prior, reviewHead=head, reviewTree=tree, auditSource=audit_source,
    base=base, paths=source_paths, approvedScopeCommentId=6145765510,
    changedFromPrior=['server/package.json'], fullApplicationDelta='Only server scripts.test command',
    oldCommand='jest --runInBand', newCommand='jest --maxWorkers=1 --workerIdleMemoryLimit=512MB',
    jestConfigUnchanged=True, ciWorkflowUnchanged=True, ciHeapUnchanged8192=True,
    testsUnchanged=True, assertionsUnchanged=True, testWorkerCount=1,
    failedCI=38393187129, failedCIReplayed=False,
    scopeRawSha256=hashlib.sha256(raw_scope).hexdigest(),
    canonicalPackageSha256=hashlib.sha256(canonical_after).hexdigest(),
    newWorktrees=0, productionMutations=0, pushed=False)
destination.write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps({key:value for key,value in record.items() if key!='paths'},indent=2))
