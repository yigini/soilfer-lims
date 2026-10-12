"""Proposed one-shot #200 dry/apply/repeat and independent stopped seals.

This module performs no I/O at import. Its caller must hold the separately
reviewed source/kit authority and ensure the target has no active writer.
There is no resume, retry, recovery, restore or historical installer path.
"""
import json
import pathlib
import stat

from import_installation import measured_cli, validate_apply, validate_plan
from import_preservation import assets, require, verify_import_installation


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


def install_once(root, image, database_dir, before_backup, before_physical, source_directory, guard, support, seal):
    root, database_dir, before_backup = map(pathlib.Path, (root, database_dir, before_backup))
    require(root.is_dir() and not root.is_symlink() and before_backup.is_file() and
        not before_backup.is_symlink() and before_backup.resolve().is_relative_to(root.resolve()) and
        stat.S_IMODE(before_backup.stat().st_mode) == 0o400,
        'Native stage needs the original stopped immutable backup')
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
    # Persist intent BEFORE even a dry-run. A failure or NO_OP cannot reopen an
    # old image or replay this stage after a default-entrypoint/installer attempt.
    write_new(root, attempt.name, {'status': 'ATTEMPTED_FORWARD_ONLY', 'image': image,
        'beforeBackupSha256': before_sha, 'productionRecovery': 'SEPARATELY_AUDITED_FORWARD_FIX_ONLY'}, support)
    physical = support.physical(database)
    dry, dry_measurement = measured_cli(root, image, database_dir, '--dry-run', 'import-dry', support)
    validate_plan(dry, 'PRE_200', 'DRY_RUN')
    require(support.physical(database) == physical,
        'Dry-run changed the stopped original target')
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
    require(support.physical(database) == physical,
        'Immediate repeat changed original bytes or full installed state')
    require(support.sha(before_backup) == before_sha, 'Original stopped backup changed')
    guard.check()
    return {'status': 'EXACT_NATIVE_IMPORT_DRY_APPLY_REPEAT_PASS', 'originalTableCount': 104,
        'originalReceiptCount': 38, 'installedTableCount': 106, 'installedReceiptCount': 39,
        'originalRowsSha256': original_hash, 'beforeBackupSha256': before_sha,
        'afterBackupSha256': support.sha(after_backup), 'preservationSha256': delta_sha,
        'measurements': [dry_measurement, apply_measurement, repeat_measurement],
        'dry': dry, 'apply': applied, 'repeat': repeated, 'repeatDatabaseChanges': 0,
        'allOriginalRowsAndSchemaPreserved': True, 'forwardOnly': True}, installed
