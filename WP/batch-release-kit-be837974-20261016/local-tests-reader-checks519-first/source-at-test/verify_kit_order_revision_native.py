"""NEW LOCAL strict PRE209 native SQL; no full scientific predecessor chain."""
import copy,json,pathlib,shutil,sqlite3,subprocess,tempfile,unittest
from unittest.mock import patch
import kit_order_revision_native as order
import kit_wal_content as wal
import retained_files as retained
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'order-native-local-retained-fixtures'
BASE_SQL=native.inventory.RECEIPT_SQL+''';
CREATE TABLE Sample(id TEXT PRIMARY KEY,status TEXT,requiredAnalyses TEXT);
CREATE TABLE SampleOrderRevision(id TEXT PRIMARY KEY,sampleId TEXT,status TEXT,version INTEGER);
CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,status TEXT,duplicateOf TEXT);
CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,workItemId TEXT,orderLineId TEXT,status TEXT);
CREATE TABLE OrderLine(id TEXT PRIMARY KEY,revisionId TEXT,analysis TEXT,status TEXT,methodologyId TEXT,methodRevision TEXT,predecessorLineId TEXT);
'''
def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='order-',dir=FIXTURES)).resolve()
def declared(count=3,extra=''):
    root=directory();source=root/'source.db';db=sqlite3.connect(source)
    db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA wal_autocheckpoint=0');db.executescript(BASE_SQL)
    for n in range(count):db.execute('INSERT INTO OrderLine(id,status) VALUES(?,?)',(str(n),'ACTIVE'))
    if extra:db.executescript(extra)
    db.commit();target=root/'stable/dev.db';target.parent.mkdir();shutil.copyfile(source,target)
    shutil.copyfile(str(source)+'-wal',str(target)+'-wal');db.close()
    backup,state=retained.seal(root,'capture-prepared-214',target,lambda:None,schema_original='capture-schema-214.json')
    return root,target,json.loads((root/'capture-schema-214.json').read_bytes()),(root/'capture-prepared-214/logical-state.json').read_bytes(),state
class OrderRevisionNative(unittest.TestCase):
    def test_full_source_raw_ddl_alter_null_column_and_normal_populated_index_refill(self):
        proof,digest=order.source_proof();self.assertEqual(digest,sha((HERE/order.PROOF).read_bytes()))
        raw=subprocess.check_output(['git','show',proof['applicationHead']+':'+proof['ddlPath']],cwd=ROOT)
        self.assertEqual(raw.decode(),proof['ddlSql']);self.assertEqual(sha(raw),proof['ddlSha256'])
        self.assertEqual(len(proof['releaseObjects']),6);self.assertEqual(sum(r['type']=='index' for r in proof['releaseObjects']),1)
        source=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(source[row['startByte']:row['endByte']].decode(),row['text'],row['label'])
        pieces={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('WHERE type',pieces['alter_schema_update']);self.assertIn('sqlite3VdbeMemSetNull',pieces['missing_column_null'])
        self.assertIn('OP_IdxInsert',pieces['populated_index_refill']);self.assertIn('OPFLAG_USESEEKRESULT',pieces['populated_index_refill'])
        self.assertFalse(proof['collectorBindingImplemented']);self.assertFalse(proof['writerGraphAdmissionImplemented'])
    def test_exact_orderline_count_expands_keys_and_all_eight_page_sizes(self):
        _,_,observation,_,state=declared();schema=observation['schema']
        for count in (0,1,96,512):
            value=copy.deepcopy(state);value['tables']['OrderLine']['count']=count
            inv=order.order_native_inventory('209-apply',schema,value)
            self.assertEqual(sum(r['calls'] for r in inv['operations']['normalInsertions']),count+9)
            self.assertEqual(inv['operations']['createdRoots'],1);self.assertEqual(inv['operations']['deletions'],1)
            self.assertEqual(inv['existingApplicationRowsUpdated'],0);self.assertEqual(inv['maximumSqlWriteStatements'],8)
            for size in (512,1024,2048,4096,8192,16384,32768,65536):
                frame=order.order_dirty_inventory(size,schema,value)
                self.assertEqual(frame['targetFrameInventory']['maximumPageFrameEntries'],sum(frame['pagerWriteCategories'].values())*max(1,65536//size)+1)
                self.assertFalse(frame['actualNativeFrameRequestsMeasured']);self.assertFalse(frame['sorterOrSqlScratchBounded'])
    def test_unsupported_profiles_receipt_table_without_rowid_column_count_and_oversize_hazards_refuse(self):
        _,_,observation,_,state=declared();schema=observation['schema']
        for label in ('209-dry','209-repeat','FRESH_PRISMA_209','COMPLETE_209',True,None):
            with self.assertRaises(RuntimeError):order.order_native_inventory(label,schema,state)
        for fault in ('wrong-owner','without-rowid','comment','new-column','receipt-trigger','receipt-index','default','count-bool','count-negative','count-float','count-missing','state-foreign'):
            s=copy.deepcopy(schema);v=copy.deepcopy(state);line=next(r for r in s['rows'] if r[1]=='OrderLine')
            if fault=='wrong-owner':line[2]='unrelated_owner'
            elif fault=='without-rowid':line[4]+=' WITHOUT ROWID'
            elif fault=='comment':line[4]+=' /* unsupported */'
            elif fault=='new-column':line[4]=line[4][:-1]+',workItemId TEXT)'
            elif fault=='receipt-trigger':s['rows'].append(['trigger','receipt_extra','_schema_migrations',0,'CREATE TRIGGER receipt_extra AFTER INSERT ON _schema_migrations BEGIN SELECT 1; END'])
            elif fault=='receipt-index':s['rows'].append(['index','receipt_extra','_schema_migrations',99,'CREATE INDEX receipt_extra ON _schema_migrations(details)'])
            elif fault=='default':next(r for r in s['rows'] if r[1]=='_schema_migrations')[4]=order.RECEIPT_SQL.replace('CURRENT_TIMESTAMP',"'changed'")
            elif fault=='count-bool':v['tables']['OrderLine']['count']=True
            elif fault=='count-negative':v['tables']['OrderLine']['count']=-1
            elif fault=='count-float':v['tables']['OrderLine']['count']=1.0
            elif fault=='count-missing':del v['tables']['OrderLine']['count']
            elif fault=='state-foreign':v['unknown']=True
            v['objects']=[[r[0],r[1],r[2],r[4]] for r in s['rows'] if not r[1].startswith('sqlite_')]
            with self.subTest(fault=fault),self.assertRaises(RuntimeError):order.order_native_inventory('209-apply',s,v)
        v=copy.deepcopy(state);v['tables']['OrderLine']['count']=1000000
        with self.assertRaisesRegex(RuntimeError,'never clip'):order.order_dirty_inventory(512,schema,v)
        inv=order.order_dirty_inventory(65536,schema,state)
        with self.assertRaisesRegex(RuntimeError,'never clip'):wal.wal_content_bound(65536,32+((32*1024**3-32)//65560)*65560,inv['targetFrameInventory'])
    def test_source_bound_schema_count_byte_identity_authority_and_replay_without_target_sql(self):
        root,target,observation,raw,_=declared(7)
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            plan=order.schema_bound_order_wal_plan(observation,raw,target);order.recheck_order_wal(plan)
        self.assertTrue(plan['collectorSourceByteBindingVerified']);self.assertEqual(plan['plan']['inventory']['nativeInventory']['declaredOrderLineRows'],7)
        self.assertFalse(plan['intactSourceAndNativeRecoveredIndexVerified']);self.assertFalse(plan['wholeOwnerFrameInventoryVerified'])
        (root/'source-bound-order-plan.json').write_bytes(canonical(plan)+b'\n')
        for key in ('collectorSourceByteBindingVerified','writerGraphAdmissionImplemented','intactSourceAndNativeRecoveredIndexVerified'):
            bad=copy.deepcopy(plan);bad[key]=not bad[key]
            with self.assertRaisesRegex(RuntimeError,'record changed'):order.recheck_order_wal(bad)
        changed=copy.deepcopy(plan);changed['logicalState']['tables']['OrderLine']['count']=8
        with self.assertRaises(RuntimeError):order.recheck_order_wal(changed)
        original=root/'retained-original-main.db';target.rename(original);shutil.copyfile(original,target)
        with self.assertRaises(RuntimeError):order.recheck_order_wal(plan)
    def test_new_full_source_copy_detects_same_length_native_or_owner_container_mutation(self):
        root=directory();proof,_=order.source_proof();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/order.PROOF).write_bytes((HERE/order.PROOF).read_bytes())
        with patch.object(order,'__file__',str(tooling/'kit_order_revision_native.py')):
            order.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'readonly-target-wal-source.json').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):order.source_proof()
                p.write_bytes(raw)
    def test_pinned_native_alter_populated_index_full_payloads_and_commit_rollback_three_page_sizes(self):
        proof,_=order.source_proof()
        program=r"""const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const [root,size,mode,inputFile]=process.argv.slice(1),input=JSON.parse(fs.readFileSync(inputFile)),target=path.join(root,'native.db');
        const db=new Database(target);db.pragma('page_size='+size);db.pragma('journal_mode=WAL');db.pragma('wal_autocheckpoint=0');db.pragma('cache_size=4');db.pragma('secure_delete=ON');db.pragma('foreign_keys=ON');
        db.exec(input.baseSql.replace('status TEXT,methodologyId','status TEXT CHECK(length(status)>=0 AND length(\''+'z'.repeat(8192)+'\')>0),methodologyId'));
        const put=db.prepare('INSERT INTO OrderLine(rowid,id,status) VALUES(?,?,?)');
        db.transaction(()=>{for(let n=0;n<96;n++)put.run(n%2?9223372036854775700n+BigInt(n):-9223372036854775700n+BigInt(n),'line-'+n,'ACTIVE');})();
        const schema={version:1,scope:'DECLARED_COMPLETE_SQLITE_SCHEMA',encoding:1,rows:db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name').all().map(r=>[r.type,r.name,r.tbl_name,r.rootpage,r.sql])};
        const tables={};for(const r of db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all())tables[r.name]={columns:db.prepare('PRAGMA table_info("'+r.name+'")').all().map(c=>c.name),count:db.prepare('SELECT count(*) n FROM "'+r.name+'"').get().n,sha256:'0'.repeat(64)};
        const state={objects:schema.rows.filter(r=>!r[1].startsWith('sqlite_')).map(r=>[r[0],r[1],r[2],r[4]]),tables,integrity:'ok',foreignKeyViolations:0};
        fs.mkdirSync(path.join(root,'baseline'));fs.copyFileSync(target,path.join(root,'baseline/dev.db'));fs.copyFileSync(target+'-wal',path.join(root,'baseline/dev.db-wal'));
        const before=db.prepare('SELECT id,status FROM OrderLine ORDER BY id').all(),main=fs.readFileSync(target),initial=fs.readFileSync(target+'-wal');
        process.stdout.write(JSON.stringify({schema,state,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,version:db.prepare('SELECT sqlite_version() v').get().v})+'\n');
        if(fs.readFileSync(0,'utf8')!=='GO')throw Error('LOCAL_PARENT_REFUSED');
        const programs=[],samples=[];let rolled=false,indexRoot=null;
        try{db.transaction(()=>{for(const sql of input.statements){programs.push({sql,program:db.prepare('EXPLAIN '+sql).all()});db.exec(sql);samples.push(fs.statSync(target+'-wal').size);}
          db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(input.marker,input.receipt);samples.push(fs.statSync(target+'-wal').size);
          if(mode==='rollback')throw Error('LOCAL_FULL_ROLLBACK');}).immediate();}catch(e){if(e.message!=='LOCAL_FULL_ROLLBACK')throw e;rolled=true;}
        const after=db.prepare('SELECT id,status FROM OrderLine ORDER BY id').all();if(!rolled)indexRoot=db.prepare('SELECT rootpage FROM sqlite_schema WHERE name=?').get('OrderLine_workItemId_idx').rootpage;
        fs.writeFileSync(path.join(root,'wal-before-close-original'),fs.readFileSync(target+'-wal'));
        const schemaAfter=db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name').all().map(r=>[r.type,r.name,r.tbl_name,r.rootpage,r.sql]);
        const final={schemaAfter,receiptRows:db.prepare('SELECT count(*) n FROM _schema_migrations').get().n,programs,samples,rolled,indexRoot,oldRowsPreserved:JSON.stringify(before)===JSON.stringify(after),nullLinks:rolled?null:db.prepare('SELECT count(*) n FROM OrderLine WHERE workItemId IS NULL').get().n,
          initialPrefixPreserved:initial.equals(fs.readFileSync(target+'-wal').subarray(0,initial.length)),mainBeforeCloseUnchanged:main.equals(fs.readFileSync(target)),integrity:db.pragma('integrity_check',{simple:true}),actualNativeFrameRequestsMeasured:false,fullInstallerChainExecuted:false,continuousPeakMeasured:false};
        db.close();fs.copyFileSync(target,path.join(root,'main-after-close-original'));process.stdout.write(JSON.stringify(final)+'\n');"""
        for size in (512,4096,65536):
            for mode in ('rollback','commit'):
                root=directory();data={'baseSql':BASE_SQL,'statements':proof['statements'],'marker':order.MARKER,'receipt':json.dumps(proof['receiptFixture'],separators=(',',':'))}
                (root/'input.json').write_bytes(canonical(data)+b'\n');args=[shutil.which('node'),'-e',program,str(root),str(size),mode,str(root/'input.json')]
                (root/'native-program.cjs').write_text(program,encoding='utf8');(root/'native-command.json').write_bytes(canonical(args)+b'\n')
                child=subprocess.Popen(args,cwd=ROOT/'server',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE);first=child.stdout.readline()
                try:
                    initial=json.loads(first);self.assertEqual(initial['sourceId'],native.SOURCE_ID);self.assertEqual(initial['version'],'3.51.2')
                    with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained target SQL')):plan=order.order_wal_plan(root/'baseline/dev.db',initial['schema'],initial['state'])
                    (root/'conditional-order-plan.json').write_bytes(canonical(plan)+b'\n')
                except BaseException:
                    out,err=child.communicate(input=b'REFUSE');(root/'stdout-original.jsonl').write_bytes(first+out);(root/'stderr-original.txt').write_bytes(err);raise
                out,err=child.communicate(input=b'GO');(root/'stdout-original.jsonl').write_bytes(first+out);(root/'stderr-original.txt').write_bytes(err)
                self.assertEqual(child.returncode,0,err.decode(errors='replace'));after=json.loads(out)
                self.assertTrue(after['oldRowsPreserved']);self.assertEqual(after['integrity'],'ok');self.assertTrue(after['mainBeforeCloseUnchanged']);self.assertTrue(after['initialPrefixPreserved'])
                for sample in after['samples']:self.assertLessEqual(sample,plan['observation']['bound']['maximumWalLogicalContentBytes'])
                self.assertEqual(after['receiptRows'],0 if mode=='rollback' else 1)
                if mode=='rollback':self.assertEqual(after['schemaAfter'],initial['schema']['rows'])
                if mode=='commit':
                    self.assertEqual(after['nullLinks'],96);sizes=native.payload_sizes((root/'main-after-close-original').read_bytes(),size,after['indexRoot'])
                    self.assertEqual(len(sizes),96);self.assertLessEqual(max(sizes),32)
                ops=[r for item in after['programs'] for r in item['program']]
                self.assertEqual(sum(r['opcode']=='CreateBtree' for r in ops),1);self.assertEqual(sum(r['opcode']=='IdxInsert' for r in ops),1)
                self.assertLessEqual(sum(r['opcode']=='SetCookie' for r in ops),21);self.assertFalse(after['actualNativeFrameRequestsMeasured'])
    def test_unmodified_raw209_body_with_explicit_prerequisite_and_source_path_standins(self):
        root=directory();payload={'baseSql':BASE_SQL,'source':json.loads((HERE/'readonly-target-wal-source.json').read_bytes())};(root/'input.json').write_bytes(canonical(payload)+b'\n')
        program=r"""const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const [root,inputPath]=process.argv.slice(1),input=JSON.parse(fs.readFileSync(inputPath)),repo=path.resolve(process.cwd(),'..'),target=path.join(root,'dev.db');
        const db=new Database(target);db.pragma('journal_mode=WAL');db.exec(input.baseSql);for(let i=0;i<12;i++)db.prepare('INSERT INTO OrderLine(id,status) VALUES(?,?)').run('old-'+i,'ACTIVE');db.close();
        fs.mkdirSync(path.join(root,'policy'));const copy=path.join(root,'policy/dev.db');fs.copyFileSync(target,copy);
        const hashes=()=>Object.fromEntries(['','-wal','-shm'].map(s=>[s,fs.existsSync(target+s)?crypto.createHash('sha256').update(fs.readFileSync(target+s)).digest('hex'):null]));
        const before=hashes(),realLoad=Module._load,realRead=fs.readFileSync,cache=new Map(),texts=new Map(Object.entries(input.source.applicationSourceText).map(([n,t])=>[path.resolve(repo,n),t]));
        const ddl=path.resolve(repo,'server/prisma/migrations/20261014000100_order_revision_contract/migration.sql');
        fs.readFileSync=function(p,...args){if(path.resolve(String(p))===ddl)return Buffer.from(texts.get(ddl));return realRead.call(this,p,...args);};
        Module._load=function(request,parent,isMain){const filename=Module._resolveFilename(request,parent,isMain);
          if(filename===path.resolve(repo,'server/scripts/install_lab_policy_schema.js'))return {assertLabPolicyStartupReady:()=>({readonlySnapshot:{path:copy,originalDbWalShmSha256:before}})};
          if(filename===path.resolve(repo,'server/scripts/install_control_charts.js'))return {assertControlChartStartupReady:()=>({classification:'COMPLETE_214'})};
          if(texts.has(filename)){if(cache.has(filename))return cache.get(filename).exports;const m=new Module(filename,parent);cache.set(filename,m);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));if(filename.endsWith('.json'))m.exports=JSON.parse(texts.get(filename));else m._compile(texts.get(filename),filename);return m.exports;}
          return realLoad.call(this,request,parent,isMain);};
        const result=require(path.resolve(repo,'server/scripts/install_order_revisions.js')).installOrderRevisions({dbPath:target,apply:true});
        const check=new Database(target,{readonly:true,fileMustExist:true}),rows=check.prepare('SELECT id,status,workItemId FROM OrderLine ORDER BY id').all();
        const output={result,rows,version:check.prepare('SELECT sqlite_version() v').get().v,sourceId:check.prepare('SELECT sqlite_source_id() v').get().v,unmodified209RawBodyExecuted:true,prerequisiteApprovalsExplicitStandins:true,rawDdlFilesystemPathExplicitStandin:true,fullPredecessorInstallerChainExecuted:false,actualNativeFrameRequestsMeasured:false};check.close();process.stdout.write(JSON.stringify(output));"""
        args=[shutil.which('node'),'-e',program,str(root),str(root/'input.json')];(root/'native-program.cjs').write_text(program,encoding='utf8');(root/'native-command.json').write_bytes(canonical(args)+b'\n')
        child=subprocess.run(args,cwd=ROOT/'server',capture_output=True);(root/'stdout-original.json').write_bytes(child.stdout);(root/'stderr-original.txt').write_bytes(child.stderr)
        self.assertEqual(child.returncode,0,child.stderr.decode(errors='replace'));v=json.loads(child.stdout)
        self.assertEqual(v['sourceId'],native.SOURCE_ID);self.assertEqual(v['result']['mode'],'APPLIED');self.assertEqual(v['result']['previousClassification'],'PRE_209');self.assertEqual(v['result']['classification'],'COMPLETE_209')
        self.assertEqual(len(v['rows']),12);self.assertTrue(all(r['workItemId'] is None and r['status']=='ACTIVE' for r in v['rows']));self.assertTrue(v['result']['originalRowsPreserved']);self.assertFalse(v['fullPredecessorInstallerChainExecuted'])