"""Actual exported proof layout and unchanged confirmation bounds; synthetic only."""
import ast
import copy
import hashlib
import json
import stat
import unittest
from unittest.mock import Mock, patch
import known_core_disk_guard_proof as adapter
import known_core_disk_guard_v3 as v3
import known_core_disk_guard_v2 as v2
import test_baseline_confirmation as baseline_cases
import export_launch_runtime_proof as launcher


class ProofConfirmationTests(baseline_cases.BaselineTests):
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
        def empty(*args):
            if nonempty: raise RuntimeError('Non-empty baseline root')
        def confirmation(attempt, check_empty, record, reserve):
            return v3.confirm_baseline(attempt, check_empty, record, reserve,
                lexists=lambda _: exists, clock=lambda: self.time, sleeper=self.sleep)
        with patch.object(adapter, 'core_allocations', side_effect=cores), \
                patch.object(adapter.c, 'allocation', side_effect=lambda _: current['rootAllocatedBytes']), \
                patch.object(adapter.s, 'disk_free', side_effect=lambda: current['freeBytes']), \
                patch.object(adapter.pathlib.Path, 'stat', return_value=Mock(st_dev=7)), \
                patch.object(adapter, 'require_proof_root', side_effect=empty), \
                patch.object(adapter, 'confirm_baseline', side_effect=confirmation), \
                patch.object(adapter.KnownCoreDiskGuard, 'record', side_effect=self.rows.append):
            guard = adapter.KnownCoreDiskGuard(root, 500, {}, {})
        return {'freeBytes': guard.before, 'rootAllocatedBytes': guard.root_before,
            'coreAllocations': guard.core_before, 'baselineEnumerationErrors': guard.baseline_errors,
            'baselineEnumerationErrorCount': len(guard.baseline_errors), 'baselineAttempt': guard.baseline_attempt}


class ProofLayoutTests(unittest.TestCase):
    def setUp(self):
        self.root = Mock(); self.root.parent = adapter.pathlib.Path('/opt/lims/releases')
        self.root.name = 'runtime-kobo-proof-fixture'
        sources = {name: ('source:' + name).encode() for name in adapter.SOURCE_FILES}
        self.source = {'head': '1' * 40, 'files': {n: {'sha256': self.digest(d)} for n, d in sources.items()}}
        authorities = {'source-index.json': json.dumps(self.source).encode(),
            'target-pin.json': b'pin', 'candidate-rehearsal-authority.json': b'review'}
        self.hashes = {n: self.digest(d) for n, d in authorities.items()}
        self.entries = {n: self.entry(n, d) for n, d in {**sources, **authorities}.items()}

    @staticmethod
    def digest(data): return hashlib.sha256(data).hexdigest()

    @staticmethod
    def entry(name, data=b''):
        item = Mock(); item.name = name; item.is_symlink.return_value = False
        item.is_file.return_value = True; item.stat.return_value.st_mode = stat.S_IFREG | 0o400
        item.read_bytes.return_value = data
        return item

    def check(self):
        self.root.iterdir.return_value = list(self.entries.values())
        adapter.require_proof_root(self.root, self.source, self.hashes)

    def test_actual_exported_source_set_matches_fixed_positive_layout(self):
        tree = ast.parse(launcher.__raw_source__)
        exported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'paths' for t in node.targets):
                exported.update(ast.literal_eval(node.value.generators[0].iter))
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Subscript) and isinstance(target.value, ast.Name) and target.value.id == 'paths':
                        exported.add(ast.literal_eval(target.slice))
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and \
                    isinstance(node.func.value, ast.Name) and node.func.value.id == 'paths' and node.func.attr == 'update':
                exported.update(ast.literal_eval(node.args[0].generators[0].iter))
        self.assertEqual(exported, adapter.SOURCE_FILES)
        self.check()
        for name in adapter.OUTPUT_FILES: self.entries[name] = self.entry(name)
        self.check()

    def test_every_missing_changed_or_writable_source_and_authority_refuses(self):
        for name, entry in list(self.entries.items()):
            original = entry.read_bytes.return_value
            entry.read_bytes.return_value = b'changed'
            with self.subTest(changed=name), self.assertRaises(RuntimeError): self.check()
            entry.read_bytes.return_value = original
            del self.entries[name]
            with self.subTest(missing=name), self.assertRaises(RuntimeError): self.check()
            self.entries[name] = entry; entry.stat.return_value.st_mode = stat.S_IFREG | 0o600
            with self.subTest(writable=name), self.assertRaises(RuntimeError): self.check()
            entry.stat.return_value.st_mode = stat.S_IFREG | 0o400

    def test_index_cannot_authorize_any_extra_file_or_omit_authority(self):
        for name in ['foreign.py', 'backup.db', 'assets', '../escape']:
            self.source['files'][name] = {'sha256': self.digest(b'')}
            with self.subTest(extra=name), self.assertRaises(RuntimeError): self.check()
            del self.source['files'][name]
        for name in list(self.hashes):
            value = self.hashes.pop(name)
            with self.subTest(missing=name), self.assertRaises(RuntimeError): self.check()
            self.hashes[name] = value

    def test_unknown_copy_assets_archive_receipt_directory_symlink_refuse_before_scan(self):
        for name in ['extra', 'fresh-live-backup.db', 'database', 'assets', 'source.tar.gz', 'rehearsal-receipt.json']:
            self.entries[name] = self.entry(name)
            self.root.iterdir.return_value = list(self.entries.values())
            with self.subTest(name=name), patch.object(adapter, 'core_allocations') as scan, self.assertRaises(RuntimeError):
                adapter.KnownCoreDiskGuard(self.root, 500, self.source, self.hashes)
            scan.assert_not_called(); del self.entries[name]
        for entry in list(self.entries.values()) + [self.entry('unit.stdout')]:
            self.entries[entry.name] = entry
            entry.is_symlink.return_value = True
            with self.subTest(symlink=entry.name), self.assertRaises(RuntimeError): self.check()
            entry.is_symlink.return_value = False; entry.is_file.return_value = False
            with self.subTest(directory=entry.name), self.assertRaises(RuntimeError): self.check()
            entry.is_file.return_value = True

    def test_allocation_measurements_and_v2_midrun_methods_remain_unchanged(self):
        self.assertIs(adapter.KnownCoreDiskGuard.check, v2.KnownCoreDiskGuard.check)
        self.assertIs(adapter.confirm_baseline, v3.confirm_baseline)
        tree = ast.parse(adapter.__raw_source__)
        names = [n.func.attr for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)]
        self.assertEqual(names.count('allocation'), 2)
        self.assertEqual(names.count('disk_free'), 1)
