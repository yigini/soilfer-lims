"""Proposed production-only namespace; no I/O or authority at import.

Frozen source/evidence lives under frozen/. All generated release outputs live
at the execution root. Historical proof modules retain their original bytes.
The closed unused-root check refuses even an unrecognised prospective output.
"""
import hashlib
import json
import pathlib
import re

POLICY = 'HASH_BOUND_FROZEN_SUBDIRECTORY_DISJOINT_CLOSED_EXECUTION_ROOT'
FROZEN_DIRECTORY = 'frozen'
GATE = 'production-gate.json'

# Every finite file/directory created by deploy_import, import_stage,
# import_installation, import_sealing, startup_common and release_support.
# Timestamped labels are separately closed by DYNAMIC_FILE_PATTERNS.
DIRECT_FILES = frozenset({
    GATE, 'execution-attempt.json', 'instrument-import-attempt.json',
    'production-receipt.json', 'production-receipt.in-progress',
    'production-protected-state.json', 'installed-protected-state.json',
    'import-dry-copy-authority.json', 'import-install-preservation.json',
    'import-repeat-preservation.json', 'assets-stopped-backup.tar.gz',
    'disk-allocation-observations.jsonl',
})
CLI_LABELS = ('import-dry', 'import-apply', 'import-repeat')
STARTUP_STAGES = ('production-jobs-off', 'production-jobs-on')
PROBE_LABELS = ('api-postflight', 'postflight-roles', 'postflight-auth',
    'postflight-reference', 'postflight-qc-runs', 'postflight-policy', 'readonly-smoke')
COMMAND_LABELS = frozenset({
    *CLI_LABELS, *(label + '-retained-inspect' for label in CLI_LABELS),
    *(stage + suffix for stage in STARTUP_STAGES for suffix in ('-run', '-startup', '-memory')),
    *PROBE_LABELS, 'stop-original-live-writer', 'retain-original-stopped-container',
    'stop-candidate-jobs-off', 'retain-candidate-jobs-off',
    'failed-runtime-owned-stop', 'failed-original-stop',
})
HTTP_LABELS = frozenset({
    'held-GET-api-health', 'held-GET-ws', 'held-POST-api-v2-data-exchange-receipts',
    'reopened-health', 'reopened-login', 'reopened-denied-post',
    'final-login', 'final-denied-post',
})
SEAL_LABELS = ('original-stopped-seal', 'after-import-stopped',
    'after-repeat-stopped', 'candidate-jobs-off-seal')
SEAL_FILES = frozenset({
    'main-only-state.json', 'wal-aware-state.json', 'sealed-state.json', 'dev-stopped-backup.db',
    'dev-stopped-backup.db-journal', 'dev-stopped-backup.db-wal', 'dev-stopped-backup.db-shm',
    'scratch/dev.db-journal',
    *(directory + '/' + name for directory in ('raw', 'scratch')
        for name in ('dev.db', 'dev.db-wal', 'dev.db-shm', 'original-triple.json')),
})
DIRECTORIES = frozenset({'import-dry-database', *SEAL_LABELS,
    *(label + '/' + directory for label in SEAL_LABELS for directory in ('raw', 'scratch'))})
STATIC_FILES = frozenset({
    *DIRECT_FILES,
    *(label + '.' + suffix for label in COMMAND_LABELS | HTTP_LABELS for suffix in ('stdout', 'stderr')),
    *(label + '.body' for label in HTTP_LABELS),
    *(label + '-container.json' for label in CLI_LABELS),
    *(stage + '-readiness.json' for stage in STARTUP_STAGES),
    *('import-dry-database/dev.db' + suffix for suffix in ('', '-wal', '-shm')),
    *(label + '/' + name for label in SEAL_LABELS for name in SEAL_FILES),
})
DYNAMIC_FILE_PATTERNS = (
    r'apache-(?:test|reload)-[0-9]+\.(?:stdout|stderr)',
    r'health-observation-[0-9]+\.(?:body|stdout|stderr)',
)
# These are pre-existing live mutation targets, never generated kit outputs.
# They require the separate reviewed deployment/entry authority.
EXTERNAL_MUTATION_TARGETS = ('/opt/lims/apply.lock', '/etc/httpd/conf/extra/httpd-lims.conf',
    'lims_lims-data/dev.db', 'lims_lims-data/dev.db-wal', 'lims_lims-data/dev.db-shm')


def require(value, message):
    if not value:
        raise RuntimeError(message)


def output_path_allowed(name):
    if not isinstance(name, str):
        return False
    relative = pathlib.PurePosixPath(name)
    return (isinstance(name, str) and bool(name) and '\\' not in name and
        not relative.is_absolute() and str(relative) == name and
        all(part not in ('', '.', '..') for part in relative.parts) and
        (name in STATIC_FILES or name in DIRECTORIES or
            any(re.fullmatch(pattern, name) for pattern in DYNAMIC_FILE_PATTERNS)))


def frozen_directory(root):
    root = root if hasattr(root, 'iterdir') else pathlib.Path(root)
    require(not root.is_symlink(), 'Execution root is a symlink')
    directory = root / FROZEN_DIRECTORY
    require(directory.is_dir() and not directory.is_symlink(), 'Dedicated frozen directory missing or linked')
    return directory


def require_prequiesce_outputs(root, frozen_names):
    """Only the just-created intent, receipt and guard ledger may now exist.

    Initial unused-root preflight precedes these non-live outputs. Recheck all
    other prospective outputs immediately before the first live mutation.
    """
    namespace_binding(frozen_names)
    allowed = {FROZEN_DIRECTORY, GATE, 'execution-attempt.json',
        'production-receipt.json', 'disk-allocation-observations.jsonl'}
    require(not {path.name for path in root.iterdir()} - allowed,
        'Prospective production output appeared before quiesce')
    for path in root.iterdir():
        require(not path.is_symlink() and (path.is_dir() if path.name == FROZEN_DIRECTORY else path.is_file()),
            'Pre-quiesce root contains a symlink or unexpected type')


def namespace_binding(frozen_names):
    require(all(isinstance(name, str) and pathlib.PurePosixPath(name).name == name and
        name not in ('', '.', '..') and '\\' not in name for name in frozen_names),
        'Frozen namespace must use safe flat leaf names')
    spec = {'policy': POLICY, 'frozenDirectory': FROZEN_DIRECTORY,
        'frozenPaths': sorted(FROZEN_DIRECTORY + '/' + name for name in set(frozen_names) | {'prepared-manifest.json'}),
        'executionFiles': sorted(STATIC_FILES), 'executionDirectories': sorted(DIRECTORIES),
        'dynamicFilePatterns': list(DYNAMIC_FILE_PATTERNS),
        'externalMutationTargets': list(EXTERNAL_MUTATION_TARGETS)}
    # Families are anchored top-level names; none can enter frozen/.
    require(not set(spec['frozenPaths']) & (STATIC_FILES | DIRECTORIES) and
        not any(output_path_allowed(name) for name in spec['frozenPaths']),
        'Production outputs overlap frozen evidence')
    raw = json.dumps(spec, sort_keys=True, separators=(',', ':')).encode()
    return dict(spec, catalogSha256=hashlib.sha256(raw).hexdigest())


def require_unused_outputs(root, frozen_names, gate_present=False):
    """Read-only; checks ALL prospective outputs by a closed root inventory.

    Used after freeze, before gate installation and before execution intent.
    Even unknown output names and dangling symlinks cause refusal. A present
    gate is accepted only when explicitly required by the execution caller.
    """
    root = pathlib.Path(root)
    binding = namespace_binding(frozen_names)
    frozen = frozen_directory(root)
    wanted = set(frozen_names) | {'prepared-manifest.json'}
    require({path.name for path in frozen.iterdir()} == wanted,
        'Frozen directory has missing or extra evidence')
    require(all(path.is_file() and not path.is_symlink() for path in frozen.iterdir()),
        'Frozen evidence contains a symlink or non-file')
    allowed = {FROZEN_DIRECTORY, *([GATE] if gate_present else [])}
    require({path.name for path in root.iterdir()} == allowed,
        'Prospective production output already exists or execution root has an unexpected entry')
    if gate_present:
        gate = root / GATE
        require(gate.is_file() and not gate.is_symlink(), 'Gate is linked or not a regular file')
    return {'policy': POLICY, 'allProspectiveExecutionOutputsAbsent': True,
        'catalogSha256': binding['catalogSha256'],
        'gatePresent': gate_present, 'frozenFileCount': len(wanted), 'productionMutations': 0}
