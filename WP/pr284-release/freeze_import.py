"""Freeze ONE new kit only from the original completed stopped import PASS.

All database reads use the original immutable detached consistent backups.
No database copy, installer, default startup, rehearsal, retry or cleanup runs.
"""
import contextlib
import fcntl
import hashlib
import json
import os
import pathlib
import sqlite3
import subprocess
import sys

import release_support as s
import startup_common as c
from kobo_copy_preservation import verify_copy
from import_preservation import verify_import_installation
from import_release_contract import *
from deploy_import import predecessor_ingress_authority, select_entry_state, environment_hash

ROOT = pathlib.Path(__file__).resolve().parent


def freeze_file(root, name, data):
    require(pathlib.PurePosixPath(name).name == name, 'Frozen kit files must be flat')
    with (root / name).open('xb') as stream: stream.write(data)
    (root / name).chmod(0o400)


def retained_seal(proof, label, evidence, references):
    directory = proof / label
    require(evidence['backupPath'] == str(directory / 'dev-stopped-backup.db') and
        evidence['policy'] == WAL_RECOVERY_POLICY and evidence['countsIncludeWal'] is True,
        'Original stopped seal authority differs')
    bindings = {'dev-stopped-backup.db': evidence['backupSha256'],
        'main-only-state.json': evidence['mainOnlyStateSha256'],
        'wal-aware-state.json': evidence['logicalStateSha256']}
    for name, digest in bindings.items():
        path = safe_reference(proof, label + '/' + name)
        require(sha(path) == digest, 'Original stopped seal file changed: ' + name)
        references[label + '/' + name] = digest
    raw = evidence['rawFiles']
    for suffix, original in evidence['originalFiles'].items():
        name = label + '/raw/dev.db' + suffix
        if original is None:
            require(raw[suffix] is None and not (proof / name).exists(), 'An absent raw sidecar appeared')
        else:
            path = safe_reference(proof, name)
            require(sha(path) == raw[suffix]['sha256'] == original['sha256'] and
                path.stat().st_size == raw[suffix]['bytes'] == original['bytes'], 'Original raw triple changed')
            references[name] = original['sha256']
    for name in ['raw/original-triple.json', 'sealed-state.json']:
        path = safe_reference(proof, label + '/' + name)
        references[label + '/' + name] = sha(path)
    recorded = json.loads((directory / 'raw/original-triple.json').read_bytes())
    require(recorded['before'] == recorded['after'] == evidence['originalFiles'],
        'Original stopped physical attributes changed')
    return directory / 'dev-stopped-backup.db'


def main():
    require(os.geteuid() == 0 and sys.flags.optimize == 0 and
        os.environ.get('PYTHONOPTIMIZE', '') in ['', '0'], 'Root/plain Python required')
    proof, target = map(pathlib.Path, sys.argv[1:])
    safe_root(str(proof), 'instrument-import-proof-'); safe_root(str(target), 'instrument-import-release-')
    require(not target.exists(), 'Never overwrite or refreeze a kit')
    lock = pathlib.Path('/opt/lims/apply.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    receipt_path = safe_reference(proof, 'rehearsal-receipt.json')
    receipt_sha = sha(receipt_path)
    receipt = json.loads(receipt_path.read_bytes())
    pin = json.loads(safe_reference(proof, 'target-pin.json').read_bytes())
    validate_proof(receipt, pin)
    unit = 'lims-owned-' + proof.name.lower() + '.service'
    state = dict(line.split('=', 1) for line in subprocess.check_output(['systemctl', 'show', unit,
        '-p', 'ActiveState', '-p', 'ExecMainStatus'], text=True, timeout=15).splitlines())
    require(state == {'ActiveState': 'inactive', 'ExecMainStatus': '0'}, 'Original proof is not completed/inactive')
    for suffix in ['jobs-off', 'jobs-on']:
        owned = c.inspect('lims-owned-' + proof.name.lower() + '-' + suffix)
        require(not owned['State']['Running'] and not owned['State']['OOMKilled'] and owned['RestartCount'] == 0 and
            owned['Image'] == pin['image'] and owned['Config']['Labels'].get('io.soilfer.forward-owned') == str(proof),
            'Original proof writers must remain stopped and retained')
    for measurement in receipt['nativeImportInstallation']['measurements']:
        owned = c.inspect(measurement['containerName'])
        require(not owned['State']['Running'] and owned['State']['ExitCode'] == 0 and not owned['State']['OOMKilled'] and
            owned['RestartCount'] == 0 and owned['Image'] == pin['image'] and
            owned['HostConfig']['Memory'] == owned['HostConfig']['MemorySwap'] == LIMIT and
            owned['HostConfig']['NetworkMode'] == 'none' and
            measurement['owner'].startswith(str(proof) + ':') and
            owned['Config']['Labels'].get('io.soilfer.release-owned') == measurement['owner'],
            'Native proof CLI stopped identity differs')
    source = json.loads(safe_reference(proof, 'source-index.json').read_bytes())
    package = json.loads((ROOT / 'packaging-source-index.json').read_bytes())
    require(set(package['files']) == PACKAGE_SOURCE_FILES, 'Complete fixed production source set required')
    files = {}
    for name, row in package['files'].items():
        path = safe_reference(ROOT, name)
        require(sha(path) == row['sha256'], 'Packaging raw source differs: ' + name)
        files[name] = path.read_bytes()
    production_review_bytes = safe_reference(ROOT, 'production-baseline-source-review.json').read_bytes()
    production_review = json.loads(production_review_bytes)
    production_source_review(production_review, package['head'], {name: hashlib.sha256(raw).hexdigest()
        for name, raw in files.items()})
    for name, row in source['files'].items():
        raw = safe_reference(proof, name).read_bytes()
        require(hashlib.sha256(raw).hexdigest() == row['sha256'] and files[name] == raw,
            'A measured proof byte changed during packaging: ' + name)
    references = {}
    for name, original in PROOF_ARTIFACTS.items():
        raw = safe_reference(proof, original).read_bytes()
        files[name] = raw; references[original] = hashlib.sha256(raw).hexdigest()
    native = receipt['nativeImportInstallation']
    require(json.loads(files['import-dry-copy-authority.json']) == native['dryRunCopy'] and
        hashlib.sha256(files['import-dry-copy-authority.json']).hexdigest() == native['dryRunCopyAuthoritySha256'],
        'Original dry-run copy authority differs')
    for name, row in native['dryRunCopy']['files'].items():
        original = 'import-dry-database/' + name
        path = safe_reference(proof, original)
        require(path.stat().st_size == row['bytes'] and sha(path) == row['sha256'], 'Retained dry-run copy changed')
        references[original] = row['sha256']
    proof_authority(receipt, pin, source, json.loads(files['proof-authority.json']),
        hashlib.sha256(files['proof-authority.json']).hexdigest())
    bound_artifacts = {'first-sync-preservation.json': 'firstPreservationSha256',
        'second-sync-preservation.json': 'secondPreservationSha256', 'full-copy-preservation.json': 'fullPreservationSha256',
        'upstream-before-start.json': 'initialUpstreamSha256', 'upstream-first-completion.json': 'firstUpstreamSha256',
        'upstream-second-completion.json': 'secondUpstreamSha256', 'target-pin.json': 'targetPinSha256',
        'proof-source-index.json': 'sourceIndexSha256', 'fresh-protected-state.json': 'protectedStateSha256',
        'installed-protected-state.json': 'installedProtectedStateSha256'}
    for name, key in bound_artifacts.items():
        require(hashlib.sha256(files[name]).hexdigest() == receipt[key], 'Original proof artifact differs: ' + name)
    native = receipt['nativeImportInstallation']
    for label, measurement in zip(['import-dry', 'import-apply', 'import-repeat'], native['measurements']):
        metadata_path = safe_reference(proof, label + '-container.json')
        require(json.loads(metadata_path.read_bytes()) == measurement, 'Original CLI measurement changed')
        references[metadata_path.name] = sha(metadata_path)
        for name, digest in measurement['retainedArtifacts'].items():
            path = safe_reference(proof, name)
            require(sha(path) == digest, 'Original native CLI output changed: ' + name)
            references[name] = digest
    require(hashlib.sha256(files['import-install-preservation.json']).hexdigest() == native['preservationSha256'],
        'Original native delta proof changed')
    installed_evidence = json.loads(files['import-installed-seal.json'])
    installed = retained_seal(proof, 'after-import-stopped', installed_evidence, references)
    jobs_off = json.loads(files['import-jobs-off-seal.json'])
    require(jobs_off == receipt['jobsOffStoppedSeal'], 'Original jobs-OFF seal differs')
    retained_seal(proof, 'after-jobs-off-stopped', jobs_off, references)
    final_evidence = json.loads(files['import-final-seal.json'])
    require(final_evidence == receipt['finalStoppedSeal'], 'Original final stopped seal differs')
    final_backup = retained_seal(proof, 'after-second-stopped', final_evidence, references)
    original = safe_reference(proof, 'fresh-live-backup.db')
    first = safe_reference(proof, 'after-first-sync.db')
    require(sha(original) == native['beforeBackupSha256'] == receipt['freshCopySha256'] and
        sha(installed) == native['afterBackupSha256'] == receipt['installedBaselineSha256'] and
        sha(first) == receipt['firstDatabaseSha256'], 'Original consistent backup hash differs')
    require(verify_import_installation(original, installed, ROOT, native['originalRowsSha256']) ==
        json.loads(files['import-install-preservation.json']), 'Recomputed exact native delta differs')
    # Compare parsed complete states, not formatting-dependent JSON byte hashes.
    installed_state = json.loads(files['installed-protected-state.json'])
    require(json.loads((proof / 'after-import-stopped/wal-aware-state.json').read_bytes()) == installed_state and
        json.loads((proof / 'after-jobs-off-stopped/wal-aware-state.json').read_bytes()) == installed_state,
        'Original jobs-OFF full installed state changed')
    with contextlib.closing(sqlite3.connect(original.as_uri() + '?mode=ro&immutable=1', uri=True)) as db:
        db.row_factory = sqlite3.Row
        refusal_rows = expected_refusals([dict(row) for row in db.execute('SELECT id,labId,projectCode,isActive FROM KoboConfig')],
            [dict(row) for row in db.execute('SELECT id,code,name,isActive FROM Lab')],
            [dict(row) for row in db.execute('SELECT code FROM Project')])
        config = dict(db.execute('SELECT id,labId,projectCode,lastSubmissionId FROM KoboConfig WHERE id=?',
            (TARGET_CONFIG,)).fetchone())
    refusal_ids = [row['configId'] for row in refusal_rows]
    first_ids = {key: row['submissionIds'] for key, row in json.loads(files['upstream-first-completion.json']).items()}
    final_ids = {key: row['submissionIds'] for key, row in json.loads(files['upstream-second-completion.json']).items()}
    first_state = json.loads(files['first-sync-preservation.json'])
    second_state = json.loads(files['second-sync-preservation.json'])
    full_state = json.loads(files['full-copy-preservation.json'])
    require(verify_copy(installed, first, expected_table_count=106, fetched_ids=first_ids,
        refusal_configs=refusal_ids) == first_state, 'First natural backup preservation differs')
    require(verify_copy(first, final_backup, expected_table_count=106, prior_fetched_ids=receipt['priorFetchedIds'],
        fetched_ids=final_ids, refusal_configs=refusal_ids) == second_state, 'Second natural backup preservation differs')
    require(verify_copy(installed, final_backup, expected_table_count=106, fetched_ids=final_ids,
        refusal_configs=refusal_ids) == full_state, 'Full original installed preservation differs')
    sealed_scheduler_evidence(receipt, refusal_rows,
        safe_reference(proof, 'candidate-jobs-on-stdout.log').read_text(encoding='utf-8'),
        safe_reference(proof, 'candidate-jobs-on-stderr.log').read_text(encoding='utf-8'), first_state, second_state, full_state)
    original_cursor_intake(receipt, json.loads(files['upstream-before-start.json'])[TARGET_CONFIG], config)
    for name, digest in [('fresh-live-backup.db', receipt['freshCopySha256']),
        ('after-first-sync.db', receipt['firstDatabaseSha256']),
        ('candidate-jobs-on-stdout.log', receipt['schedulerStdoutSha256']),
        ('candidate-jobs-on-stderr.log', receipt['schedulerStderrSha256']),
        ('disk-allocation-observations.jsonl', receipt['diskAllocationObservationsSha256'])]:
        require(sha(safe_reference(proof, name)) == digest, 'Retained original proof changed: ' + name)
        references[name] = digest
    files['packaging-source-index.json'] = (ROOT / 'packaging-source-index.json').read_bytes()
    files['production-baseline-source-review.json'] = production_review_bytes
    files.update(predecessor_ingress_authority())
    live = c.inspect('soilfer-lims')
    select_entry_state(live, sha(s.CONF), None, {'entryBinding': entry_binding()})
    proof_jobs_on = c.inspect('lims-owned-' + proof.name.lower() + '-jobs-on')
    require(environment_hash(live) == environment_hash(proof_jobs_on), 'Measured and current environment differ')
    image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', pin['image']], text=True, timeout=15))[0]
    build_root = pathlib.Path(pin['buildRoot']); safe_root(str(build_root), 'instrument-import-build-')
    require(sha(safe_reference(build_root, 'build-receipt.json')) == pin['buildReceiptSha256'], 'Original build changed')
    validate_candidate(pin, json.loads((build_root / 'build-receipt.json').read_bytes()), image)
    built = json.loads((build_root / 'build-receipt.json').read_bytes())
    require(sha(safe_reference(build_root, 'source.tar.gz')) == built['sourceArchiveSha256'] and
        sha(safe_reference(build_root, 'source-index.json')) == built['sourceIndexSha256'],
        'Original valid build archive or Git blob index changed')
    yy = json.loads(files['yy-authorization-evidence.md'])
    require(yy['confirmedByYY'] is True and yy['authorizationMode'] == 'AUTO_AFTER_REVIEW' and
        yy['scopeText'] == 'my go covers all' and yy['status'] == 'ORIGINAL_HUMAN_STANDING_GO_DIRECTLY_VERIFIED',
        'Original standing YY evidence missing')
    require(min(s.disk_free().values()) >= FLOOR + sum(map(len, files.values())) + 268435456,
        'Packaging allocation reserve refused')
    manifest = {'status': KIT_STATUS, 'root': str(target), 'head': pin['head'], 'image': pin['image'], 'tree': pin['tree'],
        'baseHead': BASE_HEAD, 'auditedPrTree': AUDITED_PR_TREE, 'mergeParents': MERGE_PARENTS,
        'preparedUtc': s.utc(), 'packagingCommit': package['head'], 'originalProofRoot': str(proof),
        'originalProofUnit': unit, 'proofReferences': references, 'sourceReviewId': PROOF_SOURCE_REVIEW_ID,
        'proofToolingCommit': REVIEWED_PROOF_SOURCE, 'productionBaselineSourceReviewId': production_review['id'],
        'naturalIntakePolicy': NATURAL_INTAKE_POLICY, 'importDeltaPolicy': NATIVE_DELTA_POLICY,
        'entryBinding': entry_binding(), 'historicalReceiptSha256': HISTORICAL_RECEIPT_SHA,
        'separateInstallerCommands': 3, 'retainedDatabaseAllocationCount': RETAINED_DATABASE_ALLOCATION_COUNT,
        'deadlineSeconds': 600, 'productionObservationSeconds': 660, 'reserveFloorBytes': FLOOR,
        'workloadControl': WORKLOAD_PINS, 'effectiveEnvironmentSha256': environment_hash(live),
        'envFileSha256': sha(pathlib.Path('/opt/lims/.env')), 'baselineVanishedProcessPolicy': BASELINE_POLICY,
        'BASELINE_ATTEMPTS_MAX': 3, 'BASELINE_CONFIRMATION_DEADLINE_SECONDS': 10,
        'coreDeallocationConfirmationDeadlineSeconds': 10,
        'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
        'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
        'files': {name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()}}
    measurement_manifest(manifest)
    target.mkdir(mode=0o700)
    for name, raw in files.items(): freeze_file(target, name, raw)
    freeze_file(target, 'prepared-manifest.json', (json.dumps(manifest, indent=2) + '\n').encode())
    frozen_files(target, manifest)
    require(sha(receipt_path) == receipt_sha, 'Original proof receipt changed during freeze')
    print(json.dumps({'status': KIT_STATUS, 'root': str(target), 'manifestSha256': sha(target / 'prepared-manifest.json'),
        'coordinatorSha256': manifest['files']['deploy_import.py'], 'receiptSha256': receipt_sha,
        'targetPinSha256': manifest['files']['target-pin.json'], 'fileCount': len(files)}), flush=True)


if __name__ == '__main__': main()
