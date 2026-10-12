"""Production adapter fixtures: mocked measurements, no host or Docker access."""
import ast
import copy
import hashlib
import inspect
import json
import pathlib
import stat
import sys
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock, patch
import known_core_disk_guard_deploy as adapter
import known_core_disk_guard_v3 as v3
import known_core_disk_guard_v2 as v2
import test_baseline_confirmation as baseline_cases
import deploy_runtime as deploy
from runtime_release_contract import (wal_recovery_binding, HELD_TRIPLE, LIVE_IMAGE,
    ORIGINAL_INGRESS_SHA, HELD_INGRESS_SHA)


class AdapterConfirmationTests(baseline_cases.BaselineTests):
    """Run every V3 bound/refusal case through the actual adapter constructor."""
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
                patch.object(adapter, 'require_frozen_root', side_effect=empty), \
                patch.object(adapter, 'confirm_baseline', side_effect=confirmation), \
                patch.object(adapter.KnownCoreDiskGuard, 'record', side_effect=self.rows.append):
            guard = adapter.KnownCoreDiskGuard(root, 500, {}, '', '')
        return {'freeBytes': guard.before, 'rootAllocatedBytes': guard.root_before,
            'coreAllocations': guard.core_before, 'baselineEnumerationErrors': guard.baseline_errors,
            'baselineEnumerationErrorCount': len(guard.baseline_errors), 'baselineAttempt': guard.baseline_attempt}


class AdapterLayoutTests(unittest.TestCase):
    def setUp(self):
        self.root = Mock(); self.root.parent = pathlib.Path('/opt/lims/releases')
        self.root.name = 'runtime-kobo-release-fixture'
        self.root.__str__ = Mock(return_value='/opt/lims/releases/runtime-kobo-release-fixture')
        self.manifest = {'root': str(self.root), 'head': '1' * 40, 'files': {'helper.py': self.digest(b'helper')}}
        self.manifest_bytes = json.dumps(self.manifest).encode(); self.manifest_sha = self.digest(self.manifest_bytes)
        self.gate = {'head': self.manifest['head'], 'executionRoot': str(self.root), 'manifestSha256': self.manifest_sha}
        self.gate_bytes = json.dumps(self.gate).encode(); self.gate_sha = self.digest(self.gate_bytes)
        attempt = json.dumps({'head': self.manifest['head'], 'gateSha256': self.gate_sha}).encode()
        self.entries = {name: self.entry(name, data) for name, data in {
            'helper.py': b'helper', 'prepared-manifest.json': self.manifest_bytes,
            'production-gate.json': self.gate_bytes, 'execution-attempt.json': attempt}.items()}

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
        adapter.require_frozen_root(self.root, self.manifest, self.manifest_sha, self.gate_sha)

    def test_complete_positive_frozen_layout_and_ledger(self):
        self.check()
        self.entries['disk-allocation-observations.jsonl'] = self.entry('disk-allocation-observations.jsonl')
        self.check()

    def test_changed_missing_and_nonimmutable_frozen_files_refuse(self):
        for name in ['helper.py', 'prepared-manifest.json', 'production-gate.json']:
            item = self.entries[name]; data = item.read_bytes.return_value
            item.read_bytes.return_value = b'changed'
            with self.subTest(name=name), self.assertRaises(RuntimeError): self.check()
            item.read_bytes.return_value = data
            del self.entries[name]
            with self.subTest(missing=name), self.assertRaises(RuntimeError): self.check()
            self.entries[name] = item; item.stat.return_value.st_mode = stat.S_IFREG | 0o600
            with self.subTest(mode=name), self.assertRaises(RuntimeError): self.check()
            item.stat.return_value.st_mode = stat.S_IFREG | 0o400

    def test_extra_production_receipt_database_archive_or_output_refuses(self):
        for name in ['extra', 'production-receipt.json', 'production-receipt.in-progress',
                'backup.db', 'assets.tar.gz', 'unit.stdout', 'unit.stderr']:
            self.entries[name] = self.entry(name)
            with self.subTest(name=name), self.assertRaises(RuntimeError): self.check()
            del self.entries[name]

    def test_any_directory_or_symlink_refuses(self):
        for name in list(self.entries):
            item = self.entries[name]; item.is_file.return_value = False
            with self.subTest(directory=name), self.assertRaises(RuntimeError): self.check()
            item.is_file.return_value = True; item.is_symlink.return_value = True
            with self.subTest(symlink=name), self.assertRaises(RuntimeError): self.check()
            item.is_symlink.return_value = False

    def test_wrong_root_gate_or_consumed_attempt_refuses(self):
        self.root.name = 'runtime-kobo-proof-fixture'
        with self.assertRaises(RuntimeError): self.check()
        self.root.name = 'runtime-kobo-release-fixture'
        self.entries['execution-attempt.json'].read_bytes.return_value = json.dumps({
            'head': self.manifest['head'], 'gateSha256': 'wrong'}).encode()
        with self.assertRaises(RuntimeError): self.check()
        del self.entries['execution-attempt.json']
        with self.assertRaises(RuntimeError): self.check()

    def test_raw_proof_guards_and_midrun_methods_unchanged(self):
        for module, digest in [(v3, '878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f')]:
            actual = getattr(module, '__raw_sha256__', None)
            if actual is None: actual = self.digest(pathlib.Path(module.__file__).read_bytes())
            self.assertEqual(actual, digest)
        self.assertIs(adapter.KnownCoreDiskGuard.check, v2.KnownCoreDiskGuard.check)
        self.assertIs(adapter.KnownCoreDiskGuard.physical_sample, v2.KnownCoreDiskGuard.physical_sample)
        self.assertIs(adapter.confirm_baseline, v3.confirm_baseline)
        self.assertEqual((adapter.ATTEMPTS_MAX, adapter.DEADLINE_SECONDS, adapter.POLICY),
            (3, 10, 'CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE'))

    def test_static_adapter_order_and_journal_output(self):
        def source(name):
            module = sys.modules.get(name)
            return getattr(module, '__raw_source__', None) or pathlib.Path(__file__).with_name(name + '.py').read_bytes()
        tree = ast.parse(source('deploy_runtime'))
        main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'main')
        guarded = next(node for node in main.body if isinstance(node, ast.Try))
        first = guarded.body[0]
        self.assertIsInstance(first, ast.Assign)
        self.assertEqual(first.targets[0].id, 'guard'); self.assertEqual(first.value.func.id, 'KnownCoreDiskGuard')
        adapter_line = first.lineno
        calls = [node for node in ast.walk(guarded) if isinstance(node, ast.Call)]
        for name in ['verify_gate', 'set_ingress']:
            self.assertLess(adapter_line, min(node.lineno for node in calls if isinstance(node.func, ast.Name) and node.func.id == name))
        self.assertLess(adapter_line, min(node.lineno for node in calls if isinstance(node.func, ast.Attribute) and node.func.attr in ['inspect', 'command']))
        self.assertLess(adapter_line, min(node.lineno for node in calls if isinstance(node.func, ast.Name) and node.func.id == 'sealed_stopped_state'))
        launcher = source('launch_runtime_release').decode()
        self.assertIn('StandardOutput=journal', launcher); self.assertIn('StandardError=journal', launcher)
        self.assertNotIn('StandardOutput=append:', launcher)


class StoppedWalTests(unittest.TestCase):
    """Real SQLite fixtures in owned temporary directories, never production."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='lims-wal-guard-')
        self.root = pathlib.Path(self.temp.name).resolve()
        self.database = self.root / 'original.db'
        self.db = sqlite3.connect(self.database)
        for name in ['_schema_migrations', 'WorkAttempt', 'AuditLog', 'Result', 'WorkItem']:
            self.db.execute('CREATE TABLE ' + name + '(id TEXT PRIMARY KEY)')
        self.db.execute('CREATE TABLE Sample(id TEXT PRIMARY KEY, value TEXT)')
        for i in range(98): self.db.execute('CREATE TABLE fixture_' + str(i) + '(id TEXT PRIMARY KEY)')
        self.db.executemany('INSERT INTO _schema_migrations VALUES(?)', [(str(i),) for i in range(38)])
        self.db.execute("INSERT INTO Sample VALUES('one','protected')"); self.db.commit()
        self.db.execute('PRAGMA journal_mode=WAL'); self.db.execute('PRAGMA wal_autocheckpoint=0')
        self.guard = Mock()

    def tearDown(self):
        self.db.close()
        # Raw retained fixtures are read-only just like production seals.
        for path in self.root.rglob('*'):
            if path.is_file(): path.chmod(0o600)
        self.temp.cleanup()

    def test_committed_nonempty_wal_included_without_original_mutation(self):
        self.db.execute("INSERT INTO Sample VALUES('two','in WAL')"); self.db.commit()
        before = deploy.triple_state(self.database)
        self.assertGreater(before['-wal']['bytes'], 0)
        expected, seal = deploy.sealed_stopped_state(self.root, 'sealed', self.database, self.guard)
        self.assertEqual(expected['tables']['Sample']['count'], 2)
        main = json.loads((self.root / 'sealed/main-only-state.json').read_bytes())
        self.assertEqual(main['tables']['Sample']['count'], 1)
        self.assertEqual(deploy.triple_state(self.database), before)
        self.assertTrue(seal['countsIncludeWal']); self.assertGreater(self.guard.check.call_count, 0)
        backup = self.root / 'sealed/dev-stopped-backup.db'
        self.assertEqual(deploy.s.snapshot(backup, immutable=True), expected)

    def test_empty_or_absent_wal_still_seals_full_state(self):
        before = deploy.triple_state(self.database)
        expected, _ = deploy.sealed_stopped_state(self.root, 'sealed', self.database, self.guard)
        self.assertEqual(expected['tables']['Sample']['count'], 1)
        self.assertEqual(deploy.triple_state(self.database), before)

    def test_original_change_during_copy_refuses(self):
        changed = False
        def change():
            nonlocal changed
            if not changed:
                changed = True
                with self.database.open('ab') as out: out.write(b'changed')
        self.guard.check.side_effect = change
        with self.assertRaisesRegex(RuntimeError, 'changed during copy'):
            deploy.copy_triple(self.database, self.root / 'raw', self.guard)

    def test_wal_folded_lower_count_or_missing_table_refuses(self):
        main = {'tables': {'Sample': {'count': 2}}}
        for tables in [{'Sample': {'count': 1}}, {}]:
            with self.subTest(tables=tables), self.assertRaises(RuntimeError):
                deploy.logical_count_guard(main, {'tables': tables})

    def test_equal_counts_but_changed_protected_content_refuses_after_jobs_off(self):
        expected, _ = deploy.sealed_stopped_state(self.root, 'before', self.database, self.guard)
        self.db.execute("UPDATE Sample SET value='unauthorized' WHERE id='one'"); self.db.commit()
        with self.assertRaisesRegex(RuntimeError, 'logical state changed'):
            deploy.sealed_stopped_state(self.root, 'after', self.database, self.guard, expected)

    def test_new_sidecar_during_capture_refuses(self):
        # A fresh sidecar appearing during a copy must be caught even if the
        # main file bytes stayed identical. No SQLite opens on originals.
        self.db.close(); self.db = sqlite3.connect(self.database)
        # Closed last WAL connection removed sidecars on this fixture only.
        wal = pathlib.Path(str(self.database) + '-wal')
        def change():
            if not wal.exists(): wal.write_bytes(b'new sidecar')
        self.guard.check.side_effect = change
        with self.assertRaisesRegex(RuntimeError, 'changed during copy'):
            deploy.copy_triple(self.database, self.root / 'raw', self.guard)


class WalEntryTests(unittest.TestCase):
    def setUp(self):
        self.manifest = {'walRecovery': wal_recovery_binding()}
        self.live = {'Id': 'a' * 64, 'Image': LIVE_IMAGE, 'RestartCount': 0,
            'State': {'Running': False, 'ExitCode': 137, 'OOMKilled': False}}
        self.triple = {suffix: {**row, 'inode': 42, 'device': 7, 'mtimeNs': 12, 'mode': 0o666}
            for suffix, row in HELD_TRIPLE.items()}

    def test_exact_held_and_running_entry_states(self):
        entry = deploy.select_entry_state(self.live, HELD_INGRESS_SHA, self.triple, self.manifest)
        self.assertEqual(entry['mode'], 'STOPPED_HELD')
        self.live['State']['Running'] = True
        self.assertEqual(deploy.select_entry_state(self.live, ORIGINAL_INGRESS_SHA, None,
            self.manifest)['mode'], 'RUNNING_NORMAL')

    def test_wrong_entry_and_held_triple_hash_refuse(self):
        with self.assertRaises(RuntimeError):
            deploy.select_entry_state(self.live, ORIGINAL_INGRESS_SHA, self.triple, self.manifest)
        self.triple['-wal']['sha256'] = '0' * 64
        with self.assertRaises(RuntimeError):
            deploy.select_entry_state(self.live, HELD_INGRESS_SHA, self.triple, self.manifest)
        self.triple['-wal']['sha256'] = HELD_TRIPLE['-wal']['sha256']
        for key, value in [('ExitCode', 0), ('OOMKilled', True), ('Running', True)]:
            old = self.live['State'][key]; self.live['State'][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                deploy.select_entry_state(self.live, HELD_INGRESS_SHA, self.triple, self.manifest)
            self.live['State'][key] = old

    def test_held_path_never_stops_the_original_twice(self):
        raw = getattr(deploy, '__raw_source__', None) or pathlib.Path(deploy.__file__).read_bytes()
        tree = ast.parse(raw)
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and
            isinstance(node.func, ast.Attribute) and node.func.attr == 'command' and
            len(node.args) > 1 and isinstance(node.args[1], ast.List)]
        original_stops = [node for node in calls if all(isinstance(value, ast.Constant) for value in node.args[1].elts) and
            ast.literal_eval(node.args[1]) ==
            ['docker', 'stop', '-t', '30', 'soilfer-lims']]
        # The normal path is conditional; the failure handler only stops a
        # running original, so the already-stopped held path never stops it.
        parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
        for call in original_stops:
            condition = parents[parents[call]]
            self.assertIsInstance(condition, ast.If)
            text = ast.unparse(condition.test)
            self.assertTrue("'RUNNING_NORMAL'" in text or "['Running']" in text)


if __name__ == '__main__': unittest.main()
