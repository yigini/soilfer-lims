"""Prepare a new reviewable seal adapter; never execute a seal or modify historical source."""
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
historical = subprocess.check_output(['git', 'show',
    'f5cb18176a9d6efa3560182534f57280af71f66a:WP/runtime-recovery-kobo/deploy_runtime.py']).decode('utf-8')
physical = historical[historical.index('def triple_state('):historical.index('def logical_count_guard(')]
seal = historical[historical.index('def sealed_stopped_state('):historical.index('def failed_wal_authority(')]
seal = seal.replace('def sealed_stopped_state(root, label, database, guard, expected=None):',
    'def sealed_stopped_state(root, label, database, guard, installed=False, expected=None):')
seal = seal.replace("    directory = root / label; directory.mkdir(mode=0o700)",
    "    root, database = pathlib.Path(root), pathlib.Path(database)\n"
    "    require(re.fullmatch('[a-z0-9-]+', label or '') and root.is_dir() and not root.is_symlink(),\n"
    "        'Require one safe stopped seal label/root')\n"
    "    directory = root / label; directory.mkdir(mode=0o700)")
seal = seal.replace("    require(len(folded['tables']) == 104 and folded['tables']['_schema_migrations']['count'] == 38 and\n"
    "        folded['integrity'] == 'ok' and folded['foreignKeyViolations'] == 0,\n"
    "        'Stopped WAL-aware logical state refused')", "    baseline(folded, installed=installed)")
seal = seal.replace("'policy': WAL_RECOVERY_POLICY", "'policy': POLICY")
seal = seal.replace("'protectedTableCount': 104, 'protectedReceiptCount': 38}",
    "'protectedTableCount': 106 if installed else 104, 'protectedReceiptCount': 39 if installed else 38,\n"
    "        'backupPath': str(backup), 'physical': s.physical(database)}")
header = '''"""PROPOSED detached #200 seals, not execution authority.

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


'''
guards = '''def logical_count_guard(main_only, folded):
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


'''
(root / 'WP/pr284-release/import_sealing.py').write_text(header + physical + guards + seal,
    encoding='utf-8', newline='\n')
print('PROPOSED_SOURCE_ONLY: physical helper bytes retained verbatim; no host operation performed')
