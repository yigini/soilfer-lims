import copy
import unittest
from proof_contract import *


class ProofContractTests(unittest.TestCase):
    def setUp(self):
        self.pin = {'head': CANDIDATE_HEAD, 'baseHead': BASE_HEAD, 'auditedPrHead': AUDITED_PR_HEAD,
            'pr': PR_NUMBER, 'auditReviewId': 123, 'mainCiRunId': 456, 'image': 'sha256:' + 'b' * 64,
            'imageBytes': 400, 'tree': MERGED_TREE, 'auditedTree': AUDITED_PR_TREE, 'mergeParents': MERGE_PARENTS,
            'labAndHubBuildsOwnedByYY': True, 'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
        self.built = {'status': 'BUILT_ONLY_NOT_DEPLOYED', 'head': self.pin['head'],
            'image': self.pin['image'], 'imageBytes': 400, 'tree': MERGED_TREE, 'productionDatabaseMounts': 0}
        self.image = {'Id': self.pin['image'], 'Size': 400,
            'Config': {'Labels': {'org.opencontainers.image.revision': self.pin['head']}}}

    def test_candidate_bound_to_reviewed_tree_and_image(self):
        validate_candidate(self.pin, self.built, self.image)
        for key, value in [('head', BASE_HEAD), ('auditedPrHead', 'd' * 40), ('tree', 'e' * 40),
            ('image', 'sha256:' + 'f' * 64), ('imageBytes', 401), ('labAndHubBuildsOwnedByYY', False),
            ('releaseWindowControl', 'other'), ('auditReviewId', None), ('mainCiRunId', None)]:
            altered = {**self.pin, key: value}
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                validate_candidate(altered, self.built, self.image)

    def test_failed_build_and_wrong_revision_refuse(self):
        with self.assertRaises(RuntimeError):
            validate_candidate(self.pin, {**self.built, 'status': 'FAILED'}, self.image)
        image = copy.deepcopy(self.image)
        image['Config']['Labels']['org.opencontainers.image.revision'] = BASE_HEAD
        with self.assertRaises(RuntimeError):
            validate_candidate(self.pin, self.built, image)

    def test_audited_branch_and_merged_union_are_separately_bound(self):
        merged = {'sha': CANDIDATE_HEAD, 'tree': {'sha': MERGED_TREE},
            'parents': [{'sha': value} for value in MERGE_PARENTS]}
        audited = {'sha': AUDITED_PR_HEAD, 'tree': {'sha': AUDITED_PR_TREE}}
        validate_merge_identity(merged, audited)
        for key, value in [('sha', BASE_HEAD), ('tree', {'sha': 'e' * 40}),
                ('parents', [{'sha': AUDITED_PR_HEAD}, {'sha': BASE_HEAD}])]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                validate_merge_identity({**merged, key: value}, audited)
        with self.assertRaises(RuntimeError):
            validate_merge_identity(merged, {**audited, 'tree': {'sha': 'e' * 40}})

    def test_historical_release_or_wrong_parent_cannot_feed_this_candidate(self):
        for key, value in [('pr', 292), ('auditedTree', 'e' * 40),
                ('mergeParents', [BASE_HEAD]), ('head', '171dd36c5b2dbeea8763520dd18fbdb158ffca05')]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                validate_candidate({**self.pin, key: value}, self.built, self.image)

    def test_natural_empty_first_and_second_keep_original_interval(self):
        rows = completed_syncs('2026-10-12T00:00:00Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: { newSamples: 0, skipped: 0 }\n'
            '2026-10-12T00:15:00Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: { newSamples: 0, skipped: 0 }')
        require_final_observation(rows[0], rows[1], '2026-10-11T23:59:00Z',
            '2026-10-12T00:17:00Z', 15, 0, 200000000, 1080)
        with self.assertRaises(RuntimeError):
            require_final_observation(rows[0], rows[1], '2026-10-11T23:59:00Z',
                '2026-10-12T00:16:59Z', 15, 0, 200000000, 1080)

    def test_parse_real_multiline_completion_without_eval(self):
        log = ('2026-10-11T19:00:00.123456789Z [KOBO] Sync complete for ZMB-LAB1: 2 new, 65 skipped\n'
            '2026-10-11T19:00:00.124000000Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: {\n'
            '2026-10-11T19:00:00.124000000Z   newSamples: 2,\n'
            '2026-10-11T19:00:00.124000000Z   skipped: 65,\n'
            '2026-10-11T19:00:00.124000000Z   message: "this is not executable",\n'
            '2026-10-11T19:00:00.124000000Z }\n')
        rows = completed_syncs(log)
        self.assertEqual([(r['newSamples'], r['skipped']) for r in rows], [(2, 65)])
        self.assertEqual(completed_syncs(log, 'OTHER-LAB'), [])

    def test_incomplete_result_is_not_success(self):
        with self.assertRaises(RuntimeError):
            completed_syncs('2026-10-11T19:00:00Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: {\n')

    def test_natural_empty_second_sync_is_observed(self):
        log = ('2026-10-11T19:15:10Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: {\n'
            '2026-10-11T19:15:10Z   newSamples: 0,\n'
            '2026-10-11T19:15:10Z   skipped: 0,\n'
            '2026-10-11T19:15:10Z   message: \'No new submissions\'\n'
            '2026-10-11T19:15:10Z }\n')
        self.assertEqual(completed_syncs(log)[0]['newSamples'], 0)

    def test_interval_and_healthy_soak_both_apply(self):
        first = {'utc': '2026-10-11T19:00:00Z', 'epochSeconds': utc_seconds('2026-10-11T19:00:00Z')}
        second = {'utc': '2026-10-11T19:15:10Z', 'epochSeconds': utc_seconds('2026-10-11T19:15:10Z')}
        args = [first, second, '2026-10-11T19:00:30Z', '2026-10-11T19:17:00Z', 15, 0, 500000000, 990]
        require_final_observation(*args)
        for slot, value in [(3, '2026-10-11T19:16:59Z'), (5, 1), (6, LIMIT + 1), (7, 659)]:
            altered = list(args); altered[slot] = value
            with self.subTest(slot=slot), self.assertRaises(RuntimeError):
                require_final_observation(*altered)
        with self.assertRaises(RuntimeError):
            require_final_observation(first, {**second, 'epochSeconds': first['epochSeconds'] + 899}, *args[2:])
        with self.assertRaises(RuntimeError):
            observation_end(first['utc'], args[2], 61)


if __name__ == '__main__':
    unittest.main()
