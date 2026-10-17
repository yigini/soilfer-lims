"""NEW LOCAL sorter fixtures; runtime Linux and physical allocation unproved."""
import copy,json,os,pathlib,shutil,sqlite3,subprocess,tempfile,unittest
from unittest.mock import patch
import kit_sorter_scratch as sorter
import verify_kit_order_revision_native as order_fixture
import verify_kit_capture_native_inventory as native
from kit_contract import canonical,sha
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'sorter-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='sort-',dir=FIXTURES)).resolve()

def run_native(program,args,root,temp):
    env=dict(os.environ,TMP=str(temp),TEMP=str(temp),SQLITE_TMPDIR=str(temp),TMPDIR=str(temp))
    argv=[shutil.which('node'),'-e',program,*map(str,args)]
    (root/'program-original.cjs.txt').write_text(program,encoding='utf8')
    (root/'argv-original.json').write_bytes(canonical(argv))
    result=subprocess.run(argv,cwd=ROOT/'server',env=env,capture_output=True)
    (root/'stdout-original.json').write_bytes(result.stdout);(root/'stderr-original.txt').write_bytes(result.stderr)
    (root/'exit-original.json').write_bytes(canonical({'exitCode':result.returncode}))
    if result.returncode or result.stderr:raise AssertionError(result.stderr.decode(errors='replace'))
    return json.loads(result.stdout)

def varint(raw,at):
    value=0
    for n in range(9):
        b=raw[at];at+=1
        if n==8:return (value<<8)|b,at
        value=(value<<7)|(b&127)
        if b<128:return value,at
    raise AssertionError('Unreachable')

def complete_pma_payloads(raw):
    at=0;keys=[];runs=0;trailing_zero_bytes=0
    while at<len(raw):
        if raw[at]==0:
            if any(raw[at:]):raise AssertionError('Nonzero bytes after zero PMA header')
            trailing_zero_bytes=len(raw)-at;break
        size,at=varint(raw,at);end=at+size
        if end>len(raw):raise AssertionError('Incomplete captured PMA')
        while at<end:
            n,at=varint(raw,at);keys.append(n);at+=n
            if at>end:raise AssertionError('PMA record exceeds complete run')
        runs+=1
    return runs,keys,trailing_zero_bytes

class SorterScratch(unittest.TestCase):
    def test_complete_native_sorter_default_configuration_record_and_merge_sources_pinned(self):
        proof,digest=sorter.source_proof();self.assertEqual(digest,sha((HERE/sorter.PROOF).read_bytes()))
        self.assertEqual(len(proof['files']),43);self.assertGreaterEqual(len(proof['nativeExcerpts']),20)
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        parts={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('SQLITE_FCNTL_CHUNK_SIZE',parts['sorter_extend_requests'])
        self.assertIn('SQLITE_FCNTL_SIZE_HINT',parts['sorter_extend_requests'])
        self.assertIn('aFile[1]',parts['incremental_file_allocation'])
        self.assertIn('SQLITE_CONFIG_PMASZ',parts['global_pma_override'])
        self.assertFalse(proof['runtimeSorterConfigurationVerified']);self.assertFalse(proof['sorterFileLengthOrVfsPreallocationBounded'])
    def test_all_page_sizes_full_record_counts_initial_headers_merge_reservations_and_no_credits(self):
        for size in (512,1024,2048,4096,8192,16384,32768,65536):
            minimum=250*size//48
            for n in (0,1,96,minimum,minimum+1,minimum*16,minimum*16+1,1000000):
                row=sorter.sorter_scratch_bound(size,sorter.declared_sorter(n,'a'*64))
                self.assertEqual(row['maximumInitialPmas'],(n+minimum-1)//minimum)
                self.assertEqual(row['maximumInitialPmaBytesIncludingHeaders'],n*33+row['maximumInitialPmas']*9)
                self.assertEqual(row['maximumAggregateNativeRequestedExtentBytes'],row['maximumInitialPmaBytesIncludingHeaders']+row['maximumSharedMergeReservationsBytes']+row['maximumThreadPairReservationsBytes'])
                self.assertEqual(row['maximumCumulativeNativeWriteBytes'],33*n*(row['maximumPerTaskMergeDepth']+3)+9*row['maximumInitialPmas'])
                self.assertLessEqual(row['maximumTemporaryFileCreations'],64)
                self.assertEqual(row['maximumIncrementalRegionBytes'],268435456)
                self.assertFalse(row['sorterFileLengthOrVfsPreallocationBounded']);self.assertFalse(row['physicalFilesystemClosureClaimed'])
        with self.assertRaisesRegex(RuntimeError,'never clip'):sorter.sorter_scratch_bound(512,sorter.declared_sorter(1000000000,'a'*64))
    def test_native_merge_tree_partitions_and_threaded_file_pairs_are_all_charged(self):
        for distribution in ([17],[257],[512],[1]*16,[17]*16,[257,1,16,256],[33,17,2,1,100]):
            runs=sum(distribution);size=512;n=runs*(250*size//48)
            row=sorter.sorter_scratch_bound(size,sorter.declared_sorter(n,'b'*64))
            actual=0
            for r in distribution:
                div=16
                while div<r:actual+=(r+div-1)//div;div*=16
            # Every nonempty task wrapper plus final threaded root, even if
            # the actual single-thread configuration needs no such wrapper.
            actual+=len(distribution)+1
            self.assertGreaterEqual(row['maximumIncrementalMergerObjects'],actual)
            self.assertGreaterEqual(row['maximumTemporaryFileCreations'],2*len(distribution)+2*min(16,len(distribution)+1))
        with self.assertRaisesRegex(RuntimeError,'never clip'):sorter.sorter_scratch_bound(512,sorter.declared_sorter(1024*(250*512//48),'b'*64))
        self.assertEqual(complete_pma_payloads(b'\x04\x03abc'+b'\0'*4091),(1,[3],4091))
        with self.assertRaises(AssertionError):complete_pma_payloads(b'\x04\x03abc\x01')
    def test_foreign_boolean_nondefault_configuration_rewind_and_wrong_owner_profiles_refuse(self):
        good=sorter.declared_sorter(3,'c'*64)
        for key,value in [('maximumSorterWriteRecords',True),('maximumSorterWriteRecords',-1),('maximumSerializedKeyBytes',33),('defaultPmaPages',0),('defaultPmaPages',True),('maximumSorterRecordHeaderBytes',32),('oneInitAndOneRewind',1),('resetReuseOrRepeatedRewind',True),('customSorterOrGlobalPmaOverride',True),('continuedWritingAfterSqlError',True),('ordinaryUnmodifiedSorterFiles',False),('callerReviewSha256','Z'*64),('version',True),('foreign',True)]:
            v=copy.deepcopy(good);v[key]=value
            with self.subTest(key=key,value=value),self.assertRaises(RuntimeError):sorter.sorter_scratch_bound(4096,v)
        for size in (True,0,511,4095,131072):
            with self.assertRaises(RuntimeError):sorter.sorter_scratch_bound(size,good)
        _,_,observation,_,state=order_fixture.declared(9)
        inv=sorter.order_sorter_inventory('209-apply',observation['schema'],state)
        self.assertEqual(inv['sorter']['maximumSorterWriteRecords'],9)
        for label in ('209-dry','209-repeat','COMPLETE_209',True):
            with self.assertRaises(RuntimeError):sorter.order_sorter_inventory(label,observation['schema'],state)
    def test_real_source_bound_count_descriptor_only_replay_and_same_length_source_mutations(self):
        root,target,observation,original,state=order_fixture.declared(11)
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            plan=sorter.schema_bound_order_sorter_plan(observation,original,target);sorter.recheck_order_sorter(plan)
        self.assertEqual(plan['sorterInventory']['declaredOrderLineRows'],11);self.assertTrue(plan['collectorSourceByteBindingVerified'])
        for fault in ('count','authority','extent','foreign'):
            row=copy.deepcopy(plan)
            if fault=='count':row['sorterInventory']['sorter']['maximumSorterWriteRecords']=12
            elif fault=='authority':row['runtimeSorterConfigurationVerified']=True
            elif fault=='extent':row['bound']['maximumAggregateNativeRequestedExtentBytes']-=1
            else:row['foreign']=True
            with self.assertRaises(RuntimeError):sorter.recheck_order_sorter(row)
        copyroot=directory();proof=json.loads((HERE/sorter.PROOF).read_bytes());tooling=copyroot/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=copyroot/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/sorter.PROOF).write_bytes((HERE/sorter.PROOF).read_bytes())
        with patch.object(sorter,'__file__',str(tooling/'kit_sorter_scratch.py')):
            sorter.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_sorter_scratch.py').relative_to(ROOT).as_posix()):
                p=copyroot/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):sorter.source_proof()
                p.write_bytes(raw)
    def test_actual_exact_native_alter_populated_index_pair_twelve_thousand_keys_commit_and_rollback(self):
        proof,_=sorter.source_proof();order_proof,_=order_fixture.order.source_proof()
        program=r"""const fs=require('node:fs'),Database=require('better-sqlite3'),crypto=require('node:crypto');
        const [file,size,mode,input]=process.argv.slice(1),sql=JSON.parse(fs.readFileSync(input)),db=new Database(file);
        db.pragma('page_size='+size);db.pragma('cache_size=4');db.exec('CREATE TABLE OrderLine(id INTEGER PRIMARY KEY,status TEXT)');
        const put=db.prepare('INSERT INTO OrderLine VALUES(?,?)');db.transaction(()=>{for(let n=1;n<=12000;n++)put.run(n,'ACTIVE')})();
        const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(),programs=[];
        let rolled=false;try{db.transaction(()=>{for(const s of sql){programs.push(db.prepare('EXPLAIN '+s).all());db.exec(s)}if(mode==='rollback')throw Error('LOCAL_ROLLBACK')}).immediate()}catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;rolled=true}
        const index=db.prepare("SELECT rootpage FROM sqlite_schema WHERE name='OrderLine_workItemId_idx'").get();
        const row={page:Number(size),mode,rows:db.prepare('SELECT count(*) n FROM OrderLine').get().n,programs,indexRoot:index?index.rootpage:null,rolled,before,after:hash(),nullLinks:rolled?null:db.prepare('SELECT count(*) n FROM OrderLine WHERE workItemId IS NULL').get().n,
        version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,platform:process.platform,linuxVfsTested:false,actualNativeFileCallsMeasured:false,continuousPeakMeasured:false};db.close();process.stdout.write(JSON.stringify(row));"""
        for size in (512,4096,65536):
            for mode in ('rollback','commit'):
                root=directory();temp=root/'tmp';temp.mkdir();input=root/'sql.json';input.write_bytes(canonical(order_proof['statements'][:2]))
                plan=sorter.sorter_scratch_bound(size,sorter.declared_sorter(12000,proof['applicationCallerProofSha256']))
                (root/'conditional-plan.json').write_bytes(canonical(plan));target=root/'dev.db'
                row=run_native(program,[target,size,mode,input],root,temp)
                self.assertEqual(row['version'],'3.51.2');self.assertEqual(row['sourceId'],native.SOURCE_ID)
                self.assertEqual(row['rows'],12000);self.assertEqual(row['rolled'],mode=='rollback')
                self.assertEqual(sum(op['opcode']=='SorterOpen' for p in row['programs'] for op in p),1)
                if mode=='rollback':self.assertEqual(row['before'],row['after']);self.assertIsNone(row['indexRoot'])
                else:
                    self.assertEqual(row['nullLinks'],12000);lengths=native.payload_sizes(target.read_bytes(),size,row['indexRoot'])
                    self.assertEqual(len(lengths),12000);self.assertLessEqual(max(lengths),32)
    def test_actual_small_record_sorter_workers_and_observed_complete_initial_pma_records(self):
        program=r"""const fs=require('node:fs'),os=require('node:os'),Database=require('better-sqlite3');
        const [file,temp,root,workers]=process.argv.slice(1),db=new Database(file);db.pragma('page_size=512');db.pragma('cache_size=4');db.pragma('threads='+workers);
        db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY,v TEXT)');const put=db.prepare('INSERT INTO t VALUES(?,NULL)');db.transaction(()=>{for(let n=1;n<=150000;n++)put.run(n)})();
        const samples=[];let callbacks=0,copied=false;db.function('sample',{deterministic:true},v=>{callbacks++;if(callbacks%4096===0){for(const name of fs.readdirSync(temp)){const p=temp+'/'+name;try{const s=fs.statSync(p);if(s.isFile()){samples.push({name,bytes:s.size});if(!copied&&s.size>0&&workers==='0'){fs.copyFileSync(p,root+'/initial-pma-snapshot-original.bin');copied=true}}}catch(e){if(e.code!=='ENOENT')throw e}}}return null});
        const sql='CREATE INDEX scratch_idx ON t(sample(v))',program=db.prepare('EXPLAIN '+sql).all();db.exec(sql);
        const row={workers:Number(workers),callbacks,program,samples,copied,rows:db.prepare('SELECT count(*) n FROM t').get().n,indexRoot:db.prepare("SELECT rootpage FROM sqlite_schema WHERE name='scratch_idx'").get().rootpage,
        sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,version:db.prepare('SELECT sqlite_version() v').get().v,options:db.pragma('compile_options').map(r=>r.compile_options),tempStore:db.pragma('temp_store',{simple:true}),threads:db.pragma('threads',{simple:true}),nodeTmpdir:os.tmpdir(),platform:process.platform,
        actualNativeFileCallsMeasured:false,fullLifetimeOriginalsRetained:false,continuousPeakMeasured:false,linuxVfsTested:false,directoryAbsenceProvesNoSpill:false};db.close();process.stdout.write(JSON.stringify(row));"""
        for workers in (0,2):
            root=directory();temp=root/'tmp';temp.mkdir();target=root/'dev.db'
            plan=sorter.sorter_scratch_bound(512,sorter.declared_sorter(150000,'d'*64));(root/'conditional-plan.json').write_bytes(canonical(plan))
            row=run_native(program,[target,temp,root,workers],root,temp)
            self.assertEqual(row['sourceId'],native.SOURCE_ID);self.assertEqual(row['callbacks'],150000);self.assertEqual(row['rows'],150000)
            self.assertTrue(any(x['opcode']=='SorterOpen' for x in row['program']));self.assertFalse(row['directoryAbsenceProvesNoSpill'])
            self.assertEqual(row['threads'],workers);self.assertEqual(pathlib.Path(row['nodeTmpdir']),temp)
            lengths=native.payload_sizes(target.read_bytes(),512,row['indexRoot']);self.assertEqual(len(lengths),150000);self.assertLessEqual(max(lengths),32)
            if row['copied']:
                runs,keys,trailing_zero_bytes=complete_pma_payloads((root/'initial-pma-snapshot-original.bin').read_bytes())
                self.assertGreater(runs,0);self.assertGreater(len(keys),0);self.assertLessEqual(max(keys),32)
                (root/'captured-pma-summary.json').write_bytes(canonical({'completeObservedInitialRuns':runs,'observedKeys':len(keys),'maximumSerializedKeyBytes':max(keys),'trailingZeroBytesObserved':trailing_zero_bytes,'fullLifetimeOriginalsRetained':False}))
            if row['samples']:
                total=sum(max(x['bytes'] for x in row['samples'] if x['name']==name) for name in {x['name'] for x in row['samples']})
                self.assertLessEqual(total,plan['maximumAggregateNativeRequestedExtentBytes'])
