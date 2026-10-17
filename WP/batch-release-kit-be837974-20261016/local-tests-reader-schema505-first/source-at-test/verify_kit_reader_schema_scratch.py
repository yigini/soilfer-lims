"""NEW LOCAL explicit schema SELECTs; no initial-reader/runtime authority."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_reader_schema_scratch as schema
import retained_files as retained
import verify_kit_sorter_scratch as native_run
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'reader-schema-scratch-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='rs-',dir=FIXTURES)).resolve()


class ReaderSchemaScratch(unittest.TestCase):
    def test_full_pins_exact_actual_queries_builtin_schema_and_memory_compiler_ranges(self):
        proof,digest=schema.source_proof();self.assertEqual(digest,sha((HERE/schema.PROOF).read_bytes()))
        self.assertGreaterEqual(len(proof['files']),81);self.assertEqual(len(proof['callerExcerpts']),3)
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:
            self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        text={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('CREATE TABLE x(type text,name text,tbl_name text,',text['builtin_schema_readonly_columns'])
        self.assertIn('PREFERRED_SCHEMA_TABLE',text['schema_alias_to_builtin_main'])
        self.assertIn('if( pSorter->mxPmaSize )',text['only_write_flush_gate'])
        self.assertIn('OP_SorterOpen',text['no_limit_uses_sorter_not_temp_index'])
        caller='\n'.join(r['text'] for r in proof['callerExcerpts'])
        for label,sql,selected,ordered in schema.QUERIES:self.assertIn(sql,caller)
    def test_both_actual_branches_all_memory_modes_no_later_profile_no_sql_no_heap_claim(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for full in (False,True):
                for mode in (1,2,3):
                    plan=schema.schema_select_inventory(full,schema.declared_schema_reader(mode));schema.replay_schema_selects(plan)
                    self.assertEqual(len(plan['queries']),3 if full else 2)
                    self.assertEqual([r['label'] for r in plan['queries']],['logical-objects','full-schema','logical-tables'] if full else ['logical-objects','logical-tables'])
                    self.assertEqual([r['maximumSorterRecordFields'] for r in plan['queries']],[7,8,3] if full else [7,3])
                    for key in ('maximumPmaFileCreations','maximumPmaWriteBytes','maximumPmaSizeHintBytes','maximumOtherTemporaryBtreeHandles'):self.assertEqual(plan[key],0)
                    for key in ('laterProfileOrSchemaOriginalRequired','nativeSorterWriteCountDerived','fullSerializedRecordByteBoundDerived','processHeapOrPhysicalMemoryBounded','beforeInitialReaderSqlAdmissionImplemented','wholeLogicalReaderSqlScratchInventoryComplete'):self.assertFalse(plan[key])
    def test_foreign_boolean_disk_callback_shadow_and_invented_query_count_or_authority_refuse(self):
        good=schema.declared_schema_reader(1)
        faults={'compileTempStore':True,'tempStorePragma':0,'settingHeldForEverySchemaSelect':False,
            'freshUnshadowedConnection':False,'noAttachedOrNamedTempSchemas':False,'sorterReferencesEnabled':True,
            'noCustomFunctionsCollationsConvertersOrAutoExtensions':False,'nativeVersion':'3.49.1','foreign':True}
        for key,value in faults.items():
            with self.subTest(key=key),self.assertRaises(RuntimeError):schema.schema_select_inventory(True,{**good,key:value})
        for value in (0,1,None,'true'):
            with self.assertRaises(RuntimeError):schema.schema_select_inventory(value,good)
        plan=schema.schema_select_inventory(True,good)
        for key in ('readerSqliteBinaryToPinnedNativeSourceVerified','beforeInitialReaderSqlAdmissionImplemented','nativeSorterWriteCountDerived','wholeLogicalReaderSqlScratchInventoryComplete','physicalFilesystemClosureClaimed'):
            bad=copy.deepcopy(plan);bad[key]=True
            with self.assertRaises(RuntimeError):schema.replay_schema_selects(bad)
        for fault in ('query','count','extra','missing'):
            bad=copy.deepcopy(plan)
            if fault=='query':bad['queries'][0]['query']+=' LIMIT 1'
            elif fault=='count':bad['maximumSorterInitCalls']=1
            elif fault=='extra':bad['profile']={}
            else:bad['queries'].pop()
            with self.assertRaises(RuntimeError):schema.replay_schema_selects(bad)
    def test_actual_new_python_memory_metadata_refuses_unmatched_engine_without_target_path(self):
        root=directory();real=sqlite3.connect;opened=[]
        def connect(name,*args,**kwargs):
            opened.append(name);self.assertEqual(name,':memory:');return real(name,*args,**kwargs)
        with patch.object(sqlite3,'connect',side_effect=connect):observation=schema.observe_new_python_memory_engine()
        self.assertEqual(opened,[':memory:']);self.assertEqual(observation['sqliteVersionObserved'],sqlite3.sqlite_version)
        self.assertFalse(observation['loadedBinaryToSourceBuildBindingVerified']);self.assertFalse(observation['targetDatabaseBytesOrOwnershipObserved'])
        if sqlite3.sqlite_version!='3.51.2' or observation['sqliteSourceIdObserved']!=native.SOURCE_ID:
            with self.assertRaisesRegex(RuntimeError,'unmatched Python'):schema.necessary_pinned_engine_metadata(observation)
        (root/'actual-python-memory-engine-original.json').write_bytes(canonical(observation)+b'\n')
    def test_necessary_metadata_matches_are_not_binary_attestation_and_all_substitutions_refuse(self):
        observed=schema.memory_engine_observation('3.51.2',native.SOURCE_ID,['TEMP_STORE=1','THREADSAFE=1'],2)
        check=schema.necessary_pinned_engine_metadata(observed)
        self.assertTrue(check['necessaryVersionSourceIdMemoryOptionsMatch'])
        for key,value in check.items():
            if key!='necessaryVersionSourceIdMemoryOptionsMatch':self.assertFalse(value)
        for key,value in [('sqliteVersionObserved','3.49.1'),('sqliteSourceIdObserved','x'),('loadedBinaryToSourceBuildBindingVerified',True),('targetDatabaseBytesOrOwnershipObserved',True),('initialReaderSqlAdmissionGranted',True),('version',True),('foreign',0)]:
            with self.assertRaises(RuntimeError):schema.necessary_pinned_engine_metadata({**observed,key:value})
        for options in (['TEMP_STORE=1','TEMP_STORE=1'],['TEMP_STORE=1','TEMP_STORE=2'],['TEMP_STORE=0'],[],[True]):
            with self.assertRaises(RuntimeError):schema.memory_engine_observation('3.51.2',native.SOURCE_ID,options,2)
        for option in ('ENABLE_SORTER_REFERENCES','ENABLE_SORTER_REFERENCES=1'):
            bad=schema.memory_engine_observation('3.51.2',native.SOURCE_ID,['TEMP_STORE=1',option],2)
            with self.assertRaises(RuntimeError):schema.necessary_pinned_engine_metadata(bad)
        for value in (True,0,1):
            with self.assertRaises(RuntimeError):schema.memory_engine_observation('3.51.2',native.SOURCE_ID,['TEMP_STORE=1'],value)
    def test_new_complete_source_copy_native_actual_collector_and_tooling_mutation(self):
        proof,digest=schema.source_proof();root=directory();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,path)
        (tooling/schema.PROOF).write_bytes((HERE/schema.PROOF).read_bytes())
        with patch.object(schema,'__file__',str(tooling/'kit_reader_schema_scratch.py')):
            schema.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'retained_files.py').relative_to(ROOT).as_posix(),(HERE/'kit_schema_collection.py').relative_to(ROOT).as_posix(),(HERE/'kit_reader_schema_scratch.py').relative_to(ROOT).as_posix()):
                path=root/name;raw=path.read_bytes();path.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):schema.source_proof()
                path.write_bytes(raw)
    def test_actual_unmodified_python_logical_branches_and_pinned_node_explicit_schema_programs(self):
        for page in (512,4096,65536):
            root=directory();temp=root/'tmp';temp.mkdir();setup=root/'setup';setup.mkdir()
            reader=root/'reader';reader.mkdir();source=reader/'dev.db'
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.exec('CREATE TABLE checks(id INTEGER PRIMARY KEY,k TEXT UNIQUE,p BLOB); CREATE TABLE child(id INTEGER PRIMARY KEY,parent INTEGER REFERENCES checks(id)); CREATE VIEW checked AS SELECT id,k FROM checks; CREATE TRIGGER checked_insert AFTER INSERT ON checks BEGIN SELECT 1; END;');db.transaction(()=>{const put=db.prepare('INSERT INTO checks(k,p) VALUES(?,?)');for(let n=0;n<96;n++)put.run('k'+n,Buffer.alloc(512,n));db.prepare('INSERT INTO child VALUES(1,1)').run()})();db.exec('ANALYZE');db.close();process.stdout.write(JSON.stringify({page:Number(page),created:true}));"""
            native_run.run_native(program,[source,page],setup,temp);initial=sha(source.read_bytes())
            for full in (False,True):
                run=root/('full' if full else 'filtered');run.mkdir();trace=[];real=sqlite3.connect
                def traced(*args,**kwargs):
                    db=real(*args,**kwargs);db.set_trace_callback(trace.append);return db
                with patch.object(sqlite3,'connect',side_effect=traced):result=retained.logical(source,full_schema=full)
                selected=[sql for sql in trace if sql in {r[1] for r in schema.QUERIES}]
                expected=[r[1] for r in schema.QUERIES if full or r[0]!='full-schema'];self.assertEqual(selected,expected)
                self.assertLess(trace.index('PRAGMA temp_store=MEMORY'),trace.index('PRAGMA integrity_check'))
                if full:
                    self.assertTrue(any(r[1].startswith('sqlite_autoindex') and r[4] is None for r in result[1]['rows']))
                    self.assertTrue(any(r[1]=='sqlite_stat1' for r in result[1]['rows']))
                (run/'actual-python-logical-original.json').write_bytes(canonical({'trace':trace,'logical':result,'collectorVersion':sqlite3.sqlite_version,'binarySourceBindingVerified':False})+b'\n')
                plan=schema.schema_select_inventory(full,schema.declared_schema_reader(1));(run/'source-plan-before-native-read.json').write_bytes(canonical(plan)+b'\n')
                native_program=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file,queries]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(),db=new D(file,{readonly:true,fileMustExist:true});db.pragma('temp_store=MEMORY');db.pragma('query_only=ON');db.exec('BEGIN');const cases=JSON.parse(queries).map(sql=>({sql,program:db.prepare('EXPLAIN '+sql).all(),rows:db.prepare(sql).raw().all()}));const version=db.prepare('SELECT sqlite_version() v').get().v,sourceId=db.prepare('SELECT sqlite_source_id() v').get().v,options=db.pragma('compile_options').map(x=>x.compile_options),tempStore=db.pragma('temp_store',{simple:true});db.exec('ROLLBACK');db.close();process.stdout.write(JSON.stringify({cases,version,sourceId,options,tempStore,mainUnchanged:before===hash(),actualNativeCallsMeasured:false,continuousPeakMeasured:false,linuxVfsTested:false,physicalFilesystemClosureClaimed:false}));"""
                row=native_run.run_native(native_program,[source,json.dumps(expected)],run,temp)
                self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertTrue(row['mainUnchanged']);self.assertEqual(row['tempStore'],2)
                observed=schema.memory_engine_observation(row['version'],row['sourceId'],row['options'],row['tempStore'])
                self.assertFalse(schema.necessary_pinned_engine_metadata(observed)['loadedBinaryToSourceBuildBindingVerified'])
                for case in row['cases']:
                    self.assertLessEqual(sum(r['opcode']=='SorterOpen' for r in case['program']),1)
                    self.assertEqual(sum(r['opcode']=='OpenEphemeral' for r in case['program']),0)
                schema.replay_schema_selects(plan);self.assertEqual(sha(source.read_bytes()),initial)
