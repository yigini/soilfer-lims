"""Owned temporary transport failures retain progress and never retry."""
import json
import io
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

import export_freeze_import_kit as exporter


class PackagingTransportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='owned-packaging-transport-')
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name)
        namespace = {'subprocess': subprocess, 'json': json, 'time': time}
        exec(compile(exporter.FREEZER_RUNNER, '/owned-transport.py', 'exec'), namespace)
        self.run_freezer = namespace['run_freezer']
        output = patch('sys.stdout', new_callable=io.StringIO)
        output.start()
        self.addCleanup(output.stop)

    def record(self):
        return json.loads((self.root / 'freeze-result.json').read_bytes())

    def test_success_retains_flushed_progress_and_one_attempt(self):
        self.run_freezer([sys.executable, '-u', '-c', "print('completed-stage')"], self.root, 10)
        self.assertIn(b'completed-stage', (self.root / 'freeze.stdout').read_bytes())
        self.assertEqual(self.record()['status'], 'PASSED')
        self.assertEqual(self.record()['attemptCount'], 1)
        self.assertFalse(self.record()['retried'])

    def test_timeout_stops_child_and_retains_partial_progress_without_retry(self):
        command = [sys.executable, '-u', '-c', "import time;print('stage-start',flush=True);time.sleep(10)"]
        with self.assertRaisesRegex(RuntimeError, 'deadline'):
            self.run_freezer(command, self.root, 1)
        self.assertIn(b'stage-start', (self.root / 'freeze.stdout').read_bytes())
        self.assertEqual(self.record()['status'], 'TIMED_OUT')
        self.assertIsNone(self.record()['returncode'])
        self.assertEqual(self.record()['attemptCount'], 1)
        self.assertFalse(self.record()['retried'])

    def test_nonzero_refuses_and_preserves_stderr(self):
        command = [sys.executable, '-u', '-c', "import sys;print('guard-refusal',file=sys.stderr);sys.exit(7)"]
        with self.assertRaisesRegex(RuntimeError, 'guard-refusal'):
            self.run_freezer(command, self.root, 10)
        self.assertEqual(self.record()['status'], 'REFUSED')
        self.assertEqual(self.record()['returncode'], 7)

    def test_retained_log_blocks_overwrite_before_any_child(self):
        (self.root / 'freeze.stdout').write_bytes(b'original')
        with patch.object(subprocess, 'run') as launch, self.assertRaises(FileExistsError):
            self.run_freezer(['unused'], self.root, 10)
        launch.assert_not_called()
        self.assertEqual((self.root / 'freeze.stdout').read_bytes(), b'original')

    def test_transport_deadline_leaves_time_to_retain_failure_evidence(self):
        self.assertEqual(exporter.PACKAGING_SSH_TIMEOUT_SECONDS,
                         exporter.PACKAGING_READ_ONLY_TIMEOUT_SECONDS + 60)
