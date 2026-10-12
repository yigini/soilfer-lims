"""Pure evidence refusal guards; no host operations or production DB."""
import copy
import json
import unittest

import import_startup_checks as checks


def import_value():
    return {'classification': 'COMPLETE_200', 'mode': 'NO_OP', 'totalChanges': 0,
        'sources': checks.SOURCES, 'counts': {'templates': 0, 'receipts': 0, 'draftLinks': 0}}


def ready_values():
    result = [{'event': prefix + '_STARTUP_READY', 'totalChanges': 0} for prefix in checks.LEGACY_READY_EVENTS]
    result.append(dict(import_value(), event='INSTRUMENT_IMPORT_STARTUP_READY'))
    return result


def entry_values():
    return [{'classification': 'RETAINED_' + str(number), 'mode': 'NO_OP', 'totalChanges': 0}
        for number in range(22)] + [import_value()]


def ready_log(values):
    return '\n'.join(json.dumps(value) for value in values)


def entry_log(values):
    return '\n'.join(json.dumps(value, indent=2) for value in values) + '\n🚀 Starting SoilFER-LIMS...\n'


class StartupGuards(unittest.TestCase):
    def test_exact_22_ready_and_23_noop_pass(self):
        self.assertEqual(len(checks.ready_logs(ready_log(ready_values()))), 22)
        self.assertEqual(len(checks.entrypoint_zero(entry_log(entry_values()))), 23)

    def test_old_21_ready_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'Missing or out-of-order'):
            checks.ready_logs(ready_log(ready_values()[:-1]))

    def test_missing_middle_ready_refuses(self):
        values = ready_values()
        del values[7]
        with self.assertRaisesRegex(RuntimeError, 'Missing or out-of-order'):
            checks.ready_logs(ready_log(values))

    def test_reordered_ready_refuses(self):
        values = ready_values()
        values[0], values[1] = values[1], values[0]
        with self.assertRaisesRegex(RuntimeError, 'Missing or out-of-order'):
            checks.ready_logs(ready_log(values))

    def test_duplicate_ready_refuses(self):
        values = ready_values()
        values.append(values[-1])
        with self.assertRaisesRegex(RuntimeError, 'Missing or out-of-order'):
            checks.ready_logs(ready_log(values))

    def test_ready_any_write_refuses(self):
        for index in range(22):
            with self.subTest(index=index):
                values = ready_values()
                values[index]['totalChanges'] = 1
                with self.assertRaisesRegex(RuntimeError, 'wrote or omitted'):
                    checks.ready_logs(ready_log(values))

    def test_ready_omitted_or_boolean_zero_refuses(self):
        for wrong in [None, False, '0']:
            values = ready_values()
            values[0]['totalChanges'] = wrong
            with self.assertRaisesRegex(RuntimeError, 'wrote or omitted'):
                checks.ready_logs(ready_log(values))

    def test_ready_wrong_source_refuses(self):
        values = ready_values()
        values[-1]['sources'] = dict(checks.SOURCES, migrationSha256='b' * 64)
        with self.assertRaisesRegex(RuntimeError, 'authority differs'):
            checks.ready_logs(ready_log(values))

    def test_ready_wrong_classification_refuses(self):
        values = ready_values()
        values[-1]['classification'] = 'PRE_200'
        with self.assertRaisesRegex(RuntimeError, 'authority differs'):
            checks.ready_logs(ready_log(values))

    def test_ready_any_import_population_refuses(self):
        for key in ['templates', 'receipts', 'draftLinks']:
            values = ready_values()
            values[-1]['counts'] = dict(values[-1]['counts'], **{key: 1})
            with self.assertRaisesRegex(RuntimeError, 'unexpected data'):
                checks.ready_logs(ready_log(values))

    def test_old_22_noop_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'exactly 23'):
            checks.entrypoint_zero(entry_log(entry_values()[:-1]))

    def test_extra_noop_refuses(self):
        values = entry_values()
        values.append(copy.deepcopy(values[-1]))
        with self.assertRaisesRegex(RuntimeError, 'exactly 23'):
            checks.entrypoint_zero(entry_log(values))

    def test_applied_entrypoint_refuses(self):
        values = entry_values()
        values[-1]['mode'] = 'APPLIED'
        with self.assertRaisesRegex(RuntimeError, 'exactly 23'):
            checks.entrypoint_zero(entry_log(values))

    def test_any_entrypoint_write_refuses(self):
        for index in range(23):
            values = entry_values()
            values[index]['totalChanges'] = 1
            with self.assertRaisesRegex(RuntimeError, 'exactly 23'):
                checks.entrypoint_zero(entry_log(values))

    def test_import_must_be_last_refuses(self):
        values = entry_values()
        values[0], values[-1] = values[-1], values[0]
        with self.assertRaisesRegex(RuntimeError, 'authority differs'):
            checks.entrypoint_zero(entry_log(values))

    def test_no_start_marker_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'one default entrypoint'):
            checks.entrypoint_zero(ready_log(entry_values()))

    def test_multiple_start_markers_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'one default entrypoint'):
            checks.entrypoint_zero(entry_log(entry_values()) + 'Starting SoilFER-LIMS...')


if __name__ == '__main__':
    unittest.main(verbosity=2)
