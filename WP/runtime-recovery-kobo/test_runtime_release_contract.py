"""Synthetic gate tampering fixtures; never contact GitHub, Docker or a host."""
import copy
import ast
import datetime
import unittest
from runtime_release_contract import *
import export_freeze_runtime_kit as packaging_exporter


class RuntimeGateTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 10, 11, 20, 0, tzinfo=datetime.timezone.utc)
        self.manifest = {'status': KIT_STATUS, 'root': '/opt/lims/releases/runtime-kobo-release-fixture',
            'head': CANDIDATE_HEAD, 'image': 'sha256:' + '2' * 64, 'tree': MERGED_TREE,
            'naturalIntakePolicy': NATURAL_INTAKE_POLICY,
            'baseHead': BASE_HEAD, 'workloadControl': WORKLOAD_PINS, 'sourceReviewId': PROOF_SOURCE_REVIEW_ID,
            'proofToolingCommit': REVIEWED_PROOF_SOURCE, 'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
            'baselineMeasurementGuardSha256': BASELINE_GUARD_SHA,
            'proofBaselineLayoutGuardSha256': PROOF_BASELINE_LAYOUT_SHA,
            'proofBaselineLayoutPolicy': PROOF_BASELINE_LAYOUT_POLICY,
            'copyVerifierSha256': REVIEWED_VERIFIER_SHA, 'proofContractSha256': REVIEWED_PROOF_CONTRACT_SHA,
            'refusalScopeCommentId': REFUSAL_SCOPE_COMMENT_ID,
            'schedulerRefusalPolicy': REFUSAL_POLICY, 'intakeCardinalityPolicy': CARDINALITY_POLICY,
            'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
            'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
            'baselineVanishedProcessPolicy': BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX': BASELINE_ATTEMPTS_MAX,
            'BASELINE_CONFIRMATION_DEADLINE_SECONDS': BASELINE_CONFIRMATION_SECONDS,
            'productionBaselineScopeCommentId': PRODUCTION_BASELINE_SCOPE_ID,
            'productionBaselineAdapterSha256': DEPLOY_BASELINE_GUARD_SHA,
            'productionBaselineSourceReviewId': 8000000000, 'packagingCommit': 'd' * 40,
            'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
            'separateInstallerCommands': 0, 'files': {name: str(i) * 64 for i, name in enumerate([
                'deploy_runtime.py', 'rehearsal-receipt.json', 'startup_common.py', 'yy-authorization-evidence.md',
                'target-pin.json', 'proof-authority.json', 'proof-source-index.json',
                'known_core_disk_guard.py', 'known_core_disk_guard_v2.py'], 1)}}
        self.manifest['files']['known_core_disk_guard.py'] = ORIGINAL_GUARD_SHA
        self.manifest['files']['known_core_disk_guard_v2.py'] = MEASUREMENT_GUARD_SHA
        self.manifest['files'].update({'build_candidate.py': '8' * 64, 'prepare_candidate_build.py': '9' * 64,
            'export_launch_runtime_proof.py': 'a' * 64, 'known_core_disk_guard_v3.py': BASELINE_GUARD_SHA,
            'kobo_copy_preservation.py': REVIEWED_VERIFIER_SHA, 'proof_contract.py': REVIEWED_PROOF_CONTRACT_SHA,
            'known_core_disk_guard_deploy.py': DEPLOY_BASELINE_GUARD_SHA,
            'known_core_disk_guard_proof.py': PROOF_BASELINE_LAYOUT_SHA,
            'production-baseline-source-review.json': 'e' * 64})
        for name in PRODUCTION_SOURCE_FILES:
            self.manifest['files'].setdefault(name, 'f' * 64)
        self.manifest_sha = '6' * 64
        review = {'id': 7000000000, 'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-7000000000',
            'body': '\n'.join(review_tokens(self.manifest, self.manifest_sha)), 'created_at': '2026-10-11T19:59:00Z'}
        self.gate = {'status': 'FRESH_SINGLE_USE_RUNTIME_GATE', 'executionRoot': self.manifest['root'],
            'head': self.manifest['head'], 'currentMainHead': self.manifest['head'], 'image': self.manifest['image'],
            'manifestSha256': self.manifest_sha, 'workloadControl': WORKLOAD_PINS, 'verifiedUtc': '2026-10-11T19:59:59Z',
            'coordinatorSha256': '1' * 64, 'rehearsalReceiptSha256': '2' * 64, 'targetPinSha256': '5' * 64,
            'yyEvidenceSha256': '4' * 64, 'pr': {'number': PR_NUMBER, 'merged': True, 'head': AUDITED_PR_HEAD,
                'mergeCommit': self.manifest['head'], 'tree': self.manifest['tree'], 'auditedTree': AUDITED_PR_TREE, 'mergeParents': MERGE_PARENTS,
                'laterAuditFailure': False, 'review': {'html_url': 'https://github.com/yigini/soilfer-lims/pull/291#issuecomment-1',
                    'body': PHRASE + '\n' + AUDITED_PR_HEAD},
                'checks': [{'head_sha': AUDITED_PR_HEAD, 'status': 'completed', 'conclusion': 'success'}]},
            'mainCi': {'head_sha': self.manifest['head'], 'name': 'CI', 'event': 'push', 'status': 'completed', 'conclusion': 'success'},
            'kitReview': review, 'laterKitAuditFailure': False, 'yyGo': {'authorizationMode': 'AUTO_AFTER_REVIEW',
                'evidenceSha256': '4' * 64, 'standingScopeText': 'my go covers all', 'releaseHead': self.manifest['head']}}
        self.gate.update({'proofAuthoritySha256': '6' * 64, 'proofSourceIndexSha256': '7' * 64,
            'productionBaselineAdapterSha256': DEPLOY_BASELINE_GUARD_SHA,
            'productionBaselineScopeCommentId': PRODUCTION_BASELINE_SCOPE_ID,
            'productionBaselineSourceReviewSha256': 'e' * 64, 'laterProductionSourceAuditFailure': False,
            'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
            'baselineMeasurementGuardSha256': BASELINE_GUARD_SHA,
            'proofBaselineLayoutGuardSha256': PROOF_BASELINE_LAYOUT_SHA,
            'proofBaselineLayoutPolicy': PROOF_BASELINE_LAYOUT_POLICY,
            'copyVerifierSha256': REVIEWED_VERIFIER_SHA, 'proofContractSha256': REVIEWED_PROOF_CONTRACT_SHA,
            'refusalScopeCommentId': REFUSAL_SCOPE_COMMENT_ID,
            'schedulerRefusalPolicy': REFUSAL_POLICY, 'intakeCardinalityPolicy': CARDINALITY_POLICY,
            'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
            'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
            'baselineVanishedProcessPolicy': BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX': BASELINE_ATTEMPTS_MAX,
            'BASELINE_CONFIRMATION_DEADLINE_SECONDS': BASELINE_CONFIRMATION_SECONDS,
            'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
            'laterSourceAuditFailure': False, 'proofSourceReview': {'id': PROOF_SOURCE_REVIEW_ID,
                'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(PROOF_SOURCE_REVIEW_ID),
                'created_at': '2026-10-11T19:58:00Z', 'body': '\n'.join(release_binding_tokens() + ['Source review: PASS',
                    REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA, ORIGINAL_GUARD_SHA,
                    BASELINE_GUARD_SHA, REVIEWED_VERIFIER_SHA, REVIEWED_PROOF_CONTRACT_SHA,
                    PROOF_BASELINE_LAYOUT_SHA, 'proofBaselineLayoutPolicy=' + PROOF_BASELINE_LAYOUT_POLICY,
                    'baselineVanishedProcessPolicy=' + BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX=3',
                    'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10', 'refusalScopeCommentId=6113601584',
                    REFUSAL_POLICY, CARDINALITY_POLICY, *pairing_review_tokens(),
                    'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
                    'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED',
                    self.manifest['files']['build_candidate.py'], self.manifest['files']['prepare_candidate_build.py'],
                    self.manifest['files']['export_launch_runtime_proof.py']])}})
        production_tokens = release_binding_tokens() + ['Source review: PASS', self.manifest['packagingCommit'], DEPLOY_BASELINE_GUARD_SHA,
            BASELINE_GUARD_SHA, MEASUREMENT_GUARD_SHA, ORIGINAL_GUARD_SHA,
            'productionBaselineScopeCommentId=' + str(PRODUCTION_BASELINE_SCOPE_ID),
            'REQUIRED_HASHED_MANIFEST_AND_GATE', 'JOURNAL_UNIT_OUTPUT',
            'baselineVanishedProcessPolicy=' + BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX=3',
            'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10', 'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
            'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']
        production_tokens += [self.manifest['files'][name] for name in PRODUCTION_SOURCE_FILES] + pairing_review_tokens()
        production_tokens += [REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, REVIEWED_PROOF_CONTRACT_SHA,
            PROOF_BASELINE_LAYOUT_SHA, 'proofBaselineLayoutPolicy=' + PROOF_BASELINE_LAYOUT_POLICY,
            'proofSourceReviewId=' + str(PROOF_SOURCE_REVIEW_ID), FAILURE_REFERENCE_POLICY]
        self.gate['productionBaselineSourceReview'] = {'id': 8000000000,
            'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-8000000000',
            'created_at': '2026-10-11T19:58:00Z', 'body': '\n'.join(production_tokens)}

    def verify(self):
        verify_gate(self.manifest, self.gate, self.manifest_sha, self.now)

    def test_complete_synthetic_gate(self):
        self.verify()

    def test_actual_package_export_includes_every_proof_source_file(self):
        raw = getattr(packaging_exporter, '__raw_source__', None)
        if raw is None: raw = pathlib.Path(packaging_exporter.__file__).read_bytes()
        tree = ast.parse(raw)
        exported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'paths' for t in node.targets):
                exported.update(ast.literal_eval(node.value.generators[0].iter))
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Subscript) and isinstance(target.value, ast.Name) and target.value.id == 'paths':
                        exported.add(ast.literal_eval(target.slice))
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and \
                    isinstance(node.func.value, ast.Name) and node.func.value.id == 'paths' and node.func.attr == 'update':
                exported.update(ast.literal_eval(node.args[0].generators[0].iter))
        from known_core_disk_guard_proof import SOURCE_FILES
        self.assertTrue(SOURCE_FILES <= exported, sorted(SOURCE_FILES - exported))

    def test_stale_and_future_gates(self):
        for time in ['2026-10-11T19:49:59Z', '2026-10-11T20:00:01Z']:
            with self.subTest(time=time):
                self.gate['verifiedUtc'] = time
                with self.assertRaises(RuntimeError): self.verify()

    def test_later_audit_failure(self):
        for field in ['laterKitAuditFailure', 'pr']:
            original = copy.deepcopy(self.gate)
            if field == 'pr': self.gate['pr']['laterAuditFailure'] = True
            else: self.gate[field] = True
            with self.assertRaises(RuntimeError): self.verify()
            self.gate = original

    def test_main_change_or_incomplete_ci(self):
        for key, value in [('head_sha', '7' * 40), ('status', 'in_progress'), ('conclusion', 'failure')]:
            original = self.gate['mainCi'].copy(); self.gate['mainCi'][key] = value
            with self.assertRaises(RuntimeError): self.verify()
            self.gate['mainCi'] = original

    def test_historical_pr292_cannot_replace291(self):
        self.gate['pr']['number'] = 292
        with self.assertRaises(RuntimeError): self.verify()

    def test_branch_tree_and_ordered_merge_parents_cannot_be_replaced(self):
        original = copy.deepcopy(self.gate['pr'])
        for key, value in [('auditedTree', MERGED_TREE), ('mergeParents', list(reversed(MERGE_PARENTS)))]:
            self.gate['pr'][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): self.verify()
            self.gate['pr'] = copy.deepcopy(original)

    def test_original_cursor_policy_and_live_baseline_cannot_change(self):
        for key, value in [('baseHead', 'ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf'),
                ('naturalIntakePolicy', 'REWIND_67'), ('head', BASE_HEAD)]:
            original = copy.deepcopy(self.manifest)
            self.manifest[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): self.verify()
            self.manifest = original

    def test_tree_equality_required(self):
        self.gate['pr']['tree'] = '8' * 40
        with self.assertRaises(RuntimeError): self.verify()

    def test_workload_pins_and_yy_evidence_required(self):
        self.gate['workloadControl'] = {}
        with self.assertRaises(RuntimeError): self.verify()
        self.gate['workloadControl'] = WORKLOAD_PINS
        self.gate['yyGo']['evidenceSha256'] = '9' * 64
        with self.assertRaises(RuntimeError): self.verify()

    def test_historical_kit_reviews_are_rejected(self):
        for identity in [6102481848, 6109804174, 6110472696, 6112725472, PROOF_SOURCE_REVIEW_ID]:
            self.gate['kitReview']['id'] = identity
            self.gate['kitReview']['html_url'] = 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(identity)
            with self.assertRaises(RuntimeError): self.verify()

    def test_all_exact_kit_tokens_required(self):
        body = self.gate['kitReview']['body']
        for token in review_tokens(self.manifest, self.manifest_sha):
            self.gate['kitReview']['body'] = body.replace(token, '')
            with self.subTest(token=token), self.assertRaises(RuntimeError): self.verify()

    def test_gate_cannot_move_to_another_root(self):
        self.gate['executionRoot'] = '/opt/lims/releases/runtime-kobo-release-other'
        with self.assertRaises(RuntimeError): self.verify()

    def test_safe_remote_roots_refuse_shell_and_traversal(self):
        safe_root('/opt/lims/releases/runtime-kobo-build-fixture', 'runtime-kobo-build-')
        for value in ['/opt/lims/releases/runtime-kobo-build-a;echo', '/tmp/runtime-kobo-build-a',
                      '/opt/lims/releases/runtime-kobo-build-a/../b', '/opt/lims/releases/runtime-kobo-build-$(x)']:
            with self.subTest(value=value), self.assertRaises(RuntimeError): safe_root(value, 'runtime-kobo-build-')

    def test_failed_proof_cannot_feed_kit(self):
        with self.assertRaises(RuntimeError):
            validate_proof({'status': 'FAILED_NEW_CANDIDATE_NATURAL_KOBO_PROOF'}, {})

    def test_layout_authority_cannot_be_downgraded_or_replaced(self):
        for key, value in [('proofBaselineLayoutGuardSha256', BASELINE_GUARD_SHA),
                           ('proofBaselineLayoutPolicy', 'EMPTY_FILES_ONLY')]:
            for location in ['manifest', 'gate']:
                original = copy.deepcopy((self.manifest, self.gate))
                (self.manifest if location == 'manifest' else self.gate)[key] = value
                with self.subTest(key=key, location=location), self.assertRaises(RuntimeError): self.verify()
                self.manifest, self.gate = original
        original = self.manifest['files']['known_core_disk_guard_proof.py']
        self.manifest['files']['known_core_disk_guard_proof.py'] = BASELINE_GUARD_SHA
        with self.assertRaises(RuntimeError): self.verify()
        self.manifest['files']['known_core_disk_guard_proof.py'] = original

    def test_historical_layout_source_passes_cannot_replace_actual_review(self):
        for identity in [6114935703, 6115039634]:
            original = copy.deepcopy((self.manifest, self.gate))
            self.manifest['sourceReviewId'] = identity
            self.gate['proofSourceReview']['id'] = identity
            self.gate['proofSourceReview']['html_url'] = 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(identity)
            with self.subTest(identity=identity), self.assertRaises(RuntimeError): self.verify()
            self.manifest, self.gate = original

    def test_old_source_review_cannot_authorize_new_measurement(self):
        for location in ['manifest', 'gate']:
            original = copy.deepcopy((self.manifest, self.gate))
            if location == 'manifest': self.manifest['sourceReviewId'] = 6112725472
            else: self.gate['proofSourceReview']['id'] = 6112725472
            with self.subTest(location=location), self.assertRaises(RuntimeError): self.verify()
            self.manifest, self.gate = original

    def test_measurement_timing_and_actual_guard_cannot_change(self):
        for location, key, value in [('manifest', 'coreDeallocationConfirmationDeadlineSeconds', 11),
                                     ('gate', 'coreDeallocationConfirmationDeadlineSeconds', 11),
                                     ('manifest', 'diskMeasurementGuardSha256', ORIGINAL_GUARD_SHA),
                                     ('gate', 'diskMeasurementGuardSha256', ORIGINAL_GUARD_SHA),
                                     ('manifest', 'proofToolingCommit', 'a' * 40)]:
            original = copy.deepcopy((self.manifest, self.gate))
            (self.manifest if location == 'manifest' else self.gate)[key] = value
            with self.subTest(location=location, key=key), self.assertRaises(RuntimeError): self.verify()
            self.manifest, self.gate = original

    def test_source_authority_and_index_hashes_cannot_be_swapped(self):
        for key in ['proofAuthoritySha256', 'proofSourceIndexSha256']:
            value = self.gate[key]; self.gate[key] = 'a' * 64
            with self.subTest(key=key), self.assertRaises(RuntimeError): self.verify()
            self.gate[key] = value

    def test_later_source_failure_refuses_execution(self):
        self.gate['laterSourceAuditFailure'] = True
        with self.assertRaises(RuntimeError): self.verify()

    def test_incomplete_source_review_refuses_execution(self):
        review = self.gate['proofSourceReview']; body = review['body']
        for token in body.splitlines():
            review['body'] = body.replace(token, '')
            with self.subTest(token=token), self.assertRaises(RuntimeError): self.verify()
        review['body'] = body

    def test_receipt_source_binding_rejects_stale_or_tampered_proof(self):
        proof = {'toolingCommit': REVIEWED_PROOF_SOURCE, 'proofSourceReviewId': PROOF_SOURCE_REVIEW_ID,
            'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
            'baselineMeasurementGuardSha256': BASELINE_GUARD_SHA,
            'proofBaselineLayoutGuardSha256': PROOF_BASELINE_LAYOUT_SHA,
            'proofBaselineLayoutPolicy': PROOF_BASELINE_LAYOUT_POLICY,
            'copyVerifierSha256': REVIEWED_VERIFIER_SHA, 'proofContractSha256': REVIEWED_PROOF_CONTRACT_SHA,
            'refusalScopeCommentId': REFUSAL_SCOPE_COMMENT_ID,
            'schedulerRefusalPolicy': REFUSAL_POLICY, 'intakeCardinalityPolicy': CARDINALITY_POLICY,
            'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
            'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
            'baselineVanishedProcessPolicy': BASELINE_POLICY, 'BASELINE_ATTEMPTS_MAX': BASELINE_ATTEMPTS_MAX,
            'BASELINE_CONFIRMATION_DEADLINE_SECONDS': BASELINE_CONFIRMATION_SECONDS, 'baselineAttempt': 2,
            'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
            'authoritySha256': 'a' * 64}
        pin = {'proofSourceReviewId': PROOF_SOURCE_REVIEW_ID}
        proof_source_binding(proof, pin)
        for key, value in [('toolingCommit', 'b' * 40), ('proofSourceReviewId', 6112725472),
                           ('proofBaselineLayoutGuardSha256', BASELINE_GUARD_SHA),
                           ('proofBaselineLayoutPolicy', 'EMPTY_FILES_ONLY'),
                           ('diskMeasurementGuardSha256', ORIGINAL_GUARD_SHA),
                           ('baselineMeasurementGuardSha256', ORIGINAL_GUARD_SHA), ('copyVerifierSha256', 'c' * 64),
                           ('proofContractSha256', 'd' * 64), ('refusalScopeCommentId', 1),
                           ('schedulerRefusalPolicy', 'ANY_ERROR'), ('intakeCardinalityPolicy', 'DISTINCT_IDS'),
                 ('refusalPairingScopeCommentId', 1), ('schedulerRefusalPairing', 'SORTED'), ('REFUSAL_PAIR_WINDOW_SECONDS', 2),
                           ('baselineVanishedProcessPolicy', 'ANY_ERROR'), ('BASELINE_ATTEMPTS_MAX', 4),
                           ('BASELINE_CONFIRMATION_DEADLINE_SECONDS', 11), ('baselineAttempt', 0),
                           ('coreDeallocationConfirmationDeadlineSeconds', 11), ('authoritySha256', 'invalid')]:
            changed = dict(proof); changed[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): proof_source_binding(changed, pin)

    def test_manifest_and_gate_baseline_refusal_and_cardinality_bindings(self):
        for key, value in [('baselineMeasurementGuardSha256', ORIGINAL_GUARD_SHA),
                ('copyVerifierSha256', 'c' * 64), ('proofContractSha256', 'd' * 64),
                ('refusalScopeCommentId', 1), ('schedulerRefusalPolicy', 'ANY_ERROR'),
                ('intakeCardinalityPolicy', 'DISTINCT_IDS'),
                 ('refusalPairingScopeCommentId', 1), ('schedulerRefusalPairing', 'SORTED'), ('REFUSAL_PAIR_WINDOW_SECONDS', 2), ('baselineVanishedProcessPolicy', 'ANY_ERROR'),
                ('BASELINE_ATTEMPTS_MAX', 4), ('BASELINE_CONFIRMATION_DEADLINE_SECONDS', 11)]:
            for location in ['manifest', 'gate']:
                original = copy.deepcopy((self.manifest, self.gate))
                (self.manifest if location == 'manifest' else self.gate)[key] = value
                with self.subTest(key=key, location=location), self.assertRaises(RuntimeError): self.verify()
                self.manifest, self.gate = original

    def test_production_adapter_source_review_is_separate_and_complete(self):
        original = copy.deepcopy(self.gate)
        self.gate['productionBaselineSourceReview'] = self.gate['proofSourceReview']
        with self.assertRaises(RuntimeError): self.verify()
        self.gate = copy.deepcopy(original)
        self.gate['laterProductionSourceAuditFailure'] = True
        with self.assertRaises(RuntimeError): self.verify()
        self.gate = copy.deepcopy(original)
        review = self.gate['productionBaselineSourceReview']; body = review['body']
        for token in set(body.splitlines()):
            review['body'] = body.replace(token, '')
            with self.subTest(token=token), self.assertRaises(RuntimeError): self.verify()
        review['body'] = body

    def test_production_adapter_hash_review_raw_hash_and_scope_required(self):
        for key in ['productionBaselineAdapterSha256', 'productionBaselineSourceReviewSha256',
                    'productionBaselineScopeCommentId']:
            original = self.gate[key]; self.gate[key] = 'invalid'
            with self.subTest(key=key), self.assertRaises(RuntimeError): self.verify()
            self.gate[key] = original


class OriginalCursorIntakeTests(unittest.TestCase):
    def setUp(self):
        self.config = {'id': TARGET_CONFIG, 'labId': TARGET_LAB, 'projectCode': TARGET_PROJECT,
            'lastSubmissionId': '41622'}
        self.record = {'configId': TARGET_CONFIG, 'labId': TARGET_LAB, 'projectCode': TARGET_PROJECT,
            'since': '41622', 'submissionIds': []}
        self.proof = {'naturalIntakePolicy': NATURAL_INTAKE_POLICY, 'initialTargetSubmissionCount': 0}

    def check(self): original_cursor_intake(self.proof, self.record, self.config)

    def test_empty_and_nonempty_actual_pending_sets_pass_without_rewind(self):
        self.check()
        self.record['submissionIds'] = ['41623', '41624']; self.proof['initialTargetSubmissionCount'] = 2
        self.check()

    def test_cursor_config_policy_or_reported_count_changes_refuse(self):
        for location, key, value in [('record', 'since', '0'), ('config', 'lastSubmissionId', '0'),
                ('record', 'configId', 'other'), ('record', 'labId', 'other'),
                ('record', 'projectCode', 'other'), ('proof', 'naturalIntakePolicy', 'REWIND_67'),
                ('proof', 'initialTargetSubmissionCount', 67), ('proof', 'initialTargetSubmissionCount', False)]:
            row = getattr(self, location); original = row[key]; row[key] = value
            with self.subTest(location=location, key=key), self.assertRaises(RuntimeError): self.check()
            row[key] = original

    def test_duplicate_old_invalid_or_unsorted_ids_refuse(self):
        for ids in [['41622'], ['41621'], ['41623', '41623'], ['bad'], [41623], ['41624', '41623']]:
            self.record['submissionIds'] = ids; self.proof['initialTargetSubmissionCount'] = len(ids)
            with self.subTest(ids=ids), self.assertRaises(RuntimeError): self.check()


class SealedSchedulerTests(unittest.TestCase):
    def setUp(self):
        self.expected = [{'configId': key, 'labId': lab, 'projectCode': project, 'message': message}
            for key, lab, project, message in REFUSAL_TUPLES]
        lines = []
        for index, row in enumerate(self.expected):
            prefix = '2026-10-11T21:00:%02dZ ' % index
            lines += [prefix + '[KOBO_SCHEDULER] Triggering scheduled sync for Lab: ' + row['labId'] +
                ', Project: ' + row['projectCode'], prefix + '[KOBO_SCHEDULER] Error syncing lab ' +
                row['labId'] + ': ' + row['message']]
        lines += ['2026-10-11T21:00:10Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: { newSamples: 2, skipped: 1 }',
            '2026-10-11T21:15:10Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: { newSamples: 0, skipped: 0 }']
        self.stdout = '\n'.join(line for line in lines if 'Error syncing' not in line)
        self.stderr = '\n'.join(line for line in lines if 'Error syncing' in line)
        protected = sorted(row['configId'] for row in self.expected)
        self.first = {'protectedRefusalConfigIds': protected, 'newSampleCount': {TARGET_CONFIG: 2},
            'newSamplePairs': {TARGET_CONFIG: [{'kobo_id': '7', 'depth': 'D1'}, {'kobo_id': '7', 'depth': 'D2'}]},
            'newSubmissionIds': {TARGET_CONFIG: ['7']}, 'newSampleDepthSplit': {TARGET_CONFIG: {'D1': 1, 'D2': 1}}}
        self.second = {'protectedRefusalConfigIds': protected, 'newSampleCount': {TARGET_CONFIG: 0},
            'newSamplePairs': {TARGET_CONFIG: []}, 'newSubmissionIds': {}, 'newSampleDepthSplit': {TARGET_CONFIG: {}}}
        self.full = copy.deepcopy(self.first)
        completions = completed_syncs(self.stdout); observed = scheduler_refusals(self.stdout, self.stderr, self.expected)
        self.proof = {'expectedSchedulerRefusals': self.expected, 'observedSchedulerRefusals': observed,
            'schedulerRefusalCounts': {row['configId']: 1 for row in self.expected},
            'schedulerRefusalLabCounts': {'MOZ-LAB1': 1, 'TUR': 3},
            'schedulerRefusalConfigCountsDerivedFromTriggers': True,
            'refusalPairingScopeCommentId': REFUSAL_PAIRING_SCOPE_COMMENT_ID,
            'schedulerRefusalPairing': REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS': REFUSAL_PAIR_WINDOW_SECONDS,
            'firstScheduledSync': completions[0], 'secondScheduledSync': completions[1],
            'firstIntakeSummary': intake_summary(self.first, completions[0]),
            'secondIntakeSummary': intake_summary(self.second, completions[1]),
            'secondGenuinelyNewSubmissionIds': []}

    def check(self): sealed_scheduler_evidence(self.proof, self.expected, self.stdout, self.stderr, self.first, self.second, self.full)

    def test_original_sealed_log_refusals_and_two_depth_sample_rows_pass(self): self.check()

    def test_changed_baseline_or_observed_refusal_counts_refuse(self):
        original = copy.deepcopy(self.proof)
        for key, value in [('expectedSchedulerRefusals', []), ('observedSchedulerRefusals', []),
                ('schedulerRefusalCounts', {}), ('schedulerRefusalLabCounts', {}),
                ('schedulerRefusalConfigCountsDerivedFromTriggers', False)]:
            self.proof[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): self.check()
            self.proof = copy.deepcopy(original)

    def test_missing_completion_unknown_error_or_weakened_protection_refuse(self):
        log = self.stdout
        for changed in [log.splitlines()[0], log + '\n2026-10-11T21:16:00Z [KOBO_SCHEDULER] Error syncing lab TUR: other']:
            self.stdout = changed
            with self.assertRaises(RuntimeError): self.check()
        self.stdout = log
        for state in [self.first, self.second, self.full]:
            protected = state['protectedRefusalConfigIds']; state['protectedRefusalConfigIds'] = []
            with self.assertRaises(RuntimeError): self.check()
            state['protectedRefusalConfigIds'] = protected

    def test_sample_count_cannot_be_replaced_by_distinct_ids_or_changed_second_ids(self):
        self.proof['firstIntakeSummary']['newSampleCount'] = 1
        with self.assertRaises(RuntimeError): self.check()
        self.proof['firstIntakeSummary']['newSampleCount'] = 2
        self.proof['secondGenuinelyNewSubmissionIds'] = ['unrecorded']
        with self.assertRaises(RuntimeError): self.check()


class FailureVerdictReferenceTests(unittest.TestCase):
    def test_actual_pass_remaining_gate_wording_is_not_a_failure(self):
        body = PHRASE + '\n\nRemaining gates:\n- the PR #291 formal review, with no later "Audit failed";'
        self.assertFalse(has_failed_verdict(body, include_source=True))

    def test_narrow_reference_needs_explicit_pass_header(self):
        for header in ['Progress update', 'Audit failed', 'Source review: FAILED', '']:
            with self.subTest(header=header):
                self.assertTrue(has_failed_verdict(header + '\nno later "Audit failed"', include_source=True))

    def test_real_failure_alongside_negated_reference_still_refuses(self):
        for failure in ['Audit failed: changed manifest', '**AUDIT FAILED**', 'Source review: FAILED: changed source']:
            with self.subTest(failure=failure):
                self.assertTrue(has_failed_verdict(PHRASE + '\nno later "Audit failed"\n' + failure,
                    include_source=True))

    def test_only_exact_negated_paired_quote_is_exempt(self):
        for reference in ['no later Audit failed', 'no "Audit failed"', 'later "Audit failed"',
                'no later "Audit failed: hash changed"', 'no later "Audit failed\'', '"Audit failed"']:
            with self.subTest(reference=reference):
                self.assertTrue(has_failed_verdict(PHRASE + '\n' + reference, include_source=True))
        for quote in ['"Audit failed"', "'Audit failed'", '“Audit failed”', '‘Audit failed’']:
            with self.subTest(quote=quote):
                self.assertFalse(has_failed_verdict(PHRASE + '\nno later ' + quote, include_source=True))

    def test_source_failure_scope_and_markdown_pass_header(self):
        self.assertFalse(has_failed_verdict('**' + PHRASE + '**\nno later "Audit failed"', include_source=True))
        self.assertTrue(has_failed_verdict('Source review: PASS\nSource review: FAILED', include_source=True))
        self.assertFalse(has_failed_verdict('Source review: PASS\nSource review: FAILED', include_source=False))


if __name__ == '__main__':
    unittest.main()
