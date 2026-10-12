"""Owned temporary SQLite pairs only; never Docker or a production path."""
import hashlib
from contextlib import closing
import json
import os
import pathlib
import shutil
import sqlite3
import stat
import types
import unittest
from unittest.mock import patch

import import_stage as stage
import test_import_preservation as pairs
from test_import_installation import IMAGE, applied, plan


class StageGuards(unittest.TestCase):
    def setUp(self):
        self.pair = pairs.ImportPreservationGuards()
        self.pair.setUp()
        self.addCleanup(self.pair.tearDown)
        self.root = self.pair.root
        self.target_dir = self.root / 'owned-target'
        self.target_dir.mkdir()
        self.target = self.target_dir / 'dev.db'
        shutil.copyfile(self.pair.before, self.target)
        self.pair.before.chmod(0o400)
        self.calls = []
        self.behavior = {}
        self.snapshots = []
        self.checks = 0
        self.support = types.SimpleNamespace(sha=self.sha, physical=self.physical, snapshot=self.snapshot,
            LIVE=self.root / 'unrelated-live' / 'dev.db')
        self.guard = types.SimpleNamespace(check=self.check)
        # Windows exposes read-only files as 0444, not POSIX owner-only 0400.
        # Normalize ONLY this owned synthetic harness; Linux uses actual modes.
        if os.name == 'nt':
            native = stat.S_IMODE
            mode = patch.object(stage.stat, 'S_IMODE', side_effect=lambda value:
                0o400 if native(value) == 0o444 else native(value))
            mode.start()
            self.addCleanup(mode.stop)
        mocked = patch.object(stage, 'measured_cli', side_effect=self.cli)
        mocked.start()
        self.addCleanup(mocked.stop)

    def sha(self, path):
        return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()

    def physical(self, path):
        return {suffix: {'sha256': self.sha(file), 'bytes': file.stat().st_size} if file.exists() else None
            for suffix in ['', '-wal', '-shm'] for file in [pathlib.Path(str(path) + suffix)]}

    def snapshot(self, path, immutable=False):
        self.assertTrue(immutable)
        self.assertNotEqual(pathlib.Path(path).resolve(), self.target.resolve(),
            'No SQLite connection to original target is permitted')
        self.snapshots.append(pathlib.Path(path))
        with closing(sqlite3.connect('file:' + str(path) + '?mode=ro&immutable=1', uri=True)) as db:
            tables = {row[0]: {} for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
            tables['_schema_migrations']['count'] = db.execute('SELECT count(*) FROM _schema_migrations').fetchone()[0]
            return {'tables': tables, 'integrity': db.execute('PRAGMA integrity_check').fetchone()[0],
                'foreignKeyViolations': len(db.execute('PRAGMA foreign_key_check').fetchall())}

    def check(self):
        self.checks += 1
        if self.behavior.get('guard_failure') == self.checks:
            raise RuntimeError('Owned disk refusal')

    def cli(self, root, image, directory, mode, label, support):
        expected_dir = self.root / 'import-dry-database' if label == 'import-dry' else self.target_dir
        self.assertEqual((root, image, directory, support), (self.root, IMAGE, expected_dir, self.support))
        self.calls.append(label)
        if self.behavior.get('fail') == label:
            raise RuntimeError('Owned CLI failure')
        if label == 'import-dry':
            value = plan()
        elif label == 'import-apply':
            shutil.copyfile(self.pair.after, self.target)
            value = applied()
            value['receipt']['originalRowsSha256'] = pairs.ORIGINAL_HASH
        else:
            value = dict(plan(), classification='COMPLETE_200', mode='NO_OP')
        if self.behavior.get('write') == label:
            with self.target.open('ab') as stream:
                stream.write(b'owned-unapproved-write')
        if self.behavior.get('dry_copy_write') and label == 'import-dry':
            with (directory / 'dev.db').open('ab') as stream: stream.write(b'unapproved-dry-copy-write')
        if self.behavior.get('wrong_plan') == label:
            value['totalChanges'] = 2
        return value, {'ownedSyntheticMeasurement': True, 'label': label}

    def seal(self, label, installed):
        self.assertEqual((label, installed), ('after-import-stopped', True))
        if self.behavior.get('wrong_original'):
            with closing(sqlite3.connect(self.target)) as db:
                db.execute("UPDATE owned_0 SET value='changed'")
                db.commit()
        path = self.root / 'after-import-stopped.db'
        shutil.copyfile(self.target, path)
        path.chmod(0o400)
        if self.behavior.get('reuse_backup'):
            path = self.pair.before
        return {'backupPath': str(path), 'physical': self.physical(self.target)}

    def run_stage(self, **changes):
        args = dict(root=self.root, image=IMAGE, database_dir=self.target_dir,
            before_backup=self.pair.before, before_physical=self.physical(self.target),
            source_directory=pairs.ASSET_ROOT, guard=self.guard, support=self.support, seal=self.seal)
        return stage.install_once(**dict(args, **changes))

    def test_exact_stage_passes_without_connecting_original_target(self):
        before = self.sha(self.pair.before)
        result, state = self.run_stage()
        self.assertEqual(result['status'], 'EXACT_NATIVE_IMPORT_DRY_APPLY_REPEAT_PASS')
        self.assertEqual(self.calls, ['import-dry', 'import-apply', 'import-repeat'])
        self.assertEqual((len(state['tables']), state['tables']['_schema_migrations']['count']), (106, 39))
        self.assertEqual(self.sha(self.pair.before), before)
        self.assertTrue(result['allOriginalRowsAndSchemaPreserved'])
        self.assertTrue(result['dryRunCopy']['targetPhysicalTriplePreserved'])
        self.assertEqual(result['dryRunCopy']['mainSha256'], before)
        self.assertEqual(json.loads((self.root / 'instrument-import-attempt.json').read_text())['status'], 'ATTEMPTED_FORWARD_ONLY')

    def test_second_invocation_never_calls_an_installer(self):
        self.run_stage()
        self.calls.clear()
        with self.assertRaisesRegex(RuntimeError, 'single-use'):
            self.run_stage()
        self.assertEqual(self.calls, [])

    def test_dry_physical_write_refuses_before_apply(self):
        self.behavior['write'] = 'import-dry'
        with self.assertRaisesRegex(RuntimeError, 'Dry-run changed'):
            self.run_stage()
        self.assertEqual(self.calls, ['import-dry'])

    def test_bad_dry_plan_refuses_before_apply(self):
        self.behavior['wrong_plan'] = 'import-dry'
        with self.assertRaises(RuntimeError):
            self.run_stage()
        self.assertEqual(self.calls, ['import-dry'])

    def test_apply_failure_holds_without_repeat_or_retry(self):
        self.behavior['fail'] = 'import-apply'
        with self.assertRaisesRegex(RuntimeError, 'Owned CLI failure'):
            self.run_stage()
        self.assertEqual(self.calls, ['import-dry', 'import-apply'])
        with self.assertRaisesRegex(RuntimeError, 'single-use'):
            self.run_stage()

    def test_old_row_mutation_refuses_before_repeat(self):
        self.behavior['wrong_original'] = True
        with self.assertRaisesRegex(RuntimeError, 'Original rows changed'):
            self.run_stage()
        self.assertEqual(self.calls, ['import-dry', 'import-apply'])

    def test_repeat_byte_change_refuses(self):
        self.behavior['write'] = 'import-repeat'
        with self.assertRaisesRegex(RuntimeError, 'Immediate repeat changed'):
            self.run_stage()

    def test_post_backup_cannot_reuse_original(self):
        self.behavior['reuse_backup'] = True
        with self.assertRaisesRegex(RuntimeError, 'overwrites the original'):
            self.run_stage()
        self.assertNotIn('import-repeat', self.calls)

    def test_preflight_physical_mismatch_refuses_without_attempt(self):
        with self.assertRaisesRegex(RuntimeError, 'physical triple differs'):
            self.run_stage(before_physical={})
        self.assertEqual(self.calls, [])
        self.assertFalse((self.root / 'instrument-import-attempt.json').exists())

    def test_proof_refuses_live_parent_before_any_copy_or_marker(self):
        self.support.LIVE = self.target
        with self.assertRaisesRegex(RuntimeError, 'live database parent'):
            self.run_stage()
        self.assertEqual(self.calls, [])
        self.assertFalse((self.root / 'import-dry-database').exists())
        self.assertFalse((self.root / 'instrument-import-attempt.json').exists())

    def test_dry_copy_mutation_refuses_before_apply(self):
        self.behavior['dry_copy_write'] = True
        with self.assertRaisesRegex(RuntimeError, 'separate immutable main copy'):
            self.run_stage()
        self.assertEqual(self.calls, ['import-dry'])

    def test_preflight_disk_refuses_without_attempt(self):
        self.behavior['guard_failure'] = 1
        with self.assertRaisesRegex(RuntimeError, 'Owned disk refusal'):
            self.run_stage()
        self.assertEqual(self.calls, [])
        self.assertFalse((self.root / 'instrument-import-attempt.json').exists())

    def test_wrong_assets_refuse_before_any_cli(self):
        wrong = self.root / 'wrong-assets'
        wrong.mkdir()
        with self.assertRaises((RuntimeError, OSError)):
            self.run_stage(source_directory=wrong)
        self.assertEqual(self.calls, [])

    def test_nonimmutable_backup_refuses_before_any_cli(self):
        self.pair.before.chmod(0o600)
        with self.assertRaisesRegex(RuntimeError, 'immutable backup'):
            self.run_stage()
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
