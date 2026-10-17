"""Restricted capture write inventory; real LOCAL native DDL, never an owner."""
import copy
import hashlib
import json
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_capture_native_inventory as inventory
import kit_main_mutations as mutations
from kit_contract import canonical

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'capture-native-inventory-local-retained-fixtures'
SOURCE_ID='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='native-',dir=FIXTURES)).resolve()


def proof():
    return json.loads((HERE/inventory.PROOF_NAME).read_bytes())


def schema():
    # These are NEW in-memory LOCAL observations, not production declarations.
    db=sqlite3.connect(':memory:')
    db.execute(inventory.RECEIPT_SQL);db.execute('CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY)')
    rows=[list(r) for r in db.execute('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY rowid')]
    db.close();return {'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':rows}


def native(program,args,root,label):
    result=subprocess.run([shutil.which('node'),'-e',program,*map(str,args)],cwd=HERE.parents[1]/'server',capture_output=True)
    (root/(label+'.stdout-original')).write_bytes(result.stdout)
    (root/(label+'.stderr-original')).write_bytes(result.stderr)
    if result.returncode!=0:raise AssertionError(result.stderr.decode(errors='replace'))
    if result.stderr:raise AssertionError('Unexpected native stderr')
    return json.loads(result.stdout) if result.stdout else None


def payload_sizes(raw,page_size,root):
    """Read full payload-length varints from actual table/index B-tree cells.

    The length includes native record headers and overflow content, even though
    this test reader need not follow the overflow chain to retrieve its bytes.
    """
    def varint(data,at):
        value=0
        for i in range(9):
            byte=data[at+i]
            if i==8:return (value<<8)|byte,i+1
            value=(value<<7)|(byte&127)
            if byte<128:return value,i+1
        raise AssertionError('Unreachable varint')
    pending=[root];seen=set();sizes=[]
    while pending:
        number=pending.pop();assert number not in seen;seen.add(number)
        data=raw[(number-1)*page_size:number*page_size];offset=100 if number==1 else 0
        kind=data[offset];assert kind in (2,5,10,13)
        interior=kind in (2,5);header=12 if interior else 8
        count=int.from_bytes(data[offset+3:offset+5],'big')
        if interior:pending.append(int.from_bytes(data[offset+8:offset+12],'big'))
        for i in range(count):
            at=int.from_bytes(data[offset+header+2*i:offset+header+2*i+2],'big')
            if interior:pending.append(int.from_bytes(data[at:at+4],'big'));at+=4
            if kind!=5:sizes.append(varint(data,at)[0])
    return sizes


class CaptureNativeInventoryTests(unittest.TestCase):
    def test_full_pre_inventory_counts_internal_schema_overwrites_implicit_indexes_and_receipt(self):
        for label,roots,calls,deletes in [('capture-206-prepare',7,15,2),('capture-214-prepare',15,33,4)]:
            value=inventory.capture_native_inventory(label,schema());ops=value['operations']
            self.assertEqual(ops['createdRoots'],roots)
            self.assertEqual(sum(r['calls'] for r in ops['normalInsertions']),calls)
            self.assertEqual(ops['deletions'],deletes)
            self.assertEqual(value['receiptTableInsertCalls'],1);self.assertEqual(value['receiptIndexInsertCalls'],1)
            self.assertTrue(any(o['implicit'] for o in proof()['profiles'][label]['objects']))
            self.assertTrue(all(r['applicationDataInsertCalls']==0 for r in value['categories']))

    def test_extra_receipt_trigger_index_and_noncanonical_default_generated_or_foreign_key_refuse(self):
        additions=[['trigger','receipt_trigger','_schema_migrations',0,'CREATE TRIGGER receipt_trigger AFTER INSERT ON _schema_migrations BEGIN DELETE FROM WorkAttempt; END'],
            ['trigger','sqlite_hidden_trigger','_schema_migrations',0,'CREATE TRIGGER ignored'],
            ['index','receipt_extra','_schema_migrations',99,'CREATE INDEX receipt_extra ON _schema_migrations(details)'],
            ['index','sqlite_autoindex__schema_migrations_2','_schema_migrations',99,None],
            ['trigger','case_receipt_trigger','_SCHEMA_MIGRATIONS',0,'CREATE TRIGGER ignored']]
        for row in additions:
            value=schema();value['rows'].append(row)
            with self.subTest(row=row):
                with self.assertRaises(RuntimeError):inventory.capture_native_inventory('capture-206-prepare',value)
        for sql in [inventory.RECEIPT_SQL.replace('CURRENT_TIMESTAMP',"'a'"),
            inventory.RECEIPT_SQL.replace('"details" TEXT','"details" TEXT GENERATED ALWAYS AS (id)'),
            inventory.RECEIPT_SQL.replace('"details" TEXT','"details" TEXT REFERENCES WorkAttempt(id)'),
            inventory.RECEIPT_SQL.replace('"details" TEXT','"details" TEXT UNIQUE'),
            inventory.RECEIPT_SQL+' WITHOUT ROWID']:
            value=schema();next(r for r in value['rows'] if r[0]=='table' and r[1]=='_schema_migrations')[4]=sql
            with self.subTest(sql=sql):
                with self.assertRaises(RuntimeError):inventory.capture_native_inventory('capture-206-prepare',value)

    def test_filtered_partial_duplicate_boolean_non_utf8_virtual_and_colliding_shapes_refuse(self):
        variants=[]
        for key,v in [('version',True),('encoding',True),('encoding',2),('scope','FILTERED_LOGICAL_OBJECTS'),('extra',1)]:
            value=schema();value[key]=v;variants.append(value)
        value=schema();value['rows']=[r for r in value['rows'] if not r[1].startswith('sqlite_')];variants.append(value)
        value=schema();value['rows'].append(copy.deepcopy(value['rows'][0]));variants.append(value)
        value=schema();value['rows'][0][3]=True;variants.append(value)
        value=schema();value['rows'].append(['table','v','v',99,'CREATE VIRTUAL TABLE v USING fts5(x)']);variants.append(value)
        value=schema();value['rows'].append(['table','samplecontainer','samplecontainer',99,'CREATE TABLE samplecontainer(id TEXT)']);variants.append(value)
        value=schema();value['rows'][0][3]=value['rows'][1][3];variants.append(value)
        value=schema();value['rows']=[r for r in value['rows'] if r[1]!='WorkAttempt' and r[2]!='WorkAttempt'];variants.append(value)
        for value in variants:
            with self.subTest(value=value):
                with self.assertRaises(RuntimeError):inventory.capture_native_inventory('capture-206-prepare',value)
        with self.assertRaises(RuntimeError):inventory.capture_native_inventory('release-206',schema())

    def test_separately_reviewed_normal_mutation_arithmetic_counts_two_delete_balances_and_refuses_bad_counts(self):
        target=directory()/'dev.db';db=sqlite3.connect(target);db.execute('CREATE TABLE t(id INTEGER PRIMARY KEY)');db.close()
        raw=target.read_bytes();ops=inventory.capture_native_inventory('capture-206-prepare',schema())['operations']
        bound=mutations.mutation_growth_bound(raw[:100],len(raw),ops)
        self.assertEqual(bound['nativeDeleteCalls'],2);self.assertEqual(bound['deleteBalanceAllocationCalls'],428)
        allocations=ops['createdRoots']+428+15*107+bound['maximumOverflowAllocationCalls']
        self.assertEqual(bound['maximumAdditionalPages'],2*allocations)
        for key,v in [('version',True),('scope','SQL_UPDATES'),('deletions',True),('deletions',-1),('deletions',1000000),('foreign',0)]:
            changed=copy.deepcopy(ops);changed[key]=v
            with self.subTest(key=key,v=v):
                with self.assertRaises(RuntimeError):mutations.mutation_growth_bound(raw[:100],len(raw),changed)

    def test_inventory_never_collects_target_sql_or_grants_writer_collector_vfs_authority(self):
        value=schema();before=canonical(value)
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained target SQL')):
            result=inventory.capture_native_inventory('capture-206-prepare',value)
        self.assertEqual(canonical(value),before)
        for key in ('collectorBindingImplemented','callerReviewVerified','writerGraphAdmissionImplemented',
            'mainFileLengthOrVfsPreallocationBounded','walGrowthBounded','statementOrSqlScratchBounded','physicalFilesystemClosureClaimed'):
            self.assertIs(result[key],False)
        self.assertIs(result['requiresBeforeCreateSourceAndCollectorBinding'],True)

    def test_exact_raw_git_native_excerpts_and_all_ddl_descriptor_sources_are_pinned(self):
        p=proof();raw=(HERE.parents[1]/p['nativeSource']['path']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),p['nativeSource']['sha256']);self.assertEqual(len(raw),p['nativeSource']['bytes'])
        lines=raw.splitlines(keepends=True)
        for row in p['nativeExcerpts']:
            self.assertEqual(hashlib.sha256(b''.join(lines[row['firstLine']-1:row['lastLine']])).hexdigest(),row['sha256'])
        for path,row in p['files'].items():
            raw=subprocess.check_output(['git','show','be837974:'+path],cwd=HERE.parents[1])
            self.assertEqual(hashlib.sha256(raw).hexdigest(),row['sha256']);self.assertEqual(len(raw),row['bytes'])
            self.assertEqual(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),row['gitBlob'])
        for name,key in [('main-growth-source.json','normalInsertionProofSha256'),('capture-writer-journal-source.json','mainJournalCallerProofSha256')]:
            self.assertEqual(hashlib.sha256((HERE/name).read_bytes()).hexdigest(),p[key])
        self.assertTrue(any('Filtered logical-state.objects' in s for s in p['derivation']))

    def test_actual_pinned_native_full_ddl_schema_and_receipt_programs_payloads_commit_and_rollback(self):
        create=r'''const fs=require('node:fs'),Database=require('better-sqlite3'),db=new Database(process.argv[1]);
        const input=JSON.parse(fs.readFileSync(process.argv[2]));db.pragma('page_size='+input.pageSize);
        db.exec(input.receiptSql+'; CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY)');
        db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run('old','retained');
        const rows=db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY rowid').raw().all();
        db.close();process.stdout.write(JSON.stringify({version:1,scope:'DECLARED_COMPLETE_SQLITE_SCHEMA',encoding:1,rows}));'''
        apply=r'''const fs=require('node:fs'),Database=require('better-sqlite3'),db=new Database(process.argv[1],{fileMustExist:true});
        const input=JSON.parse(fs.readFileSync(process.argv[2])),programs=[],samples=[];let refused=false;
        // TEST-ONLY cache, not an application owner or installer chain.
        db.pragma('cache_size=4');
        try{db.transaction(()=>{for(const sql of input.statements){
          programs.push(db.prepare('EXPLAIN '+sql).all());db.exec(sql);
          samples.push({pages:db.pragma('page_count',{simple:true}),fileBytes:fs.statSync(process.argv[1]).size});}
          const sql='INSERT INTO _schema_migrations(id,details) VALUES(?,?)';
          programs.push(db.prepare('EXPLAIN '+sql).all(input.marker,input.details));
          db.prepare(sql).run(input.marker,input.details);
          samples.push({pages:db.pragma('page_count',{simple:true}),fileBytes:fs.statSync(process.argv[1]).size});
          if(input.mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();}
        catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;refused=true;}
        const result={programs,samples,refused,rows:db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY rowid').raw().all(),
          receipts:db.prepare('SELECT id,details FROM _schema_migrations ORDER BY id').all(),
          version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,
          integrity:db.pragma('integrity_check',{simple:true}),journalMode:db.pragma('journal_mode',{simple:true}),platform:process.platform,
          applicationInstallersExecuted:false,continuousPeakMeasured:false,physicalFilesystemClosureClaimed:false};
        db.close();process.stdout.write(JSON.stringify(result));'''
        for label,profile in proof()['profiles'].items():
            ddl=subprocess.check_output(['git','show','be837974:'+profile['ddlPath']],cwd=HERE.parents[1]).decode()
            statements=[];pending=''
            for char in ddl:
                pending+=char
                if char==';' and sqlite3.complete_statement(pending):statements.append(pending);pending=''
            self.assertFalse(pending.strip());self.assertEqual(''.join(statements).rstrip(),ddl.rstrip())
            for size in (512,4096,65536):
                root=directory();target=root/'dev.db';input_file=root/'input.json'
                base={'pageSize':size,'receiptSql':inventory.RECEIPT_SQL,'statements':statements,'marker':profile['receiptMarker']}
                details={'sources':{'migrationSha256':profile['ddlSha256'],'contractVersion':profile['receiptMarker'][:3]+'-v1'},
                    'originalRowsSha256':'a'*64,'originalRowsPreserved':True,'backfilledCount':0,'receiptSha256':'b'*64}
                base['details']=json.dumps(details,separators=(',',':'));self.assertEqual(len(base['details']),profile['receiptJsonBytes'])
                input_file.write_bytes(canonical(base));observation=native(create,[target,input_file],root,'create')
                declared=inventory.capture_native_inventory(label,observation);raw=target.read_bytes()
                bound=mutations.mutation_growth_bound(raw[:100],len(raw),declared['operations'])
                (root/'conditional-inventory-and-bound.json').write_bytes(canonical({'inventory':declared,'bound':bound}))
                before=hashlib.sha256(raw).hexdigest()
                for mode in ('rollback','commit'):
                    input_file_mode=root/(mode+'.input.json');input_file_mode.write_bytes(canonical(dict(base,mode=mode)))
                    observed=native(apply,[target,input_file_mode],root,mode)
                    self.assertEqual(observed['version'],'3.51.2');self.assertEqual(observed['sourceId'],SOURCE_ID)
                    self.assertEqual(observed['integrity'],'ok');self.assertEqual(observed['journalMode'],'delete')
                    self.assertEqual(observed['refused'],mode=='rollback');self.assertEqual(len(observed['receipts']),1 if mode=='rollback' else 2)
                    programs=observed['programs'];opcodes=[op for program in programs for op in program]
                    self.assertEqual(sum(op['opcode']=='CreateBtree' for op in opcodes),declared['operations']['createdRoots'])
                    self.assertEqual(sum(op['opcode']=='Insert' for op in opcodes),sum(r['calls'] for r in declared['operations']['normalInsertions'])-1)
                    self.assertFalse(any(op['opcode'] in ('RowCell','Program') for op in opcodes))
                    for row in observed['samples']:
                        self.assertLessEqual(row['pages'],bound['maximumLogicalMainPages']);self.assertLessEqual(row['fileBytes'],bound['maximumLogicalMainBytes'])
                    after=target.read_bytes()
                    if mode=='rollback':self.assertEqual(hashlib.sha256(after).hexdigest(),before)
                    else:
                        old={r[1] for r in observation['rows']};new=[r for r in observed['rows'] if r[1] not in old]
                        descriptors=[{'type':t,'name':n,'table':tb,'sqlSha256':hashlib.sha256(s.encode()).hexdigest() if s else None,'implicit':s is None} for t,n,tb,_,s in new]
                        self.assertEqual(descriptors,profile['objects'])
                        self.assertLessEqual(max(payload_sizes(after,size,1)),profile['maximumSchemaPayloadBytes'])
                        for name,key in [('_schema_migrations','maximumReceiptTablePayloadBytes'),(inventory.RECEIPT_INDEX,'maximumReceiptIndexPayloadBytes')]:
                            page=next(r[3] for r in observed['rows'] if r[1]==name)
                            self.assertLessEqual(max(payload_sizes(after,size,page)),profile[key])
                    self.assertFalse(pathlib.Path(str(target)+'-journal').exists())

    def test_actual_native_normal_overwrites_index_changes_and_deletions_commit_and_rollback(self):
        create=r'''const Database=require('better-sqlite3'),db=new Database(process.argv[1]);db.pragma('page_size='+process.argv[2]);
        db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB); CREATE INDEX payload_value ON payload(value)');
        const put=db.prepare('INSERT INTO payload VALUES(?,?)');db.transaction(()=>{for(let i=1;i<=96;i++)put.run(i,Buffer.alloc(8192,i));})();db.close();'''
        change=r'''const fs=require('node:fs'),Database=require('better-sqlite3'),db=new Database(process.argv[1],{fileMustExist:true}),samples=[];
        db.pragma('cache_size=4');const update=db.prepare('UPDATE payload SET value=? WHERE id=?'),del=db.prepare('DELETE FROM payload WHERE id=?');
        let refused=false;try{db.transaction(()=>{for(let i=1;i<=96;i++){
          update.run(Buffer.alloc(i%3===0?8192:i%3===1?16384:16,97+i),i);
          samples.push({pages:db.pragma('page_count',{simple:true}),fileBytes:fs.statSync(process.argv[1]).size});}
          for(let i=1;i<=48;i++){del.run(i);samples.push({pages:db.pragma('page_count',{simple:true}),fileBytes:fs.statSync(process.argv[1]).size});}
          if(process.argv[2]==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();}
        catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;refused=true;}
        const result={samples,refused,rows:db.prepare('SELECT count(*) n FROM payload').get().n,
          integrity:db.pragma('integrity_check',{simple:true}),sourceId:db.prepare('SELECT sqlite_source_id() v').get().v};
        db.close();process.stdout.write(JSON.stringify(result));'''
        ops={'version':1,'scope':'DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS','callerReviewSha256':'c'*64,
            'createdRoots':0,'normalInsertions':[{'calls':192,'maximumPayloadBytes':16384+200}],'deletions':192}
        for size in (512,4096,65536):
            root=directory();target=root/'dev.db';native(create,[target,size],root,'create')
            raw=target.read_bytes();bound=mutations.mutation_growth_bound(raw[:100],len(raw),ops)
            (root/'conditional-bound.json').write_bytes(canonical(bound));before=hashlib.sha256(raw).hexdigest()
            for mode in ('rollback','commit'):
                result=native(change,[target,mode],root,mode);self.assertEqual(result['sourceId'],SOURCE_ID)
                self.assertEqual(result['integrity'],'ok');self.assertEqual(result['rows'],96 if mode=='rollback' else 48)
                self.assertEqual(result['refused'],mode=='rollback');self.assertEqual(len(result['samples']),144)
                for row in result['samples']:
                    self.assertLessEqual(row['pages'],bound['maximumLogicalMainPages']);self.assertLessEqual(row['fileBytes'],bound['maximumLogicalMainBytes'])
                if mode=='rollback':self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(),before)
                self.assertFalse(pathlib.Path(str(target)+'-journal').exists())
