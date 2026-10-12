"""Fresh empty-root baseline confirmation pinned by #162/6113782477.

Original and V2 bytes stay unchanged. Only this constructor may resample a
confirmed vanished process directory; every failed scan has zero credit.
V2's mid-run sampling and measured-core deallocation confirmation are inherited.
"""
import os
import pathlib
import re
import time
import release_support as s
import startup_common as c
from known_core_disk_guard_v2 import KnownCoreDiskGuard as V2Guard
from known_core_disk_guard import core_allocations

POLICY = 'CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE'
ATTEMPTS_MAX = 3
DEADLINE_SECONDS = 10
EMPTY_FILES = set('''known_core_disk_guard.py known_core_disk_guard_v2.py
known_core_disk_guard_v3.py release_support.py startup_common.py
rehearse_runtime.py proof_contract.py kobo_copy_preservation.py capture_kobo_fetch.py
postflight-roles.cjs postflight-auth.cjs postflight-reference.cjs postflight-qc-runs.cjs
postflight-policy.cjs readonly-smoke.cjs source-index.json target-pin.json
candidate-rehearsal-authority.json unit.stdout unit.stderr disk-allocation-observations.jsonl'''.split())


def require_empty_root(root):
    """Positive empty proof layout only: never baseline a copy or started kit."""
    if root.parent != pathlib.Path('/opt/lims/releases') or not root.name.startswith('runtime-kobo-proof-'):
        raise RuntimeError('Baseline confirmation requires a new empty isolated proof root')
    for path in root.iterdir():
        if path.name not in EMPTY_FILES or path.is_symlink() or not path.is_file():
            raise RuntimeError('Non-empty baseline root; no copy, assets or extra allocation permitted')


def confirm_baseline(attempt, check_empty, record, reserve, lexists=os.path.lexists,
                     clock=time.monotonic, sleeper=time.sleep):
    """Return only one complete clean sample; never combine failed attempts."""
    deadline = clock() + DEADLINE_SECONDS
    for number in range(1, ATTEMPTS_MAX + 1):
        check_empty()
        value = attempt()
        value['baselineAttempt'] = number
        errors = value['baselineEnumerationErrors']
        # Physical free space is required for every attempt, including rejected
        # scans. All failures retain their actual measurements in the ledger.
        if min(value['freeBytes'].values()) < reserve:
            record({**value, 'stage': 'baseline-attempt-refused-reserve', 'creditBytes': 0})
            raise RuntimeError('Reserve floor refused')
        check_empty()
        if clock() > deadline:
            record({**value, 'stage': 'baseline-attempt-refused-late', 'creditBytes': 0})
            raise RuntimeError('Baseline confirmation exceeded 10-second deadline')
        if not errors:
            record({**value, 'stage': 'baseline', 'baselineEnumerationErrorCount': 0})
            return value
        confirmed = []
        for error in errors:
            if error['errorType'] not in ['FileNotFoundError', 'ProcessLookupError'] or not re.fullmatch(r'/proc/\d+', error['path']):
                record({**value, 'stage': 'baseline-attempt-refused-unreadable', 'creditBytes': 0})
                raise RuntimeError('Unreadable baseline allocation; refuse attribution credit')
            exists = lexists(error['path'])
            confirmed.append({'path': error['path'], 'lexistsAfterScan': exists})
            if exists:
                record({**value, 'stage': 'baseline-attempt-refused-present-pid',
                    'confirmedProcesses': confirmed, 'creditBytes': 0})
                raise RuntimeError('Baseline process still exists or pid was reused')
        record({**value, 'stage': 'baseline-attempt-refused-vanished-process',
            'confirmedProcesses': confirmed, 'creditBytes': 0})
        if number == ATTEMPTS_MAX:
            raise RuntimeError('Three incomplete baseline attempts; refuse attribution credit')
        remaining = deadline - clock()
        if remaining <= 0:
            raise RuntimeError('Baseline confirmation exceeded 10-second deadline')
        sleeper(min(1, remaining))
    raise RuntimeError('No complete baseline')


class KnownCoreDiskGuard(V2Guard):
    def __init__(self, root, reserve):
        self.root, self.reserve = root, reserve

        def attempt():
            errors = []
            first_cores = core_allocations(errors=errors)
            first_root = c.allocation(root)
            free = s.disk_free()
            root_bytes = max(first_root, c.allocation(root))
            baseline = {}
            for row in first_cores + core_allocations(errors=errors):
                key = (row['device'], row['inode'])
                if key not in baseline or baseline[key]['allocatedBytes'] < row['allocatedBytes']:
                    baseline[key] = row
            return {'freeBytes': free, 'rootAllocatedBytes': root_bytes,
                'coreAllocations': list(baseline.values()), 'baselineEnumerationErrors': errors,
                'baselineEnumerationErrorCount': len(errors),
                'devices': {path: pathlib.Path(path).stat().st_dev for path in free},
                'rootDevice': root.stat().st_dev}

        accepted = confirm_baseline(attempt, lambda: require_empty_root(root), self.record, reserve)
        self.before = accepted['freeBytes']
        self.root_before = accepted['rootAllocatedBytes']
        self.core_before = accepted['coreAllocations']
        self.baseline_errors = []
        self.baseline_attempt = accepted['baselineAttempt']
        self.devices = accepted['devices']
        self.root_device = accepted['rootDevice']
        self.previous_paired_success = []
