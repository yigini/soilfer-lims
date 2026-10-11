"""Synthetic gate tampering fixtures; never contact GitHub, Docker or a host."""
import copy
import datetime
import unittest
from runtime_release_contract import *


class RuntimeGateTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 10, 11, 20, 0, tzinfo=datetime.timezone.utc)
        self.manifest = {'status': KIT_STATUS, 'root': '/opt/lims/releases/runtime-kobo-release-fixture',
            'head': '1' * 40, 'image': 'sha256:' + '2' * 64, 'tree': '3' * 40,
            'baseHead': BASE_HEAD, 'workloadControl': WORKLOAD_PINS, 'sourceReviewId': PROOF_SOURCE_REVIEW_ID,
            'proofToolingCommit': REVIEWED_PROOF_SOURCE, 'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
            'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
            'separateInstallerCommands': 0, 'files': {name: str(i) * 64 for i, name in enumerate([
                'deploy_runtime.py', 'rehearsal-receipt.json', 'startup_common.py', 'yy-authorization-evidence.md',
                'target-pin.json', 'proof-authority.json', 'proof-source-index.json',
                'known_core_disk_guard.py', 'known_core_disk_guard_v2.py'], 1)}}
        self.manifest['files']['known_core_disk_guard.py'] = ORIGINAL_GUARD_SHA
        self.manifest['files']['known_core_disk_guard_v2.py'] = MEASUREMENT_GUARD_SHA
        self.manifest_sha = '6' * 64
        review = {'id': 7000000000, 'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-7000000000',
            'body': '\n'.join(review_tokens(self.manifest, self.manifest_sha)), 'created_at': '2026-10-11T19:59:00Z'}
        self.gate = {'status': 'FRESH_SINGLE_USE_RUNTIME_GATE', 'executionRoot': self.manifest['root'],
            'head': self.manifest['head'], 'currentMainHead': self.manifest['head'], 'image': self.manifest['image'],
            'manifestSha256': self.manifest_sha, 'workloadControl': WORKLOAD_PINS, 'verifiedUtc': '2026-10-11T19:59:59Z',
            'coordinatorSha256': '1' * 64, 'rehearsalReceiptSha256': '2' * 64, 'targetPinSha256': '5' * 64,
            'yyEvidenceSha256': '4' * 64, 'pr': {'number': 292, 'merged': True, 'head': AUDITED_PR_HEAD,
                'mergeCommit': self.manifest['head'], 'tree': self.manifest['tree'], 'auditedTree': self.manifest['tree'],
                'laterAuditFailure': False, 'review': {'html_url': 'https://github.com/yigini/soilfer-lims/pull/292#issuecomment-1',
                    'body': PHRASE + '\n' + AUDITED_PR_HEAD},
                'checks': [{'head_sha': AUDITED_PR_HEAD, 'status': 'completed', 'conclusion': 'success'}]},
            'mainCi': {'head_sha': self.manifest['head'], 'name': 'CI', 'event': 'push', 'status': 'completed', 'conclusion': 'success'},
            'kitReview': review, 'laterKitAuditFailure': False, 'yyGo': {'authorizationMode': 'AUTO_AFTER_REVIEW',
                'evidenceSha256': '4' * 64, 'standingScopeText': 'my go covers all', 'releaseHead': self.manifest['head']}}
        self.gate.update({'proofAuthoritySha256': '6' * 64, 'proofSourceIndexSha256': '7' * 64,
            'diskMeasurementGuardSha256': MEASUREMENT_GUARD_SHA,
            'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
            'laterSourceAuditFailure': False, 'proofSourceReview': {'id': PROOF_SOURCE_REVIEW_ID,
                'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(PROOF_SOURCE_REVIEW_ID),
                'created_at': '2026-10-11T19:58:00Z', 'body': '\n'.join(['Source review: PASS',
                    REVIEWED_PROOF_SOURCE, REVIEWED_PROOF_SHA, MEASUREMENT_GUARD_SHA, ORIGINAL_GUARD_SHA,
                    'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
                    'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'])}})

    def verify(self):
        verify_gate(self.manifest, self.gate, self.manifest_sha, self.now)

    def test_complete_synthetic_gate(self):
        self.verify()

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

    def test_pr291_cannot_replace292(self):
        self.gate['pr']['number'] = 291
        with self.assertRaises(RuntimeError): self.verify()

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
            'coreDeallocationConfirmationDeadlineSeconds': CORE_CONFIRMATION_SECONDS,
            'authoritySha256': 'a' * 64}
        pin = {'proofSourceReviewId': PROOF_SOURCE_REVIEW_ID}
        proof_source_binding(proof, pin)
        for key, value in [('toolingCommit', 'b' * 40), ('proofSourceReviewId', 6112725472),
                           ('diskMeasurementGuardSha256', ORIGINAL_GUARD_SHA),
                           ('coreDeallocationConfirmationDeadlineSeconds', 11), ('authoritySha256', 'invalid')]:
            changed = dict(proof); changed[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): proof_source_binding(changed, pin)


if __name__ == '__main__':
    unittest.main()
