"""Production-only path isolation and real install_once on owned local fixtures."""
import hashlib
import json
import pathlib
import shutil
import tempfile
import types
import unittest
from unittest.mock import patch

import import_stage
import production_output_paths as paths
import test_import_stage as stage_guards

FROZEN_FIXTURE_BYTES = None


class OutputPathGuards(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='owned-output-preflight-')
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name)
        self.names = {'import-dry-copy-authority.json', 'import-install-preservation.json',
            'import-repeat-preservation.json', 'installed-protected-state.json'}
        frozen = self.root / paths.FROZEN_DIRECTORY
        frozen.mkdir()
        for name in self.names | {'prepared-manifest.json'}:
            (frozen / name).write_bytes(b'original frozen evidence')

    def test_closed_root_has_no_future_output_even_with_identical_frozen_leaves(self):
        result = paths.require_unused_outputs(self.root, self.names)
        self.assertTrue(result['allProspectiveExecutionOutputsAbsent'])
        spec = paths.namespace_binding(self.names)
        self.assertFalse(set(spec['frozenPaths']) & set(spec['executionFiles']))
        for frozen in spec['frozenPaths']:
            self.assertFalse(paths.output_path_allowed(frozen))

    def test_every_static_output_refuses_before_any_action(self):
        for name in sorted(paths.STATIC_FILES | paths.DIRECTORIES):
            with self.subTest(name=name):
                # The closed top-level check also covers every nested seal/db path.
                top = self.root / name.split('/')[0]
                top.write_bytes(b'occupied output')
                try:
                    with self.assertRaisesRegex(RuntimeError, 'already exists'):
                        paths.require_unused_outputs(self.root, self.names)
                finally:
                    top.unlink()  # Owned synthetic test file only.

    def test_dynamic_unknown_and_hidden_entries_refuse(self):
        for name in ('apache-test-123.stdout', 'health-observation-456.body', 'unknown-output', '.hidden'):
            top = self.root / name
            top.write_bytes(b'owned output')
            try:
                with self.assertRaisesRegex(RuntimeError, 'already exists'):
                    paths.require_unused_outputs(self.root, self.names)
            finally:
                top.unlink()

    def test_single_gate_is_explicit_and_other_outputs_still_refuse(self):
        (self.root / paths.GATE).write_bytes(b'owned gate')
        with self.assertRaises(RuntimeError):
            paths.require_unused_outputs(self.root, self.names)
        paths.require_unused_outputs(self.root, self.names, gate_present=True)
        (self.root / 'execution-attempt.json').write_bytes(b'occupied')
        with self.assertRaises(RuntimeError):
            paths.require_unused_outputs(self.root, self.names, gate_present=True)

    def test_path_traversal_and_frozen_families_are_never_output_paths(self):
        for name in ('../x', '/tmp/x', 'frozen/x', 'frozen/../production-receipt.json',
                'apache-test-x.stdout', 'health-observation-12.body/extra'):
            self.assertFalse(paths.output_path_allowed(name))
        for name in ('apache-test-123.stdout', 'health-observation-456.body', 'after-import-stopped/raw/dev.db'):
            self.assertTrue(paths.output_path_allowed(name))
        for name in (None, 42, False):
            self.assertFalse(paths.output_path_allowed(name))

    def test_prequiesce_recheck_accepts_only_intent_receipt_gate_and_guard_ledger(self):
        for name in ('production-gate.json', 'execution-attempt.json',
                'production-receipt.json', 'disk-allocation-observations.jsonl'):
            (self.root / name).write_bytes(b'owned intent')
        paths.require_prequiesce_outputs(self.root, self.names)
        for name in ('import-dry-copy-authority.json', 'after-import-stopped', 'apache-test-1.stdout'):
            path = self.root / name
            path.write_bytes(b'unexpected output')
            try:
                with self.assertRaisesRegex(RuntimeError, 'appeared before quiesce'):
                    paths.require_prequiesce_outputs(self.root, self.names)
            finally:
                path.unlink()

    def test_namespace_binds_entire_catalog_and_frozen_file_set(self):
        before = paths.namespace_binding(self.names)
        after = paths.namespace_binding(self.names | {'another-source.py'})
        self.assertNotEqual(before['catalogSha256'], after['catalogSha256'])
        for name in ('../outside', 'frozen/source.py', '.', ''):
            with self.assertRaises(RuntimeError):
                paths.namespace_binding({name})


class ProductionInstallNamespaceGuards(unittest.TestCase):
    def test_real_production_true_install_reaches_repeat_preserving_all_62_frozen_files(self):
        harness = stage_guards.StageGuards(methodName='test_exact_stage_passes_without_connecting_original_target')
        harness.setUp()
        self.addCleanup(harness.doCleanups)
        # All data below is owned synthetic SQLite. Nothing connects to a live
        # database or Docker. Keep production=True and the live-parent equality
        # check; translate ONLY the production-root parent to our owned tempdir.
        parent = harness.root
        root = parent / 'instrument-import-release-owned-namespace-test'
        root.mkdir()
        harness.root = root
        backup = root / 'original-stopped-backup.db'
        shutil.copyfile(harness.pair.before, backup)
        backup.chmod(0o400)
        harness.pair.before = backup
        harness.target_dir = root / 'owned-target'
        harness.target_dir.mkdir()
        harness.target = harness.target_dir / 'dev.db'
        shutil.copyfile(backup, harness.target)
        harness.support.LIVE = harness.target
        frozen = root / paths.FROZEN_DIRECTORY
        frozen.mkdir()
        # Byte-for-byte retained historical kit, including every one of its 62
        # frozen names. They do not grant execution authority in this local test.
        kit = pathlib.Path(__file__).resolve().parent.parent / 'pr284-frozen-kit-20261012T161000Z'
        fixture = FROZEN_FIXTURE_BYTES
        if fixture is None:
            if not kit.is_dir():
                raise RuntimeError('Owned end-to-end test requires the retained 62-file kit fixture')
            manifest = json.loads((kit / 'prepared-manifest.json').read_bytes())
            fixture = {name: (kit / name).read_bytes() for name in manifest['files']}
        manifest = {'files': {name: hashlib.sha256(raw).hexdigest() for name, raw in fixture.items()}}
        self.assertEqual(len(manifest['files']), 62)
        for name, digest in manifest['files'].items():
            raw = fixture[name]
            self.assertEqual(hashlib.sha256(raw).hexdigest(), digest)
            (frozen / name).write_bytes(raw)
            (frozen / name).chmod(0o400)
        original = {name: hashlib.sha256((frozen / name).read_bytes()).hexdigest()
            for name in manifest['files']}
        real_path = pathlib.Path
        stage_paths = types.SimpleNamespace(Path=lambda value:
            parent if value == '/opt/lims/releases' else real_path(value))
        with patch.object(import_stage, 'pathlib', stage_paths):
            result, _ = harness.run_stage(source_directory=frozen, production=True)
        self.assertEqual(result['status'], 'EXACT_NATIVE_IMPORT_DRY_APPLY_REPEAT_PASS')
        self.assertEqual(harness.calls, ['import-dry', 'import-apply', 'import-repeat'])
        self.assertTrue(result['allOriginalRowsAndSchemaPreserved'])
        self.assertEqual(result['repeatDatabaseChanges'], 0)
        self.assertTrue((root / 'import-repeat-preservation.json').is_file())
        self.assertEqual(original, {name: hashlib.sha256((frozen / name).read_bytes()).hexdigest()
            for name in manifest['files']})
        self.assertFalse(set(str(path.relative_to(root)).replace('\\', '/')
            for path in root.rglob('*') if path.is_file() and not path.is_relative_to(frozen)) &
            set(paths.namespace_binding(manifest['files'])['frozenPaths']))


if __name__ == '__main__':
    unittest.main()
