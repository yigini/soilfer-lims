"""NEW LOCAL backup MAIN requests; no measured VFS or physical closure."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_backup_main as main
import verify_kit_sorter_scratch as native
import verify_kit_capture_native_inventory as engine
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[1]
FIXTURES=HERE/'backup-main-local-retained-fixtures'
def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='bm-',dir=FIXTURES)).resolve()

class BackupMain(unittest.TestCase):
    def test_full_source_pins_native_request_ledger_and_memory_error_close_hazard(self):
        proof,digest=main.source_proof();self.assertEqual(digest,sha((HERE/main.PROOF).read_bytes()));raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        for row in proof['requestCallLedger']:
            self.assertEqual(raw.splitlines()[row['line']-1].decode(),row['text'])
        labels={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('pPager->dbSize<pPg->pgno',labels['backup_main_pager_write_and_sector_intervals'])
        self.assertIn('pager_playback(pPager, 1)',labels['backup_main_memory_error_close_rollback'])
        self.assertIn('pgno>(Pgno)pPager->dbSize',labels['backup_main_rollback_page_guard_and_write'])
        self.assertTrue(any(r['classification']=='excluded-destination-wal-checkpoint' for r in proof['requestCallLedger']))
    def test_all_pages_profiles_and_termination_paths_charge_full_main_before_sql(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained target SQL')):
            for p in main.PAGES:
                for n in (1,2,255,256,257,10000):
                    for profile in ('node-live-backup','python-owned-seal'):
                        for termination in main.TERMINATIONS:
                            plan=main.backup_main_plan(n,p,main.declared_backup_main(profile,termination));main.replay_backup_main_plan(plan)
                            self.assertEqual(plan['maximumLogicalMainContentBytes'],n*p);self.assertEqual(plan['conditionalMaximumMainWriteEndBytes'],n*p)
                            self.assertEqual(plan['conditionalMaximumMainSizeHintArgumentBytes'],n*p);self.assertEqual(plan['fullMaximumMainLayout']['contentBytes'],n*p)
                            self.assertTrue(plan['sameFullMaximumChargedAfterAbandonmentOrRollback']);self.assertFalse(plan['completeDestinationPagerDirtyCallCountDerived'])
                            self.assertFalse(plan['mainFileLengthOrVfsPreallocationBounded'])
    def test_sector_interval_induction_including_nonpower_arithmetic_and_end_boundaries(self):
        for p in main.PAGES:
            for sector in sorted({32,512,4096,65536,65535,p+1,min(65536,p*3)}):
                if sector>65536:continue
                for current in (0,1,2,127,128,129,1000):
                    for target in (1,2,127,128,129,1001):
                        first,last=main.large_sector_interval(p,sector,current,target)
                        self.assertGreaterEqual(first,1);self.assertLessEqual(last,max(current,target))
                        # Every neighbour write is below the inductive high water,
                        # even if it makes many prior pages dirty again.
                        self.assertLessEqual(max(current,last,target),max(current,target))
        self.assertEqual(main.large_sector_interval(512,65536,0,1),(1,1))
        self.assertEqual(main.large_sector_interval(512,65536,129,129),(129,129))
        self.assertEqual(main.large_sector_interval(512,65536,128,129),(129,129))
    def test_every_freshness_journal_entry_error_reuse_type_and_whole_size_refuses(self):
        d=main.declared_backup_main('node-live-backup','commit')
        for key,value in list(d.items()):
            if value is True:
                with self.subTest(key=key),self.assertRaises(RuntimeError):main.backup_main_plan(4,512,{**d,key:False})
        for key,val in [('termination','retry'),('destinationJournal','wal'),('scope','other'),('version',True),('nativeVersion','3.49.1'),('foreign',True)]:
            with self.assertRaises(RuntimeError):main.backup_main_plan(4,512,{**d,key:val})
        for n,p in [(0,512),(True,512),(4,True),(4,513),(main.LIMIT//512+1,512)]:
            with self.assertRaises(RuntimeError):main.backup_main_plan(n,p,d)
        fit=main.backup_main_plan(main.LIMIT//512,512,d);self.assertEqual(fit['fullMaximumMainLayout']['roundedContentBytes'],main.LIMIT)
    def test_entire_producer_request_layout_and_authority_replay_refuses_tampering(self):
        plan=main.backup_main_plan(257,512,main.declared_backup_main('node-live-backup','finish-after-prefix'))
        for fault in ('extent','omit','rollback-credit','layout','native-calls','vfs','dirty','admission','extra'):
            b=copy.deepcopy(plan)
            if fault=='extent':b['conditionalMaximumMainWriteEndBytes']-=512
            elif fault=='omit':b['producerInventory'].pop()
            elif fault=='rollback-credit':b['maximumLogicalMainContentBytes']=0
            elif fault=='layout':b['fullMaximumMainLayout']['roundedContentBytes']=0
            elif fault=='native-calls':b['actualNativePagerOrFileRequestsMeasured']=True
            elif fault=='vfs':b['mainFileLengthOrVfsPreallocationBounded']=True
            elif fault=='dirty':b['completeDestinationPagerDirtyCallCountDerived']=True
            elif fault=='admission':b['beforeSqlHeldAdmissionImplemented']=True
            else:b['extra']=True
            with self.assertRaises(RuntimeError):main.replay_backup_main_plan(b)
    def test_new_complete_source_copy_same_length_native_core_caller_and_module_mutation(self):
        proof,_=main.source_proof();root=directory();tool=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tool/main.PROOF).write_bytes((HERE/main.PROOF).read_bytes())
        with patch.object(main,'__file__',str(tool/'kit_backup_main.py')):
            main.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_backup_main.py').relative_to(ROOT).as_posix(),(HERE/'kit_backup_core.py').relative_to(ROOT).as_posix(),(HERE/'retained_files.py').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):main.source_proof()
                p.write_bytes(raw)
    def test_actual_pinned_native_commit_and_abandon_after_real_default_cache_spill(self):
        for page in (512,4096,65536):
            root=directory();setup=root/'setup';setup.mkdir();temp=root/'tmp';temp.mkdir();source=root/'source.db'
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.exec('CREATE TABLE data(id INTEGER PRIMARY KEY,value BLOB)');const q=db.prepare('INSERT INTO data VALUES(?,?)');db.transaction(()=>{for(let n=0;n<96;n++)q.run(n,Buffer.alloc(256*1024,n%251));})();const pages=db.pragma('page_count',{simple:true});db.close();process.stdout.write(JSON.stringify({pages,page:Number(page),rows:96,payloadBytes:96*256*1024}));"""
            meta=native.run_native(program,[source,page],setup,temp)
            for mode in ('commit','abort'):
                out=root/mode;out.mkdir();plan=main.backup_main_plan(meta['pages'],page,main.declared_backup_main('node-live-backup','commit' if mode=='commit' else 'finish-after-prefix'));(out/'plan-before-backup.json').write_bytes(canonical(plan)+b'\n')
                program=r"""const D=require('better-sqlite3'),{cppdb}=require('better-sqlite3/lib/util'),fs=require('fs'),crypto=require('crypto');const[file,target,mode,retained]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),initial=hash(),db=new D(file,{readonly:true,fileMustExist:true});db.pragma('query_only=ON');db.exec('BEGIN');const pages=db.pragma('page_count',{simple:true}),page=db.pragma('page_size',{simple:true}),sourceId=db.prepare('SELECT sqlite_source_id() s').get().s;fs.writeFileSync(target,'',{flag:'wx'});const handle=db[cppdb].backup(db,'main',target,false),zero=handle.transfer(0),samples=[];while(true){const row=handle.transfer(256),bytes=fs.statSync(target).size;samples.push({...row,bytes});if(mode==='abort' && (pages-row.remainingPages)*page>=4*1024*1024){if(!row.remainingPages||!bytes)throw Error('abort must follow real spill before completion');break;}if(!row.remainingPages)break;}const beforeFinishBytes=fs.statSync(target).size;fs.copyFileSync(target,retained);handle.close();const finalBytes=fs.statSync(target).size;db.exec('ROLLBACK');db.close();let result=null,integrity=null;if(mode==='commit'){const out=new D(target,{readonly:true,fileMustExist:true});result=out.prepare('SELECT count(*) n,sum(length(value)) bytes FROM data').get();integrity=out.pragma('integrity_check',{simple:true});out.close();}process.stdout.write(JSON.stringify({sourceId,pages,page,mode,zero,samples,beforeFinishBytes,finalBytes,result,integrity,sourceUnchanged:initial===hash(),nativePagerOrFileRequestsMeasured:false,ioFailureInjected:false,windowsOnly:true,continuousPeakMeasured:false,physicalFilesystemClosureClaimed:false}));"""
                row=native.run_native(program,[source,out/'destination.db',mode,out/'before-finish-main-original.bin'],out,temp)
                self.assertEqual(row['sourceId'],engine.SOURCE_ID);self.assertTrue(row['sourceUnchanged']);self.assertEqual(row['pages'],meta['pages'])
                self.assertGreater(row['beforeFinishBytes'],0);self.assertLessEqual(max(s['bytes'] for s in row['samples']),plan['conditionalMaximumMainWriteEndBytes'])
                self.assertEqual(row['finalBytes'],meta['pages']*page if mode=='commit' else 0)
                if mode=='commit':self.assertEqual(row['result'],{'n':96,'bytes':96*256*1024});self.assertEqual(row['integrity'],'ok')
                else:self.assertGreater(row['samples'][-1]['remainingPages'],0)
                main.replay_backup_main_plan(plan)
