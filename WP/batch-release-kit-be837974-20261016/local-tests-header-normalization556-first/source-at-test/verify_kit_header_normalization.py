"""NEW LOCAL nonempty-header profile arithmetic and native SQL fixtures."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_header_normalization as header
import verify_kit_sorter_scratch as native
import verify_kit_capture_native_inventory as engine
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[1];FIXTURES=HERE/'header-normalization-local-retained-fixtures'
def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='hn-',dir=FIXTURES)).resolve()

class HeaderNormalization(unittest.TestCase):
    def test_full_pins_version_write_old_journal_bitvec_rollover_and_phase_boundary(self):
        proof,digest=header.source_proof();self.assertEqual(digest,sha((HERE/header.PROOF).read_bytes()));raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        parts={}
        for r in proof['nativeExcerpts']:self.assertEqual(raw[r['startByte']:r['endByte']].decode(),r['text']);parts[r['label']]=r['text']
        self.assertIn('sqlite3PagerWrite',parts['set_version_one']);self.assertIn('sqlite3BitvecSet',parts['old_page_record_and_bitvec'])
        self.assertIn('sqlite3PcacheClearSyncFlags',parts['sync_journal_and_clear_flags']);self.assertIn('journalHdrOffset',parts['journal_header_rounding'])
        self.assertIn('syncJournal(pPager, 0)',parts['commit_no_new_journal_header']);self.assertFalse(proof['writerGraphAdmissionImplemented'])
    def test_all_pages_positive_originals_terminations_full_charge_and_sector_neighbours(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for p in header.PAGES:
                for n in (1,2,17,128,129,1024):
                    for end in ('commit','rollback','first-error-close'):
                        plan=header.header_transaction_plan(n,p,header.declaration(end));header.replay_header_transaction(plan)
                        m=min(n,max(1,65536//p));self.assertEqual(plan['maximumOldJournalPageRecords'],m)
                        self.assertEqual(plan['maximumLogicalJournalAndWriteEndBytes'],(2*m+4)*65536+m*(p+8))
                        self.assertEqual(plan['maximumMainLogicalAndWriteEndBytes'],n*p);self.assertEqual(plan['fullMainAndJournalLayout']['fileCount'],2)
                        self.assertFalse(plan['emptyDestination131072FormulaReused']);self.assertFalse(plan['oldRecordCountIsCompleteDirtyWriteOrFrameCount'])
                        for sector in (32,512,4096,65535,65536):
                            actual=min(n,max(1,sector//p));self.assertLessEqual(actual,m)
    def test_independent_adversarial_record_partitions_header_rounding_and_antimagic_tail(self):
        for p in header.PAGES:
            plan=header.header_transaction_plan(128,p,header.declaration('commit'));m=plan['maximumOldJournalPageRecords']
            for sector in (32,512,4096,65535,65536):
                count=min(m,9)
                for mask in range(1<<max(0,count-1)):
                    record_end=0;headers=0;old_pages=set()
                    def new_header():
                        nonlocal record_end,headers
                        record_end=((record_end+sector-1)//sector)*sector
                        chunk=min(p,sector);record_end+=((sector+chunk-1)//chunk)*chunk;headers+=1
                    new_header();new_header() # additionally charge first CACHEMOD-only sync
                    for i in range(count):
                        self.assertNotIn(i+1,old_pages);old_pages.add(i+1);record_end+=p+8
                        if i==count-1 or mask&(1<<i):new_header()
                    tail=((record_end+sector-1)//sector)*sector+1
                    self.assertLessEqual(headers,m+2);self.assertLessEqual(tail,plan['maximumLogicalJournalAndWriteEndBytes'])
                # Most fragmented full-record arrangement, including m=128.
                end=0
                for i in range(m+2):end=((end+sector-1)//sector)*sector+((sector+min(p,sector)-1)//min(p,sector))*min(p,sector)+(p+8 if i<m else 0)
                self.assertLessEqual(((end+sector-1)//sector)*sector+1,plan['maximumLogicalJournalAndWriteEndBytes'])
    def test_every_phase_autovacuum_wal_retry_savepoint_type_and_oversize_refuses(self):
        d=header.declaration('commit')
        for key in header.CONDITIONS:
            with self.subTest(key=key),self.assertRaises(RuntimeError):header.header_transaction_plan(4,512,{**d,key:False})
        for key,val in [('version',True),('nativeVersion','3.49.1'),('termination','retry'),('foreign',True)]:
            with self.assertRaises(RuntimeError):header.header_transaction_plan(4,512,{**d,key:val})
        for n,p in [(0,512),(True,512),(4,True),(4,513),(2147483648,512)]:
            with self.assertRaises(RuntimeError):header.header_transaction_plan(n,p,d)
        for p in header.PAGES:
            with self.assertRaises(RuntimeError):header.header_transaction_plan(header.LIMIT//p,p,d)
            generous=(header.LIMIT-32*1024**2)//p;self.assertLessEqual(header.header_transaction_plan(generous,p,d)['fullMainAndJournalLayout']['roundedContentBytes'],header.LIMIT)
    def test_whole_old_records_headers_main_layout_and_authority_replay(self):
        plan=header.header_transaction_plan(1000,512,header.declaration('rollback'))
        for key in ('maximumOldJournalPageRecords','maximumJournalHeadersConservativelyCharged','maximumLogicalJournalAndWriteEndBytes','maximumMainSizeHintArgumentBytes'):
            b=copy.deepcopy(plan);b[key]-=1
            with self.assertRaises(RuntimeError):header.replay_header_transaction(b)
        for key in ('actualEntryAndPriorCheckpointVerified','writerGraphAdmissionImplemented','mainOrJournalActualFileLengthOrPreallocationBounded','earlierWalCheckpointOrSourceCloseBounded'):
            b=copy.deepcopy(plan);b[key]=True
            with self.assertRaises(RuntimeError):header.replay_header_transaction(b)
        b=copy.deepcopy(plan);b['fullMainAndJournalLayout']['contentBytes']=0
        with self.assertRaises(RuntimeError):header.replay_header_transaction(b)
    def test_new_full_source_copy_same_length_native_module_and_prior_source_review_mutations(self):
        proof,_=header.source_proof();root=directory();tool=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tool/header.PROOF).write_bytes((HERE/header.PROOF).read_bytes())
        with patch.object(header,'__file__',str(tool/'kit_header_normalization.py')):
            header.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_header_normalization.py').relative_to(ROOT).as_posix(),proof['priorTailReviewPath']):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):header.source_proof()
                p.write_bytes(raw)
    def test_actual_pinned_native_full_pragma_header_changes_with_prior_wal_phase_excluded(self):
        for page in (512,4096,65536):
            root=directory();setup=root/'setup';setup.mkdir();run=root/'normalize';run.mkdir();temp=root/'tmp';temp.mkdir();file=root/'dev.db'
            code=r"""const D=require('better-sqlite3'),fs=require('fs');const[file,p]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+p);db.exec('CREATE TABLE data(id INTEGER PRIMARY KEY,value BLOB)');db.transaction(()=>{for(let i=0;i<24;i++)db.prepare('INSERT INTO data VALUES(?,?)').run(i,Buffer.alloc(8192,i));})();const n=db.pragma('page_count',{simple:true});db.pragma('journal_mode=WAL');db.close();process.stdout.write(JSON.stringify({pages:n,page:Number(p),headerVersions:[...fs.readFileSync(file).subarray(18,20)]}));"""
            meta=native.run_native(code,[file,page],setup,temp);plan=header.header_transaction_plan(meta['pages'],page,header.declaration('commit'));(root/'plan-before-normalize.json').write_bytes(canonical(plan)+b'\n')
            code=r"""const D=require('better-sqlite3'),fs=require('fs');const[file,out]=process.argv.slice(1);fs.copyFileSync(file,out+'/before-main-original.bin');const db=new D(file);const program=db.prepare('EXPLAIN PRAGMA journal_mode=MEMORY').all(),mode=db.pragma('journal_mode=MEMORY',{simple:true}),bytes=fs.readFileSync(file);fs.writeFileSync(out+'/after-main-original.bin',bytes);const data=db.prepare('SELECT count(*) n,sum(length(value)) bytes FROM data').get(),integrity=db.pragma('integrity_check',{simple:true}),sourceId=db.prepare('SELECT sqlite_source_id() id').get().id;db.close();process.stdout.write(JSON.stringify({mode,headerVersions:[...bytes.subarray(18,20)],mainBytes:bytes.length,finalBytes:fs.statSync(file).size,data,integrity,sourceId,program,earlierWalCloseOutsideConditionalPlan:true,nativePhaseCallsMeasured:false,fullLifetimeOriginalsRetained:false,physicalFilesystemClosureClaimed:false}));"""
            value=native.run_native(code,[file,run],run,temp)
            self.assertEqual(value['sourceId'],engine.SOURCE_ID);self.assertEqual(meta['headerVersions'],[2,2]);self.assertEqual(value['mode'],'memory');self.assertEqual(value['headerVersions'],[1,1])
            self.assertEqual(value['data'],{'n':24,'bytes':24*8192});self.assertEqual(value['integrity'],'ok');self.assertEqual(value['mainBytes'],meta['pages']*page)
            self.assertEqual(value['finalBytes'],value['mainBytes']);self.assertTrue(value['earlierWalCloseOutsideConditionalPlan']);self.assertFalse(plan['actualEntryAndPriorCheckpointVerified'])
