"""Proposed closed #200 forward release authority; no operations at import.

Every new approval is deliberately unbound until the actual merged application,
reviewed proof source and original stopped PASS exist. Historical runtime kits
and failed proofs cannot grant authority for this additive import migration.
"""
import datetime
import hashlib
import json
import pathlib
import re

from import_proof_contract import *
from import_source_graph import SOURCE_FILES, UNCHANGED_HELPER_HASHES
from import_installation import CLI_TIMEOUT_SECONDS, DRY_COPY_POLICY, validate_apply, validate_plan
from import_stage import REPEAT_POLICY, readonly_repeat_physical
from import_startup_checks import READY_EVENTS, import_zero

WORKLOAD_PINS = {'labAndHubBuildsOwnedByYY': True,
    'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
REVIEWED_PROOF_SOURCE = 'UNREVIEWED_SIDECAR_FORWARD_REFUSE'
PROOF_SOURCE_REVIEW_ID = 0
REVIEWED_PROOF_FILES = {
    'build_import.py': 'c460f0dc0ee6a3a579025653abcf562f7b73859e1191a61c0f9f4b561932877a',
    'capture_kobo_fetch.py': '1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86',
    'export_launch_import_proof.py': '0c642b50c8996c33efc25b7e0922c0dc4dc6c104cd9db8d70231604a16b3f100',
    'fresh-prisma-tables.json': '9e098129de487fdb8ae551da9756a48c5627821ebe8da899f965824f815849df',
    'import_installation.py': 'eb2bd8ae36e0a85c7911766b33785622333d8d82d2df0205a6620f92dfeef10d',
    'import_preservation.py': '2e2823007822c5bffb1c938545f0ff3946f513a3b92a42156acdd7480d262783',
    'import_proof_contract.py': '2736d3ad6b788bb2e9302bb7e31fced42bead523e2f5889e7d9987a839657d55',
    'import_sealing.py': 'de2bf46ac434e14455b70743d1bb1bde91f7205c451c14ca299efa333fb73401',
    'import_source_graph.py': '74def9a854533d49e590d16677aea30d227feb91901dccb3ada64478acbe5637',
    'import_stage.py': 'c303f156341d40faf38181bea7352e382735d0d578463723e7c69193bc5e8ac1',
    'import_startup_checks.py': '033d3b8c410d628387a189b92312861898750e7edd84e85271f132f0f0777d1b',
    'known_core_disk_guard.py': 'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169',
    'known_core_disk_guard_import.py': '3e2402b5860d9a220cbb3f351e137dd9fac476445cc470e91446634cd81d922c',
    'known_core_disk_guard_v2.py': 'f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c',
    'known_core_disk_guard_v3.py': '878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f',
    'kobo_copy_preservation.py': '3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23',
    'migration.sql': '68555c0f9901a48c1c87a7d4ccb8320d0c515e388df094a47865064ee0ad6fc8',
    'post205-draft-tables.json': '208c61cfed932cdf44bdc2b36e6d337d7687a71d13ac99dc4d48f406fcdf50ad',
    'postflight-auth.cjs': '37b96bb2f26f8e2c9d4bd8443f5c3e46364408cc413b07c3f5a4428d91e45192',
    'postflight-policy.cjs': '6380f9b6513318e0b50a6c1fcda51d3b2094326e39f7651a9a923ae68dfe5e51',
    'postflight-qc-runs.cjs': '4a93ec3c536b13813ddc213791039d0acf04250a8722b28ea5af5cd50581cf8f',
    'postflight-reference.cjs': '530162ea19e87a2fb59621d5d3cf570cfe4092bcb4160f0ca40df9debe3e5526',
    'postflight-roles.cjs': '6724d91d89343387adb18db03f396a1eac14d8c9cc0700ac722b36e82ed924da',
    'pre-prisma-draft-table.sql': 'a523b351ff7046f21c448c637600ddbbc159c38487a4cd982163e0ada13ef6af',
    'prepare_import_build.py': 'a63a1cc3aaead6b0cf470efa69ca8168d65429802deb987078effc6e702a0991',
    'readonly-smoke.cjs': '7fcfb2565d55f2d54aa39a2f8ebd636dcf64dbe04b2713de40f4346a3c93c626',
    'rehearse_import.py': '8c65daee59ddd303adab4f7f48b1a22073472bd99203a8c45c31d9e4438fa213',
    'release_support.py': '9db6932a9b1502bc2db65c816a925e7d9f54611d54d4027d418bb2574b837810',
    'runtime_proof_policies.py': '08678fb53511e6f0d6b0cac06ff549bcb0fe72894d9e1322a74079cc65d60ccf',
    'startup_common.py': 'e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00',
    'upgraded-prisma-draft-table.sql': '4f444bdf15f710a2c0223764b650713ce6b413c3d4469a950bb8bfaa05bf666b',
}
PRODUCTION_SOURCE_FILES = ['import_release_contract.py', 'deploy_import.py',
    'freeze_import.py', 'known_core_disk_guard_import_deploy.py',
    'collect_import_gate.py', 'export_freeze_import_kit.py', 'launch_import_release.py']
PACKAGE_SOURCE_FILES = SOURCE_FILES | set(PRODUCTION_SOURCE_FILES) | {'yy-authorization-evidence.md'}
PROOF_BASELINE_LAYOUT_POLICY = 'EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT'
DEPLOY_LAYOUT_POLICY = 'EXACT_HASHED_UNUSED_IMPORT_KIT_AND_SINGLE_USE_GATE'
BASELINE_POLICY = 'CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE'
BASELINE_ATTEMPTS_MAX = 3
BASELINE_CONFIRMATION_SECONDS = CORE_CONFIRMATION_SECONDS = 10
MEASUREMENT_GUARD_SHA = UNCHANGED_HELPER_HASHES['known_core_disk_guard_v2.py']
BASELINE_GUARD_SHA = UNCHANGED_HELPER_HASHES['known_core_disk_guard_v3.py']
ORIGINAL_GUARD_SHA = UNCHANGED_HELPER_HASHES['known_core_disk_guard.py']
SHARED_READINESS_SHA = UNCHANGED_HELPER_HASHES['startup_common.py']
REVIEWED_VERIFIER_SHA = UNCHANGED_HELPER_HASHES['kobo_copy_preservation.py']
KIT_STATUS = 'PREPARED_IMPORT_FORWARD_ONLY_NOT_EXECUTED'
PHRASE = 'Audit passed: OK to merge and deploy'
WAL_RECOVERY_POLICY = 'DETACHED_STOPPED_IMPORT_WAL_AWARE_SEAL'
ORIGINAL_INGRESS_SHA = 'f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20'
HELD_INGRESS_SHA = 'd92601efd55a8112b4775d101ce5f18beea29e33686c6b53dafa6efbae811b2c'
ENTRY_POLICY = 'HEALTHY_RUNNING_NORMAL_51F_ONLY'
PROOF_ARTIFACTS = {
    'target-pin.json': 'target-pin.json', 'rehearsal-receipt.json': 'rehearsal-receipt.json',
    'proof-source-index.json': 'source-index.json',
    'proof-authority.json': 'candidate-rehearsal-authority.json',
    'first-sync-preservation.json': 'first-sync-preservation.json',
    'second-sync-preservation.json': 'second-sync-preservation.json',
    'full-copy-preservation.json': 'full-copy-preservation.json',
    'upstream-before-start.json': 'upstream-before-start.json',
    'upstream-first-completion.json': 'upstream-first-completion.json',
    'upstream-second-completion.json': 'upstream-second-completion.json',
    'fresh-protected-state.json': 'fresh-protected-state.json',
    'installed-protected-state.json': 'installed-protected-state.json',
    'import-install-preservation.json': 'import-install-preservation.json',
    'import-dry-copy-authority.json': 'import-dry-copy-authority.json',
    'import-repeat-preservation.json': 'import-repeat-preservation.json',
    'import-repeat-seal.json': 'after-repeat-stopped/sealed-state.json',
    'import-installed-seal.json': 'after-import-stopped/sealed-state.json',
    'import-jobs-off-seal.json': 'after-jobs-off-stopped/sealed-state.json',
    'import-final-seal.json': 'after-second-stopped/sealed-state.json'}
FROZEN_FILE_SET = PACKAGE_SOURCE_FILES | set(PROOF_ARTIFACTS) | {
    'packaging-source-index.json', 'production-baseline-source-review.json',
    'apache-before.conf', 'apache-held.conf'}


def require_bound_proof_source():
    bound_candidate()
    require(re.fullmatch('[a-f0-9]{40}', REVIEWED_PROOF_SOURCE) and
        type(PROOF_SOURCE_REVIEW_ID) is int and PROOF_SOURCE_REVIEW_ID > 0 and
        PROOF_SOURCE_REVIEW_ID not in HISTORICAL_SOURCE_REVIEWS,
        'Actual NEW #200 proof source approval is deliberately unbound')
    require_source_set(REVIEWED_PROOF_FILES)


def sha(path):
    result = hashlib.sha256()
    with pathlib.Path(path).open('rb') as stream:
        while block := stream.read(1024 * 1024): result.update(block)
    return result.hexdigest()


def safe_root(value, prefix):
    root = pathlib.PurePosixPath(value)
    require(root.parent == pathlib.PurePosixPath('/opt/lims/releases') and
        re.fullmatch(re.escape(prefix) + '[A-Za-z0-9_-]+', root.name), 'Wrong or unsafe new release root')
    return root


def safe_reference(root, name):
    require(isinstance(name, str), 'Unsafe retained proof reference')
    relative = pathlib.PurePosixPath(name)
    require(isinstance(name, str) and name and '\\' not in name and str(relative) == name and
        not relative.is_absolute() and all(part not in ['', '.', '..'] for part in relative.parts),
        'Unsafe retained proof reference')
    path = pathlib.Path(root)
    require(not path.is_symlink(), 'Proof root is a symlink')
    for part in relative.parts:
        path = path / part
        require(not path.is_symlink(), 'Proof reference follows a symlink')
    require(path.is_file() and path.stat().st_mode & 0o777 == 0o400,
        'Original retained proof artifact is not immutable')
    return path


def entry_binding():
    return {'policy': ENTRY_POLICY, 'baseHead': BASE_HEAD, 'liveImage': LIVE_IMAGE,
        'historicalReceiptSha256': HISTORICAL_RECEIPT_SHA,
        'normalIngressSha256': ORIGINAL_INGRESS_SHA, 'heldIngressSha256': HELD_INGRESS_SHA,
        'allowedEntryStates': ['RUNNING_NORMAL'], 'recoveryPolicy': RECOVERY_POLICY}


def validate_entry_state(entry, manifest):
    require(manifest.get('entryBinding') == entry_binding(), 'Healthy predecessor authority differs')
    require(set(entry) == {'mode', 'containerId', 'image', 'restartCount', 'ingressSha256', 'originalFiles'} and
        entry['mode'] == 'RUNNING_NORMAL' and re.fullmatch('[a-f0-9]{64}', entry['containerId']) and
        entry['image'] == LIVE_IMAGE and type(entry['restartCount']) is int and entry['restartCount'] == 0 and
        entry['ingressSha256'] == ORIGINAL_INGRESS_SHA and entry['originalFiles'] is None,
        'Only healthy normal unchanged predecessor is release authority')


def verify_entry_readiness(manifest, gate, actual):
    validate_entry_state(actual['entryState'], manifest)
    require(actual['entryState'] == gate['readOnlyExecutionReadiness']['entryState'],
        'Original writer or ingress changed after the single-use gate')


def has_failed_verdict(body, include_source=False):
    first = next((line.strip().strip('*_# ') for line in body.splitlines() if line.strip()), '')
    if first in [PHRASE, 'Source review: PASS']:
        body = re.sub(r'\bno later[ \t]+(?:"audit failed"|\'audit failed\'|“audit failed”|‘audit failed’)',
            '', body, flags=re.IGNORECASE)
    return 'audit failed' in body.lower() or (include_source and any(value in body.lower()
        for value in ['source review: failed', 'source review: changes required']))


def native_installation(row):
    require(all(type(row[key]) is int for key in ['originalTableCount', 'originalReceiptCount',
        'installedTableCount', 'installedReceiptCount', 'repeatDatabaseChanges']), 'Native counts must be integers')
    require(row['status'] == 'EXACT_NATIVE_IMPORT_DRY_APPLY_REPEAT_PASS' and
        [row[key] for key in ['originalTableCount', 'originalReceiptCount', 'installedTableCount',
            'installedReceiptCount']] == [104, 38, 106, 39] and
        row['repeatDatabaseChanges'] == 0 and row['allOriginalRowsAndSchemaPreserved'] is True and
        row['forwardOnly'] is True, 'Native import delta or repeat proof differs')
    validate_plan(row['dry'], 'PRE_200', 'DRY_RUN')
    require(validate_apply(row['apply']) == row['originalRowsSha256'], 'Original row hash differs')
    validate_plan(row['repeat'], 'COMPLETE_200', 'NO_OP')
    require(row.get('repeatPhysicalPolicy') == REPEAT_POLICY and
        re.fullmatch('[a-f0-9]{64}', row.get('repeatPreservationSha256', '')),
        'New readonly repeat policy and independently sealed authority required')
    repeat_seal = row.get('repeatStoppedSeal', {})
    require(repeat_seal.get('policy') == WAL_RECOVERY_POLICY and repeat_seal.get('countsIncludeWal') is True and
        repeat_seal.get('protectedTableCount') == 106 and repeat_seal.get('protectedReceiptCount') == 39,
        'Full detached installed repeat seal required')
    dry_copy = row.get('dryRunCopy', {})
    require(dry_copy.get('policy') == DRY_COPY_POLICY and
        dry_copy.get('beforeBackupSha256') == dry_copy.get('mainSha256') == row['beforeBackupSha256'] and
        dry_copy.get('targetPhysicalTriplePreserved') is True and
        re.fullmatch('[a-f0-9]{64}', row.get('dryRunCopyAuthoritySha256', '')),
        'Separate immutable dry-run copy authority missing')
    dry_files = dry_copy.get('files', {})
    require('dev.db' in dry_files and set(dry_files) <= {'dev.db', 'dev.db-wal', 'dev.db-shm'} and
        dry_files['dev.db']['sha256'] == row['beforeBackupSha256'] and
        all(re.fullmatch('[a-f0-9]{64}', value['sha256']) and type(value['bytes']) is int and value['bytes'] >= 0
            for value in dry_files.values()) and
        ('dev.db-wal' not in dry_files or dry_files['dev.db-wal']['bytes'] == 0) and
        ('dev.db-shm' not in dry_files or dry_files['dev.db-shm']['bytes'] == 32768),
        'Readonly dry-run copy bytes or sidecars differ')
    for key in ['originalRowsSha256', 'beforeBackupSha256', 'afterBackupSha256', 'preservationSha256']:
        require(re.fullmatch('[a-f0-9]{64}', row[key]), 'Native hash is missing: ' + key)
    measurements = row['measurements']
    require(len(measurements) == 3 and len({value['containerName'] for value in measurements}) == 3,
        'All three distinct native CLI measurements required')
    for label, value in zip(['import-dry', 'import-apply', 'import-repeat'], measurements):
        peak = value['cgroupMemoryPeak']
        require(value['memoryLimitBytes'] == LIMIT and value['nodeOptions'] == '' and
            value.get('memorySwapLimitBytes') == LIMIT and value.get('networkMode') == 'none' and
            value.get('timeoutSeconds') == CLI_TIMEOUT_SECONDS and
            type(value.get('elapsedSeconds')) in [float, int] and 0 < value['elapsedSeconds'] < CLI_TIMEOUT_SECONDS and
            type(value['exitCode']) is int and value['exitCode'] == 0 and
            value['retainedOwnedContainer'] is True and type(peak['releaseCliPeakBytes']) is int and
            0 < peak['releaseCliPeakBytes'] <= LIMIT and type(peak['childStatus']) is int and
            peak['childStatus'] == 0 and peak['childSignal'] is None,
            'Native CLI failed, exceeded 768MiB or used an override')
        artifacts = value.get('retainedArtifacts', {})
        require(set(artifacts) == {label + '.stdout', label + '.stderr'} and
            all(isinstance(digest, str) and re.fullmatch('[a-f0-9]{64}', digest) for digest in artifacts.values()),
            'Original separate native CLI output hashes are missing or differ')


def startup_evidence(readiness, checks, jobs):
    require(readiness['deadlineSeconds'] == 600 and 0 < readiness['elapsedSeconds'] < 600 and
        readiness['sharedReadinessCode'] == SHARED_READINESS_SHA and readiness['restartCount'] == 0 and
        readiness['oomKilled'] is False and readiness['memoryLimitBytes'] == LIMIT and
        readiness['jobsEnabled'] is jobs, 'Default startup readiness is incomplete')
    require(checks['startupChanges'] == 0 and len(checks['entrypointInstallers']) == 23 and
        all(row['mode'] == 'NO_OP' and type(row['totalChanges']) is int and row['totalChanges'] == 0
            for row in checks['entrypointInstallers']) and
        checks['entrypointInstallers'][-1]['classification'] == 'COMPLETE_200',
        'Exactly 23 default NO_OP/0 verifiers required')
    require([row['event'] for row in checks['startupReady']] == [name + '_STARTUP_READY' for name in READY_EVENTS] and
        all(type(row['totalChanges']) is int and row['totalChanges'] == 0 for row in checks['startupReady']),
        'Exactly 22 ordered zero-change READY events required')
    import_zero(checks['startupReady'][-1])
    require(0 < checks['startupMemory']['peakBytes'] <= LIMIT and
        checks['startupMemory']['nodeOptions'] is None, 'Startup peak or heap override refused')
    if jobs:
        boundary = checks.get('ownedJobsBoundary') or {}
        require(boundary.get('policy') == 'ISOLATED_NATURAL_INTAKE_WITH_SEALED_FIRST_SECOND_FULL_PRESERVATION' and
            boundary.get('fullStateZeroClaimed') is False and boundary.get('dataVersionsObserved') and
            all(type(value) is int for value in boundary['dataVersionsObserved']),
            'Explicit natural jobs-ON observation boundary missing')


def validate_proof(proof, pin):
    require_bound_proof_source()
    candidate_identity(pin)
    require_first_proof_root(proof.get('root'))
    require(proof.get('originalProofRoot') == EXPECTED_PROOF_ROOT and
        proof.get('firstProofPolicy') == FIRST_PROOF_POLICY and
        proof.get('mergeBaseHead') == MERGE_BASE_HEAD and
        type(proof.get('auditReviewId')) is int and proof['auditReviewId'] == AUDIT_REVIEW_ID,
        'Original first proof/application review binding differs')
    require(all(type(proof[key]) is int for key in ['productionMutations', 'separateInstallerCommands',
        'effectiveUid', 'pythonOptimize', 'baselineEnumerationErrorCount', 'retainedDatabaseAllocationCount',
        'originalProtectedTableCount', 'originalProtectedReceiptCount', 'protectedTableCount',
        'protectedReceiptCount', 'databaseChangesBeforeJobs', 'readOnlyProbeChanges']), 'Proof counts must be integers')
    require(proof['status'] == 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF' and
        proof['head'] == pin['head'] and proof['image'] == pin['image'] and
        proof['buildReceiptSha256'] == pin['buildReceiptSha256'] and
        proof['baseHead'] == BASE_HEAD and proof['pr'] == PR_NUMBER and proof['tree'] == MERGED_TREE and
        proof['auditedTree'] == AUDITED_PR_TREE and proof['mergeParents'] == MERGE_PARENTS and
        proof['naturalIntakePolicy'] == NATURAL_INTAKE_POLICY, 'Failed, historical or wrong candidate proof refused')
    proof_source_binding(proof, pin)
    require(proof['historicalReceiptSha256'] == HISTORICAL_RECEIPT_SHA and
        proof['productionMutations'] == 0 and proof['separateInstallerCommands'] == 3 and
        proof['ownedWriterStopped'] is True and proof['effectiveUid'] == 0 and proof['pythonOptimize'] == 0 and
        proof['baselineEnumerationErrorCount'] == 0 and proof['retainedDatabaseAllocationCount'] == RETAINED_DATABASE_ALLOCATION_COUNT,
        'Proof isolation, stopped state or original allocation policy missing')
    require(proof['workloadPins'] == WORKLOAD_PINS and proof['reserveBytes'] >= FLOOR and
        proof['importDeltaPolicy'] == NATIVE_DELTA_POLICY and
        proof['existingSampleVerifierPolicy'] == 'STRICT_ORIGINAL_ROWS' and
        proof['allOriginalRowsAndSchemaPreserved'] is True and proof['originalProtectedTableCount'] == 104 and
        proof['originalProtectedReceiptCount'] == 38 and proof['protectedTableCount'] == 106 and
        proof['protectedReceiptCount'] == 39, 'Original or installed full protection missing')
    native_installation(proof['nativeImportInstallation'])
    require(proof.get('measuredTimingHeadroom') == measured_timing_headroom(
        proof['nativeImportInstallation'], proof['jobsOffReadiness'], proof['jobsOnReadiness']),
        'Actual measured timeout/unit headroom differs')
    require(proof['freshCopySha256'] == proof['nativeImportInstallation']['beforeBackupSha256'] and
        proof['installedBaselineSha256'] == proof['nativeImportInstallation']['afterBackupSha256'],
        'Native delta backups differ from the natural proof baseline')
    for key in ['jobsOffStoppedSeal', 'finalStoppedSeal']:
        seal = proof[key]
        require(seal['policy'] == WAL_RECOVERY_POLICY and seal['countsIncludeWal'] is True and
            seal['protectedTableCount'] == 106 and seal['protectedReceiptCount'] == 39,
            'Stopped installed WAL-aware seal missing')
    require(proof['jobsOffStoppedSeal']['matchesExpected'] is True,
        'Jobs-OFF full installed state changed')
    require(proof['memoryLimitBytes'] == LIMIT and proof['nodeOptions'] == '' and
        0 < proof['peakBytes'] <= LIMIT and proof['databaseChangesBeforeJobs'] == 0 and
        proof['healthSamples'] and all(row['healthy'] is True and row['restartCount'] == 0 and
            0 < row['peakBytes'] <= LIMIT for row in proof['healthSamples']), 'Runtime bounded health proof missing')
    for stage, jobs in [('jobsOff', False), ('jobsOn', True)]:
        startup_evidence(proof[stage + 'Readiness'], proof[stage + 'Startup'], jobs)
    require(proof['apiChecks'] == {'passed': 31, 'total': 31, 'failed': 0} and
        len(proof['probes']) == 6 and all(row['exitCode'] == 0 for row in proof['probes']) and
        proof['readOnlyProbeChanges'] == 0, '31+6 read-only proof missing')
    require_final_observation(proof['firstScheduledSync'], proof['secondScheduledSync'],
        proof['jobsOnReadiness']['readyUtc'], proof['observedThroughUtc'], proof['copySyncIntervalMins'],
        0, proof['peakBytes'], proof['healthySoakSeconds'])


def proof_source_binding(proof, pin):
    pairing_contract(proof)
    require_build_reuse(proof)
    require_build_reuse(pin)
    require(proof['toolingCommit'] == REVIEWED_PROOF_SOURCE and
        proof['proofSourceReviewId'] == pin['proofSourceReviewId'] == PROOF_SOURCE_REVIEW_ID and
        proof['coordinatorSha256'] == REVIEWED_PROOF_FILES['rehearse_import.py'] and
        proof['proofContractSha256'] == REVIEWED_PROOF_FILES['import_proof_contract.py'] and
        proof['proofBaselineLayoutGuardSha256'] == REVIEWED_PROOF_FILES['known_core_disk_guard_import.py'] and
        proof['proofBaselineLayoutPolicy'] == PROOF_BASELINE_LAYOUT_POLICY and
        proof['copyVerifierSha256'] == REVIEWED_VERIFIER_SHA and
        proof['diskMeasurementGuardSha256'] == MEASUREMENT_GUARD_SHA and
        proof['baselineMeasurementGuardSha256'] == BASELINE_GUARD_SHA and
        proof['baselineVanishedProcessPolicy'] == BASELINE_POLICY and
        proof['BASELINE_ATTEMPTS_MAX'] == 3 and proof['BASELINE_CONFIRMATION_DEADLINE_SECONDS'] == 10 and
        proof['coreDeallocationConfirmationDeadlineSeconds'] == 10 and proof['baselineAttempt'] in [1, 2, 3] and
        proof['refusalScopeCommentId'] == REFUSAL_SCOPE_COMMENT_ID and proof['schedulerRefusalPolicy'] == REFUSAL_POLICY and
        proof['intakeCardinalityPolicy'] == CARDINALITY_POLICY and re.fullmatch('[a-f0-9]{64}', proof['authoritySha256']),
        'New exact proof source or unchanged measurement policy differs')


def proof_authority(proof, pin, source, authority, authority_sha):
    proof_source_binding(proof, pin)
    require(source['head'] == REVIEWED_PROOF_SOURCE and
        {name: row['sha256'] for name, row in source['files'].items()} == REVIEWED_PROOF_FILES and
        proof['authoritySha256'] == authority_sha and authority['head'] == pin['head'] and
        authority.get('baseHead') == BASE_HEAD and authority.get('mergeBaseHead') == MERGE_BASE_HEAD and
        authority.get('originalProofRoot') == EXPECTED_PROOF_ROOT and
        authority.get('firstProofPolicy') == FIRST_PROOF_POLICY and
        authority.get('buildReuseBinding') == build_reuse_binding() and
        authority.get('repeatPhysicalPolicy') == REPEAT_POLICY and
        authority['proofSourceReview']['id'] == PROOF_SOURCE_REVIEW_ID, 'Original proof authority changed')
    require_pr_review(authority.get('review', {}))
    source_review_pass(authority['proofSourceReview'], REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_FILES)


def source_policy_tokens():
    return [ENTRY_POLICY, NATIVE_DELTA_POLICY, RECOVERY_POLICY, WAL_RECOVERY_POLICY,
        ORIGINAL_INGRESS_SHA, HELD_INGRESS_SHA, 'separateInstallerCommands=3',
        'retainedDatabaseAllocationCount=' + str(RETAINED_DATABASE_ALLOCATION_COUNT),
        'repeatPhysicalPolicy=' + REPEAT_POLICY, 'defaultStartup=23NO_OP0/22READY0',
        'REQUIRED_HASHED_MANIFEST_AND_GATE', 'JOURNAL_UNIT_OUTPUT', DEPLOY_LAYOUT_POLICY,
        'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10',
        'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
        'productionObservationSeconds=660', 'deadlineSeconds=600',
        'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']


def production_source_review(review, tooling, files, now=None):
    require_bound_proof_source()
    require(set(files) >= PACKAGE_SOURCE_FILES and
        {name: files[name] for name in SOURCE_FILES} == REVIEWED_PROOF_FILES,
        'Packaging must retain every exact measured proof byte')
    require(type(review['id']) is int and review['id'] > 0 and
        review['id'] not in HISTORICAL_SOURCE_REVIEWS | {PROOF_SOURCE_REVIEW_ID} and
        review['html_url'] == 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']) and
        re.fullmatch('[a-f0-9]{40}', tooling), 'Separate NEW production source review required')
    first = next((line.strip().strip('*_# ') for line in review['body'].splitlines() if line.strip()), '')
    tokens = release_binding_tokens() + source_policy_tokens() + [tooling, REVIEWED_PROOF_SOURCE,
        'proofSourceReviewId=' + str(PROOF_SOURCE_REVIEW_ID)]
    tokens += [name + '=' + files[name] for name in sorted(PACKAGE_SOURCE_FILES)]
    require(first == 'Source review: PASS' and not has_failed_verdict(review['body'], True) and
        all(token in review['body'] for token in tokens), 'Complete NEW production source verdict missing')
    require(utc_seconds(review['created_at']) <= (now or datetime.datetime.now(datetime.timezone.utc)).timestamp(),
        'Production source review is future-dated')


def measurement_manifest(manifest):
    require_bound_proof_source()
    require_build_reuse(manifest)
    require(manifest.get('repeatPhysicalPolicy') == REPEAT_POLICY,
        'Frozen readonly repeat policy differs')
    require(set(manifest['files']) == FROZEN_FILE_SET and
        all(re.fullmatch('[a-f0-9]{64}', digest) for digest in manifest['files'].values()) and
        {name: manifest['files'][name] for name in SOURCE_FILES} == REVIEWED_PROOF_FILES,
        'Exact complete frozen file set differs')
    require(manifest['status'] == KIT_STATUS and manifest['head'] == CANDIDATE_HEAD and
        manifest['baseHead'] == BASE_HEAD and manifest.get('mergeBaseHead') == MERGE_BASE_HEAD and
        type(manifest.get('auditReviewId')) is int and manifest['auditReviewId'] == AUDIT_REVIEW_ID and
        manifest.get('firstProofPolicy') == FIRST_PROOF_POLICY and manifest['tree'] == MERGED_TREE and
        manifest['auditedPrTree'] == AUDITED_PR_TREE and manifest['mergeParents'] == MERGE_PARENTS and
        manifest['sourceReviewId'] == PROOF_SOURCE_REVIEW_ID and
        manifest['proofToolingCommit'] == REVIEWED_PROOF_SOURCE and manifest['entryBinding'] == entry_binding() and
        manifest['workloadControl'] == WORKLOAD_PINS and manifest['historicalReceiptSha256'] == HISTORICAL_RECEIPT_SHA and
        manifest['naturalIntakePolicy'] == NATURAL_INTAKE_POLICY and manifest['importDeltaPolicy'] == NATIVE_DELTA_POLICY and
        manifest['separateInstallerCommands'] == 3 and manifest['retainedDatabaseAllocationCount'] == RETAINED_DATABASE_ALLOCATION_COUNT and
        manifest['productionObservationSeconds'] == 660 and manifest['deadlineSeconds'] == 600 and
        manifest['reserveFloorBytes'] == FLOOR and manifest['coreDeallocationConfirmationDeadlineSeconds'] == 10 and
        manifest['baselineVanishedProcessPolicy'] == BASELINE_POLICY and manifest['BASELINE_ATTEMPTS_MAX'] == 3 and
        manifest['BASELINE_CONFIRMATION_DEADLINE_SECONDS'] == 10 and
        manifest['files']['apache-before.conf'] == ORIGINAL_INGRESS_SHA and
        manifest['files']['apache-held.conf'] == HELD_INGRESS_SHA, 'Frozen execution policy differs')
    pairing_contract(manifest)
    safe_root(manifest['root'], 'instrument-import-release-')
    require_first_proof_root(manifest['originalProofRoot'])


def formal_pr_review(review):
    require_pr_review(review)


def review_tokens(manifest, manifest_sha):
    measurement_manifest(manifest)
    return release_binding_tokens() + source_policy_tokens() + [PHRASE, manifest['head'], manifest['image'],
        manifest_sha, REVIEWED_PROOF_SOURCE, 'proofSourceReviewId=' + str(PROOF_SOURCE_REVIEW_ID),
        'productionSourceReviewId=' + str(manifest['productionBaselineSourceReviewId'])] + [
        name + '=' + digest for name, digest in sorted(manifest['files'].items())]


def verify_gate(manifest, gate, manifest_sha, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    measurement_manifest(manifest)
    require(gate.get('buildReuseBinding') == build_reuse_binding() and
        gate.get('repeatPhysicalPolicy') == REPEAT_POLICY, 'Gate repeat or build reuse authority differs')
    require(gate['status'] == 'FRESH_SINGLE_USE_IMPORT_GATE' and gate['executionRoot'] == manifest['root'] and
        gate['head'] == gate['currentMainHead'] == manifest['head'] and gate['image'] == manifest['image'] and
        gate['manifestSha256'] == manifest_sha and gate['workloadControl'] == WORKLOAD_PINS and
        gate['entryBinding'] == entry_binding() and gate['frozenFiles'] == manifest['files'],
        'Single-use gate identity differs')
    for key, name in [('coordinatorSha256', 'deploy_import.py'), ('rehearsalReceiptSha256', 'rehearsal-receipt.json'),
        ('targetPinSha256', 'target-pin.json'), ('yyEvidenceSha256', 'yy-authorization-evidence.md'),
        ('proofAuthoritySha256', 'proof-authority.json'), ('proofSourceIndexSha256', 'proof-source-index.json'),
        ('diskMeasurementGuardSha256', 'known_core_disk_guard_v2.py'),
        ('baselineMeasurementGuardSha256', 'known_core_disk_guard_v3.py'),
        ('proofBaselineLayoutGuardSha256', 'known_core_disk_guard_import.py'),
        ('productionBaselineAdapterSha256', 'known_core_disk_guard_import_deploy.py'),
        ('productionBaselineSourceReviewSha256', 'production-baseline-source-review.json'),
        ('copyVerifierSha256', 'kobo_copy_preservation.py'), ('proofContractSha256', 'import_proof_contract.py')]:
        require(gate[key] == manifest['files'][name], 'Gate frozen artifact hash differs: ' + name)
    require(0 <= now.timestamp() - utc_seconds(gate['verifiedUtc']) <= 600, 'Gate is stale or future-dated')
    readiness = gate['readOnlyExecutionReadiness']
    require(readiness['ready'] is True and readiness['productionMutations'] == 0 and
        min(readiness['freeBytes'].values()) >= readiness['requiredIncludingBackupBytes'] >= readiness['reserveBytes'] >= FLOOR,
        'Fresh ready headroom is incomplete')
    validate_entry_state(readiness['entryState'], manifest)
    source_review_pass(gate['proofSourceReview'], REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_FILES, now)
    require(gate['proofSourceReview']['id'] == PROOF_SOURCE_REVIEW_ID and gate['laterSourceAuditFailure'] is False and
        gate['laterProductionSourceAuditFailure'] is False and gate['laterKitAuditFailure'] is False,
        'Approval was superseded')
    require(gate['productionBaselineSourceReview']['id'] == manifest['productionBaselineSourceReviewId'],
        'Frozen production source approval differs')
    production_source_review(gate['productionBaselineSourceReview'], manifest['packagingCommit'], manifest['files'], now)
    pr = gate['pr']
    require(type(pr['number']) is int and pr['number'] == PR_NUMBER and pr['merged'] is True and pr['head'] == AUDITED_PR_HEAD and
        pr['mergeCommit'] == CANDIDATE_HEAD and pr['tree'] == MERGED_TREE and pr['auditedTree'] == AUDITED_PR_TREE and
        pr['mergeParents'] == MERGE_PARENTS and pr['laterAuditFailure'] is False,
        'Actual merged PR284 differs')
    formal_pr_review(pr['review'])
    require(pr['checks'] and all(row['head_sha'] == AUDITED_PR_HEAD and row['status'] == 'completed' and
        row['conclusion'] == 'success' for row in pr['checks']), 'Exact PR checks are not all green')
    ci = gate['mainCi']
    require(ci['head_sha'] == CANDIDATE_HEAD and ci['name'] == 'CI' and ci['event'] == 'push' and
        ci['status'] == 'completed' and ci['conclusion'] == 'success', 'Exact main CI is not green')
    review = gate['kitReview']
    require(type(review['id']) is int and review['id'] > 0 and review['id'] not in HISTORICAL_SOURCE_REVIEWS |
        {6102481848, 6109804174, 6110472696, 6114626674, 6118040064, PROOF_SOURCE_REVIEW_ID,
         manifest['productionBaselineSourceReviewId']} and review['html_url'] ==
        'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']) and
        next((line.strip().strip('*_# ') for line in review['body'].splitlines() if line.strip()), '') == PHRASE and
        not has_failed_verdict(review['body']) and all(token in review['body'] for token in review_tokens(manifest, manifest_sha)) and
        utc_seconds(review['created_at']) <= now.timestamp(), 'NEW exact-kit verdict missing')
    yy = gate['yyGo']
    require(yy['authorizationMode'] == 'AUTO_AFTER_REVIEW' and yy['standingScopeText'] == 'my go covers all' and
        yy['evidenceSha256'] == manifest['files']['yy-authorization-evidence.md'] and yy['releaseHead'] == CANDIDATE_HEAD,
        'Original standing YY evidence is not bound to this release')


def frozen_files(root, manifest):
    measurement_manifest(manifest)
    for name, digest in manifest['files'].items():
        require(pathlib.PurePosixPath(name).name == name and sha(safe_reference(root, name)) == digest,
            'Frozen file changed: ' + name)
    require((root / 'prepared-manifest.json').stat().st_mode & 0o777 == 0o400, 'Manifest is not immutable')
    pin = json.loads((root / 'target-pin.json').read_bytes())
    candidate_identity(pin)
    require(pin['image'] == manifest['image'], 'Frozen image differs')
    proof = json.loads((root / 'rehearsal-receipt.json').read_bytes())
    validate_proof(proof, pin)
    require(manifest.get('measuredTimingHeadroom') == proof['measuredTimingHeadroom'],
        'Frozen measured timing headroom differs from the original proof')
    proof_authority(proof, pin, json.loads((root / 'proof-source-index.json').read_bytes()),
        json.loads((root / 'proof-authority.json').read_bytes()), sha(root / 'proof-authority.json'))
    review = json.loads((root / 'production-baseline-source-review.json').read_bytes())
    require(review['id'] == manifest['productionBaselineSourceReviewId'], 'Production source review changed')
    production_source_review(review, manifest['packagingCommit'], manifest['files'])
    return pin


def original_cursor_intake(proof, record, original_config):
    """Bind pending identities to the actual immutable baseline cursor, including empty."""
    require(proof['naturalIntakePolicy'] == NATURAL_INTAKE_POLICY and
        record['configId'] == original_config['id'] == TARGET_CONFIG and
        record['labId'] == original_config['labId'] == TARGET_LAB and
        record['projectCode'] == original_config['projectCode'] == TARGET_PROJECT and
        record['since'] == original_config['lastSubmissionId'], 'Original intake cursor or config differs')
    ids = record['submissionIds']
    require(isinstance(ids, list) and all(isinstance(value, str) and value.isdigit() for value in ids) and
        len(set(ids)) == len(ids) and ids == sorted(ids, key=int) and
        (record['since'] is None or str(record['since']).isdigit()) and
        all(record['since'] is None or int(value) > int(record['since']) for value in ids),
        'Actual pending submission identities differ')
    require(type(proof['initialTargetSubmissionCount']) is int and
        proof['initialTargetSubmissionCount'] == len(ids), 'Actual initial pending count differs')


def pairing_contract(row):
    require(row['refusalPairingScopeCommentId'] == REFUSAL_PAIRING_SCOPE_COMMENT_ID and
        row['schedulerRefusalPairing'] == REFUSAL_PAIRING_POLICY and
        row['REFUSAL_PAIR_WINDOW_SECONDS'] == REFUSAL_PAIR_WINDOW_SECONDS,
        'Cross-stream pairing authority or timing differs')


def pairing_review_tokens():
    return ['refusalPairingScopeCommentId=' + str(REFUSAL_PAIRING_SCOPE_COMMENT_ID),
        'schedulerRefusalPairing=' + REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']


def sealed_scheduler_evidence(proof, expected, stdout, stderr, first, second, full):
    """Recheck the original timestamped log against its sealed copy results."""
    require(proof['expectedSchedulerRefusals'] == expected, 'Fresh baseline refusal scope differs')
    observed = scheduler_refusals(stdout, stderr, expected)
    pairing_contract(proof)
    lab_counts = {lab: sum(row['labId'] == lab for row in observed)
        for lab in sorted({row['labId'] for row in expected})}
    require(proof['schedulerRefusalLabCounts'] == lab_counts and
        proof['schedulerRefusalConfigCountsDerivedFromTriggers'] is True, 'Per-lab refusal counts differ')
    counts = {row['configId']: sum(value['configId'] == row['configId'] for value in observed)
        for row in expected}
    require(proof['observedSchedulerRefusals'] == observed and proof['schedulerRefusalCounts'] == counts,
        'Retained scheduler refusal evidence differs')
    completions = completed_syncs(stdout)
    require(len(completions) >= 2 and proof['firstScheduledSync'] == completions[0] and
        proof['secondScheduledSync'] == completions[1], 'Original natural completion evidence differs')
    protected = sorted(row['configId'] for row in expected)
    for state in [first, second, full]:
        require(state['protectedRefusalConfigIds'] == protected, 'Failed configuration protection differs')
    require(proof['firstIntakeSummary'] == intake_summary(first, completions[0]) and
        proof['secondIntakeSummary'] == intake_summary(second, completions[1]) and
        proof['secondGenuinelyNewSubmissionIds'] == second['newSubmissionIds'].get(TARGET_CONFIG, []),
        'Sealed Sample-row cardinality differs')


