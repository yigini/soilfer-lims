"""NEW LOCAL fingerprint caller fixtures; no initial-reader/runtime authority."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_fingerprint_sorter as fingerprint
import kit_record_payload as record
import retained_files as retained
import verify_kit_record_payload as record_fixture
import verify_kit_schema_collection as schema_fixture
import verify_kit_sorter_scratch as native_run
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'fingerprint-sorter-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='fp-',dir=FIXTURES)).resolve()


def fixture(partial=False,collation=False):
    root,source,db=schema_fixture.fixture('',True)
    db.execute('CREATE TABLE finger(a BLOB,b TEXT'+(' COLLATE NOCASE' if collation else '')+',c BLOB)')
    db.executemany('INSERT INTO finger VALUES(?,?,?)',[(n//16,'a\0'+'\u00e9'*128,bytes([n])*8192) for n in range(96)])
    if partial:db.execute('CREATE INDEX finger_prefix ON finger(a)');db.execute('ANALYZE')
    db.commit();backup,state=retained.seal(root,'capture-prepared-214',source,lambda:None,schema_original='capture-schema-214.json')
    observation=json.loads((root/'capture-schema-214.json').read_bytes());profile=record_fixture.collect(root,state,observation)
    target_dir=root/'new-target';target_dir.mkdir()
    for suffix in ('','-wal','-shm'):
        path=pathlib.Path(str(source)+suffix)
        if path.exists():shutil.copyfile(path,target_dir/('dev.db'+suffix))
    return root,source,db,state,observation,profile,target_dir/'dev.db'


class FingerprintSorter(unittest.TestCase):
    def test_exact_caller_memory_setting_native_compiler_and_no_pma_sources_pinned(self):
        proof,digest=fingerprint.source_proof();self.assertEqual(digest,sha((HERE/fingerprint.PROOF).read_bytes()))
        self.assertGreaterEqual(len(proof['files']),79);self.assertGreaterEqual(len(proof['nativeExcerpts']),15)
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        text={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('db->temp_store==2',text['temp_in_memory_compile_modes'])
        self.assertIn('if( pSorter->mxPmaSize )',text['only_write_flush_gate'])
        self.assertIn('bUsePMA==0',text['rewind_memory_branch'])
        self.assertIn('OP_ResetSorter',text['partial_order_block_reset'])
        self.assertIn('SRT_Output',text['output_calls_sorter_once'])
        source=(HERE/'retained_files.py').read_text(encoding='utf8');logical=source[source.index('def logical('):]
        self.assertLess(logical.index('memory_temporaries(db)'),logical.index('PRAGMA integrity_check'))
        self.assertFalse(proof['readerSqliteBinaryToPinnedNativeSourceVerified'])
    def test_all_compile_memory_modes_every_table_native_counts_fields_and_zero_pma_requests(self):
        root,source,db,state,observation,profile,target=fixture()
        try:
            for mode in (1,2,3):
                inv=fingerprint.fingerprint_inventory(profile,observation['schema'],state,fingerprint.declared_memory_reader(mode))
                self.assertEqual({r['table'] for r in inv['tables']},set(state['tables']))
                self.assertEqual(inv['maximumSorterInitCalls'],len(state['tables']))
                self.assertEqual(inv['maximumSorterWriteCalls'],sum(x['count'] for x in state['tables'].values()))
                row=next(x for x in inv['tables'] if x['table']=='finger');self.assertEqual(row['maximumSorterWriteCalls'],96)
                self.assertEqual(row['maximumSorterRecordFields'],7)
                self.assertEqual(row['maximumFullSerializedSorterRecordBytes'],record.full_record_bound(profile['tables']['finger']['maximumNativeDataBytesByColumn']*2+[8]))
                for key in ('maximumPmaFileCreations','maximumPmaWriteBytes','maximumPmaSizeHintBytes','maximumOtherTemporaryBtreeHandles'):self.assertEqual(inv[key],0)
                self.assertTrue(inv['conditionalFingerprintSorterRecordMappingAndCountDerived'])
                self.assertFalse(inv['nativeDeclarationIsCollectorEngineAttestation']);self.assertFalse(inv['processHeapOrPhysicalMemoryBounded'])
        finally:db.close()
    def test_exact_quoted_copied_fields_no_collation_and_complete_profile_refusals(self):
        self.assertEqual(fingerprint.fingerprint_sql('a"b',['x"y','z']),'SELECT "x""y","z" FROM "a""b" ORDER BY "x""y","z"')
        for columns in ([],['A','a'],['x','x'],[True],['x\0']):
            with self.assertRaises(RuntimeError):fingerprint.fingerprint_sql('t',columns)
        root,source,db,state,observation,profile,target=fixture(collation=True)
        try:
            with self.assertRaisesRegex(RuntimeError,'collation'):fingerprint.fingerprint_inventory(profile,observation['schema'],state,fingerprint.declared_memory_reader(1))
        finally:db.close()
        root,source,db,state,observation,profile,target=fixture()
        try:
            for fault in ('drop','boolean','foreign'):
                bad=copy.deepcopy(profile)
                if fault=='drop':bad['tables'].pop('finger')
                elif fault=='boolean':bad['tables']['finger']['rowCount']=True
                else:bad['foreign']=True
                with self.assertRaises(RuntimeError):fingerprint.fingerprint_inventory(bad,observation['schema'],state,fingerprint.declared_memory_reader(1))
        finally:db.close()
    def test_default_disk_fallback_reference_callbacks_boolean_and_authority_profiles_refuse(self):
        root,source,db,state,observation,profile,target=fixture()
        try:
            good=fingerprint.declared_memory_reader(1)
            faults={'compileTempStore':0,'tempStorePragma':0,'settingHeldForEveryFingerprintStatement':False,
                'freshUnshadowedConnection':False,'noAttachedOrNamedTempSchemas':False,'ordinaryIntactStableSource':False,
                'noCustomFunctionsCollationsConvertersOrAutoExtensions':False,'sorterReferencesEnabled':True,
                'continuedSqlAfterError':True,'nativeVersion':'3.49.1','nativeSourceId':'x','version':True,'foreign':True}
            for key,value in faults.items():
                bad=copy.deepcopy(good);bad[key]=value
                with self.subTest(key=key),self.assertRaises(RuntimeError):fingerprint.fingerprint_inventory(profile,observation['schema'],state,bad)
            with self.assertRaises(RuntimeError):fingerprint.fingerprint_inventory(profile,observation['schema'],state,{**good,'compileTempStore':True})
            with self.assertRaises(RuntimeError):fingerprint.fingerprint_inventory(profile,observation['schema'],state,{**good,'tempStorePragma':1})
        finally:db.close()
    def test_source_bound_future_only_no_target_sql_full_replay_authority_and_inode_refusals(self):
        root,source,db,state,observation,profile,target=fixture()
        try:
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                input_plan=record.source_bound_record_plan(profile,observation,canonical(state)+b'\n',target,record.declared_projection('finger',['a','b','c'],[]))
                plan=fingerprint.source_bound_fingerprints(input_plan,fingerprint.declared_memory_reader(1));fingerprint.replay_fingerprints(plan)
            self.assertTrue(plan['futureInvocationOnly']);self.assertFalse(plan['initialEarlierFingerprintAdmissionImplemented'])
            self.assertFalse(plan['readerSqliteBinaryToPinnedNativeSourceVerified']);self.assertFalse(plan['independentProfileToPrivateDbBytesProof'])
            for field,value in [('futureInvocationOnly',False),('initialEarlierFingerprintAdmissionImplemented',True),('readerSqliteBinaryToPinnedNativeSourceVerified',True),('independentProfileToPrivateDbBytesProof',True),('beforeSqlHeldAdmissionImplemented',True),('foreign',0)]:
                bad=copy.deepcopy(plan);bad[field]=value
                with self.assertRaises(RuntimeError):fingerprint.replay_fingerprints(bad)
            for field in ('maximumSorterWriteCalls','maximumPmaFileCreations','maximumPmaWriteBytes'):
                bad=copy.deepcopy(plan);bad['inventory'][field]+=1
                with self.assertRaises(RuntimeError):fingerprint.replay_fingerprints(bad)
            raw=target.read_bytes();target.rename(target.parent/'retained-original-main.db');target.write_bytes(raw)
            with self.assertRaises(RuntimeError):fingerprint.replay_fingerprints(plan)
        finally:db.close()
    def test_new_full_source_copy_native_actual_caller_and_tooling_same_length_mutations(self):
        proof,digest=fingerprint.source_proof();root=directory();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,path)
        (tooling/fingerprint.PROOF).write_bytes((HERE/fingerprint.PROOF).read_bytes())
        with patch.object(fingerprint,'__file__',str(tooling/'kit_fingerprint_sorter.py')):
            fingerprint.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'retained_files.py').relative_to(ROOT).as_posix(),(HERE/'kit_fingerprint_sorter.py').relative_to(ROOT).as_posix()):
                path=root/name;raw=path.read_bytes();path.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):fingerprint.source_proof()
                path.write_bytes(raw)
    def test_actual_raw_python_and_pinned_native_full_and_block_fingerprints_with_memory_temporaries(self):
        for page in (512,4096,65536):
            for partial in (False,True):
                root=directory();temp=root/'tmp';temp.mkdir();input_dir=root/'input';input_dir.mkdir();source=input_dir/'dev.db'
                setup=root/'setup';setup.mkdir();run=root/'fingerprint';run.mkdir()
                program=r"""const D=require('better-sqlite3');const[file,page,partial]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.exec('CREATE TABLE finger(a BLOB,b BLOB,c BLOB)');const put=db.prepare('INSERT INTO finger VALUES(?,?,?)');db.transaction(()=>{for(let n=0;n<256;n++)put.run(Math.floor(n/32),Buffer.alloc(8192,n),'a\0'+'\u00e9\u4e2d\ud83d\ude42'.repeat(500))})();if(partial==='1')db.exec('CREATE INDEX finger_prefix ON finger(a); ANALYZE');const options=db.pragma('compile_options').map(x=>x.compile_options),row={rows:256,page:Number(page),partial:partial==='1',compileTempStore:Number(options.find(x=>x.startsWith('TEMP_STORE=')).split('=')[1]),sourceId:db.prepare('SELECT sqlite_source_id() v').get().v};db.close();process.stdout.write(JSON.stringify(row));"""
                initial=native_run.run_native(program,[source,page,'1' if partial else '0'],setup,temp);self.assertEqual(initial['sourceId'],native.SOURCE_ID)
                backup,state=retained.seal(root,'capture-prepared-214',source,lambda:None,schema_original='capture-schema-214.json')
                observation=json.loads((root/'capture-schema-214.json').read_bytes());profile=record_fixture.collect(root,state,observation)
                with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                    input_plan=record.source_bound_record_plan(profile,observation,canonical(state)+b'\n',source,record.declared_projection('finger',['a','b','c'],[]))
                    plan=fingerprint.source_bound_fingerprints(input_plan,fingerprint.declared_memory_reader(initial['compileTempStore']))
                (root/'fingerprint-plan-before-read.json').write_bytes(canonical(plan)+b'\n');query=fingerprint.fingerprint_sql('finger',state['tables']['finger']['columns'])
                reader=root/'capture-prepared-214/reader/dev.db';db=sqlite3.connect(reader.as_uri()+'?mode=ro',uri=True)
                try:
                    retained.memory_temporaries(db);db.execute('PRAGMA query_only=ON');db.execute('BEGIN');trace=[];db.set_trace_callback(trace.append)
                    result=retained.table_fingerprint(db,'finger',state['tables']['finger']['columns']);py_program=[list(r) for r in db.execute('EXPLAIN '+query)];db.rollback()
                finally:db.close()
                self.assertIn(query,trace);self.assertEqual(result['count'],256);self.assertEqual(result['sha256'],state['tables']['finger']['sha256'])
                (root/'actual-python-fingerprint-original.json').write_bytes(canonical({'result':result,'program':py_program,'query':query,'collectorVersion':sqlite3.sqlite_version,'notPinnedNodeRuntime':True})+b'\n')
                native_program=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file,sql]=process.argv.slice(1),before=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),db=new D(file,{readonly:true,fileMustExist:true});db.pragma('temp_store=MEMORY');db.pragma('query_only=ON');db.pragma('threads=2');db.exec('BEGIN');const program=db.prepare('EXPLAIN '+sql).all();let rows=0,blobBytes=0,names=new Set();for(const r of db.prepare(sql).iterate()){rows++;blobBytes+=r.b.length;for(const name of fs.readdirSync(process.env.TMPDIR))names.add(name)}const row={rows,blobBytes,program,tempStoreObserved:db.pragma('temp_store',{simple:true}),requestedWorkerLimit:db.pragma('threads',{simple:true}),version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,platform:process.platform,observedTempNames:[...names],actualNativeSorterCallsMeasured:false,continuousPeakMeasured:false,linuxVfsTested:false,physicalFilesystemClosureClaimed:false};db.exec('ROLLBACK');db.close();row.mainUnchanged=before===crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');process.stdout.write(JSON.stringify(row));"""
                row=native_run.run_native(native_program,[source,query],run,temp);self.assertEqual(row['sourceId'],native.SOURCE_ID)
                self.assertEqual(row['rows'],256);self.assertEqual(row['blobBytes'],256*8192);self.assertEqual(row['tempStoreObserved'],2);self.assertTrue(row['mainUnchanged'])
                self.assertEqual(sum(x['opcode']=='SorterOpen' for x in row['program']),1)
                self.assertEqual(sum(x['opcode']=='SorterInsert' for x in row['program']),1)
                self.assertEqual(bool(sum(x['opcode']=='ResetSorter' for x in row['program'])),partial)
                fingerprint.replay_fingerprints(plan)
