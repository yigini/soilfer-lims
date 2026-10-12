"""Proposed bounded ONE #200 native installer; never historical installers.

Only the separately reviewed single-use coordinator can invoke this adapter.
No operation happens at import. There is no retry loop, rollback, restore,
previous-image start, entrypoint or cleanup command in this module.
"""
import hashlib
import json
import pathlib
import re
import time

from import_preservation import SOURCES, require
from import_startup_checks import empty_counts

SCRIPT = 'install_instrument_imports.js'
LIMIT = 805306368
CLI_TIMEOUT_SECONDS = 600
DRY_COPY_POLICY = 'SEPARATE_OWNED_0400_BACKUP_COPY_WITH_WRITABLE_SIDECAR_DIRECTORY'
WRAPPER = """const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const child=spawnSync(process.execPath,process.argv.slice(1),{stdio:'inherit'});
const peak=Number(fs.readFileSync('/sys/fs/cgroup/memory.peak','utf8').trim());
process.stderr.write(JSON.stringify({releaseCliPeakBytes:peak,childStatus:child.status,childSignal:child.signal})+'\\n');
process.exit(child.status===null?1:child.status);"""


def validate_plan(value, classification, mode):
    require(value.get('classification') == classification and value.get('mode') == mode and
        value.get('sources') == SOURCES and empty_counts(value), 'Exact #200 plan differs')
    fields = ['newTemplateCount', 'newReceiptCount', 'backfilledCount', 'totalChanges']
    require(all(type(value.get(key)) is int and value[key] == 0 for key in fields),
        'Dry-run or repeat changed import data')
    return {key: value[key] for key in ['classification', 'sources', 'counts']}


def validate_apply(value):
    require(value.get('classification') == 'COMPLETE_200' and value.get('previousClassification') == 'PRE_200'
        and value.get('mode') == 'APPLIED' and value.get('sources') == SOURCES
        and empty_counts(value),
        'Native #200 apply did not complete the exact empty delta')
    require(type(value.get('totalChanges')) is int and value['totalChanges'] == 1 and
        all(type(value.get(key)) is int and value[key] == 0 for key in
            ['newTemplateCount', 'newReceiptCount', 'backfilledCount']),
        'Native #200 apply wrote beyond its one schema receipt')
    receipt = value.get('receipt', {})
    require(receipt.get('sources') == SOURCES and receipt.get('originalRowsPreserved') is True and
        re.fullmatch('[a-f0-9]{64}', receipt.get('originalRowsSha256', '')),
        'Native installation receipt has no bounded original-row hash')
    return receipt['originalRowsSha256']


def arguments(root, image, database_dir, mode, label, live_parent):
    require(mode in ['--dry-run', '--apply'] and re.fullmatch('[a-zA-Z0-9_.-]+', label or ''),
        'Invalid bounded import CLI mode or label')
    require(re.fullmatch('sha256:[a-f0-9]{64}', image or ''), 'Exact image digest required')
    root, database_dir = pathlib.Path(root).resolve(), pathlib.Path(database_dir).resolve()
    require(database_dir == pathlib.Path(live_parent).resolve() or database_dir.is_relative_to(root),
        'Owned import CLI database must remain inside its release root')
    owner = str(root) + ':' + label
    name = 'lims-owned-import-cli-' + hashlib.sha256(owner.encode()).hexdigest()[:24]
    if mode == '--dry-run':
        require(database_dir == root / 'import-dry-database' and database_dir != pathlib.Path(live_parent).resolve(),
            'Dry-run requires its own separate owned backup-copy directory')
    mount = ('type=volume,src=lims_lims-data,dst=/app/server/prisma' if database_dir == pathlib.Path(live_parent).resolve()
        else 'type=bind,src=' + str(database_dir) + ',dst=/app/server/prisma')
    # The native readonly SQLite open needs a writable sidecar directory for a
    # WAL-header backup. Dry-run mounts ONLY a separate owned 0400 main copy;
    # it never mounts the apply target or a production volume.
    # Deliberately retain the completed owned CLI container and its evidence.
    # No --rm, --force, prune or previous-image recovery path is present.
    return name, owner, ['docker', 'run', '--name', name, '--label', 'io.soilfer.release-owned=' + owner,
        '--network', 'none', '--memory', '768m', '--memory-swap', '768m', '--restart', 'no', '-e', 'NODE_OPTIONS=',
        '-e', 'ALLOW_PRISMA_DB_PUSH=false', '-e', 'ALLOW_AUTO_SEED=false',
        '--mount', mount, '--entrypoint', 'node', image, '-e', WRAPPER,
        '/app/server/scripts/' + SCRIPT, '--db', '/app/server/prisma/dev.db', mode]


def measured_cli(root, image, database_dir, mode, label, support):
    name, owner, args = arguments(root, image, database_dir, mode, label, support.LIVE.parent)
    started = time.monotonic()
    try:
        result = support.command(root, args, label, expected=None, timeout=CLI_TIMEOUT_SECONDS)
    except BaseException:
        support.stop_owned_cli(name, owner)
        raise
    measured = [json.loads(line) for line in result.stderr.splitlines()
        if line.startswith('{"releaseCliPeakBytes":')]
    metadata = {'containerName': name, 'owner': owner, 'memoryLimitBytes': LIMIT,
        'memorySwapLimitBytes': LIMIT, 'networkMode': 'none', 'timeoutSeconds': CLI_TIMEOUT_SECONDS,
        'elapsedSeconds': time.monotonic() - started,
        'nodeOptions': '', 'exitCode': result.returncode,
        'cgroupMemoryPeak': measured[-1] if measured else None, 'retainedOwnedContainer': True}
    metadata['retainedArtifacts'] = {}
    for suffix in ['stdout', 'stderr']:
        artifact = pathlib.Path(root) / (label + '.' + suffix)
        require(artifact.is_file() and not artifact.is_symlink(), 'Native CLI output is missing or linked')
        artifact.chmod(0o400)
        metadata['retainedArtifacts'][artifact.name] = support.sha(artifact)
    path = pathlib.Path(root) / (label + '-container.json')
    with path.open('x', encoding='utf-8') as stream:
        json.dump(metadata, stream, indent=2)
    path.chmod(0o400)
    require(result.returncode == 0 and len(measured) == 1 and
        0 < metadata['elapsedSeconds'] < CLI_TIMEOUT_SECONDS and
        type(measured[0].get('releaseCliPeakBytes')) is int and 0 < measured[0]['releaseCliPeakBytes'] <= LIMIT
        and measured[0].get('childStatus') == 0 and measured[0].get('childSignal') is None,
        'Bounded import CLI failed; retain evidence and hold forward-only')
    inspected = json.loads(support.command(root, ['docker', 'inspect', name],
        label + '-retained-inspect').stdout)[0]
    env = dict(item.split('=', 1) for item in inspected['Config']['Env'] if '=' in item)
    mounts = {value['Destination']: value for value in inspected['Mounts']}
    mount = mounts.get('/app/server/prisma', {})
    require(inspected['Image'] == image and inspected['RestartCount'] == 0 and
        not inspected['State']['Running'] and not inspected['State']['OOMKilled'] and
        inspected['State']['ExitCode'] == 0 and inspected['HostConfig']['Memory'] == LIMIT and
        inspected['HostConfig']['MemorySwap'] == LIMIT and inspected['HostConfig']['NetworkMode'] == 'none' and
        env.get('NODE_OPTIONS') == '' and
        mount.get('RW') is True and pathlib.Path(mount.get('Source', '')).resolve() == pathlib.Path(database_dir).resolve() and
        (mount.get('Name') == 'lims_lims-data' if pathlib.Path(database_dir).resolve() == support.LIVE.parent.resolve()
            else mount.get('Type') == 'bind') and
        inspected['Config']['Labels'].get('io.soilfer.release-owned') == owner,
        'Retained bounded import CLI identity or stopped state differs')
    return json.loads(result.stdout), metadata
