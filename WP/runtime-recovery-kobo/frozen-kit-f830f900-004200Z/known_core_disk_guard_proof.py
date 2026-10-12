"""Positive hash-bound initial proof layout; unchanged V3 confirmation and V2 checks.

Only this constructor substitutes the initial file-layout check. All source and
authority bytes are measured, never deleted, moved, hidden or credited away.
"""
import hashlib
import json
import pathlib
import release_support as s
import startup_common as c
from known_core_disk_guard_v2 import KnownCoreDiskGuard as V2Guard
from known_core_disk_guard_v3 import confirm_baseline, EMPTY_FILES
from known_core_disk_guard import core_allocations

POLICY = 'EXACT_HASHED_PROOF_AUTHORITY_LAYOUT'
OUTPUT_FILES = {'unit.stdout', 'unit.stderr', 'disk-allocation-observations.jsonl'}
AUTHORITY_FILES = {'source-index.json', 'target-pin.json', 'candidate-rehearsal-authority.json'}
SOURCE_FILES = (EMPTY_FILES - OUTPUT_FILES - AUTHORITY_FILES) | {
    'build_candidate.py', 'prepare_candidate_build.py', 'export_launch_runtime_proof.py',
    'known_core_disk_guard_proof.py'}


def require_proof_root(root, source, authority_hashes):
    if root.parent != pathlib.Path('/opt/lims/releases') or not root.name.startswith('runtime-kobo-proof-'):
        raise RuntimeError('Baseline requires a new isolated proof root')
    if set(source['files']) != SOURCE_FILES or set(authority_hashes) != AUTHORITY_FILES:
        raise RuntimeError('Proof baseline requires the complete fixed source and authority set')
    required = {name: row['sha256'] for name, row in source['files'].items()}
    required.update(authority_hashes)
    entries = {path.name: path for path in root.iterdir()}
    if set(entries) - set(required) - OUTPUT_FILES:
        raise RuntimeError('Extra allocation in initial proof root')
    for path in entries.values():
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('Initial proof root contains a directory or symlink')
    for name, digest in required.items():
        path = entries.get(name)
        if path is None or path.stat().st_mode & 0o777 != 0o400 or \
                hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise RuntimeError('Immutable proof authority missing or changed: ' + name)
    if json.loads(entries['source-index.json'].read_bytes()) != source:
        raise RuntimeError('Proof source index differs from verified authority')


class KnownCoreDiskGuard(V2Guard):
    def __init__(self, root, reserve, source, authority_hashes):
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

        accepted = confirm_baseline(attempt, lambda: require_proof_root(root, source, authority_hashes),
            self.record, reserve)
        self.before = accepted['freeBytes']
        self.root_before = accepted['rootAllocatedBytes']
        self.core_before = accepted['coreAllocations']
        self.baseline_errors = []
        self.baseline_attempt = accepted['baselineAttempt']
        self.devices = accepted['devices']
        self.root_device = accepted['rootDevice']
        self.previous_paired_success = []
