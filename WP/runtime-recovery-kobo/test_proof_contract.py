import copy
import unittest
from proof_contract import *


class ProofContractTests(unittest.TestCase):
    def setUp(self):
        self.pin = {'head': 'a' * 40, 'baseHead': BASE_HEAD, 'auditedPrHead': AUDITED_PR_HEAD,
            'pr': 292, 'auditReviewId': 123, 'mainCiRunId': 456, 'image': 'sha256:' + 'b' * 64,
            'imageBytes': 400, 'tree': 'c' * 40, 'auditedTree': 'c' * 40,
            'labAndHubBuildsOwnedByYY': True, 'releaseWindowControl': 'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}
        self.built = {'status': 'BUILT_ONLY_NOT_DEPLOYED', 'head': self.pin['head'],
            'image': self.pin['image'], 'imageBytes': 400, 'productionDatabaseMounts': 0}
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
