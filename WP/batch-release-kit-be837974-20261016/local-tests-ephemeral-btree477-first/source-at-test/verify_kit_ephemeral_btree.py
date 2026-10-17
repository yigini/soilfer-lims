"""NEW LOCAL ephemeral fixtures; no Linux VFS or whole-owner scratch proof."""
import copy,json,pathlib,shutil,sqlite3,subprocess,tempfile,unittest
from unittest.mock import patch
import kit_ephemeral_btree as eph
import verify_kit_sorter_scratch as native_sorter
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'ephemeral-btree-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='eph-',dir=FIXTURES)).resolve()

class EphemeralBtree(unittest.TestCase):
    def test_complete_native_pins_new_empty_header_no_journal_and_constant_rhs_source(self):
        proof,digest=eph.source_proof();self.assertEqual(digest,sha((HERE/eph.PROOF).read_bytes()))
        self.assertGreaterEqual(len(proof['files']),55);self.assertEqual(len(proof['nativeExcerpts']),20)
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for r in proof['nativeExcerpts']:self.assertEqual(raw[r['startByte']:r['endByte']].decode(),r['text'])
        parts={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('BTREE_OMIT_JOURNAL | BTREE_SINGLE',parts['fresh_ephemeral_open'])
        self.assertIn('PAGER_JOURNALMODE_OFF',parts['omit_journal_profile'])
        self.assertIn('nSavepoint',parts['subjournal_requires_savepoint'])
        self.assertIn('data[31] = 1',parts['new_database_single_header_page'])
        self.assertIn('sqlite3VdbeAddOp4Int(v, OP_IdxInsert',parts['constant_in_rhs_entries'])
        self.assertIn(eph.STATUS_SQL,proof['orderStatusSql']);self.assertFalse(proof['runtimeBinaryToSourceBindingVerified'])
    def test_all_eight_ephemeral_page_sizes_and_each_native_kind_charge_roots_payload_overflow_and_no_reuse(self):
        for page in eph.PAGE_SIZES:
            for kind in ('ROWID_TABLE','INDEX'):
                for n in (0,1,4,96,1024):
                    inventory=eph.declared_ephemeral(kind,n,9000,'a'*64);v=eph.ephemeral_btree_bound(page,inventory)
                    roots=int(kind=='INDEX');overflow=n*((9000+page-5)//(page-4))
                    self.assertEqual(v['maximumLogicalEphemeralPages'],1+2*(roots+n*107+overflow))
                    self.assertEqual(v['initialHeaderPages'],1);self.assertEqual(v['additionalIndexRoots'],roots)
                    self.assertFalse(v['ephemeralPageSizeDerivedFromMainDatabase']);self.assertTrue(v['newDatabaseHeaderIsSyntheticArithmetic'])
                    self.assertEqual([v['conditionalRollbackJournalFileCreations'],v['conditionalWalFileCreations'],v['conditionalStatementJournalFileCreations']],[0,0,0])
                    self.assertFalse(v['runtimeEphemeralPageSizeVerified']);self.assertFalse(v['wholeSqlStatementScratchInventoryComplete'])
        v=eph.all_ephemeral_page_sizes(eph.declared_ephemeral('INDEX',4,32,'a'*64));self.assertEqual(len(v['bounds']),8)
        self.assertEqual(v['maximumLogicalEphemeralBytes'],max(x['maximumLogicalEphemeralBytes'] for x in v['bounds']))
    def test_named_temp_schema_reuse_savepoints_malformed_or_unsupported_profiles_refuse(self):
        good=eph.declared_ephemeral('INDEX',4,32,'b'*64)
        for key,value in [('version',True),('kind','TEMP_SCHEMA'),('nativeInsertAttempts',True),('nativeInsertAttempts',-1),('maximumFullSerializedPayloadBytes',True),('callerReviewSha256','z'*64),('nativeSavepointCalls',1),('nativeSavepointCalls',False),('autoVacuum',True),('resetClearReuseOrOpenDup',True),('preformattedOrTransferredCells',True),('overwriteDeleteOrReplacement',True),('continuedWritingAfterSqlOrIoError',True),('customPagerOrPcache',True),('namedTempSchemaDatabase',True),('oneFreshHandleAndOneOpen',False),('foreign',1)]:
            v=copy.deepcopy(good);v[key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):eph.ephemeral_btree_bound(4096,v)
        for page in (True,0,513,131072):
            with self.assertRaises(RuntimeError):eph.ephemeral_btree_bound(page,good)
    def test_whole_large_envelope_and_all_page_size_profile_refuse_without_clipping_or_invented_authority(self):
        large=eph.declared_ephemeral('INDEX',1000000,9000,'c'*64)
        with self.assertRaisesRegex(RuntimeError,'never clip'):eph.ephemeral_btree_bound(65536,large)
        with self.assertRaisesRegex(RuntimeError,'never clip'):eph.all_ephemeral_page_sizes(large)
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            v=eph.order_status_rhs_bound(4096);eph.replay_ephemeral_bound(v)
        for key,value in [('maximumRhsNativeIndexInsertAttempts',3),('maximumRhsMaterializations',True),('completeWholeStatementScratchInventory',True),('sorterOrderByAndOtherHandlesBounded',True),('foreign',True)]:
            bad=copy.deepcopy(v);bad[key]=value
            with self.assertRaises(RuntimeError):eph.replay_ephemeral_bound(bad)
        bad=copy.deepcopy(v);bad['bound']['runtimeEphemeralPageSizeVerified']=True
        with self.assertRaises(RuntimeError):eph.replay_ephemeral_bound(bad)
    def test_full_new_source_copy_and_same_length_native_tooling_raw_application_mutations_refuse(self):
        proof,digest=eph.source_proof();root=directory();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/eph.PROOF).write_bytes((HERE/eph.PROOF).read_bytes())
        names=[proof['nativeSource']['path'],(HERE/'kit_ephemeral_btree.py').relative_to(ROOT).as_posix(),(HERE/'readonly-target-wal-source.json').relative_to(ROOT).as_posix()]
        with patch.object(eph,'__file__',str(tooling/'kit_ephemeral_btree.py')):
            eph.source_proof()
            for name in names:
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):eph.source_proof()
                p.write_bytes(raw)
    def test_actual_pinned_raw_order_status_query_constant_rhs_once_native_program(self):
        root=directory();temp=root/'tmp';temp.mkdir();target=root/'dev.db'
        plan=eph.order_status_rhs_bound(4096);(root/'conditional-rhs-plan.json').write_bytes(canonical(plan))
        program=r"""const fs=require('node:fs'),crypto=require('node:crypto'),Database=require('better-sqlite3');const[file,temp,sql]=process.argv.slice(1);let db=new Database(file);db.exec('CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,status TEXT)');const put=db.prepare('INSERT INTO WorkItem VALUES(?,?,?,?)');for(const [n,status]of ['NOT_ASSIGNED','ASSIGNED','IN_PROGRESS','REPEAT_REQUIRED','OTHER'].entries())put.run(String(n),'s','a',status);db.close();const before=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');db=new Database(file,{readonly:true,fileMustExist:true});const program=db.prepare('EXPLAIN '+sql).all(),rows=db.prepare(sql).all(),v={program,rows,version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,platform:process.platform};db.close();v.mainUnchanged=before===crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');process.stdout.write(JSON.stringify(v));"""
        row=native_sorter.run_native(program,[target,temp,eph.STATUS_SQL],root,temp)
        self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertEqual(row['version'],'3.51.2');self.assertTrue(row['mainUnchanged']);self.assertEqual(len(row['rows']),4)
        opens=[r for r in row['program'] if r['opcode']=='OpenEphemeral'];self.assertEqual(len(opens),1)
        self.assertEqual(sum(r['opcode']=='IdxInsert' and r['p1']==opens[0]['p1'] for r in row['program']),4)
        self.assertTrue(any(r['opcode']=='Once' and r['addr']<opens[0]['addr'] for r in row['program']))
        self.assertFalse(plan['completeWholeStatementScratchInventory']);self.assertFalse(plan['sorterOrderByAndOtherHandlesBounded'])
    def test_actual_pinned_readonly_main_table_and_index_materialization_separate_handles_and_optional_originals(self):
        for main_page in (512,4096,65536):
            for kind in ('ROWID_TABLE','INDEX'):
                root=directory();temp=root/'tmp';temp.mkdir();target=root/'dev.db'
                plan=eph.all_ephemeral_page_sizes(eph.declared_ephemeral(kind,1024,9000,'d'*64));(root/'conditional-ephemeral-plan.json').write_bytes(canonical(plan))
                program=r"""const fs=require('node:fs'),crypto=require('node:crypto'),Database=require('better-sqlite3');const[file,temp,page,kind]=process.argv.slice(1);let db=new Database(file);db.pragma('page_size='+page);db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY,v TEXT)');const put=db.prepare('INSERT INTO t VALUES(?,?)');db.transaction(()=>{for(let n=1;n<=1024;n++)put.run(n,'x'.repeat(8192))})();db.close();const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash();db=new Database(file,{readonly:true,fileMustExist:true});db.pragma('temp_store=FILE');let callbacks=0;const samples=[],snapshots=[];db.function('inspect',{},(id,v)=>{callbacks++;if(callbacks===1||callbacks%128===0){for(const name of fs.readdirSync(temp)){try{const p=temp+'/'+name,s=fs.statSync(p);if(s.isFile()){samples.push({name,bytes:s.size});if(callbacks===1&&s.size>=512&&s.size<=32*1024*1024){const raw=fs.readFileSync(p);if(raw.subarray(0,16).equals(Buffer.from('SQLite format 3\0'))){const out=file+'.ephemeral-'+snapshots.length+'.bin';fs.writeFileSync(out,raw,{flag:'wx'});snapshots.push({name,original:out,bytes:raw.length,pageSize:raw.readUInt16BE(16)===1?65536:raw.readUInt16BE(16),headerPages:raw.readUInt32BE(28)})}}}}catch(e){if(!['ENOENT','EACCES','EPERM','EBUSY'].includes(e.code))throw e}}}return id+v.length});const sql=kind==='ROWID_TABLE'?'WITH e AS MATERIALIZED(SELECT id,v FROM t) SELECT inspect(id,v) n FROM e':"SELECT inspect(id,v) n FROM t WHERE (id,v) IN (SELECT id+0,v||'' FROM t)";const program=db.prepare('EXPLAIN '+sql).all(),rows=db.prepare(sql).all(),v={program,rows:rows.length,callbacks,samples,snapshots,requestedMainPageSize:Number(page),kind,version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,platform:process.platform,linuxVfsTested:false,actualNativeFileCallsMeasured:false,continuousPeakMeasured:false,fullLifetimeOriginalsRetained:false,physicalAllocationMeasured:false};db.close();v.mainUnchanged=before===hash();process.stdout.write(JSON.stringify(v));"""
                row=native_sorter.run_native(program,[target,temp,main_page,kind],root,temp)
                self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertEqual(row['rows'],1024);self.assertEqual(row['callbacks'],1024);self.assertTrue(row['mainUnchanged'])
                opens=[r for r in row['program'] if r['opcode']=='OpenEphemeral'];self.assertEqual(len(opens),1)
                self.assertFalse(any(r['opcode'] in ('SorterOpen','OpenAutoindex','OpenDup','Clear') for r in row['program']))
                insert='Insert' if kind=='ROWID_TABLE' else 'IdxInsert';self.assertEqual(sum(r['opcode']==insert and r['p1']==opens[0]['p1'] for r in row['program']),1)
                self.assertFalse(any(r['opcode']==insert and (r['p5']&128) for r in row['program']))
                for sample in row['samples']:self.assertLessEqual(sample['bytes'],plan['maximumLogicalEphemeralBytes'])
                for snapshot in row['snapshots']:
                    actual=pathlib.Path(snapshot['original']).read_bytes();self.assertEqual(len(actual),snapshot['bytes']);self.assertIn(snapshot['pageSize'],eph.PAGE_SIZES)
                    bound=next(v for v in plan['bounds'] if v['ephemeralPageSize']==snapshot['pageSize']);self.assertLessEqual(len(actual),bound['maximumLogicalEphemeralBytes'])
                self.assertFalse(row['linuxVfsTested']);self.assertFalse(row['actualNativeFileCallsMeasured'])