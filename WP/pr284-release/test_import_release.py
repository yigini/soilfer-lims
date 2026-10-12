"""Owned pure release refusal tests; no host, network or production DB access."""
import copy
import datetime
import hashlib
import pathlib
import tempfile
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
        'dry': plan(), 'apply': applied(), 'repeat': dict(plan(), classification='COMPLETE_200', mode='NO_OP'),
        'measurements': [{'containerName': 'owned-' + str(i), 'owner': 'owned-stage-' + str(i),
            'memoryLimitBytes': release.LIMIT, 'nodeOptions': '', 'exitCode': 0,
            'retainedOwnedContainer': True, 'cgroupMemoryPeak': {'releaseCliPeakBytes': 500000000,
                'childStatus': 0, 'childSignal': None}} for i in range(3)]}


def startup(jobs):
    ready = {'deadlineSeconds': 600, 'elapsedSeconds': 103,
        'sharedReadinessCode': release.SHARED_READINESS_SHA, 'restartCount': 0,
        'oomKilled': False, 'memoryLimitBytes': release.LIMIT, 'jobsEnabled': jobs}
    checks = {'startupChanges': 0, 'entrypointInstallers': entry_values(), 'startupReady': ready_values(),
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
            ('memoryLimitBytes', 1073741824), ('retainedOwnedContainer', False)]:
            row = native(); row['measurements'][1][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): release.native_installation(row)
        for key, value in [('releaseCliPeakBytes', release.LIMIT + 1), ('releaseCliPeakBytes', 0),
            ('childStatus', 1), ('childSignal', 'SIGKILL')]:
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
        now = datetime.datetime(2026, 10, 12, 0, 11, tzinfo=datetime.timezone.utc)
        with self.assertRaisesRegex(RuntimeError, 'stale'): release.verify_gate(manifest, gate, 'a' * 64, now)
        for key, value in [('status', 'FRESH_SINGLE_USE_RUNTIME_GATE'), ('head', release.BASE_HEAD),
            ('entryBinding', {}), ('frozenFiles', {})]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                release.verify_gate(manifest, dict(gate, **{key: value}), 'a' * 64, now)

