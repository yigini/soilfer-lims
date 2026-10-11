"""NEW isolated jobs-OFF proof only. This program has no production mutation mode."""
import datetime, hashlib, json, os, pathlib, shutil, sqlite3, subprocess, sys, time
import release_support as s
import startup_common as c
from known_core_disk_guard import KnownCoreDiskGuard

ROOT = pathlib.Path(__file__).resolve().parent
HEAD = 'ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf'
IMAGE = 'sha256:bc2557a5dee2a8599d31cf96407088d67ce863c4ad3fc7e6989b8671e10c597a'
HISTORICAL_ROOT = pathlib.Path('/opt/lims/releases/forward-ae64f169-release-20261011T150800Z')
HISTORICAL_RECEIPT_SHA = '35ab0b825a5d52414304d426101863b671ce5d3b92f6d8eb81e8b79f34095462'
HOLD_SECONDS = 660
LIMIT = 805306368
MIN_RESERVE = 10556150894

def write_new(name, value):
    path = ROOT / name
    with path.open('x', encoding='utf-8') as out:
        json.dump(value, out, indent=2, ensure_ascii=False)
    path.chmod(0o400)

def environment_hash(container, jobs):
    env = dict(v.split('=', 1) for v in container['Config']['Env'])
    env['DISABLE_BACKGROUND_JOBS'] = 'false' if jobs else 'true'
    return hashlib.sha256(json.dumps(env, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def memory_peak(name):
    value = subprocess.check_output(['docker', 'exec', name, 'node', '-e',
        "console.log(Number(require('node:fs').readFileSync('/sys/fs/cgroup/memory.peak','utf8')))"], text=True, timeout=15)
    peak = int(value.strip())
    assert 0 < peak <= LIMIT, 'Memory exceeded the reviewed 768MiB'
    return peak

def retain_disk_observations(receipt):
    path = ROOT / 'disk-allocation-observations.jsonl'
    if path.exists():
        receipt['diskAllocationObservationsSha256'] = s.sha(path)
        receipt['diskAllocationObservations'] = [json.loads(line) for line in path.read_text().splitlines()]

def main():
    if os.geteuid() != 0 or sys.flags.optimize != 0 or os.environ.get('PYTHONOPTIMIZE', '') not in ['', '0']:
        raise RuntimeError('Require root and unoptimized Python for all assertion gates')
    assert sys.argv[1:] == ['--new-owned-proof']
    assert ROOT.parent == pathlib.Path('/opt/lims/releases')
    assert ROOT.name.startswith('runtime-jobs-off-ae64f169-proof-')
    assert not (ROOT / 'rehearsal-receipt.json').exists()
    assert not (ROOT / 'db').exists(), 'Never replay an owned proof'
    source = json.loads((ROOT / 'source-index.json').read_text())
    for name, item in source['files'].items():
        assert pathlib.PurePosixPath(name).name == name
        assert s.sha(ROOT / name) == item['sha256']
        assert (ROOT / name).stat().st_mode & 0o777 == 0o400
    assert s.HEAD == HEAD and c.IMAGE == IMAGE
    assert s.sha(HISTORICAL_ROOT / 'production-receipt.json') == HISTORICAL_RECEIPT_SHA
    image = c.image_check()
    live = c.inspect('soilfer-lims')
    assert live['Image'] == IMAGE and live['HostConfig']['Memory'] == LIMIT
    mounts = {m['Destination']: m for m in live['Mounts']}
    assert mounts['/app/server/prisma']['Name'] == 'lims_lims-data'
    assert mounts['/app/server/uploads']['Name'] == 'lims_lims-assets'
    env = dict(v.split('=', 1) for v in live['Config']['Env'])
    assert env.get('NODE_OPTIONS', '') == ''
    assert env['ALLOW_PRISMA_DB_PUSH'] == env['ALLOW_AUTO_SEED'] == 'false'
    before_env_hash = environment_hash(live, False)
    data_bytes = s.LIVE.stat().st_size
    asset_bytes = sum(p.stat().st_size for p in s.ASSETS.rglob('*') if p.is_file())
    reserve = max(MIN_RESERVE, s.disk_reserve(data_bytes, image['size'], asset_bytes))
    assert min(s.disk_free().values()) >= reserve + 2 * data_bytes + asset_bytes + 268435456
    guard = KnownCoreDiskGuard(ROOT, reserve)
    receipt = {'status': 'OWNED_JOBS_HOLD_PROOF_IN_PROGRESS', 'head': HEAD, 'image': IMAGE,
        'root': str(ROOT), 'startedUtc': s.utc(), 'productionMutations': 0,
        'separateInstallerCommands': 0, 'historicalReceiptSha256': HISTORICAL_RECEIPT_SHA,
        'sourceIndexSha256': s.sha(ROOT / 'source-index.json'),
        'coordinatorSha256': s.sha(__file__),
        'diskAccountingGuardSha256': s.sha(ROOT / 'known_core_disk_guard.py'),
        'effectiveUid': os.geteuid(), 'pythonOptimize': sys.flags.optimize,
        'pythonOptimizeEnvironment': os.environ.get('PYTHONOPTIMIZE'),
        'baselineEnumerationErrorCount': len(guard.baseline_errors),
        'liveEnvironmentHashNormalizedJobsOff': before_env_hash,
        'reserveBytes': reserve, 'freeBefore': s.disk_free()}
    name = 'lims-owned-' + ROOT.name.removeprefix('runtime-').lower()
    owned = False
    watch = None
    try:
        # SQLite backup includes live WAL via one read-only source connection.
        # No immutable or raw-main-file copy while the source writer runs.
        s.consistent_backup(s.LIVE, ROOT / 'fresh-live-backup.db')
        receipt['freshCopyUtc'] = s.utc()
        receipt['freshCopySha256'] = s.sha(ROOT / 'fresh-live-backup.db')
        expected = s.snapshot(ROOT / 'fresh-live-backup.db', immutable=True)
        assert len(expected['tables']) == 104
        assert expected['tables']['_schema_migrations']['count'] == 38
        assert expected['integrity'] == 'ok' and expected['foreignKeyViolations'] == 0
        write_new('fresh-protected-state.json', expected)
        receipt['protectedStateSha256'] = s.sha(ROOT / 'fresh-protected-state.json')
        (ROOT / 'db').mkdir()
        shutil.copyfile(ROOT / 'fresh-live-backup.db', ROOT / 'db/dev.db')
        shutil.copytree(s.ASSETS, ROOT / 'assets')
        receipt['retainedAcceptanceBefore'] = s.verify_retained_acceptance(ROOT / 'db', immutable=True)
        physical = s.physical(ROOT / 'db/dev.db')
        guard.check()
        watch = c.ZeroWriteWatch(ROOT / 'db/dev.db')
        owned = True
        receipt['readiness'] = c.start_and_wait(ROOT, name, ROOT / 'db', ROOT / 'assets', guard,
            'owned-jobs-off', watch, jobs=False, production=False)
        candidate = c.inspect(name)
        assert environment_hash(candidate, False) == before_env_hash, 'Unexpected effective environment change'
        base = receipt['readiness']['baseUrl']
        receipt['startup'] = c.startup_checks(ROOT, name, ROOT / 'db/dev.db', expected, 'owned-jobs-off')
        receipt.update(c.probes(ROOT, name, ROOT / 'db/dev.db', expected))
        watch.check()
        c.main_bytes(ROOT / 'db/dev.db', physical)
        # The short historical first-health proof did not cover the failed tick.
        # This NEW proof observes >10 minutes after healthy, with jobs disabled.
        start = time.monotonic()
        receipt['soakStartedUtc'] = s.utc()
        samples = []
        peak = receipt['startup']['startupMemory']['peakBytes']
        while time.monotonic() - start < HOLD_SECONDS:
            candidate = c.inspect(name)
            c.state_guard(candidate, False)
            assert candidate['State']['Health']['Status'] == 'healthy'
            result = subprocess.run(['curl', '-fsS', '--max-time', '4', base + '/api/health'],
                text=True, capture_output=True, timeout=6)
            assert result.returncode == 0 and json.loads(result.stdout)['status'] == 'ok'
            watch.check()
            disk = guard.check()
            peak = max(peak, memory_peak(name))
            sample = {'utc': s.utc(), 'elapsedSeconds': time.monotonic() - start,
                'restartCount': candidate['RestartCount'], 'healthy': True, 'peakBytes': peak,
                'minimumFreeBytes': min(disk['freeBytes'].values())}
            samples.append(sample)
            print(json.dumps({'stage': 'owned-jobs-off-soak', **sample}), flush=True)
            time.sleep(min(30, max(0, HOLD_SECONDS - (time.monotonic() - start))))
        receipt['soakCompletedUtc'] = s.utc()
        receipt['soakElapsedSeconds'] = time.monotonic() - start
        receipt['soakSamples'] = samples
        receipt['peakBytes'] = peak
        receipt['memoryLimitBytes'] = LIMIT
        receipt['nodeOptions'] = ''
        c.exact_state(ROOT / 'db/dev.db', expected)
        c.main_bytes(ROOT / 'db/dev.db', physical)
        watch.check()
        receipt['retainedAcceptanceAfter'] = s.verify_retained_acceptance(ROOT / 'db')
        assert receipt['retainedAcceptanceAfter'] == receipt['retainedAcceptanceBefore']
        receipt['completeDatabasePreservation'] = True
        receipt['databaseChanges'] = 0
        receipt['freshCopyBytesPreserved'] = True
        # A PASSED receipt is written only after the owned writer stops and
        # stopped-copy preservation is checked. A failed stop remains FAILED.
        watch.close()
        watch = None
        c.owned_stop(ROOT, name, 'retain-owned-proof-stop')
        owned = False
        receipt['ownedWriterStopped'] = True
        c.exact_state(ROOT / 'db/dev.db', expected)
        c.main_bytes(ROOT / 'db/dev.db', physical)
        receipt['freeAfter'] = s.disk_free()
        guard.check()
        assert s.sha(HISTORICAL_ROOT / 'production-receipt.json') == HISTORICAL_RECEIPT_SHA
        retain_disk_observations(receipt)
        receipt['status'] = 'PASSED_NEW_OWNED_JOBS_OFF_CONTAINMENT_PROOF'
        receipt['completedUtc'] = s.utc()
        write_new('rehearsal-receipt.json', receipt)
        print(json.dumps({'status': receipt['status'], 'root': str(ROOT),
            'receiptSha256': s.sha(ROOT / 'rehearsal-receipt.json')}), flush=True)
        return 0
    except BaseException as error:
        receipt['status'] = 'FAILED_NEW_OWNED_JOBS_OFF_CONTAINMENT_PROOF'
        receipt['error'] = str(error)
        receipt['failedUtc'] = s.utc()
        retain_disk_observations(receipt)
        if not (ROOT / 'rehearsal-receipt.json').exists():
            write_new('rehearsal-receipt.json', receipt)
        raise
    finally:
        if watch is not None:
            watch.close()
        if owned:
            c.owned_stop(ROOT, name, 'retain-failed-owned-proof-stop')

if __name__ == '__main__':
    sys.exit(main())
