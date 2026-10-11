"""One reviewed forward recovery; ingress reopens before normal jobs.

No historical execution, explicit installer, restore, old-image recovery,
cleanup, heap override, retry or second mode exists. Every attempted startup
is forward-only. A failure after quiesce retains maintenance and stopped jobs.
"""
import fcntl
import json
import os
import pathlib
import signal
import subprocess
import sys
import tarfile
import time
import release_support as s
import startup_common as c
from known_core_disk_guard_deploy import KnownCoreDiskGuard
from runtime_release_contract import *

ROOT = pathlib.Path(__file__).resolve().parent
HISTORICAL_ROOT = pathlib.Path('/opt/lims/releases/forward-ae64f169-release-20261011T150800Z')


def environment_hash(container):
    env = dict(value.split('=', 1) for value in container['Config']['Env'])
    env['DISABLE_BACKGROUND_JOBS'] = 'false'
    return c.digest(env)


def original_proof_files(manifest):
    proof = pathlib.Path(manifest['originalProofRoot']); safe_root(str(proof), 'runtime-kobo-proof-')
    for name, digest in manifest['proofReferences'].items():
        require(pathlib.PurePosixPath(name).name == name and not (proof / name).is_symlink() and
            sha(proof / name) == digest, 'Original retained proof changed: ' + name)
    for suffix in ['jobs-off', 'jobs-on']:
        owned = c.inspect('lims-owned-' + proof.name.lower() + '-' + suffix)
        require(not owned['State']['Running'] and owned['RestartCount'] == 0 and
            owned['Image'] == manifest['image'] and
            owned['Config']['Labels'].get('io.soilfer.forward-owned') == str(proof), 'Proof writer is not stopped')


def execution_preflight(root, manifest_sha, require_unused_gate=False):
    """Read-only readiness; also used BEFORE collecting the single-use gate."""
    require(os.geteuid() == 0 and sys.flags.optimize == 0 and
        os.environ.get('PYTHONOPTIMIZE', '') in ['', '0'], 'Root and plain Python required')
    safe_root(str(root), 'runtime-kobo-release-')
    require(not any((root / name).exists() for name in ['production-receipt.json',
        'production-receipt.in-progress', 'execution-attempt.json']), 'Never replay a release attempt')
    if require_unused_gate:
        require(not (root / 'production-gate.json').exists(), 'Never overwrite or recollect a gate')
    require(sha(root / 'prepared-manifest.json') == manifest_sha, 'Manifest changed')
    manifest = json.loads((root / 'prepared-manifest.json').read_bytes())
    require(manifest['root'] == str(root), 'Execution root differs')
    pin = frozen_files(root, manifest); original_proof_files(manifest)
    build_root = pathlib.Path(pin['buildRoot']); safe_root(str(build_root), 'runtime-kobo-build-')
    require(sha(build_root / 'build-receipt.json') == pin['buildReceiptSha256'], 'Valid build receipt changed')
    built = json.loads((build_root / 'build-receipt.json').read_bytes())
    require(sha(build_root / 'source.tar.gz') == built['sourceArchiveSha256'] and
        sha(build_root / 'source-index.json') == built['sourceIndexSha256'], 'Built application source changed')
    image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', pin['image']], text=True, timeout=15))[0]
    validate_candidate(pin, built, image)
    require(sha(HISTORICAL_ROOT / 'production-receipt.json') == HISTORICAL_RECEIPT_SHA,
        'Historical production receipt changed')
    live = c.inspect('soilfer-lims'); mounts = {row['Destination']: row for row in live['Mounts']}
    require(live['Image'] == LIVE_IMAGE and live['HostConfig']['Memory'] == LIMIT and
        mounts['/app/server/prisma']['Name'] == 'lims_lims-data' and
        mounts['/app/server/uploads']['Name'] == 'lims_lims-assets', 'Original live identity changed')
    env = dict(value.split('=', 1) for value in live['Config']['Env'])
    require(env.get('NODE_OPTIONS', '') == '' and env['ALLOW_PRISMA_DB_PUSH'] == env['ALLOW_AUTO_SEED'] == 'false' and
        environment_hash(live) == manifest['effectiveEnvironmentSha256'] and
        sha(pathlib.Path('/opt/lims/.env')) == manifest['envFileSha256'], 'Measured startup environment changed')
    require(sha(s.CONF) == manifest['files']['apache-before.conf'] and b'R=503' not in s.CONF.read_bytes(),
        'Current ingress differs from the reviewed kit')
    require(not any(name.startswith('lims-owned-') for name in
        subprocess.check_output(['docker', 'ps', '--format', '{{.Names}}'], text=True, timeout=15).splitlines()),
        'Another owned rehearsal writer is active')
    assets = sum(path.stat().st_size for path in s.ASSETS.rglob('*') if path.is_file())
    wal = pathlib.Path(str(s.LIVE) + '-wal')
    database_bytes = s.LIVE.stat().st_size + (wal.stat().st_size if wal.exists() else 0)
    reserve = max(FLOOR, s.disk_reserve(database_bytes, image['Size'], assets))
    required = reserve + database_bytes + assets + 268435456
    free = s.disk_free(); require(min(free.values()) >= required, 'Backup/allocation reserve refused before quiesce')
    return {'ready': True, 'productionMutations': 0, 'head': pin['head'], 'image': pin['image'],
        'reserveBytes': reserve, 'requiredIncludingBackupBytes': required, 'freeBytes': free,
        'databaseBytesWithWal': database_bytes, 'assetsBytes': assets, 'originalRestartCount': live['RestartCount']}


def all_writers_stopped():
    c.writers_stopped()
    ids = subprocess.check_output(['docker', 'ps', '-q'], text=True, timeout=15).split()
    if ids:
        for container in json.loads(subprocess.check_output(['docker', 'inspect', *ids], text=True, timeout=15)):
            for mount in container['Mounts']:
                source = pathlib.Path(mount['Source']).resolve()
                for protected in [s.LIVE.parent.resolve(), s.ASSETS.resolve()]:
                    require(not (mount.get('RW') and (source == protected or
                        source in protected.parents or protected in source.parents)), 'An original data/assets writer remains')
    # Check writable host descriptors by device/inode, including container FD
    # paths that use a different pathname. Vanished processes have no credit.
    protected = {(path.stat().st_dev, path.stat().st_ino) for suffix in ['', '-wal', '-shm']
        for path in [pathlib.Path(str(s.LIVE) + suffix)] if path.exists()}
    for process in pathlib.Path('/proc').iterdir():
        if not process.name.isdigit():
            continue
        try:
            for fd in (process / 'fd').iterdir():
                try:
                    st = fd.stat()
                    if (st.st_dev, st.st_ino) not in protected:
                        continue
                    flags = next(line.split(':', 1)[1].strip() for line in
                        (process / 'fdinfo' / fd.name).read_text().splitlines() if line.startswith('flags:'))
                    require(int(flags, 8) & os.O_ACCMODE == os.O_RDONLY, 'A writable original SQLite descriptor remains')
                except (FileNotFoundError, ProcessLookupError):
                    continue
        except (FileNotFoundError, ProcessLookupError):
            continue


def main():
    require(sys.argv[1:] == ['--execute-new-reviewed-runtime-gate'], 'Only one NEW reviewed execution mode')
    lock = pathlib.Path('/opt/lims/apply.lock').open('a'); fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    manifest = json.loads((ROOT / 'prepared-manifest.json').read_bytes())
    gate = json.loads((ROOT / 'production-gate.json').read_bytes())
    manifest_sha = sha(ROOT / 'prepared-manifest.json')
    readiness = execution_preflight(ROOT, manifest_sha)
    require((ROOT / 'production-gate.json').stat().st_mode & 0o777 == 0o400, 'Gate is not immutable')
    verify_gate(manifest, gate, manifest_sha)
    pin = json.loads((ROOT / 'target-pin.json').read_bytes()); c.IMAGE = pin['image']; s.HEAD = pin['head']
    with (ROOT / 'execution-attempt.json').open('x', encoding='utf-8') as out:
        json.dump({'startedUtc': s.utc(), 'head': pin['head'], 'gateSha256': sha(ROOT / 'production-gate.json')}, out)
    (ROOT / 'execution-attempt.json').chmod(0o400)
    receipt = {'status': 'RUNTIME_FORWARD_IN_PROGRESS', 'head': pin['head'], 'image': pin['image'],
        'timesUtc': {}, 'manifestSha256': manifest_sha, 'coordinatorSha256': sha(__file__),
        'rehearsalReceiptSha256': manifest['files']['rehearsal-receipt.json'],
        'productionGateSha256': sha(ROOT / 'production-gate.json'), 'githubGate': gate,
        'separateInstallerCommands': 0, 'anyEntrypointAttempted': False,
        'originalProductionReceiptSha256': HISTORICAL_RECEIPT_SHA, 'preflight': readiness,
        'proofSourceReviewId': PROOF_SOURCE_REVIEW_ID,
        'proofAuthoritySha256': manifest['files']['proof-authority.json'],
        'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
        'baselineMeasurementGuardSha256': BASELINE_GUARD_SHA,
        'productionBaselineAdapterSha256': DEPLOY_BASELINE_GUARD_SHA,
        'productionBaselineScopeCommentId': PRODUCTION_BASELINE_SCOPE_ID,
        'productionBaselineSourceReviewId': manifest['productionBaselineSourceReviewId'],
        'productionBaselineSourceReviewSha256': manifest['files']['production-baseline-source-review.json'],
        'copyVerifierSha256': REVIEWED_VERIFIER_SHA, 'proofContractSha256': REVIEWED_PROOF_CONTRACT_SHA,
        'refusalScopeCommentId': REFUSAL_SCOPE_COMMENT_ID,
        'schedulerRefusalPolicy': REFUSAL_POLICY, 'intakeCardinalityPolicy': CARDINALITY_POLICY,
        'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
        'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY,
        'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
        'baselineVanishedProcessPolicy': BASELINE_POLICY,
        'BASELINE_ATTEMPTS_MAX': BASELINE_ATTEMPTS_MAX,
        'BASELINE_CONFIRMATION_DEADLINE_SECONDS': BASELINE_CONFIRMATION_SECONDS,
        'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
        'workloadControl': WORKLOAD_PINS, 'effectiveUid': os.geteuid(), 'pythonOptimize': sys.flags.optimize}
    quiesced = False; owned = False; watch = None; guard = None
    def save(event):
        receipt['timesUtc'][event] = s.utc()
        temporary = ROOT / 'production-receipt.in-progress'
        temporary.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        os.replace(temporary, ROOT / 'production-receipt.json')
        print(json.dumps({'stage': event, 'utc': receipt['timesUtc'][event]}), flush=True)
    def http(path, expected, label, method='GET'):
        response = s.command(ROOT, ['curl', '-sS', '--max-time', '15', '-o', str(ROOT / (label + '.body')),
            '-w', '%{http_code}', '-X', method, 'https://lims.yigini.net' + path], label, timeout=20)
        require(response.stdout == str(expected), label + ' returned ' + response.stdout)
    def set_ingress(name):
        s.CONF.write_bytes((ROOT / name).read_bytes())
        stamp = str(time.time_ns())
        s.command(ROOT, ['apachectl', 'configtest'], 'apache-test-' + stamp)
        s.command(ROOT, ['systemctl', 'reload', 'httpd'], 'apache-reload-' + stamp)
    def interrupted(number, frame):
        raise RuntimeError('Runtime release interrupted: ' + str(number))
    for sig in [signal.SIGTERM, signal.SIGINT, signal.SIGHUP]:
        signal.signal(sig, interrupted)
    try:
        guard = KnownCoreDiskGuard(ROOT, readiness['reserveBytes'], manifest, manifest_sha,
            sha(ROOT / 'production-gate.json'))
        receipt['baselineAttempt'] = guard.baseline_attempt
        receipt['baselineEnumerationErrorCount'] = len(guard.baseline_errors)
        guard.check(); save('beforeQuiesceGuardsPassed')
        # Recheck gate freshness immediately before the first live mutation.
        verify_gate(manifest, gate, manifest_sha)
        require(c.inspect('soilfer-lims')['Image'] == LIVE_IMAGE and sha(s.CONF) ==
            manifest['files']['apache-before.conf'], 'Live changed before quiesce')
        quiesced = True; set_ingress('apache-held.conf')
        for path, method in [('/api/health', 'GET'), ('/ws', 'GET'), ('/api/v2/data-exchange/receipts', 'POST')]:
            http(path, 503, 'held-' + method + '-' + path.strip('/').replace('/', '-'), method)
        s.command(ROOT, ['docker', 'stop', '-t', '30', 'soilfer-lims'], 'stop-original-crash-writer', timeout=45)
        require(not c.inspect('soilfer-lims')['State']['Running'] and c.inspect('soilfer-lims')['Image'] == LIVE_IMAGE,
            'Original writer did not stop')
        all_writers_stopped(); guard.check(); save('writersStopped')
        physical = s.physical(s.LIVE)
        require(physical['-wal'] is None or physical['-wal']['bytes'] == 0,
            'Stopped original WAL remains nonempty; retain and diagnose, never delete it')
        expected = s.snapshot(s.LIVE, immutable=True)
        require(len(expected['tables']) == 104 and expected['tables']['_schema_migrations']['count'] == 38 and
            expected['integrity'] == 'ok' and expected['foreignKeyViolations'] == 0, 'Stopped original state refused')
        c.write_new(ROOT / 'production-protected-state.json', expected)
        receipt['protectedStateSha256'] = sha(ROOT / 'production-protected-state.json')
        backup = ROOT / 'dev-stopped-backup.db'; s.consistent_backup(s.LIVE, backup, immutable=True)
        c.exact_state(backup, expected, immutable=True); c.main_bytes(s.LIVE, physical)
        with tarfile.open(ROOT / 'assets-stopped-backup.tar.gz', 'x:gz') as archive:
            archive.add(s.ASSETS, arcname='uploads')
        (ROOT / 'assets-stopped-backup.tar.gz').chmod(0o400)
        receipt.update({'stoppedBackupSha256': sha(backup), 'assetsBackupSha256': sha(ROOT / 'assets-stopped-backup.tar.gz'),
            'originalDatabaseFiles': physical, 'protectedTableCount': 104, 'protectedReceiptCount': 38})
        all_writers_stopped(); guard.check(); save('stoppedHashedBackupVerified')
        frozen_files(ROOT, manifest); verify_gate(manifest, gate, manifest_sha)
        require(sha(pathlib.Path('/opt/lims/.env')) == manifest['envFileSha256'], 'Startup environment changed')
        retained = 'soilfer-lims-before-' + ROOT.name
        s.command(ROOT, ['docker', 'rename', 'soilfer-lims', retained], 'retain-original-stopped-container')
        receipt['originalContainerRetainedAs'] = retained
        watch = c.ZeroWriteWatch(s.LIVE)
        # Default entrypoint attempts its NO_OP verifiers. Mark BEFORE launch;
        # even an immediate failure must never fall back, retry or restore.
        receipt['anyEntrypointAttempted'] = True; owned = True; save('candidateEntrypointAttempted')
        receipt['jobsOffReadiness'] = c.start_and_wait(ROOT, 'soilfer-lims', s.LIVE.parent, s.ASSETS,
            guard, 'production-jobs-off', watch, jobs=False, production=True)
        require(environment_hash(c.inspect('soilfer-lims')) == manifest['effectiveEnvironmentSha256'],
            'Candidate environment differs from the measured proof')
        receipt['jobsOffChecks'] = c.startup_checks(ROOT, 'soilfer-lims', s.LIVE, expected, 'production-jobs-off')
        receipt.update(c.probes(ROOT, 'soilfer-lims', s.LIVE, expected))
        watch.check(); c.main_bytes(s.LIVE, physical); guard.check(); save('jobsOffPreservationAndProbesPassed')
        set_ingress('apache-before.conf')
        http('/api/health', 200, 'reopened-health'); http('/login', 200, 'reopened-login')
        http('/api/v2/data-exchange/receipts', 401, 'reopened-denied-post', 'POST')
        watch.check(); c.main_bytes(s.LIVE, physical); save('ingressReopenedBeforeJobs')
        c.owned_stop(ROOT, 'soilfer-lims', 'stop-candidate-jobs-off')
        watch.check(); watch.close(); watch = None
        c.exact_state(s.LIVE, expected); c.main_bytes(s.LIVE, physical); all_writers_stopped(); guard.check()
        off = 'soilfer-lims-jobs-off-' + ROOT.name
        s.command(ROOT, ['docker', 'rename', 'soilfer-lims', off], 'retain-candidate-jobs-off')
        receipt['jobsOffContainerRetainedAs'] = off
        watch = c.NormalProductionJobs()
        receipt['jobsOnReadiness'] = c.start_and_wait(ROOT, 'soilfer-lims', s.LIVE.parent, s.ASSETS,
            guard, 'production-jobs-on', watch, jobs=True, production=True)
        receipt['jobsOnChecks'] = c.startup_checks(ROOT, 'soilfer-lims', s.LIVE, expected,
            'production-jobs-on', jobs_guard=watch)
        require(environment_hash(c.inspect('soilfer-lims')) == manifest['effectiveEnvironmentSha256'],
            'Jobs-on candidate environment differs')
        save('normalJobsEnabled')
        end = time.monotonic() + manifest['productionObservationSeconds']
        peak = max(receipt['jobsOffChecks']['startupMemory']['peakBytes'], receipt['jobsOnChecks']['startupMemory']['peakBytes'])
        while True:
            observed = c.inspect('soilfer-lims'); c.state_guard(observed, True)
            require(observed['State']['Health']['Status'] == 'healthy', 'Production health failed during observation')
            http('/api/health', 200, 'health-observation-' + str(time.time_ns()))
            current_peak = int(subprocess.check_output(['docker', 'exec', 'soilfer-lims', 'node', '-e',
                "console.log(Number(require('node:fs').readFileSync('/sys/fs/cgroup/memory.peak','utf8')))"], text=True, timeout=15))
            require(0 < current_peak <= LIMIT, 'Production peak exceeded 768MiB')
            peak = max(peak, current_peak); guard.check()
            receipt.setdefault('normalJobsHealthSamples', []).append({'utc': s.utc(), 'restartCount': observed['RestartCount'],
                'peakBytes': current_peak, 'healthy': True})
            if time.monotonic() >= end:
                break
            time.sleep(min(30, max(1, end - time.monotonic())))
        http('/login', 200, 'final-login'); http('/api/v2/data-exchange/receipts', 401, 'final-denied-post', 'POST')
        c.state_guard(c.inspect('soilfer-lims'), True); guard.check(); frozen_files(ROOT, manifest)
        require(sha(HISTORICAL_ROOT / 'production-receipt.json') == HISTORICAL_RECEIPT_SHA, 'Historical receipt changed')
        receipt.update({'status': 'DEPLOYED_NEW_RUNTIME_FORWARD', 'databaseChangesBeforeJobs': 0,
            'mainDatabaseBytesPreservedBeforeJobs': True, 'normalApplicationWritesEnabled': True,
            'productionObservationSeconds': manifest['productionObservationSeconds'], 'peakBytes': peak,
            'retainedAcceptance': s.verify_retained_acceptance(s.LIVE.parent), 'freeBytesAfter': s.disk_free()})
        save('completed')
        receipt['diskAllocationObservationsSha256'] = sha(ROOT / 'disk-allocation-observations.jsonl')
        save('immutableReceiptReady'); (ROOT / 'production-receipt.json').chmod(0o400)
        print(json.dumps({'status': receipt['status'], 'head': pin['head'], 'image': pin['image'],
            'receiptSha256': sha(ROOT / 'production-receipt.json')}), flush=True)
        return 0
    except BaseException as error:
        receipt.update({'status': 'FAILED_RUNTIME_FORWARD_HOLD' if quiesced else 'REFUSED_BEFORE_QUIESCE', 'error': str(error)})
        if quiesced:
            try:
                set_ingress('apache-held.conf')
            except BaseException as failure:
                receipt.setdefault('holdErrors', []).append(str(failure))
            try:
                live = c.inspect('soilfer-lims')
                if owned:
                    c.owned_stop(ROOT, 'soilfer-lims', 'failed-runtime-owned-stop')
                elif live['Image'] == LIVE_IMAGE and live['State']['Running']:
                    s.command(ROOT, ['docker', 'stop', '-t', '30', 'soilfer-lims'], 'failed-original-stop', timeout=45)
            except BaseException as failure:
                receipt.setdefault('holdErrors', []).append(str(failure))
        if (ROOT / 'disk-allocation-observations.jsonl').exists():
            receipt['diskAllocationObservationsSha256'] = sha(ROOT / 'disk-allocation-observations.jsonl')
        save('failed'); (ROOT / 'production-receipt.json').chmod(0o400)
        print(json.dumps({'status': receipt['status'], 'error': str(error),
            'receiptSha256': sha(ROOT / 'production-receipt.json')}), flush=True)
        return 1
    finally:
        if watch is not None:
            watch.close()
        lock.close()


if __name__ == '__main__':
    sys.exit(main())
