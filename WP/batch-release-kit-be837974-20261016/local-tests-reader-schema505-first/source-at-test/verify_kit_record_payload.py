"""NEW LOCAL record-size observations; no capture integration/runtime authority."""
import copy,json,os,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_record_payload as record
import retained_files as retained
import verify_kit_schema_collection as schema_fixture
import verify_kit_sorter_scratch as native_run
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'record-payload-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='rec-',dir=FIXTURES)).resolve()

def collect(root,state,observation,label='capture-prepared-214'):
    path=root/label/'reader/dev.db';db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
    try:
        retained.memory_temporaries(db);db.execute('PRAGMA query_only=ON');db.execute('BEGIN')
        value=record.collect_record_profiles(db,observation['schema'],state);db.rollback()
    finally:db.close()
    return value

def fixture(extra=''):
    root,source,db=schema_fixture.fixture(extra,True)
    db.execute('CREATE TABLE mixed(id INTEGER PRIMARY KEY,i BLOB,r BLOB,s BLOB,b BLOB)')
    db.executemany('INSERT INTO mixed VALUES(?,?,?,?,?)',[(1,None,None,None,None),(2,-9223372036854775808,1.5,'a\0é中🙂',b'\0'*8192),
        (3,9223372036854775807,float('inf'),'long'*50,b'z'),(4,0,-0.0,'',b'')]);db.commit()
    backup,state=retained.seal(root,'capture-prepared-214',source,lambda:None,schema_original='capture-schema-214.json')
    observation=json.loads((root/'capture-schema-214.json').read_bytes());value=collect(root,state,observation)
    clone=root/'new-target';clone.mkdir()
    for suffix in ('','-wal','-shm'):
        p=pathlib.Path(str(source)+suffix)
        if p.exists():shutil.copyfile(p,clone/('dev.db'+suffix))
    return root,source,db,backup,state,observation,value,clone/'dev.db'

class RecordPayload(unittest.TestCase):
    def test_full_native_collector_source_pins_headers_zero_payload_and_varints(self):
        proof,digest=record.source_proof();self.assertEqual(digest,sha((HERE/record.PROOF).read_bytes()))
        self.assertGreaterEqual(len(proof['files']),60);self.assertEqual(len(proof['nativeExcerpts']),10)
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        parts={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('nZero',parts['full_record_final_header_and_zero_bytes']);self.assertIn('9',parts['maximum_varint_length'])
        self.assertIn('encoding',parts['affinity_is_separate']);self.assertIn('ExpandBlob',parts['index_uses_expanded_full_key'])
        self.assertFalse(proof['captureCollectorIntegrationImplemented'])
    def test_actual_owned_reader_native_types_utf8_embedded_nul_zero_blob_and_empty_tables(self):
        root,source,db,backup,state,observation,value,target=fixture('CREATE TABLE empty(a TEXT,b BLOB)')
        try:
            row=value['tables']['mixed'];self.assertEqual(row['rowCount'],4)
            self.assertEqual(row['maximumNativeDataBytesByColumn'],[8,8,8,200,8192])
            self.assertEqual(row['maximumFullSelectedRowRecordBytes'],9+9*5+sum(row['maximumNativeDataBytesByColumn']))
            self.assertEqual(value['tables']['empty']['maximumNativeDataBytesByColumn'],[0,0])
            self.assertEqual(value['tables']['empty']['maximumFullSelectedRowRecordBytes'],27)
            self.assertFalse(value['independentProfileToPrivateDbBytesProof']);self.assertFalse(value['captureCollectorIntegrationImplemented'])
            path=root/'capture-prepared-214/reader/dev.db';conn=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
            try:
                retained.memory_temporaries(conn);conn.execute('PRAGMA query_only=ON');conn.execute('BEGIN');calls=[];conn.set_trace_callback(calls.append)
                same=record.collect_record_profiles(conn,observation['schema'],state)
                self.assertEqual(same['tables'],value['tables']);self.assertTrue(any('length(CAST(' in q for q in calls))
                self.assertFalse(any(q.startswith('SELECT ') and 'ORDER BY' in q and 'sqlite_schema' not in q for q in calls))
                lengths=conn.execute('SELECT length(s),length(CAST(s AS BLOB)) FROM mixed WHERE id=2').fetchone()
                self.assertEqual(lengths[0],1);self.assertGreater(lengths[1],lengths[0]);conn.rollback()
            finally:conn.close()
        finally:db.close()
    def test_strict_report_counts_columns_types_authority_and_unsupported_reader_profiles_refuse(self):
        root,source,db,backup,state,observation,value,target=fixture()
        try:
            for fault in ('missing','boolean','count','authority','private','foreign','data'):
                bad=copy.deepcopy(value)
                if fault=='missing':bad['tables'].pop('mixed')
                elif fault=='boolean':bad['tables']['mixed']['maximumNativeDataBytesByColumn'][0]=True
                elif fault=='count':bad['tables']['mixed']['rowCount']+=1
                elif fault=='authority':bad['newReaderCreationAndCallerBindingVerified']=True
                elif fault=='private':bad['independentProfileToPrivateDbBytesProof']=True
                elif fault=='data':bad['tables']['mixed']['maximumFullSelectedRowRecordBytes']+=1
                else:bad['foreign']=True
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):record.validate_profile(bad,observation['schema'],state)
            path=root/'capture-prepared-214/reader/dev.db';conn=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
            try:
                with self.assertRaises(RuntimeError):record.collect_record_profiles(conn,observation['schema'],state)
                retained.memory_temporaries(conn);conn.execute('BEGIN')
                with self.assertRaises(RuntimeError):record.collect_record_profiles(conn,observation['schema'],state)
            finally:conn.close()
            conn=sqlite3.connect(source)
            try:
                retained.memory_temporaries(conn);conn.execute('PRAGMA query_only=ON');conn.execute('BEGIN')
                with self.assertRaisesRegex(RuntimeError,'reader/dev.db'):record.collect_record_profiles(conn,observation['schema'],state)
            finally:conn.close()
        finally:db.close()
    def test_whole_record_projection_duplicates_extras_conversion_and_complete_size_refusals(self):
        root,source,db,backup,state,observation,value,target=fixture()
        try:
            projection=record.declared_projection('mixed',['s','s','b','i'],[8,8])
            plan=record.projected_record_bound(value,observation['schema'],state,projection)
            self.assertEqual(plan['maximumFullSerializedRecordBytes'],9+9*6+200*2+8192+8+16)
            for key,v in [('noAffinityOrEncodingConversion',False),('onlyCopiedColumnsAndDeclaredExtraFields',1),('columns',['absent']),('extraFieldsMaximumDataBytes',[True]),('foreign',True)]:
                bad=copy.deepcopy(projection);bad[key]=v
                with self.assertRaises(RuntimeError):record.projected_record_bound(value,observation['schema'],state,bad)
            for sizes in ([2147483647],[0]*2001,[],[True]):
                with self.assertRaises(RuntimeError):record.full_record_bound(sizes)
            with self.assertRaisesRegex(RuntimeError,'never clip'):record.projected_record_bound(value,observation['schema'],state,record.declared_projection('mixed',['s'],[2147483647]))
        finally:db.close()
    def test_descriptor_source_binding_full_original_replay_mutation_and_same_byte_inode_substitution(self):
        root,source,db,backup,state,observation,value,target=fixture()
        try:
            projection=record.declared_projection('mixed',['i','r','s','b'],[8])
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                plan=record.source_bound_record_plan(value,observation,canonical(state)+b'\n',target,projection);record.replay_record_plan(plan)
            self.assertTrue(plan['collectorSourceByteBindingVerified']);self.assertFalse(plan['shmEqualityRequiredForSourceAssociation'])
            for fault in ('logical','count','authority','foreign'):
                bad=copy.deepcopy(plan)
                if fault=='logical':bad['logicalState']['tables']['mixed']['count']+=1
                elif fault=='count':bad['bound']['maximumFullSerializedRecordBytes']-=1
                elif fault=='authority':bad['writerGraphAdmissionImplemented']=True
                else:bad['foreign']=0
                with self.assertRaises(RuntimeError):record.replay_record_plan(bad)
            raw=target.read_bytes();retained_original=root/'original-target-main.db';target.rename(retained_original);target.write_bytes(raw)
            with self.assertRaisesRegex(RuntimeError,'identities|changed'):record.replay_record_plan(plan)
            bad=bytearray(raw);bad[-1]^=1;target.write_bytes(bad)
            with self.assertRaisesRegex(RuntimeError,'Target full bytes'):record.replay_record_plan(plan)
        finally:db.close()
    def test_full_new_source_copy_same_length_native_tooling_and_collector_mutation(self):
        proof,digest=record.source_proof();root=directory();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/record.PROOF).write_bytes((HERE/record.PROOF).read_bytes())
        with patch.object(record,'__file__',str(tooling/'kit_record_payload.py')):
            record.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_record_payload.py').relative_to(ROOT).as_posix(),(HERE/'retained_files.py').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):record.source_proof()
                p.write_bytes(raw)
    def test_actual_pinned_native_full_index_payloads_under_precollected_record_bounds(self):
        for page in (512,4096,65536):
            root=directory();temp=root/'tmp';temp.mkdir();source=root/'source.db';setup=root/'setup';setup.mkdir();run=root/'index';run.mkdir()
            program=r"""const Database=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new Database(file);db.pragma('page_size='+page);db.exec('CREATE TABLE mixed(id INTEGER PRIMARY KEY,i BLOB,r BLOB,s BLOB,b BLOB)');const put=db.prepare('INSERT INTO mixed VALUES(?,?,?,?,?)');db.transaction(()=>{for(let n=1;n<=96;n++){const i=n%3===0?null:n%3===1?-9223372036854775808n:9223372036854775807n;const r=n%4===0?null:n%4===1?Infinity:n%4===2?-0.0:1.25;const s=n%2?'a\0'+'é中🙂'.repeat(500):'short';const b=n%3===0?null:Buffer.alloc(n%2?8192:2,n);put.run(n,i,r,s,b)}})();const row={version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,rows:96,page:Number(page)};db.close();process.stdout.write(JSON.stringify(row));"""
            initial=native_run.run_native(program,[source,page],setup,temp);self.assertEqual(initial['sourceId'],native.SOURCE_ID)
            backup,state=retained.seal(root,'capture-prepared-214',source,lambda:None,schema_original='capture-schema-214.json')
            observation=json.loads((root/'capture-schema-214.json').read_bytes());profile=collect(root,state,observation)
            projection=record.declared_projection('mixed',['i','r','s','b'],[8])
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                plan=record.source_bound_record_plan(profile,observation,canonical(state)+b'\n',source,projection)
            (root/'record-profile-original.json').write_bytes(canonical(profile)+b'\n');(root/'record-plan-before-index.json').write_bytes(canonical(plan)+b'\n')
            writer=r"""const Database=require('better-sqlite3');const[file]=process.argv.slice(1),db=new Database(file),sql='CREATE INDEX native_record_idx ON mixed(i,r,s,b)',program=db.prepare('EXPLAIN '+sql).all();db.exec(sql);const row={program,indexRoot:db.prepare("SELECT rootpage FROM sqlite_schema WHERE name='native_record_idx'").get().rootpage,rows:db.prepare('SELECT count(*) n FROM mixed').get().n,version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,platform:process.platform,linuxVfsTested:false,actualNativeFileCallsMeasured:false,continuousPeakMeasured:false,physicalAllocationMeasured:false};db.close();process.stdout.write(JSON.stringify(row));"""
            row=native_run.run_native(writer,[source],run,temp);self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertEqual(row['rows'],96)
            lengths=native.payload_sizes(source.read_bytes(),page,row['indexRoot']);self.assertEqual(len(lengths),96)
            self.assertLessEqual(max(lengths),plan['bound']['maximumFullSerializedRecordBytes'])
            self.assertFalse(plan['completeNativeRecordMappingVerified']);self.assertFalse(plan['writerGraphAdmissionImplemented'])
            with self.assertRaises(RuntimeError):record.replay_record_plan(plan)