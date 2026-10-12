"""Unused frozen-kit baseline adapter for #162/6113922488.

The measured proof guards stay unchanged. Only this constructor substitutes
the positive frozen-kit layout check; all mid-run methods remain V2's.
"""
import hashlib
import json
import pathlib
import release_support as s
import startup_common as c
from known_core_disk_guard_v2 import KnownCoreDiskGuard as V2Guard
from known_core_disk_guard_v3 import confirm_baseline, ATTEMPTS_MAX, DEADLINE_SECONDS, POLICY
from known_core_disk_guard import core_allocations


def require_frozen_root(root, manifest, manifest_sha, gate_sha):
    if root.parent != pathlib.Path('/opt/lims/releases') or not root.name.startswith('instrument-import-release-') or \
            str(root) != manifest['root']:
        raise RuntimeError('Baseline requires the exact new frozen release root')
    # These two authority files bind the kit and gate. They are required frozen
    # files, not unmeasured outputs. Unit output goes to the systemd journal.
    required = {**manifest['files'], 'prepared-manifest.json': manifest_sha, 'production-gate.json': gate_sha}
    if any(pathlib.PurePosixPath(name).name != name or name.startswith('production-receipt') or
            name.endswith(('.db', '.tar.gz')) for name in required):
        raise RuntimeError('Unsafe frozen baseline file set')
    entries = {path.name: path for path in root.iterdir()}
    if set(entries) - set(required) - {'execution-attempt.json', 'disk-allocation-observations.jsonl'}:
        raise RuntimeError('Extra allocation in unused frozen kit')
    for name, path in entries.items():
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('Frozen baseline contains a directory or symlink')
    for name, digest in required.items():
        path = entries.get(name)
        if path is None or path.stat().st_mode & 0o777 != 0o400 or \
                hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise RuntimeError('Frozen baseline file missing or changed: ' + name)
    attempt = entries.get('execution-attempt.json')
    if attempt is None or attempt.stat().st_mode & 0o777 != 0o400:
        raise RuntimeError('Exclusive immutable execution attempt missing')
    bound = json.loads(attempt.read_bytes())
    gate = json.loads(entries['production-gate.json'].read_bytes())
    if bound['gateSha256'] != gate_sha or bound['head'] != manifest['head'] or \
            gate['executionRoot'] != str(root) or gate['manifestSha256'] != manifest_sha or \
            gate['head'] != manifest['head']:
        raise RuntimeError('Frozen baseline execution authority differs')


class KnownCoreDiskGuard(V2Guard):
    def __init__(self, root, reserve, manifest, manifest_sha, gate_sha):
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

        accepted = confirm_baseline(attempt, lambda: require_frozen_root(root, manifest, manifest_sha, gate_sha),
            self.record, reserve)
        self.before = accepted['freeBytes']
        self.root_before = accepted['rootAllocatedBytes']
        self.core_before = accepted['coreAllocations']
        self.baseline_errors = []
        self.baseline_attempt = accepted['baselineAttempt']
        self.devices = accepted['devices']
        self.root_device = accepted['rootDevice']
        self.previous_paired_success = []
