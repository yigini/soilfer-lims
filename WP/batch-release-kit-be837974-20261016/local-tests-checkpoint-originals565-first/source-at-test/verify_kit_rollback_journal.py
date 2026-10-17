"""Conditional rollback planner: real LOCAL pages/journals, no operator execution."""
import hashlib
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_rollback_journal as journal
from kit_contract import canonical

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'rollback-journal-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='rollback-',dir=FIXTURES)).resolve()


def database(page_size=4096):
    target=directory()/'dev.db'
    db=sqlite3.connect(target);db.execute('PRAGMA page_size='+str(page_size))
    db.execute('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB)')
    db.executemany('INSERT INTO payload(value) VALUES(?)',[(bytes(8192),)]*8)
    db.commit();db.close();return target


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


class RollbackJournal(unittest.TestCase):
    def test_conditional_bound_rejects_ambiguous_or_unbounded_geometry(self):
        for pages,size in [(True,4096),(0,4096),(-1,4096),(4294967295,4096),(1,True),(1,511),(1,513),(1,131072)]:
            with self.subTest(pages=pages,size=size),self.assertRaises(RuntimeError):journal.rollback_journal_bound(pages,size)
        for size in (512,4096,65536):
            value=journal.rollback_journal_bound(17,size)
            self.assertGreater(value['maximumJournalBytes'],17*size)
            self.assertEqual(value['maximumSectorBytes'],65536)
            self.assertEqual(value['maximumPageRecords'],17)

    def test_real_local_database_profiles_are_read_without_sql_or_byte_changes(self):
        for size in (512,4096,65536):
            with self.subTest(page_size=size):
                target=database(size);before=digest(target)
                pathlib.Path(str(target)+'-wal').touch();pathlib.Path(str(target)+'-shm').touch()
                with patch('sqlite3.connect',side_effect=AssertionError('Planner must not open SQLite')):
                    plan=journal.rollback_journal_plan(target)
                self.assertEqual(plan['bound']['pageSize'],size)
                self.assertEqual(plan['bound']['originalPages'],target.stat().st_size//size)
                self.assertEqual(plan['layout']['fileCount'],1)
                self.assertFalse(plan['writerGraphAdmissionImplemented'])
                self.assertFalse(plan['physicalFilesystemClosureClaimed'])
                self.assertEqual(digest(target),before)
                self.assertFalse(pathlib.Path(plan['journal']).exists())

    def test_wal_autovacuum_stale_page_counts_and_unknown_headers_refuse(self):
        cases=[(18,b'\x02\x02'),(52,(3).to_bytes(4,'big')),(64,(1).to_bytes(4,'big')),
            (28,(999).to_bytes(4,'big')),(92,bytes(4)),(16,(513).to_bytes(2,'big')),(0,b'Other format')]
        for offset,raw in cases:
            with self.subTest(offset=offset):
                target=database()
                with target.open('r+b') as stream:stream.seek(offset);stream.write(raw)
                with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)
        for suffix in ('-wal','-shm'):
            target=database();pathlib.Path(str(target)+suffix).write_bytes(b'x')
            with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)

    def test_journal_file_hardlink_and_dangling_alias_refuse(self):
        target=database();pathlib.Path(str(target)+'-journal').touch()
        with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)
        target=database();os.link(target,target.parent/'foreign-hardlink')
        with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)
        target=database();os.link(target,pathlib.Path(str(target)+'-wal'))
        with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)
        # Explicit alias stand-in avoids assuming Windows symlink privileges.
        target=database();real=pathlib.Path.is_symlink
        with patch.object(pathlib.Path,'is_symlink',lambda p:p==pathlib.Path(str(target)+'-journal') or real(p)):
            with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)

    def test_changed_source_after_header_read_is_retained_and_refused(self):
        target=database();before=digest(target);real=os.read
        def changed(fd,count):
            raw=real(fd,count)
            with target.open('r+b') as stream:stream.seek(120);stream.write(b'changed!')
            return raw
        with patch.object(journal.os,'read',changed):
            with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)
        self.assertNotEqual(digest(target),before)
        self.assertFalse(pathlib.Path(str(target)+'-journal').exists())

    def test_actual_native_spill_repeat_writes_and_rollback_keep_full_sampled_journals(self):
        node=shutil.which('node');self.assertIsNotNone(node)
        application=HERE.parents[1]/'server'
        create=r"""const Database=require('better-sqlite3');const db=new Database(process.argv[1]);
        db.pragma('page_size='+process.argv[2]);db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB)');
        const insert=db.prepare('INSERT INTO payload(value) VALUES(?)');
        db.transaction(()=>{for(let i=0;i<128;i++)insert.run(Buffer.alloc(8192,65));})();db.close();"""
        update=r"""const fs=require('node:fs'),Database=require('better-sqlite3');
        const target=process.argv[1],mode=process.argv[2],db=new Database(target,{fileMustExist:true});
        // New LOCAL test fixture only. Installer/candidate settings are unchanged.
        db.pragma('cache_size=4');const rows=db.prepare('SELECT id FROM payload ORDER BY id').all();
        const write=db.prepare('UPDATE payload SET value=? WHERE id=?'),samples=[];
        const sample=()=>samples.push(fs.statSync(target+'-journal').size);
        let refused=false;
        try{db.transaction(()=>{for(const fill of [66,67])for(const row of rows){
          write.run(Buffer.alloc(8192,fill),row.id);sample();
        }
        fs.writeFileSync(target+'.'+mode+'.journal-sampled-original.bin',fs.readFileSync(target+'-journal'));
        if(mode==='rollback')throw new Error('LOCAL_ROLLBACK_TEST');
        }).immediate();}catch(error){if(error.message!=='LOCAL_ROLLBACK_TEST')throw error;refused=true;}
        const value={mode,refused,samples,maximumSampledJournalBytes:Math.max(...samples),
          version:db.prepare('SELECT sqlite_version() v').get().v,
          sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,
          journalMode:db.pragma('journal_mode',{simple:true}),pageSize:db.pragma('page_size',{simple:true}),
          rows:db.prepare('SELECT count(*) n FROM payload').get().n,
          values:db.prepare('SELECT DISTINCT hex(substr(value,1,1)) v FROM payload').all(),
          platform:process.platform,linuxVfsTested:process.platform==='linux',
          continuousPeakMeasured:false,completeLifetimeJournalOriginalsRetained:false,
          applicationInstallerExecuted:false,physicalFilesystemClosureClaimed:false};db.close();
        process.stdout.write(JSON.stringify(value));"""
        expected='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
        for size in (512,4096,65536):
            target=directory()/'dev.db'
            made=subprocess.run([node,'-e',create,str(target),str(size)],cwd=application,capture_output=True)
            (target.parent/'create.stdout-original').write_bytes(made.stdout)
            (target.parent/'create.stderr-original').write_bytes(made.stderr)
            self.assertEqual(made.returncode,0,made.stderr.decode(errors='replace'))
            for mode in ('commit','rollback'):
                plan=journal.rollback_journal_plan(target)
                (target.parent/(mode+'.conditional-plan.json')).write_bytes(canonical(plan))
                before=digest(target)
                run=subprocess.run([node,'-e',update,str(target),mode],cwd=application,capture_output=True)
                (target.parent/(mode+'.stdout-original')).write_bytes(run.stdout)
                (target.parent/(mode+'.stderr-original')).write_bytes(run.stderr)
                self.assertEqual(run.returncode,0,run.stderr.decode(errors='replace'))
                self.assertEqual(run.stderr,b'');observed=json.loads(run.stdout)
                self.assertEqual(observed['version'],'3.51.2');self.assertEqual(observed['sourceId'],expected)
                self.assertEqual(observed['journalMode'],'delete');self.assertEqual(observed['rows'],128)
                self.assertEqual(observed['values'],[{'v':'43'}])
                self.assertEqual(observed['refused'],mode=='rollback')
                self.assertGreater(observed['maximumSampledJournalBytes'],1024*1024)
                self.assertLessEqual(observed['maximumSampledJournalBytes'],plan['bound']['maximumJournalBytes'])
                retained=pathlib.Path(str(target)+'.'+mode+'.journal-sampled-original.bin')
                self.assertGreater(retained.stat().st_size,0)
                self.assertLessEqual(retained.stat().st_size,plan['bound']['maximumJournalBytes'])
                self.assertFalse(pathlib.Path(str(target)+'-journal').exists())
                if mode=='rollback':self.assertEqual(digest(target),before)
                else:self.assertNotEqual(digest(target),before)

    def test_plan_cannot_turn_file_geometry_into_writer_or_caller_authority(self):
        target=database();plan=journal.rollback_journal_plan(target)
        self.assertTrue(plan['requiresNoPageMoves'])
        self.assertTrue(plan['requiresNoContinuingWritesAfterRollbackOrSqliteError'])
        self.assertTrue(plan['requiresPinnedNativeVfsAndCompleteCallerReview'])
        self.assertFalse(plan['writerGraphAdmissionImplemented'])
        self.assertFalse(plan['statementOrSqlScratchBounded'])
        self.assertFalse(plan['walGrowthBounded'])
        self.assertFalse(plan['mainDatabaseGrowthBounded'])
        # A sparse file costs few blocks yet can imply a much larger journal.
        # The bounded layout refuses instead of silently clipping that reserve.
        with patch.object(journal,'rollback_journal_bound',return_value={'maximumJournalBytes':32*1024**3+1}):
            with self.assertRaises(RuntimeError):journal.rollback_journal_plan(target)
        self.assertFalse(pathlib.Path(str(target)+'-journal').exists())

    def test_full_native_source_excerpts_and_unclosed_scope_are_explicit(self):
        proof=json.loads((HERE/'rollback-journal-source.json').read_bytes());row=proof['nativeSource']
        raw=(HERE.parents[1]/row['path']).read_bytes();self.assertEqual(digest(HERE.parents[1]/row['path']),row['sha256'])
        self.assertEqual(len(raw),row['bytes']);lines=raw.decode().splitlines(keepends=True)
        for excerpt in row['excerpts'].values():
            self.assertEqual(excerpt['text'],''.join(lines[excerpt['firstLine']-1:excerpt['lastLine']]))
        self.assertEqual(proof['nativePackageProofSha256'],digest(HERE/'live-backup-sqlite-source.json'))
        for key in ('writerGraphAdmissionImplemented','completeCallerReviewCompleted','productionProfileObserved',
            'scientificArgvChanged','sqlPragmaChanged','journalModeChanged','installerTransactionChanged',
            'writerLimitDeadlineSignalOrQuotaAdded','completeOriginalJournalBytesRetained',
            'physicalFilesystemClosureClaimed','operationalExecutionPerformed'):
            self.assertIs(proof[key],False)
        self.assertIn('page-move-exception',row['excerpts'])


if __name__=='__main__':unittest.main()
