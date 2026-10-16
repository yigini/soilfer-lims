"""Real LOCAL Node/SQLite snapshots and pre-create refusal boundaries only."""
import json
import pathlib
import shutil
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch
from kit_budget import Budget,TABLE,COPY_ADMISSION_SITES
from kit_copy_admission import live_backup_limit
from kit_owned import filesystem_controls,cli_spec
from kit_integrity import DATA_MOUNT

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'live-backup-local-retained-fixtures'

def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()

class LiveBackup(unittest.TestCase):
    def node(self,code):
        root=directory();node=shutil.which('node');self.assertIsNotNone(node)
        database=HERE.parents[1]/'server/node_modules/better-sqlite3'
        value=subprocess.run([node,'-e',code,str(HERE/'live_backup.cjs'),str(root),str(database)],capture_output=True,timeout=30)
        (root/'stdout-original.txt').write_bytes(value.stdout);(root/'stderr-original.txt').write_bytes(value.stderr)
        self.assertEqual(value.returncode,0,value.stderr.decode('utf-8',errors='replace'))

    def test_missing_or_small_admission_refuses_before_output_and_failures_retain_output(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {backup}=require(process.argv[1]),dir=process.argv[2];let opens=0,closes=0,copies=0;
const admission={version:1,maximumMainBytes:4096,journalAndFilesystemClosureClaimed:false};
class Database {
 constructor(source,options){assert.equal(source,'SYNTHETIC_ONLY');assert.deepEqual(options,{readonly:true,fileMustExist:true});opens++;}
 pragma(sql){if(sql==='query_only = ON')return [];if(sql==='query_only')return 1;
  if(sql==='page_count')return 2;if(sql==='page_size')return 4096;throw Error('unexpected pragma');}
 exec(sql){assert(['BEGIN','ROLLBACK'].includes(sql));this.inTransaction=sql==='BEGIN';}
 prepare(sql){assert.equal(sql,'SELECT count(*) AS count FROM sqlite_schema');return {get:()=>({count:1})};}
 async backup(destination){copies++;throw Error('SYNTHETIC_FAILED_BACKUP');}
 close(){closes++;}
}
(async()=>{
 const target=path.join(dir,'backup.db');
 await assert.rejects(()=>backup('SYNTHETIC_ONLY',target,Database));assert.equal(opens,0);
 await assert.rejects(()=>backup('SYNTHETIC_ONLY',target,Database,admission));
 assert.equal(opens,1);assert.equal(closes,1);assert.equal(copies,0);assert(!fs.existsSync(target));
 await assert.rejects(()=>backup('SYNTHETIC_ONLY',target,Database,{...admission,maximumMainBytes:8192}));
 assert(fs.existsSync(target));assert.equal(fs.statSync(target).size,0);assert.equal(copies,1);
 await assert.rejects(()=>backup('SYNTHETIC_ONLY',target,Database,{...admission,maximumMainBytes:8192}));
 assert.equal(opens,2);assert.equal(closes,2);assert.equal(copies,1);
})().catch(error=>{console.error(error);process.exitCode=1});''')

    def test_real_wal_snapshot_stays_pinned_when_other_writer_grows_source_before_backup(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {backup}=require(process.argv[1]),dir=process.argv[2],Database=require(process.argv[3]);
const source=path.join(dir,'source.db'),target=path.join(dir,'backup.db'),writer=new Database(source);
writer.pragma('journal_mode=WAL');writer.exec('CREATE TABLE retained(value BLOB)');
writer.prepare('INSERT INTO retained VALUES(?)').run(Buffer.alloc(2*1024*1024,7));
const bytes=writer.pragma('page_count',{simple:true})*writer.pragma('page_size',{simple:true});
class Advancing extends Database {
 async backup(destination,options){assert(this.inTransaction);writer.prepare('INSERT INTO retained VALUES(?)').run(Buffer.alloc(3*1024*1024,9));
  assert(writer.pragma('page_count',{simple:true})*4096>bytes);return super.backup(destination,options);}
}
(async()=>{try {
 const result=await backup(source,target,Advancing,{version:1,maximumMainBytes:bytes,journalAndFilesystemClosureClaimed:false});
 assert.equal(result.bytes,bytes);assert.equal(result.consistentBackup,true);
 const copy=new Database(target,{readonly:true,fileMustExist:true});
 try {assert.equal(copy.prepare('SELECT count(*) AS n FROM retained').get().n,1);
  assert.equal(copy.prepare('SELECT length(value) AS n FROM retained').get().n,2*1024*1024);
  assert.equal(copy.pragma('integrity_check',{simple:true}),'ok');}finally{copy.close();}
 assert.equal(writer.prepare('SELECT count(*) AS n FROM retained').get().n,2);
 assert.equal(writer.pragma('journal_mode',{simple:true}),'wal');
}finally{writer.close();}})().catch(error=>{console.error(error);process.exitCode=1});''')

    def test_admission_parser_rejects_duplicate_keys_and_oversized_input(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readAdmission}=require(process.argv[1]),dir=process.argv[2];
const valid='{"journalAndFilesystemClosureClaimed":false,"maximumMainBytes":8192,"version":1}\n';
for(const [name,raw,ok] of [['valid',valid,true],['duplicate',valid.replace('"version":1','"version":0,"version":1'),false],
 ['oversize',' '.repeat(8193),false],['false-closure',valid.replace('false','true'),false]]){
 const p=path.join(dir,name);fs.writeFileSync(p,raw);
 if(ok)assert.equal(readAdmission(p).maximumMainBytes,8192);else assert.throws(()=>readAdmission(p));
}''')

    def test_parent_requires_admission_before_directory_and_consumes_backup_claim_once(self):
        root=directory();budget=Budget(1024**2,4096,1)
        # Close earlier stages using the complete declared admissions, without operations.
        for row in TABLE[:8]:
            budget.begin(row['stage'],10**12)
            for site,count in row['sites'].items():
                for _ in range(count):
                    budget.claim(site)
                    if site in COPY_ADMISSION_SITES:budget.copy_ceiling(site)
            budget.finish(row['stage'],0)
        budget.begin('first-sync',10**12);budget.cli('first-sync-backup')
        with patch('kit_owned.ROOT',pathlib.PurePosixPath(root.as_posix())):
            spec=cli_spec('first-sync-backup',DATA_MOUNT)
            prepare,_,_=filesystem_controls(root,False)
            with self.assertRaisesRegex(RuntimeError,'held before-create'):prepare(spec)
            self.assertFalse(pathlib.Path(spec['tmp']).exists())
            plans=[]
            def admit(site,destination,plan):
                self.assertFalse(destination.parent.exists());self.assertEqual(site,'cli-backup')
                self.assertLessEqual(plan['declaredAllocationBytes'],budget.copy_ceiling(site));plans.append(plan)
            disk=types.SimpleNamespace(budget=budget,admit_copy=admit)
            prepare,_,_=filesystem_controls(root,False,disk);prepare(spec)
            limit=json.loads((pathlib.Path(spec['tmp'])/'backup-admission.json').read_bytes())
            self.assertEqual(limit,live_backup_limit(budget.db)[0]);self.assertEqual(len(plans),1)
            with self.assertRaisesRegex(RuntimeError,'reuse'):budget.copy_ceiling('cli-backup')
            budget.finish('first-sync',0)

    def test_stage_cannot_close_with_an_unadmitted_live_backup(self):
        budget=Budget(1024**2,4096,1);budget.completed=8
        budget.begin('first-sync',10**12);budget.cli('first-sync-backup')
        with self.assertRaisesRegex(RuntimeError,'before-create'):budget.finish('first-sync',0)
        for measured in (1,4096):
            with self.assertRaises(RuntimeError):live_backup_limit(measured)

if __name__=='__main__':unittest.main()
