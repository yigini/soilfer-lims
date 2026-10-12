"""Pure closed CLI/plan guards. Never run Docker or an installer here."""
import copy
import hashlib
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

import import_installation as install

IMAGE = 'sha256:' + 'a' * 64


def plan():
    return {'classification': 'PRE_200', 'mode': 'DRY_RUN', 'sources': install.SOURCES,
        'counts': {'templates': 0, 'receipts': 0, 'draftLinks': 0},
        'newTemplateCount': 0, 'newReceiptCount': 0, 'backfilledCount': 0, 'totalChanges': 0}


def applied():
    return dict(plan(), classification='COMPLETE_200', previousClassification='PRE_200', mode='APPLIED',
        totalChanges=1, receipt={'sources': install.SOURCES, 'originalRowsPreserved': True,
            'originalRowsSha256': 'b' * 64})


class InstallationGuards(unittest.TestCase):
    def test_exact_dry_and_repeat_pass(self):
        self.assertEqual(install.validate_plan(plan(), 'PRE_200', 'DRY_RUN')['sources'], install.SOURCES)
        repeat = dict(plan(), classification='COMPLETE_200', mode='NO_OP')
        self.assertEqual(install.validate_plan(repeat, 'COMPLETE_200', 'NO_OP')['classification'], 'COMPLETE_200')

    def test_exact_native_apply_pass(self):
        self.assertEqual(install.validate_apply(applied()), 'b' * 64)

    def test_dry_any_write_refuses(self):
        for key in ['newTemplateCount', 'newReceiptCount', 'backfilledCount', 'totalChanges']:
            for wrong in [1, False, '0', None]:
                value = dict(plan(), **{key: wrong})
                with self.assertRaises(RuntimeError):
                    install.validate_plan(value, 'PRE_200', 'DRY_RUN')

    def test_apply_must_have_exactly_one_receipt_write(self):
        for wrong in [0, 2, True, '1']:
            with self.assertRaises(RuntimeError):
                install.validate_apply(dict(applied(), totalChanges=wrong))

    def test_apply_refuses_backfill(self):
        with self.assertRaises(RuntimeError):
            install.validate_apply(dict(applied(), backfilledCount=1))

    def test_noop_is_not_apply(self):
        with self.assertRaises(RuntimeError):
            install.validate_apply(dict(applied(), mode='NO_OP'))

    def test_wrong_source_refuses(self):
        with self.assertRaises(RuntimeError):
            install.validate_apply(dict(applied(), sources=dict(install.SOURCES, migrationSha256='c' * 64)))

    def test_wrong_predecessor_refuses(self):
        with self.assertRaises(RuntimeError):
            install.validate_apply(dict(applied(), previousClassification='FRESH_PRISMA'))

    def test_population_or_boolean_counts_refuse(self):
        for wrong in [1, False, '0', None]:
            value = copy.deepcopy(applied())
            value['counts']['draftLinks'] = wrong
            with self.assertRaises(RuntimeError):
                install.validate_apply(value)

    def test_missing_or_extra_count_refuses(self):
        for counts in [{}, dict(plan()['counts'], extra=0)]:
            with self.assertRaises(RuntimeError):
                install.validate_apply(dict(applied(), counts=counts))

    def test_original_hash_required(self):
        value = copy.deepcopy(applied())
        value['receipt']['originalRowsSha256'] = ''
        with self.assertRaises(RuntimeError):
            install.validate_apply(value)

    def test_preservation_false_refuses(self):
        value = copy.deepcopy(applied())
        value['receipt']['originalRowsPreserved'] = False
        with self.assertRaises(RuntimeError):
            install.validate_apply(value)

    def test_only_pinned_instrument_import_script_and_no_cleanup(self):
        name, owner, args = install.arguments('/owned/release', IMAGE, '/owned/release/database', '--apply', 'one-apply', '/live')
        self.assertTrue(name.startswith('lims-owned-import-cli-'))
        self.assertIn('/app/server/scripts/install_instrument_imports.js', args)
        self.assertIn('--network', args)
        self.assertIn('none', args)
        self.assertIn('NODE_OPTIONS=', args)
        self.assertIn('768m', args)
        self.assertEqual(args.count('--apply'), 1)
        self.assertEqual(args[-1], '--apply')
        self.assertTrue(all(value not in args for value in ['--rm', '--force', 'prune', 'restore']))

    def test_dry_mount_is_only_separate_copy_with_writable_sidecars(self):
        args = install.arguments('/owned/release', IMAGE, '/owned/release/import-dry-database', '--dry-run', 'one-dry', '/live')[2]
        mount = args[args.index('--mount') + 1]
        self.assertIn('src=' + str(pathlib.Path('/owned/release/import-dry-database').resolve()), mount)
        self.assertFalse(mount.endswith(',readonly'))
        self.assertEqual(args[args.index('--memory-swap') + 1], '768m')

    def test_dry_refuses_apply_target_and_live_volume(self):
        for directory in ['/live', '/owned/release/database']:
            with self.assertRaisesRegex(RuntimeError, 'separate owned'):
                install.arguments('/owned/release', IMAGE, directory, '--dry-run', 'one-dry', '/live')

    def test_live_volume_identity_is_exact(self):
        args = install.arguments('/owned/release', IMAGE, '/live', '--apply', 'one-apply', '/live')[2]
        self.assertEqual(args[args.index('--mount') + 1], 'type=volume,src=lims_lims-data,dst=/app/server/prisma')

    def test_tag_or_partial_digest_refuses(self):
        for wrong in ['soilfer-lims:latest', 'sha256:abc', 'sha256:' + 'A' * 64]:
            with self.assertRaises(RuntimeError):
                install.arguments('/owned/release', wrong, '/owned/database', '--apply', 'one-apply', '/live')

    def test_other_cli_modes_refuse(self):
        for wrong in ['--restore', '--retry', '--dry-run --apply', '']:
            with self.assertRaises(RuntimeError):
                install.arguments('/owned/release', IMAGE, '/owned/database', wrong, 'one-apply', '/live')

    def test_path_or_shell_labels_refuse(self):
        for wrong in ['../escape', 'one;two', 'one two', '']:
            with self.assertRaises(RuntimeError):
                install.arguments('/owned/release', IMAGE, '/owned/database', '--apply', wrong, '/live')

    def test_measured_cli_retains_hashes_of_original_separate_output_files(self):
        with tempfile.TemporaryDirectory(prefix='owned-cli-outputs-') as directory:
            root = pathlib.Path(directory)
            peak = {'releaseCliPeakBytes': 300000000, 'childStatus': 0, 'childSignal': None}
            calls = []
            def command(where, args, label, **kwargs):
                calls.append(args)
                if args[:2] == ['docker', 'inspect']:
                    name, owner, _ = install.arguments(root, IMAGE, root / 'import-dry-database', '--dry-run', 'import-dry', '/live')
                    value = [{'Image': IMAGE, 'RestartCount': 0,
                        'State': {'Running': False, 'OOMKilled': False, 'ExitCode': 0},
                        'HostConfig': {'Memory': install.LIMIT, 'MemorySwap': install.LIMIT, 'NetworkMode': 'none'},
                        'Mounts': [{'Destination': '/app/server/prisma', 'Source': str((root / 'import-dry-database').resolve()),
                            'RW': True, 'Type': 'bind'}],
                        'Config': {'Env': ['NODE_OPTIONS='], 'Labels': {'io.soilfer.release-owned': owner}}}]
                    stdout, stderr = json.dumps(value), ''
                else:
                    stdout, stderr = json.dumps(plan()), json.dumps(peak) + '\n'
                for suffix, value in [('stdout', stdout), ('stderr', stderr)]:
                    (where / (label + '.' + suffix)).write_text(value, encoding='utf-8')
                return types.SimpleNamespace(stdout=stdout, stderr=stderr, returncode=0)
            support = types.SimpleNamespace(LIVE=pathlib.Path('/live/dev.db'), command=command,
                sha=lambda path: hashlib.sha256(path.read_bytes()).hexdigest())
            with patch.object(install.time, 'monotonic', side_effect=[100.0, 101.0]):
                result, measurement = install.measured_cli(root, IMAGE, root / 'import-dry-database', '--dry-run', 'import-dry', support)
            self.assertEqual(result, plan())
            self.assertEqual(measurement['retainedArtifacts'], {
                name: support.sha(root / name) for name in ['import-dry.stdout', 'import-dry.stderr']})
            self.assertEqual(json.loads((root / 'import-dry-container.json').read_bytes()), measurement)
            self.assertEqual(len(calls), 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
