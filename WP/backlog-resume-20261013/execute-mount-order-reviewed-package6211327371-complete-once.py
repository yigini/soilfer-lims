"""Invoke the unchanged approved Step 2 preparer once, without host connections."""
import datetime, hashlib, json, pathlib, subprocess, sys
W = pathlib.Path(__file__).resolve().parents[2]
B = W / 'WP/batch-proof-mount-order-forward-be837974-20261016'
D = B / 'execute-reviewed-package6211327371-complete-once'
P = B / 'proof-package-workflow-batch-mount-order-forward-be837974-20261016T100000Z'
V = B / 'actual-source-pass6211327371-once'
def git(*args):
    return subprocess.check_output(['git', '-c', 'core.longpaths=true', *args], cwd=W)
def digest(raw):
    return hashlib.sha256(raw).hexdigest()
assert not D.exists() and not P.exists()
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
head = git('rev-parse', 'HEAD').decode().strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head
pub = json.loads((V / 'publication-index.json').read_bytes())
assert pub['baseAudit'] == '4563e5c3b9a4fd1a204f89a8460892159e83bc5f' and len(pub['bindings']) == 47
for row in pub['bindings']:
    raw = git('show', head + ':' + row['path'])
    assert raw == (W / row['path']).read_bytes() and len(raw) == row['length'] and digest(raw) == row['sha256']
    assert hashlib.sha1(('blob ' + str(len(raw)) + '\0').encode() + raw).hexdigest() == row['gitBlobOid']
record = json.loads((V / 'independent-pass-validation.json').read_bytes())
assert record['status'] == 'ACTUAL_NEW_EXACT_MOUNT_ORDER_SOURCE_PASS_VALIDATED_NOT_EXECUTED' and record['sourceReviewId'] == 6211327371
assert record['sourceHead'] == '187636984895aec44044635fb63498b0fcb3102e'
assert record['literalBindings'] == 193 and record['completeSourceOriginalCount'] == 732
before = {n: digest((B / n).read_bytes()) for n in record['all37SourceHashes']}
assert len(before) == 37 and before == record['all37SourceHashes']
D.mkdir()
def save(name, value):
    with (D / name).open('xb') as handle:
        handle.write(value)
args = [sys.executable, '-B', str(B / 'prepare_proof.py'), '--tooling-commit', record['sourceHead'], '--source-review-id', '6211327371']
save('intent-once.json', (json.dumps({'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'argv': args, 'passPublication': head, 'sourceSha256': before, 'neverReplay': True, 'hostConnections': 0}, indent=2) + '\n').encode())
result = None
error = None
try:
    result = subprocess.run(args, cwd=W, capture_output=True, timeout=300)
    save('stdout-original.log', result.stdout); save('stderr-original.log', result.stderr)
except subprocess.TimeoutExpired as exc:
    save('timeout-stdout-original.log', exc.stdout or b''); save('timeout-stderr-original.log', exc.stderr or b'')
    error = 'Unknown local package outcome; inspect SAME package, never replay'
after = {n: digest((B / n).read_bytes()) for n in before}
ok = result is not None and result.returncode == 0 and after == before
value = {'closedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'APPROVED_STEP2_PROOF_LOCAL_PACKAGE_PREPARED' if ok else 'FAILED_OR_UNKNOWN_PACKAGE_RETAIN_ALL_NO_REPLAY',
         'exitCode': result.returncode if result is not None else None, 'error': error, 'sourceSha256Before': before, 'sourceSha256After': after, 'hostConnections': 0, 'operationalExecutions': 0}
save('exit-original.json', (json.dumps(value, indent=2) + '\n').encode())
print(json.dumps({'closedUtc': value['closedUtc'], 'status': value['status'], 'exitCode': value['exitCode'], 'sourceFiles': len(before), 'hostConnections': 0}))
raise SystemExit(0 if ok else 1)
