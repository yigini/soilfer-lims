"""Synthetic guards for the exact #162/6113601584 refusal and count pins."""
import copy
import unittest
from proof_contract import *


class RefusalScopeTests(unittest.TestCase):
    def setUp(self):
        self.configs = [{'id': key, 'labId': lab, 'projectCode': project, 'isActive': 1}
            for key, lab, project, _ in REFUSAL_TUPLES]
        self.labs = [{'id': 'MOZ-LAB1', 'code': 'MOZ', 'name': 'Mozambique', 'isActive': 1},
            {'id': 'TUR', 'code': 'TURSAP', 'name': 'TURSAP LAB', 'isActive': 0}]
        self.projects = [{'code': 'SOILFER-JPN'}]

    def bound(self):
        return expected_refusals(self.configs, self.labs, self.projects)

    def log(self):
        return '\n'.join('2026-10-11T20:40:%02dZ %s' % (index, text)
            for index, row in enumerate(self.bound())
            for text in ['[KOBO_SCHEDULER] Triggering scheduled sync for Lab: ' + row['labId'] +
                ', Project: ' + row['projectCode'],
                '[KOBO_SCHEDULER] Error syncing lab ' + row['labId'] + ': ' + row['message']])

    def test_exact_refusals_bound_to_fresh_rows_and_triggers(self):
        result = scheduler_refusals(self.log(), self.bound())
        self.assertEqual([row['configId'] for row in result], [row[0] for row in REFUSAL_TUPLES])
        self.assertTrue(all(row['text'].endswith(row['message']) for row in result))

    def test_whole_allowance_empty_on_changed_precondition(self):
        for slot, field, value in [(0, 'labId', 'OTHER'), (0, 'projectCode', 'OTHER'),
                (0, 'isActive', 0), (1, 'id', 'unreviewed')]:
            configs = copy.deepcopy(self.configs); configs[slot][field] = value
            self.assertEqual(expected_refusals(configs, self.labs, self.projects), [])
        self.assertEqual(expected_refusals(self.configs, self.labs, self.projects + [{'code': 'MOZL'}]), [])
        for field, value in [('isActive', 1), ('name', 'Other'), ('code', 'TUR')]:
            labs = copy.deepcopy(self.labs)
            if field == 'code':
                labs.append({'id': 'duplicate', 'code': value, 'name': 'Other', 'isActive': 0})
            else:
                labs[1][field] = value
            self.assertEqual(expected_refusals(self.configs, labs, self.projects), [])

    def test_duplicate_mapping_or_extra_tur_config_refuses_allowance(self):
        for extra in [{**self.configs[0], 'id': 'duplicate'},
                {**self.configs[1], 'id': 'extra', 'projectCode': 'OTHER'}]:
            self.assertEqual(expected_refusals(self.configs + [extra], self.labs, self.projects), [])

    def test_unknown_lab_message_and_extra_text_refuse(self):
        log = self.log()
        for changed in [log.replace('does not exist', 'is unavailable'),
                log.replace('Error syncing lab TUR:', 'Error syncing lab OTHER:'),
                log + '\n2026-10-11T20:41:00Z [KOBO_SCHEDULER] Error syncing lab TUR: unrelated error',
                log.replace('Intake disallowed.', 'Intake disallowed. extra')]:
            with self.assertRaises(RuntimeError):
                scheduler_refusals(changed, self.bound())

    def test_missing_trigger_extra_refusal_and_empty_allowance_refuse(self):
        errors = '\n'.join(line for line in self.log().splitlines() if 'Error syncing' in line)
        for log, bound in [(errors, self.bound()), (self.log(), []),
                (self.log() + '\n' + errors, self.bound())]:
            with self.assertRaises(RuntimeError):
                scheduler_refusals(log, bound)

    def test_fatal_general_and_untimestamped_errors_refuse(self):
        for text in ['FATAL ERROR: heap exhausted', '[KOBO_SCHEDULER] General scheduler error: failure',
                '[KOBO_SCHEDULER] Error syncing lab TUR: failure']:
            with self.assertRaises(RuntimeError):
                scheduler_refusals(self.log() + '\n' + text, self.bound())

    def test_repeat_ticks_record_exact_counts_and_timestamps(self):
        log = self.log() + '\n' + self.log().replace('20:40:', '20:41:')
        result = scheduler_refusals(log, self.bound())
        self.assertEqual(len(result), 8)
        self.assertEqual(len({(row['configId'], row['utc']) for row in result}), 8)

    def test_sample_rows_are_distinct_from_submission_count(self):
        state = {'newSampleCount': {TARGET_CONFIG: 2},
            'newSamplePairs': {TARGET_CONFIG: [{'kobo_id': '7', 'depth': 'D1'}, {'kobo_id': '7', 'depth': 'D2'}]},
            'newSubmissionIds': {TARGET_CONFIG: ['7']}, 'newSampleDepthSplit': {TARGET_CONFIG: {'D1': 1, 'D2': 1}}}
        result = intake_summary(state, {'newSamples': 2, 'skipped': 1})
        self.assertEqual(result['newSampleCount'], 2)
        self.assertEqual(result['distinctSubmissionCount'], 1)
        for count in [0, 1, 3]:
            with self.assertRaises(RuntimeError):
                intake_summary(state, {'newSamples': count, 'skipped': 1})

    def test_natural_second_sync_zero_samples_has_zero_count(self):
        state = {'newSampleCount': {TARGET_CONFIG: 0}, 'newSamplePairs': {TARGET_CONFIG: []},
            'newSubmissionIds': {}, 'newSampleDepthSplit': {TARGET_CONFIG: {}}}
        self.assertEqual(intake_summary(state, {'newSamples': 0, 'skipped': 0})['newSampleCount'], 0)


if __name__ == '__main__':
    unittest.main()
