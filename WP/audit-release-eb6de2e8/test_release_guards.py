"""Exercise release abort/recovery and evidence tampering without live I/O."""
import copy, datetime, hashlib, importlib.util, json, pathlib, sqlite3, subprocess, tempfile, unittest
from unittest.mock import Mock, patch
import release_support as s
import prepare_manifest as preparation

spec = importlib.util.spec_from_file_location('coordinator', pathlib.Path(__file__).with_name('release-forward.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

def acceptance_fixture():
    eligible = {**s.ACCEPTANCE_TUPLE,'reviewedAt':'2026-09-08 15:00:00','decisionCreatedAt':'2026-09-08 15:00:00'}
    payload = {'reconciliation':s.ACCEPTANCE_RECONCILIATION,'blockedWorkItemCount':1,'eligible':[eligible],'unresolved':[]}
    digest = hashlib.sha256(json.dumps(payload,separators=(',',':')).encode()).hexdigest()
    dry = {**payload,'planSha256':digest,'alreadyLinked':[],'mode':'DRY_RUN','totalChanges':0}
    event_id = '12345678-1234-4234-8234-123456789abc'
    note = 'Links recorded ReviewDecision dec-s02-p-acc (reviewedAt 2026-09-08 15:00:00); acceptance pre-dated attempt review.'
    details = {'from':'RECORDED','to':'ACCEPTED','reason':None,'note':note,'resultId':None,
        'oldResultIds':[],'newResultIds':[],'reviewDecisionId':'dec-s02-p-acc',
        'reconciliation':s.ACCEPTANCE_RECONCILIATION,'workItemId':'WI-GTM-DEMO-S02-P','linkedResultIds':['res-s02-p-run2']}
    already = {'eventId':event_id,'attemptId':'att-s02-p-2',**details}
    receipt = {'reconciliation':s.ACCEPTANCE_RECONCILIATION,'planSha256':digest,
        'links':[{**eligible,'eventId':event_id}], 'originalRowsSha256':'b'*64,
        'originalRowsAndFieldsPreserved':True,'attemptStatusChanges':1,'auditEventsAdded':1}
    receipt['receiptSha256'] = hashlib.sha256(json.dumps(receipt,separators=(',',':')).encode()).hexdigest()
    applied = {'reconciliation':s.ACCEPTANCE_RECONCILIATION,'blockedWorkItemCount':0,
        'eligible':[],'unresolved':[],'alreadyLinked':[already],'planSha256':'c'*64,
        'mode':'APPLIED','totalChanges':2,'receipt':receipt}
    repeated = {name:value for name,value in applied.items() if name != 'receipt'}
    repeated.update({'mode':'NO_OP','totalChanges':0})
    stage = {'key':s.ACCEPTANCE_KEY,'script':'link_recorded_acceptance.js','dryRun':dry,'apply':applied,
        'immediateRepeat':repeated,'immediateRepeatBefore191':True,'immediateRepeatDatabaseBytesPreserved':True,
        'applyStartedUtc':'2026-10-10T21:00:00Z','applyCompletedUtc':'2026-10-10T21:00:02Z'}
    event = {'id':event_id,'entity':'WORK_ATTEMPT','entityId':'att-s02-p-2','action':'ACCEPTED',
        'details':json.dumps(details),'performedBy':s.ACCEPTANCE_ACTOR,'performedByName':s.ACCEPTANCE_ACTOR,
        'timestamp':'2026-10-10T21:00:01Z','sampleId':'GTM-DEMO-S02','labId':'owned-lab','analysisCode':'P_OLSEN',
        'before':json.dumps({'status':'RECORDED','resultIds':[]}),
        'after':json.dumps({'status':'ACCEPTED','resultIds':[]})}
    return stage,event

class AcceptanceIntegrationGuards(unittest.TestCase):
    def test_exact_tuple_and_reviewed_plan_only(self):
        stage,_ = acceptance_fixture()
        s.verify_acceptance_plan(stage['dryRun'],stage['dryRun']['planSha256'])
        for fault in ['scope','result','decision','review-time','hash','unresolved','already-linked','write']:
            dry=copy.deepcopy(stage['dryRun'])
            if fault=='scope': dry['eligible'][0]['workItemId']='another-item'
            elif fault=='result': dry['eligible'][0]['resultIds']=['another-result']
            elif fault=='decision': dry['eligible'][0]['reviewDecisionId']='another-decision'
            elif fault=='review-time': dry['eligible'][0]['reviewedAt']='2026-09-08 16:00:00'
            elif fault=='hash': dry['planSha256']='0'*64
            elif fault=='unresolved': dry['unresolved']=[{'workItemId':'unknown'}]
            elif fault=='already-linked': dry['alreadyLinked']=[{}]
            elif fault=='write': dry['totalChanges']=1
            with self.subTest(fault=fault),self.assertRaises(AssertionError):
                s.verify_acceptance_plan(dry,stage['dryRun']['planSha256'])
        with self.assertRaises(AssertionError): s.verify_acceptance_plan(stage['dryRun'],'0'*64)

    def test_apply_and_immediate_repeat_receipts_refuse_broader_or_changed_delta(self):
        stage,_ = acceptance_fixture()
        s.verify_acceptance_stage(stage)
        for fault in ['writes','status-count','event-count','tuple','event-id','repeat-write','repeat-order','repeat-bytes']:
            changed=copy.deepcopy(stage)
            if fault=='writes': changed['apply']['totalChanges']=3
            elif fault=='status-count': changed['apply']['receipt']['attemptStatusChanges']=2
            elif fault=='event-count': changed['apply']['receipt']['auditEventsAdded']=2
            elif fault=='tuple': changed['apply']['receipt']['links'][0]['attemptId']='another-attempt'
            elif fault=='event-id': changed['immediateRepeat']['alreadyLinked'][0]['eventId']='another-event'
            elif fault=='repeat-write': changed['immediateRepeat']['totalChanges']=1
            elif fault=='repeat-order': changed['immediateRepeatBefore191']=False
            elif fault=='repeat-bytes': changed['immediateRepeatDatabaseBytesPreserved']=False
            with self.subTest(fault=fault),self.assertRaises(AssertionError): s.verify_acceptance_stage(changed)

    def test_cli_order_and_scope_immediate_repeat_before_191(self):
        stage,_=acceptance_fixture()
        seen=[]
        inventory={'releaseInventory':{'blockedWorkItemCount':0,'blockedWorkItems':[],'totalChanges':0}}
        def run(root,image,directory,script,mode,label,extra_args=()):
            seen.append((label,list(extra_args)))
            if label=='191-link-dry': return copy.deepcopy(stage['dryRun'])
            if label=='191-link-apply': return copy.deepcopy(stage['apply'])
            if label=='191-link-repeat': return copy.deepcopy(stage['immediateRepeat'])
            return {'mode':'DRY_RUN' if mode=='--dry-run' else 'NO_OP','classification':'COMPLETE','totalChanges':0,**inventory}
        with tempfile.TemporaryDirectory(prefix='lims-acceptance-order-') as owned:
            root=pathlib.Path(owned); (root/'dev.db').write_bytes(b'owned repeat bytes')
            with patch.object(s,'INSTALLERS',[('190','old.js'),(s.ACCEPTANCE_KEY,'link_recorded_acceptance.js'),('191','repeat.js')]),patch.object(s,'cli',side_effect=run):
                rows,_=s.install_series(root,'owned-image',root)
                repeats=s.repeat_series(root,'owned-image',root)
        self.assertEqual([label for label,_ in seen],['190-dry','190-apply','191-link-dry','191-link-apply','191-link-repeat','191-dry','191-apply','190-repeat','191-repeat'])
        self.assertEqual([row['key'] for row in repeats],['190','191'])
        extra=['--work-item','WI-GTM-DEMO-S02-P','--plan-sha256',stage['dryRun']['planSha256']]
        self.assertEqual(seen[3][1],extra); self.assertEqual(seen[4][1],extra)
        self.assertTrue(rows[1]['immediateRepeatDatabaseBytesPreserved'])

    def test_unreviewed_plan_refuses_before_apply_or_191(self):
        stage,_=acceptance_fixture()
        with patch.object(s,'INSTALLERS',[(s.ACCEPTANCE_KEY,'link_recorded_acceptance.js'),('191','repeat.js')]),patch.object(s,'cli',return_value=stage['dryRun']) as run:
            with self.assertRaisesRegex(AssertionError,'reviewed acceptance evidence'):
                s.install_series(pathlib.Path('/owned'),'owned-image',pathlib.Path('/owned'),acceptance_sha='0'*64)
        self.assertEqual(run.call_count,1)

class AcceptancePreservationGuards(unittest.TestCase):
    def test_exact_original_status_and_one_typed_event_only(self):
        stage,event=acceptance_fixture()
        with tempfile.TemporaryDirectory(prefix='lims-acceptance-preservation-') as owned:
            file=pathlib.Path(owned)/'dev.db'
            with sqlite3.connect(file) as db:
                db.executescript('CREATE TABLE Result(id TEXT PRIMARY KEY,value TEXT,attemptId TEXT);'
                    'CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,workItemId TEXT,status TEXT,updatedAt TEXT);'
                    'CREATE TABLE WorkItem(id TEXT PRIMARY KEY,labId TEXT,assignedLab TEXT);'
                    'CREATE TABLE AuditLog(id TEXT PRIMARY KEY,entity TEXT,entityId TEXT,action TEXT,details TEXT,performedBy TEXT,performedByName TEXT,timestamp TEXT,sampleId TEXT,labId TEXT,analysisCode TEXT,before TEXT,after TEXT);'
                    'CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT);')
                db.execute('INSERT INTO Result VALUES(?,?,?)',('res-s02-p-run2','retained analytical value','att-s02-p-2'))
                db.execute('INSERT INTO WorkAttempt VALUES(?,?,?,?)',('att-s02-p-2','WI-GTM-DEMO-S02-P','RECORDED','original time'))
                db.execute('INSERT INTO WorkItem VALUES(?,?,?)',('WI-GTM-DEMO-S02-P','owned-lab',None))
                db.execute('INSERT INTO AuditLog(id,entity,entityId,action,performedBy,timestamp) VALUES(?,?,?,?,?,?)',('original-log','SAMPLE','original-sample','CREATE','original-actor','original-time'))
                db.execute('INSERT INTO _schema_migrations VALUES(?,?)',('original-receipt','retained receipt'))
            before=s.snapshot(file)
            with sqlite3.connect(file) as db:
                db.execute("UPDATE WorkAttempt SET status='ACCEPTED' WHERE id='att-s02-p-2'")
                columns=','.join(s.quoted(name) for name in event)
                db.execute('INSERT INTO AuditLog('+columns+') VALUES('+','.join('?' for _ in event)+')',list(event.values()))
            after=s.snapshot(file,before)
            result=s.preserve(before,after,acceptance=stage)
            self.assertEqual((result['approvedAttemptStatusChanges'],result['approvedAcceptanceAuditEvents']),(1,1))
            for fault in ['attempt-field','analytical-field','original-audit','extra-event','event-actor','event-context','event-details','event-time','missing-event','receipt']:
                changed=copy.deepcopy(after)
                if fault=='attempt-field': changed['keyed']['WorkAttempt']['att-s02-p-2']['updatedAt']='invented-time'
                elif fault=='analytical-field': changed['keyed']['Result']['res-s02-p-run2']['value']='different-value'
                elif fault=='original-audit': changed['keyed']['AuditLog']['original-log']['action']='different-action'
                elif fault=='extra-event': changed['keyed']['AuditLog']['rogue']=dict(event,id='rogue')
                elif fault=='event-actor': changed['keyed']['AuditLog'][event['id']]['performedBy']='other-actor'
                elif fault=='event-context': changed['keyed']['AuditLog'][event['id']]['labId']='other-lab'
                elif fault=='event-details': changed['keyed']['AuditLog'][event['id']]['details']='{}'
                elif fault=='event-time': changed['keyed']['AuditLog'][event['id']]['timestamp']='2026-10-10T20:00:00Z'
                elif fault=='missing-event': del changed['keyed']['AuditLog'][event['id']]
                elif fault=='receipt': changed['keyed']['_schema_migrations']['original-receipt']['details']='changed-receipt'
                with self.subTest(fault=fault),self.assertRaises(AssertionError): s.preserve(before,changed,acceptance=stage)

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

    def test_repeat_inventory_refuses_blocked_owners_before_apply(self):
        ready = {'releaseInventory':{'blockedWorkItemCount':0,'blockedWorkItems':[],'totalChanges':0},'totalChanges':0}
        s.verify_repeat_inventory(ready)
        for inventory in [{'blockedWorkItemCount':1,'blockedWorkItems':[{'workItemId':'owned-blocker'}],'totalChanges':0},
                          {'blockedWorkItemCount':0,'blockedWorkItems':[],'totalChanges':1}]:
            with self.assertRaises(AssertionError):
                s.verify_repeat_inventory({'releaseInventory':inventory})
        with tempfile.TemporaryDirectory(prefix='lims-repeat-refusal-') as owned:
            with patch.object(s,'INSTALLERS',[('191','owned-repeat.js')]), \
                 patch.object(s,'cli',return_value={'releaseInventory':{'blockedWorkItemCount':1,'blockedWorkItems':[{}],'totalChanges':0},'totalChanges':0}) as run:
                with self.assertRaisesRegex(AssertionError,'Blocked #191 owners'):
                    s.install_series(pathlib.Path(owned),'owned-image',pathlib.Path(owned))
            self.assertEqual(run.call_count,1)
            self.assertEqual(run.call_args.args[4],'--dry-run')

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
        now = datetime.datetime(2026,10,10,21,tzinfo=datetime.timezone.utc)
        manifest = {'status':'PREPARED_ONLY_NOT_EXECUTED','head':s.HEAD,'image':'owned-image',
            'attemptPlanSha256':'d'*64,'files':{'release-forward.py':'a'*64,'rehearsal-receipt.json':'b'*64,
                'yy-authorization-evidence.md':'e'*64,'yy-191-review-choice-evidence.md':'f'*64},
            'acceptanceTuple':s.ACCEPTANCE_TUPLE,'acceptancePlanSha256':'1'*64}
        rows = []
        for number in s.INCLUDED_PRS:
            head = format(number,'040x')
            rows.append({'number':number,'head':head,'state':'MERGED','gated':True,
                'laterAuditFailure':False,'auditPass':{'body':'Audit passed: OK to merge and deploy '+head},
                'checks':[{'conclusion':'SUCCESS'}]})
        gate = {'head':s.HEAD,'image':'owned-image','manifestSha256':'c'*64,
            'coordinatorSha256':'a'*64,'rehearsalReceiptSha256':'b'*64,'verifiedUtc':now.isoformat(),
            'prGates':{'head':s.HEAD,'includedPrCount':len(s.INCLUDED_PRS),'ungatedPrs':[],'prs':rows,
                'mainCi':[{'name':'CI','headSha':s.HEAD,'status':'completed','conclusion':'success'}]},
            'kitReview':{'issue':162,'reviewedBy':'Claudio',
                'url':'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-owned-test',
                'body':'Audit passed: OK to merge and deploy '+s.HEAD+' '+'a'*64+' '+'b'*64+' '+'c'*64+' '+'1'*64+' '+'f'*64,
                'approvedAttemptPlanSha256':'d'*64,'approvedAcceptancePlanSha256':'1'*64,
                'approvedYY191ReviewChoiceSha256':'f'*64,'timeUtc':now.isoformat()},
            'yy191ReviewChoice':{'source':'CLAUDE_LIMS_AUDIT_THREAD_ORIGINAL_CARD','choice':'Link recorded accept',
                'timeUtc':'2026-10-10T20:00:00Z','timePrecision':'minute','workItemId':s.ACCEPTANCE_TUPLE['workItemId'],'evidenceSha256':'f'*64},
            'yyGo':{'confirmedByYY':True,'source':'CLAUDE_LIMS_AUDIT_THREAD','evidenceSha256':'e'*64,
                'timeUtc':(now-datetime.timedelta(hours=1)).isoformat(),'authorizationMode':'AUTO_AFTER_REVIEW',
                'text':'Auto after review','scopeHead':s.HEAD,'scopeDecision':'Main now','scopeEvidenceSha256':'e'*64},
            'workloadControl':{'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED'}}
        return manifest, gate, now

    def verify(self, manifest, gate, now):
        def file_hash(file):
            name = pathlib.Path(file).name
            return {'prepared-manifest.json':'c'*64,'release-forward.py':'a'*64,'rehearsal-receipt.json':'b'*64,
                'yy-authorization-evidence.md':'e'*64,'yy-191-review-choice-evidence.md':'f'*64}[name]
        with patch.object(s,'sha',side_effect=file_hash):
            release.verify_gate(manifest,gate,now)

    def test_existing_yy_auto_choice_only_runs_after_exact_kit_pass(self):
        self.verify(*self.fixture())

    def test_missing_phrase_wrong_commit_hash_and_stale_gate_refuse(self):
        for fault in ['phrase','head','hash','stale','repair','future','plan','yy-evidence','yy-scope','acceptance-plan','yy191-evidence','yy191-choice','acceptance-tuple']:
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
            elif fault == 'yy-evidence':
                gate['yyGo']['evidenceSha256'] = '0'*64
            elif fault == 'yy-scope':
                gate['yyGo']['scopeEvidenceSha256'] = '0'*64
            elif fault == 'acceptance-plan': gate['kitReview']['approvedAcceptancePlanSha256']='0'*64
            elif fault == 'yy191-evidence': gate['yy191ReviewChoice']['evidenceSha256']='0'*64
            elif fault == 'yy191-choice': gate['yy191ReviewChoice']['choice']='Reopen and amend'
            elif fault == 'acceptance-tuple': manifest['acceptanceTuple']={**s.ACCEPTANCE_TUPLE,'attemptId':'other-attempt'}
            with self.subTest(fault=fault), self.assertRaises(AssertionError):
                self.verify(manifest,gate,now)

class CompleteRehearsalGuards(unittest.TestCase):
    def fixture(self):
        proof = {'status':'PASSED','productionExecution':False,'head':s.HEAD,'candidateImage':'owned-image',
            'repeatTotalChanges':0,'startupChanges':0,'readOnlyProbeChanges':0,
            'repeatedInstallDatabaseBytesPreserved':True,
            'installers':[{'key':key,'script':script} for key,script in s.INSTALLERS],
            'repeatInstallers':[{'key':key,'mode':'NO_OP','totalChanges':0} for key,_ in s.INSTALLERS if key!=s.ACCEPTANCE_KEY],
            'startupReady':[{'event':name+'_STARTUP_READY','totalChanges':0} for name in s.READY_EVENTS],
            'apiChecks':{'passed':31,'total':31,'failed':0},
            'probes':[{'file':name,'exitCode':0} for name in preparation.SCRIPTS if name.startswith('postflight-')]
                + [{'file':'readonly-smoke.cjs','exitCode':0}],
            'health':{'status':'ok'},'benchCredentialCount':0,
            'preservation':{'originalRowsAndFieldsPreserved':True,'integrity':'ok','foreignKeyViolations':0,
                'createdAttempts':17,'approvedNullResultLinks':19,'originalTableCount':90,'originalReceiptsPreserved':18,
                'approvedAttemptStatusChanges':1,'approvedAcceptanceAuditEvents':1},
            'attemptDryRun':{'totalChanges':0,'mode':'DRY_RUN','classification':'PRE_190',
                'plan':{'status':'READY','planSha256':'d'*64}},'attemptPlanSha256':'d'*64,
            'cliMemory':{key+'-'+mode+'-container.json':{'memoryLimitBytes':805306368,'nodeOptions':None,
                'exitCode':0,'cgroupMemoryPeak':{'childStatus':0,'childSignal':None,'releaseCliPeakBytes':100000000}}
                for key,_ in s.INSTALLERS for mode in ['dry','apply','repeat']},
            'startupMemoryAtReady':{'limitBytes':805306368,'nodeOptions':None,'peakBytes':300000000},
            'startupMemory':{'limitBytes':805306368,'nodeOptions':None,'peakBytes':320000000}}
        build = {'head':s.HEAD,'image':'owned-image','status':'BUILT_ONLY_NOT_DEPLOYED','productionDatabaseMounts':0}
        gates = {'head':s.HEAD,'includedPrCount':len(s.INCLUDED_PRS),'ungatedPrs':[],
            'prs':[{'number':number,'gated':True} for number in s.INCLUDED_PRS],
            'mainCi':[{'name':'CI','headSha':s.HEAD,'status':'completed','conclusion':'success'}]}
        repeat = next(row for row in proof['installers'] if row['key']=='191')
        repeat['dryRun'] = repeat['apply'] = {'releaseInventory':{'blockedWorkItemCount':0,'blockedWorkItems':[],'totalChanges':0}}
        stage,_=acceptance_fixture()
        proof['installers'][[key for key,_ in s.INSTALLERS].index(s.ACCEPTANCE_KEY)]=stage
        proof['acceptancePlanSha256']=stage['dryRun']['planSha256']
        return proof,build,gates

    def test_complete_bounded_rehearsal_is_accepted(self):
        preparation.validate(*self.fixture())

    def test_partial_failed_unbounded_changed_or_stale_proof_is_refused(self):
        for fault in ['partial','installer','repeat','ready','probe','api','memory-missing','memory-over',
                      'heap-override','startup-memory','preservation','main-ci','image','row-plan','blocked-owner',
                      'acceptance-repeat','acceptance-delta','acceptance-proof-hash','missing-289']:
            proof,build,gates = self.fixture()
            if fault == 'partial': proof['status'] = 'PASSED_STARTUP_API_SUPPLEMENT'
            elif fault == 'installer': proof['installers'].reverse()
            elif fault == 'repeat': proof['repeatInstallers'][0]['totalChanges'] = 1
            elif fault == 'ready': proof['startupReady'].pop()
            elif fault == 'probe': proof['probes'].pop()
            elif fault == 'api': proof['apiChecks']['failed'] = 1
            elif fault == 'memory-missing': proof['cliMemory'].pop('193-apply-container.json')
            elif fault == 'memory-over': proof['cliMemory']['193-apply-container.json']['cgroupMemoryPeak']['releaseCliPeakBytes'] = 805306369
            elif fault == 'heap-override': proof['cliMemory']['193-apply-container.json']['nodeOptions'] = '--max-old-space-size=1536'
            elif fault == 'startup-memory': proof['startupMemory']['peakBytes'] = 0
            elif fault == 'preservation': proof['preservation']['originalRowsAndFieldsPreserved'] = False
            elif fault == 'main-ci': gates['mainCi'][0]['headSha'] = '0'*40
            elif fault == 'image': build['image'] = 'other-image'
            elif fault == 'row-plan': proof['attemptPlanSha256'] = '0'*64
            elif fault == 'blocked-owner':
                next(row for row in proof['installers'] if row['key']=='191')['dryRun']['releaseInventory']['blockedWorkItemCount']=1
            elif fault == 'acceptance-repeat': next(row for row in proof['installers'] if row['key']==s.ACCEPTANCE_KEY)['immediateRepeatBefore191']=False
            elif fault == 'acceptance-delta': proof['preservation']['approvedAcceptanceAuditEvents']=2
            elif fault == 'acceptance-proof-hash': proof['acceptancePlanSha256']='0'*64
            elif fault == 'missing-289': gates['prs'][-1]['number']=999
            with self.subTest(fault=fault), self.assertRaises(AssertionError):
                preparation.validate(proof,build,gates)

class RecoveryGuards(unittest.TestCase):
    def test_forced_prequiesce_reserve_failure_preserves_owned_database(self):
        with tempfile.TemporaryDirectory(prefix='lims-reserve-prequiesce-') as owned:
            database=pathlib.Path(owned)/'dev.db'
            with sqlite3.connect(database) as db:
                db.executescript("CREATE TABLE AuditLog(id TEXT PRIMARY KEY,message TEXT); INSERT INTO AuditLog VALUES('retained','original');")
            original=s.physical(database)
            release.held=False
            release.installer_attempted=False
            release.receipt={}
            with patch.object(s,'disk_free',return_value={'/opt/lims':8589934591,'/var/lib/docker':8589934591}), \
                 patch.object(release,'save'),patch.object(release,'maintenance') as maintenance, \
                 patch.object(release,'stop_app') as stop,patch.object(release,'start_app') as start, \
                 patch.object(s,'consistent_backup') as backup,patch.object(s,'cli') as cli:
                with self.assertRaisesRegex(AssertionError,'pre-quiesce') as error:
                    release.require_reserve(8589934592,'pre-quiesce final')
                release.recover_failure(error.exception)
            self.assertEqual(s.physical(database),original)
            self.assertEqual(release.receipt['status'],'REFUSED_BEFORE_MAINTENANCE')
            for operation in [maintenance,stop,start,backup,cli]: operation.assert_not_called()

    def test_forced_between_installers_reserve_failure_keeps_additive_database_and_forward_hold(self):
        with tempfile.TemporaryDirectory(prefix='lims-reserve-between-installers-') as owned:
            database=pathlib.Path(owned)/'dev.db'
            with sqlite3.connect(database) as db:
                db.executescript("CREATE TABLE AuditLog(id TEXT PRIMARY KEY,message TEXT); INSERT INTO AuditLog VALUES('retained','original');")
            old=s.physical(database)
            # Represent an already completed additive installer on this owned DB.
            with sqlite3.connect(database) as db: db.execute('CREATE TABLE ReviewedAdditiveEvidence(id TEXT PRIMARY KEY)')
            installed=s.physical(database)
            self.assertNotEqual(installed,old)
            release.held=True
            release.installer_attempted=True
            release.receipt={'preApplyState':{},'preApplyFiles':old}
            with patch.object(s,'disk_free',return_value={'/opt/lims':8589934591,'/var/lib/docker':8589934591}), \
                 patch.object(release,'writers_stopped'),patch.object(release,'save'),patch.object(release,'mark') as mark, \
                 patch.object(release,'maintenance') as maintenance,patch.object(release,'stop_app') as stop, \
                 patch.object(release,'start_app') as start,patch.object(s,'consistent_backup') as backup,patch.object(s,'cli') as cli:
                with self.assertRaisesRegex(AssertionError,'installer 192') as error:
                    release.guard_install_disk('192',8589934592)
                release.recover_failure(error.exception)
            self.assertEqual(s.physical(database),installed)
            self.assertEqual(release.receipt['status'],'FAILED_FORWARD_HOLD')
            self.assertTrue(release.held)
            maintenance.assert_called_once(); stop.assert_called_once()
            for operation in [start,backup,cli,mark]: operation.assert_not_called()
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute('SELECT message FROM AuditLog').fetchall(),[('original',)])
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')

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
