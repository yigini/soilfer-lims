"""Freeze a NEW kit from the original stopped/PASSED candidate proof only."""
import fcntl
import contextlib
import hashlib
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import sys
import release_support as s
import startup_common as c
from kobo_copy_preservation import verify_copy
from runtime_release_contract import *

ROOT = pathlib.Path(__file__).resolve().parent
HISTORICAL_ROOT = pathlib.Path('/opt/lims/releases/forward-ae64f169-release-20261011T150800Z')


def freeze_file(target, name, data):
    with (target / name).open('xb') as out:
        out.write(data)
    (target / name).chmod(0o400)


def main():
    require(os.geteuid() == 0 and sys.flags.optimize == 0 and
        os.environ.get('PYTHONOPTIMIZE', '') in ['', '0'], 'Root and plain Python required')
    proof, target = map(pathlib.Path, sys.argv[1:])
    safe_root(str(proof), 'runtime-kobo-proof-'); safe_root(str(target), 'runtime-kobo-release-')
    require(not target.exists(), 'Never overwrite a frozen kit')
    lock = pathlib.Path('/opt/lims/apply.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    receipt_path = proof / 'rehearsal-receipt.json'; receipt_sha = sha(receipt_path)
    require(receipt_path.stat().st_mode & 0o777 == 0o400, 'Original proof receipt is not immutable')
    receipt = json.loads(receipt_path.read_bytes()); pin = json.loads((proof / 'target-pin.json').read_bytes())
    validate_proof(receipt, pin)
    unit = 'lims-owned-' + proof.name.lower() + '.service'
    state = dict(row.split('=', 1) for row in subprocess.check_output(['systemctl', 'show', unit,
        '-p', 'ActiveState', '-p', 'ExecMainStatus'], text=True, timeout=15).splitlines())
    require(state == {'ActiveState': 'inactive', 'ExecMainStatus': '0'}, 'Original proof is not completed/inactive')
    for suffix in ['jobs-off', 'jobs-on']:
        owned = c.inspect('lims-owned-' + proof.name.lower() + '-' + suffix)
        require(owned['Config']['Labels'].get('io.soilfer.forward-owned') == str(proof) and
            not owned['State']['Running'] and owned['RestartCount'] == 0 and owned['Image'] == pin['image'],
            'Original owned writer must be stopped and retained')
    source = json.loads((proof / 'source-index.json').read_bytes())
    package = json.loads((ROOT / 'packaging-source-index.json').read_bytes())
    files = {}
    for name, row in package['files'].items():
        require(pathlib.PurePosixPath(name).name == name and not (ROOT / name).is_symlink() and
            sha(ROOT / name) == row['sha256'], 'Packaging source differs: ' + name)
        files[name] = (ROOT / name).read_bytes()
    production_review_bytes = (ROOT / 'production-baseline-source-review.json').read_bytes()
    production_review = json.loads(production_review_bytes)
    production_source_review(production_review, package['head'],
        {name: hashlib.sha256(data).hexdigest() for name, data in files.items()})
    files['production-baseline-source-review.json'] = production_review_bytes
    for name, row in source['files'].items():
        require(sha(proof / name) == row['sha256'] and files[name] == (proof / name).read_bytes(),
            'A measured proof helper changed during packaging: ' + name)
    require(source['files']['rehearse_runtime.py']['sha256'] == REVIEWED_PROOF_SHA,
        'Measured coordinator differs from source review')
    names = {'target-pin.json': 'target-pin.json', 'rehearsal-receipt.json': 'rehearsal-receipt.json',
        'proof-source-index.json': 'source-index.json', 'proof-authority.json': 'candidate-rehearsal-authority.json',
        'first-sync-preservation.json': 'first-sync-preservation.json',
        'second-sync-preservation.json': 'second-sync-preservation.json',
        'full-copy-preservation.json': 'full-copy-preservation.json',
        'upstream-before-start.json': 'upstream-before-start.json',
        'upstream-first-completion.json': 'upstream-first-completion.json',
        'upstream-second-completion.json': 'upstream-second-completion.json'}
    for name, original in names.items():
        files[name] = (proof / original).read_bytes()
    proof_authority(receipt, pin, source, json.loads(files['proof-authority.json']),
        hashlib.sha256(files['proof-authority.json']).hexdigest())
    evidence = {'first-sync-preservation.json': 'firstPreservationSha256',
        'second-sync-preservation.json': 'secondPreservationSha256',
        'full-copy-preservation.json': 'fullPreservationSha256',
        'upstream-before-start.json': 'initialUpstreamSha256',
        'upstream-first-completion.json': 'firstUpstreamSha256',
        'upstream-second-completion.json': 'secondUpstreamSha256',
        'target-pin.json': 'targetPinSha256', 'proof-source-index.json': 'sourceIndexSha256'}
    for name, key in evidence.items():
        require(hashlib.sha256(files[name]).hexdigest() == receipt[key], 'Original proof artifact differs: ' + name)
    for name in ['first-sync-preservation.json', 'second-sync-preservation.json', 'full-copy-preservation.json']:
        row = json.loads(files[name])
        require(row['protectedTableCount'] == 104 and row['schemaPreserved'] is True and
            row['allOriginalRowsPreserved'] is True and row['integrity'] == 'ok' and
            row['foreignKeyViolations'] == 0, 'Original sealed preservation proof failed')
    # The proof receipt binds logical preservation of its final backup, not
    # that backup's raw hash. Independently recheck the retained stopped bytes
    # before assigning their physical hash to the frozen kit.
    with contextlib.closing(sqlite3.connect((proof / 'fresh-live-backup.db').as_uri() +
            '?mode=ro&immutable=1', uri=True)) as db:
        db.row_factory = sqlite3.Row
        expected_refusal_rows = expected_refusals(
            [dict(row) for row in db.execute('SELECT id,labId,projectCode,isActive FROM KoboConfig')],
            [dict(row) for row in db.execute('SELECT id,code,name,isActive FROM Lab')],
            [dict(row) for row in db.execute('SELECT code FROM Project')])
    refusal_configs = [row['configId'] for row in expected_refusal_rows]
    first_fetch = json.loads(files['upstream-first-completion.json'])
    first_ids = {key: value['submissionIds'] for key, value in first_fetch.items()}
    final_fetch = json.loads(files['upstream-second-completion.json'])
    final_ids = {key: value['submissionIds'] for key, value in final_fetch.items()}
    require(verify_copy(proof / 'fresh-live-backup.db', proof / 'after-first-sync.db',
        fetched_ids=first_ids, refusal_configs=refusal_configs) ==
        json.loads(files['first-sync-preservation.json']), 'Retained first-sync backup differs from its proof')
    require(verify_copy(proof / 'fresh-live-backup.db', proof / 'after-second-sync.db',
        fetched_ids=final_ids, refusal_configs=refusal_configs) ==
        json.loads(files['full-copy-preservation.json']), 'Retained final backup differs from the original full proof')
    require(verify_copy(proof / 'after-first-sync.db', proof / 'after-second-sync.db',
        prior_fetched_ids=receipt['priorFetchedIds'], fetched_ids=final_ids, refusal_configs=refusal_configs) ==
        json.loads(files['second-sync-preservation.json']), 'Retained second-sync backup differs from its proof')
    sealed_scheduler_evidence(receipt, expected_refusal_rows,
        (proof / 'candidate-jobs-on-stdout.log').read_text(encoding='utf-8'),
        (proof / 'candidate-jobs-on-stderr.log').read_text(encoding='utf-8'),
        json.loads(files['first-sync-preservation.json']), json.loads(files['second-sync-preservation.json']),
        json.loads(files['full-copy-preservation.json']))
    files['packaging-source-index.json'] = (ROOT / 'packaging-source-index.json').read_bytes()
    initial = json.loads(files['upstream-before-start.json'])
    require(len(initial[TARGET_CONFIG]['submissionIds']) >= 67, 'Actual original crash workload was not observed')
    references = {'rehearsal-receipt.json': receipt_sha,
        'fresh-live-backup.db': receipt['freshCopySha256'], 'after-first-sync.db': receipt['firstDatabaseSha256'],
        'after-second-sync.db': sha(proof / 'after-second-sync.db'),
        'candidate-jobs-on-stdout.log': receipt['schedulerStdoutSha256'],
        'candidate-jobs-on-stderr.log': receipt['schedulerStderrSha256'],
        'disk-allocation-observations.jsonl': receipt['diskAllocationObservationsSha256']}
    require(all(sha(proof / name) == digest for name, digest in references.items()), 'Original retained proof changed')
    require(sha(HISTORICAL_ROOT / 'production-receipt.json') == HISTORICAL_RECEIPT_SHA,
        'Historical production receipt changed')
    live = c.inspect('soilfer-lims')
    require(live['Image'] == LIVE_IMAGE, 'Live changed; re-audit the release checkpoint')
    def environment_hash(container):
        env = dict(value.split('=', 1) for value in container['Config']['Env'])
        env['DISABLE_BACKGROUND_JOBS'] = 'false'
        return c.digest(env)
    require(environment_hash(live) == environment_hash(owned), 'Measured and current environment differ')
    image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', pin['image']], text=True, timeout=15))[0]
    build_root = pathlib.Path(pin['buildRoot']); safe_root(str(build_root), 'runtime-kobo-build-')
    require(sha(build_root / 'build-receipt.json') == pin['buildReceiptSha256'], 'Original valid build changed')
    validate_candidate(pin, json.loads((build_root / 'build-receipt.json').read_bytes()), image)
    normal = s.CONF.read_bytes()
    require(b'R=503' not in normal and normal.count(b'SSLCertificateKeyFile ') == 1, 'Unexpected current ingress')
    lines = normal.decode('utf-8').splitlines()
    index = next(i for i, line in enumerate(lines) if 'SSLCertificateKeyFile ' in line)
    lines[index + 1:index + 1] = ['', '    RewriteEngine On', '    RewriteRule .* - [R=503,L]']
    files['apache-before.conf'] = normal
    files['apache-held.conf'] = ('\n'.join(lines) + '\n').encode()
    yy = json.loads(files['yy-authorization-evidence.md'])
    require(yy['confirmedByYY'] is True and yy['authorizationMode'] == 'AUTO_AFTER_REVIEW' and
        yy['scopeText'] == 'my go covers all' and yy['status'] == 'ORIGINAL_HUMAN_STANDING_GO_DIRECTLY_VERIFIED',
        'Original standing YY evidence missing')
    require(min(s.disk_free().values()) >= FLOOR + sum(map(len, files.values())) + 268435456,
        'Packaging allocation reserve refused')
    manifest = {'status': KIT_STATUS, 'root': str(target), 'head': pin['head'], 'image': pin['image'], 'tree': pin['tree'],
        'baseHead': BASE_HEAD, 'preparedUtc': s.utc(), 'packagingCommit': package['head'],
        'originalProofRoot': str(proof), 'originalProofUnit': unit, 'proofReferences': references,
        'sourceReviewId': PROOF_SOURCE_REVIEW_ID, 'proofToolingCommit': REVIEWED_PROOF_SOURCE,
        'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
        'baselineMeasurementGuardSha256': BASELINE_GUARD_SHA,
        'productionBaselineAdapterSha256': DEPLOY_BASELINE_GUARD_SHA,
        'productionBaselineScopeCommentId': PRODUCTION_BASELINE_SCOPE_ID,
        'productionBaselineSourceReviewId': production_review['id'],
        'copyVerifierSha256': REVIEWED_VERIFIER_SHA, 'proofContractSha256': REVIEWED_PROOF_CONTRACT_SHA,
        'refusalScopeCommentId': REFUSAL_SCOPE_COMMENT_ID,
        'schedulerRefusalPolicy': REFUSAL_POLICY, 'intakeCardinalityPolicy': CARDINALITY_POLICY,
        'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
        'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY,
        'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
        'baselineVanishedProcessPolicy': BASELINE_POLICY,
        'BASELINE_ATTEMPTS_MAX': BASELINE_ATTEMPTS_MAX,
        'BASELINE_CONFIRMATION_DEADLINE_SECONDS': BASELINE_CONFIRMATION_SECONDS,
        'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
        'historicalReceiptSha256': HISTORICAL_RECEIPT_SHA,
        'separateInstallerCommands': 0, 'deadlineSeconds': 600, 'productionObservationSeconds': 660,
        'reserveFloorBytes': FLOOR, 'workloadControl': WORKLOAD_PINS,
        'effectiveEnvironmentSha256': environment_hash(live), 'envFileSha256': sha(pathlib.Path('/opt/lims/.env')),
        'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
    target.mkdir(mode=0o700)
    for name, data in files.items():
        freeze_file(target, name, data)
    freeze_file(target, 'prepared-manifest.json', (json.dumps(manifest, indent=2) + '\n').encode())
    frozen_files(target, manifest)
    require(sha(receipt_path) == receipt_sha, 'Original proof receipt changed during freeze')
    print(json.dumps({'status': KIT_STATUS, 'root': str(target), 'manifestSha256': sha(target / 'prepared-manifest.json'),
        'coordinatorSha256': manifest['files']['deploy_runtime.py'], 'receiptSha256': receipt_sha,
        'targetPinSha256': manifest['files']['target-pin.json'], 'fileCount': len(files)}), flush=True)


if __name__ == '__main__':
    main()
