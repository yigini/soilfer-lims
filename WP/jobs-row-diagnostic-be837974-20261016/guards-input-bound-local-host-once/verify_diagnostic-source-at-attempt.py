"""New closed synthetic guards only. NEVER call a real operational interface."""
import ast,copy,json,os,pathlib,sqlite3,unittest
from unittest import mock
import diagnostic_contract as c
import diagnostic_io as io
import diagnostic_compare as d
import launch_diagnostic as launch
import prepare_diagnostic as prep
class MemorySink:
    def __init__(self):self.rows=[]
    def write(self,n,v):self.rows.append((n,v))
def fixture():
    before={'id':'original-sample','assignedLab':'LAB','projectCode':'PROJECT','status':'EXPECTED','metadata':json.dumps({'kobo_id':1,'sourceServerUrl':'https://example.invalid','sourceFormId':'form','depth':'D1','retained':{'x':1}}),'fieldMetadata':'{}','rejectionReason':None,'updatedAt':1,'approvedBy':None}
    after=copy.deepcopy(before);a=json.loads(before['metadata']);e={'kobo_id':2,'sourceServerUrl':'https://example.invalid','sourceFormId':'form','depth':'D1','occurrenceKey':'https://example.invalid:form:2:D1','evidenceFingerprint':'new-fp','recordedAt':'2026-10-16T01:00:00Z','lat':99,'surveyor':'PRIVATE_SENTINEL'}
    a['conflictingSubmissions']=[e];a['provenanceHold']={'status':'ACTIVE','reason':c.CROSS_REASON,'primaryOccurrence':{'kobo_id':1},'conflictingCount':1,'updatedAt':'2026-10-16T01:00:00Z'}
    after['metadata']=json.dumps(a);after['rejectionReason']=c.REJECTION;after['updatedAt']=2
    config={'id':'config','labId':'LAB','projectCode':'PROJECT','isActive':1,'koboServerUrl':'https://example.invalid','formId':'form','lastSubmissionId':'1','lastSyncAt':1,'updatedAt':1}
    fetch={'config':{'configId':'config','labId':'LAB','projectCode':'PROJECT','sourceIdentitySha256':c.sha(json.dumps(['https://example.invalid','form']).encode()),'submissionIds':['2']}}
    hold={'id':'hold','sampleId':before['id'],'type':'PROVENANCE','raisedBy':'system:kobo-sync','compatMarker':'KOBO_PROVENANCE','attributionSource':'LIVE','reason':c.CROSS_REASON,'raisedAt':1,'resolvedBy':None,'resolvedAt':None,'resolution':None}
    audits=[{'id':'audit-hold','entity':'SAMPLE_HOLD','entityId':'hold','action':'HOLD_RAISED','performedBy':'system:kobo-sync','sampleId':before['id'],'labId':'LAB','timestamp':1,'after':json.dumps(hold)},{'id':'audit-conflict','entity':'SAMPLE','entityId':before['id'],'action':'KOBO_CONFLICTING_PROVENANCE','performedBy':'KOBO_SCHEDULER','sampleId':None,'labId':None,'timestamp':1,'after':None}]
    return before,after,{'config':config},fetch,[hold],audits
def primary_fixture():
    f=list(fixture());a=json.loads(f[0]['metadata']);b=json.loads(f[1]['metadata']);e=b['conflictingSubmissions'][0];e['kobo_id']=1;e['occurrenceKey']='https://example.invalid:form:1:D1';e['reason']='PRIMARY_OCCURRENCE_REVISED_EVIDENCE';b['revisions']=[copy.deepcopy(e)];b['provenanceHold']['reason']=c.PRIMARY_REASON;b['provenanceHold']['revisionCount']=1;f[1]['metadata']=json.dumps(b);f[3]['config']['submissionIds']=['1'];f[4][0]['reason']=c.PRIMARY_REASON;f[5][0]['after']=json.dumps(f[4][0]);return f
class Guards(unittest.TestCase):
    def pinned_inputs(self,label):
        root=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/('pins-'+label);root.mkdir();(root/'startup-1-stopped-seal').mkdir()
        pins={};states={}
        for i,name in enumerate(m+s for m in c.MAINS for s in ['','-wal','-shm']):
            p=root/name;p.write_bytes(b'' if name.endswith('-wal') else b'content')
            state={'bytes':0 if name.endswith('-wal') else 7,'allocatedBytes':0 if name.endswith('-wal') else 4096,'device':64769,'inode':100+i,'mode':0o400,'mtimeNs':123,'sha256':c.sha(b'' if name.endswith('-wal') else b'content'),'ctimeNs':456,'nlink':1}
            pins[name]={k:state[k] for k in io.FIELDS};states[str(p)]=state
        return root,pins,states
    def test_exact_six_empty_wal_guard_no_sql(self):
        root,pins,states=self.pinned_inputs('positive')
        with mock.patch.object(io,'file_state',side_effect=lambda p:copy.deepcopy(states[str(p)])),mock.patch.object(sqlite3,'connect',side_effect=AssertionError('SQL before input guard')):
            before=io.check_inputs(pins,root);self.assertEqual(len(before),6);self.assertEqual(before,io.check_inputs(pins,root,before))
    def test_missing_selected_file_refuses(self):
        root,pins,states=self.pinned_inputs('missing');(root/c.MAINS[1]).unlink()
        with mock.patch.object(io,'file_state',side_effect=lambda p:copy.deepcopy(states[str(p)])):
            with self.assertRaises(RuntimeError):io.check_inputs(pins,root)
    def test_extra_journal_refuses_before_hash(self):
        root,pins,states=self.pinned_inputs('journal');(root/(c.MAINS[1]+'-journal')).write_bytes(b'')
        with mock.patch.object(io,'file_state',side_effect=AssertionError('Extra file before hashing')):
            with self.assertRaises(RuntimeError):io.check_inputs(pins,root)
    def test_after_ctime_change_voids(self):
        root,pins,states=self.pinned_inputs('ctime')
        with mock.patch.object(io,'file_state',side_effect=lambda p:copy.deepcopy(states[str(p)])):
            before=io.check_inputs(pins,root);states[str(root/c.MAINS[1])]['ctimeNs']+=1
            with self.assertRaises(RuntimeError):io.check_inputs(pins,root,before)
    def test_after_nlink_change_voids(self):
        root,pins,states=self.pinned_inputs('nlink')
        with mock.patch.object(io,'file_state',side_effect=lambda p:copy.deepcopy(states[str(p)])):
            before=io.check_inputs(pins,root);states[str(root/c.MAINS[1])]['nlink']=2
            with self.assertRaises(RuntimeError):io.check_inputs(pins,root,before)
    def test_after_sidecar_bytes_change_voids(self):
        root,pins,states=self.pinned_inputs('wal-change')
        with mock.patch.object(io,'file_state',side_effect=lambda p:copy.deepcopy(states[str(p)])):
            before=io.check_inputs(pins,root);states[str(root/(c.MAINS[1]+'-wal'))]['bytes']=32
            with self.assertRaises(RuntimeError):io.check_inputs(pins,root,before)
    def test_wrong_extent_is_recorded_before_refusal(self):
        p=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'record-extent.db';db=sqlite3.connect(p);db.execute('CREATE TABLE fixture(id)');db.close();records=[]
        with self.assertRaises(RuntimeError):io.open_main(p,563322880,observe=lambda k,v:records.append((k,v)))
        self.assertEqual(records[0][0],'extent');self.assertNotEqual(records[0][1]['pageBytes'],563322880)
    def test_actual_reader_regular_hash_and_hardlink_guard(self):
        p=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'reader-content';p.write_bytes(b'original');v=io.file_state(p);self.assertEqual(v['sha256'],c.sha(b'original'))
        linked=p.with_name('reader-hardlink');os.link(p,linked)
        with self.assertRaises(RuntimeError):io.file_state(p)
    def test_symlink_alias_refuses(self):
        p=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'alias'
        # Local Windows does not grant symlink creation to every account. The
        # actual no_alias predicate is exercised with a closed symlink fixture
        # interface on both platforms; hardlinks above use real OS files.
        with mock.patch.object(pathlib.Path,'is_symlink',return_value=True):
            with self.assertRaises(RuntimeError):io.no_alias(p)
    def test_cross_exact_pair_and_public_private_split(self):
        f=fixture();v=d.classify_sample(*f);self.assertEqual(v['classification'],'CROSS_SUBMISSION_DUPLICATE');self.assertEqual(v['pairing']['holdCount'],1);self.assertNotIn('PRIVATE_SENTINEL',json.dumps(v));self.assertNotIn('lat": 99',json.dumps(v))
    def test_primary_exact_pair(self):self.assertEqual(d.classify_sample(*primary_fixture())['classification'],'PRIMARY_REVISION')
    def test_array_append_structural_old_values(self):
        x=d.structural({'a':[{'x':1}]},{'a':[{'x':1},{'x':2}]});self.assertTrue(x['everyOldValueRetained']);self.assertEqual(x['arrays'][0]['classification'],'GREW')
    def test_nested_old_value_change(self):self.assertFalse(d.structural({'a':[{'x':1}]},{'a':[{'x':2}]})['everyOldValueRetained'])
    def test_arbitrary_key_is_hashed(self):self.assertNotIn('private name',json.dumps(d.structural({}, {'private name':7})))
    def test_deleted_key_not_preserved(self):self.assertFalse(d.structural({'a':7},{})['everyOldValueRetained'])
    def test_duplicate_json_key(self):
        with self.assertRaises(RuntimeError):c.strict('{"x":1,"x":2}')
    def test_nonfinite_json(self):
        with self.assertRaises(RuntimeError):c.strict('{"x":NaN}')
    def test_no_copy_capacity_exact_and_one_short(self):
        c.capacity(c.FLOOR+c.LOG_RESERVE)
        with self.assertRaises(RuntimeError):c.capacity(c.FLOOR+c.LOG_RESERVE-1)
    def test_future_package_only_before_root(self):
        p=c.package_allowance([1,4096]);self.assertEqual(p,8192+2*1024**2);c.capacity(c.FLOOR+c.LOG_RESERVE+p,p)
        with self.assertRaises(RuntimeError):c.capacity(c.FLOOR+c.LOG_RESERVE+p-1,p)
    def test_all_five_actual_remote_templates_compile(self):
        p=launch.programs({'nested_ROOT_VALUE':'0'*64},123);self.assertEqual(set(p),{'beforeRoot','create','seal','beforeUnit','unit'})
        for name,raw in p.items():compile(raw,name,'exec')
    def test_unit_network_and_readonly_properties(self):
        for value in ['PrivateNetwork=yes','RestrictAddressFamilies=AF_UNIX','IPAddressDeny=any','ProtectSystem=strict','ReadOnlyPaths=','ReadWritePaths=','MemorySwapMax=0','MemoryMax=805306368','RuntimeMaxSec=1800','Restart=no']:
            self.assertIn(value,launch.UNIT_PROGRAM)
    def test_remote_compile_precedes_transport(self):
        s=pathlib.Path(launch.__file__).read_text(encoding='utf-8');a=ast.parse(s);fn=next(n for n in a.body if isinstance(n,ast.FunctionDef) and n.name=='launch');calls=[(n.lineno,getattr(n.func,'id','')) for n in ast.walk(fn) if isinstance(n,ast.Call)];self.assertLess(min(n for n,k in calls if k=='programs'),min(n for n,k in calls if k=='transport'))
    def test_no_operators_or_network_in_runtime_modules(self):
        for mod in [d,io]:
            s=pathlib.Path(mod.__file__).read_text(encoding='utf-8');a=ast.parse(s)
            self.assertFalse(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr in ['backup','serialize','deserialize','load_extension','Popen','run','copy','copyfile','unlink','remove'] for n in ast.walk(a)))
    def test_authorizer_denies_attach_writes_and_writing_pragmas(self):
        for action,a,b in [(sqlite3.SQLITE_ATTACH,'other',None),(sqlite3.SQLITE_INSERT,'Sample',None),(sqlite3.SQLITE_PRAGMA,'journal_mode','WAL'),(sqlite3.SQLITE_PRAGMA,'query_only','ON'),(sqlite3.SQLITE_PRAGMA,'quick_check','1')]:self.assertEqual(io.authorizer(action,a,b,None,None),sqlite3.SQLITE_DENY)
    def test_authorizer_readonly_pragmas(self):
        for a,b in [('page_count',None),('page_size',None),('quick_check',None),('table_xinfo','Sample')]:self.assertEqual(io.authorizer(sqlite3.SQLITE_PRAGMA,a,b,None,None),sqlite3.SQLITE_OK)
    def test_immutable_actual_synthetic_database_and_no_sidecar(self):
        base=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT']);p=base/'immutable-input.db';db=sqlite3.connect(p);db.execute('CREATE TABLE fixture(id TEXT PRIMARY KEY,value TEXT)');db.execute("INSERT INTO fixture VALUES('x','original')");db.commit();db.close();raw=p.read_bytes();db,info=io.open_main(p,len(raw));self.assertEqual(db.execute('SELECT value FROM fixture').fetchone()[0],'original')
        for sql in ["UPDATE fixture SET value='bad'","ATTACH DATABASE ':memory:' AS other",'PRAGMA query_only=ON','PRAGMA journal_mode=WAL']:
            with self.assertRaises(sqlite3.DatabaseError):db.execute(sql)
        db.close();self.assertEqual(raw,p.read_bytes());self.assertFalse(pathlib.Path(str(p)+'-wal').exists());self.assertFalse(pathlib.Path(str(p)+'-shm').exists())
    def test_wrong_page_extent_refuses_before_table(self):
        p=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'wrong-extent.db';db=sqlite3.connect(p);db.execute('CREATE TABLE x(id)');db.close()
        with self.assertRaises(RuntimeError):io.open_main(p,563322880)
    def test_sink_exclusive_and_cap(self):
        p=pathlib.Path(os.environ['DIAGNOSTIC_FIXTURE_ROOT'])/'sink';p.mkdir();s=io.Sink(p,100);s.write('private-test.json',{'x':1})
        with self.assertRaises(FileExistsError):s.write('private-test.json',{'x':1})
        with self.assertRaises(RuntimeError):s.write('too-big.json',{'x':'a'*101})
    def test_unknown_root_source_pass_refuses(self):
        idx={'head':'a'*40,'files':{n:{'bytes':1,'sha256':'b'*64,'blob':'c'*40} for n in c.FILES},'data':{n:{'bytes':1,'sha256':'d'*64,'blob':'e'*40} for n in c.DATA}}
        review={'id':6205842416,'created_at':'2026-10-16T01:20:32Z','updated_at':'2026-10-16T01:20:32Z','performed_via_github_app':{'id':1236702,'slug':'claude'},'body':'Source review: PASS\n'+'\n'.join(c.tokens(idx))};c.approval(review,idx);review['body']=review['body'].replace(str(c.ROOT),'/old')
        with self.assertRaises(RuntimeError):c.approval(review,idx)
    def test_complete_112_table_diff_continues_after_sample_change(self):
        a,b=full_store_pair();b.execute("UPDATE Sample SET approvedBy='unapproved' WHERE id='original-sample'");b.execute("UPDATE ZProtected104 SET value='changed' WHERE id='z'");sink=MemorySink();v=d.compare_all(a,b,fixture()[3],{},sink);self.assertEqual(v['tableCount'],112);self.assertIn('PROTECTED_NON_INTAKE_TABLE_CHANGED',v['stopClassifications']);self.assertEqual(v['tables']['ZProtected104']['changedCount'],1);self.assertEqual(v['changedSamples'][0]['classification'],'UNEXPLAINED');a.close();b.close()
    def test_all_schema_receipts_protected(self):
        a,b=full_store_pair();b.execute("DELETE FROM _schema_migrations WHERE id='m0'");v=d.compare_all(a,b,fixture()[3],{},MemorySink());self.assertIn('SCHEMA_RECEIPTS_CHANGED',v['stopClassifications']);self.assertIn('DELETED_ORIGINAL',v['stopClassifications']);a.close();b.close()
    def test_unmodified_store_all112(self):
        a,b=full_store_pair();v=d.compare_all(a,b,fixture()[3],{},MemorySink());self.assertEqual(v['stopClassifications'],[]);self.assertEqual(v['tableCount'],112);a.close();b.close()
    def test_real_six_pins_are_literal_closed_retention(self):
        pins=json.loads(pathlib.Path(__file__).with_name('diagnostic-pins.json').read_bytes())['inputPins'];self.assertEqual(set(pins),{m+s for m in c.MAINS for s in ['','-wal','-shm']})
        for n,p in pins.items():
            self.assertEqual(p['mode'],0o400);self.assertEqual(p['device'],64769)
            if n.endswith('-wal'):self.assertEqual((p['bytes'],p['allocatedBytes'],p['sha256']),(0,0,c.sha(b'')))
def full_store_pair():
    f=fixture();out=[]
    for i in range(2):
        db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
        for name,row in [('Sample',f[0]),('KoboConfig',f[2]['config']),('SampleHold',f[4][0]),('AuditLog',f[5][0])]:
            db.execute('CREATE TABLE '+d.quoted(name)+'('+','.join(d.quoted(k)+(' TEXT PRIMARY KEY' if k=='id' else '') for k in row)+')')
        for name,row in [('Sample',f[0]),('KoboConfig',f[2]['config'])]:db.execute('INSERT INTO '+d.quoted(name)+' VALUES('+','.join('?' for k in row)+')',list(row.values()))
        db.execute('CREATE TABLE Notification(id TEXT PRIMARY KEY)');db.execute('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY)');db.executemany('INSERT INTO _schema_migrations VALUES(?)',[('m'+str(i),) for i in range(42)])
        db.execute('CREATE TABLE Science(id TEXT PRIMARY KEY,value)')
        for j in range(105):db.execute('CREATE TABLE ZProtected'+str(j).zfill(3)+'(id TEXT PRIMARY KEY,value)')
        db.execute("INSERT INTO ZProtected104 VALUES('z','original')");out.append(db)
    return out
def negative(name,mutate):
    def test(self):
        f=list(fixture());mutate(f);self.assertEqual(d.classify_sample(*f)['classification'],'UNEXPLAINED')
    test.__name__='test_refuse_'+name;setattr(Guards,test.__name__,test)
negative('non_expected',lambda f:f[0].update(status='RECEIVED'))
negative('status_change',lambda f:f[1].update(status='APPROVED'))
negative('scientific_approval',lambda f:f[1].update(approvedBy='not-allowed'))
negative('foreign_lab',lambda f:f[0].update(assignedLab='FOREIGN'))
negative('foreign_project',lambda f:f[0].update(projectCode='FOREIGN'))
negative('inactive_config',lambda f:f[2]['config'].update(isActive=0))
negative('unfetched_id',lambda f:f[3]['config'].update(submissionIds=[]))
negative('wrong_fetch_source',lambda f:f[3]['config'].update(sourceIdentitySha256='0'*64))
negative('rejection_overwrite',lambda f:f[0].update(rejectionReason='must retain'))
negative('wrong_rejection',lambda f:f[1].update(rejectionReason='wrong'))
negative('regressing_time',lambda f:f[1].update(updatedAt=0))
negative('missing_hold',lambda f:f[4].clear())
negative('missing_conflict_audit',lambda f:f[5].pop())
negative('missing_hold_audit',lambda f:f[5].pop(0))
negative('extra_hold',lambda f:f[4].append(copy.deepcopy(f[4][0])))
negative('extra_audit',lambda f:f[5].append(copy.deepcopy(f[5][1])))
for field,value in [('type','OTHER'),('raisedBy','system:foreign'),('compatMarker','OTHER'),('attributionSource','LEGACY'),('resolvedBy','someone'),('resolvedAt',2)]:negative('hold_'+field,lambda f,k=field,v=value:f[4][0].update({k:v}))
for field,value in [('entity','OTHER'),('entityId','foreign'),('action','OTHER'),('performedBy','someone'),('sampleId','foreign'),('labId','FOREIGN')]:negative('hold_audit_'+field,lambda f,k=field,v=value:f[5][0].update({k:v}))
negative('hold_audit_after_tamper',lambda f:f[5][0].update(after='{}'))
negative('conflict_audit_wrong_actor',lambda f:f[5][1].update(performedBy='someone'))
def change_meta(f,fn):
    m=json.loads(f[1]['metadata']);fn(m);f[1]['metadata']=json.dumps(m)
negative('removed_old_metadata',lambda f:change_meta(f,lambda m:m.pop('retained')))
negative('changed_old_metadata',lambda f:change_meta(f,lambda m:m.update(retained={'x':2})))
negative('reappend',lambda f:change_meta(f,lambda m:m['conflictingSubmissions'].append(copy.deepcopy(m['conflictingSubmissions'][0]))))
negative('marker_unknown_field',lambda f:change_meta(f,lambda m:m['provenanceHold'].update(extra='unexplained')))
negative('marker_wrong_count',lambda f:change_meta(f,lambda m:m['provenanceHold'].update(conflictingCount=2)))
negative('field_metadata_modified',lambda f:f[1].update(fieldMetadata='{"old":"changed"}'))
negative('invalid_metadata',lambda f:f[1].update(metadata='{bad'))
def pin_negative(field):
    def test(self):
        root,pins,states=self.pinned_inputs(field);v=states[str(root/c.MAINS[1])];v[field]=v[field]+1 if isinstance(v[field],int) else '0'*64
        with mock.patch.object(io,'file_state',side_effect=lambda p:copy.deepcopy(states[str(p)])),mock.patch.object(sqlite3,'connect',side_effect=AssertionError('Input mismatch before SQL')):
            with self.assertRaises(RuntimeError):io.check_inputs(pins,root)
    setattr(Guards,'test_input_pin_'+field,test)
for field in io.FIELDS:pin_negative(field)
if __name__=='__main__':unittest.main(verbosity=2)
