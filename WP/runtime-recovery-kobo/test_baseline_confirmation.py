"""Synthetic baseline refusal fixtures; never read production or real /proc."""
import copy
import hashlib
import pathlib
import tempfile
import unittest
from unittest.mock import Mock
from known_core_disk_guard_v3 import confirm_baseline, require_empty_root, KnownCoreDiskGuard
from known_core_disk_guard_v2 import KnownCoreDiskGuard as V2Guard


class BaselineTests(unittest.TestCase):
    def setUp(self):
        self.time = 0
        self.rows = []
        self.refused = {'freeBytes': {'/guarded': 900}, 'rootAllocatedBytes': 800,
            'coreAllocations': [{'allocatedBytes': 700}],
            'baselineEnumerationErrors': [{'path': '/proc/42', 'errorType': 'FileNotFoundError'}],
            'baselineEnumerationErrorCount': 1}
        self.clean = {'freeBytes': {'/guarded': 1000}, 'rootAllocatedBytes': 100,
            'coreAllocations': [], 'baselineEnumerationErrors': [], 'baselineEnumerationErrorCount': 0}

    def sleep(self, seconds):
        self.assertLessEqual(seconds, 1)
        self.time += seconds

    def run_guard(self, values, exists=False, durations=None, nonempty=False):
        values = iter(values); durations = iter(durations or [])
        def attempt():
            self.time += next(durations, 0)
            return copy.deepcopy(next(values))
        def empty():
            if nonempty: raise RuntimeError('Non-empty baseline root')
        return confirm_baseline(attempt, empty, self.rows.append, 500,
            lexists=lambda _: exists, clock=lambda: self.time, sleeper=self.sleep)

    def test_vanished_then_clean_accepts_only_fresh_whole_baseline(self):
        actual = self.run_guard([self.refused, self.clean])
        self.assertEqual(actual, {**self.clean, 'baselineAttempt': 2})
        self.assertEqual(self.rows[0]['stage'], 'baseline-attempt-refused-vanished-process')
        self.assertEqual(self.rows[0]['creditBytes'], 0)
        self.assertEqual(self.rows[0]['confirmedProcesses'], [{'path': '/proc/42', 'lexistsAfterScan': False}])
        self.assertEqual(self.rows[-1]['stage'], 'baseline')
        self.assertEqual(actual['coreAllocations'], [])

    def test_permission_and_other_error_types_refuse(self):
        for error in ['PermissionError', 'OSError']:
            row = copy.deepcopy(self.refused); row['baselineEnumerationErrors'][0]['errorType'] = error
            with self.subTest(error=error), self.assertRaises(RuntimeError): self.run_guard([row, self.clean])

    def test_fd_subpath_and_core_directory_errors_refuse(self):
        for path in ['/proc/42/fd/8', '/proc/42/comm', '/proc/not-pid', '/var/lib/systemd/coredump/core.x']:
            row = copy.deepcopy(self.refused); row['baselineEnumerationErrors'][0]['path'] = path
            with self.subTest(path=path), self.assertRaises(RuntimeError): self.run_guard([row, self.clean])

    def test_present_or_reused_pid_refuses(self):
        with self.assertRaises(RuntimeError): self.run_guard([self.refused, self.clean], exists=True)

    def test_three_vanished_attempts_refuse(self):
        with self.assertRaises(RuntimeError): self.run_guard([self.refused] * 3 + [self.clean])
        self.assertEqual(len(self.rows), 3)
        self.assertTrue(all(row['creditBytes'] == 0 for row in self.rows))

    def test_clean_late_first_or_second_attempt_refuses(self):
        for rows, durations in [([self.clean], [10.001]), ([self.refused, self.clean], [5, 5])]:
            self.time = 0
            with self.subTest(durations=durations), self.assertRaises(RuntimeError):
                self.run_guard(rows, durations=durations)

    def test_reserve_breach_on_any_attempt_refuses(self):
        breach = copy.deepcopy(self.clean); breach['freeBytes']['/guarded'] = 499
        for values in [[breach], [self.refused, breach]]:
            with self.subTest(values=values), self.assertRaises(RuntimeError): self.run_guard(values)

    def test_nonempty_layout_refuses_before_a_scan(self):
        with self.assertRaises(RuntimeError): self.run_guard([self.clean], nonempty=True)
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(RuntimeError): require_empty_root(pathlib.Path(folder))
        root = Mock(); root.parent = pathlib.Path('/opt/lims/releases')
        root.name = 'runtime-kobo-proof-fixture'
        for name in ['database', 'assets', 'fresh-live-backup.db', 'rehearsal-receipt.json', 'unknown']:
            entry = Mock(); entry.name = name
            entry.is_symlink.return_value = False; entry.is_file.return_value = True
            root.iterdir.return_value = [entry]
            with self.subTest(name=name), self.assertRaises(RuntimeError): require_empty_root(root)

    def test_original_and_v2_raw_source_hashes_unchanged(self):
        import known_core_disk_guard, known_core_disk_guard_v2
        for module, digest in [(known_core_disk_guard, 'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169'),
                (known_core_disk_guard_v2, 'f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c')]:
            actual = getattr(module, '__raw_sha256__', None)
            if actual is None: actual = hashlib.sha256(pathlib.Path(module.__file__).read_bytes()).hexdigest()
            self.assertEqual(actual, digest)
        self.assertIs(KnownCoreDiskGuard.check, V2Guard.check)
        self.assertIs(KnownCoreDiskGuard.physical_sample, V2Guard.physical_sample)

    def test_process_lookup_error_is_equally_bound(self):
        row = copy.deepcopy(self.refused); row['baselineEnumerationErrors'][0]['errorType'] = 'ProcessLookupError'
        self.assertEqual(self.run_guard([row, self.clean])['baselineAttempt'], 2)


if __name__ == '__main__':
    unittest.main()
