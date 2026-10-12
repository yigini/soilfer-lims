"""Owned synthetic initial-layout refusals and inherited bounded disk guards."""
import copy
import hashlib
import json
import stat
import unittest
from unittest.mock import Mock, patch

import known_core_disk_guard_import as adapter
import known_core_disk_guard_v2 as v2
import known_core_disk_guard_v3 as v3
import test_baseline_confirmation as baseline_cases

RAW_TOOLING = {}


class ImportConfirmationTests(baseline_cases.BaselineTests):
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
        def confirmation(attempt, check_empty, record, reserve):
            return v3.confirm_baseline(attempt, check_empty, record, reserve,
                lexists=lambda _: exists, clock=lambda: self.time, sleeper=self.sleep)
        with patch.object(adapter, 'core_allocations', side_effect=cores), \
                patch.object(adapter.c, 'allocation', side_effect=lambda _: current['rootAllocatedBytes']), \
                patch.object(adapter.s, 'disk_free', side_effect=lambda: current['freeBytes']), \
                patch.object(adapter.pathlib.Path, 'stat', return_value=Mock(st_dev=7)), \
                patch.object(adapter, 'require_proof_root', side_effect=layout), \
                patch.object(adapter, 'confirm_baseline', side_effect=confirmation), \
                patch.object(adapter.KnownCoreDiskGuard, 'record', side_effect=self.rows.append):
            guard = adapter.KnownCoreDiskGuard(root, 500, {}, {})
        return {'freeBytes': guard.before, 'rootAllocatedBytes': guard.root_before,
            'coreAllocations': guard.core_before, 'baselineEnumerationErrors': guard.baseline_errors,
            'baselineEnumerationErrorCount': len(guard.baseline_errors), 'baselineAttempt': guard.baseline_attempt}


class ImportLayoutTests(unittest.TestCase):
    def setUp(self):
        self.root = Mock(); self.root.parent = adapter.pathlib.Path('/opt/lims/releases')
        self.root.name = 'instrument-import-proof-fixture'
        self.source = {'head': '1' * 40, 'files': {name: {'sha256': self.digest(raw)}
            for name, raw in RAW_TOOLING.items()}}
        authorities = {'source-index.json': json.dumps(self.source).encode(),
            'target-pin.json': b'owned pin', 'candidate-rehearsal-authority.json': b'owned review'}
        self.hashes = {name: self.digest(raw) for name, raw in authorities.items()}
        self.entries = {name: self.entry(name, raw) for name, raw in {**RAW_TOOLING, **authorities}.items()}

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
        adapter.require_proof_root(self.root, self.source, self.hashes)

    def test_exact_exported_layout_and_journal_outputs_accept(self):
        self.check()
        for name in adapter.OUTPUT_FILES: self.entries[name] = self.entry(name)
        self.check()

    def test_every_source_or_authority_changed_missing_or_writable_refuses(self):
        for name, item in list(self.entries.items()):
            raw = item.read_bytes.return_value; item.read_bytes.return_value = b'changed'
            with self.subTest(changed=name), self.assertRaises(RuntimeError): self.check()
            item.read_bytes.return_value = raw; del self.entries[name]
            with self.subTest(missing=name), self.assertRaises(RuntimeError): self.check()
            self.entries[name] = item; item.stat.return_value.st_mode = stat.S_IFREG | 0o600
            with self.subTest(writable=name), self.assertRaises(RuntimeError): self.check()
            item.stat.return_value.st_mode = stat.S_IFREG | 0o400

    def test_unknown_database_assets_old_receipt_and_symlinks_refuse_before_scan(self):
        for name in ['fresh-live-backup.db', 'database', 'assets', 'rehearsal-receipt.json', 'foreign.py']:
            self.entries[name] = self.entry(name)
            self.root.iterdir.return_value = list(self.entries.values())
            with self.subTest(name=name), patch.object(adapter, 'core_allocations') as scan, self.assertRaises(RuntimeError):
                adapter.KnownCoreDiskGuard(self.root, 500, self.source, self.hashes)
            scan.assert_not_called(); del self.entries[name]
        for item in list(self.entries.values()):
            item.is_symlink.return_value = True
            with self.subTest(symlink=item.name), self.assertRaises(RuntimeError): self.check()
            item.is_symlink.return_value = False; item.is_file.return_value = False
            with self.subTest(directory=item.name), self.assertRaises(RuntimeError): self.check()
            item.is_file.return_value = True

    def test_historical_source_index_and_wrong_root_cannot_reuse_completed_proof(self):
        self.root.name = 'runtime-kobo-proof-51f67988-completed'
        with self.assertRaises(RuntimeError): self.check()
        self.root.name = 'instrument-import-proof-fixture'
        self.source['files'].pop('import_stage.py')
        with self.assertRaises(RuntimeError): self.check()

    def test_measurement_and_confirmation_methods_are_unchanged(self):
        self.assertIs(adapter.KnownCoreDiskGuard.check, v2.KnownCoreDiskGuard.check)
        self.assertIs(adapter.confirm_baseline, v3.confirm_baseline)
