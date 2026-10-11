"""Owned fixtures only: release scope, preservation, reserve and replay refusals."""
import copy, datetime, importlib.util, json, pathlib, shutil, sqlite3, tempfile, unittest
from unittest.mock import patch
import release_support as s
import prepare_manifest as preparation

spec=importlib.util.spec_from_file_location('coordinator',pathlib.Path(__file__).with_name('release-forward.py'))
release=importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class ScopeGuards(unittest.TestCase):
    def test_prior_installers_and_acceptance_can_never_apply(self):
        for _,script in s.LEGACY_VERIFIERS:
            with self.subTest(script=script),patch.object(s,'command') as command:
                with self.assertRaisesRegex(AssertionError,'No prior release'):
                    s.cli(pathlib.Path('/owned'),'owned',pathlib.Path('/owned'),script,'--apply','blocked')
                command.assert_not_called()
        for mode in ['--dry-run','--apply']:
            with self.subTest(mode=mode),patch.object(s,'command') as command:
                with self.assertRaisesRegex(AssertionError,'must never run again'):
                    s.cli(pathlib.Path('/owned'),'owned',pathlib.Path('/owned'),'link_recorded_acceptance.js',mode,'blocked')
                command.assert_not_called()

    def test_legacy_checks_use_only_dry_run_and_refuse_any_blocker(self):
        observed=[]
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            def run(root,image,directory,script,mode,label):
                observed.append((script,mode))
                if script=='install_result_raw_input.js':
                    return {'mode':'DRY_RUN','totalChanges':0,'classification':'ALREADY_PRESENT',
                        'backfillCount':0,'sources':{'migrationSha256':'850a47806543f1e6587641daa918fe586b6cbb4bfece5a6920132e4b74c593cc'}}
                return {'mode':'DRY_RUN','totalChanges':0,'classification':'COMPLETE',
                    'releaseInventory':{'blockedWorkItemCount':0,'blockedWorkItems':[]}}
            with patch.object(s,'snapshot',return_value={}),patch.object(s,'physical',return_value={}),patch.object(s,'cli',side_effect=run):
                rows=s.verify_legacy(root,'owned',root)
            self.assertEqual(len(rows),21)
            self.assertTrue(all(mode=='--dry-run' for _,mode in observed))
            with patch.object(s,'snapshot',return_value={}),patch.object(s,'physical',return_value={}),patch.object(s,'cli',return_value={'mode':'DRY_RUN','totalChanges':1}):
                with self.assertRaises(AssertionError):s.verify_legacy(root,'owned',root)

    def test_recorded_raw_input_contract_refuses_absence_or_unreviewed_source(self):
        # Exact #272 output retained from the first real owned-copy dry run.
        recorded={'classification':'ALREADY_PRESENT','counts':{'results':19,'recordedRawInputs':0},
            'backfillCount':0,'sources':{'migrationSha256':'850a47806543f1e6587641daa918fe586b6cbb4bfece5a6920132e4b74c593cc'},
            'mode':'DRY_RUN','totalChanges':0}
        s.validate_legacy('272',recorded)
        for field,value in [('classification','ABSENT'),('classification','COMPLETE'),
            ('backfillCount',1),('sources',{'migrationSha256':'0'*64}),('mode','APPLIED'),('totalChanges',1)]:
            with self.subTest(field=field,value=value),self.assertRaises(AssertionError):
                s.validate_legacy('272',{**recorded,field:value})

    def test_raw_input_exception_cannot_accept_other_incomplete_schemas(self):
        for key,_ in s.LEGACY_VERIFIERS:
            if key=='272':continue
            for classification in ['ALREADY_PRESENT','ABSENT','PARTIAL','PRE_'+key]:
                with self.subTest(key=key,classification=classification),self.assertRaises(AssertionError):
                    s.validate_legacy(key,{'mode':'DRY_RUN','totalChanges':0,'classification':classification})

    def test_old_main_scope_does_not_authorize_new_production(self):
        self.assertNotEqual(s.HEAD,s.LAST_DEPLOY)
        self.assertEqual(s.INCLUDED_PRS,[288,290])
        self.assertEqual(s.INSTALLERS,[('205','install_preparation_records.js')])
        self.assertNotEqual('Main now','PREPARATION_AND_RESULTS_288_290')

class PreservationGuards(unittest.TestCase):
    def test_deployed_acceptance_evidence_is_read_only_and_every_field_is_pinned(self):
        event={'id':'0c4a247e-339a-4adc-9ba2-061829eb2fce','entity':'WORK_ATTEMPT',
            'entityId':'att-s02-p-2','action':'ACCEPTED','details':json.dumps({
                'from':'RECORDED','to':'ACCEPTED','reason':None,
                'note':'Links recorded ReviewDecision dec-s02-p-acc (reviewedAt 2026-09-08 15:00:00); acceptance pre-dated attempt review.',
                'resultId':None,'oldResultIds':[],'newResultIds':[],'reviewDecisionId':'dec-s02-p-acc',
                'reconciliation':'191-recorded-acceptance-link-v1','workItemId':'WI-GTM-DEMO-S02-P',
                'linkedResultIds':['res-s02-p-run2']},separators=(',',':')),
            'performedBy':'system:release-191-acceptance-link','performedByName':'system:release-191-acceptance-link',
            'timestamp':'2026-10-11T05:47:03.103Z','sampleId':'GTM-DEMO-S02','labId':'GTM-LAB1','analysisCode':'P_OLSEN',
            'before':'{"status":"RECORDED","resultIds":[]}','after':'{"status":"ACCEPTED","resultIds":[]}'}
        self.assertEqual(s.fingerprint([event]),'d14c99ff5643a8fe31abef867604ffff2645f63c799e58c62c736937a665dc45')
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);file=root/'dev.db'
            with sqlite3.connect(file) as db:
                db.executescript('CREATE TABLE WorkItem(id TEXT,sampleId TEXT,analysis TEXT,status TEXT);'
                    'CREATE TABLE WorkAttempt(id TEXT,workItemId TEXT,status TEXT);'
                    'CREATE TABLE Result(id TEXT,attemptId TEXT,isCurrent INTEGER);'
                    'CREATE TABLE ReviewDecision(id TEXT,workItemId TEXT,decision TEXT,attemptId TEXT);'
                    'CREATE TABLE Report(id TEXT,sampleId TEXT,status TEXT);')
                db.execute('CREATE TABLE AuditLog('+','.join(s.quoted(key)+' TEXT' for key in event)+')')
                db.execute('INSERT INTO AuditLog VALUES('+','.join('?' for _ in event)+')',list(event.values()))
                db.execute('INSERT INTO WorkItem VALUES(?,?,?,?)',('WI-GTM-DEMO-S02-P','GTM-DEMO-S02','P_OLSEN','ACCEPTED'))
                db.execute('INSERT INTO WorkAttempt VALUES(?,?,?)',('att-s02-p-2','WI-GTM-DEMO-S02-P','ACCEPTED'))
                db.execute('INSERT INTO Result VALUES(?,?,?)',('res-s02-p-run2','att-s02-p-2',1))
                db.execute('INSERT INTO ReviewDecision VALUES(?,?,?,?)',('dec-s02-p-acc','WI-GTM-DEMO-S02-P','ACCEPT',None))
                db.execute('INSERT INTO Report VALUES(?,?,?)',('RPT-GTM-DEMO-S02-v1','GTM-DEMO-S02','PUBLISHED'))
            before=s.physical(file)
            self.assertEqual(s.verify_retained_acceptance(root)['totalChanges'],0)
            self.assertEqual(s.physical(file),before)
            faults=["UPDATE WorkAttempt SET status='RECORDED'", "UPDATE ReviewDecision SET attemptId='fabricated'",
                "UPDATE Result SET isCurrent=0", "UPDATE Report SET status='DRAFT'",
                "UPDATE WorkItem SET sampleId='other'"]
            faults += ['UPDATE AuditLog SET '+s.quoted(field)+"='changed'" for field in event]
            faults += ['INSERT INTO AuditLog SELECT * FROM AuditLog']
            for index,sql in enumerate(faults):
                altered=root/str(index);altered.mkdir();shutil.copyfile(file,altered/'dev.db')
                with sqlite3.connect(altered/'dev.db') as db:db.execute(sql)
                with self.subTest(sql=sql),self.assertRaises(AssertionError):s.verify_retained_acceptance(altered)

    def test_only_additive_schema_and_one_new_receipt_are_allowed(self):
        with tempfile.TemporaryDirectory() as folder:
            file=pathlib.Path(folder)/'dev.db'
            with sqlite3.connect(file) as db:
                db.executescript('CREATE TABLE Result(id TEXT PRIMARY KEY,value TEXT,attemptId TEXT);'
                    'CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,status TEXT);'
                    'CREATE TABLE WorkItem(id TEXT PRIMARY KEY,labId TEXT,assignedLab TEXT);'
                    'CREATE TABLE AuditLog(id TEXT PRIMARY KEY,details TEXT);'
                    'CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT);'
                    'CREATE TABLE WorkItemDraft(id TEXT PRIMARY KEY,data TEXT);')
                db.execute('INSERT INTO Result VALUES(?,?,?)',('original-result','6.40','original-attempt'))
                db.execute('INSERT INTO WorkAttempt VALUES(?,?)',('original-attempt','ACCEPTED'))
                db.execute('INSERT INTO AuditLog VALUES(?,?)',('original-event','retained immutable evidence'))
                db.execute('INSERT INTO _schema_migrations VALUES(?,?)',('original-receipt','retained receipt'))
                db.execute('INSERT INTO WorkItemDraft VALUES(?,?)',('original-draft','original data'))
            before=s.snapshot(file)
            with sqlite3.connect(file) as db:
                db.executescript('ALTER TABLE WorkItemDraft ADD COLUMN "records" TEXT;'
                    'CREATE TABLE PreparationRecord(id TEXT PRIMARY KEY);'
                    'CREATE INDEX prep1 ON PreparationRecord(id);CREATE INDEX prep2 ON PreparationRecord(id);'
                    'CREATE INDEX prep3 ON PreparationRecord(id);'
                    'CREATE TRIGGER guard1 BEFORE INSERT ON PreparationRecord BEGIN SELECT 1; END;'
                    'CREATE TRIGGER guard2 BEFORE UPDATE ON PreparationRecord BEGIN SELECT 1; END;'
                    'CREATE TRIGGER guard3 BEFORE DELETE ON PreparationRecord BEGIN SELECT 1; END;')
                db.execute('INSERT INTO _schema_migrations VALUES(?,?)',('205_preparation_records',json.dumps({
                    'sources':{'migrationSha256':s.MIGRATION_SHA,'contractVersion':'205-v1'},
                    'originalRowsPreserved':True,'backfilledCount':0})))
            after=s.snapshot(file,before)
            self.assertEqual(s.preserve(before,after)['additionalReceiptCount'],1)
            for table,sql in [('Result',"UPDATE Result SET value='changed'"),
                ('WorkAttempt',"UPDATE WorkAttempt SET status='RECORDED'"),
                ('AuditLog',"UPDATE AuditLog SET details='changed'"),
                ('WorkItemDraft',"UPDATE WorkItemDraft SET data='changed'"),
                ('_schema_migrations',"UPDATE _schema_migrations SET details='changed' WHERE id='original-receipt'")]:
                altered=pathlib.Path(folder)/(table+'.db');shutil.copyfile(file,altered)
                with sqlite3.connect(altered) as db:db.execute(sql)
                with self.subTest(table=table),self.assertRaises(AssertionError):s.preserve(before,s.snapshot(altered,before))

    def test_repeat_requires_zero_changes_and_exact_physical_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            result={'classification':'COMPLETE_205','mode':'NO_OP','totalChanges':0,'backfilledCount':0}
            with patch.object(s,'snapshot',return_value={}),patch.object(s,'physical',return_value={}),patch.object(s,'cli',return_value=result):
                self.assertEqual(s.repeat_series(root,'owned',root)[0]['totalChanges'],0)
            for fault in ['write','bytes']:
                changed={**result,'totalChanges':1 if fault=='write' else 0}
                with patch.object(s,'snapshot',return_value={}),patch.object(s,'physical',side_effect=[{},{}] if fault=='write' else [{},{'changed':True}]),patch.object(s,'cli',return_value=changed):
                    with self.subTest(fault=fault),self.assertRaises(AssertionError):s.repeat_series(root,'owned',root)

class GateGuards(unittest.TestCase):
    def fixture(self,root):
        now=datetime.datetime.now(datetime.timezone.utc)
        (root/'release-forward.py').write_bytes(pathlib.Path(release.__file__).read_bytes())
        (root/'rehearsal-receipt.json').write_text('owned fixture')
        (root/'yy-authorization-evidence.md').write_text('owned authorization fixture')
        files={name:s.sha(root/name) for name in ['release-forward.py','rehearsal-receipt.json','yy-authorization-evidence.md']}
        manifest={'status':'PREPARED_ONLY_NOT_EXECUTED','head':s.HEAD,'image':'owned-image','migrationSha256':s.MIGRATION_SHA,'files':files}
        (root/'prepared-manifest.json').write_text(json.dumps(manifest))
        body='Audit passed: OK to merge and deploy '+s.HEAD+' '+s.MIGRATION_SHA+' '+s.sha(root/'prepared-manifest.json')+' '+' '.join(files.values())
        rows=[{'number':n,'gated':True,'state':'MERGED','head':'owned-head-'+str(n),'laterAuditFailure':False,
            'auditPass':{'body':'Audit passed: OK to merge and deploy owned-head-'+str(n)},'checks':[{'conclusion':'SUCCESS'}]} for n in [288,290]]
        gate={'head':s.HEAD,'image':'owned-image','manifestSha256':s.sha(root/'prepared-manifest.json'),
            'coordinatorSha256':files['release-forward.py'],'rehearsalReceiptSha256':files['rehearsal-receipt.json'],'verifiedUtc':now.isoformat(),
            'prGates':{'head':s.HEAD,'includedPrCount':2,'prs':rows,'ungatedPrs':[],
                'mainCi':[{'name':'CI','headSha':s.HEAD,'status':'completed','conclusion':'success'}]},
            'kitReview':{'issue':162,'reviewedBy':'Claudio','url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-1','body':body,'timeUtc':now.isoformat()},
            'yyGo':{'confirmedByYY':True,'source':'CLAUDE_LIMS_AUDIT_THREAD','authorizationMode':'AUTO_AFTER_REVIEW',
                'text':'Auto after review','timeUtc':(now-datetime.timedelta(hours=1)).isoformat(),
                'evidenceSha256':files['yy-authorization-evidence.md'],'scopeEvidenceSha256':files['yy-authorization-evidence.md'],
                'scopeHead':s.HEAD,'scopeDecision':'PREPARATION_AND_RESULTS_288_290'},
            'workloadControl':{'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}}
        return manifest,gate,now

    def test_stale_wrong_head_missing_review_scope_and_workload_refuse(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);manifest,gate,now=self.fixture(root)
            with patch.object(release,'ROOT',root):
                release.verify_gate(manifest,gate,now)
                for fault in ['stale','future','head','main-ci','kit-hash','migration','old-scope','human-go','workload','later-failure']:
                    bad=copy.deepcopy(gate)
                    if fault=='stale':bad['verifiedUtc']=(now-datetime.timedelta(seconds=601)).isoformat()
                    elif fault=='future':bad['verifiedUtc']=(now+datetime.timedelta(seconds=1)).isoformat()
                    elif fault=='head':bad['head']=s.LAST_DEPLOY
                    elif fault=='main-ci':bad['prGates']['mainCi'][0]['conclusion']='failure'
                    elif fault=='kit-hash':bad['manifestSha256']='0'*64
                    elif fault=='migration':bad['kitReview']['body']=bad['kitReview']['body'].replace(s.MIGRATION_SHA,'missing')
                    elif fault=='old-scope':bad['yyGo']['scopeDecision']='Main now'
                    elif fault=='human-go':bad['yyGo']['confirmedByYY']=False
                    elif fault=='workload':bad['workloadControl']['labAndHubBuildsOwnedByYY']=False
                    elif fault=='later-failure':bad['prGates']['prs'][0]['laterAuditFailure']=True
                    with self.subTest(fault=fault),self.assertRaises(AssertionError):release.verify_gate(manifest,bad,now)

    def test_changed_frozen_source_refuses(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);manifest,gate,now=self.fixture(root)
            (root/'rehearsal-receipt.json').write_text('tampered proof')
            with patch.object(release,'ROOT',root),self.assertRaises(AssertionError):release.verify_gate(manifest,gate,now)

class DiskGuards(unittest.TestCase):
    def test_reserve_floor_scaled_budget_and_unexplained_drop(self):
        self.assertEqual(s.disk_reserve(1,1,1),8589934592)
        self.assertEqual(s.disk_reserve(4000000000,1000000000,1),15000000000)
        with self.assertRaises(AssertionError):s.check_drop({'disk':1000000000},{'disk':400000000},{'disk':0})
        self.assertEqual(s.check_drop({'disk':1000000000},{'disk':400000000},{'disk':600000000}),{'disk':0})

    def test_prequiesce_reserve_refuses_without_production_action(self):
        with patch.object(s,'disk_free',return_value={'disk':8589934591}),self.assertRaises(AssertionError):
            release.require_reserve(8589934592,'owned preflight fixture')

if __name__=='__main__':unittest.main(verbosity=2)
