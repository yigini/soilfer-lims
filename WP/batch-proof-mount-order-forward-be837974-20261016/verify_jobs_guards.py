"""Closed synthetic tests of NEW jobs qualification; never real Docker or upstream."""
import copy,json,os,pathlib,shutil,sqlite3,unittest
from unittest import mock
import proof_jobs as jobs
import runtime_proof_policies as policy
from proof_contract import *
from proof_budget import TABLE,TOTAL_DB_COPIES,DB_EQUIVALENTS,copy_site_guard,EXPECTED_SITES
from proof_docker import Docker,arguments
from proof_files import logical

class JobsGuards(unittest.TestCase):
    def test_new_scope_is_not_the_accepted_startup_source_pass(self):
        self.assertEqual(SCOPE,'BOUND_INSTALLED209_STEP2_STRICT_PROVENANCE_NATURAL_INTAKE_AND_BROAD_POSTFLIGHTS')
        self.assertNotIn('233000',str(ROOT));self.assertEqual((TOTAL_DB_COPIES,DB_EQUIVALENTS),(25,64))
    def test_standalone_cli_is_refused_before_any_container(self):
        with self.assertRaisesRegex(RuntimeError,'Standalone CLI'):Docker(ROOT,None).cli('anything')
    def test_nonblocking_postflight_stdin_busy_returns_to_deadline_loop(self):
        from proof_docker import send_stdin_chunk
        process=mock.Mock()
        with mock.patch('proof_docker.os.write',side_effect=BlockingIOError):self.assertEqual(send_stdin_chunk(process,b'hello',0),0)
        process.stdin.close.assert_not_called()
    def test_nonblocking_postflight_stdin_exact_eof(self):
        from proof_docker import send_stdin_chunk
        process=mock.Mock()
        with mock.patch('proof_docker.os.write',return_value=5):self.assertEqual(send_stdin_chunk(process,b'hello',0),5)
        process.stdin.close.assert_called_once()
    def test_jobs_network_and_flag_derived_together(self):
        with mock.patch('proof_docker.load_health',return_value={'createFlags':[]}):
            _,_,a=arguments(ROOT,'test',pathlib.Path(ROOT)/'db',pathlib.Path(ROOT)/'tmp',assets=pathlib.Path(ROOT)/'assets',jobs=True)
        self.assertEqual(a[a.index('--network')+1],'bridge');self.assertIn('DISABLE_BACKGROUND_JOBS=false',a)
        self.assertNotIn('-p',a);self.assertIn('NODE_OPTIONS=',a);self.assertIn('--memory-swap',a)
    def test_jobs_off_stays_network_none(self):
        with mock.patch('proof_docker.load_health',return_value={'createFlags':[]}):
            _,_,a=arguments(ROOT,'test',pathlib.Path(ROOT)/'db',pathlib.Path(ROOT)/'tmp',assets=pathlib.Path(ROOT)/'assets')
        self.assertEqual(a[a.index('--network')+1],'none');self.assertIn('DISABLE_BACKGROUND_JOBS=true',a)
    def test_same_peak_observation_not_reintroduced_as_jobs_gate(self):
        first={'utc':'2026-10-16T00:00:00Z','epochSeconds':policy.utc_seconds('2026-10-16T00:00:00Z')}
        second={'utc':'2026-10-16T00:15:00Z','epochSeconds':policy.utc_seconds('2026-10-16T00:15:00Z')}
        jobs.natural_complete(first,second,'2026-10-15T23:59:00Z','2026-10-16T00:17:00Z',15,0)
    def test_second_early_natural_sync_is_refused(self):
        a={'utc':'2026-10-16T00:00:00Z','epochSeconds':policy.utc_seconds('2026-10-16T00:00:00Z')}
        b={'utc':'2026-10-16T00:14:59Z','epochSeconds':policy.utc_seconds('2026-10-16T00:14:59Z')}
        with self.assertRaises(RuntimeError):jobs.natural_complete(a,b,'2026-10-15T23:59:00Z','2026-10-16T00:17:00Z',15,0)
    def test_short_interval_plus_two_observation_is_refused(self):
        a={'utc':'2026-10-16T00:00:00Z','epochSeconds':policy.utc_seconds('2026-10-16T00:00:00Z')};b={'utc':'2026-10-16T00:15:00Z','epochSeconds':policy.utc_seconds('2026-10-16T00:15:00Z')}
        with self.assertRaises(RuntimeError):jobs.natural_complete(a,b,'2026-10-15T23:59:00Z','2026-10-16T00:16:59Z',15,0)
    def test_restart_refuses_even_with_completed_syncs(self):
        a={'utc':'2026-10-16T00:00:00Z','epochSeconds':policy.utc_seconds('2026-10-16T00:00:00Z')};b={'utc':'2026-10-16T00:15:00Z','epochSeconds':policy.utc_seconds('2026-10-16T00:15:00Z')}
        with self.assertRaises(RuntimeError):jobs.natural_complete(a,b,'2026-10-15T23:59:00Z','2026-10-16T00:17:00Z',15,1)
    def test_full_api_summary_required(self):self.assertEqual(jobs.probe_results(b'POSTFLIGHT SUMMARY: 31/31 checks passed (0 failed)'),{'passed':31,'total':31,'failed':0})
    def test_partial_api_summary_refused(self):
        for b in [b'POSTFLIGHT SUMMARY: 30/31 checks passed (1 failed)',b'',b'POSTFLIGHT SUMMARY: 31/31 checks passed (0 failed)\nPOSTFLIGHT SUMMARY: 31/31 checks passed (0 failed)']:
            with self.assertRaises(RuntimeError):jobs.probe_results(b)
    def test_all_six_broad_probes_have_actual_reviewed_inputs(self):
        calls=[]
        class Fake:
            def command(_,args,label,timeout,input_bytes=None):
                calls.append((label,input_bytes));return b'POSTFLIGHT SUMMARY: 31/31 checks passed (0 failed)',b''
        result=jobs.broad_postflights(pathlib.Path(__file__).parent,'a'*64,Fake())
        self.assertEqual(len(result['readOnlyProbes']),6);self.assertEqual(len(calls),7)
        self.assertTrue(all(isinstance(v,bytes) and len(v)>1000 for _,v in calls[1:]))
    def test_upstream_capture_no_cursor_or_interval_override(self):
        source=(pathlib.Path(__file__).parent/'proof_jobs.py').read_text()
        self.assertNotIn('since_by_config=',source);self.assertNotIn('UPDATE KoboConfig',source)
        self.assertNotIn('_syncLabSubmissions',source);self.assertNotIn('checkAndSyncKobo(',source)
    def test_monitor_final_always_checks_before_stop(self):
        events=[]
        with mock.patch.object(jobs,'MemoryHistory') as history:
            h=history.return_value;h.summary.return_value={'ok':True}
            docker=mock.Mock();docker.validate.side_effect=lambda *a:events.append('validate')
            h.observe.side_effect=lambda phase:events.append(phase)
            m=jobs.Monitor(ROOT,'test','a'*64,str(ROOT)+':test',docker,'data','tmp');self.assertEqual(m.final(12),{'ok':True})
        self.assertEqual(events,['validate','before-stop'])
    def test_monitor_memory_refusal_propagates_to_caller(self):
        with mock.patch.object(jobs,'MemoryHistory') as history:
            history.return_value.observe.side_effect=RuntimeError('oom_kill')
            m=jobs.Monitor(ROOT,'test','a'*64,str(ROOT)+':test',mock.Mock(),'data','tmp')
            with self.assertRaisesRegex(RuntimeError,'oom_kill'):m.sample(force=True)
    def test_new_source_has_no_cli_peak_gate(self):
        self.assertNotIn('releaseCliPeakBytes',(pathlib.Path(__file__).parent/'proof_docker.py').read_text())
    def test_owned_sql_guard_refuses_old_backup(self):
        with mock.patch.object(sqlite3,'connect',side_effect=AssertionError('SQL must not occur')):
            with self.assertRaises(RuntimeError):jobs.configs_from_new_backup(ROOT,PRIOR_BACKUP)
    def test_consistent_backup_refuses_old_input_before_sql(self):
        with mock.patch.object(sqlite3,'connect',side_effect=AssertionError('SQL must not occur')):
            with self.assertRaises(RuntimeError):jobs.consistent_backup(ROOT,PRIOR_BACKUP,pathlib.Path(ROOT)/'new.db',mock.Mock(),mock.Mock())
    def test_budget_accounts_first_sync_snapshot(self):
        self.assertEqual(TABLE[0]['sites']['backup'],1);self.assertEqual(TABLE[1]['sites']['backup'],2)
        self.assertEqual([r['dbTriples'] for r in TABLE],[12,13])
    def test_ready_boolean_zero_is_not_integer_zero(self):
        with self.assertRaises(RuntimeError):jobs.startup_log('{"mode":"NO_OP","totalChanges":0}\nStarting SoilFER-LIMS...\n{"event":"X_STARTUP_READY","totalChanges":false}',['X_STARTUP_READY'],1,True)
    def test_entrypoint_boolean_zero_is_not_integer_zero(self):
        with self.assertRaises(RuntimeError):jobs.startup_log('{"mode":"NO_OP","totalChanges":false}\nStarting SoilFER-LIMS...\n{"event":"X_STARTUP_READY","totalChanges":0}',['X_STARTUP_READY'],1,True)
    def readiness(self,http_seconds=0,missing=False):
        clock=[0];calls=[];monitor=mock.Mock();history=mock.Mock();history.last_time=0;history.summary.return_value={'healthPollCount':1}
        class Fake:
            disk=mock.Mock()
            def validate(_,id,owner,data,tmp,running,observe=None):
                obj={'State':{'Running':True,'Health':{'Status':'healthy' if not missing else None}}}
                if observe:observe(obj)
                return obj
            def command(_,args,label,*a,**kw):
                calls.append(label)
                if 'http-probes' in label:clock[0]+=http_seconds;return b'[]',b''
                return b'{"mode":"NO_OP","totalChanges":0}\nStarting SoilFER-LIMS...\n{"event":"X_STARTUP_READY","totalChanges":0,"rss_bytes":12}',b''
        with mock.patch.object(jobs,'HealthHistory',return_value=history),mock.patch.object(jobs.time,'monotonic',side_effect=lambda:clock[0]):
            return jobs.ready(ROOT,'test','a'*64,str(ROOT)+':test','data','tmp',Fake(),['X_STARTUP_READY'],1,True,0,monitor),calls,monitor
    def test_actual_new_readiness_final_memory_and_http_inside600(self):
        value,calls,m=self.readiness();self.assertEqual(value['checks']['databaseChanges'],0)
        self.assertIn('test-http-probes',calls);m.sample.assert_any_call('health-poll',True);m.sample.assert_any_call('ready-final',True)
    def test_actual_new_readiness_full_http_deadline_overrun_refused(self):
        with self.assertRaisesRegex(RuntimeError,'600-second readiness'):self.readiness(http_seconds=600)
    def test_actual_new_readiness_missing_health_refused(self):
        with self.assertRaisesRegex(RuntimeError,'Unknown health'):self.readiness(missing=True)

class SchedulerGuards(unittest.TestCase):
    def setUp(self):
        self.expected=[{'configId':c,'labId':l,'projectCode':p,'message':m} for c,l,p,m in policy.REFUSAL_TUPLES]
    def pair(self,delta='00:00:00.500000000',message=None):
        r=self.expected[0]
        return ('2026-10-16T00:00:00.000000000Z [KOBO_SCHEDULER] Triggering scheduled sync for Lab: '+r['labId']+', Project: '+r['projectCode']+'\n',
                '2026-10-16T'+delta+'Z [KOBO_SCHEDULER] Error syncing lab '+r['labId']+': '+(message or r['message'])+'\n')
    def test_exact_paired_refusal(self):self.assertEqual(len(policy.scheduler_refusals(*self.pair(),self.expected)),1)
    def test_unknown_refusal_stops(self):
        with self.assertRaises(RuntimeError):policy.scheduler_refusals(*self.pair(message='unexpected'),self.expected)
    def test_one_nanosecond_over_pair_window_stops(self):
        with self.assertRaises(RuntimeError):policy.scheduler_refusals(*self.pair(delta='00:00:01.000000001'),self.expected)
    def test_error_without_trigger_stops(self):
        _,b=self.pair()
        with self.assertRaises(RuntimeError):policy.scheduler_refusals('',b,self.expected)
    def test_duplicate_error_does_not_reuse_trigger(self):
        a,b=self.pair()
        with self.assertRaises(RuntimeError):policy.scheduler_refusals(a,b+b,self.expected)
    def test_general_scheduler_error_stops(self):
        with self.assertRaises(RuntimeError):policy.scheduler_refusals('[KOBO_SCHEDULER] General scheduler error','',self.expected)
    def test_completions_need_both_numeric_fields(self):
        with self.assertRaises(RuntimeError):policy.completed_syncs('2026-10-16T00:00:00Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: {newSamples: 0,}')
    def test_zero_new_samples_is_an_observed_completion(self):
        a=policy.completed_syncs('2026-10-16T00:00:00Z [KOBO_SCHEDULER] Completed sync for ZMB-LAB1: {newSamples: 0, skipped: 0}')
        self.assertEqual(a[0]['newSamples'],0)
    def test_intake_count_uses_rows_not_distinct_submission_ids(self):
        s={'newSampleCount':{policy.TARGET_CONFIG:2},'newSamplePairs':{policy.TARGET_CONFIG:[1,2]},'newSubmissionIds':{policy.TARGET_CONFIG:['101']},'newSampleDepthSplit':{policy.TARGET_CONFIG:{'D1':1,'D2':1}}}
        self.assertEqual(policy.intake_summary(s,{'newSamples':2,'skipped':0})['distinctSubmissionCount'],1)
        with self.assertRaises(RuntimeError):policy.intake_summary(s,{'newSamples':1,'skipped':0})

class IntakeFiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).with_name(pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).name+'-intake')
        require(not cls.root.exists(),'Fresh retained synthetic intake fixtures');cls.root.mkdir(parents=True)
    def setUp(self):
        self.owner=self.root/self._testMethodName;self.owner.mkdir();self.old=self.owner/'old.db';self.new=self.owner/'new.db'
        db=sqlite3.connect(self.old)
        db.executescript('''CREATE TABLE Sample(id TEXT PRIMARY KEY,assignedLab TEXT,projectCode TEXT,status TEXT,labId TEXT,metadata TEXT);
CREATE TABLE AuditLog(id TEXT PRIMARY KEY,entity TEXT,entityId TEXT,action TEXT,performedBy TEXT,sampleId TEXT,labId TEXT,details TEXT);
CREATE TABLE SampleHold(id TEXT PRIMARY KEY); CREATE TABLE Notification(id TEXT PRIMARY KEY);
CREATE TABLE KoboConfig(id TEXT PRIMARY KEY,labId TEXT,projectCode TEXT,isActive INTEGER,formId TEXT,koboServerUrl TEXT,lastSubmissionId TEXT,lastSyncAt TEXT,updatedAt TEXT,syncIntervalMins INTEGER);
CREATE TABLE User(id TEXT PRIMARY KEY,labId TEXT,isActive INTEGER,role TEXT);
CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY);''')
        for i in range(105):db.execute('CREATE TABLE T'+str(i)+'(id TEXT PRIMARY KEY,value TEXT)')
        for i in range(42):db.execute('INSERT INTO _schema_migrations VALUES (?)',('receipt-'+str(i),))
        db.execute('INSERT INTO T0 VALUES (?,?)',('old','protected'))
        db.execute('INSERT INTO KoboConfig VALUES (?,?,?,?,?,?,?,?,?,?)',(policy.TARGET_CONFIG,policy.TARGET_LAB,policy.TARGET_PROJECT,1,'form','https://example.test','100',None,None,15))
        db.commit();db.close();shutil.copyfile(self.old,self.new)
    def verify(self,prior=None,fetched=None,prior_ids=None):
        from kobo_copy_preservation import verify_copy
        ids=fetched or {policy.TARGET_CONFIG:['101','102']};records={policy.TARGET_CONFIG:{'configId':policy.TARGET_CONFIG,'labId':policy.TARGET_LAB,'projectCode':policy.TARGET_PROJECT,'sourceIdentitySha256':sha(json.dumps(['https://example.test','form']).encode()),'submissionIds':ids[policy.TARGET_CONFIG]}}
        return verify_copy(prior or self.old,self.new,112,fetched_ids=ids,prior_fetched_ids=prior_ids,fetch_records=records,owner_root=self.owner)
    def add(self,id='new',submission='101',depth='D1',audit=True):
        with sqlite3.connect(self.new) as db:
            meta=json.dumps({'sourceFormId':'form','sourceServerUrl':'https://example.test','kobo_id':submission,'depth':depth})
            db.execute('INSERT INTO Sample VALUES (?,?,?,?,?,?)',(id,policy.TARGET_LAB,policy.TARGET_PROJECT,'EXPECTED',None,meta))
            if audit:db.execute('INSERT INTO AuditLog VALUES (?,?,?,?,?,?,?,?)',('audit-'+id,'SAMPLE',id,'CREATE_KOBO_SYNC','KOBO_SCHEDULER',id,policy.TARGET_LAB,json.dumps({'status':'EXPECTED','context':'ordinary'})))
    def test_all112_tables42_receipts_exact_when_no_intake(self):
        self.assertTrue(self.verify()['allOriginalRowsPreserved']);self.assertEqual(logical(self.old),logical(self.new))
    def test_enumerated_intake_pair_and_creation_audit(self):
        self.add();v=self.verify();self.assertEqual(v['newSampleCount'][policy.TARGET_CONFIG],1)
    def test_two_depth_rows_not_one_distinct_submission(self):
        self.add();self.add('second','101','D2');self.assertEqual(self.verify()['newSampleCount'][policy.TARGET_CONFIG],2)
    def test_duplicate_submission_depth_refuses(self):
        self.add();self.add('second')
        with self.assertRaises(RuntimeError):self.verify()
    def test_missing_creation_audit_refuses(self):
        self.add(audit=False)
        with self.assertRaises(RuntimeError):self.verify()
    def test_unfetched_id_refuses(self):
        self.add(submission='999')
        with self.assertRaises(RuntimeError):self.verify()
    def test_protected_old_row_change_refuses(self):
        with sqlite3.connect(self.new) as db:db.execute("UPDATE T0 SET value='changed'")
        with self.assertRaises(RuntimeError):self.verify()
    def test_protected_receipt_removal_refuses(self):
        with sqlite3.connect(self.new) as db:db.execute("DELETE FROM _schema_migrations WHERE id='receipt-0'")
        with self.assertRaises(RuntimeError):self.verify()
    def test_config_interval_change_refuses(self):
        with sqlite3.connect(self.new) as db:db.execute('UPDATE KoboConfig SET syncIntervalMins=1')
        with self.assertRaises(RuntimeError):self.verify()
    def test_refusal_config_cannot_change(self):
        with sqlite3.connect(self.new) as db:db.execute("UPDATE KoboConfig SET lastSubmissionId='101'")
        from kobo_copy_preservation import verify_copy
        with self.assertRaisesRegex(RuntimeError,'Expected refusal config changed'):verify_copy(self.old,self.new,112,fetched_ids={policy.TARGET_CONFIG:['101']},refusal_configs=[policy.TARGET_CONFIG],owner_root=self.owner,fetch_records={policy.TARGET_CONFIG:{'configId':policy.TARGET_CONFIG,'labId':policy.TARGET_LAB,'projectCode':policy.TARGET_PROJECT,'sourceIdentitySha256':sha(json.dumps(['https://example.test','form']).encode()),'submissionIds':['101']}})
    def test_cursor_must_be_enumerated_and_advance(self):
        with sqlite3.connect(self.new) as db:db.execute("UPDATE KoboConfig SET lastSubmissionId='999'")
        with self.assertRaises(RuntimeError):self.verify()
    def test_second_duplicate_first_fetch_refuses(self):
        self.add()
        with self.assertRaises(RuntimeError):self.verify(prior_ids={policy.TARGET_CONFIG:['101']})
    def test_second_genuinely_new_submission_passes(self):
        self.add(submission='102');self.assertEqual(self.verify(prior_ids={policy.TARGET_CONFIG:['101']})['newSampleCount'][policy.TARGET_CONFIG],1)
    def test_scientific_disposition_invention_refuses(self):
        self.add()
        with sqlite3.connect(self.new) as db:db.execute("UPDATE Sample SET status='ACCEPTED'")
        with self.assertRaises(RuntimeError):self.verify()

class NaturalControlFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).with_name(pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).name+'-natural')
        require(not cls.base.exists(),'Fresh natural controller fixtures');cls.base.mkdir(parents=True)
    def exercise(self,never_first=False,never_second=False,health=False,refusal=False):
        root=self.base/self._testMethodName;root.mkdir();calls=[];clock=[0.0]
        epoch=policy.utc_seconds('2026-10-16T00:00:00Z')
        first={'utc':'2026-10-16T00:00:00Z','epochSeconds':epoch,'newSamples':0,'skipped':0}
        second={'utc':'2026-10-16T00:15:00Z','epochSeconds':epoch+900,'newSamples':0,'skipped':0}
        configs={policy.TARGET_CONFIG:{'labId':policy.TARGET_LAB}}
        expected=[{'configId':r[0]} for r in policy.REFUSAL_TUPLES]
        intake={'newSampleCount':{policy.TARGET_CONFIG:0},'newSamplePairs':{policy.TARGET_CONFIG:[]},'newSubmissionIds':{},'newSampleDepthSplit':{policy.TARGET_CONFIG:{}},'notificationExpectations':[]}
        class Disk:
            def begin_stage(_,label):calls.append(('begin',label))
            def finish_stage(_,label):calls.append(('finish',label))
            def check(_):pass
            def time_guard(_,seconds):pass
        class Fake:
            observer=None
            def create(_,label,data,tmp,assets=None,jobs=False):calls.append(('create-jobs',jobs));return 'a'*64,str(ROOT)+':startup-2'
            def command(_,args,label,*a,**kw):calls.append(('command',label));return b'',b''
            def validate(_,id,owner,data,tmp,running):return {'State':{'Running':True,'Health':{'Status':'unhealthy' if health else 'healthy'}},'RestartCount':0}
            def stop(_,id,owner,label):calls.append(('stop',label))
        class Mon:
            def __init__(*a):pass
            def sample(*a,**kw):pass
            def final(_,rss):calls.append(('final-memory',rss));return {'oomAndOomKillZeroEverySample':True}
        def logs(*a):return 'log',([] if refusal else expected+expected)
        def completions(*a):return [] if never_first else [first] if never_second or clock[0]<900 else [first,second]
        def sealed(*a):calls.append(('seal','stopped'));return root/'final.db',{}
        def sleep(seconds):clock[0]+=seconds
        readiness={'readyUtc':'2026-10-16T00:00:00Z','checks':{'readyEvents':[{'rss_bytes':12}]}}
        replacements={'configs_from_new_backup':lambda *a:(configs,expected,15),'clone_backup':lambda *a:root/'database','copy_tree':lambda *a:None,
            'capture':lambda *a,**kw:{policy.TARGET_CONFIG:{'submissionIds':[]}},'Monitor':Mon,'ready':lambda *a:readiness,
            'observed_logs':logs,'completed_syncs':completions,'consistent_backup':lambda *a:None,'verify_copy':lambda *a,**kw:copy.deepcopy(intake),
            'stopped_owned':lambda *a:calls.append(('stopped-check',True)),'seal':sealed,'tree_state':lambda *a:{'files':{'original':'same'}},'utc_now':lambda:__import__('datetime').datetime.fromtimestamp(epoch+clock[0],__import__('datetime').timezone.utc).isoformat()}
        with mock.patch.multiple(jobs,**replacements),mock.patch.object(jobs.time,'monotonic',side_effect=lambda:clock[0]),mock.patch.object(jobs.time,'time',side_effect=lambda:epoch+clock[0]),mock.patch.object(jobs.time,'sleep',side_effect=sleep):
            try:result=jobs.jobs_on(root,root/'baseline.db',root/'assets',Fake(),Disk(),[],0,lambda:calls.append(('input-guard',True)))
            except BaseException as e:result=e
        return result,calls,root
    def test_actual_natural_controller_two_completions_then_final_memory_stop_seal(self):
        result,calls,root=self.exercise();self.assertIsInstance(result,dict)
        self.assertIn(('create-jobs',True),calls);self.assertLess(calls.index(('final-memory',12)),calls.index(('stop','startup-2')))
        self.assertLess(calls.index(('stop','startup-2')),calls.index(('seal','stopped')));self.assertEqual(calls.count(('finish','startup-2')),1)
        self.assertTrue((root/'startup-2-result.json').exists())
    def test_actual_natural_controller_no_first_sync_stops_without_receipt(self):
        result,calls,root=self.exercise(never_first=True);self.assertIsInstance(result,RuntimeError);self.assertIn('First natural sync',str(result))
        self.assertIn(('stop','startup-2'),calls);self.assertFalse((root/'startup-2-result.json').exists())
    def test_actual_natural_controller_no_second_sync_stops_without_receipt(self):
        result,calls,root=self.exercise(never_second=True);self.assertIsInstance(result,RuntimeError);self.assertIn('Second natural completion',str(result))
        self.assertIn(('stop','startup-2'),calls);self.assertNotIn(('seal','stopped'),calls)
    def test_actual_natural_controller_health_loss_stops_immediately(self):
        result,calls,root=self.exercise(health=True);self.assertIsInstance(result,RuntimeError);self.assertIn('lost health',str(result));self.assertIn(('stop','startup-2'),calls)
    def test_actual_natural_controller_missing_refusals_cannot_pass(self):
        result,calls,root=self.exercise(refusal=True);self.assertIsInstance(result,RuntimeError);self.assertIn('paired natural refusals',str(result));self.assertIn(('stop','startup-2'),calls)

if __name__=='__main__':unittest.main(verbosity=2)
