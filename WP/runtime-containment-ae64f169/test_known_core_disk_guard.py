"""Allocation classification checks; no production or Docker operations."""
import pathlib, sys, types, unittest
from unittest.mock import patch

# Import only the proposed accounting logic. The real original check_drop
# implementation is loaded by the Linux test runner, without executing startup.
import release_support as s
import startup_common as c
import known_core_disk_guard as k

class CoreAccountingTests(unittest.TestCase):
    def guard(self):
        guard = k.KnownCoreDiskGuard.__new__(k.KnownCoreDiskGuard)
        guard.root = pathlib.Path('/owned-test')
        guard.reserve = 10556150894
        guard.before = {'/opt/lims': 20000000000, '/var/lib/docker': 20000000000}
        guard.root_before = 100
        guard.core_before = []
        guard.devices = {'/opt/lims': 1, '/var/lib/docker': 1}
        guard.root_device = 1
        guard.record = lambda value: None
        return guard

    def test_measured_one_gib_core_keeps_original_threshold(self):
        guard = self.guard()
        records = [{'device': 1, 'inode': 7, 'allocatedBytes': 1073745920}]
        with patch.object(s, 'disk_free', return_value={p: 18776254080 for p in guard.before}), \
             patch.object(c, 'allocation', return_value=100), patch.object(k, 'core_allocations', return_value=records):
            result = guard.check()
        self.assertEqual(result['unexplainedDropBytes']['/opt/lims'], 150000000)

    def test_unexplained_drop_above_500mb_still_aborts(self):
        guard = self.guard()
        with patch.object(s, 'disk_free', return_value={p: 19499999999 for p in guard.before}), \
             patch.object(c, 'allocation', return_value=100), patch.object(k, 'core_allocations', return_value=[]):
            with self.assertRaisesRegex(AssertionError, '500 MB'):
                guard.check()

    def test_other_device_core_does_not_explain_drop(self):
        guard = self.guard()
        with patch.object(s, 'disk_free', return_value={p: 19000000000 for p in guard.before}), \
             patch.object(c, 'allocation', return_value=100), \
             patch.object(k, 'core_allocations', return_value=[{'device': 2, 'inode': 7, 'allocatedBytes': 1000000000}]):
            with self.assertRaisesRegex(AssertionError, '500 MB'):
                guard.check()

    def test_reserve_floor_is_absolute(self):
        guard = self.guard()
        with patch.object(s, 'disk_free', return_value={p: 10556150893 for p in guard.before}), \
             patch.object(c, 'allocation', return_value=100), patch.object(k, 'core_allocations', return_value=[]):
            with self.assertRaisesRegex(AssertionError, 'Reserve floor'):
                guard.check()

    def test_expired_or_new_core_cannot_mask_unexplained_drop(self):
        guard = self.guard()
        record = {'device': 1, 'inode': 7, 'allocatedBytes': 1073745920}
        for samples in [[[], [record]], [[record], []]]:
            with patch.object(s, 'disk_free', return_value={p: 19000000000 for p in guard.before}), \
                 patch.object(c, 'allocation', return_value=100), \
                 patch.object(k, 'core_allocations', side_effect=samples):
                with self.assertRaisesRegex(AssertionError, '500 MB'):
                    guard.check()

    def test_growing_core_credits_only_smaller_observed_allocation(self):
        self.assertEqual(k.stable_allocations(
            [{'device':1,'inode':7,'allocatedBytes':500000000}],
            [{'device':1,'inode':7,'allocatedBytes':1073745920}])[0]['allocatedBytes'],500000000)

if __name__ == '__main__':
    unittest.main()
