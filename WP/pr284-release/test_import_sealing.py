"""Read-only physical seal guards over owned temporary database triples only."""
import contextlib
import pathlib
import shutil
import sqlite3
import unittest
from unittest.mock import patch

import import_sealing as seal
import test_import_preservation as pairs


class SealingGuards(unittest.TestCase):
    def setUp(self):
        self.pair = pairs.ImportPreservationGuards()
        self.pair.setUp()
        self.addCleanup(self.pair.tearDown)
        self.root = self.pair.root
        for path in [self.pair.before, self.pair.after]:
            with contextlib.closing(sqlite3.connect(path)) as db:
                db.execute('DROP TABLE owned_98')
                db.execute('CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY)')
                db.commit()
        self.target = self.root / 'owned-original.db'
        shutil.copyfile(self.pair.before, self.target)
        self.guard = type('OwnedGuard', (), {'check': lambda self: None})()
        original_snapshot, original_backup = seal.s.snapshot, seal.s.consistent_backup
        self.opened = []

        def snapshot(path, *args, **kwargs):
            self.assertNotEqual(pathlib.Path(path).resolve(), self.target.resolve())
            self.opened.append(pathlib.Path(path))
            return original_snapshot(path, *args, **kwargs)

        def backup(source, target, *args, **kwargs):
            self.assertNotEqual(pathlib.Path(source).resolve(), self.target.resolve())
            return original_backup(source, target, *args, **kwargs)

        for mocked in [patch.object(seal.s, 'snapshot', side_effect=snapshot),
                       patch.object(seal.s, 'consistent_backup', side_effect=backup)]:
            mocked.start()
            self.addCleanup(mocked.stop)

    def test_original_physical_triple_unchanged_with_detached_full_state(self):
        before = seal.triple_state(self.target)
        state, evidence = seal.sealed_stopped_state(self.root, 'before', self.target, self.guard)
        self.assertEqual(seal.triple_state(self.target), before)
        self.assertEqual((len(state['tables']), state['tables']['_schema_migrations']['count']), (104, 38))
        self.assertEqual(evidence['physical'], seal.s.physical(self.target))
        self.assertTrue(evidence['countsIncludeWal'])
        self.assertTrue(all(path.is_relative_to(self.root / 'before') for path in self.opened))

    def test_installed_seal_requires_exact_106_tables_39_receipts(self):
        shutil.copyfile(self.pair.after, self.target)
        state, evidence = seal.sealed_stopped_state(self.root, 'installed', self.target, self.guard, installed=True)
        self.assertEqual((len(state['tables']), evidence['protectedReceiptCount']), (106, 39))

    def test_committed_owned_wal_is_folded_only_on_copies(self):
        # An owned producer leaves a stable committed WAL for this fixture.
        # No production writer or file is accessed by this test.
        with contextlib.closing(sqlite3.connect(self.target)) as producer:
            self.assertEqual(producer.execute('PRAGMA journal_mode=WAL').fetchone()[0], 'wal')
            producer.execute("INSERT INTO owned_1(id,value) VALUES ('wal-only','owned-committed')")
            producer.commit()
            before = seal.triple_state(self.target)
            self.assertGreater(before['-wal']['bytes'], 0)
            state, evidence = seal.sealed_stopped_state(self.root, 'with-wal', self.target, self.guard)
            self.assertEqual(state['tables']['owned_1']['count'], 2)
            self.assertEqual(seal.triple_state(self.target), before)
            self.assertEqual(evidence['originalFiles'], before)

    def test_wrong_baseline_holds_and_retains_copies(self):
        before = seal.triple_state(self.target)
        with self.assertRaisesRegex(RuntimeError, 'baseline differs'):
            seal.sealed_stopped_state(self.root, 'wrong-baseline', self.target, self.guard, installed=True)
        self.assertEqual(seal.triple_state(self.target), before)
        self.assertTrue((self.root / 'wrong-baseline/raw/dev.db').is_file())

    def test_second_seal_cannot_overwrite_retained_destination(self):
        seal.sealed_stopped_state(self.root, 'one', self.target, self.guard)
        with self.assertRaises(FileExistsError):
            seal.sealed_stopped_state(self.root, 'one', self.target, self.guard)

    def test_complete_expected_state_change_refuses(self):
        state, _ = seal.sealed_stopped_state(self.root, 'first', self.target, self.guard)
        with contextlib.closing(sqlite3.connect(self.target)) as db:
            db.execute("UPDATE owned_0 SET value='owned-changed'")
            db.commit()
        with self.assertRaisesRegex(RuntimeError, 'Complete WAL-aware logical state changed'):
            seal.sealed_stopped_state(self.root, 'changed', self.target, self.guard, expected=state)

    def test_path_escape_label_refuses_without_copy(self):
        with self.assertRaisesRegex(RuntimeError, 'safe stopped seal'):
            seal.sealed_stopped_state(self.root, '../escape', self.target, self.guard)

    def test_missing_original_main_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'main database is missing'):
            seal.triple_state(self.root / 'missing.db')

    def test_only_import_tables_may_appear_in_folded_wal(self):
        original = {'tables': {'owned': {'count': 1}}}
        for extra in ['unapproved', 'Sample']:
            with self.assertRaisesRegex(RuntimeError, 'table/count authority differs'):
                seal.logical_count_guard(original, {'tables': dict(original['tables'], **{extra: {'count': 0}})})
        seal.logical_count_guard(original, {'tables': dict(original['tables'], ImportTemplate={'count': 0}, InstrumentImportReceipt={'count': 0})})

    def test_folded_original_count_drop_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'table/count authority differs'):
            seal.logical_count_guard({'tables': {'owned': {'count': 2}}}, {'tables': {'owned': {'count': 1}}})


if __name__ == '__main__':
    unittest.main(verbosity=2)
