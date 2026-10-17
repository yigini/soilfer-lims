"""NEW LOCAL future profile SQL catalogs; no initial-reader admission."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_record_profile_scratch as profile
import kit_record_payload as record
import retained_files as retained
import verify_kit_record_payload as record_fixture
import verify_kit_sorter_scratch as native_run
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[1]
FIXTURES=HERE/'profile-local-retained-fixtures'
def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='rpc-',dir=FIXTURES)).resolve()

class RecordProfileScratch(unittest.TestCase):
    def test_full_source_pins_exact_actual_collector_functions_and_builtin_aggregate_paths(self):
        proof,digest=profile.source_proof();self.assertEqual(digest,sha((HERE/profile.PROOF).read_bytes()))
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        for row in proof['callerExcerpts']:
            b=(ROOT/row['path']).read_bytes();self.assertEqual(b[row['startByte']:row['endByte']].decode(),row['text'])
        parts={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('OP_OpenEphemeral',parts['aggregate_distinct_or_ordered_only_temp_producers'])
        self.assertIn('single row',parts['ungrouped_aggregate_direct_scan'])
        self.assertIn('sqlite3VdbeMemCopy',parts['builtin_minmax_context_only'])
        self.assertTrue(any(r['function']=='collect_record_profiles' for r in proof['callerExcerpts']))
    def test_all_memory_modes_complete_quoted_catalog_fixed_counts_empty_inventory_and_no_sql(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for mode in (1,2,3):
                p=profile.profile_inventory({'b':['q"x','v'],'a':['id']},profile.declared_profile_reader(mode));profile.replay_profile_inventory(p)
                self.assertEqual(p['sqlInvocationCount'],15);self.assertEqual(len(p['queries']),15)
                self.assertEqual(p['columnAggregateInvocations'],3);self.assertEqual(p['tableXinfoInvocations'],2)
                self.assertEqual(sum(x['maximumPossibleSorterInitCalls'] for x in p['queries']),1)
                self.assertTrue(p['futureAlreadyPreparedInvocationOnly']);self.assertFalse(p['processHeapOrPhysicalMemoryBounded'])
                self.assertIn('"q""x"',profile.column_query('b','q"x'))
                self.assertEqual(profile.profile_inventory({},profile.declared_profile_reader(mode))['sqlInvocationCount'],10)
    def test_incomplete_nonordinary_callback_builtin_entry_types_and_oversized_catalog_refuse(self):
        d=profile.declared_profile_reader(1)
        for key in profile.CONDITIONS+('settingHeldForEntireProfileInvocation','freshUnshadowedConnection'):
            with self.subTest(key=key),self.assertRaises(RuntimeError):profile.profile_inventory({'t':['x']},{**d,key:False})
        for bad in ({'t':[]},{'t':['x','X']},{'t':['x',True]},{'t':'x'},{'t\0':['x']},{'t':['x'],'T':['y']},[]):
            with self.assertRaises(RuntimeError):profile.profile_inventory(bad,d)
        for key,val in [('compileTempStore',True),('compileTempStore',0),('nativeVersion','3.49.1'),('foreign',True)]:
            with self.assertRaises(RuntimeError):profile.profile_inventory({'t':['x']},{**d,key:val})
        with self.assertRaisesRegex(RuntimeError,'proof envelope'):profile.profile_inventory({'t'*profile.LIMIT:['x']},d)
    def test_entire_query_count_group_distinct_and_authority_replay_refusals(self):
        p=profile.profile_inventory({'t':['x']},profile.declared_profile_reader(1))
        for key in ('actualBuiltinAndTableInventoryVerified','readerSqliteBinaryToPinnedNativeSourceVerified','beforeInitialReaderSqlAdmissionImplemented','wholeLogicalReaderSqlScratchInventoryComplete','profileEnvelopeIsPreSqlPhysicalCapacity','physicalFilesystemClosureClaimed'):
            b=copy.deepcopy(p);b[key]=True
            with self.assertRaises(RuntimeError):profile.replay_profile_inventory(b)
        for sql in ('SELECT count(DISTINCT x) FROM t','SELECT max(x) FROM t GROUP BY x','SELECT max(x ORDER BY x) FROM t'):
            b=copy.deepcopy(p);b['queries'][-3]['sql']=sql
            with self.assertRaises(RuntimeError):profile.replay_profile_inventory(b)
        for fault in ('count','missing','extra'):
            b=copy.deepcopy(p)
            if fault=='count':b['sqlInvocationCount']+=1
            elif fault=='missing':b['queries'].pop()
            else:b['laterProfile']={}
            with self.assertRaises(RuntimeError):profile.replay_profile_inventory(b)
    def test_new_full_source_copy_and_same_length_native_module_and_actual_collector_mutations(self):
        proof,digest=profile.source_proof();root=directory();tool=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tool/profile.PROOF).write_bytes((HERE/profile.PROOF).read_bytes())
        with patch.object(profile,'__file__',str(tool/'kit_record_profile_scratch.py')):
            profile.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_record_profile_scratch.py').relative_to(ROOT).as_posix(),(HERE/'kit_record_payload.py').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):profile.source_proof()
                p.write_bytes(raw)
    def test_actual_new_python_owned_reader_future_profile_has_exact_preplanned_sql_catalog(self):
        root,source,writer,backup,state,observation,old_profile,target=record_fixture.fixture('CREATE TABLE empty(a TEXT,b BLOB)')
        out=directory();tables={n:r['columns'] for n,r in state['tables'].items()};plan=profile.profile_inventory(tables,profile.declared_profile_reader(1));(out/'profile-plan-before-future-invocation.json').write_bytes(canonical(plan)+b'\n')
        path=root/'capture-prepared-214/reader/dev.db';before=sha(path.read_bytes());db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
        try:
            retained.memory_temporaries(db);db.execute('PRAGMA query_only=ON');db.execute('BEGIN');db.execute('SELECT count(*) FROM main.sqlite_schema').fetchone()
            calls=[];db.set_trace_callback(calls.append);observed=record.collect_record_profiles(db,observation['schema'],state);db.set_trace_callback(None);db.rollback()
            self.assertEqual(calls,[r['sql'] for r in plan['queries']]);self.assertEqual(observed['tables'],old_profile['tables'])
            self.assertEqual(sha(path.read_bytes()),before);profile.replay_profile_inventory(plan)
            (out/'actual-python-future-profile-original.json').write_bytes(canonical({'versionObserved':sqlite3.sqlite_version,'trace':calls,'profile':observed,'plan':plan,'earlierLogicalAndSchemaPrerequisitesNotAdmitted':True,'traceObserverIsTestOnly':True,'actualNoHookProfileVerified':False,'readerBinarySourceBindingVerified':False})+b'\n')
        finally:db.close();writer.close()
    def test_actual_pinned_native_exact_profile_queries_full_schema_and_ungrouped_aggregates(self):
        tables={'empty':['a','b'],'mixed':['id','i','r','s','b']}
        for page in (512,4096,65536):
            root=directory();setup=root/'setup';setup.mkdir();run=root/'profile';run.mkdir();temp=root/'tmp';temp.mkdir();reader=root/'reader';reader.mkdir();source=reader/'dev.db'
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.exec('CREATE TABLE empty(a TEXT,b BLOB);CREATE TABLE mixed(id INTEGER PRIMARY KEY,i BLOB,r BLOB,s BLOB,b BLOB)');const q=db.prepare('INSERT INTO mixed VALUES(?,?,?,?,?)');q.run(1,null,null,null,null);q.run(2,-9223372036854775808n,1.5,'a\0é中',Buffer.alloc(8192));q.run(3,9223372036854775807n,Infinity,'long'.repeat(50),Buffer.from('z'));q.run(4,0,-0,'',Buffer.alloc(0));db.close();process.stdout.write(JSON.stringify({page:Number(page),newFixtureOnly:true}));"""
            native_run.run_native(program,[source,page],setup,temp);plan=profile.profile_inventory(tables,profile.declared_profile_reader(1));(root/'profile-plan-before-native-invocation.json').write_bytes(canonical(plan)+b'\n')
            program=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file,queries]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(),db=new D(file,{readonly:true,fileMustExist:true});db.pragma('temp_store=MEMORY');db.pragma('query_only=ON');db.exec('BEGIN');db.prepare('SELECT count(*) FROM main.sqlite_schema').get();const cases=JSON.parse(queries).map(q=>({family:q.family,sql:q.sql,program:db.prepare('EXPLAIN '+q.sql).all(),rows:db.prepare(q.sql).raw().all()})),sourceId=db.prepare('SELECT sqlite_source_id() s').get().s,tempStore=db.pragma('temp_store',{simple:true});db.exec('ROLLBACK');db.close();process.stdout.write(JSON.stringify({cases,sourceId,tempStore,mainUnchanged:before===hash(),actualNativeCallsMeasured:false,linuxVfsTested:false,continuousPeakMeasured:false,physicalFilesystemClosureClaimed:false}));"""
            row=native_run.run_native(program,[source,json.dumps(plan['queries'])],run,temp);self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertTrue(row['mainUnchanged']);self.assertEqual(row['tempStore'],2)
            self.assertEqual(len(row['cases']),19)
            for case in row['cases']:
                ops=[x['opcode'] for x in case['program']]
                self.assertFalse(any(x in ('OpenEphemeral','OpenAutoindex','OpenWrite') for x in ops));self.assertLessEqual(ops.count('SorterOpen'),1 if case['family']=='full-schema' else 0)
                if case['family']=='column-aggregate':
                    self.assertEqual(ops.count('AggStep'),3);self.assertEqual(ops.count('AggFinal'),3)
                    self.assertIn(case['rows'][0][0],(0,4))
            profile.replay_profile_inventory(plan)
