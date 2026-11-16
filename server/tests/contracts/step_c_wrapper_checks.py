"""Failure-boundary checks for the manual wrapper; no Docker/host operations."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('step_c_wrapper', sys.argv.pop(1))
wrapper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wrapper)

class Boundaries(unittest.TestCase):
    def test_writer_detection_covers_bind_sources_named_volumes_and_overlapping_binds(self):
        expected = dict(Type='bind', Source='/host/data', Destination='/app/prisma', RW=True)
        for source in ['/host/data', '/host', '/host/data/child', '/']:
            self.assertTrue(wrapper.writable_mount_overlaps(dict(Source=source, RW=True), expected))
        for mount in [dict(Source='/host/data', RW=False), dict(Source='/host/data-other', RW=True), dict(Source='/other', RW=True)]:
            self.assertFalse(wrapper.writable_mount_overlaps(mount, expected))
        self.assertTrue(wrapper.writable_mount_overlaps(dict(Name='owned-data', Source='/engine/alias', RW=True), dict(Name='owned-data', Source='/engine/data')))
        class MetadataOnlyDocker(wrapper.Docker):
            def command(self, *args):
                if args == ('ps', '--no-trunc', '-q'): return b'owned\nreader\nparent\nunrelated\n'
                mounts = {'owned': [expected], 'reader': [dict(expected, RW=False)],
                          'parent': [dict(Source='/host', RW=True)], 'unrelated': [dict(Source='/other', RW=True)]}
                if args[:3] != ('inspect', '--format', '{{json .Mounts}}'): raise AssertionError('Unexpected Docker action')
                return json.dumps(mounts[args[3]]).encode()
        self.assertEqual(MetadataOnlyDocker('').writers(expected), ['owned', 'parent'])

    def test_mount_order_does_not_change_full_mount_identity(self):
        mounts = [dict(Type='volume', Name='assets', Source='/var/assets', Destination='/app/assets', RW=True, Driver='local'),
                  dict(Type='bind', Source='/tmp/data', Destination='/app/prisma', RW=True, Propagation='rprivate')]
        normalized = wrapper.normalized_mounts(mounts)
        self.assertTrue(wrapper.exact(normalized, wrapper.normalized_mounts(list(reversed(mounts)))))
        self.assertEqual(mounts[0]['Name'], 'assets')
        for key, value in [('RW', False), ('Source', '/tmp/other'), ('Type', 'volume'), ('Propagation', 'shared')]:
            changed = [dict(row) for row in mounts]
            changed[1][key] = value
            self.assertFalse(wrapper.exact(normalized, wrapper.normalized_mounts(changed)))
        with self.assertRaises(wrapper.Stopped): wrapper.normalized_mounts([mounts[0], mounts[0]])

    def test_rehearsal_scope_requires_owned_marker_and_separate_app_copy(self):
        with tempfile.TemporaryDirectory(prefix='lims-424c-rehearsal-') as directory:
            root = Path(directory).resolve()
            marker = root / 'owned-copy-marker.json'
            marker.write_text(json.dumps({'task': 'issue424-stepC-owned-local-rehearsal', 'token': 'fixture-owner'}))
            data = root / 'app-data-fixture'; data.mkdir()
            self.assertEqual(wrapper.own_scope(data, 'fixture-owner'), root)
            for candidate, token in [(root, 'fixture-owner'), (data, 'other-owner'), (root / 'master', 'fixture-owner')]:
                with self.assertRaises(wrapper.Stopped): wrapper.own_scope(candidate, token)

    def test_production_refuses_missing_or_incomplete_post_audit_binding_before_any_mutation(self):
        operations = []
        class ReadOnlyContext:
            def __init__(self, _context): pass
            def command(self, *args):
                operations.append(args)
                if args != ('context', 'inspect'): raise AssertionError('No container action is authorized')
                return json.dumps([{'Endpoints': {'docker': {'Host': 'unix:///var/run/docker.sock'}}}]).encode()
        with tempfile.TemporaryDirectory(prefix='step-c-boundary-') as directory:
            root = Path(directory); data = root / 'data'; data.mkdir()
            script = root / 'manual.js'; script.write_text('// fixture')
            evidence = root / 'evidence'
            argv = ['--mode', 'production', '--container', 'never-contacted', '--database-directory', str(data),
                    '--script', str(script), '--root', str(evidence), '--expected-script-sha256', wrapper.sha_file(script),
                    '--expected-plan-sha256', 'reviewed-plan', '--expected-changes', '18']
            with patch.object(wrapper, 'Docker', ReadOnlyContext):
                with self.assertRaises(wrapper.Stopped) as absent: wrapper.run(wrapper.parser().parse_args(argv))
                self.assertEqual(absent.exception.code, 'PRODUCTION_REQUIRES_SEPARATE_POST_AUDIT_APPROVAL')
                authorization = root / 'approval.json'
                value = dict(issue=424, step='C', productionRunApproved=True, auditedScriptSha256=wrapper.sha_file(script),
                             reviewedPlanSha256='reviewed-plan', yyApprovalReference='fixture-only', reviewedChanges=18)
                authorization.write_text(json.dumps(value))
                with self.assertRaises(wrapper.Stopped) as unbound: wrapper.run(wrapper.parser().parse_args(argv + ['--authorization', str(authorization)]))
                self.assertEqual(unbound.exception.code, 'PRODUCTION_APPROVAL_BINDING_MISMATCH')
                value['auditedWrapperSha256'] = wrapper.sha_file(wrapper.__file__)
                value['reviewedChanges'] = 19
                authorization.write_text(json.dumps(value))
                with self.assertRaises(wrapper.Stopped): wrapper.run(wrapper.parser().parse_args(argv + ['--authorization', str(authorization)]))
            self.assertFalse(evidence.exists())
            self.assertEqual(operations, [('context', 'inspect')] * 3)

    def test_projected_record_keeps_producer_hashes_without_reserializing_database_fields(self):
        value = dict(records=[dict(kind='package', table='AnalysisGroup', target='BASIC_FERTILITY', state='changed',
                                  beforeRowSha256='producer-before', afterRowSha256='producer-after',
                                  before={'price': 1.0}, after={'price': 1})], availabilityBefore=[{'code': 'porosity'}], availabilityAfter=[{'code': 'porosity'}])
        projected = wrapper.projected_receipt(value)
        self.assertEqual(projected['records'][0]['beforeRowSha256'], 'producer-before')
        self.assertEqual(projected['records'][0]['afterRowSha256'], 'producer-after')
        self.assertNotIn('before', projected['records'][0])
        self.assertNotIn('after', projected['records'][0])
        self.assertEqual(projected['availabilityBefore'], projected['availabilityAfter'])

if __name__ == '__main__': unittest.main()
