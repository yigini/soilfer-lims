"""Pure closed CLI/plan guards. Never run Docker or an installer here."""
import copy
import pathlib
import unittest

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
        name, owner, args = install.arguments('/owned/release', IMAGE, '/owned/database', '--apply', 'one-apply', '/live')
        self.assertTrue(name.startswith('lims-owned-import-cli-'))
        self.assertIn('/app/server/scripts/install_instrument_imports.js', args)
        self.assertIn('--network', args)
        self.assertIn('none', args)
        self.assertIn('NODE_OPTIONS=', args)
        self.assertIn('768m', args)
        self.assertEqual(args.count('--apply'), 1)
        self.assertEqual(args[-1], '--apply')
        self.assertTrue(all(value not in args for value in ['--rm', '--force', 'prune', 'restore']))

    def test_dry_mount_is_readonly(self):
        args = install.arguments('/owned/release', IMAGE, '/owned/database', '--dry-run', 'one-dry', '/live')[2]
        self.assertTrue(args[args.index('--mount') + 1].endswith(',readonly'))

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


if __name__ == '__main__':
    unittest.main(verbosity=2)
