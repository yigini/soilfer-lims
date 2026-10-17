"""Conditional statement journals: exact source and NEW LOCAL native fixtures."""
import copy
import hashlib
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_statement_journal as statement
import kit_capture_native_inventory as inventory
import kit_capture_copy as capture
import verify_kit_capture_copy as copies
import verify_kit_capture_native_inventory as native_fixtures
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'statement-journal-local-retained-fixtures'
SOURCE_ID='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='stmt-',dir=FIXTURES)).resolve()


def header(size,pages=8):
    value=bytearray(100);value[:16]=b'SQLite format 3\0'
    value[16:18]=(1 if size==65536 else size).to_bytes(2,'big');value[18:20]=b'\1\1'
    value[21:24]=bytes([64,32,32]);value[24:28]=(1).to_bytes(4,'big')
    value[28:32]=pages.to_bytes(4,'big');value[56:60]=(1).to_bytes(4,'big');value[92:96]=value[24:28]
    return bytes(value)


def operations():
    return {'version':1,'scope':'DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS','callerReviewSha256':'c'*64,
        'createdRoots':0,'normalInsertions':[{'calls':96,'maximumPayloadBytes':16384}], 'deletions':96}


def native(program,args,root,label,env=None):
    result=subprocess.run([shutil.which('node'),'-e',program,*map(str,args)],cwd=ROOT/'server',env=env,capture_output=True)
    (root/(label+'.stdout-original.json')).write_bytes(result.stdout)
    (root/(label+'.stderr-original.txt')).write_bytes(result.stderr)
    if result.returncode or result.stderr:raise AssertionError(result.stderr.decode(errors='replace'))
    return json.loads(result.stdout)


class StatementJournals(unittest.TestCase):
    def test_complete_raw_ddl_statement_lists_and_native_bitvec_record_spill_source_are_pinned(self):
        raw=(HERE/statement.PROOF_NAME).read_bytes();proof=json.loads(raw)
        self.assertEqual(statement.source_proof(),sha(raw))
        native_raw=(ROOT/proof['nativeSource']['path']).read_bytes();self.assertEqual(sha(native_raw),proof['nativeSource']['sha256'])
        for row in proof['nativeExcerpts']:
            self.assertEqual(native_raw[row['startByte']:row['endByte']].decode(),row['text'])
        self.assertGreaterEqual(len(proof['nativeExcerpts']),16)
        self.assertIn('osUnlink(zName)',next(x['text'] for x in proof['nativeExcerpts'] if x['label']=='unix_delete_on_close'))
        for label,count in statement.CAPTURE_STATEMENTS.items():
            row=proof['profiles'][label];ddl=subprocess.check_output(['git','show','be837974:'+row['ddlPath']],cwd=ROOT)
            self.assertEqual(sha(ddl),row['ddlSha256']);self.assertEqual(''.join(row['ddlStatements']).rstrip(),ddl.decode().rstrip())
            self.assertEqual(len(row['ddlStatements'])+1,count)
            self.assertEqual(row['receiptStatement'],'INSERT INTO _schema_migrations(id,details) VALUES(?,?)')
            # SQL statement counts bound statement starts, never B-tree writes.
            inv=inventory.capture_native_inventory(label,native_fixtures.schema())
            self.assertNotEqual(count,sum(x['calls'] for x in inv['operations']['normalInsertions']))
        self.assertFalse(proof['writerGraphAdmissionImplemented']);self.assertFalse(proof['sqlScratchSizeBounded'])

    def test_all_eight_page_sizes_count_every_possible_forward_statement_without_reuse_or_buffer_credit(self):
        schema=native_fixtures.schema()
        for label,count in statement.CAPTURE_STATEMENTS.items():
            for size in (512,1024,2048,4096,8192,16384,32768,65536):
                row=statement.capture_statement_journal_bound(label,header(size),8*size,schema)
                pages=row['nativeMutationBound']['maximumLogicalMainPages'];per_statement=pages*(size+4)
                self.assertEqual(row['maximumStatementStarts'],count);self.assertEqual(row['recordBytes'],size+4)
                self.assertEqual(row['maximumCumulativePageRecords'],count*pages)
                self.assertEqual(row['maximumCumulativeLogicalContentBytes'],count*per_statement)
                self.assertEqual(row['maximumSingleFileLogicalContentBytes'],count*per_statement)
                self.assertEqual(row['aggregateAllocationCharges']['fileCount'],count)
                self.assertGreaterEqual(row['aggregateAllocationCharges']['roundedContentBytes'],count*per_statement)
                self.assertEqual(row['memoryBufferCreditBytes'],0);self.assertEqual(row['truncateReuseDeleteRollbackCreditBytes'],0)
                for key in ('callerReviewVerified','collectorBindingImplemented','runtimeBinaryToSourceBindingVerified',
                    'runtimeDefaultVfsVerified','writerGraphAdmissionImplemented','statementJournalFileLengthOrVfsBounded',
                    'sqlScratchSizeBounded','walGrowthBounded','fullLifetimeOriginalsRetained','continuousPeakMeasured',
                    'physicalFilesystemClosureClaimed'):self.assertIs(row[key],False)

    def test_boolean_foreign_overlapping_savepoint_error_continuation_and_receipt_hazards_refuse(self):
        valid=statement.declared_statements(3)
        for key,item in [('version',True),('maximumStatementStarts',True),('maximumStatementStarts',0),
            ('maximumStatementStarts',-1),('maximumSimultaneousStatementSavepoints',True),
            ('maximumSimultaneousStatementSavepoints',2),('explicitSavepoints',True),
            ('continuedWritingAfterRollbackOrSqlError',True),('sourceVerified',True),('scope','SQL_NATIVE_INSERTS')]:
            row=dict(valid);row[key]=item
            with self.subTest(key=key,item=item),self.assertRaises(RuntimeError):
                statement.statement_journal_bound(header(4096),8*4096,operations(),row)
        schema=native_fixtures.schema();schema['rows'].append(['trigger','extra','_schema_migrations',0,
            'CREATE TRIGGER extra AFTER INSERT ON _schema_migrations BEGIN DELETE FROM WorkAttempt; END'])
        with self.assertRaises(RuntimeError):statement.capture_statement_journal_bound('capture-206-prepare',header(4096),8*4096,schema)
        with self.assertRaises(RuntimeError):statement.capture_statement_journal_bound('release-206',header(4096),8*4096,native_fixtures.schema())

    def test_oversized_complete_plans_refuse_and_actual_source_bound_collector_uses_no_target_sql(self):
        with self.assertRaisesRegex(RuntimeError,'never clip'):
            statement.statement_journal_bound(header(65536),8*65536,operations(),statement.declared_statements(1000000))
        with copies.fixture() as current:
            copies.snapshot(current);current.budget.begin('capture-clone',10**12)
            capture.capture_clone(current.root,current.index,current.review,current.disk)
            target=current.root/'scientific-database/dev.db';observation=json.loads((current.root/'capture-schema-initial.json').read_bytes())
            before=target.read_bytes()
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained target SQL')):
                row=statement.source_bound_statement_journal_plan('capture-206-prepare',observation,target)
            self.assertEqual(target.read_bytes(),before);self.assertTrue(row['collectorSourceByteBindingVerified'])
            self.assertFalse(row['independentSchemaToPrivateDbBytesProof']);self.assertFalse(row['writerGraphAdmissionImplemented'])
            with sqlite3.connect(target) as db:db.execute("UPDATE t0 SET value='LOCAL MUTATION'")
            with self.assertRaises(RuntimeError):statement.source_bound_statement_journal_plan('capture-206-prepare',observation,target)

    def test_real_new_source_copy_refuses_same_length_native_mutation_without_old_private_reads(self):
        root=directory();tooling=root/'WP'/HERE.name;tooling.mkdir(parents=True)
        raw=(HERE/statement.PROOF_NAME).read_bytes();proof=json.loads(raw)
        for name in proof['files']:
            target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
        (tooling/statement.PROOF_NAME).write_bytes(raw)
        with patch.object(statement,'__file__',str(tooling/'kit_statement_journal.py')):
            self.assertEqual(statement.source_proof(),sha(raw))
            target=root/proof['nativeSource']['path'];value=target.read_bytes();replacement=value.replace(b'usesStmtJournal',b'usesStmtJournaX',1)
            self.assertEqual(len(replacement),len(value));self.assertNotEqual(replacement,value);target.write_bytes(replacement)
            with self.assertRaisesRegex(RuntimeError,'source changed'):statement.source_proof()

    def test_actual_pinned_native_ddl_and_receipt_statement_programs_commit_and_rollback(self):
        proof=json.loads((HERE/statement.PROOF_NAME).read_bytes())
        program=r"""const fs=require('node:fs'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const input=JSON.parse(fs.readFileSync(process.argv[1])),rows=[];
        const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        for(const page of [512,4096,65536])for(const mode of ['rollback','commit']){
          const file=process.argv[2]+'/'+page+'-'+mode+'.db',db=new Database(file);db.pragma('page_size='+page);
          db.exec(input.receiptSql+'; CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY)');
          db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run('old','retained');
          const initial=fs.readFileSync(file),before=hash(file),schema=db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema').raw().all();
          const programs=[];let rolled=false;
          try{db.transaction(()=>{for(const sql of input.statements){programs.push(db.prepare('EXPLAIN '+sql).all());db.exec(sql);}
            const sql=input.receiptStatement;programs.push(db.prepare('EXPLAIN '+sql).all(input.marker,input.details));
            db.prepare(sql).run(input.marker,input.details);if(mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();}
          catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;rolled=true;}
          rows.push({page,mode,programs,initialHeaderHex:initial.subarray(0,100).toString('hex'),initialBytes:initial.length,
            beforeHash:before,afterHash:hash(file),schema,rolled,receipts:db.prepare('SELECT count(*) n FROM _schema_migrations').get().n,
            version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,
            platform:process.platform,applicationInstallersExecuted:false,continuousPeakMeasured:false,linuxVfsTested:false});db.close();
        }process.stdout.write(JSON.stringify(rows));"""
        for label,profile in proof['profiles'].items():
            root=directory();input_file=root/'input.json'
            details={'sources':{'migrationSha256':profile['ddlSha256'],'contractVersion':profile['receiptMarker'][:3]+'-v1'},
                'originalRowsSha256':'a'*64,'originalRowsPreserved':True,'backfilledCount':0,'receiptSha256':'b'*64}
            input_file.write_bytes(canonical({'receiptSql':inventory.RECEIPT_SQL,'statements':profile['ddlStatements'],
                'receiptStatement':profile['receiptStatement'],'marker':profile['receiptMarker'],'details':json.dumps(details,separators=(',',':'))}))
            (root/'program.cjs.txt').write_text(program,encoding='utf8')
            rows=native(program,[input_file,root],root,'ddl');self.assertEqual(len(rows),6)
            for row in rows:
                self.assertEqual(row['version'],'3.51.2');self.assertEqual(row['sourceId'],SOURCE_ID)
                self.assertEqual(len(row['programs']),statement.CAPTURE_STATEMENTS[label])
                self.assertTrue(all(any(op['opcode']=='Transaction' and op['p2']>0 for op in p) for p in row['programs']))
                # Transaction P5 checks the schema cookie; it is NOT a journal flag.
                # No zero-journal conclusion is taken from bytecode/comments.
                declaration={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':row['schema']}
                planned=statement.capture_statement_journal_bound(label,bytes.fromhex(row['initialHeaderHex']),row['initialBytes'],declaration)
                (root/(str(row['page'])+'-'+row['mode']+'-conditional-plan.json')).write_bytes(canonical(planned))
                self.assertEqual(row['receipts'],1 if row['mode']=='rollback' else 2)
                if row['mode']=='rollback':self.assertEqual(row['beforeHash'],row['afterHash'])

    def test_actual_pinned_native_forward_update_spills_statement_journal_and_restores_rollback(self):
        setup=r"""const Database=require('better-sqlite3'),db=new Database(process.argv[1]);db.pragma('page_size='+process.argv[2]);
        db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB NOT NULL CHECK(length(value)>0))');const put=db.prepare('INSERT INTO payload VALUES(?,?)');
        db.transaction(()=>{for(let i=1;i<=96;i++)put.run(i,Buffer.alloc(8192,i));})();db.close();process.stdout.write('{}');"""
        program=r"""const fs=require('node:fs'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const db=new Database(process.argv[1],{fileMustExist:true}),mode=process.argv[2],temp=process.argv[3],samples=[];
        // TEST-ONLY CHECK-constrained table, small cache and sampling UDF; no real scientific owner.
        db.pragma('cache_size=4');db.function('sample',{deterministic:true},value=>{
          for(const name of fs.readdirSync(temp)){const p=temp+'/'+name;try{const s=fs.statSync(p);if(s.isFile())samples.push({name,bytes:s.size});}catch(e){if(e.code!=='ENOENT')throw e;}}
          const next=Buffer.from(value);next[0]^=1;return next;
        });
        const sql='UPDATE payload SET value=sample(value)',program=db.prepare('EXPLAIN '+sql).all();let rolled=false;
        try{db.transaction(()=>{db.prepare(sql).run();if(mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();}
        catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;rolled=true;}
        const result={program,samples,rolled,rows:db.prepare('SELECT count(*) n FROM payload').get().n,
          integrity:db.pragma('integrity_check',{simple:true}),version:db.prepare('SELECT sqlite_version() v').get().v,
          sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,platform:process.platform,
          linuxVfsTested:false,applicationInstallersExecuted:false,continuousPeakMeasured:false,fullLifetimeOriginalsRetained:false};
        db.close();process.stdout.write(JSON.stringify(result));"""
        for size in (512,4096,65536):
            for mode in ('rollback','commit'):
                root=directory();target=root/'dev.db';temp=root/'tmp';temp.mkdir()
                native(setup,[target,size],root,'setup');raw=target.read_bytes();before=sha(raw)
                plan=statement.statement_journal_bound(raw[:100],len(raw),operations(),statement.declared_statements(1))
                (root/'conditional-plan.json').write_bytes(canonical(plan));(root/'program.cjs.txt').write_text(program,encoding='utf8')
                env=dict(os.environ,TMP=str(temp),TEMP=str(temp),SQLITE_TMPDIR=str(temp));row=native(program,[target,mode,temp],root,'update',env)
                self.assertEqual(row['version'],'3.51.2');self.assertEqual(row['sourceId'],SOURCE_ID);self.assertEqual(row['integrity'],'ok')
                self.assertEqual(row['rows'],96);self.assertFalse(any(op['opcode'] in ('SorterOpen','OpenEphemeral') for op in row['program']))
                self.assertTrue(row['samples'],'No actual LOCAL temporary-file sample observed')
                self.assertGreater(max(x['bytes'] for x in row['samples']),65536)
                self.assertTrue(all(x['bytes']%(size+4)==0 for x in row['samples']))
                self.assertLessEqual(sum(max(x['bytes'] for x in row['samples'] if x['name']==name) for name in {x['name'] for x in row['samples']}),
                    plan['maximumCumulativeLogicalContentBytes'])
                if mode=='rollback':self.assertEqual(sha(target.read_bytes()),before)


if __name__=='__main__':unittest.main()
