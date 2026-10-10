"""Exercise release abort/recovery and evidence tampering without live I/O."""
import copy, datetime, importlib.util, json, pathlib, sqlite3, subprocess, tempfile, unittest
from unittest.mock import Mock, patch
import release_support as s

spec = importlib.util.spec_from_file_location('coordinator', pathlib.Path(__file__).with_name('release-forward.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class DiskAndPlanGuards(unittest.TestCase):
    def test_floor_scaled_reserve_and_negative_sizes(self):
        self.assertEqual(s.disk_reserve(563322880, 413513955, 2000000), 8589934592)
        self.assertEqual(s.disk_reserve(3000000000, 1000000000, 1), 12000000000)
        with self.assertRaises(AssertionError):
            s.disk_reserve(-1, 1, 1)

    def test_known_backup_allocation_and_unexplained_drop_boundary(self):
        self.assertEqual(s.check_drop({'root':10000000000}, {'root':9000000000}, {'root':563322880}), {'root':436677120})
        self.assertEqual(s.check_drop({'root':10000000000}, {'root':9500000000}, {'root':0}), {'root':500000000})
        with self.assertRaises(AssertionError):
            s.check_drop({'root':10000000000}, {'root':9499999999}, {'root':0})

    def test_unmapped_repeat_and_changed_reviewed_plans_refuse(self):
        ready = {'classification':'PRE_190','mode':'DRY_RUN','totalChanges':0,'plan':{'status':'READY','planSha256':'a'*64}}
        s.verify_attempt_plan(ready, 'a'*64)
        for plan in [{**ready,'plan':{'status':'REFUSED','unmapped':['unknown']}},
                     {**ready,'plan':{'status':'BLOCKED','repeatFamily':['RepeatPending']}},
                     {**ready,'totalChanges':1}]:
            with self.assertRaises(AssertionError):
                s.verify_attempt_plan(plan, 'a'*64)
        with self.assertRaises(AssertionError):
            s.verify_attempt_plan(ready, 'b'*64)

    def test_ready_logs_require_every_installer_in_order(self):
        import json
        lines = [json.dumps({'event':name+'_STARTUP_READY','totalChanges':0}) for name in s.READY_EVENTS]
        self.assertEqual(len(s.ready_logs('\n'.join(lines))),20)
        for changed in [lines[:-1],list(reversed(lines)),lines[:-1]+[json.dumps({'event':'BENCH_CREDENTIAL_STARTUP_READY','totalChanges':1})]]:
            with self.assertRaises(AssertionError):
                s.ready_logs('\n'.join(changed))

    def test_ready_logs_ignore_valid_json_scalars_without_accepting_fake_events(self):
        lines = [json.dumps({'event':name+'_STARTUP_READY','totalChanges':0}) for name in s.READY_EVENTS]
        noise = ['"ordinary startup message"','null','true','1','[]',
            '[{"event":"BENCH_CREDENTIAL_STARTUP_READY","totalChanges":0}]']
        mixed = [value for line in lines for value in [line,*noise]]
        self.assertEqual(len(s.ready_logs('\n'.join(mixed))),20)
        with self.assertRaises(AssertionError):
            s.ready_logs('\n'.join(lines[:-1]+noise))

class CliLifetimeGuards(unittest.TestCase):
    def test_cli_enforces_original_memory_bound_without_heap_override(self):
        for peak in [805306368, 805306369]:
            with tempfile.TemporaryDirectory(prefix='lims-owned-memory-') as owned:
                root = pathlib.Path(owned)
                reply = Mock(returncode=0, stdout='{"totalChanges":0}', stderr=json.dumps({
                    'releaseCliPeakBytes':peak,'childStatus':0,'childSignal':None}))
                with patch.object(s, 'command', return_value=reply) as run:
                    if peak <= 805306368:
                        self.assertEqual(s.cli(root,'image',root/'prisma','owned.js','--dry-run','proof'), {'totalChanges':0})
                    else:
                        with self.assertRaises(AssertionError):
                            s.cli(root,'image',root/'prisma','owned.js','--dry-run','proof')
                args = run.call_args.args[1]
                self.assertEqual(args[args.index('--memory')+1], '768m')
                self.assertIn('NODE_OPTIONS=', args)
                self.assertNotIn('NODE_OPTIONS=--max-old-space-size=1536', args)
                evidence = json.loads((root/'proof-container.json').read_text())
                self.assertEqual(evidence['memoryLimitBytes'], 805306368)
                self.assertIsNone(evidence['nodeOptions'])

    def test_timeout_retains_partial_logs(self):
        with tempfile.TemporaryDirectory(prefix='lims-owned-timeout-') as owned:
            root = pathlib.Path(owned)
            fault = subprocess.TimeoutExpired(['owned'], 1, output=b'partial proof', stderr=b'fault details')
            with patch.object(s.subprocess, 'run', side_effect=fault):
                with self.assertRaises(subprocess.TimeoutExpired):
                    s.command(root, ['owned'], 'timeout-proof')
            self.assertEqual((root/'timeout-proof.stdout').read_text(), 'partial proof')
            self.assertEqual((root/'timeout-proof.stderr').read_text(), 'fault details')

    def test_cli_timeout_stops_only_named_owned_writer(self):
        root = pathlib.Path('/owned/release-proof')
        fault = subprocess.TimeoutExpired(['docker'], 240)
        with patch.object(s, 'command', side_effect=fault) as run, patch.object(s, 'stop_owned_cli') as stop:
            with self.assertRaises(subprocess.TimeoutExpired):
                s.cli(root, 'owned-image', root/'prisma', 'owned.js', '--dry-run', '190-dry')
        args = run.call_args.args[1]
        name = args[args.index('--name')+1]
        self.assertTrue(name.startswith('lims-owned-cli-'))
        self.assertEqual(stop.call_args.args, (name, str(root.resolve())+':190-dry'))
        self.assertIn('io.soilfer.release-owned='+stop.call_args.args[1], args)

    def test_foreign_cli_label_refuses_stop(self):
        with patch.object(s.subprocess, 'run', return_value=Mock(returncode=0, stdout='someone-else')) as run:
            with self.assertRaisesRegex(AssertionError, 'unowned'):
                s.stop_owned_cli('lims-owned-cli-test', '/owned/proof:193-apply')
        self.assertEqual(run.call_count, 1)

    def test_owned_cli_stop_verifies_no_writer_remains(self):
        owner='/owned/proof:193-apply'
        replies=[Mock(returncode=0,stdout=owner),Mock(returncode=0),Mock(returncode=0,stdout='true')]
        with patch.object(s.subprocess, 'run', side_effect=replies) as run:
            with self.assertRaisesRegex(AssertionError, 'writer remains'):
                s.stop_owned_cli('lims-owned-cli-test', owner)
        self.assertEqual(run.call_args_list[1].args[0], ['docker','stop','-t','10','lims-owned-cli-test'])

class ExactKitGateGuards(unittest.TestCase):
    def fixture(self):
        now = datetime.datetime(2026,10,10,18,tzinfo=datetime.timezone.utc)
        manifest = {'status':'PREPARED_ONLY_NOT_EXECUTED','head':s.HEAD,'image':'owned-image',
            'attemptPlanSha256':'d'*64,'files':{'release-forward.py':'a'*64,'rehearsal-receipt.json':'b'*64}}
        rows = []
        for number in [258,257,259,260,263,264,265,266,267,268,269,273,271,276,275,280,282,285,286,287]:
            head = format(number,'040x')
            rows.append({'number':number,'head':head,'state':'MERGED','gated':True,
                'laterAuditFailure':False,'auditPass':{'body':'Audit passed: OK to merge and deploy '+head},
                'checks':[{'conclusion':'SUCCESS'}]})
        gate = {'head':s.HEAD,'image':'owned-image','manifestSha256':'c'*64,
            'coordinatorSha256':'a'*64,'rehearsalReceiptSha256':'b'*64,'verifiedUtc':now.isoformat(),
            'prGates':{'head':s.HEAD,'includedPrCount':20,'ungatedPrs':[],'prs':rows,
                'mainCi':[{'name':'CI','headSha':s.HEAD,'status':'completed','conclusion':'success'}]},
            'kitReview':{'issue':162,'reviewedBy':'Claudio',
                'url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-owned-test',
                'body':'Audit passed: OK to merge and deploy '+s.HEAD+' '+'a'*64+' '+'b'*64+' '+'c'*64,
                'approvedAttemptPlanSha256':'d'*64,'timeUtc':now.isoformat()},
            'yyGo':{'confirmedByYY':True,'source':'CLAUDE_LIMS_AUDIT_THREAD','evidenceSha256':'e'*64,
                'timeUtc':(now-datetime.timedelta(hours=1)).isoformat(),'authorizationMode':'AUTO_AFTER_REVIEW',
                'text':'Auto after review','scopeHead':s.HEAD,'scopeDecision':'Main now','scopeEvidenceSha256':'f'*64},
            'workloadControl':{'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}}
        return manifest, gate, now

    def verify(self, manifest, gate, now):
        def file_hash(file):
            name = pathlib.Path(file).name
            return {'prepared-manifest.json':'c'*64,'release-forward.py':'a'*64,'rehearsal-receipt.json':'b'*64}[name]
        with patch.object(s,'sha',side_effect=file_hash):
            release.verify_gate(manifest,gate,now)

    def test_existing_yy_auto_choice_only_runs_after_exact_kit_pass(self):
        self.verify(*self.fixture())

    def test_missing_phrase_wrong_commit_hash_and_stale_gate_refuse(self):
        for fault in ['phrase','head','hash','stale','repair','future','plan']:
            manifest, gate, now = self.fixture()
            if fault == 'phrase':
                gate['kitReview']['body'] = gate['kitReview']['body'].replace('Audit passed: OK to merge and deploy','Looks good')
            elif fault == 'head':
                gate['kitReview']['body'] = gate['kitReview']['body'].replace(s.HEAD,'0'*40)
            elif fault == 'hash':
                gate['kitReview']['body'] = gate['kitReview']['body'].replace('b'*64,'0'*64)
            elif fault == 'stale':
                gate['verifiedUtc'] = (now-datetime.timedelta(seconds=601)).isoformat()
            elif fault == 'repair':
                gate['prGates']['prs'] = gate['prGates']['prs'][:-1]
            elif fault == 'future':
                gate['kitReview']['timeUtc'] = (now+datetime.timedelta(seconds=1)).isoformat()
            elif fault == 'plan':
                gate['kitReview']['approvedAttemptPlanSha256'] = '0'*64
            with self.subTest(fault=fault), self.assertRaises(AssertionError):
                self.verify(manifest,gate,now)

class RecoveryGuards(unittest.TestCase):
    def recover(self, attempted=False, changed=False, old_ready=True, startup_changed=False, health_failed=False):
        release.held = True
        release.installer_attempted = attempted
        release.receipt = {'preApplyState':{'original':True}, 'preApplyFiles':{'bytes':'same'}}
        states = [{'original':not changed},{'original':True},{'original':not startup_changed}]
        with patch.object(s,'snapshot',side_effect=states), patch.object(s,'physical',return_value={'bytes':'same'}), \
             patch.object(s,'cli',return_value={'classification':'COMPLETE' if old_ready else 'PRE_187','totalChanges':0}), \
             patch.object(release,'writers_stopped'), patch.object(release,'start_app',return_value={'status':'ok'}) as start, \
             patch.object(release,'reopen',side_effect=RuntimeError('Owned health failure') if health_failed else None), \
             patch.object(release,'http'), patch.object(release,'maintenance') as hold, \
             patch.object(release,'stop_app') as stop, patch.object(release,'save'), patch.object(release,'mark'):
            release.recover_failure(RuntimeError('Owned injected fault'))
            return start.call_args_list,hold.call_count,stop.call_count,release.receipt['status']

    def test_verified_preapply_refusal_reopens_ingress_before_jobs(self):
        starts,hold,stop,status = self.recover()
        self.assertEqual([call.args for call in starts],[(False,s.OLD_IMAGE),(True,s.OLD_IMAGE)])
        self.assertEqual(status,'ABORTED_BEFORE_INSTALL_PREVIOUS_RELEASE_REOPENED')
        self.assertEqual((hold,stop),(0,0))

    def test_any_installer_attempt_is_forward_only(self):
        starts,hold,stop,status = self.recover(attempted=True)
        self.assertEqual(starts,[])
        self.assertEqual((hold,stop),(1,1))
        self.assertEqual(status,'FAILED_FORWARD_HOLD')

    def test_changed_evidence_or_incomplete_old_guard_keeps_hold(self):
        for options in [{'changed':True},{'old_ready':False}]:
            starts,hold,stop,status = self.recover(**options)
            self.assertEqual(starts,[])
            self.assertEqual((hold,stop),(1,1))
            self.assertEqual(status,'FAILED_FORWARD_HOLD')

    def test_failed_recovery_health_or_startup_change_never_enables_jobs(self):
        for options in [{'health_failed':True},{'startup_changed':True}]:
            starts,hold,stop,status = self.recover(**options)
            self.assertEqual([call.args for call in starts],[(False,s.OLD_IMAGE)])
            self.assertEqual((hold,stop),(1,1))
            self.assertEqual(status,'FAILED_FORWARD_HOLD')

class PreservationGuards(unittest.TestCase):
    def setUp(self):
        self.owned = tempfile.TemporaryDirectory(prefix='lims-owned-release-guard-')
        self.file = pathlib.Path(self.owned.name)/'dev.db'
        with sqlite3.connect(self.file) as db:
            db.executescript('CREATE TABLE Result(id TEXT PRIMARY KEY,value TEXT,attemptId TEXT);'
                'CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,workItemId TEXT,status TEXT);'
                'CREATE TABLE AuditLog(id TEXT PRIMARY KEY,message TEXT);'
                'CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT);'
                "INSERT INTO Result VALUES('r1','1.234',NULL);"
                "INSERT INTO WorkAttempt VALUES('a1','w1','ACCEPTED');"
                "INSERT INTO AuditLog VALUES('log1','retained evidence');"
                "INSERT INTO _schema_migrations VALUES('old','immutable');")
        self.before = s.snapshot(self.file)
        self.after = s.snapshot(self.file,self.before)

    def tearDown(self):
        self.owned.cleanup()

    def test_original_rows_pass_and_owned_backup_never_overwrites(self):
        self.assertTrue(s.preserve(self.before,self.after)['originalRowsAndFieldsPreserved'])
        target = pathlib.Path(self.owned.name)/'backup.db'
        s.consistent_backup(self.file,target)
        original = s.sha(target)
        with self.assertRaises(FileExistsError):
            s.consistent_backup(self.file,target)
        self.assertEqual(s.sha(target),original)

    def test_analytical_attempt_audit_and_receipt_tampering_refused(self):
        for table,key,field in [('Result','r1','value'),('WorkAttempt','a1','status'),('_schema_migrations','old','details')]:
            after = copy.deepcopy(self.after)
            after['keyed'][table][key][field] = 'altered'
            with self.assertRaises(AssertionError):
                s.preserve(self.before,after)
        after = copy.deepcopy(self.after)
        after['tables']['AuditLog']['sha256'] = '0'*64
        with self.assertRaises(AssertionError):
            s.preserve(self.before,after)

    def test_unapproved_attempt_missing_schema_and_foreign_key_refused(self):
        after = copy.deepcopy(self.after)
        after['keyed']['WorkAttempt']['rogue'] = {'id':'rogue'}
        with self.assertRaises(AssertionError):
            s.preserve(self.before,after)
        after = copy.deepcopy(self.after)
        after['objects'].pop('table:AuditLog')
        with self.assertRaises(AssertionError):
            s.preserve(self.before,after)
        after = copy.deepcopy(self.after)
        after['foreignKeyViolations'] = 1
        with self.assertRaises(AssertionError):
            s.preserve(self.before,after)

if __name__ == '__main__':
    unittest.main(verbosity=2)
