"""Failure-boundary checks for the manual wrapper; no Docker/host operations."""
import importlib.util
import copy
import json
from pathlib import Path
import sys
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('step_c_wrapper', sys.argv.pop(1))
wrapper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wrapper)

class Boundaries(unittest.TestCase):
    def recovery_case(self, kind, free_bytes=20000000000):
        with tempfile.TemporaryDirectory(prefix='lims-424c-rehearsal-') as directory:
            root = Path(directory).resolve(); data = root / 'app-data-fixture'; data.mkdir()
            (root / 'owned-copy-marker.json').write_text(json.dumps({'task': 'issue424-stepC-owned-local-rehearsal', 'token': 'fixture-owner'}))
            database = data / 'dev.db'; database.write_bytes(b'owned-unmodified-fixture')
            script = root / 'manual.js'; script.write_text('// fixture')
            evidence = root / 'wrapper-result'; events = []
            mount = dict(Type='bind', Source=str(data), Destination='/app/server/prisma', RW=True)
            config = {'Labels': {'issue424c-owner': 'fixture-owner'}}
            class FixtureDocker:
                app_running = True
                helper_running = False
                def __init__(self, _context): pass
                def command(self, *args, **_options):
                    if args == ('context', 'inspect'): return json.dumps([{'Endpoints': {'docker': {'Host': 'unix:///var/run/docker.sock'}}}]).encode()
                    if args[0] == 'create': return b'helper\n'
                    if args[0] in ['start', 'stop']:
                        events.append(args)
                        setattr(self, 'app_running' if args[1] == 'app' else 'helper_running', args[0] == 'start')
                        return (args[1]+'\n').encode()
                    raise AssertionError('Unexpected container action')
                def inspect(self, container):
                    if container == 'helper': return {'State': {'Running': self.helper_running}}
                    return {'Id': 'app', 'Image': 'same-image', 'Config': copy.deepcopy(config), 'HostConfig': {'Memory': 805306368},
                            'Mounts': [copy.deepcopy(mount)], 'RestartCount': 0,
                            'State': {'Running': self.app_running, 'Health': {'Status': 'healthy'}, 'OOMKilled': False, 'StartedAt': 'fixture'}}
                def writers(self, _mount): return (['app'] if self.app_running else []) + (['helper'] if self.helper_running else [])
                def node(self, container, code, _value=None):
                    if 'fetch(' in code: return {'httpStatus': 200, 'status': 'ok', 'version': '1.16.0'}
                    if 'paths=[' in code: return {'source': 'same-source', 'help': 'same-help'}
                    return {'sha256': wrapper.sha_file(script if container == 'helper' else database)}
                def result(self, *args, **_options):
                    apply = '--apply' in args
                    events.append(('apply' if apply else 'dry',))
                    if kind == 'tampered' and not apply: database.write_bytes(b'changed-without-approval')
                    value = dict(ok=not apply, mode='APPLY' if apply else 'DRY_RUN', plannedChanges=18, planSha256='approved-plan',
                                 totalChanges=0, auditRowsCreated=0, sqliteTotalChanges=0, integrityCheck='ok', foreignKeyCheckRows=0)
                    return subprocess.CompletedProcess(args, 1 if apply else 0, json.dumps(value).encode(), b'')
            argv = ['--mode', 'rehearsal', '--container', 'app', '--database-directory', str(data), '--script', str(script),
                    '--root', str(evidence), '--expected-script-sha256', wrapper.sha_file(script),
                    '--expected-plan-sha256', 'approved-plan' if kind == 'apply-called' else 'wrong-plan',
                    '--expected-changes', '18', '--scope-token', 'fixture-owner', '--startup-timeout', '2']
            with patch.object(wrapper, 'Docker', FixtureDocker), patch.object(wrapper.shutil, 'disk_usage', return_value=SimpleNamespace(free=free_bytes)):
                with self.assertRaises(wrapper.Stopped): wrapper.run(wrapper.parser().parse_args(argv))
            return json.loads((evidence / 'failure.json').read_text()), events, database.read_bytes()

    def test_wrong_plan_refuses_without_apply_and_restarts_only_the_same_unchanged_app(self):
        failure, events, data = self.recovery_case('wrong-plan')
        self.assertTrue(failure['restartedUnchanged'])
        self.assertEqual(failure['partial']['scriptApplyCalls'], 0)
        self.assertEqual(failure['unchangedRestart']['health']['version'], '1.16.0')
        self.assertTrue(failure['unchangedRestart']['databaseFilesEqualStoppedBackupBeforeRestart'])
        self.assertEqual(data, b'owned-unmodified-fixture')
        self.assertNotIn(('apply',), events)
        self.assertEqual(events.count(('start', 'app')), 1)

    def test_space_gate_is_strict_and_does_not_stop_the_app_at_exactly_ten_gb(self):
        failure, events, _data = self.recovery_case('wrong-plan', 10000000000)
        self.assertEqual(failure['error'], 'STRICT_GREATER_THAN_10GB_GATE_FAILED')
        self.assertNotIn(('stop', 'app'), events)
        recovered, _events, _data = self.recovery_case('wrong-plan', 10000000001)
        self.assertTrue(recovered['restartedUnchanged'])

    def test_changed_database_prevents_automatic_restart_even_without_apply(self):
        failure, events, data = self.recovery_case('tampered')
        self.assertFalse(failure['restartedUnchanged'])
        self.assertEqual(failure['unchangedRestartRefused'], 'DATABASE_FILES_DIFFER_FROM_STOPPED_BACKUP')
        self.assertEqual(failure['partial']['scriptApplyCalls'], 0)
        self.assertNotIn(('start', 'app'), events)
        self.assertEqual(data, b'changed-without-approval')

    def test_any_apply_call_prevents_automatic_restart_even_if_it_reports_zero_changes(self):
        failure, events, data = self.recovery_case('apply-called')
        self.assertFalse(failure['restartedUnchanged'])
        self.assertEqual(failure['unchangedRestartRefused'], 'APPLY_ALREADY_CALLED')
        self.assertEqual(failure['partial']['scriptApplyCalls'], 1)
        self.assertNotIn(('start', 'app'), events)
        self.assertEqual(data, b'owned-unmodified-fixture')

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
