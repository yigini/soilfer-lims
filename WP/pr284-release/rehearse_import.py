"""NEW isolated candidate proof only; no production execution or recovery mode.

The historical shared helpers are imported unchanged. Only their explicit
candidate image/head bindings are set after immutable build verification.
The existing live writer and its volumes are never stopped or mounted.
"""
import contextlib
import fcntl
import json
import os
import pathlib
import shutil
import signal
import sqlite3
import subprocess
import sys
import time

import release_support as s
import startup_common as c
from known_core_disk_guard_import import KnownCoreDiskGuard, POLICY as PROOF_LAYOUT_POLICY
from capture_kobo_fetch import capture
from kobo_copy_preservation import verify_copy
from import_proof_contract import *
from import_source_graph import UNCHANGED_HELPER_HASHES, require_source_set
from import_stage import install_once
from import_startup_checks import startup_checks as import_startup_checks
from import_sealing import sealed_stopped_state

ROOT = pathlib.Path(__file__).resolve().parent
HISTORICAL_ROOT = pathlib.Path(HISTORICAL_ROOT_PATH)
HELPER_HASHES = UNCHANGED_HELPER_HASHES


def write_new(name, value):
    path = ROOT / name
    with path.open('x', encoding='utf-8') as out:
        json.dump(value, out, ensure_ascii=False, indent=2)
    path.chmod(0o400)
    return s.sha(path)


def configs_from_backup(database):
    with contextlib.closing(sqlite3.connect(database.as_uri() + '?mode=ro&immutable=1', uri=True)) as db:
        db.row_factory = sqlite3.Row
        return {row['id']: {key: row[key] for key in ['id', 'labId', 'projectCode',
            'syncIntervalMins', 'lastSubmissionId']} for row in db.execute(
                'SELECT * FROM KoboConfig WHERE isActive=1 AND projectCode IS NOT NULL')}


def effective_environment_hash(container, jobs):
    env = dict(row.split('=', 1) for row in container['Config']['Env'])
    env['DISABLE_BACKGROUND_JOBS'] = 'false' if jobs else 'true'
    return c.digest(env)


def read_logs(name, receipt):
    result = subprocess.run(['docker', 'logs', '--timestamps', name],
        text=True, capture_output=True, timeout=20)
    require(result.returncode == 0, 'Cannot observe the owned scheduler')
    log = result.stdout + '\n' + result.stderr
    require(len(log.encode()) <= 8 * 1024 * 1024, 'Owned logs exceed the evidence bound')
    observed = scheduler_refusals(result.stdout, result.stderr, receipt['expectedSchedulerRefusals'])
    receipt['observedSchedulerRefusals'] = observed
    receipt['schedulerRefusalLabCounts'] = {lab: sum(row['labId'] == lab for row in observed)
        for lab in sorted({row['labId'] for row in receipt['expectedSchedulerRefusals']})}
    receipt['schedulerRefusalConfigCountsDerivedFromTriggers'] = True
    # Preserve stream separation for the final seal; completion parsing uses stdout only.
    receipt['_schedulerStdout'] = result.stdout
    receipt['_schedulerStderr'] = result.stderr
    receipt['schedulerRefusalCounts'] = {row['configId']: sum(value['configId'] == row['configId']
        for value in observed) for row in receipt['expectedSchedulerRefusals']}
    return result.stdout


def require_owned_writers_stopped(directory):
    # Observe every mount; never stop unrelated containers or the live writer.
    directory = pathlib.Path(directory).resolve()
    ids = subprocess.check_output(['docker', 'ps', '-q'], text=True, timeout=15).split()
    if not ids: return
    for container in json.loads(subprocess.check_output(['docker', 'inspect', *ids], text=True, timeout=15)):
        for mount in container.get('Mounts', []):
            source = pathlib.Path(mount['Source']).resolve()
            require(not (mount.get('RW') and (source == directory or source in directory.parents or directory in source.parents)),
                'An owned-copy writer remains active before its detached seal')


class CopyObservation:
    """Observe commit versions without claiming in-progress writes are zero.

    Full original-row preservation is checked at sealed first and final second
    boundaries. The writer is isolated, and no production mount is available.
    """
    def __init__(self, database):
        self.db = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
        self.db.execute('PRAGMA query_only=ON')
        self.versions = [self.db.execute('PRAGMA data_version').fetchone()[0]]

    def check(self):
        version = self.db.execute('PRAGMA data_version').fetchone()[0]
        if version != self.versions[-1]:
            self.versions.append(version)

    def close(self):
        self.db.close()


def sample(name, base, guard, watch, env_hash, receipt):
    candidate = c.inspect(name)
    c.state_guard(candidate, True)
    require(candidate['State']['Health']['Status'] == 'healthy', 'Owned health failed')
    require(effective_environment_hash(candidate, True) == env_hash, 'Effective environment changed')
    response = subprocess.run(['curl', '-fsS', '--max-time', '4', base + '/api/health'],
        text=True, capture_output=True, timeout=6)
    require(response.returncode == 0 and json.loads(response.stdout)['status'] == 'ok',
        'Owned HTTP health failed')
    peak = int(subprocess.check_output(['docker', 'exec', name, 'node', '-e',
        "console.log(Number(require('node:fs').readFileSync('/sys/fs/cgroup/memory.peak','utf8')))"],
        text=True, timeout=15).strip())
    require(0 < peak <= LIMIT, 'Owned peak exceeds 768MiB')
    watch.check()
    disk = guard.check()
    receipt['peakBytes'] = max(receipt.get('peakBytes', 0), peak)
    row = {'utc': s.utc(), 'healthy': True, 'restartCount': candidate['RestartCount'],
        'peakBytes': peak, 'minimumFreeBytes': min(disk['freeBytes'].values())}
    receipt.setdefault('healthSamples', []).append(row)
    print(json.dumps({'stage': 'candidate-natural-kobo-observation', **row}), flush=True)
    return read_logs(name, receipt)


def main():
    require(os.geteuid() == 0 and sys.flags.optimize == 0 and
        os.environ.get('PYTHONOPTIMIZE', '') in ['', '0'], 'Require root and plain unoptimized Python')
    require(sys.argv[1:] == ['--new-owned-import-proof'], 'No live or replay mode')
    bound_candidate()
    require(ROOT.parent == pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('instrument-import-proof-'),
        'Require a fresh isolated release root')
    require(not (ROOT / 'rehearsal-receipt.json').exists() and not (ROOT / 'database').exists(),
        'Never replay a proof')
    lock = (pathlib.Path('/opt/lims') / 'apply.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    source = json.loads((ROOT / 'source-index.json').read_bytes())
    require_source_set({name: item['sha256'] for name, item in source['files'].items()})
    for name, item in source['files'].items():
        require(pathlib.PurePosixPath(name).name == name and not (ROOT / name).is_symlink(), 'Unsafe source path')
        require(s.sha(ROOT / name) == item['sha256'] and
            (ROOT / name).stat().st_mode & 0o777 == 0o400, 'Source bytes/mode changed')
    for name, digest in HELPER_HASHES.items():
        require(source['files'][name]['sha256'] == digest, 'Reviewed helper changed: ' + name)
    pin = json.loads((ROOT / 'target-pin.json').read_bytes())
    require((ROOT / 'target-pin.json').stat().st_mode & 0o777 == 0o400, 'Target pin is not frozen')
    authority = json.loads((ROOT / 'candidate-rehearsal-authority.json').read_bytes())
    source_review = authority['proofSourceReview']
    require(source_review['id'] == pin['proofSourceReviewId'], 'Proof-source approval pin differs')
    source_review_pass(source_review, source['head'], {name: item['sha256'] for name, item in source['files'].items()})
    built_root = pathlib.Path(pin['buildRoot'])
    require(built_root.parent == pathlib.Path('/opt/lims/releases') and
        built_root.name.startswith('instrument-import-build-'), 'Unexpected build root')
    require(s.sha(built_root / 'build-receipt.json') == pin['buildReceiptSha256'], 'Build receipt changed')
    built = json.loads((built_root / 'build-receipt.json').read_bytes())
    require(s.sha(built_root / 'source.tar.gz') == built['sourceArchiveSha256'] and
        s.sha(built_root / 'source-index.json') == built['sourceIndexSha256'], 'Build source changed')
    image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', pin['image']], text=True, timeout=15))[0]
    validate_candidate(pin, built, image)
    require(s.sha(HISTORICAL_ROOT / 'production-receipt.json') == HISTORICAL_RECEIPT_SHA, 'Historical receipt changed')
    live = c.inspect('soilfer-lims')
    require(live['State']['Running'] and live['State']['Health']['Status'] == 'healthy' and
        not live['State']['OOMKilled'] and live['RestartCount'] == 0 and live['Image'] == LIVE_IMAGE,
        'Live application changed; re-audit the checkpoint')
    mounts = {row['Destination']: row for row in live['Mounts']}
    require(mounts['/app/server/prisma']['Name'] == 'lims_lims-data' and
        mounts['/app/server/uploads']['Name'] == 'lims_lims-assets', 'Live volume identity changed')
    require(live['HostConfig']['Memory'] == LIMIT, 'Live canonical memory limit changed')
    env = dict(row.split('=', 1) for row in live['Config']['Env'])
    require(env.get('NODE_OPTIONS', '') == '' and env.get('ALLOW_PRISMA_DB_PUSH') == 'false' and
        env.get('ALLOW_AUTO_SEED') == 'false' and env.get('DISABLE_BACKGROUND_JOBS') == 'false', 'Unexpected live startup environment')
    env_hash = effective_environment_hash(live, True)
    # Explicit newly reviewed binding, never modify any historical source file.
    c.IMAGE = pin['image']
    s.HEAD = pin['head']
    asset_bytes = sum(path.stat().st_size for path in s.ASSETS.rglob('*') if path.is_file())
    reserve = max(FLOOR, s.disk_reserve(s.LIVE.stat().st_size, image['Size'], asset_bytes))
    require(min(s.disk_free().values()) >= reserve + 12 * s.LIVE.stat().st_size + asset_bytes + 268435456,
        'Pre-copy backup/allocation reserve refused; production untouched')
    receipt = {'status': 'NEW_IMPORT_PROOF_IN_PROGRESS', 'root': str(ROOT), 'startedUtc': s.utc(),
        'head': pin['head'], 'image': pin['image'], 'targetPinSha256': s.sha(ROOT / 'target-pin.json'),
        'sourceIndexSha256': s.sha(ROOT / 'source-index.json'), 'toolingCommit': source['head'],
        'coordinatorSha256': s.sha(__file__), 'buildReceiptSha256': pin['buildReceiptSha256'],
        'proofSourceReviewId': source_review['id'], 'baseHead': BASE_HEAD, 'pr': PR_NUMBER,
        'tree': MERGED_TREE, 'auditedTree': AUDITED_PR_TREE, 'mergeParents': MERGE_PARENTS,
        'naturalIntakePolicy': NATURAL_INTAKE_POLICY,
        'authoritySha256': s.sha(ROOT / 'candidate-rehearsal-authority.json'),
        'diskMeasurementGuardSha256': HELPER_HASHES['known_core_disk_guard_v2.py'],
        'coreDeallocationConfirmationDeadlineSeconds': 10,
        'baselineMeasurementGuardSha256': HELPER_HASHES['known_core_disk_guard_v3.py'],
        'proofBaselineLayoutPolicy': PROOF_LAYOUT_POLICY,
        'proofBaselineLayoutGuardSha256': s.sha(ROOT / 'known_core_disk_guard_import.py'),
        'baselineVanishedProcessPolicy': 'CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE',
        'BASELINE_ATTEMPTS_MAX': 3, 'BASELINE_CONFIRMATION_DEADLINE_SECONDS': 10,
        'historicalReceiptSha256': HISTORICAL_RECEIPT_SHA, 'productionMutations': 0,
        'separateInstallerCommands': 3, 'importDeltaPolicy': NATIVE_DELTA_POLICY, 'retainedDatabaseAllocationCount': 12, 'scopeCommentIds': [6112209155, 6112305172, 6112436098, REFUSAL_SCOPE_COMMENT_ID],
        'refusalScopeCommentId': REFUSAL_SCOPE_COMMENT_ID,
        'schedulerRefusalPolicy': REFUSAL_POLICY, 'intakeCardinalityPolicy': CARDINALITY_POLICY,
        'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
        'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY,
        'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
        'copyVerifierSha256': HELPER_HASHES['kobo_copy_preservation.py'],
        'proofContractSha256': s.sha(ROOT / 'import_proof_contract.py'),
        'existingSampleVerifierPolicy': 'STRICT_ORIGINAL_ROWS', 'effectiveUid': os.geteuid(),
        'pythonOptimize': sys.flags.optimize, 'reserveBytes': reserve, 'workloadPins': {
            'labAndHubBuildsOwnedByYY': True, 'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}}
    names, watch, guard = [], None, None
    def interrupted(number, frame):
        raise RuntimeError('Proof interrupted: ' + str(number))
    for sig in [signal.SIGTERM, signal.SIGINT, signal.SIGHUP]:
        signal.signal(sig, interrupted)
    try:
        guard = KnownCoreDiskGuard(ROOT, reserve, source,
            {name: s.sha(ROOT / name) for name in ['source-index.json', 'target-pin.json',
                'candidate-rehearsal-authority.json']})
        receipt['baselineEnumerationErrorCount'] = len(guard.baseline_errors)
        receipt['baselineAttempt'] = guard.baseline_attempt
        s.consistent_backup(s.LIVE, ROOT / 'fresh-live-backup.db')
        receipt['freshCopyUtc'] = s.utc()
        receipt['freshCopySha256'] = s.sha(ROOT / 'fresh-live-backup.db')
        expected = s.snapshot(ROOT / 'fresh-live-backup.db', immutable=True)
        require(len(expected['tables']) == 104 and expected['tables']['_schema_migrations']['count'] == 38 and
            expected['integrity'] == 'ok' and expected['foreignKeyViolations'] == 0, 'Fresh-copy baseline refused')
        receipt['protectedStateSha256'] = write_new('fresh-protected-state.json', expected)
        database_dir = ROOT / 'database'; database_dir.mkdir()
        database = database_dir / 'dev.db'
        shutil.copyfile(ROOT / 'fresh-live-backup.db', database)
        shutil.copytree(s.ASSETS, ROOT / 'assets')
        original_physical = s.physical(database)
        def seal_owned(label, installed=False):
            require_owned_writers_stopped(database_dir)
            state, evidence = sealed_stopped_state(ROOT, label, database, guard, installed=installed)
            return evidence
        receipt['nativeImportInstallation'], expected = install_once(ROOT, pin['image'], database_dir,
            ROOT / 'fresh-live-backup.db', original_physical, ROOT, guard, s, seal_owned)
        installed_baseline = ROOT / 'after-import-stopped' / 'dev-stopped-backup.db'
        receipt['installedBaselineSha256'] = s.sha(installed_baseline)
        receipt['installedProtectedStateSha256'] = write_new('installed-protected-state.json', expected)
        original_physical = s.physical(database)
        configs = configs_from_backup(ROOT / 'fresh-live-backup.db')
        with contextlib.closing(sqlite3.connect((ROOT / 'fresh-live-backup.db').as_uri() +
                '?mode=ro&immutable=1', uri=True)) as db:
            db.row_factory = sqlite3.Row
            receipt['expectedSchedulerRefusals'] = expected_refusals(
                [dict(row) for row in db.execute('SELECT id,labId,projectCode,isActive FROM KoboConfig')],
                [dict(row) for row in db.execute('SELECT id,code,name,isActive FROM Lab')],
                [dict(row) for row in db.execute('SELECT code FROM Project')])
        refusal_configs = [row['configId'] for row in receipt['expectedSchedulerRefusals']]
        require(TARGET_CONFIG in configs and configs[TARGET_CONFIG]['labId'] == TARGET_LAB and
            configs[TARGET_CONFIG]['projectCode'] == TARGET_PROJECT, 'Original crash-path config missing')
        require(len([value for value in configs.values() if value['labId'] == TARGET_LAB]) == 1,
            'Ambiguous scheduler completion lab')
        interval = configs[TARGET_CONFIG]['syncIntervalMins'] or 15
        observation_end(s.utc(), s.utc(), interval)  # Validate the unedited interval before any owned start.
        receipt['copySyncIntervalMins'] = interval
        initial_fetch = capture(ROOT / 'fresh-live-backup.db', list(configs))
        receipt['initialUpstreamSha256'] = write_new('upstream-before-start.json', initial_fetch)
        # The recovered live cursor has consumed the old crash-path backlog.
        # Observe its actual pending set, including empty, without rewinding.
        receipt['initialTargetSubmissionCount'] = len(initial_fetch[TARGET_CONFIG]['submissionIds'])
        guard.check()
        name = 'lims-owned-' + ROOT.name.lower() + '-jobs-off'; names.append(name)
        watch = c.ZeroWriteWatch(database)
        receipt['jobsOffReadiness'] = c.start_and_wait(ROOT, name, database_dir, ROOT / 'assets', guard,
            'candidate-jobs-off', watch, jobs=False, production=False)
        require(effective_environment_hash(c.inspect(name), True) == env_hash, 'Candidate environment differs')
        receipt['jobsOffStartup'] = import_startup_checks(ROOT, name, database, expected, 'candidate-jobs-off', c, s)
        receipt.update(c.probes(ROOT, name, database, expected))
        watch.check(); watch.close(); watch = None
        c.owned_stop(ROOT, name, 'candidate-jobs-off-stop')
        require_owned_writers_stopped(database_dir)
        _, jobs_off_seal = sealed_stopped_state(ROOT, 'after-jobs-off-stopped', database,
            guard, installed=True, expected=expected)
        receipt['jobsOffStoppedSeal'] = jobs_off_seal
        receipt['databaseChangesBeforeJobs'] = 0
        name = 'lims-owned-' + ROOT.name.lower() + '-jobs-on'; names.append(name)
        watch = CopyObservation(database)
        receipt['jobsOnReadiness'] = c.start_and_wait(ROOT, name, database_dir, ROOT / 'assets', guard,
            'candidate-jobs-on', watch, jobs=True, production=False)
        receipt['jobsOnStartup'] = import_startup_checks(ROOT, name, database, expected, 'candidate-jobs-on', c, s, jobs_guard=watch)
        ready = receipt['jobsOnReadiness']; base = ready['baseUrl']
        receipt['peakBytes'] = max(receipt['jobsOffStartup']['startupMemory']['peakBytes'],
            receipt['jobsOnStartup']['startupMemory']['peakBytes'])
        first_deadline = time.monotonic() + 600
        while True:
            log = sample(name, base, guard, watch, env_hash, receipt)
            completions = completed_syncs(log)
            if completions:
                break
            require(time.monotonic() < first_deadline, 'First real scheduled sync did not complete')
            time.sleep(10)
        first = completions[0]
        if first['newSamples'] or first['skipped']:
            require('[KOBO] Sync complete for ' + TARGET_LAB + ':' in log, 'First actual intake completion missing')
        receipt['firstScheduledSync'] = first
        # A conservative superset is captured using original cursors, before
        # sealing the first state. Any arrival race fails closed, never rewinds.
        first_fetch = capture(ROOT / 'fresh-live-backup.db', list(configs))
        receipt['firstUpstreamSha256'] = write_new('upstream-first-completion.json', first_fetch)
        first_ids = {key: value['submissionIds'] for key, value in first_fetch.items()}
        s.consistent_backup(database, ROOT / 'after-first-sync.db')
        receipt['firstDatabaseSha256'] = s.sha(ROOT / 'after-first-sync.db')
        first_state = verify_copy(installed_baseline, ROOT / 'after-first-sync.db', expected_table_count=106,
            fetched_ids=first_ids, refusal_configs=refusal_configs)
        receipt['firstPreservationSha256'] = write_new('first-sync-preservation.json', first_state)
        receipt['firstIntakeSummary'] = intake_summary(first_state, first)
        # Only configs observed completing have fetched the whole retained set.
        # For other configs, protect every id actually added before this seal.
        prior_ids = {}
        for key, config in configs.items():
            completed = completed_syncs(log, config['labId'])
            prior_ids[key] = first_ids[key] if completed else first_state['newSubmissionIds'].get(key, [])
        require(prior_ids[TARGET_CONFIG] == first_ids[TARGET_CONFIG], 'First crash-path fetch set not sealed')
        receipt['priorFetchedIds'] = prior_ids
        end = observation_end(first['utc'], ready['readyUtc'], interval)
        while True:
            log = sample(name, base, guard, watch, env_hash, receipt)
            completions = completed_syncs(log)
            now = time.time()
            if now >= end and len(completions) >= 2:
                break
            require(now <= end + 180, 'Natural second sync did not complete before the proof deadline')
            time.sleep(min(30, max(1, end - now)))
        second = completions[1]
        receipt['secondScheduledSync'] = second
        receipt['observedThroughUtc'] = s.utc()
        receipt['healthySoakSeconds'] = utc_seconds(receipt['observedThroughUtc']) - utc_seconds(ready['readyUtc'])
        require_final_observation(first, second, ready['readyUtc'], receipt['observedThroughUtc'], interval,
            c.inspect(name)['RestartCount'], receipt['peakBytes'], receipt['healthySoakSeconds'])
        for stream in ['Stdout', 'Stderr']:
            path = ROOT / ('candidate-jobs-on-' + stream.lower() + '.log')
            with path.open('x', encoding='utf-8', newline='') as out:
                out.write(receipt.pop('_scheduler' + stream))
            path.chmod(0o400)
            receipt['scheduler' + stream + 'Sha256'] = s.sha(path)
        receipt['commitVersionsObserved'] = watch.versions
        watch.close(); watch = None
        c.owned_stop(ROOT, name, 'candidate-jobs-on-stop')
        receipt['ownedWriterStopped'] = True
        # Include committed WAL in this final consistent backup. Never open the
        # running/raw main database as immutable or discard its WAL.
        require_owned_writers_stopped(database_dir)
        _, final_seal = sealed_stopped_state(ROOT, 'after-second-stopped', database, guard, installed=True)
        final_backup = pathlib.Path(final_seal['backupPath'])
        receipt['finalStoppedSeal'] = final_seal
        final_fetch = capture(ROOT / 'fresh-live-backup.db', list(configs))
        receipt['secondUpstreamSha256'] = write_new('upstream-second-completion.json', final_fetch)
        final_ids = {key: value['submissionIds'] for key, value in final_fetch.items()}
        second_state = verify_copy(ROOT / 'after-first-sync.db', final_backup, expected_table_count=106,
            prior_fetched_ids=prior_ids, fetched_ids=final_ids, refusal_configs=refusal_configs)
        receipt['secondPreservationSha256'] = write_new('second-sync-preservation.json', second_state)
        full_state = verify_copy(installed_baseline, final_backup, expected_table_count=106,
            fetched_ids=final_ids, refusal_configs=refusal_configs)
        receipt['fullPreservationSha256'] = write_new('full-copy-preservation.json', full_state)
        target_new_ids = second_state['newSubmissionIds'].get(TARGET_CONFIG, [])
        receipt['secondIntakeSummary'] = intake_summary(second_state, second)
        receipt['secondGenuinelyNewSubmissionIds'] = target_new_ids
        receipt['protectedTableCount'] = full_state['protectedTableCount']
        receipt['protectedReceiptCount'] = 39
        receipt['originalProtectedReceiptCount'] = 38
        receipt['originalProtectedTableCount'] = 104
        receipt['allOriginalRowsAndSchemaPreserved'] = True
        receipt['memoryLimitBytes'] = LIMIT; receipt['nodeOptions'] = ''
        receipt['retainedAcceptance'] = s.verify_retained_acceptance(ROOT / 'after-second-stopped' / 'scratch')
        require(c.inspect('soilfer-lims')['Image'] == live['Image'], 'Live image changed during isolated proof')
        require(s.sha(HISTORICAL_ROOT / 'production-receipt.json') == HISTORICAL_RECEIPT_SHA, 'Historical receipt changed')
        guard.check()
        receipt['status'] = 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF'
    except BaseException as error:
        receipt['status'] = 'FAILED_NEW_IMPORT_NATURAL_KOBO_PROOF'
        receipt['error'] = str(error)
    finally:
        if watch is not None:
            watch.close()
        for name in names:
            try:
                c.owned_stop(ROOT, name, 'final-retained-stop-' + name.rsplit('-', 1)[-1])
            except BaseException as error:
                receipt['status'] = 'FAILED_NEW_IMPORT_NATURAL_KOBO_PROOF'
                receipt.setdefault('stopErrors', []).append(str(error))
        ledger = ROOT / 'disk-allocation-observations.jsonl'
        if ledger.exists():
            receipt['diskAllocationObservationsSha256'] = s.sha(ledger)
            ledger.chmod(0o400)
        receipt.pop('_schedulerStdout', None); receipt.pop('_schedulerStderr', None)
        receipt['completedUtc'] = s.utc()
        write_new('rehearsal-receipt.json', receipt)
        lock.close()
    print(json.dumps({'status': receipt['status'], 'root': str(ROOT),
        'receiptSha256': s.sha(ROOT / 'rehearsal-receipt.json')}), flush=True)
    return 0 if receipt['status'] == 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF' else 1


if __name__ == '__main__':
    sys.exit(main())
