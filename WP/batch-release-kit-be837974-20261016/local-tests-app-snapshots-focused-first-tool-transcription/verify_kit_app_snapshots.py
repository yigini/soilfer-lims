"""New LOCAL snapshots and an exact pinned policy owner, never production SQL."""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_owned
from kit_app_snapshots import snapshot_plan,index_bytes,verify_snapshots,unchanged_source
from kit_budget import Budget,TABLE,COPY_ADMISSION_SITES,DB_COST
from kit_disk import Disk
from kit_integrity import DATA_MOUNT
from kit_owned import cli_spec,filesystem_controls

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'application-snapshot-local-retained-fixtures'
HEAD='be8379745bdfae52ce46496ff26514dc7d729640'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


class ApplicationSnapshots(unittest.TestCase):
    def source(self,root):
        source=root/'dev.db';source.write_bytes(b'm'*4096)
        (root/'dev.db-wal').write_bytes(b'w'*(32+4063*536))
        return source

    def test_complete_nested_copy_layout_includes_both_indexes_entries_and_directories(self):
        root=directory();source=self.source(root);bound=snapshot_plan(source,2)
        self.assertEqual(bound['maximumIndexBytes'],65536)
        self.assertEqual(bound['layout']['fileCount'],6)
        self.assertEqual(bound['layout']['directoryCount'],2)
        self.assertFalse(bound['filesystemClosureClaimed'])
        self.assertFalse(bound['contentHardLimitEnforced'])
        self.assertFalse(bound['sqlTemporaryFilesBounded'])
        unchanged_source(source,bound)
        source.write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError,'changed'):unchanged_source(source,bound)
        for wal,existing,expected in [(32+4062*536,0,32768),(32+8159*536,0,98304),(0,100000,131072)]:
            self.assertEqual(index_bytes(wal,existing),expected)

    def test_alias_journal_missing_source_and_uncompiled_count_refuse(self):
        root=directory();source=self.source(root)
        with self.assertRaises(RuntimeError):snapshot_plan(root/'missing.db',1)
        for count in (0,3,True):
            with self.assertRaises(RuntimeError):snapshot_plan(source,count)
        (root/'dev.db-journal').write_bytes(b'')
        with self.assertRaisesRegex(RuntimeError,'journal'):snapshot_plan(source,1)

    def test_actual_source_files_still_match_the_new_scoped_proof(self):
        proof=json.loads((HERE/'application-snapshot-source.json').read_text())
        self.assertFalse(proof['candidateStartupClosed'])
        for name,row in proof['files'].items():
            raw=subprocess.check_output(['git','show',HEAD+':'+name],cwd=HERE.parents[1])
            self.assertEqual(len(raw),row['bytes']);self.assertEqual(hashlib.sha256(raw).hexdigest(),row['sha256'])
        self.assertEqual(hashlib.sha256((HERE/proof['nativeSqliteSourceProof']).read_bytes()).hexdigest(),proof['nativeSqliteSourceProofSha256'])

    def test_two_copy_site_uses_two_held_equivalents_and_admission_cannot_be_reused(self):
        budget=Budget(1024**2,0,414683521)
        for row in TABLE:
            budget.begin(row['stage'],10**12)
            if row['stage']=='order-impact':
                budget.cli('order-impact')
                self.assertEqual(budget.copy_ceiling('cli-order-impact'),2*1024**2*125//100)
                with self.assertRaisesRegex(RuntimeError,'reuse'):budget.copy_ceiling('cli-order-impact')
                break
            for site,count in row['sites'].items():
                for _ in range(count):
                    budget.claim(site)
                    if site in COPY_ADMISSION_SITES:budget.copy_ceiling(site)
            budget.finish(row['stage'],0)

    def test_missing_snapshot_admission_refuses_stage_closure(self):
        budget=Budget(1024**2,0,414683521)
        for row in TABLE:
            budget.begin(row['stage'],10**12)
            for site,count in row['sites'].items():
                for _ in range(count):
                    budget.claim(site)
                    if site in COPY_ADMISSION_SITES and site!='cli-policy':budget.copy_ceiling(site)
            if row['stage']=='canonical-policy':
                with self.assertRaisesRegex(RuntimeError,'before-create'):budget.finish(row['stage'],0)
                break
            budget.finish(row['stage'],0)

    def test_refusal_and_source_change_precede_cli_temporary_directory(self):
        for failure in ('capacity','writer','source'):
            root=directory();source=self.source(root);events=[]
            spec=cli_spec('canonical-policy',DATA_MOUNT);spec['tmp']=str(root/'canonical-policy-retained-temp')
            spec['mounts'][0]['Source']=str(root)
            class LocalDisk:
                def admit_copy(self,site,dest,plan):
                    events.append('admit')
                    self.site=site
                    if failure=='capacity':raise RuntimeError('LOCAL capacity refusal')
            def no_writers():
                events.append('writers')
                if failure=='writer':raise RuntimeError('LOCAL writer refusal')
                if failure=='source' and events.count('writers')==2:source.write_bytes(b'changed')
            with patch.object(kit_owned,'ROOT',root),patch.object(kit_owned,'validate_spec',lambda value:value),\
                patch.object(kit_owned,'admit_evidence',lambda *args,**kwargs:None):
                prepare,_,_=filesystem_controls(root,False,LocalDisk(),no_writers)
                with self.assertRaises(RuntimeError):prepare(spec)
            self.assertFalse(pathlib.Path(spec['tmp']).exists())
            if failure=='writer':self.assertEqual(events,['writers'])

    def test_stopped_child_snapshot_mutations_and_extra_directories_refuse(self):
        for mutation in ('none','main','wal','index','journal','count','directory'):
            root=directory();source=self.source(root);bound=snapshot_plan(source,1)
            temp=root/'temp';temp.mkdir();copy=temp/'lims-policy-schema-readonly-ABC123';copy.mkdir()
            for suffix in ('','-wal'):shutil.copyfile(str(source)+suffix,str(copy/'snapshot.db')+suffix)
            if mutation=='main':(copy/'snapshot.db').write_bytes(b'changed')
            if mutation=='wal':(copy/'snapshot.db-wal').write_bytes(b'changed')
            if mutation=='index':(copy/'snapshot.db-shm').write_bytes(b'x'*(bound['maximumIndexBytes']+1))
            if mutation=='journal':(copy/'snapshot.db-journal').write_bytes(b'')
            if mutation=='count':(temp/'lims-policy-schema-readonly-DEF456').mkdir()
            if mutation=='directory':(temp/'unexpected').mkdir()
            if mutation=='none':self.assertTrue(verify_snapshots(temp,bound)['mainWalSourceIdentityEqual'])
            else:
                with self.assertRaises(RuntimeError):verify_snapshots(temp,bound)

    def test_real_native_wal_and_exact_policy_owner_retain_both_nested_copies(self):
        root=directory();app=root/'app';temp=root/'temp';temp.mkdir()
        names=['server/scripts/install_lab_policy_schema.js','server/services/labPolicyMigrationSource.js',
            'server/prisma/migrations/20261004085500_add_lab_policy_settings/migration.sql']
        for name in names:
            raw=subprocess.check_output(['git','show',HEAD+':'+name],cwd=HERE.parents[1])
            p=app/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
        source=root/'dev.db';node=shutil.which('node');self.assertIsNotNone(node)
        environment=dict(os.environ,NODE_PATH=str(HERE.parents[1]/'server/node_modules'),TMPDIR=str(temp),TMP=str(temp),TEMP=str(temp))
        def run(code,label):
            r=subprocess.run([node,'-e',code,str(source),str(app)],env=environment,capture_output=True,timeout=20)
            (root/(label+'-stdout.txt')).write_bytes(r.stdout);(root/(label+'-stderr.txt')).write_bytes(r.stderr)
            self.assertEqual(r.returncode,0,r.stderr.decode(errors='replace'))
        run(r'''const fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
const target=process.argv[1],app=process.argv[2],db=new Database(target);
db.pragma('journal_mode=WAL');db.pragma('wal_autocheckpoint=0');
db.exec('CREATE TABLE Lab(id TEXT PRIMARY KEY); CREATE TABLE Report(id TEXT PRIMARY KEY); CREATE TABLE retained(value BLOB)');
db.exec(require(path.join(app,'server/services/labPolicyMigrationSource')).loadLabPolicyMigrationSource().sql);
db.prepare('INSERT INTO retained VALUES(?)').run(Buffer.alloc(1024*1024,17));
const raws=['','-wal','-shm'].map(s=>fs.readFileSync(target+s));db.close();
['','-wal','-shm'].forEach((s,i)=>fs.writeFileSync(target+s,raws[i]));''','create')
        bound=snapshot_plan(source,2)
        run(r'''const assert=require('node:assert/strict'),path=require('node:path');
const install=require(path.join(process.argv[2],'server/scripts/install_lab_policy_schema'));
const first=install.installLabPolicySchema({dbPath:process.argv[1]});
const second=install.installLabPolicySchema({dbPath:first.readonlySnapshot.path});
assert.equal(first.mode,'NO_OP');assert.equal(second.mode,'NO_OP');assert(first.readonlySnapshot.originalFilesPreserved);
console.log(JSON.stringify({first,second}));''','read')
        result=verify_snapshots(temp,bound);self.assertEqual(len(result['snapshots']),2)
        unchanged_source(source,bound)


if __name__=='__main__':unittest.main()
