"""NEW LOCAL normal-sorter records; no Linux/runtime/admission authority."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_general_sorter as general
import kit_record_payload as record
import kit_sorter_scratch as strict
import retained_files as retained
import verify_kit_record_payload as fixture
import verify_kit_sorter_scratch as native_run
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'general-sorter-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='gen-',dir=FIXTURES)).resolve()


def partition_lengths(lengths,threshold,separate):
    """Independent model of the two native pre-insert flush predicates."""
    groups=[];group=[];used=0
    for key in lengths:
        need=key+16
        flush=(used>threshold) if separate else (bool(group) and used+need>threshold)
        if flush:groups.append(group);group=[];used=0
        group.append(key);used+=(key+9 if separate else (need+7)//8*8)
    if group:groups.append(group)
    return groups


class GeneralSorter(unittest.TestCase):
    def test_complete_pinned_native_large_record_flush_and_merge_sources(self):
        proof,digest=general.source_proof();self.assertEqual(digest,sha((HERE/general.PROOF).read_bytes()))
        self.assertGreaterEqual(len(proof['files']),62);self.assertGreaterEqual(len(proof['nativeExcerpts']),28)
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        texts={row['label']:row['text'] for row in proof['nativeExcerpts']}
        self.assertIn('nReq = pVal->n + sizeof(SorterRecord)',texts['sorter_record_size_and_flush'])
        self.assertIn('nMin',texts['sorter_memory_round_and_copy']);self.assertIn('mxKeysize+9',texts['incremental_merger_reservation'])
        self.assertFalse(proof['runtimeSorterConfigurationVerified']);self.assertFalse(proof['writerGraphAdmissionImplemented'])
    def test_all_page_sizes_full_serialized_records_headers_and_oversized_single_keys(self):
        for page in general.PAGES:
            for key in (1,32,12772,1048576,general.MAX_KEY_BYTES):
                for count in (0,1,17,96):
                    row=general.sorter_bound(page,general.declared_sorter(count,key,'a'*64))
                    self.assertEqual(row['maximumStoredKeyAndLengthBytes'],key+9)
                    self.assertGreaterEqual(row['minimumRecordsInEveryNonfinalPma'],1)
                    self.assertEqual(row['maximumInitialPmaBytesIncludingHeaders'],count*(key+9)+9*row['maximumInitialPmas'])
                    self.assertEqual(row['maximumAggregateNativeRequestedExtentBytes'],row['maximumInitialPmaBytesIncludingHeaders']+row['maximumSharedMergeReservationsBytes']+row['maximumThreadPairReservationsBytes'])
                    self.assertLessEqual(row['maximumTemporaryFileCreations'],64)
                    self.assertFalse(row['completeCallerRecordCountAndHandleInventoryVerified'])
            single=general.sorter_bound(page,general.declared_sorter(1,general.MAX_KEY_BYTES,'a'*64))
            self.assertEqual(single['minimumRecordsInEveryNonfinalPma'],1)
        with self.assertRaisesRegex(RuntimeError,'never clip'):general.sorter_bound(512,general.declared_sorter(512,general.MAX_KEY_BYTES,'a'*64))
        with self.assertRaises(RuntimeError):strict.sorter_scratch_bound(512,{**strict.declared_sorter(1,'a'*64),'maximumSerializedKeyBytes':12772})
    def test_both_native_allocation_flush_modes_independent_adversarial_partitions(self):
        for page in general.PAGES:
            for key in (1,32,12772,1048576,general.MAX_KEY_BYTES):
                lengths=[key if i%3 else max(1,key//3) for i in range(96)]
                row=general.sorter_bound(page,general.declared_sorter(len(lengths),key,'b'*64))
                for separate in (False,True):
                    groups=partition_lengths(lengths,page*250,separate)
                    self.assertLessEqual(len(groups),row['maximumInitialPmas'])
                    self.assertTrue(all(len(group)>=row['minimumRecordsInEveryNonfinalPma'] for group in groups[:-1]))
                    # Every actual stored key plus length and every PMA header.
                    actual=sum(sum(n+9 for n in group)+9 for group in groups)
                    self.assertLessEqual(actual,row['maximumInitialPmaBytesIncludingHeaders'])
        for distribution in ([17],[257],[512],[1]*16,[17]*16,[257,1,16,256]):
            page=512;key=12772;minimum=max(1,250*page//((key+23)//8*8))
            row=general.sorter_bound(page,general.declared_sorter(sum(distribution)*minimum,key,'b'*64))
            nodes=len(distribution)+1
            for runs in distribution:
                factor=16
                while factor<runs:nodes+=(runs+factor-1)//factor;factor*=16
            self.assertGreaterEqual(row['maximumIncrementalMergerObjects'],nodes)
        with self.assertRaisesRegex(RuntimeError,'never clip'):general.sorter_bound(512,general.declared_sorter(1024*10,12772,'b'*64))
    def test_strict_boolean_foreign_nondefault_rewind_error_and_complete_page_envelopes(self):
        good=general.declared_sorter(96,12772,'c'*64)
        faults={'maximumSorterWriteRecords':True,'maximumFullSerializedKeyBytes':True,'callerReviewSha256':'Z'*64,
            'oneInitAndOneRewind':1,'resetReuseOrRepeatedRewind':True,'continuedWritingAfterSqlOrIoError':True,
            'defaultPmaPages':249,'maximumSorterRecordHeaderBytes':32,'customSorterOrGlobalPmaOverride':True,
            'ordinaryUnmodifiedSorterFiles':False,'version':True,'foreign':True}
        for key,value in faults.items():
            bad=copy.deepcopy(good);bad[key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):general.sorter_bound(512,bad)
        for value in (-1,0,general.MAX_KEY_BYTES+1,2147483647):
            with self.assertRaises(RuntimeError):general.sorter_bound(512,general.declared_sorter(1,value,'c'*64))
        all_sizes=general.all_page_sizes(good);self.assertEqual([x['pageSize'] for x in all_sizes['bounds']],list(general.PAGES))
        # The 65536-byte case fits, but the COMPLETE all-page plan refuses
        # because the 512-byte case has too many PMAs. Never select only fits.
        big=general.declared_sorter(10240,12772,'c'*64);general.sorter_bound(65536,big)
        with self.assertRaisesRegex(RuntimeError,'never clip'):general.all_page_sizes(big)
    def test_actual_new_collector_source_bound_replay_has_no_count_mapping_or_sql_authority(self):
        root,source,db,backup,state,observation,profile,target=fixture.fixture()
        try:
            projection=record.declared_projection('mixed',['i','r','s','b'],[8])
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                input_plan=record.source_bound_record_plan(profile,observation,canonical(state)+b'\n',target,projection)
                inv=general.declared_sorter(4,input_plan['bound']['maximumFullSerializedRecordBytes'],'d'*64)
                plan=general.source_bound_sorter(input_plan,inv);general.replay_sorter(plan)
            self.assertTrue(plan['collectorSourceByteBindingVerified']);self.assertFalse(plan['completeCallerRecordCountAndHandleInventoryVerified'])
            self.assertFalse(plan['independentProfileToPrivateDbBytesProof'])
            for field,value in [('writerGraphAdmissionImplemented',True),('independentProfileToPrivateDbBytesProof',True),('foreign',0)]:
                bad=copy.deepcopy(plan);bad[field]=value
                with self.assertRaises(RuntimeError):general.replay_sorter(bad)
            bad=copy.deepcopy(plan);bad['sorterDeclaration']['maximumSorterWriteRecords']=5
            with self.assertRaises(RuntimeError):general.replay_sorter(bad)
            # A separately recomputed declaration may have a different count;
            # it still proves NO complete caller mapping or dynamic call count.
            other=general.source_bound_sorter(input_plan,{**inv,'maximumSorterWriteRecords':5})
            self.assertFalse(other['completeCallerRecordCountAndHandleInventoryVerified'])
            with self.assertRaisesRegex(RuntimeError,'never clip'):general.source_bound_sorter(input_plan,{**inv,'maximumFullSerializedKeyBytes':32})
            raw=target.read_bytes();target.rename(root/'retained-original-main.db');target.write_bytes(raw)
            with self.assertRaises(RuntimeError):general.replay_sorter(plan)
        finally:db.close()
    def test_new_complete_source_copy_same_length_native_tooling_and_record_source_mutation(self):
        proof,digest=general.source_proof();root=directory();tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,path)
        (tooling/general.PROOF).write_bytes((HERE/general.PROOF).read_bytes())
        with patch.object(general,'__file__',str(tooling/'kit_general_sorter.py')):
            general.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_general_sorter.py').relative_to(ROOT).as_posix(),(HERE/'kit_record_payload.py').relative_to(ROOT).as_posix()):
                path=root/name;raw=path.read_bytes();path.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):general.source_proof()
                path.write_bytes(raw)
    def test_actual_pinned_native_large_copied_field_index_sorters_under_pre_writer_bounds(self):
        for page,threads in ((512,0),(4096,2),(65536,0)):
            root=directory();temp=root/'tmp';temp.mkdir();source=root/'source.db'
            setup=root/'setup';setup.mkdir();run=root/'index';run.mkdir()
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.exec('CREATE TABLE mixed(id INTEGER PRIMARY KEY,i BLOB,r BLOB,s BLOB,b BLOB)');const put=db.prepare('INSERT INTO mixed VALUES(?,?,?,?,?)');db.transaction(()=>{for(let n=1;n<=256;n++)put.run(n,n%2?9223372036854775807n:-9223372036854775808n,n%3?Infinity:1.25,'a\0'+'\u00e9\u4e2d\ud83d\ude42'.repeat(500),Buffer.alloc(8192,n))})();const row={rows:256,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,page:Number(page)};db.close();process.stdout.write(JSON.stringify(row));"""
            initial=native_run.run_native(program,[source,page],setup,temp);self.assertEqual(initial['sourceId'],native.SOURCE_ID)
            backup,state=retained.seal(root,'capture-prepared-214',source,lambda:None,schema_original='capture-schema-214.json')
            observation=json.loads((root/'capture-schema-214.json').read_bytes());profile=fixture.collect(root,state,observation)
            projection=record.declared_projection('mixed',['i','r','s','b'],[8])
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                input_plan=record.source_bound_record_plan(profile,observation,canonical(state)+b'\n',source,projection)
                inv=general.declared_sorter(256,input_plan['bound']['maximumFullSerializedRecordBytes'],'e'*64)
                plan=general.source_bound_sorter(input_plan,inv)
            (root/'general-sorter-plan-before-index.json').write_bytes(canonical(plan)+b'\n')
            writer=r"""const D=require('better-sqlite3');const[file,threads]=process.argv.slice(1),db=new D(file);db.pragma('temp_store=FILE');db.pragma('cache_size=4');db.pragma('threads='+threads);const sql='CREATE INDEX large_idx ON mixed(i,r,s,b)',program=db.prepare('EXPLAIN '+sql).all();db.exec(sql);const row={program,rows:db.prepare('SELECT count(*) n FROM mixed').get().n,indexRoot:db.prepare("SELECT rootpage FROM sqlite_schema WHERE name='large_idx'").get().rootpage,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,version:db.prepare('SELECT sqlite_version() v').get().v,threads:db.pragma('threads',{simple:true}),platform:process.platform,linuxVfsTested:false,actualNativeFileCallsMeasured:false,continuousPeakMeasured:false,physicalAllocationMeasured:false};db.close();process.stdout.write(JSON.stringify(row));"""
            row=native_run.run_native(writer,[source,threads],run,temp);self.assertEqual(row['sourceId'],native.SOURCE_ID)
            self.assertEqual(row['rows'],256);self.assertEqual(row['threads'],threads)
            self.assertEqual(sum(x['opcode']=='SorterOpen' for x in row['program']),1)
            self.assertEqual(sum(x['opcode']=='SorterInsert' for x in row['program']),1)
            lengths=native.payload_sizes(source.read_bytes(),page,row['indexRoot']);self.assertEqual(len(lengths),256)
            self.assertGreater(max(lengths),32);self.assertLessEqual(max(lengths),inv['maximumFullSerializedKeyBytes'])
            self.assertFalse(plan['completeNativeRecordMappingVerified']);self.assertFalse(plan['writerGraphAdmissionImplemented'])
            with self.assertRaises(RuntimeError):general.replay_sorter(plan)
