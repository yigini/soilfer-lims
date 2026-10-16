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
const admission={version:2,maximumMainBytes:4096,maximumJournalBytes:131072,filesystemClosureClaimed:false};
class Database {
 constructor(source,options){assert.equal(source,'SYNTHETIC_ONLY');assert.deepEqual(options,{readonly:true,fileMustExist:true});opens++;}
 pragma(sql){if(sql==='query_only = ON')return [];if(sql==='query_only')return 1;
  if(sql==='page_count')return 2;if(sql==='page_size')return 4096;throw Error('unexpected pragma');}
 exec(sql){assert(['BEGIN','ROLLBACK'].includes(sql));this.inTransaction=sql==='BEGIN';}
 prepare(sql){if(sql==='SELECT sqlite_version() AS version, sqlite_source_id() AS sourceId')return {get:()=>({version:'3.51.2',sourceId:'2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'})};
  assert.equal(sql,'SELECT count(*) AS count FROM sqlite_schema');return {get:()=>({count:1})};}
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
 const result=await backup(source,target,Advancing,{version:2,maximumMainBytes:bytes,maximumJournalBytes:131072,filesystemClosureClaimed:false});
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
const valid='{"filesystemClosureClaimed":false,"maximumJournalBytes":131072,"maximumMainBytes":8192,"version":2}\n';
for(const [name,raw,ok] of [['valid',valid,true],['duplicate',valid.replace('"version":2','"version":0,"version":2'),false],
 ['oversize',' '.repeat(8193),false],['false-closure',valid.replace('false','true'),false],
 ['short-journal',valid.replace('131072','65536'),false]]){
 const p=path.join(dir,name);fs.writeFileSync(p,raw);
 if(ok)assert.equal(readAdmission(p).maximumMainBytes,8192);else assert.throws(()=>readAdmission(p));
}''')

    def test_existing_sidecars_and_wrong_native_engine_refuse_before_output(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {backup}=require(process.argv[1]),dir=process.argv[2];let opens=0;
const admission={version:2,maximumMainBytes:4096,maximumJournalBytes:131072,filesystemClosureClaimed:false};
class Database {constructor(){opens++;}pragma(){return 1;}prepare(){return {get:()=>({version:'unknown',sourceId:'unknown'})};}close(){}}
(async()=>{
 for(const suffix of ['-journal','-wal','-shm']){
  const target=path.join(dir,'existing'+suffix+'.db');fs.writeFileSync(target+suffix,'retained');
  await assert.rejects(()=>backup('SYNTHETIC_ONLY',target,Database,admission));
  assert(!fs.existsSync(target));assert.equal(fs.readFileSync(target+suffix,'utf8'),'retained');
 }
 assert.equal(opens,0);
 const target=path.join(dir,'wrong-engine.db');await assert.rejects(()=>backup('SYNTHETIC_ONLY',target,Database,admission));
 assert.equal(opens,1);assert(!fs.existsSync(target));
})().catch(error=>{console.error(error);process.exitCode=1});''')

    def test_exact_dependency_files_and_small_page_spilling_backups(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {backup,verifyDependency}=require(process.argv[1]),dir=process.argv[2],Database=require(process.argv[3]);
const req=createRequire(path.join(process.argv[3],'package.json'));verifyDependency(req);
const observations=[];
const altered=path.join(dir,'altered-dependency');fs.mkdirSync(altered);
fs.writeFileSync(path.join(altered,'binding.gyp'),'changed');
assert.throws(()=>verifyDependency({resolve:()=>path.join(altered,'package.json')}));
(async()=>{
 for(const pageSize of [512,4096,65536]){
  const source=path.join(dir,'source-'+pageSize+'.db'),target=path.join(dir,'backup-'+pageSize+'.db');
  const writer=new Database(source);writer.pragma('page_size='+pageSize);writer.pragma('journal_mode=WAL');
  const payloadBytes=(pageSize===512?32:8)*1024*1024;
  writer.exec('CREATE TABLE retained(value BLOB)');writer.prepare('INSERT INTO retained VALUES(?)').run(Buffer.alloc(payloadBytes,13));
  const bytes=writer.pragma('page_count',{simple:true})*pageSize;let calls=0,journalMaximum=0;
  class Observed extends Database {backup(destination,options){return super.backup(destination,{...options,progress(value){
   calls++;if(fs.existsSync(destination+'-journal'))journalMaximum=Math.max(journalMaximum,fs.statSync(destination+'-journal').size);
   assert(journalMaximum<=131072);return Math.min(8,options.progress(value));
  }});}}
  try {
   const result=await backup(source,target,Observed,{version:2,maximumMainBytes:bytes,maximumJournalBytes:131072,filesystemClosureClaimed:false});
   assert.equal(result.bytes,bytes);assert(calls>1);if(pageSize===512)assert(journalMaximum>0);
   for(const suffix of ['-journal','-wal','-shm'])assert(!fs.existsSync(target+suffix));
   const copy=new Database(target,{readonly:true,fileMustExist:true});
   try {assert.equal(copy.pragma('page_size',{simple:true}),pageSize);assert.equal(copy.pragma('integrity_check',{simple:true}),'ok');
    assert.equal(copy.prepare('SELECT length(value) AS n FROM retained').get().n,payloadBytes);}finally{copy.close();}
   assert.equal(writer.pragma('journal_mode',{simple:true}),'wal');
   observations.push({pageSize,bytes,progressSamples:calls,sampledJournalMaximum:journalMaximum,continuousPeakClaimed:false});
  }finally{writer.close();}
 }
 fs.writeFileSync(path.join(dir,'journal-observations.json'),JSON.stringify(observations)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1});''')

    def test_main_plus_journal_and_two_entries_fit_the_held_envelope(self):
        for measured in (131072,1024**2,563326976,32*1024**3):
            admission,plan=live_backup_limit(measured)
            self.assertEqual(admission['maximumJournalBytes'],131072)
            self.assertEqual(plan['fileCount'],2)
            self.assertEqual(plan['contentBytes'],admission['maximumMainBytes']+131072)
            self.assertLessEqual(plan['declaredAllocationBytes'],(measured*125+99)//100)

    def test_real_failure_after_cache_spill_retains_the_consumed_destination(self):
        self.node(r'''
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {backup}=require(process.argv[1]),dir=process.argv[2],Database=require(process.argv[3]);
const source=path.join(dir,'source.db'),target=path.join(dir,'failed.db'),writer=new Database(source);
writer.pragma('journal_mode=WAL');writer.exec('CREATE TABLE retained(value BLOB)');
writer.prepare('INSERT INTO retained VALUES(?)').run(Buffer.alloc(24*1024*1024,17));
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const original=[digest(source),digest(source+'-wal')],bytes=writer.pragma('page_count',{simple:true})*4096;
let spilled=false;
class Refusing extends Database {backup(destination,options){return super.backup(destination,{...options,progress(value){
 if(value.totalPages-value.remainingPages>4500){
  assert(fs.statSync(destination).size>0);spilled=true;throw Error('LOCAL_AFTER_SPILL_REFUSAL');
 }
 return options.progress(value);
}});}}
(async()=>{try{
 const admission={version:2,maximumMainBytes:bytes,maximumJournalBytes:131072,filesystemClosureClaimed:false};
 await assert.rejects(()=>backup(source,target,Refusing,admission),/LOCAL_AFTER_SPILL_REFUSAL/);
 assert(spilled);assert(fs.existsSync(target));assert.equal(fs.statSync(target).size,0);
 assert.deepEqual([digest(source),digest(source+'-wal')],original);
 await assert.rejects(()=>backup(source,target,Database,admission),/already consumed/);
 assert.equal(writer.pragma('journal_mode',{simple:true}),'wal');
}finally{writer.close();}})().catch(error=>{console.error(error);process.exitCode=1});''')

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
        with patch('kit_owned.ROOT',pathlib.PurePosixPath(root.as_posix())),\
             patch('kit_evidence._runtime',__import__('kit_evidence').EvidenceLedger(root)):
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
