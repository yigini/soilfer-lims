"""NEW LOCAL pragma bodies and explicit readonly-expression hazards."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_reader_pragma_checks as checks
import retained_files as retained
import verify_kit_sorter_scratch as native_run
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'reader-check-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='rc-',dir=FIXTURES)).resolve()


class ReaderPragmaChecks(unittest.TestCase):
    def test_full_source_pins_real_constraint_callback_hazards_and_checker_heap(self):
        proof,digest=checks.source_proof();self.assertEqual(digest,sha((HERE/checks.PROOF).read_bytes()))
        self.assertGreaterEqual(len(proof['files']),85);raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        text={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('sqlite3ExprIfFalse',text['integrity_check_expression_hazard'])
        self.assertIn('XN_EXPR',text['index_expression_hazard'])
        self.assertIn('pPartIdxWhere',text['partial_index_predicate_hazard'])
        self.assertIn('OP_VCheck',text['virtual_integrity_callback_hazard'])
        self.assertIn('sqlite3MallocZero',text['lowlevel_page_bitmap_and_heap'])
        self.assertIn('pOp->p2',text['statement_journal_requires_write_transaction'])
        self.assertIn('sqlite3VdbeMultiLoad',text['ordinary_table_info_metadata'])
        self.assertIn('db->xProgress',text['lowlevel_progress_callback_hazard'])
    def test_all_memory_modes_composed_initialization_and_zero_plain_body_scratch_without_sql(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for mode in (1,2,3):
                plan=checks.pragma_body_inventory(checks.declared_plain_pragma_reader(mode));checks.replay_pragma_bodies(plan)
                self.assertEqual(len(plan['bodies']),3);self.assertEqual(plan['initialization']['maximumImplicitSqlExecutions'],4)
                for key in ('maximumBodySorterInitCalls','maximumBodyTemporaryBtreeOpenCalls','maximumBodyStatementJournalOpenCalls','maximumBodyNativeWriteTransactionStarts','maximumPmaFileCreationsIncludingConditionalInitialization','maximumPmaWriteBytesIncludingConditionalInitialization'):self.assertEqual(plan[key],0)
                for key in ('actualSchemaRestrictionsVerified','completeTableInfoInvocationCountDerived','readonlyAloneImpliesNoScratch','generalIntegrityExpressionsOrCallbacksSupported','beforeInitialReaderSqlAdmissionImplemented','pageReferenceBitmapAndCheckerHeapBounded','wholeLogicalReaderSqlScratchInventoryComplete'):self.assertFalse(plan[key])
                self.assertTrue(plan['plainSchemaRestrictionsAreDeclarationsOnly'])
    def test_every_plain_schema_restriction_prior_reader_condition_boolean_and_foreign_fields_refuse(self):
        good=checks.declared_plain_pragma_reader(1)
        for key in checks.RESTRICTIONS+('schemaUnloadedAtFirstListedPragma','pragmaFileControlsDoNotAccessSchemaOrChangeConnectionState','noPriorSqlOrSchemaUsingApiCalls'):
            with self.subTest(key=key),self.assertRaises(RuntimeError):checks.pragma_body_inventory({**good,key:False})
        for key,value in [('compileTempStore',True),('tempStorePragma',0),('nativeVersion','3.49.1'),('foreign',True)]:
            with self.assertRaises(RuntimeError):checks.pragma_body_inventory({**good,key:value})
        with self.assertRaises(RuntimeError):checks.pragma_body_inventory({k:v for k,v in good.items() if k!='noCheckConstraints'})
    def test_exact_table_info_quoting_full_nested_replay_and_no_invented_schema_or_runtime_authority(self):
        self.assertEqual(checks.table_info_sql('a"b'),'PRAGMA table_info("a""b")')
        self.assertEqual(checks.table_info_sql('x); DROP TABLE t;--'),'PRAGMA table_info("x); DROP TABLE t;--")')
        for name in ('',None,True,'x\0y'):
            with self.assertRaises(RuntimeError):checks.table_info_sql(name)
        plan=checks.pragma_body_inventory(checks.declared_plain_pragma_reader(1))
        for key in ('actualSchemaRestrictionsVerified','readonlyAloneImpliesNoScratch','runtimeConnectionHooksAndVfsPcacheBehaviorVerified','readerSqliteBinaryToPinnedNativeSourceVerified','beforeInitialReaderSqlAdmissionImplemented','profileAndBackupQueryScratchInventoriesComplete','wholeLogicalReaderSqlScratchInventoryComplete','physicalFilesystemClosureClaimed'):
            bad=copy.deepcopy(plan);bad[key]=True
            with self.assertRaises(RuntimeError):checks.replay_pragma_bodies(bad)
        for fault in ('query','drop','count','initialization','extra'):
            bad=copy.deepcopy(plan)
            if fault=='query':bad['bodies'][0]['query']='PRAGMA quick_check'
            elif fault=='drop':bad['bodies'].pop()
            elif fault=='count':bad['maximumBodyTemporaryBtreeOpenCalls']=1
            elif fault=='initialization':bad['initialization']['queries'].pop()
            else:bad['schemaOriginal']={}
            with self.assertRaises(RuntimeError):checks.replay_pragma_bodies(bad)
    def test_new_full_source_copy_native_actual_caller_and_module_mutations(self):
        proof,digest=checks.source_proof();root=directory();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/checks.PROOF).write_bytes((HERE/checks.PROOF).read_bytes())
        with patch.object(checks,'__file__',str(tooling/'kit_reader_pragma_checks.py')):
            checks.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'retained_files.py').relative_to(ROOT).as_posix(),(HERE/'kit_reader_pragma_checks.py').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):checks.source_proof()
                p.write_bytes(raw)
    def test_actual_plain_rowid_withoutrowid_indexes_literal_default_and_fk_violation_diagnostics(self):
        for page in (512,4096,65536):
            for bad in (False,True):
                root=directory();temp=root/'tmp';temp.mkdir();setup=root/'setup';setup.mkdir();run=root/'checks';run.mkdir();reader=root/'reader';reader.mkdir();source=reader/'dev.db'
                program=r"""const D=require('better-sqlite3');const[file,page,bad]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.pragma('foreign_keys=OFF');db.exec('CREATE TABLE parent(id INTEGER PRIMARY KEY);CREATE TABLE parent_comp(a TEXT,b INTEGER,UNIQUE(a,b));CREATE TABLE records(id INTEGER PRIMARY KEY,p INTEGER REFERENCES parent(id),txt TEXT NOT NULL);CREATE INDEX records_txt ON records(txt);CREATE TABLE child_w(id TEXT PRIMARY KEY,a TEXT,b INTEGER,FOREIGN KEY(a,b) REFERENCES parent_comp(a,b)) WITHOUT ROWID;INSERT INTO parent VALUES(1);INSERT INTO parent_comp VALUES(\'a\',2);INSERT INTO child_w VALUES(\'ok\',\'a\',2);');const put=db.prepare('INSERT INTO records(p,txt) VALUES(1,?)');db.transaction(()=>{for(let n=0;n<96;n++)put.run('v'+n)})();if(bad==='1')db.exec("INSERT INTO records VALUES(1000,999,'bad');INSERT INTO child_w VALUES('bad','missing',999)");db.exec("ALTER TABLE records ADD COLUMN tail TEXT DEFAULT 'literal'");db.close();process.stdout.write(JSON.stringify({page:Number(page),fkViolationsIntentional:bad==='1',newFixtureOnly:true}));"""
                native_run.run_native(program,[source,page,'1' if bad else '0'],setup,temp);before=sha(source.read_bytes())
                plan=checks.pragma_body_inventory(checks.declared_plain_pragma_reader(1));(root/'plain-pragma-plan-before-read.json').write_bytes(canonical(plan)+b'\n')
                if not bad:
                    trace=[];real=sqlite3.connect
                    def traced(*args,**kwargs):
                        db=real(*args,**kwargs);db.set_trace_callback(trace.append);return db
                    with patch.object(sqlite3,'connect',side_effect=traced):logical=retained.logical(source)
                    self.assertEqual(logical['tables']['records']['count'],96)
                    (root/'actual-python-logical-original.json').write_bytes(canonical({'versionObserved':sqlite3.sqlite_version,'trace':trace,'logical':logical,'readerBinaryToPinnedNativeSourceVerified':False})+b'\n')
                queries=['PRAGMA integrity_check','PRAGMA foreign_key_check']+[checks.table_info_sql(x) for x in ('parent','parent_comp','records','child_w')]
                probe=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file,queries,bad]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(),db=new D(file,{readonly:true,fileMustExist:true});db.pragma('temp_store=MEMORY');db.pragma('query_only=ON');db.exec('BEGIN');const cases=JSON.parse(queries).map(sql=>({sql,program:db.prepare('EXPLAIN '+sql).all(),rows:db.prepare(sql).raw().all()})),sourceId=db.prepare('SELECT sqlite_source_id() v').get().v,version=db.prepare('SELECT sqlite_version() v').get().v,tempStore=db.pragma('temp_store',{simple:true});db.exec('ROLLBACK');db.close();process.stdout.write(JSON.stringify({cases,sourceId,version,tempStore,platform:process.platform,fkViolationsIntentional:bad==='1',actualNativeTemporaryBtreeCallsMeasured:false,continuousPeakMeasured:false,linuxVfsTested:false,mainUnchanged:before===hash(),physicalFilesystemClosureClaimed:false}));"""
                row=native_run.run_native(probe,[source,json.dumps(queries),'1' if bad else '0'],run,temp)
                self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertEqual(row['tempStore'],2);self.assertTrue(row['mainUnchanged'])
                self.assertEqual(row['cases'][0]['rows'],[['ok']]);self.assertEqual(len(row['cases'][1]['rows']),2 if bad else 0)
                if bad:self.assertTrue(any(x[1] is None for x in row['cases'][1]['rows']))
                for case in row['cases']:
                    self.assertFalse(any(x['opcode'] in ('SorterOpen','OpenEphemeral','OpenAutoindex','OpenWrite','VCheck','Function','PureFunc') for x in case['program']))
                    self.assertTrue(all(x['p2']==0 for x in case['program'] if x['opcode']=='Transaction'))
                checks.replay_pragma_bodies(plan);self.assertEqual(sha(source.read_bytes()),before)
    def test_actual_fresh_readonly_discards_checks_while_writable_query_only_evaluates_them(self):
        for page in (512,4096,65536):
            root=directory();temp=root/'tmp';temp.mkdir();setup=root/'setup';setup.mkdir();run=root/'hazard';run.mkdir();source=root/'dev.db'
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.pragma('trusted_schema=ON');db.function('kit_test_check',{deterministic:true},(x)=>1);db.exec('CREATE TABLE in_table(x INTEGER CHECK(x IN (1,3,5,7,9)));CREATE TABLE function_table(x INTEGER CHECK(kit_test_check(x)));INSERT INTO in_table VALUES(1),(3),(5);INSERT INTO function_table VALUES(1),(2),(3);');db.close();process.stdout.write(JSON.stringify({page:Number(page),newFixtureOnly:true,checkExpressionAndCallbackIntentional:true}));"""
            native_run.run_native(program,[source,page],setup,temp);before=sha(source.read_bytes())
            probe=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(),observations=[];for(const readonly of [true,false]){const db=new D(file,{readonly,fileMustExist:true});let callbacks=0;db.function('kit_test_check',{deterministic:true},(x)=>{callbacks++;return 1});db.pragma('trusted_schema=ON');db.pragma('ignore_check_constraints=OFF');db.pragma('temp_store=MEMORY');db.pragma('query_only=ON');db.exec('BEGIN');const program=db.prepare('EXPLAIN PRAGMA integrity_check').all(),integrity=db.pragma('integrity_check'),sourceId=db.prepare('SELECT sqlite_source_id() v').get().v,tempStore=db.pragma('temp_store',{simple:true}),ignoreChecks=db.pragma('ignore_check_constraints',{simple:true});db.exec('ROLLBACK');db.close();observations.push({readonly,program,integrity,sourceId,tempStore,ignoreChecks,callbacks})}const ro=observations[0],rw=observations[1];process.stdout.write(JSON.stringify({program:rw.program,integrity:rw.integrity,sourceId:rw.sourceId,tempStore:rw.tempStore,callbacks:rw.callbacks,freshReadonlyProgram:ro.program,freshReadonlyCallbacks:ro.callbacks,freshReadonlyIntegrity:ro.integrity,observations,mainUnchanged:before===hash(),sourcePlanApplicableToExpressionFixture:false,actualNativeTemporaryBtreeCallsMeasured:false,continuousPeakMeasured:false,linuxVfsTested:false,physicalFilesystemClosureClaimed:false}));"""
            row=native_run.run_native(probe,[source],run,temp);self.assertEqual(row['sourceId'],native.SOURCE_ID)
            self.assertGreater(sum(x['opcode']=='OpenEphemeral' for x in row['program']),0)
            self.assertEqual(row['freshReadonlyCallbacks'],0)
            self.assertFalse(any(x['opcode'] in ('OpenEphemeral','Function','PureFunc') for x in row['freshReadonlyProgram']))
            self.assertTrue(all(x['ignoreChecks']==0 and x['tempStore']==2 for x in row['observations']))
            self.assertGreater(sum(x['opcode'] in ('Function','PureFunc') for x in row['program']),0)
            self.assertGreaterEqual(row['callbacks'],3);self.assertTrue(row['mainUnchanged']);self.assertEqual(row['tempStore'],2)
            self.assertEqual(row['integrity'],[{'integrity_check':'ok'}]);self.assertFalse(row['sourcePlanApplicableToExpressionFixture'])
            for field in ('noCheckConstraints','noCustomScalarOrCollationCallbacks'):
                bad=checks.declared_plain_pragma_reader(1);bad[field]=False
                with self.assertRaises(RuntimeError):checks.pragma_body_inventory(bad)
            self.assertEqual(sha(source.read_bytes()),before)
