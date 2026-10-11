"""Exact corrected source-review bindings; no GitHub or host access."""
import datetime
import unittest
from proof_contract import source_review_pass, release_binding_tokens


class SourceReviewPin(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 10, 11, 20, 0, tzinfo=datetime.timezone.utc)
        self.tokens = release_binding_tokens() + ['Source review: PASS', '1' * 40, '2' * 64, '3' * 64,
            'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169',
            'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
            'labAndHubBuildsOwnedByYY=true', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']
        self.review = {'id': 7000000001,
            'html_url': 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-7000000001',
            'created_at': '2026-10-11T19:59:00Z', 'body': '\n'.join(self.tokens)}

    def verify(self):
        source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now)

    def test_complete_binding(self):
        self.verify()

    def test_every_exact_token_is_required(self):
        body = self.review['body']
        for token in self.tokens:
            self.review['body'] = body.replace(token, '')
            with self.subTest(token=token), self.assertRaises(RuntimeError):self.verify()

    def test_historical_source_pass_cannot_cover_new_guard(self):
        self.review['id'] = 6112725472
        self.review['html_url'] = 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6112725472'
        with self.assertRaises(RuntimeError):self.verify()

    def test_other_issue_is_not_source_authority(self):
        self.review['html_url'] = self.review['html_url'].replace('/162#', '/191#')
        with self.assertRaises(RuntimeError):self.verify()

    def test_future_review_cannot_cover_new_guard(self):
        self.review['created_at'] = '2026-10-11T20:00:01Z'
        with self.assertRaises(RuntimeError):self.verify()

    def test_corrected_verifier_and_contract_need_explicit_new_approval(self):
        extra = ['4' * 64, '5' * 64, 'refusalScopeCommentId=6113601584',
            'EXACT_FRESH_COPY_CONFIG_REFUSALS', 'SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS']
        body = self.review['body'] + '\n' + '\n'.join(extra)
        self.review['body'] = body
        source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now,
            verifier_sha='4' * 64, contract_sha='5' * 64)
        for token in extra:
            self.review['body'] = body.replace(token, '')
            with self.subTest(token=token), self.assertRaises(RuntimeError):
                source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now,
                    verifier_sha='4' * 64, contract_sha='5' * 64)

    def test_raw_launcher_and_builder_hashes_are_mandatory_when_bound(self):
        hashes = ['8' * 64, '9' * 64, 'a' * 64]
        body = self.review['body'] + '\n' + '\n'.join(hashes)
        self.review['body'] = body
        source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now, authority_hashes=hashes)
        for missing in hashes:
            self.review['body'] = body.replace(missing, '')
            with self.subTest(missing=missing), self.assertRaises(RuntimeError):
                source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now, authority_hashes=hashes)

    def test_half_corrected_binding_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'Both corrected helper bindings required'):
            source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now, verifier_sha='4' * 64)

    def test_v3_requires_all_new_baseline_and_existing_bindings(self):
        extra = ['4' * 64, '5' * 64, '6' * 64, 'refusalScopeCommentId=6113601584',
            'EXACT_FRESH_COPY_CONFIG_REFUSALS', 'SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS',
            'baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE',
            'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10']
        body = self.review['body'] + '\n' + '\n'.join(extra)
        self.review['body'] = body
        source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now,
            verifier_sha='4' * 64, contract_sha='5' * 64, baseline_guard_sha='6' * 64)
        for token in self.tokens + extra:
            self.review['body'] = body.replace(token, '')
            with self.subTest(token=token), self.assertRaises(RuntimeError):
                source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now,
                    verifier_sha='4' * 64, contract_sha='5' * 64, baseline_guard_sha='6' * 64)

    def test_stream_pairing_requires_new_scope_policy_and_window(self):
        extra = ['4' * 64, '5' * 64, '6' * 64, 'refusalScopeCommentId=6113601584',
            'EXACT_FRESH_COPY_CONFIG_REFUSALS', 'SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS',
            'baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE',
            'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10',
            'refusalPairingScopeCommentId=6114143349', 'schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE',
            'REFUSAL_PAIR_WINDOW_SECONDS=1']
        body = self.review['body'] + '\n' + '\n'.join(extra)
        for omitted in [None] + extra:
            self.review['body'] = body if omitted is None else body.replace(omitted, '')
            def verify():
                source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now,
                    verifier_sha='4' * 64, contract_sha='5' * 64, baseline_guard_sha='6' * 64, stream_pairing=True)
            if omitted is None: verify()
            else:
                with self.subTest(omitted=omitted), self.assertRaises(RuntimeError): verify()

    def test_v3_cannot_omit_other_corrected_helpers(self):
        with self.assertRaises(RuntimeError):
            source_review_pass(self.review, '1' * 40, '2' * 64, '3' * 64, self.now, baseline_guard_sha='6' * 64)


if __name__ == '__main__':
    unittest.main()
