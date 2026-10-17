"""NEW synthetic/source-only checkpoint proof tests, no native fixture calls."""
import copy,json,pathlib,shutil,sqlite3,sys,tempfile,unittest
from unittest.mock import patch
import kit_checkpoint_requests as request
import verify_kit_sorter_scratch as native
import verify_kit_capture_native_inventory as engine
from kit_contract import canonical,sha
from verify_kit_wal_source_binding import synthetic

HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[1];FIXTURES=HERE/'checkpoint-requests-local-retained-fixtures'
def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='cq-',dir=FIXTURES)).resolve()

class CheckpointRequests(unittest.TestCase):
    def test_new_retained_complete_original_package_roundtrip_with_sql_disabled(self):
        root=directory();wal,index=synthetic(512,'little',False,7)
        plan=request.original_plan(20000*512,wal,index,512,'little',request.declaration('PASSIVE'))
        (root/'wal-original.bin').write_bytes(wal);(root/'index-original.bin').write_bytes(index)
        raw=canonical(plan)+b'\n';(root/'complete-original-plan.json').write_bytes(raw)
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained-target SQL')):
            replayed=request.replay_original(json.loads((root/'complete-original-plan.json').read_bytes()))
        self.assertEqual(bytes.fromhex(replayed['walOriginalHex']),(root/'wal-original.bin').read_bytes())
        self.assertEqual(bytes.fromhex(replayed['indexOriginalHex']),(root/'index-original.bin').read_bytes())
        self.assertEqual(canonical(replayed)+b'\n',raw)
        for key in ('walOriginalHex','indexOriginalHex'):
            altered=json.loads(raw);altered[key]=altered[key][:-2]+('00' if altered[key][-2:]!='00' else '01')
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained-target SQL')),self.assertRaises(RuntimeError):request.replay_original(altered)
        (root/'retained-package-result.json').write_bytes(canonical({'kind':'NEW_RETAINED_SYNTHETIC_ORIGINAL_PACKAGE','walBytes':len(wal),'indexBytes':len(index),
            'planBytes':len(raw),'planSha256':sha(raw),'completeWalIndexPlanFilesRetained':True,'wholeOriginalReplayWithoutSql':True,
            'actualMainSourceAssociationVerified':False,'nativeCheckpointExecuted':False,'physicalFilesystemClosureClaimed':False})+b'\n')
    def test_actual_new_native_head_originals_plan_precedes_checkpoint_and_full_package_replay(self):
        setup_code=r"""const D=require('better-sqlite3'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const[root,sizeArg]=process.argv.slice(1),size=Number(sizeArg),rows=size===512?256:64,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const srcName=path.join(root,'source.db'),reader=path.join(root,'reader.db'),original=path.join(root,'originals'),candidate=path.join(root,'candidate','dev.db');
const src=new D(srcName);src.pragma('page_size='+size);src.pragma('journal_mode=WAL');src.pragma('wal_autocheckpoint=0');src.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB)');
src.transaction(()=>{const s=src.prepare('INSERT INTO payload VALUES(?,?)');for(let i=0;i<rows;i++)s.run(i,Buffer.alloc(8192,i%251));})();
fs.copyFileSync(srcName,reader);fs.copyFileSync(srcName+'-wal',reader+'-wal');const ro=new D(reader,{readonly:true,fileMustExist:true});ro.exec('BEGIN');
const integrity=ro.pragma('integrity_check',{simple:true}),data=ro.prepare('SELECT count(*) n,sum(length(value)) bytes FROM payload').get(),page=ro.pragma('page_size',{simple:true}),pages=ro.pragma('page_count',{simple:true}),sourceId=ro.prepare('SELECT sqlite_source_id() id').get().id;
const pins={};for(const suffix of['','-wal','-shm']){const from=reader+suffix,b=fs.readFileSync(from),to=path.join(original,'dev.db'+suffix);fs.writeFileSync(to,b);fs.writeFileSync(candidate+suffix,b);pins[suffix]={bytes:b.length,sha256:hash(b)};}
const result={page,pages,rows,data,integrity,sourceId,byteOrder:require('os').endianness()==='LE'?'little':'big',pins,originalsCopiedWhileOwnedReadonlyTransactionOpen:true,initialFixtureSqlOutsideConditionalProfile:true,nativeCheckpointCallsOrReturnCodesMeasured:false,physicalFilesystemClosureClaimed:false};ro.exec('ROLLBACK');ro.close();src.close();process.stdout.write(JSON.stringify(result));"""
        checkpoint_code=r"""const D=require('better-sqlite3'),fs=require('fs'),crypto=require('crypto');const[file,out]=process.argv.slice(1),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const before={};for(const suffix of['','-wal','-shm']){const b=fs.readFileSync(file+suffix);before[suffix]={bytes:b.length,sha256:hash(b)};}
fs.copyFileSync(file,out+'/main-before-checkpoint-original.bin');const db=new D(file,{fileMustExist:true}),result=db.pragma('wal_checkpoint(PASSIVE)');const after=fs.readFileSync(file);fs.writeFileSync(out+'/main-after-checkpoint-original.bin',after);
const integrity=db.pragma('integrity_check',{simple:true}),data=db.prepare('SELECT count(*) n,sum(length(value)) bytes FROM payload').get(),sourceId=db.prepare('SELECT sqlite_source_id() id').get().id;db.close();
process.stdout.write(JSON.stringify({before,result,integrity,data,sourceId,afterCheckpointMainBytes:after.length,finalMainBytes:fs.statSync(file).size,testInvokedCheckpointPragmaExecutions:1,constructorVerificationSqlAndFinalCloseOutsideOneApiPlan:true,nativeCheckpointCallsOrReturnCodesMeasured:false,nativeFileCallsMeasured:false,continuousPeakMeasured:false,physicalFilesystemClosureClaimed:false}));"""
        for size in (512,4096,65536):
            root=directory();setup=root/'native-setup';setup.mkdir();run=root/'native-checkpoint';run.mkdir();temp=root/'tmp';temp.mkdir();originals=root/'originals';originals.mkdir();candidate=root/'candidate';candidate.mkdir()
            meta=native.run_native(setup_code,[root,size],setup,temp)
            self.assertEqual(meta['sourceId'],engine.SOURCE_ID);self.assertEqual(meta['page'],size);self.assertEqual(meta['integrity'],'ok')
            self.assertEqual(meta['data'],{'n':meta['rows'],'bytes':meta['rows']*8192})
            wal=(originals/'dev.db-wal').read_bytes();index=(originals/'dev.db-shm').read_bytes();main=(originals/'dev.db').read_bytes()
            plan=request.original_plan(len(main),wal,index,size,meta['byteOrder'],request.declaration('PASSIVE'))
            self.assertEqual(plan['checkpointPlan']['declaredCheckpointHeadPages'],meta['pages'])
            self.assertFalse(plan['actualEntryAndHeadSourceAssociationVerified']);self.assertFalse(plan['nativeRecoveryExecutionVerified'])
            raw=canonical(plan)+b'\n';(root/'complete-plan-before-native-checkpoint.json').write_bytes(raw)
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No planner SQL')):request.replay_original(json.loads(raw))
            value=native.run_native(checkpoint_code,[candidate/'dev.db',run],run,temp)
            self.assertEqual(value['before'],meta['pins']);self.assertEqual(value['sourceId'],engine.SOURCE_ID)
            self.assertEqual(value['result'],[{'busy':0,'log':plan['checkpointPlan']['declaredCheckpointHeadFrames'],'checkpointed':plan['checkpointPlan']['declaredCheckpointHeadFrames']}])
            self.assertEqual(value['integrity'],'ok');self.assertEqual(value['data'],meta['data'])
            self.assertEqual(value['afterCheckpointMainBytes'],meta['pages']*size);self.assertEqual(value['finalMainBytes'],value['afterCheckpointMainBytes'])
            self.assertEqual((run/'main-before-checkpoint-original.bin').read_bytes(),main)
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No package replay SQL')):request.replay_original(json.loads((root/'complete-plan-before-native-checkpoint.json').read_bytes()))
            if size==512:self.assertGreater(plan['fullFreshIndexByteObservation']['regions'],1)
            result={'kind':'NEW_LOCAL_NATIVE_CHECKPOINT_ORIGINALS','page':size,'headPages':meta['pages'],'headFrames':plan['checkpointPlan']['declaredCheckpointHeadFrames'],
                'rows':meta['rows'],'payloadBytes':meta['rows']*8192,'fullMainWalIndexOriginalsRetained':True,'fullPlanPrecedesCandidateWriter':True,
                'planSha256':sha(raw),'sourceSetupSqlOutsideConditionalProfile':True,'sourceOriginalPins':meta['pins'],'checkpointSqlResult':value['result'],
                'afterCheckpointMainBytes':value['afterCheckpointMainBytes'],'finalMainBytes':value['finalMainBytes'],
                'wholeOriginalPackageReplayWithoutSql':True,'constructorVerificationSqlAndFinalCloseOutsideOneApiPlan':True,
                'actualEntryAndHeadSourceAssociationVerified':False,'nativeCheckpointCallsOrReturnCodesMeasured':False,'nativeFileCallsMeasured':False,
                'runtimeBinaryToSourceBindingVerified':False,'continuousPeakMeasured':False,'physicalFilesystemClosureClaimed':False}
            (root/'native-checkpoint-case.json').write_bytes(canonical(result)+b'\n')
    def test_full_pins_exact_source_ranges_os_ledger_and_distinct_mapping_not_call_count(self):
        proof,digest=request.source_proof();self.assertEqual(digest,sha((HERE/request.PROOF).read_bytes()))
        raw=(ROOT/proof['nativeSource']['path']).read_bytes();parts={}
        for row in proof['nativeExcerpts']:
            part=raw[row['startByte']:row['endByte']];self.assertEqual(part.decode(),row['text']);self.assertEqual(sha(part),row['sha256']);parts[row['label']]=row['text']
        self.assertIn('if( pWal->readOnly )',parts['wal_checkpoint_wrapper']);self.assertIn('iDbpage>mxPage',parts['wal_checkpoint_body'])
        self.assertIn('p->iPrior = iRet',parts['wal_iterator_next']);self.assertIn('walIndexRecover(pWal)',parts['wal_index_read_header'])
        self.assertIn('pWal->writeLock',parts['wal_index_page_realloc']);self.assertFalse(proof['runtimeBinaryToSourceBindingVerified'])
    def test_all_pages_modes_original_extents_full_charge_and_recovery_region_edges(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for p in request.PAGES:
                for f in (1,4062,4063,8158,8159):
                    for mode in request.MODES:
                        d=97;main=200*p;wal=32+f*(p+24);old_index=4*32768
                        plan=request.checkpoint_plan(main,wal,old_index,p,d,f,request.declaration(mode));request.replay_checkpoint(plan)
                        regions=1+max(0,f-4062+4095)//4096
                        self.assertEqual(plan['maximumDirectMainPageWriteCalls'],min(d,f));self.assertEqual(plan['maximumMainWriteEndArgumentBytes'],d*p)
                        self.assertEqual(plan['maximumDistinctIndexRegionsRequested'],regions);self.assertFalse(plan['indexMapInvocationCountDerived'])
                        self.assertEqual(plan['fullMainWalIndexLayout']['contentBytes'],main+wal+max(old_index,regions*32768))
                        self.assertTrue(plan['fullInitialExtentsRetainedAfterNativeResetTruncateCloseOrError'])
    def test_independent_adversarial_latest_frame_iterator_windows_and_direct_write_extent(self):
        # Independent complete frame vectors exercise duplicates, growing/shrinking
        # head and every safe/backfill window; no static opcode/site substitution.
        for pages in ([1],[9,1,9,3,1],[17,17,2,29,2,1,9],[3,2,1,3,2,1]):
            f=len(pages)
            for d in (1,2,4,31):
                plan=request.checkpoint_plan(40*512,32+f*536,32768,512,d,f,request.declaration('PASSIVE'))
                latest={page:ordinal for ordinal,page in enumerate(pages,1)}
                for back in range(f+1):
                    for safe in range(back,f+1):
                        writes=[(page,frame) for page,frame in sorted(latest.items()) if back<frame<=safe and page<=d]
                        self.assertLessEqual(len(writes),plan['maximumDirectMainPageWriteCalls'])
                        self.assertLessEqual(sum(512 for _ in writes),plan['maximumDirectMainWriteBytes'])
                        self.assertTrue(all(page*512<=plan['maximumMainWriteEndArgumentBytes'] for page,_ in writes))
                self.assertFalse(plan['passiveOkIsCompleteBackfill']);self.assertFalse(plan['earlierReaderPageCountIsCheckpointHead'])
    def test_every_entry_type_complete_size_and_aggregate_rounding_refuses_without_clipping(self):
        args=(4096,32+7*536,32768,512,20000,7);d=request.declaration('WAL_CLOSE')
        for key in request.CONDITIONS:
            with self.subTest(key=key),self.assertRaises(RuntimeError):request.checkpoint_plan(*args,{**d,key:False})
        for key,value in [('version',True),('mode','RETRY'),('nativeVersion','3.49.1'),('foreign',True)]:
            with self.assertRaises(RuntimeError):request.checkpoint_plan(*args,{**d,key:value})
        for i,value in [(0,True),(1,True),(2,True),(3,True),(4,True),(5,True),(3,513),(4,0),(5,0),(0,1),(1,0),(2,1),(4,4294967295)]:
            b=list(args);b[i]=value
            with self.assertRaises(RuntimeError):request.checkpoint_plan(*b,d)
        # EACH extent fits while full aggregate does not. Rounded content, too,
        # must be checked whole; no retained-WAL/index/truncation credits.
        with self.assertRaises(RuntimeError):request.checkpoint_plan(request.LIMIT,568,32768,512,1,1,d)
        with self.assertRaises(RuntimeError):request.checkpoint_plan(0,568,request.LIMIT,512,1,1,d)
        with self.assertRaises(RuntimeError):request.checkpoint_plan(512,568,32768,512,request.LIMIT//512,1,d)
    def test_whole_plan_extent_mapping_count_and_every_false_authority_replay_refuses(self):
        plan=request.checkpoint_plan(1024*512,32+7*536,32768,512,20000,7,request.declaration('TRUNCATE'))
        for key in ('maximumDirectMainPageWriteCalls','maximumMainWriteEndArgumentBytes','maximumDistinctIndexRegionsRequested','maximumRequestedIndexMappingExtentBytes'):
            b=copy.deepcopy(plan);b[key]-=1
            with self.assertRaises(RuntimeError):request.replay_checkpoint(b)
        for key,val in plan.items():
            if val is False:
                b=copy.deepcopy(plan);b[key]=True
                with self.assertRaises(RuntimeError):request.replay_checkpoint(b)
        b=copy.deepcopy(plan);b['fullMainWalIndexLayout']['contentBytes']=0
        with self.assertRaises(RuntimeError):request.replay_checkpoint(b)
    def test_complete_fresh_index_wal_originals_bind_HEAD_not_earlier_main_and_pure_replay(self):
        root=directory();cases=[]
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for p,order,big,f in [(512,'little',False,7),(4096,'big',True,7),(65536,'little',True,7),(512,'big',False,4063)]:
                wal,index=synthetic(p,order,big,f);plan=request.original_plan(2*p,wal,index,p,order,request.declaration('WAL_CLOSE'));request.replay_original(plan)
                self.assertEqual(plan['checkpointPlan']['declaredCheckpointHeadPages'],20000);self.assertEqual(plan['checkpointPlan']['maximumMainWriteEndArgumentBytes'],20000*p)
                self.assertFalse(plan['walToMainSemanticAssociationVerified']);self.assertFalse(plan['nativeRecoveryExecutionVerified']);self.assertFalse(plan['fullPrivateMainBytesPackaged'])
                for key in ('walOriginalHex','indexOriginalHex'):
                    b=copy.deepcopy(plan);b[key]=('00' if b[key][:2]!='00' else '01')+b[key][2:]
                    with self.assertRaises(RuntimeError):request.replay_original(b)
                b=copy.deepcopy(plan);b['checkpointPlan']['declaredCheckpointHeadPages']=2
                with self.assertRaises(RuntimeError):request.replay_original(b)
                b=copy.deepcopy(plan);b['writerGraphAdmissionImplemented']=True
                with self.assertRaises(RuntimeError):request.replay_original(b)
                cases.append({'page':p,'frames':f,'order':order,'walBytes':len(wal),'indexBytes':len(index),'headPages':20000,'earlierDeclaredMainPages':2,'planSha256':sha(canonical(plan))})
        (root/'synthetic-original-replay-cases.json').write_bytes(canonical({'cases':cases,'syntheticArithmeticAndByteReplayOnly':True,'newNativeFeatureCases':0,'nativeRecoveryExecuted':False,'targetSqlOpened':False})+b'\n')
        with self.assertRaises(RuntimeError):request.original_plan(0,b'x'*(request.MAX_ORIGINAL_BYTES+1),b'',512,'little',request.declaration('PASSIVE'))
    def test_new_full_source_copy_detects_same_length_native_module_prior_ledger_and_checker_mutation(self):
        proof,_=request.source_proof();root=directory()
        if sys.platform=='win32':root=pathlib.Path('\\\\?\\'+str(root))
        tool=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tool/request.PROOF).write_bytes((HERE/request.PROOF).read_bytes())
        with patch.object(request,'__file__',str(tool/'kit_checkpoint_requests.py')):
            request.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_checkpoint_requests.py').relative_to(ROOT).as_posix(),proof['priorCheckpointReviewPath'],(HERE/'kit_wal_source_binding.py').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):request.source_proof()
                p.write_bytes(raw)
