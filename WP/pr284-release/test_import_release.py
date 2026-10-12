"""Owned pure release refusal tests; no host, network or production DB access."""
import copy
import datetime
import hashlib
import pathlib
import stat
import tempfile
import types
import unittest
from unittest.mock import patch

import import_proof_contract as proof_contract
import import_release_contract as release
from test_import_installation import plan, applied
from test_import_startup_checks import ready_values, entry_values

RAW_TOOLING = {}
RAW_PACKAGE = {}


def native():
    return {'status': 'EXACT_NATIVE_IMPORT_DRY_APPLY_REPEAT_PASS', 'originalTableCount': 104,
        'originalReceiptCount': 38, 'installedTableCount': 106, 'installedReceiptCount': 39,
        'repeatDatabaseChanges': 0, 'allOriginalRowsAndSchemaPreserved': True, 'forwardOnly': True,
        'originalRowsSha256': 'b' * 64, 'beforeBackupSha256': 'a' * 64,
        'afterBackupSha256': 'c' * 64, 'preservationSha256': 'd' * 64,
        'dryRunCopyAuthoritySha256': 'd' * 64,
        'dryRunCopy': {'policy': release.DRY_COPY_POLICY, 'beforeBackupSha256': 'a' * 64,
            'mainSha256': 'a' * 64, 'targetPhysicalTriplePreserved': True,
            'files': {'dev.db': {'sha256': 'a' * 64, 'bytes': 1234}}},
        'dry': plan(), 'apply': applied(), 'repeat': dict(plan(), classification='COMPLETE_200', mode='NO_OP'),
        'measurements': [{'containerName': 'owned-' + str(i), 'owner': 'owned-stage-' + str(i),
            'memoryLimitBytes': release.LIMIT, 'nodeOptions': '', 'exitCode': 0,
            'memorySwapLimitBytes': release.LIMIT, 'networkMode': 'none', 'timeoutSeconds': 600, 'elapsedSeconds': 20.0,
            'retainedOwnedContainer': True,
            'retainedArtifacts': {label + '.stdout': 'e' * 64, label + '.stderr': 'f' * 64},
            'cgroupMemoryPeak': {'releaseCliPeakBytes': 500000000,
                'childStatus': 0, 'childSignal': None}}
            for i, label in enumerate(['import-dry', 'import-apply', 'import-repeat'])]}


def startup(jobs):
    ready = {'deadlineSeconds': 600, 'elapsedSeconds': 103,
        'sharedReadinessCode': release.SHARED_READINESS_SHA, 'restartCount': 0,
        'oomKilled': False, 'memoryLimitBytes': release.LIMIT, 'jobsEnabled': jobs}
    checks = {'startupChanges': 0, 'entrypointInstallers': entry_values(), 'startupReady': ready_values(),
        'ownedJobsBoundary': {'policy': 'ISOLATED_NATURAL_INTAKE_WITH_SEALED_FIRST_SECOND_FULL_PRESERVATION',
            'dataVersionsObserved': [2], 'fullStateZeroClaimed': False} if jobs else None,
        'startupMemory': {'peakBytes': 400000000, 'nodeOptions': None}}
    return ready, checks


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        for module in [proof_contract, release]:
            for key, value in [('AUDITED_PR_HEAD', 'a' * 40), ('CANDIDATE_HEAD', 'b' * 40),
                ('AUDITED_PR_TREE', 'c' * 40), ('MERGED_TREE', 'c' * 40),
                ('MERGE_PARENTS', [release.BASE_HEAD, 'a' * 40])]:
                patcher = patch.object(module, key, value); patcher.start(); self.addCleanup(patcher.stop)
        self.proof_files = {name: hashlib.sha256(raw).hexdigest() for name, raw in RAW_TOOLING.items()}
        self.files = {name: hashlib.sha256(raw).hexdigest() for name, raw in RAW_PACKAGE.items()}
        for key, value in [('REVIEWED_PROOF_SOURCE', 'd' * 40), ('PROOF_SOURCE_REVIEW_ID', 999900001),
            ('REVIEWED_PROOF_FILES', self.proof_files)]:
            patcher = patch.object(release, key, value); patcher.start(); self.addCleanup(patcher.stop)

    def manifest(self):
        files = dict(self.files)
        files.update({name: 'e' * 64 for name in release.FROZEN_FILE_SET - files.keys()})
        files['apache-before.conf'] = release.ORIGINAL_INGRESS_SHA
        files['apache-held.conf'] = release.HELD_INGRESS_SHA
        return {'files': files, 'status': release.KIT_STATUS,
            'root': '/opt/lims/releases/instrument-import-release-owned',
            'originalProofRoot': '/opt/lims/releases/instrument-import-proof-owned',
            'head': release.CANDIDATE_HEAD, 'baseHead': release.BASE_HEAD,
            'tree': release.MERGED_TREE, 'auditedPrTree': release.AUDITED_PR_TREE,
            'mergeParents': release.MERGE_PARENTS, 'sourceReviewId': release.PROOF_SOURCE_REVIEW_ID,
            'proofToolingCommit': release.REVIEWED_PROOF_SOURCE,
            'packagingCommit': 'f' * 40, 'productionBaselineSourceReviewId': 999900002,
            'entryBinding': release.entry_binding(), 'workloadControl': release.WORKLOAD_PINS,
            'historicalReceiptSha256': release.HISTORICAL_RECEIPT_SHA,
            'naturalIntakePolicy': release.NATURAL_INTAKE_POLICY,
            'importDeltaPolicy': release.NATIVE_DELTA_POLICY, 'separateInstallerCommands': 3,
            'retainedDatabaseAllocationCount': 12, 'productionObservationSeconds': 660,
            'deadlineSeconds': 600, 'reserveFloorBytes': release.FLOOR,
            'baselineVanishedProcessPolicy': release.BASELINE_POLICY,
            'BASELINE_ATTEMPTS_MAX': 3, 'BASELINE_CONFIRMATION_DEADLINE_SECONDS': 10,
            'coreDeallocationConfirmationDeadlineSeconds': 10,
            'refusalPairingScopeCommentId': release.REFUSAL_PAIRING_SCOPE_COMMENT_ID,
            'schedulerRefusalPairing': release.REFUSAL_PAIRING_POLICY,
            'REFUSAL_PAIR_WINDOW_SECONDS': release.REFUSAL_PAIR_WINDOW_SECONDS,
            'image': 'sha256:' + '9' * 64}

    def test_exact_three_native_cli_steps_pass(self):
        release.native_installation(native())

    def test_native_cli_output_bindings_cannot_be_omitted_or_reordered(self):
        for change in ['missing', 'wrong-label', 'bad-hash', 'extra']:
            row = native(); value = row['measurements'][0]['retainedArtifacts']
            if change == 'missing': value.clear()
            if change == 'wrong-label': row['measurements'][0]['retainedArtifacts'] = row['measurements'][1]['retainedArtifacts']
            if change == 'bad-hash': value['import-dry.stdout'] = 'abc'
            if change == 'extra': value['other-file'] = 'a' * 64
            with self.subTest(change=change), self.assertRaises(RuntimeError): release.native_installation(row)

    def test_old_receipts_backfill_or_missing_cli_refuse(self):
        for key, value in [('originalTableCount', 90), ('originalReceiptCount', 18),
            ('installedReceiptCount', 38), ('installedTableCount', 104), ('repeatDatabaseChanges', 1),
            ('forwardOnly', False), ('status', 'NO_OP'), ('allOriginalRowsAndSchemaPreserved', False)]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.native_installation(dict(native(), **{key: value}))
        for value in [native()['measurements'][:2], [native()['measurements'][0]] * 3]:
            with self.assertRaises(RuntimeError): release.native_installation(dict(native(), measurements=value))

    def test_failed_or_unbounded_cli_refuses(self):
        for key, value in [('exitCode', 1), ('nodeOptions', '--max-old-space-size=900'),
            ('memoryLimitBytes', 1073741824), ('retainedOwnedContainer', False),
            ('memorySwapLimitBytes', -1), ('networkMode', 'bridge'), ('timeoutSeconds', 240),
            ('elapsedSeconds', 600), ('elapsedSeconds', False)]:
            row = native(); row['measurements'][1][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): release.native_installation(row)

    def test_native_dry_copy_cannot_be_missing_changed_or_have_wal_frames(self):
        for change in ['missing', 'wrong-main', 'target-write', 'wal-frames']:
            row = native()
            if change == 'missing': row.pop('dryRunCopy')
            if change == 'wrong-main': row['dryRunCopy']['mainSha256'] = 'f' * 64
            if change == 'target-write': row['dryRunCopy']['targetPhysicalTriplePreserved'] = False
            if change == 'wal-frames': row['dryRunCopy']['files']['dev.db-wal'] = {'bytes': 1, 'sha256': 'f' * 64}
            with self.subTest(change=change), self.assertRaises(RuntimeError): release.native_installation(row)

    def test_jobs_on_cannot_omit_boundary_or_claim_zero_full_state(self):
        for change in [None, {'policy': 'anything'}, {
                'policy': 'ISOLATED_NATURAL_INTAKE_WITH_SEALED_FIRST_SECOND_FULL_PRESERVATION',
                'dataVersionsObserved': [2], 'fullStateZeroClaimed': True}]:
            ready, checks = startup(True); checks['ownedJobsBoundary'] = change
            with self.assertRaises(RuntimeError): release.startup_evidence(ready, checks, True)
        for key, value in [('releaseCliPeakBytes', release.LIMIT + 1), ('releaseCliPeakBytes', 0),
            ('childStatus', 1), ('childStatus', False), ('childSignal', 'SIGKILL')]:
            row = native(); row['measurements'][2]['cgroupMemoryPeak'][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): release.native_installation(row)

    def test_original_hash_or_dry_apply_repeat_tampering_refuses(self):
        for key in ['originalRowsSha256', 'beforeBackupSha256', 'afterBackupSha256', 'preservationSha256']:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.native_installation(dict(native(), **{key: ''}))
        for stage in ['dry', 'apply', 'repeat']:
            row = native(); row[stage]['backfilledCount'] = 1
            with self.subTest(stage=stage), self.assertRaises(RuntimeError): release.native_installation(row)

    def test_exact_new_startups_pass(self):
        for jobs in [False, True]: release.startup_evidence(*startup(jobs), jobs)

    def test_historical_startup_counts_reorder_and_writes_refuse(self):
        for change in ['old-entry', 'old-ready', 'reorder', 'write', 'wrong-source']:
            ready, checks = startup(False)
            if change == 'old-entry': checks['entrypointInstallers'].pop()
            if change == 'old-ready': checks['startupReady'].pop()
            if change == 'reorder': checks['startupReady'].reverse()
            if change == 'write': checks['startupReady'][3]['totalChanges'] = 1
            if change == 'wrong-source': checks['startupReady'][-1]['sources'] = {}
            with self.subTest(change=change), self.assertRaises(RuntimeError): release.startup_evidence(ready, checks, False)

    def test_readiness_deadline_oom_restarts_or_wrong_jobs_refuse(self):
        ready, checks = startup(False)
        for key, value in [('elapsedSeconds', 600), ('restartCount', 1), ('oomKilled', True),
            ('memoryLimitBytes', release.LIMIT + 1), ('jobsEnabled', True)]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.startup_evidence(dict(ready, **{key: value}), checks, False)

    def test_unbound_proof_source_never_authorizes_freeze(self):
        with patch.object(release, 'PROOF_SOURCE_REVIEW_ID', 0), self.assertRaises(RuntimeError):
            release.require_bound_proof_source()
        with patch.object(release, 'PROOF_SOURCE_REVIEW_ID', 6117398054), self.assertRaises(RuntimeError):
            release.require_bound_proof_source()
        with patch.object(release, 'REVIEWED_PROOF_FILES', {}), self.assertRaises(RuntimeError):
            release.require_bound_proof_source()

    def test_complete_frozen_manifest_accepts_only_new_source_delta(self):
        manifest = self.manifest(); release.measurement_manifest(manifest)
        for key, value in [('separateInstallerCommands', 0), ('retainedDatabaseAllocationCount', 6),
            ('sourceReviewId', 6117398054), ('deadlineSeconds', 601), ('productionObservationSeconds', 659),
            ('importDeltaPolicy', 'OTHER'), ('workloadControl', {}), ('entryBinding', {'failedReceipt': 'old'}),
            ('root', '/opt/lims/releases/runtime-kobo-release-old')]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.measurement_manifest(dict(manifest, **{key: value}))

    def test_measured_source_missing_changed_or_extra_frozen_file_refuses(self):
        for change in ['missing', 'changed', 'extra']:
            row = self.manifest()
            if change == 'missing': del row['files']['import_stage.py']
            if change == 'changed': row['files']['rehearse_import.py'] = '1' * 64
            if change == 'extra': row['files']['dev.db'] = '1' * 64
            with self.subTest(change=change), self.assertRaises(RuntimeError): release.measurement_manifest(row)

    def test_healthy_entry_only_and_gate_entry_identity(self):
        manifest = self.manifest()
        entry = {'mode': 'RUNNING_NORMAL', 'containerId': '1' * 64, 'image': release.LIVE_IMAGE,
            'restartCount': 0, 'ingressSha256': release.ORIGINAL_INGRESS_SHA, 'originalFiles': None}
        release.validate_entry_state(entry, manifest)
        for key, value in [('mode', 'STOPPED_HELD'), ('restartCount', 1), ('restartCount', False),
            ('image', manifest['image']), ('ingressSha256', release.HELD_INGRESS_SHA), ('originalFiles', {})]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.validate_entry_state(dict(entry, **{key: value}), manifest)
        gate = {'readOnlyExecutionReadiness': {'entryState': entry}}
        release.verify_entry_readiness(manifest, gate, {'entryState': entry})
        with self.assertRaises(RuntimeError): release.verify_entry_readiness(manifest, gate,
            {'entryState': dict(entry, containerId='2' * 64)})

    def test_nested_proof_references_refuse_traversal_or_symlink(self):
        with tempfile.TemporaryDirectory(prefix='owned-reference-') as directory:
            root = pathlib.Path(directory); (root / 'after-second-stopped').mkdir()
            path = root / 'after-second-stopped/dev-stopped-backup.db'; path.write_bytes(b'owned')
            path.chmod(0o400)
            # Windows represents only its read-only bit; no production file is involved.
            with patch.object(pathlib.Path, 'stat', autospec=True, side_effect=lambda p, *a, **kw:
                    type('OwnedStat', (), {'st_mode': 0o400})()):
                # is_file also reads stat, so exercise path syntax failures before it.
                for name in ['../dev.db', '/opt/lims/dev.db', 'after-second-stopped/../dev.db',
                    'after-second-stopped\\dev.db', './dev.db', 'after-second-stopped//dev.db']:
                    with self.subTest(name=name), self.assertRaises(RuntimeError): release.safe_reference(root, name)

    def test_nested_retained_file_accepts_and_link_or_writable_file_refuses(self):
        with tempfile.TemporaryDirectory(prefix='owned-reference-') as directory:
            root = pathlib.Path(directory); (root / 'stopped/raw').mkdir(parents=True)
            path = root / 'stopped/raw/dev.db'; path.write_bytes(b'owned fixture'); path.chmod(0o400)
            original_stat = pathlib.Path.stat
            # Preserve the real filesystem/type observations; compensate only
            # for Windows lacking POSIX permission bits on this owned fixture.
            def immutable_stat(value, *args, **kwargs):
                observed = original_stat(value, *args, **kwargs)
                mode = (observed.st_mode & ~0o777) | (0o400 if stat.S_ISREG(observed.st_mode) else 0o700)
                return types.SimpleNamespace(st_mode=mode)
            with patch.object(pathlib.Path, 'stat', autospec=True, side_effect=immutable_stat):
                self.assertEqual(release.safe_reference(root, 'stopped/raw/dev.db'), path)
                with patch.object(pathlib.Path, 'is_symlink', autospec=True,
                        side_effect=lambda value: value == root / 'stopped'), self.assertRaises(RuntimeError):
                    release.safe_reference(root, 'stopped/raw/dev.db')
                with patch.object(pathlib.Path, 'stat', return_value=types.SimpleNamespace(st_mode=stat.S_IFREG | 0o600)), \
                        self.assertRaises(RuntimeError): release.safe_reference(root, 'stopped/raw/dev.db')
            for name in [None, 123, '', '.']:
                with self.subTest(name=name), self.assertRaises(RuntimeError): release.safe_reference(root, name)

    def test_production_source_primary_full_review_required(self):
        tokens = release.release_binding_tokens() + release.source_policy_tokens() + ['f' * 40,
            release.REVIEWED_PROOF_SOURCE, 'proofSourceReviewId=' + str(release.PROOF_SOURCE_REVIEW_ID)]
        tokens += [name + '=' + digest for name, digest in sorted(self.files.items())]
        review = {'id': 999900002, 'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-999900002',
            'created_at': '2026-10-12T00:00:00Z', 'body': 'Source review: PASS\n' + '\n'.join(tokens)}
        release.production_source_review(review, 'f' * 40, self.files)
        for key, value in [('id', 6117551195), ('created_at', '2099-01-01T00:00:00Z'),
            ('body', '> ' + review['body']), ('body', review['body'] + '\nAudit failed'),
            ('body', review['body'].replace('deploy_import.py=', 'OTHER='))]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.production_source_review(dict(review, **{key: value}), 'f' * 40, self.files)

    def test_old_or_stale_gate_never_passes_initial_authority(self):
        manifest = self.manifest()
        gate = {'status': 'FRESH_SINGLE_USE_IMPORT_GATE', 'executionRoot': manifest['root'],
            'head': manifest['head'], 'currentMainHead': manifest['head'], 'image': manifest['image'],
            'manifestSha256': 'a' * 64, 'workloadControl': release.WORKLOAD_PINS,
            'entryBinding': release.entry_binding(), 'frozenFiles': manifest['files'],
            'verifiedUtc': '2026-10-12T00:00:00Z'}
        self.add_gate_hashes(gate, manifest)
        now = datetime.datetime(2026, 10, 12, 0, 11, tzinfo=datetime.timezone.utc)
        with self.assertRaisesRegex(RuntimeError, 'stale'): release.verify_gate(manifest, gate, 'a' * 64, now)
        for key, value in [('status', 'FRESH_SINGLE_USE_RUNTIME_GATE'), ('head', release.BASE_HEAD),
            ('entryBinding', {}), ('frozenFiles', {})]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.verify_gate(manifest, dict(gate, **{key: value}), 'a' * 64, now)

    def add_gate_hashes(self, gate, manifest):
        for key, name in [('coordinatorSha256', 'deploy_import.py'), ('rehearsalReceiptSha256', 'rehearsal-receipt.json'),
            ('targetPinSha256', 'target-pin.json'), ('yyEvidenceSha256', 'yy-authorization-evidence.md'),
            ('proofAuthoritySha256', 'proof-authority.json'), ('proofSourceIndexSha256', 'proof-source-index.json'),
            ('diskMeasurementGuardSha256', 'known_core_disk_guard_v2.py'),
            ('baselineMeasurementGuardSha256', 'known_core_disk_guard_v3.py'),
            ('proofBaselineLayoutGuardSha256', 'known_core_disk_guard_import.py'),
            ('productionBaselineAdapterSha256', 'known_core_disk_guard_import_deploy.py'),
            ('productionBaselineSourceReviewSha256', 'production-baseline-source-review.json'),
            ('copyVerifierSha256', 'kobo_copy_preservation.py'), ('proofContractSha256', 'import_proof_contract.py')]:
            gate[key] = manifest['files'][name]

    def source_verdict(self, production=False):
        tokens = proof_contract.release_binding_tokens() + release.source_policy_tokens() + [
            'd' * 40, 'f' * 40, 'proofSourceReviewId=' + str(release.PROOF_SOURCE_REVIEW_ID),
            'proofBaselineLayoutPolicy=' + release.PROOF_BASELINE_LAYOUT_POLICY,
            'refusalScopeCommentId=' + str(release.REFUSAL_SCOPE_COMMENT_ID),
            release.REFUSAL_POLICY, release.CARDINALITY_POLICY,
            'refusalPairingScopeCommentId=' + str(release.REFUSAL_PAIRING_SCOPE_COMMENT_ID),
            'schedulerRefusalPairing=' + release.REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']
        files = self.files if production else self.proof_files
        tokens += [name + '=' + digest for name, digest in sorted(files.items())]
        identifier = 999900002 if production else 999900001
        return {'id': identifier, 'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(identifier),
            'created_at': '2026-10-12T00:00:00Z', 'body': 'Source review: PASS\n' + '\n'.join(tokens)}

    def complete_gate(self, manifest):
        entry = {'mode': 'RUNNING_NORMAL', 'containerId': '1' * 64, 'image': release.LIVE_IMAGE,
            'restartCount': 0, 'ingressSha256': release.ORIGINAL_INGRESS_SHA, 'originalFiles': None}
        kit_review = {'id': 999900003, 'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-999900003',
            'created_at': '2026-10-12T00:00:00Z', 'body': '\n'.join(release.review_tokens(manifest, 'a' * 64))}
        # The actual verdict must be the first line, regardless of token order.
        kit_review['body'] = release.PHRASE + '\n' + kit_review['body']
        pr_review = {'id': 999900004, 'html_url': 'https://github.com/yigini/soilfer-lims/pull/284#issuecomment-999900004',
            'body': release.PHRASE + '\n' + release.AUDITED_PR_HEAD, 'created_at': '2026-10-12T00:00:00Z'}
        gate = {'status': 'FRESH_SINGLE_USE_IMPORT_GATE', 'executionRoot': manifest['root'],
            'head': manifest['head'], 'currentMainHead': manifest['head'], 'image': manifest['image'],
            'manifestSha256': 'a' * 64, 'workloadControl': release.WORKLOAD_PINS,
            'entryBinding': release.entry_binding(), 'frozenFiles': manifest['files'],
            'verifiedUtc': '2026-10-12T00:00:00Z', 'laterSourceAuditFailure': False,
            'laterProductionSourceAuditFailure': False, 'laterKitAuditFailure': False,
            'proofSourceReview': self.source_verdict(), 'productionBaselineSourceReview': self.source_verdict(True),
            'readOnlyExecutionReadiness': {'ready': True, 'productionMutations': 0,
                'freeBytes': {'/opt/lims': release.FLOOR + 100, '/var/lib/docker': release.FLOOR + 100},
                'requiredIncludingBackupBytes': release.FLOOR + 50, 'reserveBytes': release.FLOOR, 'entryState': entry},
            'pr': {'number': 284, 'merged': True, 'head': release.AUDITED_PR_HEAD,
                'mergeCommit': release.CANDIDATE_HEAD, 'tree': release.MERGED_TREE,
                'auditedTree': release.AUDITED_PR_TREE, 'mergeParents': release.MERGE_PARENTS,
                'laterAuditFailure': False, 'review': pr_review,
                'checks': [{'head_sha': release.AUDITED_PR_HEAD, 'status': 'completed', 'conclusion': 'success'}]},
            'mainCi': {'head_sha': release.CANDIDATE_HEAD, 'name': 'CI', 'event': 'push',
                'status': 'completed', 'conclusion': 'success'}, 'kitReview': kit_review,
            'yyGo': {'authorizationMode': 'AUTO_AFTER_REVIEW', 'standingScopeText': 'my go covers all',
                'evidenceSha256': manifest['files']['yy-authorization-evidence.md'], 'releaseHead': manifest['head']}}
        self.add_gate_hashes(gate, manifest)
        return gate

    def test_complete_new_gate_checks_all_three_formal_approvals(self):
        manifest = self.manifest(); gate = self.complete_gate(manifest)
        release.verify_gate(manifest, gate, 'a' * 64,
            datetime.datetime(2026, 10, 12, 0, 5, tzinfo=datetime.timezone.utc))
        for approval in ['proofSourceReview', 'productionBaselineSourceReview', 'kitReview']:
            for change in ['quoted', 'failed', 'future']:
                altered = copy.deepcopy(gate)
                if change == 'quoted': altered[approval]['body'] = '> ' + altered[approval]['body']
                if change == 'failed': altered[approval]['body'] += '\nAudit failed'
                if change == 'future': altered[approval]['created_at'] = '2099-01-01T00:00:00Z'
                with self.subTest(approval=approval, change=change), self.assertRaises(RuntimeError):
                    release.verify_gate(manifest, altered, 'a' * 64,
                        datetime.datetime(2026, 10, 12, 0, 5, tzinfo=datetime.timezone.utc))

    def test_full_gate_stale_ci_headroom_later_failure_and_hash_change_refuse(self):
        manifest = self.manifest(); gate = self.complete_gate(manifest)
        for change in ['main-ci', 'pr-ci', 'headroom', 'kit-negative', 'source-negative',
            'production-negative', 'wrong-coordinator', 'wrong-yy-release', 'missing-kit-token', 'old-kit']:
            altered = copy.deepcopy(gate)
            if change == 'main-ci': altered['mainCi']['conclusion'] = 'failure'
            if change == 'pr-ci': altered['pr']['checks'][0]['head_sha'] = release.BASE_HEAD
            if change == 'headroom': altered['readOnlyExecutionReadiness']['freeBytes']['/opt/lims'] = release.FLOOR
            if change == 'kit-negative': altered['laterKitAuditFailure'] = True
            if change == 'source-negative': altered['laterSourceAuditFailure'] = True
            if change == 'production-negative': altered['laterProductionSourceAuditFailure'] = True
            if change == 'wrong-coordinator': altered['coordinatorSha256'] = '0' * 64
            if change == 'wrong-yy-release': altered['yyGo']['releaseHead'] = release.BASE_HEAD
            if change == 'missing-kit-token': altered['kitReview']['body'] = release.PHRASE
            if change == 'old-kit':
                altered['kitReview']['id'] = 6118040064
                altered['kitReview']['html_url'] = 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6118040064'
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                release.verify_gate(manifest, altered, 'a' * 64,
                    datetime.datetime(2026, 10, 12, 0, 5, tzinfo=datetime.timezone.utc))

    def complete_proof(self):
        native_row = native()
        off_ready, off_checks = startup(False); on_ready, on_checks = startup(True)
        on_ready['readyUtc'] = '2026-10-12T00:00:00Z'
        first = {'utc': '2026-10-12T00:01:00Z', 'epochSeconds': 60}
        second = {'utc': '2026-10-12T00:16:00Z', 'epochSeconds': 960}
        seal = {'policy': release.WAL_RECOVERY_POLICY, 'countsIncludeWal': True,
            'protectedTableCount': 106, 'protectedReceiptCount': 39, 'matchesExpected': True}
        proof = {'status': 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF', 'head': release.CANDIDATE_HEAD,
            'image': 'sha256:' + '9' * 64, 'buildReceiptSha256': '8' * 64,
            'baseHead': release.BASE_HEAD, 'pr': 284, 'tree': release.MERGED_TREE,
            'auditedTree': release.AUDITED_PR_TREE, 'mergeParents': release.MERGE_PARENTS,
            'naturalIntakePolicy': release.NATURAL_INTAKE_POLICY, 'toolingCommit': release.REVIEWED_PROOF_SOURCE,
            'proofSourceReviewId': release.PROOF_SOURCE_REVIEW_ID,
            'coordinatorSha256': self.proof_files['rehearse_import.py'],
            'proofContractSha256': self.proof_files['import_proof_contract.py'],
            'proofBaselineLayoutGuardSha256': self.proof_files['known_core_disk_guard_import.py'],
            'proofBaselineLayoutPolicy': release.PROOF_BASELINE_LAYOUT_POLICY,
            'copyVerifierSha256': release.REVIEWED_VERIFIER_SHA, 'diskMeasurementGuardSha256': release.MEASUREMENT_GUARD_SHA,
            'baselineMeasurementGuardSha256': release.BASELINE_GUARD_SHA,
            'baselineVanishedProcessPolicy': release.BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX': 3,
            'BASELINE_CONFIRMATION_DEADLINE_SECONDS': 10, 'coreDeallocationConfirmationDeadlineSeconds': 10,
            'baselineAttempt': 1, 'refusalScopeCommentId': release.REFUSAL_SCOPE_COMMENT_ID,
            'schedulerRefusalPolicy': release.REFUSAL_POLICY, 'intakeCardinalityPolicy': release.CARDINALITY_POLICY,
            'authoritySha256': '7' * 64, 'refusalPairingScopeCommentId': release.REFUSAL_PAIRING_SCOPE_COMMENT_ID,
            'schedulerRefusalPairing': release.REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS': 1,
            'historicalReceiptSha256': release.HISTORICAL_RECEIPT_SHA, 'productionMutations': 0,
            'separateInstallerCommands': 3, 'ownedWriterStopped': True, 'effectiveUid': 0, 'pythonOptimize': 0,
            'baselineEnumerationErrorCount': 0, 'retainedDatabaseAllocationCount': 12,
            'workloadPins': release.WORKLOAD_PINS, 'reserveBytes': release.FLOOR,
            'importDeltaPolicy': release.NATIVE_DELTA_POLICY, 'existingSampleVerifierPolicy': 'STRICT_ORIGINAL_ROWS',
            'allOriginalRowsAndSchemaPreserved': True, 'originalProtectedTableCount': 104,
            'originalProtectedReceiptCount': 38, 'protectedTableCount': 106, 'protectedReceiptCount': 39,
            'nativeImportInstallation': native_row, 'freshCopySha256': native_row['beforeBackupSha256'],
            'installedBaselineSha256': native_row['afterBackupSha256'], 'jobsOffStoppedSeal': seal,
            'finalStoppedSeal': seal, 'memoryLimitBytes': release.LIMIT, 'nodeOptions': '', 'peakBytes': 400000000,
            'databaseChangesBeforeJobs': 0, 'healthSamples': [{'healthy': True, 'restartCount': 0, 'peakBytes': 400000000}],
            'jobsOffReadiness': off_ready, 'jobsOffStartup': off_checks, 'jobsOnReadiness': on_ready, 'jobsOnStartup': on_checks,
            'apiChecks': {'passed': 31, 'total': 31, 'failed': 0}, 'probes': [{'exitCode': 0} for _ in range(6)],
            'readOnlyProbeChanges': 0, 'firstScheduledSync': first, 'secondScheduledSync': second,
            'observedThroughUtc': '2026-10-12T00:18:00Z', 'copySyncIntervalMins': 15, 'healthySoakSeconds': 1080}
        pin = {'head': release.CANDIDATE_HEAD, 'baseHead': release.BASE_HEAD, 'auditedPrHead': release.AUDITED_PR_HEAD,
            'pr': 284, 'tree': release.MERGED_TREE, 'auditedTree': release.AUDITED_PR_TREE,
            'mergeParents': release.MERGE_PARENTS, 'image': proof['image'], 'buildReceiptSha256': proof['buildReceiptSha256'],
            'proofSourceReviewId': release.PROOF_SOURCE_REVIEW_ID}
        return proof, pin

    def test_complete_import_proof_and_strict_natural_window(self):
        proof, pin = self.complete_proof(); release.validate_proof(proof, pin)
        for key, value in [('status', 'FAILED_NEW_IMPORT_NATURAL_KOBO_PROOF'),
            ('protectedTableCount', 104), ('protectedReceiptCount', 38), ('ownedWriterStopped', False),
            ('databaseChangesBeforeJobs', 1), ('productionMutations', False), ('healthySoakSeconds', 659),
            ('observedThroughUtc', '2026-10-12T00:17:00Z'), ('coordinatorSha256', '0' * 64)]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.validate_proof(dict(proof, **{key: value}), pin)
        altered = copy.deepcopy(proof); altered['secondScheduledSync']['epochSeconds'] = 61
        with self.assertRaises(RuntimeError): release.validate_proof(altered, pin)

