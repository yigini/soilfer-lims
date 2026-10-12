"""Proposed one-shot #200 dry/apply/repeat and independent stopped seals.

This module performs no I/O at import. Its caller must hold the separately
reviewed source/kit authority and ensure the target has no active writer.
There is no resume, retry, recovery, restore or historical installer path.
"""
import json
import pathlib
import stat
import time

from import_installation import DRY_COPY_POLICY, measured_cli, validate_apply, validate_plan
from import_preservation import assets, require, verify_import_installation

REPEAT_POLICY = 'EXACT_MAIN_EMPTY_WAL_BOUNDED_SHM_FULL_DETACHED_EQUALITY'
EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'


def readonly_repeat_physical(before, after):
    """Readonly WAL opens may allocate sidecars; main and committed pages cannot change."""
    require(set(before) == set(after) == {'', '-wal', '-shm'} and
        before[''] is not None and before[''] == after[''],
        'Immediate repeat changed original main bytes or attributes')
    for triple in [before, after]:
        wal, shm = triple['-wal'], triple['-shm']
        require(wal is None or (type(wal['bytes']) is int and wal['bytes'] == 0 and
            wal['sha256'] == EMPTY_SHA256), 'Immediate repeat has nonempty WAL or invalid empty hash')
        require(shm is None or (type(shm['bytes']) is int and shm['bytes'] == 32768),
            'Immediate repeat has an unbounded SHM sidecar')


def write_new(root, name, value, support):
    path = pathlib.Path(root) / name
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
    path.chmod(0o400)
    return support.sha(path)


def baseline(state, installed=False):
    require(len(state['tables']) == (106 if installed else 104) and
        state['tables']['_schema_migrations']['count'] == (39 if installed else 38) and
        state['integrity'] == 'ok' and state['foreignKeyViolations'] == 0,
        'Exact #200 stage baseline differs')


def prepare_dry_copy(root, before_backup, expected, guard, support):
    directory = root / 'import-dry-database'
    require(not directory.exists() and not directory.is_symlink(), 'Never reuse a dry-run copy')
    directory.mkdir(mode=0o700)
    copied = directory / 'dev.db'
    with before_backup.open('rb') as source, copied.open('xb') as target:
        copied_since_check = 0
        while block := source.read(1024 * 1024):
            target.write(block); copied_since_check += len(block)
            if copied_since_check >= 32 * 1024 * 1024:
                target.flush(); guard.check(); copied_since_check = 0
    copied.chmod(0o400)
    require(support.sha(copied) == support.sha(before_backup) and
        support.snapshot(copied, immutable=True) == expected, 'Separate dry-run backup copy differs')
    guard.check()
    return directory


def install_once(root, image, database_dir, before_backup, before_physical, source_directory, guard, support, seal,
        production=False):
    root, database_dir, before_backup = map(pathlib.Path, (root, database_dir, before_backup))
    require(root.is_dir() and not root.is_symlink() and before_backup.is_file() and
        not before_backup.is_symlink() and before_backup.resolve().is_relative_to(root.resolve()) and
        stat.S_IMODE(before_backup.stat().st_mode) == 0o400,
        'Native stage needs the original stopped immutable backup')
    live_parent = pathlib.Path(support.LIVE).parent.resolve()
    require(type(production) is bool and (database_dir.resolve() != live_parent if not production else
        database_dir.resolve() == live_parent and root.resolve().parent == pathlib.Path('/opt/lims/releases') and
        root.name.startswith('instrument-import-release-')), 'Proof stage cannot use the live database parent')
    require(not database_dir.is_symlink() and (production or database_dir.resolve().is_relative_to(root.resolve())),
        'Proof database must remain inside its isolated root')
    attempt = root / 'instrument-import-attempt.json'
    require(not attempt.exists(), 'Native installer attempt is single-use and cannot resume')
    database = database_dir / 'dev.db'
    before_sha = support.sha(before_backup)
    expected = support.snapshot(before_backup, immutable=True)
    baseline(expected)
    assets(source_directory)  # Refuse wrong source before any installer attempt.
    require(support.physical(database) == before_physical,
        'Target physical triple differs from the separately sealed stopped authority')
    guard.check()
    dry_directory = prepare_dry_copy(root, before_backup, expected, guard, support)
    # Persist intent BEFORE even a dry-run. A failure or NO_OP cannot reopen an
    # old image or replay this stage after a default-entrypoint/installer attempt.
    write_new(root, attempt.name, {'status': 'ATTEMPTED_FORWARD_ONLY', 'image': image,
        'beforeBackupSha256': before_sha, 'productionRecovery': 'SEPARATELY_AUDITED_FORWARD_FIX_ONLY'}, support)
    physical = support.physical(database)
    dry, dry_measurement = measured_cli(root, image, dry_directory, '--dry-run', 'import-dry', support)
    validate_plan(dry, 'PRE_200', 'DRY_RUN')
    require(support.physical(database) == physical,
        'Dry-run changed the stopped original target')
    dry_copy = dry_directory / 'dev.db'
    require(support.sha(dry_copy) == before_sha and stat.S_IMODE(dry_copy.stat().st_mode) == 0o400 and
        support.snapshot(dry_copy, immutable=True) == expected, 'Dry-run changed its separate immutable main copy')
    dry_files = {}
    require({path.name for path in dry_directory.iterdir()} <= {'dev.db', 'dev.db-wal', 'dev.db-shm'},
        'Unexpected separate dry-run allocation')
    for path in dry_directory.iterdir():
        require(path.is_file() and not path.is_symlink(), 'Dry-run copy contains a link or non-file')
        if path.name == 'dev.db-wal': require(path.stat().st_size == 0, 'Readonly dry-run wrote WAL frames')
        if path.name == 'dev.db-shm': require(path.stat().st_size == 32768, 'Unexpected readonly dry-run SHM size')
        path.chmod(0o400)
        dry_files[path.name] = {'sha256': support.sha(path), 'bytes': path.stat().st_size}
    dry_authority = {'policy': DRY_COPY_POLICY, 'beforeBackupSha256': before_sha,
        'mainSha256': support.sha(dry_copy), 'targetPhysicalTriplePreserved': True, 'files': dry_files}
    dry_authority_sha = write_new(root, 'import-dry-copy-authority.json', dry_authority, support)
    guard.check()
    require(support.sha(before_backup) == before_sha, 'Original stopped backup changed before apply')
    applied, apply_measurement = measured_cli(root, image, database_dir, '--apply', 'import-apply', support)
    original_hash = validate_apply(applied)
    guard.check()
    # The separately bound coordinator seals physical originals through detached
    # scratch triples. This stage never connects SQLite to the original target.
    sealed = seal('after-import-stopped', installed=True)
    after_backup = pathlib.Path(sealed['backupPath'])
    require(after_backup.is_file() and not after_backup.is_symlink() and
        after_backup.resolve().is_relative_to(root.resolve()) and after_backup.resolve() != before_backup.resolve(),
        'Post-install seal is outside the one release root or overwrites the original')
    require(stat.S_IMODE(after_backup.stat().st_mode) == 0o400, 'Post-install backup is not immutable')
    delta = verify_import_installation(before_backup, after_backup, source_directory, original_hash)
    delta_sha = write_new(root, 'import-install-preservation.json', delta, support)
    installed = support.snapshot(after_backup, immutable=True)
    baseline(installed, installed=True)
    require(support.physical(database) == sealed['physical'],
        'Stopped target differs from its independent physical seal')
    physical = support.physical(database)
    repeated, repeat_measurement = measured_cli(root, image, database_dir, '--apply', 'import-repeat', support)
    validate_plan(repeated, 'COMPLETE_200', 'NO_OP')
    readonly_repeat_physical(physical, support.physical(database))
    # Do not open SQLite on originals or disregard WAL. Retain another complete
    # detached seal and require every installed row/schema/receipt to be equal.
    repeat_seal_started = time.monotonic()
    repeat_seal = seal('after-repeat-stopped', installed=True)
    readonly_repeat_physical(sealed['originalFiles'], repeat_seal['originalFiles'])
    repeat_backup = pathlib.Path(repeat_seal['backupPath'])
    require(repeat_backup.is_file() and not repeat_backup.is_symlink() and
        repeat_backup.resolve().is_relative_to(root.resolve()) and
        repeat_backup.resolve() not in [before_backup.resolve(), after_backup.resolve()] and
        stat.S_IMODE(repeat_backup.stat().st_mode) == 0o400,
        'Immediate repeat seal must be a new immutable detached backup')
    require(support.snapshot(repeat_backup, immutable=True) == installed,
        'Immediate repeat changed full installed state')
    require(repeat_seal['logicalStateSha256'] == sealed['logicalStateSha256'],
        'Immediate repeat detached full-state seal differs')
    repeat_seal_elapsed = time.monotonic() - repeat_seal_started
    repeat_authority = {'policy': REPEAT_POLICY, 'mainBytesAndAttributesPreserved': True,
        'fullInstalledStateEqual': True, 'beforePhysical': sealed['originalFiles'],
        'afterPhysical': repeat_seal['originalFiles'],
        'beforeLogicalStateSha256': sealed['logicalStateSha256'],
        'afterLogicalStateSha256': repeat_seal['logicalStateSha256']}
    repeat_authority_sha = write_new(root, 'import-repeat-preservation.json', repeat_authority, support)
    require(support.sha(before_backup) == before_sha, 'Original stopped backup changed')
    guard.check()
    return {'status': 'EXACT_NATIVE_IMPORT_DRY_APPLY_REPEAT_PASS', 'originalTableCount': 104,
        'originalReceiptCount': 38, 'installedTableCount': 106, 'installedReceiptCount': 39,
        'originalRowsSha256': original_hash, 'beforeBackupSha256': before_sha,
        'afterBackupSha256': support.sha(after_backup), 'preservationSha256': delta_sha,
        'measurements': [dry_measurement, apply_measurement, repeat_measurement],
        'repeatPhysicalPolicy': REPEAT_POLICY, 'repeatStoppedSeal': repeat_seal,
        'repeatStoppedSealElapsedSeconds': repeat_seal_elapsed,
        'repeatPreservationSha256': repeat_authority_sha,
        'dryRunCopy': dry_authority, 'dryRunCopyAuthoritySha256': dry_authority_sha,
        'dry': dry, 'apply': applied, 'repeat': repeated, 'repeatDatabaseChanges': 0,
        'allOriginalRowsAndSchemaPreserved': True, 'forwardOnly': True}, installed
