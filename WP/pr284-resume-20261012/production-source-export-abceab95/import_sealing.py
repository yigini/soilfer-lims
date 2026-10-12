"""PROPOSED detached #200 seals, not execution authority.

The physical triple sampler/copy routines below are verbatim from reviewed
f5cb1817 deploy_runtime.py. SQLite opens and backup writes touch retained
detached raw/scratch copies only. No original checkpoint, restore or cleanup.
The new coordinator must independently establish that all target writers are
stopped and bind both baseline and additive-state authorities before calling.
"""
import pathlib
import re
import stat

import release_support as s
import startup_common as c
from import_preservation import digest as sha, require
from import_stage import baseline

POLICY = 'DETACHED_STOPPED_IMPORT_WAL_AWARE_SEAL'


def triple_state(database):
    """Physical reads only. Never connect SQLite to the stopped originals."""
    result = {}
    for suffix in ['', '-wal', '-shm']:
        path = pathlib.Path(str(database) + suffix)
        require(not path.is_symlink(), 'SQLite triple contains a symlink')
        if not path.exists():
            result[suffix] = None
            continue
        before = path.stat()
        require(stat.S_ISREG(before.st_mode), 'SQLite triple is not a regular file')
        digest = sha(path); after = path.stat()
        keys = ['st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_mode']
        require(all(getattr(before, key) == getattr(after, key) for key in keys),
            'Original SQLite file changed during physical sampling')
        result[suffix] = {'sha256': digest, 'bytes': after.st_size, 'inode': after.st_ino,
            'device': after.st_dev, 'mtimeNs': after.st_mtime_ns, 'mode': stat.S_IMODE(after.st_mode)}
    require(result[''] is not None, 'Original main database is missing')
    return result


def copy_triple(database, directory, guard):
    before = triple_state(database)
    directory.mkdir(mode=0o700)
    target = directory / 'dev.db'
    for suffix, row in before.items():
        if row is None:
            continue
        source = pathlib.Path(str(database) + suffix)
        copied = pathlib.Path(str(target) + suffix)
        with source.open('rb') as src, copied.open('xb') as out:
            since_check = 0
            while block := src.read(1024 * 1024):
                out.write(block); since_check += len(block)
                if since_check >= 32 * 1024 * 1024:
                    out.flush(); guard.check(); since_check = 0
        copied.chmod(0o400)
        require(sha(copied) == row['sha256'] and copied.stat().st_size == row['bytes'],
            'Copied SQLite file differs: ' + suffix)
        guard.check()
    after = triple_state(database)
    require(after == before, 'Original SQLite triple changed during copy')
    c.write_new(directory / 'original-triple.json', {'before': before, 'after': after})
    return target, before


def logical_count_guard(main_only, folded):
    # A committed additive migration may still be in the detached WAL. Permit
    # only its two table names to be absent from main-only, and require every
    # main-only table/count to survive WAL folding. Full authority is checked
    # separately against the original consistent backup by the delta verifier.
    before, after = set(main_only['tables']), set(folded['tables'])
    require(before <= after and after - before <= {'ImportTemplate', 'InstrumentImportReceipt'} and
        all(folded['tables'][name]['count'] >= row['count'] for name, row in main_only['tables'].items()),
        'WAL-folded table/count authority differs')


def logical_equality(actual, expected):
    require(actual == expected, 'Complete WAL-aware logical state changed before jobs')


def sealed_stopped_state(root, label, database, guard, installed=False, expected=None):
    """Seal raw originals; all normal SQLite opens/backup writes use scratch copies."""
    root, database = pathlib.Path(root), pathlib.Path(database)
    require(re.fullmatch('[a-z0-9-]+', label or '') and root.is_dir() and not root.is_symlink(),
        'Require one safe stopped seal label/root')
    directory = root / label; directory.mkdir(mode=0o700)
    raw, original = copy_triple(database, directory / 'raw', guard)
    scratch, _ = copy_triple(raw, directory / 'scratch', guard)
    # Scratch modes allow SQLite's own WAL/SHM handling on copies only.
    for suffix in ['', '-wal', '-shm']:
        path = pathlib.Path(str(scratch) + suffix)
        if path.exists(): path.chmod(0o600)
    main_only = s.snapshot(raw, immutable=True)
    folded = s.snapshot(scratch)
    logical_count_guard(main_only, folded)
    baseline(folded, installed=installed)
    if expected is not None: logical_equality(folded, expected)
    c.write_new(directory / 'main-only-state.json', main_only)
    c.write_new(directory / 'wal-aware-state.json', folded)
    backup = directory / 'dev-stopped-backup.db'
    s.consistent_backup(scratch, backup)
    c.exact_state(backup, folded, immutable=True)
    require(triple_state(database) == original, 'Original triple changed during detached SQLite inspection')
    raw_state = triple_state(raw)
    require(all((raw_state[suffix] is None if row is None else
        raw_state[suffix]['sha256'] == row['sha256'] and raw_state[suffix]['bytes'] == row['bytes'])
        for suffix, row in original.items()), 'Sealed raw triple changed during logical inspection')
    guard.check()
    evidence = {'policy': POLICY, 'originalFiles': original,
        'rawFiles': raw_state, 'mainOnlyStateSha256': sha(directory / 'main-only-state.json'),
        'logicalStateSha256': sha(directory / 'wal-aware-state.json'), 'backupSha256': sha(backup),
        'countsIncludeWal': True, 'matchesExpected': expected is not None,
        'protectedTableCount': 106 if installed else 104, 'protectedReceiptCount': 39 if installed else 38,
        'backupPath': str(backup), 'physical': s.physical(database)}
    c.write_new(directory / 'sealed-state.json', evidence)
    return folded, evidence


