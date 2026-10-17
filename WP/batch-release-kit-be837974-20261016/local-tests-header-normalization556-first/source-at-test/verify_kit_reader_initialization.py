"""NEW LOCAL native initialization fixtures; no Python/binary admission."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_reader_initialization as initialization
import retained_files as retained
import verify_kit_sorter_scratch as native_run
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'reader-init-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='ri-',dir=FIXTURES)).resolve()


class ReaderInitialization(unittest.TestCase):
    def test_exact_pragma_gates_callback_stat4_grouping_and_complete_source_pins(self):
        proof,digest=initialization.source_proof();self.assertEqual(digest,sha((HERE/initialization.PROOF).read_bytes()))
        self.assertGreaterEqual(len(proof['files']),83);raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        text={r['label']:r['text'] for r in proof['nativeExcerpts']}
        for name in ('compile_option_pragma_flags','temp_store_pragma_flags','query_only_pragma_flags'):
            self.assertNotIn('PragFlg_NeedSchema',text[name])
        self.assertIn('PragFlg_NeedSchema',text['integrity_pragma_needs_schema'])
        self.assertIn('SQLITE_FCNTL_PRAGMA',text['pragma_file_control_then_schema_gate'])
        self.assertIn('sqlite3InitCallback',text['one_schema_sql_and_analysis_call'])
        self.assertIn('GROUP BY idx COLLATE nocase',text['stat4_both_complete_queries'])
        self.assertIn('OP_SorterOpen',text['group_by_sorter_open'])
        self.assertIn('no VDBE code is generated',text['schema_callback_parse_only'])
        self.assertIn('sqlite3AnalysisLoad',text['one_schema_sql_and_analysis_call'])
    def test_all_memory_modes_complete_four_query_catalog_no_later_profile_or_sql(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for mode in (1,2,3):
                plan=initialization.initialization_inventory(initialization.declared_initialization_reader(mode))
                initialization.replay_initialization(plan)
                self.assertEqual([r['sql'] for r in plan['setup']],list(initialization.SETUP))
                self.assertTrue(all(not r['nativeHandlerRequiresSchema'] for r in plan['setup']))
                self.assertEqual(len(plan['queries']),4);self.assertEqual(plan['maximumImplicitSqlExecutions'],4)
                self.assertEqual(plan['maximumPossibleSorterInitCalls'],2)
                self.assertEqual(sum(x['maximumPossibleSorterInitCalls'] for x in plan['queries']),2)
                for key in ('maximumPmaFileCreations','maximumPmaWriteBytes','maximumPmaSizeHintBytes','maximumOtherTemporaryBtreeHandles'):self.assertEqual(plan[key],0)
                self.assertFalse(plan['laterProfileOrSchemaOriginalRequired']);self.assertFalse(plan['processHeapOrPhysicalMemoryBounded'])
                self.assertFalse(plan['constructorAndExtensionSchemaAccessReviewed']);self.assertFalse(plan['readerSqliteBinaryToPinnedNativeSourceVerified'])
    def test_prior_schema_use_intercepted_pragmas_retries_attached_handles_and_foreign_types_refuse(self):
        good=initialization.declared_initialization_reader(1)
        for key,value in [('schemaUnloadedAtFirstListedPragma',False),('noPriorSqlOrSchemaUsingApiCalls',False),('pragmaFileControlsReturnNotFoundWithoutSql',False),('pragmaFileControlsDoNotAccessSchemaOrChangeConnectionState',False),('noSchemaResetReprepareRetryOrErrorContinuation',False),('mainOnlyWithUnopenedTempBackend',False),('ordinaryBuiltinCountAndNoCase',False),('compileTempStore',True),('tempStorePragma',0),('continuedSqlAfterError',True),('foreign',0)]:
            with self.subTest(key=key),self.assertRaises(RuntimeError):initialization.initialization_inventory({**good,key:value})
        for mode in (0,4,None,'1',True):
            with self.assertRaises(RuntimeError):initialization.initialization_inventory(initialization.declared_initialization_reader(mode))
    def test_complete_sql_sequence_group_query_counts_and_no_invented_runtime_or_admission(self):
        plan=initialization.initialization_inventory(initialization.declared_initialization_reader(1))
        for field in ('constructorAndExtensionSchemaAccessReviewed','runtimeSchemaUnloadedAtEntryVerified','actualInternalStatementExecutionsMeasured','runtimePragmaFileControlBehaviorVerified','readerSqliteBinaryToPinnedNativeSourceVerified','statisticalSampleHeapBounded','beforeInitialReaderSqlAdmissionImplemented','wholeLogicalReaderSqlScratchInventoryComplete','physicalFilesystemClosureClaimed'):
            bad=copy.deepcopy(plan);bad[field]=True
            with self.subTest(field=field),self.assertRaises(RuntimeError):initialization.replay_initialization(bad)
        for fault in ('group','drop','count','setup','profile','boolean'):
            bad=copy.deepcopy(plan)
            if fault=='group':bad['queries'][2]['sql']=bad['queries'][2]['sql'].replace('GROUP BY idx COLLATE nocase','')
            elif fault=='drop':bad['queries'].pop(2)
            elif fault=='count':bad['maximumPossibleSorterInitCalls']=1
            elif fault=='setup':bad['setup'][0],bad['setup'][1]=bad['setup'][1],bad['setup'][0]
            elif fault=='boolean':bad['maximumMainSchemaInitializationCalls']=True
            else:bad['profile']={}
            with self.assertRaises(RuntimeError):initialization.replay_initialization(bad)
    def test_new_full_source_copy_native_actual_memory_caller_and_tooling_mutation(self):
        proof,digest=initialization.source_proof();root=directory();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/initialization.PROOF).write_bytes((HERE/initialization.PROOF).read_bytes())
        with patch.object(initialization,'__file__',str(tooling/'kit_reader_initialization.py')):
            initialization.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'retained_files.py').relative_to(ROOT).as_posix(),(HERE/'kit_reader_initialization.py').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):initialization.source_proof()
                p.write_bytes(raw)
    def test_actual_pinned_native_stat4_grouping_and_raw_python_logical_setup_at_three_pages(self):
        for page in (512,4096,65536):
            root=directory();temp=root/'tmp';temp.mkdir();setup=root/'setup';setup.mkdir();run=root/'load';run.mkdir();reader=root/'reader';reader.mkdir();source=reader/'dev.db'
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.exec('CREATE TABLE checks(id INTEGER PRIMARY KEY,a TEXT,b BLOB);CREATE INDEX checks_a ON checks(a);CREATE VIEW checked AS SELECT a FROM checks;CREATE TRIGGER checks_after AFTER INSERT ON checks BEGIN SELECT 1;END;');const put=db.prepare('INSERT INTO checks(a,b) VALUES(?,?)');db.transaction(()=>{for(let n=0;n<256;n++)put.run('g'+(n%16),Buffer.alloc(512,n))})();db.exec('ANALYZE');const stat4Rows=db.prepare('SELECT count(*) n FROM sqlite_stat4').get().n,options=db.pragma('compile_options').map(x=>x.compile_options);db.close();process.stdout.write(JSON.stringify({page:Number(page),stat4Rows,options}));"""
            initial=native_run.run_native(program,[source,page],setup,temp);self.assertGreater(initial['stat4Rows'],0);self.assertIn('ENABLE_STAT4',initial['options'])
            before=sha(source.read_bytes());plan=initialization.initialization_inventory(initialization.declared_initialization_reader(1));(root/'initialization-plan-before-read.json').write_bytes(canonical(plan)+b'\n')
            trace=[];real=sqlite3.connect
            def traced(*args,**kwargs):
                db=real(*args,**kwargs);db.set_trace_callback(trace.append);return db
            with patch.object(sqlite3,'connect',side_effect=traced):logical=retained.logical(source)
            self.assertEqual(logical['tables']['checks']['count'],256)
            self.assertLess(trace.index('PRAGMA temp_store=MEMORY'),trace.index('PRAGMA integrity_check'))
            (root/'actual-python-logical-original.json').write_bytes(canonical({'trace':trace,'logical':logical,'versionObserved':sqlite3.sqlite_version,'readerBinaryToPinnedNativeSourceVerified':False})+b'\n')
            native_program=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file,queries]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(),db=new D(file,{readonly:true,fileMustExist:true}),steps=[];const options=db.pragma('compile_options').map(x=>x.compile_options);steps.push('PRAGMA compile_options');db.exec('PRAGMA temp_store=MEMORY');steps.push('PRAGMA temp_store=MEMORY');const tempStore=db.pragma('temp_store',{simple:true});steps.push('PRAGMA temp_store');db.exec('PRAGMA query_only=ON');steps.push('PRAGMA query_only=ON');db.exec('BEGIN');steps.push('BEGIN');const integrity=db.pragma('integrity_check');const cases=JSON.parse(queries).map(sql=>({sql,program:db.prepare('EXPLAIN '+sql).all(),rows:db.prepare(sql).raw().all()})),version=db.prepare('SELECT sqlite_version() v').get().v,sourceId=db.prepare('SELECT sqlite_source_id() v').get().v;db.exec('ROLLBACK');db.close();process.stdout.write(JSON.stringify({steps,options,tempStore,integrity,cases,version,sourceId,platform:process.platform,mainUnchanged:before===hash(),actualInternalStatementExecutionsMeasured:false,actualNativeFileCallsMeasured:false,continuousPeakMeasured:false,linuxVfsTested:false,physicalFilesystemClosureClaimed:false}));"""
            row=native_run.run_native(native_program,[source,json.dumps([x['sql'] for x in plan['queries']])],run,temp)
            self.assertEqual(row['steps'],list(initialization.SETUP));self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertTrue(row['mainUnchanged']);self.assertEqual(row['tempStore'],2)
            self.assertEqual(row['integrity'],[{'integrity_check':'ok'}])
            grouped=next(x for x in row['cases'] if 'GROUP BY' in x['sql'])
            self.assertEqual(sum(x[1] for x in grouped['rows']),initial['stat4Rows'])
            self.assertLessEqual(sum(r['opcode']=='SorterOpen' for x in row['cases'] for r in x['program']),2)
            self.assertEqual(sum(r['opcode']=='OpenEphemeral' for x in row['cases'] for r in x['program']),0)
            self.assertGreater(sum(r['opcode']=='SorterOpen' for r in grouped['program']),0)
            initialization.replay_initialization(plan);self.assertEqual(sha(source.read_bytes()),before)
    def test_new_malformed_schema_native_probe_setup_succeeds_then_integrity_prepare_refuses(self):
        for page in (512,4096,65536):
            root=directory();temp=root/'tmp';temp.mkdir();setup=root/'setup';setup.mkdir();run=root/'malformed';run.mkdir();source=root/'dev.db'
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.unsafeMode(true);db.exec("CREATE TABLE broken(x);PRAGMA writable_schema=ON;UPDATE sqlite_master SET sql='CREATE TABLE broken (' WHERE name='broken';PRAGMA writable_schema=OFF;");db.close();process.stdout.write(JSON.stringify({page:Number(page),newFixtureOnly:true,malformedSchemaIntentional:true,testOnlyUnsafeModeUsedToCreateMalformedFixture:true}));"""
            native_run.run_native(program,[source,page],setup,temp);before=sha(source.read_bytes())
            probe=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(),steps=[],db=new D(file,{readonly:true,fileMustExist:true});let error=null,tempStore=null;try{db.pragma('compile_options');steps.push('PRAGMA compile_options');db.exec('PRAGMA temp_store=MEMORY');steps.push('PRAGMA temp_store=MEMORY');tempStore=db.pragma('temp_store',{simple:true});steps.push('PRAGMA temp_store');db.exec('PRAGMA query_only=ON');steps.push('PRAGMA query_only=ON');db.exec('BEGIN');steps.push('BEGIN');db.prepare('PRAGMA integrity_check').all();steps.push('UNEXPECTED_SUCCESS')}catch(e){error={message:e.message,code:e.code}}db.close();process.stdout.write(JSON.stringify({steps,tempStore,error,mainUnchanged:before===hash(),sourcePlanApplicableToMalformedFixture:false,actualInternalStatementExecutionsMeasured:false,linuxVfsTested:false,physicalFilesystemClosureClaimed:false}));"""
            row=native_run.run_native(probe,[source],run,temp)
            self.assertEqual(row['steps'],list(initialization.SETUP));self.assertEqual(row['tempStore'],2)
            self.assertRegex(row['error']['message'],'malformed|syntax error');self.assertTrue(row['mainUnchanged'])
            self.assertFalse(row['sourcePlanApplicableToMalformedFixture']);self.assertEqual(sha(source.read_bytes()),before)
