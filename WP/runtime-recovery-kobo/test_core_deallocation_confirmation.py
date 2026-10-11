"""Synthetic tests only; no host or database access and no live guard execution."""
import unittest
from known_core_disk_guard_v2 import confirm_disappearance

PATH = '/opt/lims'
BEFORE = {PATH: 10000000000}
DEVICES = {PATH: 7}
RAW = {'device': 7, 'inode': 12, 'allocatedBytes': 1073745920,
       'kind': 'active-systemd-core'}


def observed(unexplained, cores=()):
    return {'freeBytes': {PATH: BEFORE[PATH] - unexplained},
        'explainedAllocationGrowthBytes': {PATH: 0},
        'coreAllocationsBeforeFreeSample': list(cores),
        'coreAllocationsAfterFreeSample': list(cores), 'coreAllocations': list(cores)}


class Confirmation(unittest.TestCase):
    def run_confirmation(self, initial, previous, samples, sample_lag=0):
        ticks, events, seen = [0], [], []
        def sleep(seconds):
            ticks[0] += seconds
        def sample():
            value = samples[min(len(seen), len(samples) - 1)]
            seen.append(value)
            ticks[0] += sample_lag
            if isinstance(value, BaseException):
                raise value
            return value
        result = confirm_disappearance(BEFORE, DEVICES, previous, initial,
            sample, events.append, clock=lambda: ticks[0], sleeper=sleep)
        return result, events, seen, ticks[0]

    def test_normal_sample_never_waits(self):
        value = observed(2000000)
        result, events, samples, elapsed = self.run_confirmation(value, [], [])
        self.assertIs(result, value)
        self.assertEqual((events, samples, elapsed), ([], [], 0))

    def test_actual_free_space_recovery_passes_without_credit(self):
        fresh = observed(2084864)
        result, events, samples, elapsed = self.run_confirmation(
            observed(1075834880), [RAW], [observed(1075834880), fresh])
        self.assertIs(result, fresh)
        self.assertEqual(elapsed, 2)
        self.assertEqual(len(samples), 2)
        self.assertTrue(all(row['vanishedAllocationCreditBytes'] == 0 for row in events))
        self.assertFalse(events[0]['forwardProgressAllowed'])
        self.assertTrue(events[-1]['forwardProgressAllowed'])

    def test_persistent_unknown_growth_aborts(self):
        with self.assertRaisesRegex(AssertionError, 'Unexplained disk growth exceeds 500 MB'):
            self.run_confirmation(observed(1075834880), [RAW], [observed(1075834880)])

    def test_no_previous_paired_active_core_aborts_immediately(self):
        with self.assertRaisesRegex(AssertionError, '500 MB'):
            self.run_confirmation(observed(1075834880), [], [])

    def test_retained_file_disappearance_does_not_qualify(self):
        old = {**RAW, 'kind': 'retained-systemd-core'}
        with self.assertRaisesRegex(AssertionError, '500 MB'):
            self.run_confirmation(observed(1075834880), [old], [])

    def test_different_filesystem_cannot_qualify(self):
        with self.assertRaisesRegex(AssertionError, '500 MB'):
            self.run_confirmation(observed(1075834880), [{**RAW, 'device': 8}], [])

    def test_same_inode_still_present_cannot_qualify(self):
        with self.assertRaisesRegex(AssertionError, '500 MB'):
            self.run_confirmation(observed(1075834880, [RAW]), [RAW], [])

    def test_disappearance_inside_sample_can_confirm_fresh_space(self):
        initial = observed(1075834880)
        initial['coreAllocationsBeforeFreeSample'] = [RAW]
        fresh = observed(2084864)
        result, _, _, elapsed = self.run_confirmation(initial, [RAW], [fresh])
        self.assertIs(result, fresh)
        self.assertEqual(elapsed, 1)

    def test_present_in_after_scan_cannot_qualify(self):
        initial = observed(1075834880)
        initial['coreAllocationsAfterFreeSample'] = [RAW]
        with self.assertRaisesRegex(AssertionError, '500 MB'):
            self.run_confirmation(initial, [RAW], [])

    def test_excess_beyond_physical_blocks_aborts_immediately(self):
        with self.assertRaisesRegex(AssertionError, '500 MB'):
            self.run_confirmation(observed(1600000000), [RAW], [])

    def test_floor_refusal_during_confirmation_is_immediate(self):
        with self.assertRaisesRegex(AssertionError, 'Reserve floor refused'):
            self.run_confirmation(observed(1075834880), [RAW],
                [AssertionError('Reserve floor refused')])

    def test_unknown_growth_cannot_use_vanished_credit(self):
        # The raw core is gone but new unknown allocation consumed its space.
        # Fresh df still exceeds the original residual threshold and refuses.
        with self.assertRaisesRegex(AssertionError, '500 MB'):
            self.run_confirmation(observed(1075834880), [RAW], [observed(600000000)])

    def test_late_io_recovery_cannot_permit_progress(self):
        with self.assertRaisesRegex(RuntimeError, '10-second deadline'):
            self.run_confirmation(observed(1075834880), [RAW], [observed(2084864)], sample_lag=10)


if __name__ == '__main__':
    unittest.main()
