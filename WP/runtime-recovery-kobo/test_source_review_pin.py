"""Exact corrected source-review bindings; no GitHub or host access."""
import datetime
import unittest
from proof_contract import source_review_pass


class SourceReviewPin(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 10, 11, 20, 0, tzinfo=datetime.timezone.utc)
        self.tokens = ['Source review: PASS', '1' * 40, '2' * 64, '3' * 64,
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


if __name__ == '__main__':
    unittest.main()
