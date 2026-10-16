"""New Step2 positive and adversarial fixtures; no real runtime interfaces."""
import copy,datetime,hashlib,hmac,json,os,pathlib,sqlite3,unittest
from unittest import mock
import provenance_privacy as p
import provenance_rules as r
import controller_guard as cg
import stop_owned as stop
from proof_contract import ROOT,IMAGE,MEMORY,sha,canonical,require
T='2026-10-16T03:00:00Z';MS=round(datetime.datetime.fromisoformat(T.replace('Z','+00:00')).timestamp()*1000)
def setUpModule():
    if p._value_key is None:p.install_value_key(bytes(range(32)))
def fixture(new=False,intra=False):
    old={'id':'s','assignedLab':'LAB','projectCode':'PROJECT','status':'EXPECTED','labId':None,'metadata':json.dumps({'kobo_id':100,'sourceServerUrl':'https://example.invalid','sourceFormId':'form','depth':'D1','retained':{'x':[7]}}),'fieldMetadata':'{}','rejectionReason':None,'updatedAt':1,'latitude':None,'approvedBy':None}
    after=copy.deepcopy(old);m=json.loads(old['metadata']);entry={'kobo_id':101,'sourceServerUrl':'https://example.invalid','sourceFormId':'form','depth':'D2','occurrenceKey':'https://example.invalid:form:101:D2','evidenceFingerprint':'f'*64,'recordedAt':T,'lat':-12.3456789,'surveyor':'PRIVATE_SENTINEL'}
    m['conflictingSubmissions']=[entry];m['provenanceHold']={'status':p.HOLD_ACTIVE,'reason':p.CROSS_REASON,'primaryOccurrence':{'kobo_id':100},'conflictingCount':1,'updatedAt':T};after.update(metadata=json.dumps(m),rejectionReason=p.REJECTION,updatedAt=MS)
    config={'id':'config','labId':'LAB','projectCode':'PROJECT','isActive':1,'koboServerUrl':'https://example.invalid','formId':'form','lastSubmissionId':'99','lastSyncAt':None,'updatedAt':1,'syncIntervalMins':15}
    fetch={'config':{'configId':'config','labId':'LAB','projectCode':'PROJECT','sourceIdentitySha256':sha(json.dumps(['https://example.invalid','form']).encode()),'submissionIds':['100','101','102']}}
    h={'id':'h','sampleId':'s','type':'PROVENANCE','raisedBy':'system:kobo-sync','compatMarker':'KOBO_PROVENANCE','attributionSource':'LIVE','reason':p.CROSS_REASON,'raisedAt':MS,'resolvedBy':None,'resolvedAt':None,'resolution':None}
    audits=[{'id':'ha','entity':'SAMPLE_HOLD','entityId':'h','action':'HOLD_RAISED','performedBy':'system:kobo-sync','sampleId':'s','labId':'LAB','timestamp':MS,'before':None,'after':json.dumps(h),'details':None},{'id':'ca','entity':'SAMPLE','entityId':'s','action':'KOBO_CONFLICTING_PROVENANCE','performedBy':'KOBO_SCHEDULER','sampleId':None,'labId':None,'timestamp':MS+1,'before':None,'after':None,'details':None}]
    if new:audits.append({'id':'create','entity':'SAMPLE','entityId':'s','action':'CREATE_KOBO_SYNC','performedBy':'KOBO_SCHEDULER','sampleId':'s','labId':'LAB','timestamp':MS-1,'before':None,'after':None,'details':json.dumps({'status':'EXPECTED','context':'ordinary'})})
    if intra:
        m=json.loads(old['metadata']);d={'sourceServerUrl':'https://example.invalid','sourceFormId':'form','depth':'D2','kobo_submission_id':100,'reason':'INTRA_SUBMISSION_DUPLICATE_BARCODE'};m['intraSubDuplicates']=[d];m['provenanceHold']={'status':p.HOLD_ACTIVE,'reason':p.INTRA_REASON,'duplicates':[d],'updatedAt':T}
        after.update(metadata=json.dumps(m),rejectionReason=p.INTRA_REJECTION,fieldMetadata=json.dumps({'provenanceHold':{'value':p.HOLD_ACTIVE}}));h['reason']=p.INTRA_REASON;audits[0]['after']=json.dumps(h);audits[1]['action']='KOBO_INTRA_SUBMISSION_DUPLICATE'
    return {'old':old,'after':after,'configs':{'config':config},'fetch':fetch,'ids':{'config':['100','101','102']},'holds':[h],'audits':audits,'notifications':[],'managers':{},'new':new}
def verify(f,prior=None,batches=None):
    return r.validate_added_and_changed([] if f['new'] else [(f['old'],f['after'])],{'s':f['after']} if f['new'] else {},f['holds'],f['audits'],f['notifications'],f['configs'],f['fetch'],f['ids'],f['managers'],prior,batches)
def edit_metadata(f,fn,which='after'):
    v=json.loads(f[which]['metadata']);fn(v);f[which]['metadata']=json.dumps(v)
class ProvenanceGuards(unittest.TestCase):
    def test_original_expected_conflict_exact_pair_passes(self):self.assertEqual(verify(fixture())['changedSamples'][0]['classification'],'CROSS_SUBMISSION_DUPLICATE')
    def test_new_sample_later_same_sync_conflict_exact_pair_passes(self):self.assertEqual(verify(fixture(True))['newSampleCount']['config'],1)
    def test_new_intra_exact_hold_and_audit_pass(self):self.assertTrue(verify(fixture(True,True))['allAddedHoldAuditRowsExactlyConsumed'])
    def test_second_sync_no_conflict_changes_pass(self):
        f=fixture();self.assertTrue(r.validate_added_and_changed([],{},[],[],[],f['configs'],f['fetch'],f['ids'],{}, {'config':['100','101']})['allAddedHoldAuditRowsExactlyConsumed'])
    def test_second_conflict_new_id_above_first_max_passes(self):self.assertTrue(verify(fixture(),{'config':['100']})['allAddedHoldAuditRowsExactlyConsumed'])
    def test_public_report_exposes_neither_leaf_nor_plain_leaf_hash(self):
        raw=json.dumps(verify(fixture()));self.assertNotIn('PRIVATE_SENTINEL',raw);self.assertNotIn('-12.3456789',raw);self.assertNotIn(sha(canonical('PRIVATE_SENTINEL')),raw)
    def test_notification_one_per_scoped_manager_exact(self):
        f=fixture(True);f['managers']={'mgr':'LAB'};f['notifications']=[{'id':'n','userId':'mgr','link':'/samples?view=expected&projects=PROJECT&labs=LAB','message':'1 new sample synced from Kobo (Lab)','type':'SUCCESS','title':'\U0001f33e New Field Samples Collected','isRead':0}]
        self.assertEqual(len(verify(f)['notificationExpectations']),1)
    def test_full_two_phase_notification_batches_are_exact(self):
        f=fixture(True);f['managers']={'mgr':'LAB'};f['notifications']=[{'id':'n','userId':'mgr','link':'/samples?view=expected&projects=PROJECT&labs=LAB','message':'1 new sample synced from Kobo (Lab)','type':'SUCCESS','title':'\U0001f33e New Field Samples Collected','isRead':0}]
        self.assertEqual(len(verify(f,batches=[[{'configId':'config','userId':'mgr','count':1}],[]])['notificationExpectations']),1)
def negative(name,mutate,new=False,intra=False,prior=None):
    def test(self):
        f=fixture(new,intra);mutate(f)
        with self.assertRaises((RuntimeError,ValueError,KeyError,TypeError)):verify(f,prior)
    test.__name__='test_refuse_'+name;setattr(ProvenanceGuards,test.__name__,test)
negative('non_expected',lambda f:f['old'].update(status='RECEIVED'))
negative('status_change',lambda f:f['after'].update(status='APPROVED'))
negative('scientific_column',lambda f:f['after'].update(latitude=12))
negative('rejection_overwrite',lambda f:f['old'].update(rejectionReason='RETAIN'))
negative('old_nested_value_modified',lambda f:edit_metadata(f,lambda m:m['retained']['x'].append(8)))
negative('old_metadata_deleted',lambda f:edit_metadata(f,lambda m:m.pop('retained')))
negative('missing_hold',lambda f:f['holds'].clear())
negative('missing_hold_audit',lambda f:f['audits'].pop(0))
negative('missing_conflict_audit',lambda f:f['audits'].pop(1))
negative('extra_conflict_audit',lambda f:f['audits'].append({**f['audits'][1],'id':'extra'}))
negative('extra_create_on_changed_original',lambda f:f['audits'].append({'id':'extra','entity':'SAMPLE','entityId':'s','action':'CREATE_KOBO_SYNC','performedBy':'KOBO_SCHEDULER'}))
negative('orphan_audit',lambda f:f['audits'].append({'id':'extra','entity':'SAMPLE','entityId':'other','action':'CREATE_KOBO_SYNC'}))
negative('unfetched_conflict_id',lambda f:(f['fetch']['config'].update(submissionIds=['100','102']),f['ids'].update(config=['100','102'])))
negative('foreign_scope',lambda f:f['old'].update(assignedLab='FOREIGN'))
negative('inactive_scope',lambda f:f['configs']['config'].update(isActive=0))
negative('refusal_scope',lambda f:None,prior={'config':['100','101']})
negative('occurrence_key',lambda f:edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(occurrenceKey='wrong')))
negative('hold_audit_payload',lambda f:f['audits'][0].update(after='{}'))
negative('hold_actor',lambda f:f['holds'][0].update(raisedBy='human'))
negative('hold_reason',lambda f:f['holds'][0].update(reason='wrong'))
negative('cross_audit_actor',lambda f:f['audits'][1].update(performedBy='human'))
negative('cross_audit_invented_payload',lambda f:f['audits'][1].update(details='private'))
negative('regressing_updated_time',lambda f:f['after'].update(updatedAt=0))
negative('second_reappend',lambda f:None,prior={'config':['100','101']})
negative('second_unseen_below_prior_max',lambda f:None,prior={'config':['100','102']})
negative('second_missing_first_fetch',lambda f:None,prior={})
negative('fetch_record_source',lambda f:f['fetch']['config'].update(sourceIdentitySha256='0'*64))
negative('new_same_sync_foreign_source',lambda f:edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(sourceFormId='other')),True)
negative('new_same_sync_unfetched',lambda f:edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(kobo_id=999,occurrenceKey='https://example.invalid:form:999:D2')),True)
negative('new_same_sync_occurrence',lambda f:edit_metadata(f,lambda m:m['conflictingSubmissions'][0].update(occurrenceKey='wrong')),True)
negative('new_same_sync_missing_pair',lambda f:f['audits'].pop(1),True)
negative('new_missing_create',lambda f:f['audits'].pop(),True)
negative('new_extra_create',lambda f:f['audits'].append({**f['audits'][-1],'id':'extra'}),True)
negative('new_create_wrong_actor',lambda f:f['audits'][-1].update(performedBy='human'),True)
negative('intra_missing_hold',lambda f:f['holds'].clear(),True,True)
negative('intra_missing_audit',lambda f:f['audits'].pop(1),True,True)
negative('intra_wrong_submission',lambda f:edit_metadata(f,lambda m:m['intraSubDuplicates'][0].update(kobo_submission_id=999)),True,True)
negative('intra_wrong_source',lambda f:edit_metadata(f,lambda m:m['intraSubDuplicates'][0].update(sourceFormId='foreign')),True,True)
negative('intra_same_depth',lambda f:edit_metadata(f,lambda m:m['intraSubDuplicates'][0].update(depth='D1')),True,True)
negative('missing_notification',lambda f:f['managers'].update(mgr='LAB'),True)
negative('extra_notification',lambda f:f['notifications'].append({'id':'extra','userId':'x'}),True)

class OwnUnitGuards(unittest.TestCase):
    def raw(self,oom=0,kill=0,limit=MEMORY,swap=0,member=None):
        data={'/proc/self/cgroup':('0::/system.slice/'+cg.UNIT+'\n').encode() if member is None else member}
        values={'memory.events':('low 0\nhigh 0\nmax 6859\noom '+str(oom)+'\noom_kill '+str(kill)+'\n').encode(),'memory.current':b'123\n','memory.peak':str(MEMORY+8192).encode(),'memory.max':str(limit).encode(),'memory.swap.max':str(swap).encode()}
        return lambda name:data[name] if name in data else values[name.rsplit('/',1)[1]]
    def test_own_peak_and_max_are_observations(self):self.assertEqual(cg.own_snapshot(self.raw())['events']['max'],6859)
    def test_own_oom_refuses(self):
        with self.assertRaises(RuntimeError):cg.own_snapshot(self.raw(oom=1))
    def test_own_oom_kill_refuses(self):
        with self.assertRaises(RuntimeError):cg.own_snapshot(self.raw(kill=1))
    def test_own_swap_refuses(self):
        with self.assertRaises(RuntimeError):cg.own_snapshot(self.raw(swap=1))
    def test_foreign_unit_refuses(self):
        with self.assertRaises(RuntimeError):cg.own_snapshot(self.raw(member=b'0::/system.slice/foreign.service\n'))
    def test_duplicate_counter_refuses(self):
        with self.assertRaises(RuntimeError):cg.parse_events(b'oom 0\noom 0\noom_kill 0\nmax 0\nhigh 0\n')

class StopPostGuards(unittest.TestCase):
    def exercise(self,foreign=False,failfirst=False):
        calls=[];running={o:True for o in stop.OWNERS};idmap={('a' if o.endswith('1') else 'b')*64:o for o in stop.OWNERS}
        def interface(args):
            calls.append(args)
            if args[1]=='ps':
                owner=args[-1].split('=',2)[2];return next(i for i,o in idmap.items() if o==owner).encode()+b'\n'
            id=args[-1];owner=idmap[id]
            if args[1]=='stop':
                if failfirst and owner.endswith('1'):raise RuntimeError('synthetic failure')
                running[owner]=False;return id.encode()+b'\n'
            v={'Id':id,'Name':'/lims-owned-batch-'+sha(owner.encode())[:24],'Image':IMAGE,'Config':{'Labels':{stop.LABEL:owner if not foreign else '/foreign'}},'HostConfig':{'RestartPolicy':{'Name':'no'}},'State':{'Running':running[owner],'StartedAt':'start'},'Mounts':[{'Type':'bind','RW':True,'Source':str(ROOT)+'/child'+str(k),'Destination':d} for k,d in enumerate(['/app/server/prisma','/app/server/uploads','/tmp'])]}
            return json.dumps([v]).encode()
        return stop.stop_exact(interface),calls,running
    def test_killed_controller_hook_finds_labels_without_controller_id_list(self):
        result,calls,running=self.exercise();self.assertTrue(result['allExactOwnedStopped']);self.assertFalse(any(running.values()));self.assertEqual(sum(a[1]=='stop' for a in calls),2)
    def test_foreign_owner_never_stops(self):
        result,calls,running=self.exercise(foreign=True);self.assertFalse(result['allExactOwnedStopped']);self.assertFalse(any(a[1]=='stop' for a in calls))
    def test_one_owner_failure_does_not_prevent_other_owner_stop(self):
        result,calls,running=self.exercise(failfirst=True);self.assertFalse(result['allExactOwnedStopped']);self.assertEqual(sum(a[1]=='stop' for a in calls),2);self.assertEqual(sum(running.values()),1)
    def test_unit_hook_is_bound_before_any_start(self):
        from launch_proof import remote_sources
        sources=remote_sources({'stop_owned.py':'f'*64},4096)
        self.assertIn(b'ExecStopPost=/usr/bin/python3 -B ',sources['unit']);self.assertIn(b'stop_owned.py',sources['unit'])
        for n,b in sources.items():compile(b,n,'exec')

class KeyGuards(unittest.TestCase):
    def test_no_key_fallback(self):
        with mock.patch.object(p,'_value_key',None):
            with self.assertRaises(RuntimeError):p.value_hash(1)
    def test_known_hmac_and_private_error(self):
        with mock.patch.object(p,'_value_key',bytes(range(32))):
            self.assertEqual(p.value_hash('secret'),hmac.new(bytes(range(32)),canonical('secret'),hashlib.sha256).hexdigest());self.assertNotIn('PRIVATE',json.dumps(p.public_failure(ValueError('PRIVATE'))))
    def test_key_created_exclusively_0400_in_new_owned_root(self):
        root=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).with_name(pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).name+'-step2-key');root.mkdir()
        with mock.patch.object(p,'_value_key',None):
            p.initialize_private_key(root);value=json.loads((root/'private-value-hmac-key.json').read_bytes());self.assertEqual(len(bytes.fromhex(value['keyHex'])),32)
            with self.assertRaises(FileExistsError):p.initialize_private_key(root)

class FullStoreGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).with_name(pathlib.Path(os.environ['LIMS_PROOF_GUARD_FIXTURE_DIR']).name+'-step2-sql');cls.root.mkdir()
    def pair(self,new=False):
        f=fixture(new);root=self.root/self._testMethodName;root.mkdir();a=root/'baseline.db';b=root/'current.db'
        notification={'id':'n','userId':'mgr','link':'','message':'','type':'','title':'','isRead':0}
        for path,after in [(a,False),(b,True)]:
            db=sqlite3.connect(path)
            for name,row in [('Sample',f['old']),('KoboConfig',f['configs']['config']),('SampleHold',f['holds'][0]),('AuditLog',f['audits'][0]),('Notification',notification)]:
                db.execute('CREATE TABLE '+r.quoted(name)+'('+','.join(r.quoted(k)+(' TEXT PRIMARY KEY' if k=='id' else '') for k in row)+')')
            db.execute('CREATE TABLE User(id TEXT PRIMARY KEY,labId,isActive,role)');db.execute('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY)');db.executemany('INSERT INTO _schema_migrations VALUES (?)',[('m'+str(i),) for i in range(42)])
            for i in range(105):db.execute('CREATE TABLE T'+str(i).zfill(3)+'(id TEXT PRIMARY KEY,value)')
            db.execute("INSERT INTO T104 VALUES ('protected','old')")
            def put(table,row):db.execute('INSERT INTO '+r.quoted(table)+'('+','.join(map(r.quoted,row))+') VALUES('+','.join('?' for k in row)+')',list(row.values()))
            put('KoboConfig',f['configs']['config'])
            if not new or after:put('Sample',f['after'] if after else f['old'])
            if after:
                for h in f['holds']:put('SampleHold',h)
                for audit in f['audits']:put('AuditLog',audit)
            db.commit();db.close()
        return root,a,b,f
    def verify(self,args,prior=None):
        from kobo_copy_preservation import verify_copy
        root,a,b,f=args
        return verify_copy(a,b,112,fetched_ids=f['ids'],prior_fetched_ids=prior,fetch_records=f['fetch'],owner_root=root)
    def test_actual_full112_original_conflict_passes_exact_only(self):
        v=self.verify(self.pair());self.assertEqual(v['protectedTableCount'],112);self.assertFalse(v['allOriginalRowsPreserved']);self.assertTrue(v['allOriginalRowsPreservedExceptExactProvenance']);self.assertEqual(len(v['changedSamples']),1)
    def test_actual_full112_new_same_sync_conflict_passes(self):self.assertEqual(self.verify(self.pair(True))['newSampleCount']['config'],1)
    def test_actual_full112_orphan_audit_refuses(self):
        args=self.pair();db=sqlite3.connect(args[2]);db.execute("UPDATE AuditLog SET entityId='orphan' WHERE id='ca'");db.commit();db.close()
        with self.assertRaises(RuntimeError):self.verify(args)
    def test_actual_protected_last_table_change_refuses(self):
        args=self.pair();db=sqlite3.connect(args[2]);db.execute("UPDATE T104 SET value='bad'");db.commit();db.close()
        with self.assertRaises(RuntimeError):self.verify(args)
    def test_actual_deleted_schema_receipt_refuses(self):
        args=self.pair();db=sqlite3.connect(args[2]);db.execute("DELETE FROM _schema_migrations WHERE id='m41'");db.commit();db.close()
        with self.assertRaises(RuntimeError):self.verify(args)
    def test_actual_second_sync_reappend_refuses(self):
        with self.assertRaises(RuntimeError):self.verify(self.pair(),{'config':['100','101']})
    def test_actual_missing_full_fetch_record_refuses(self):
        args=self.pair();args[3]['fetch']={}
        with self.assertRaises(RuntimeError):self.verify(args)
    def test_actual_old_input_sql_refused_before_connect(self):
        from kobo_copy_preservation import verify_copy
        with mock.patch.object(sqlite3,'connect',side_effect=AssertionError('SQL before ownership')):
            with self.assertRaises(RuntimeError):verify_copy('/old/backup.db',self.root/'current.db',owner_root=self.root)
