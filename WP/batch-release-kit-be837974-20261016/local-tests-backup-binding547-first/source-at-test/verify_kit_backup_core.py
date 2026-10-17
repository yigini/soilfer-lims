"""NEW LOCAL backup core fixtures; no production or initial-reader admission."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_backup_core as core
import verify_kit_sorter_scratch as native
import verify_kit_capture_native_inventory as engine
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[1]
FIXTURES=HERE/'backup-core-local-retained-fixtures'
def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='bc-',dir=FIXTURES)).resolve()

class BackupCore(unittest.TestCase):
    def test_full_pins_backup_api_and_entire_actual_callers_with_zero_step_hazard(self):
        proof,digest=core.source_proof();self.assertEqual(digest,sha((HERE/core.PROOF).read_bytes()))
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        for row in proof['callerExcerpts']:
            b=(ROOT/row['path']).read_bytes();self.assertEqual(b[row['startByte']:row['endByte']].decode(),row['text'])
        parts={r['label']:r['text'] for r in proof['nativeExcerpts']}
        self.assertIn('sqlite3BtreeBeginTrans(p->pDest, 2',parts['backup_step_lock_and_copy'])
        self.assertIn('nPage<0 || ii<nPage',parts['backup_step_lock_and_copy'])
        self.assertIn('p->iNext = 1',parts['backup_source_updates_and_restart'])
        self.assertIn('sqlite3BtreeRollback',parts['backup_finish'])
        seal=next(x['text'] for x in proof['callerExcerpts'] if x['function']=='seal')
        self.assertIn('before.backup(after,pages=256,sleep=0.05)',seal)
        self.assertIn('let rate = 0',(ROOT/'server/node_modules/better-sqlite3/lib/methods/backup.js').read_text())
    def test_all_page_sizes_both_core_sequences_and_no_sql_pager_count_substitution(self):
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            for p in core.PAGES:
                for n in (1,255,256,257,1024):
                    for profile in core.PROFILES:
                        plan=core.backup_core_inventory(n,p,core.declared_backup_core(profile));core.replay_backup_core_inventory(plan)
                        self.assertEqual(plan['maximumDirectBackupOnePageCalls'],n)
                        self.assertEqual(plan['maximumSuccessfulStepCalls'],(n+255)//256+int(profile=='node-live-backup'))
                        self.assertEqual(plan['maximumDestinationWriteTransactionStarts'],1)
                        self.assertTrue(plan['zeroPageStepCanStartDestinationWriteTransaction'])
                        self.assertFalse(plan['directCopyCountIsCompleteDirtyOrFileWriteInventory'])
                        self.assertEqual(plan['coreSorterInitCalls'],0)
    def test_busy_restart_page_mismatch_nonempty_savepoint_callback_and_size_profiles_refuse(self):
        d=core.declared_backup_core('node-live-backup')
        for key in core.CONDITIONS:
            with self.subTest(key=key),self.assertRaises(RuntimeError):core.backup_core_inventory(4,512,{**d,key:False})
        for key,val in [('firstStepPages',256),('followingStepPages',8),('destinationJournal','wal'),('nativeVersion','3.49.1'),('foreign',True),('version',True)]:
            with self.assertRaises(RuntimeError):core.backup_core_inventory(4,512,{**d,key:val})
        for n,p in [(0,512),(True,512),(4,True),(4,513),(2147483648,512),(core.LIMIT//512+1,512)]:
            with self.assertRaises(RuntimeError):core.backup_core_inventory(n,p,d)
        self.assertEqual(core.backup_core_inventory(core.LIMIT//512,512,d)['declaredSourceSnapshotBytes'],core.LIMIT)
    def test_entire_replay_zero_transfer_write_hazard_and_authority_tampering(self):
        plan=core.backup_core_inventory(257,4096,core.declared_backup_core('node-live-backup'))
        for key in ('maximumDirectCopyPagerWriteCalls','maximumSuccessfulStepCalls','maximumForwardCopyLoopIterations'):
            b=copy.deepcopy(plan);b[key]+=1
            with self.assertRaises(RuntimeError):core.replay_backup_core_inventory(b)
        for key in ('actualPythonWrapperToNativeBindingVerified','completeDestinationPagerDirtyInventoryDerived','destinationMainWriteEndOrSizeHintBounded','wholeBackupCallerScratchInventoryComplete','physicalFilesystemClosureClaimed','beforeSqlHeldAdmissionImplemented'):
            b=copy.deepcopy(plan);b[key]=True
            with self.assertRaises(RuntimeError):core.replay_backup_core_inventory(b)
        b=copy.deepcopy(plan);b['zeroPageStepCanStartDestinationWriteTransaction']=False
        with self.assertRaises(RuntimeError):core.replay_backup_core_inventory(b)
    def test_new_full_source_copy_and_same_length_native_caller_module_and_wrapper_mutation(self):
        proof,_=core.source_proof();root=directory();tool=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tool/core.PROOF).write_bytes((HERE/core.PROOF).read_bytes())
        with patch.object(core,'__file__',str(tool/'kit_backup_core.py')):
            core.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_backup_core.py').relative_to(ROOT).as_posix(),(HERE/'retained_files.py').relative_to(ROOT).as_posix(),'server/node_modules/better-sqlite3/lib/methods/backup.js'):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):core.source_proof()
                p.write_bytes(raw)
    def test_actual_new_python_pinned_readonly_wal_backup_pages256_memory_journal(self):
        for page in (512,4096,65536):
            root=directory();source=root/'source.db';dest=root/'backup.db';writer=sqlite3.connect(source)
            writer.execute('PRAGMA page_size='+str(page));writer.execute('PRAGMA journal_mode=WAL');writer.execute('PRAGMA wal_autocheckpoint=0')
            writer.execute('CREATE TABLE data(id INTEGER PRIMARY KEY,value BLOB)');writer.executemany('INSERT INTO data VALUES(?,?)',[(n,bytes([n%251])*8192) for n in range(96)]);writer.commit()
            before=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True);after=None
            try:
                before.execute('PRAGMA temp_store=MEMORY');before.execute('PRAGMA query_only=ON');before.execute('BEGIN')
                n=before.execute('PRAGMA page_count').fetchone()[0];p=before.execute('PRAGMA page_size').fetchone()[0]
                original={s:sha(pathlib.Path(str(source)+s).read_bytes()) for s in ('','-wal')}
                for s in ('','-wal'):shutil.copyfile(str(source)+s,root/('initial-source'+s+'.bin'))
                plan=core.backup_core_inventory(n,p,core.declared_backup_core('python-owned-seal'));(root/'plan-before-backup.json').write_bytes(canonical(plan)+b'\n')
                dest.open('xb').close();after=sqlite3.connect(dest);after.execute('PRAGMA temp_store=MEMORY');self.assertEqual(after.execute('PRAGMA journal_mode=MEMORY').fetchone(),('memory',))
                progress=[];before.backup(after,pages=256,sleep=0.05,progress=lambda status,remaining,total:progress.append([status,remaining,total]))
                self.assertEqual(after.execute('PRAGMA journal_mode=MEMORY').fetchone(),('memory',));self.assertEqual(dest.stat().st_size,n*p)
                self.assertEqual(after.execute('SELECT count(*),sum(length(value)) FROM data').fetchone(),(96,96*8192));self.assertEqual(after.execute('PRAGMA integrity_check').fetchone(),('ok',))
                self.assertEqual(original,{s:sha(pathlib.Path(str(source)+s).read_bytes()) for s in ('','-wal')})
                (root/'python-backup-original.json').write_bytes(canonical({'pageSize':p,'pageCount':n,'versionObserved':sqlite3.sqlite_version,'progress':progress,'plan':plan,'sourceMainWalUnchanged':True,'initialSetupAndSourceSqlOutsideCore':True,'testOnlyProgressObserver':True,'pythonWrapperSourceBindingVerified':False,'nativePagerCallsMeasured':False})+b'\n')
            finally:
                if after is not None:after.close()
                before.close();writer.close()
            core.replay_backup_core_inventory(plan)
    def test_actual_pinned_native_explicit_zero_then256_transfers_and_independent_abandonment(self):
        for page in (512,4096,65536):
            root=directory();setup=root/'setup';setup.mkdir();run=root/'core';run.mkdir();temp=root/'tmp';temp.mkdir();source=root/'source.db'
            program=r"""const D=require('better-sqlite3');const[file,page]=process.argv.slice(1),db=new D(file);db.pragma('page_size='+page);db.exec('CREATE TABLE data(id INTEGER PRIMARY KEY,value BLOB)');const q=db.prepare('INSERT INTO data VALUES(?,?)');db.transaction(()=>{for(let n=0;n<96;n++)q.run(n,Buffer.alloc(8192,n%251));})();const pages=db.pragma('page_count',{simple:true});db.close();process.stdout.write(JSON.stringify({pages,page:Number(page)}));"""
            meta=native.run_native(program,[source,page],setup,temp);plan=core.backup_core_inventory(meta['pages'],page,core.declared_backup_core('node-live-backup'));(root/'plan-before-core.json').write_bytes(canonical(plan)+b'\n')
            program=r"""const D=require('better-sqlite3'),{cppdb}=require('better-sqlite3/lib/util'),fs=require('fs'),crypto=require('crypto');const[file,target,abandoned]=process.argv.slice(1),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),initial=hash(),db=new D(file,{readonly:true,fileMustExist:true});db.pragma('query_only=ON');db.exec('BEGIN');const pages=db.pragma('page_count',{simple:true}),page=db.pragma('page_size',{simple:true}),sourceId=db.prepare('SELECT sqlite_source_id() s').get().s;fs.writeFileSync(target,'',{flag:'wx'});const handle=db[cppdb].backup(db,'main',target,false),zero=handle.transfer(0),steps=[];if(zero.remainingPages!==pages)throw Error('zero initial page inventory');while(true){const row=handle.transfer(256);steps.push(row);if(!row.remainingPages)break;if(steps.length>pages+1)throw Error('no progress');}handle.close();fs.writeFileSync(abandoned,'',{flag:'wx'});const other=db[cppdb].backup(db,'main',abandoned,false),abandonZero=other.transfer(0);other.close();const abandonedBytes=fs.statSync(abandoned).size;db.exec('ROLLBACK');db.close();const out=new D(target,{readonly:true,fileMustExist:true}),result=out.prepare('SELECT count(*) n,sum(length(value)) bytes FROM data').get(),integrity=out.pragma('integrity_check',{simple:true});out.close();process.stdout.write(JSON.stringify({sourceId,pages,page,zero,steps,abandonZero,abandonedBytes,result,integrity,sourceUnchanged:initial===hash(),destinationBytes:fs.statSync(target).size,actualNativePagerCallsMeasured:false,windowsOnly:true,physicalFilesystemClosureClaimed:false}));"""
            row=native.run_native(program,[source,root/'backup.db',root/'abandoned.db'],run,temp)
            self.assertEqual(row['sourceId'],engine.SOURCE_ID);self.assertTrue(row['sourceUnchanged']);self.assertEqual(row['destinationBytes'],meta['pages']*page)
            self.assertEqual(row['result'],{'n':96,'bytes':96*8192});self.assertEqual(row['integrity'],'ok');self.assertEqual(row['abandonedBytes'],0)
            self.assertEqual(len(row['steps'])+1,plan['maximumSuccessfulStepCalls']);self.assertEqual(row['steps'][-1]['remainingPages'],0)
            core.replay_backup_core_inventory(plan)
