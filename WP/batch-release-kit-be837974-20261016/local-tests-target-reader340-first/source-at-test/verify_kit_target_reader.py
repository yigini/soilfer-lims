"""Native LOCAL readonly target-index tests; no production database or Docker."""
import copy
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch
import retained_files
import kit_owned
from kit_target_reader import target_reader_plan,close_target_reader,TARGET_READER_SITES
from kit_owned import cli_spec,control_callbacks
from kit_integrity import DATA_MOUNT
from kit_budget import Budget,TABLE,COPY_ADMISSION_SITES
from kit_disk import Disk
from kit_evidence import EvidenceLedger

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'target-reader-local-retained-fixtures'
HEAD='be8379745bdfae52ce46496ff26514dc7d729640'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()


def specification(root,label='206-dry'):
    database=root/'clone';database.mkdir()
    (database/'dev.db').write_bytes(b'm'*4096)
    (database/'dev.db-wal').write_bytes(b'w'*(32+4063*536))
    spec=cli_spec(label,DATA_MOUNT)
    spec['mounts'][0]['Source']=database.as_posix()
    spec['tmp']=(root/(label+'-retained-temp')).as_posix()
    return spec


class TargetReader(unittest.TestCase):
    def test_linux_mapping_page_refuses_unknown_large_boolean_or_nonpower_before_source_read(self):
        root=directory();spec=specification(root)
        for page in (None,True,0,-1,24576,65536,131072):
            with patch.object(retained_files,'os',types.SimpleNamespace(name='posix',sysconf=lambda name:page)):
                with self.assertRaisesRegex(RuntimeError,'system pages'):target_reader_plan(spec)
        for page in (4096,16384,32768):
            with patch.object(retained_files,'os',types.SimpleNamespace(name='posix',sysconf=lambda name:page)):
                self.assertEqual(target_reader_plan(spec)['mappingPrecondition']['systemPageBytes'],page)

    def test_only_exact_two_dry_commands_and_independent_existing_clones_are_admitted(self):
        root=directory();spec=specification(root)
        self.assertEqual(target_reader_plan(spec)['maximumIndexBytes'],65536)
        for mutation in ('apply','repeat','capture','readonly','argv','journal','hardlink'):
            root=directory();spec=specification(root)
            changed=copy.deepcopy(spec)
            if mutation=='apply':changed['label']='206-apply'
            elif mutation=='repeat':changed['label']='206-repeat'
            elif mutation=='capture':changed['label']='capture-206-prepare'
            elif mutation=='readonly':changed['mounts'][0]['RW']=False
            elif mutation=='argv':changed['child'][-1]='--apply'
            elif mutation=='journal':(root/'clone/dev.db-journal').write_bytes(b'')
            else:os.link(root/'clone/dev.db',root/'alias.db')
            with self.assertRaises(RuntimeError):target_reader_plan(changed)

    def test_capacity_writer_or_changed_source_refuses_before_temporary_directory(self):
        for failure in ('capacity','writer','source'):
            root=directory();spec=specification(root);events=[]
            class HeldDisk:
                def admit_copy(self,site,dest,plan):
                    events.append('admit')
                    if failure=='capacity':raise RuntimeError('LOCAL capacity refusal')
            def writers():
                events.append('writers')
                if failure=='writer':raise RuntimeError('LOCAL writer refusal')
                if failure=='source' and events.count('writers')==2:
                    (root/'clone/dev.db').write_bytes(b'changed')
            with patch('kit_evidence._runtime',EvidenceLedger(root)):
                prepare,_,_=control_callbacks(root,lambda value:pathlib.Path(spec['tmp']),False,HeldDisk(),writers,{}, {},None,())
                with self.assertRaises(RuntimeError):prepare(spec)
            self.assertFalse(pathlib.Path(spec['tmp']).exists())
            if failure=='writer':self.assertEqual(events,['writers'])

    def test_closed_child_main_wal_index_journal_alias_and_extra_entry_checks(self):
        for mutation in ('none','main','wal','index','journal','extra','replace-main'):
            root=directory();spec=specification(root);plan=target_reader_plan(spec)
            db=root/'clone'
            if mutation=='main':(db/'dev.db').write_bytes(b'changed')
            elif mutation=='wal':(db/'dev.db-wal').write_bytes(b'changed')
            elif mutation=='index':(db/'dev.db-shm').write_bytes(b'x'*(plan['maximumIndexBytes']+1))
            elif mutation=='journal':(db/'dev.db-journal').write_bytes(b'')
            elif mutation=='extra':(db/'foreign').mkdir()
            elif mutation=='replace-main':
                (db/'dev.db').rename(db/'old.db');shutil.copyfile(db/'old.db',db/'dev.db');(db/'old.db').rename(root/'old.db')
            else:(db/'dev.db-shm').write_bytes(b'x'*32768)
            if mutation=='none':
                result=close_target_reader(plan)
                self.assertTrue(result['mainAndWalUnchanged']);self.assertFalse(result['sqlTemporaryFilesBounded'])
            else:
                with self.assertRaises(RuntimeError):close_target_reader(plan)
        root=directory();spec=specification(root);(root/'clone/dev.db-wal').rename(root/'old-wal')
        plan=target_reader_plan(spec);(root/'clone/dev.db-wal').write_bytes(b'')
        self.assertTrue(close_target_reader(plan)['mainAndWalUnchanged'])

    def test_real_budget_admission_control_pair_and_single_closed_child_boundary(self):
        root=directory();spec=specification(root);budget=Budget(8*1024**2,0,1)
        for row in TABLE[:2]:
            budget.begin(row['stage'],10**12)
            for site,count in row['sites'].items():
                for _ in range(count):
                    budget.claim(site)
                    if site in COPY_ADMISSION_SITES:budget.copy_ceiling(site)
            budget.finish(row['stage'],0)
        budget.begin('issue-206',10**12);budget.cli('206-dry')
        disk=Disk(root,None,None,budget,False);disk.check=lambda *args:None
        events=[]
        with patch('kit_evidence._runtime',EvidenceLedger(root)):
            prepare,read,_=control_callbacks(root,lambda value:pathlib.Path(spec['tmp']),False,disk,
                lambda:events.append('writers'),{}, {},None,())
            prepare(spec);temp=pathlib.Path(spec['tmp'])
            self.assertEqual(events,['writers','writers']);self.assertIsNone(read(spec))
            admission=json.loads((temp/'target-reader-admission.json').read_bytes())
            self.assertEqual(admission['layout']['fileCount'],2)
            (root/'clone/dev.db-shm').write_bytes(b'x'*32768)
            (temp/'cli-child-complete.json').write_bytes(b'{}')
            self.assertEqual(read(spec),b'{}');self.assertEqual(read(spec),b'{}')
            self.assertTrue(json.loads((temp/'target-reader-closure.json').read_bytes())['mainAndWalUnchanged'])
            with self.assertRaises(RuntimeError):prepare(spec)
        for site,count in TABLE[2]['sites'].items():
            for _ in range(count-budget.claims[site]):
                budget.claim(site)
                if site in COPY_ADMISSION_SITES:budget.copy_ceiling(site)
        budget.finish('issue-206',0)

    def test_native_exact_pinned206_dry_reader_recovers_missing_index_without_writer(self):
        root=directory();app=root/'app';db=root/'clone';db.mkdir()
        names=['server/scripts/install_sample_containers.js','server/services/sampleContainerMigrationSource.js',
            'server/prisma/migrations/20261013000100_sample_containers/migration.sql']
        for name in names:
            p=app/name;p.parent.mkdir(parents=True,exist_ok=True)
            p.write_bytes(subprocess.check_output(['git','show',HEAD+':'+name],cwd=HERE.parents[1]))
        node=shutil.which('node');self.assertIsNotNone(node)
        environment=dict(os.environ,NODE_PATH=str(HERE.parents[1]/'server/node_modules'),NODE_OPTIONS='')
        source=db/'dev.db'
        create=r'''const fs=require('node:fs'),D=require('better-sqlite3'),p=process.argv[1],db=new D(p);
db.pragma('journal_mode=WAL');db.pragma('wal_autocheckpoint=0');
db.exec('CREATE TABLE Sample(id TEXT PRIMARY KEY);CREATE TABLE WorkItem(id TEXT PRIMARY KEY);CREATE TABLE EquipmentAsset(id TEXT PRIMARY KEY);CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,aliquotId TEXT);CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT);CREATE TABLE retained(value BLOB)');
db.prepare('INSERT INTO retained VALUES(?)').run(Buffer.alloc(1024*1024,29));
const raw=['','-wal'].map(s=>fs.readFileSync(p+s));const native={version:db.prepare('select sqlite_version() v').get().v,source:db.prepare('select sqlite_source_id() v').get().v};
db.close();['','-wal'].forEach((s,i)=>fs.writeFileSync(p+s,raw[i]));if(fs.existsSync(p+'-shm'))throw Error('LOCAL setup did not close its index');console.log(JSON.stringify(native));'''
        r=subprocess.run([node,'-e',create,str(source)],env=environment,capture_output=True,timeout=20)
        (root/'create.stdout').write_bytes(r.stdout);(root/'create.stderr').write_bytes(r.stderr)
        self.assertEqual(r.returncode,0,r.stderr.decode(errors='replace'))
        native=json.loads(r.stdout);proof=json.loads((HERE/'live-backup-sqlite-source.json').read_bytes())
        self.assertEqual(native,{'version':proof['sqliteVersion'],'source':proof['sqliteSourceId']})
        spec=cli_spec('206-dry',DATA_MOUNT);spec['mounts'][0]['Source']=db.as_posix()
        plan=target_reader_plan(spec)
        r=subprocess.run([node,str(app/names[0]),'--db',str(source),'--dry-run'],env=environment,capture_output=True,timeout=20)
        (root/'dry.stdout').write_bytes(r.stdout);(root/'dry.stderr').write_bytes(r.stderr)
        self.assertEqual(r.returncode,0,r.stderr.decode(errors='replace'))
        result=json.loads(r.stdout);self.assertEqual(result['mode'],'DRY_RUN');self.assertEqual(result['totalChanges'],0)
        closure=close_target_reader(plan);self.assertTrue(closure['mainAndWalUnchanged'])
        (root/'plan.json').write_text(json.dumps(plan,sort_keys=True));(root/'closure.json').write_text(json.dumps(closure,sort_keys=True))

    def test_actual_application_native_source_excerpts_and_scope_are_bound(self):
        proof=json.loads((HERE/'target-reader-index-source.json').read_bytes())
        for name,pin in proof['files'].items():
            raw=subprocess.check_output(['git','show',HEAD+':'+name],cwd=HERE.parents[1])
            self.assertEqual(hashlib.sha256(raw).hexdigest(),pin['sha256']);self.assertEqual(len(raw),pin['bytes'])
        raw=(HERE.parents[1]/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),proof['nativeSqliteSourceSha256'])
        lines=raw.decode().splitlines(keepends=True)
        for row in proof['nativeSourceExcerpts']:
            self.assertEqual(''.join(lines[row['firstLine']-1:row['lastLine']]),row['text'])
        self.assertEqual(hashlib.sha256((HERE/proof['nativeSqliteSourceProof']).read_bytes()).hexdigest(),proof['nativeSqliteSourceProofSha256'])
        self.assertFalse(proof['sqlScratchFilesClosed']);self.assertFalse(proof['applyAndRepeatTargetReadersClosed'])
