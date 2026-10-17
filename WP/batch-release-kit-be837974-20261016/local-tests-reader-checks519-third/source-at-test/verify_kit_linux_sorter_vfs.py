"""NEW LOCAL Unix-source models and Windows analogs; not Linux VFS execution."""
import copy,json,os,pathlib,shutil,sqlite3,unittest
from unittest.mock import patch
import kit_linux_sorter_vfs as vfs
import kit_sorter_scratch as sorter
import verify_kit_order_revision_native as order_fixture
import verify_kit_sorter_scratch as native_sorter
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'sorter-unix-vfs-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(__import__('tempfile').mkdtemp(prefix='unix-',dir=FIXTURES)).resolve()

class LinuxSorterVfs(unittest.TestCase):
    def test_full_source_pins_fallback_nolock_size_hint_mapping_and_all_length_changers(self):
        proof,digest=vfs.source_proof();self.assertEqual(digest,sha((HERE/vfs.PROOF).read_bytes()))
        self.assertEqual(len(proof['files']),77);self.assertEqual(len(proof['nativeExcerpts']),21)
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        pieces={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('nSize - 1',pieces['manual_and_fallocate_size_hint'])
        self.assertIn('err!=EINVAL',pieces['manual_and_fallocate_size_hint'])
        self.assertIn('SQLITE_OPEN_READONLY',pieces['readonly_fallback_is_excluded'])
        self.assertIn('nolockIoMethods',pieces['temporary_nolock_dispatch'])
        self.assertIn('xShmMap method',pieces['temporary_nolock_methods'])
        self.assertEqual(len(proof['allRobustTruncateOccurrences']),5)
        self.assertTrue(proof['buildMayUsePrebuiltAddon']);self.assertFalse(proof['runtimeDefaultVfsVerified'])
    def test_unix_request_arithmetic_covers_both_chunks_mmap_and_manual_nonpower_block_clamps(self):
        for current in (0,7,4096,4103):
            for amount in (0,1,7,4095,4096,4097,8193):
                for chunk in (0,4096):
                    for mmap in (0,2147418112):
                        request={'kind':'size-hint','bytes':amount,'chunkBytes':chunk,'mmapBytes':mmap}
                        high=vfs.unix_request_high_water(current,request)
                        expected=((amount+chunk-1)//chunk)*chunk if chunk else amount if mmap else current
                        self.assertEqual(high,max(current,expected))
                        if chunk:
                            target=((amount+chunk-1)//chunk)*chunk
                            for block in (1,3,17,511,4096,8192,65537):
                                offsets=vfs.manual_size_hint_offsets(current,target,block)
                                if target>current:
                                    self.assertEqual(offsets[-1],target-1);self.assertTrue(all(current<=x<target for x in offsets))
                                else:self.assertEqual(offsets,[])
        self.assertEqual(vfs.unix_request_high_water(0,{'kind':'size-hint','bytes':7,'chunkBytes':0,'mmapBytes':1}),7)
        self.assertEqual(vfs.unix_request_high_water(0,{'kind':'size-hint','bytes':7,'chunkBytes':4096,'mmapBytes':0}),4096)
        for block in (True,0,-1,(1<<30)+1):
            with self.assertRaises(RuntimeError):vfs.manual_size_hint_offsets(0,4096,block)
        with self.assertRaisesRegex(RuntimeError,'never clip'):vfs.manual_size_hint_offsets(0,100001,1)
    def test_complete_aggregate_partition_rounding_all_page_sizes_and_oversized_native_refusals(self):
        profile=vfs.declared_linux_sorter_profile()
        for page in (512,1024,2048,4096,8192,16384,32768,65536):
            for count in (0,1,96,12000,1000000):
                normal=sorter.sorter_scratch_bound(page,sorter.declared_sorter(count,'a'*64))
                plan=vfs.default_linux_sorter_file_bound(normal,profile)
                self.assertEqual(plan['conditionalMaximumAggregateSorterFileLengthBytes'],normal['declaredLayout']['roundedContentBytes'])
                self.assertEqual(plan['declaredLayoutIncludingFullMetadataAllowances'],normal['declaredLayout'])
                self.assertFalse(plan['freshWritableEmptyTempFileCreationObserved']);self.assertFalse(plan['sorterFileLengthOrVfsPreallocationBounded'])
        for sizes in ([0],[1],[4095],[4096],[1,1],[4095,4097],[3,17,511],[0,7,4096,8193]):
            total=sum(sizes);upper=((total+4095)//4096)*4096+(len(sizes)-1)*4096
            self.assertLessEqual(sum(((n+4095)//4096)*4096 for n in sizes),upper)
        with self.assertRaisesRegex(RuntimeError,'never clip'):sorter.sorter_scratch_bound(512,sorter.declared_sorter(1000000000,'a'*64))
    def test_linux_profile_is_exact_declaration_and_existing_readonly_custom_or_invented_authority_refuses(self):
        native_bound=sorter.sorter_scratch_bound(512,sorter.declared_sorter(96,'b'*64));profile=vfs.declared_linux_sorter_profile()
        for field,value in [('platform','win32'),('platform','darwin'),('vfs','unix-excl'),('initialChunkBytes',4096),('sorterChunkBytes',8192),('temporaryExclusiveReadWriteCreateSucceeds',False),('newTempFilesInitiallyEmpty',False),('readonlyFallbackOrExistingFileReuse',True),('customVfs',True),('customSystemCalls',True),('customFileControls',True),('automaticExtensions',True),('ordinarySyscallSemantics',False),('maximumReportedIoBlockBytes',True),('version',True),('foreign',True)]:
            candidate=copy.deepcopy(profile);candidate[field]=value
            with self.subTest(field=field),self.assertRaises(RuntimeError):vfs.default_linux_sorter_file_bound(native_bound,candidate)
        for field,value in [('maximumAggregateNativeRequestedExtentBytes',1),('runtimeDefaultVfsVerified',True),('foreign',True)]:
            candidate=copy.deepcopy(native_bound);candidate[field]=value
            with self.assertRaises(RuntimeError):vfs.default_linux_sorter_file_bound(candidate,profile)
    def test_actual_new_collector_source_binding_and_full_replay_without_target_sql_and_source_mutation(self):
        root,target,observation,original,_=order_fixture.declared(13)
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            plan=vfs.source_bound_order_linux_sorter_plan(observation,original,target);vfs.recheck_order_linux_sorter(plan)
        self.assertTrue(plan['collectorSourceByteBindingVerified']);self.assertFalse(plan['runtimeDefaultVfsVerified'])
        for fault in ('length','profile','authority','foreign'):
            bad=copy.deepcopy(plan)
            if fault=='length':bad['conditionalUnixBound']['conditionalMaximumAggregateSorterFileLengthBytes']-=1
            elif fault=='profile':bad['conditionalUnixBound']['declaredProfile']['newTempFilesInitiallyEmpty']=False
            elif fault=='authority':bad['freshWritableEmptyTempFileCreationObserved']=True
            else:bad['foreign']=True
            with self.assertRaises(RuntimeError):vfs.recheck_order_linux_sorter(bad)
        copyroot=directory();proof=json.loads((HERE/vfs.PROOF).read_bytes());tooling=copyroot/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=copyroot/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/vfs.PROOF).write_bytes((HERE/vfs.PROOF).read_bytes())
        with patch.object(vfs,'__file__',str(tooling/'kit_linux_sorter_vfs.py')):
            vfs.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_linux_sorter_vfs.py').relative_to(ROOT).as_posix()):
                p=copyroot/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):vfs.source_proof()
                p.write_bytes(raw)
    def test_actual_new_windows_file_seek_write_and_truncate_analogs_preserve_source_length_ceiling(self):
        root=directory();records=[]
        for initial in (0,7,63):
            for requested in (17,4097,8193):
                for block in (3,17,511,8192):
                    path=root/(str(len(records))+'.bin');fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_EXCL,0o600)
                    try:
                        os.ftruncate(fd,initial);target=((requested+4095)//4096)*4096
                        offsets=vfs.manual_size_hint_offsets(initial,target,block)
                        for offset in offsets:os.lseek(fd,offset,os.SEEK_SET);self.assertEqual(os.write(fd,b'\0'),1)
                        after=os.fstat(fd).st_size;self.assertEqual(after,max(initial,target))
                        os.ftruncate(fd,requested);self.assertEqual(os.fstat(fd).st_size,requested)
                        records.append({'initialBytes':initial,'sizeHintBytes':requested,'roundedTargetBytes':target,'reportedBlockBytesStandin':block,'manualWriteOffsets':offsets,'observedBeforeTruncateBytes':after,'observedAfterTruncateBytes':requested})
                    finally:os.close(fd)
        (root/'local-file-length-analogs.json').write_bytes(canonical({'cases':records,'pinnedUnixVfsExecuted':False,'linuxSyscallsExecuted':False,'physicalAllocationMeasured':False,'directoryFsyncTested':False}))
    def test_actual_pinned_windows_sorter_samples_under_prior_declared_unix_envelope_are_not_linux_evidence(self):
        root=directory();temp=root/'tmp';temp.mkdir();target=root/'dev.db'
        native_bound=sorter.sorter_scratch_bound(512,sorter.declared_sorter(90000,'d'*64))
        plan=vfs.default_linux_sorter_file_bound(native_bound,vfs.declared_linux_sorter_profile())
        (root/'conditional-unix-source-plan.json').write_bytes(canonical(plan))
        program=r"""const fs=require('node:fs'),os=require('node:os'),Database=require('better-sqlite3');
        const [file,temp]=process.argv.slice(1),db=new Database(file);db.pragma('page_size=512');db.pragma('cache_size=4');db.pragma('threads=2');db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY,v TEXT)');
        const put=db.prepare('INSERT INTO t VALUES(?,NULL)');db.transaction(()=>{for(let n=1;n<=90000;n++)put.run(n)})();const samples=[];let callbacks=0;
        db.function('sample',{deterministic:true},v=>{callbacks++;if(callbacks%1024===0){for(const name of fs.readdirSync(temp)){try{const s=fs.statSync(temp+'/'+name);if(s.isFile())samples.push({name,bytes:s.size})}catch(e){if(e.code!=='ENOENT')throw e}}}return null});
        const sql='CREATE INDEX scratch_idx ON t(sample(v))',program=db.prepare('EXPLAIN '+sql).all();db.exec(sql);
        const row={program,samples,callbacks,rows:db.prepare('SELECT count(*) n FROM t').get().n,indexRoot:db.prepare("SELECT rootpage FROM sqlite_schema WHERE name='scratch_idx'").get().rootpage,version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,options:db.pragma('compile_options').map(r=>r.compile_options),threads:db.pragma('threads',{simple:true}),nodeTmpdir:os.tmpdir(),platform:process.platform,
        linuxUnixVfsExecuted:false,actualNativeFileCallsMeasured:false,runtimeDefaultVfsVerified:false,physicalAllocationMeasured:false,continuousPeakMeasured:false,fullLifetimeOriginalsRetained:false,directoryAbsenceProvesNoSpill:false};db.close();process.stdout.write(JSON.stringify(row));"""
        row=native_sorter.run_native(program,[target,temp],root,temp)
        self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertEqual(row['version'],'3.51.2');self.assertEqual(row['callbacks'],90000);self.assertEqual(row['rows'],90000);self.assertEqual(row['threads'],2)
        self.assertEqual(pathlib.Path(row['nodeTmpdir']),temp);self.assertFalse(row['linuxUnixVfsExecuted']);self.assertFalse(row['directoryAbsenceProvesNoSpill'])
        lengths=native.payload_sizes(target.read_bytes(),512,row['indexRoot']);self.assertEqual(len(lengths),90000);self.assertLessEqual(max(lengths),32)
        if row['samples']:
            total=sum(max(r['bytes'] for r in row['samples'] if r['name']==name) for name in {r['name'] for r in row['samples']})
            self.assertLessEqual(total,plan['conditionalMaximumAggregateSorterFileLengthBytes'])
