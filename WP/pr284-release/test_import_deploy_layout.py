"""Owned frozen-kit fixtures and unchanged disk confirmation refusals."""
import copy
import hashlib
import json
import stat
import unittest
from unittest.mock import MagicMock, Mock, patch

import known_core_disk_guard_import_deploy as adapter
import test_import_layout as layout_cases
import known_core_disk_guard_v3 as v3

RAW_PACKAGE = {}


class ImportDeployConfirmationTests(layout_cases.ImportConfirmationTests):
    def run_guard(self, values, exists=False, durations=None, nonempty=False):
        values = iter(values); durations = iter(durations or [])
        root = Mock(); root.stat.return_value.st_dev = 7
        current = {}; calls = 0
        def cores(errors):
            nonlocal calls, current
            if calls % 2 == 0:
                current = copy.deepcopy(next(values)); self.time += next(durations, 0)
                errors.extend(current['baselineEnumerationErrors'])
            calls += 1
            return [{**row, 'device': 7, 'inode': 42} for row in current['coreAllocations']]
        def layout(*args):
            if nonempty: raise RuntimeError('Non-empty baseline root')
        def confirmation(attempt, check_layout, record, reserve):
            return v3.confirm_baseline(attempt, check_layout, record, reserve,
                lexists=lambda _: exists, clock=lambda: self.time, sleeper=self.sleep)
        with patch.object(adapter, 'core_allocations', side_effect=cores), \
                patch.object(adapter.c, 'allocation', side_effect=lambda _: current['rootAllocatedBytes']), \
                patch.object(adapter.s, 'disk_free', side_effect=lambda: current['freeBytes']), \
                patch.object(adapter.pathlib.Path, 'stat', return_value=Mock(st_dev=7)), \
                patch.object(adapter, 'require_frozen_root', side_effect=layout), \
                patch.object(adapter, 'confirm_baseline', side_effect=confirmation), \
                patch.object(adapter.KnownCoreDiskGuard, 'record', side_effect=self.rows.append):
            guard = adapter.KnownCoreDiskGuard(root, 500, {}, 'a' * 64, 'b' * 64)
        return {'freeBytes': guard.before, 'rootAllocatedBytes': guard.root_before,
            'coreAllocations': guard.core_before, 'baselineEnumerationErrors': guard.baseline_errors,
            'baselineEnumerationErrorCount': len(guard.baseline_errors), 'baselineAttempt': guard.baseline_attempt}


class ImportDeployLayoutTests(unittest.TestCase):
    def setUp(self):
        self.root = MagicMock(); self.root.parent = adapter.pathlib.Path('/opt/lims/releases')
        self.root.name = 'instrument-import-release-owned'
        self.root.__str__.return_value = '/opt/lims/releases/' + self.root.name
        self.head = '1' * 40
        self.manifest = {'root': str(self.root), 'head': self.head,
            'files': {name: self.digest(raw) for name, raw in RAW_PACKAGE.items()}}
        self.manifest_bytes = json.dumps(self.manifest).encode()
        self.manifest_sha = self.digest(self.manifest_bytes)
        self.gate = {'executionRoot': str(self.root), 'manifestSha256': self.manifest_sha, 'head': self.head}
        gate_bytes = json.dumps(self.gate).encode(); self.gate_sha = self.digest(gate_bytes)
        self.attempt = {'gateSha256': self.gate_sha, 'head': self.head}
        self.entries = {name: self.entry(name, raw) for name, raw in {
            **RAW_PACKAGE, 'prepared-manifest.json': self.manifest_bytes,
            'production-gate.json': gate_bytes,
            'execution-attempt.json': json.dumps(self.attempt).encode()}.items()}

    @staticmethod
    def digest(raw): return hashlib.sha256(raw).hexdigest()

    @staticmethod
    def entry(name, raw=b''):
        item = Mock(); item.name = name; item.is_symlink.return_value = False
        item.is_file.return_value = True; item.stat.return_value.st_mode = stat.S_IFREG | 0o400
        item.read_bytes.return_value = raw
        return item

    def check(self):
        self.root.iterdir.return_value = list(self.entries.values())
        adapter.require_frozen_root(self.root, self.manifest, self.manifest_sha, self.gate_sha)

    def test_exact_unused_frozen_kit_and_journal_only_output_accept(self):
        self.check()
        self.entries['disk-allocation-observations.jsonl'] = self.entry('disk-allocation-observations.jsonl')
        self.check()

    def test_every_required_file_changed_missing_or_writable_refuses(self):
        for name, item in list(self.entries.items()):
            if name == 'execution-attempt.json': continue
            raw = item.read_bytes.return_value; item.read_bytes.return_value = b'changed'
            with self.subTest(changed=name), self.assertRaises(RuntimeError): self.check()
            item.read_bytes.return_value = raw; del self.entries[name]
            with self.subTest(missing=name), self.assertRaises(RuntimeError): self.check()
            self.entries[name] = item; item.stat.return_value.st_mode = stat.S_IFREG | 0o600
            with self.subTest(writable=name), self.assertRaises(RuntimeError): self.check()
            item.stat.return_value.st_mode = stat.S_IFREG | 0o400

    def test_consumed_receipt_database_assets_unknown_file_or_symlink_refuse_before_scan(self):
        for name in ['production-receipt.json', 'production-receipt.in-progress', 'dev.db', 'assets', 'unknown.py']:
            self.entries[name] = self.entry(name)
            self.root.iterdir.return_value = list(self.entries.values())
            with self.subTest(name=name), patch.object(adapter, 'core_allocations') as scan, self.assertRaises(RuntimeError):
                adapter.KnownCoreDiskGuard(self.root, 500, self.manifest, self.manifest_sha, self.gate_sha)
            scan.assert_not_called(); del self.entries[name]
        for item in self.entries.values():
            item.is_symlink.return_value = True
            with self.subTest(symlink=item.name), self.assertRaises(RuntimeError): self.check()
            item.is_symlink.return_value = False; item.is_file.return_value = False
            with self.subTest(directory=item.name), self.assertRaises(RuntimeError): self.check()
            item.is_file.return_value = True

    def test_missing_or_wrong_execution_attempt_and_gate_bindings_refuse(self):
        item = self.entries.pop('execution-attempt.json')
        with self.assertRaises(RuntimeError): self.check()
        self.entries[item.name] = item
        for key, value in [('gateSha256', '0' * 64), ('head', '2' * 40)]:
            item.read_bytes.return_value = json.dumps(dict(self.attempt, **{key: value})).encode()
            with self.subTest(key=key), self.assertRaises(RuntimeError): self.check()
        item.read_bytes.return_value = json.dumps(self.attempt).encode()
        item.stat.return_value.st_mode = stat.S_IFREG | 0o600
        with self.assertRaises(RuntimeError): self.check()

    def test_wrong_root_or_unsafe_measured_file_refuses(self):
        self.root.name = 'runtime-kobo-release-consumed'
        with self.assertRaises(RuntimeError): self.check()
        self.root.name = 'instrument-import-release-owned'
        for name in ['../outside.py', 'dev.db', 'backup.tar.gz', 'production-receipt.json']:
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                adapter.require_frozen_root(self.root, dict(self.manifest,
                    files=dict(self.manifest['files'], **{name: 'a' * 64})), self.manifest_sha, self.gate_sha)
