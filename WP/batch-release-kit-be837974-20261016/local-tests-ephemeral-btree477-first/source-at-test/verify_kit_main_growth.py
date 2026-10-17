"""Conditional arithmetic and real LOCAL native insertions, never an operator."""
import copy
import hashlib
import json
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_main_growth as growth
import kit_rollback_journal as rollback
from kit_contract import canonical

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'main-growth-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='main-',dir=FIXTURES)).resolve()


def operations(calls=1,payload=0,roots=0):
    return {'version':1,'scope':'DECLARED_NATIVE_BTREE_INSERTIONS','callerReviewSha256':'a'*64,
        'createdRoots':roots,'insertions':[{'calls':calls,'maximumPayloadBytes':payload}] if calls else []}


def database(size=4096):
    target=directory()/'dev.db';db=sqlite3.connect(target)
    db.execute('PRAGMA page_size='+str(size));db.execute('CREATE TABLE original(id INTEGER PRIMARY KEY,v BLOB)')
    db.commit();db.close();return target


def digest(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


class MainGrowthTests(unittest.TestCase):
    def test_exact_operation_envelope_rejects_booleans_foreign_fields_and_sql_counts(self):
        valid=operations();self.assertIs(growth.counted_operations(valid),valid)
        invalid=[]
        for key,value in [('version',True),('createdRoots',True),('createdRoots',-1),
            ('scope','SQL_STATEMENTS'),('callerReviewSha256','reviewed'),('insertions',{})]:
            row=copy.deepcopy(valid);row[key]=value;invalid.append(row)
        for key,value in [('calls',True),('calls',0),('calls',1.0),('maximumPayloadBytes',False),
            ('maximumPayloadBytes',-1),('maximumPayloadBytes',2147483648),('sqlStatements',1)]:
            row=copy.deepcopy(valid);row['insertions'][0][key]=value;invalid.append(row)
        row=copy.deepcopy(valid);row['callerReviewVerified']=True;invalid.append(row)
        for row in invalid:
            with self.subTest(row=row):
                with self.assertRaises(RuntimeError):growth.counted_operations(row)

    def test_complete_payload_overflow_rounding_pending_gap_and_no_reuse_credit(self):
        target=database(512);raw=target.read_bytes();header=raw[:100]
        previous=None
        for payload,expected in [(0,0),(1,1),(508,1),(509,2),(1016,2),(1017,3)]:
            bound=growth.main_growth_bound(header,len(raw),operations(2,payload,3))
            self.assertEqual(bound['maximumOverflowAllocationCalls'],expected*2)
            self.assertEqual(bound['maximumAdditionalPages'],2*(3+2*107+2*expected))
            self.assertEqual(bound['maximumLogicalGrowthBytes'],bound['maximumAdditionalPages']*512)
            if previous is not None:self.assertGreaterEqual(bound['maximumLogicalMainBytes'],previous)
            previous=bound['maximumLogicalMainBytes']
        bound=growth.main_growth_bound(header,len(raw),operations(0))
        self.assertEqual(bound['maximumLogicalMainBytes'],len(raw))
        self.assertEqual(bound['maximumAdditionalPages'],0)

    def test_unsupported_header_geometry_and_oversized_complete_plan_refuse_without_clipping(self):
        target=database();raw=target.read_bytes()
        for offset,value in [(20,b'\x01'),(21,b'\x3f'),(22,b'\x21'),(23,b'\x1f'),
            (18,b'\x02\x02'),(52,(1).to_bytes(4,'big')),(64,(1).to_bytes(4,'big'))]:
            header=bytearray(raw[:100]);header[offset:offset+len(value)]=value
            with self.subTest(offset=offset):
                with self.assertRaises(RuntimeError):growth.main_growth_bound(bytes(header),len(raw),operations())
        with self.assertRaises(RuntimeError):growth.main_growth_bound(raw[:100],len(raw),operations(1000000,2147483647))
        with self.assertRaises(RuntimeError):growth.main_growth_bound(raw[:100],len(raw)+1,operations())

    def test_file_plan_is_pure_observation_and_cannot_grant_caller_or_writer_authority(self):
        target=database();before=digest(target);declared=operations(3,8192,2)
        # Planning never opens the retained target with a SQL connection.
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            plan=growth.main_growth_plan(target,declared)
        self.assertEqual(digest(target),before);self.assertFalse(pathlib.Path(str(target)+'-journal').exists())
        for key in ('callerReviewVerified','writerGraphAdmissionImplemented','mainFileLengthOrVfsPreallocationBounded',
            'walGrowthBounded','statementOrSqlScratchBounded','physicalFilesystemClosureClaimed'):
            self.assertIs(plan[key],False)
        self.assertIs(plan['requiresEveryTriggerAndIndexWriteCounted'],True)
        self.assertIs(plan['requiresNoPreformattedOrTransferredCells'],True)
        self.assertEqual(plan['layout']['contentBytes'],plan['bound']['maximumLogicalMainBytes'])
        self.assertFalse(plan['layout']['physicalFilesystemClosureClaimed'])
        declared['createdRoots']=999
        self.assertEqual(plan['declaredOperations']['createdRoots'],2)

    def test_full_source_mutation_existing_journal_and_foreign_sidecars_refuse(self):
        target=database();pathlib.Path(str(target)+'-journal').touch()
        with self.assertRaises(RuntimeError):growth.main_growth_plan(target,operations())
        for suffix in ('-wal','-shm'):
            target=database();pathlib.Path(str(target)+suffix).write_bytes(b'foreign')
            with self.assertRaises(RuntimeError):growth.main_growth_plan(target,operations())
        target=database();before=digest(target);real=rollback.os.read
        def changed(fd,count):
            raw=real(fd,count)
            with target.open('r+b') as stream:stream.seek(120);stream.write(b'changed!')
            return raw
        with patch.object(rollback.os,'read',changed):
            with self.assertRaises(RuntimeError):growth.main_growth_plan(target,operations())
        self.assertNotEqual(digest(target),before)

    def test_actual_pinned_native_table_and_index_overflow_insertions_commit_and_rollback(self):
        node=shutil.which('node');self.assertIsNotNone(node);application=HERE.parents[1]/'server'
        create=r"""const Database=require('better-sqlite3'),db=new Database(process.argv[1]);
        db.pragma('page_size='+process.argv[2]);
        db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB); CREATE INDEX payload_value ON payload(value)');
        db.prepare('INSERT INTO payload(value) VALUES(?)').run(Buffer.alloc(8192,65));db.close();"""
        insert=r"""const fs=require('node:fs'),Database=require('better-sqlite3');
        const db=new Database(process.argv[1],{fileMustExist:true}),mode=process.argv[2],samples=[];
        // TEST-ONLY small cache forces actual spills; application settings stay unchanged.
        db.pragma('cache_size=4');const write=db.prepare('INSERT INTO payload(value) VALUES(?)');let refused=false;
        try{db.transaction(()=>{for(let i=0;i<96;i++){
          const b=Buffer.alloc(8192,66);b.writeUInt32LE(i);write.run(b);
          samples.push({pages:db.pragma('page_count',{simple:true}),fileBytes:fs.statSync(process.argv[1]).size});
        }if(mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();}
        catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;refused=true;}
        const value={samples,refused,rows:db.prepare('SELECT count(*) n FROM payload').get().n,
          pages:db.pragma('page_count',{simple:true}),integrity:db.pragma('integrity_check',{simple:true}),
          version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,
          journalMode:db.pragma('journal_mode',{simple:true}),platform:process.platform,
          applicationInstallersExecuted:false,continuousPeakMeasured:false,physicalFilesystemClosureClaimed:false};
        db.close();process.stdout.write(JSON.stringify(value));"""
        expected='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'
        for size in (512,4096,65536):
            target=directory()/'dev.db'
            result=subprocess.run([node,'-e',create,str(target),str(size)],cwd=application,capture_output=True)
            (target.parent/'create.stdout-original').write_bytes(result.stdout)
            (target.parent/'create.stderr-original').write_bytes(result.stderr)
            self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'))
            for mode in ('rollback','commit'):
                # Each row has one ordinary table and one nonunique index key.
                # 200 bytes exceed both native record headers and integer keys.
                plan=growth.main_growth_plan(target,operations(96*2,8192+200))
                (target.parent/(mode+'.conditional-plan.json')).write_bytes(canonical(plan))
                before=digest(target)
                result=subprocess.run([node,'-e',insert,str(target),mode],cwd=application,capture_output=True)
                (target.parent/(mode+'.stdout-original')).write_bytes(result.stdout)
                (target.parent/(mode+'.stderr-original')).write_bytes(result.stderr)
                self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'));self.assertEqual(result.stderr,b'')
                observed=json.loads(result.stdout);bound=plan['bound']
                self.assertEqual(observed['version'],'3.51.2');self.assertEqual(observed['sourceId'],expected)
                self.assertEqual(observed['integrity'],'ok');self.assertEqual(observed['journalMode'],'delete')
                self.assertEqual(observed['rows'],1 if mode=='rollback' else 97)
                self.assertEqual(observed['refused'],mode=='rollback');self.assertEqual(len(observed['samples']),96)
                self.assertGreater(max(row['pages'] for row in observed['samples']),bound['originalPages'])
                for row in observed['samples']:
                    self.assertLessEqual(row['pages'],bound['maximumLogicalMainPages'])
                    self.assertLessEqual(row['fileBytes'],bound['maximumLogicalMainBytes'])
                if mode=='rollback':self.assertEqual(digest(target),before)
                else:self.assertNotEqual(digest(target),before)
                self.assertFalse(pathlib.Path(str(target)+'-journal').exists())

    def test_native_source_proof_exact_hashes_runtime_guards_and_unclosed_application_scope(self):
        proof=json.loads((HERE/'main-growth-source.json').read_bytes());row=proof['nativeSource']
        source=HERE.parents[1]/row['path'];raw=source.read_bytes();lines=raw.splitlines(keepends=True)
        self.assertEqual(len(raw),row['bytes']);self.assertEqual(hashlib.sha256(raw).hexdigest(),row['sha256'])
        for excerpt in proof['excerpts']:
            self.assertEqual(hashlib.sha256(b''.join(lines[excerpt['firstLine']-1:excerpt['lastLine']])).hexdigest(),excerpt['sha256'])
        self.assertEqual(proof['nativePackageProofSha256'],digest(HERE/'live-backup-sqlite-source.json'))
        self.assertIn(b'if( k>NB+2 ){ rc = SQLITE_CORRUPT_BKPT; goto balance_cleanup; }',raw)
        self.assertIn(b'if( pCur->iPage>=(BTCURSOR_MAX_DEPTH-1) )',raw)
        self.assertTrue(any('receipt-table triggers' in line for line in proof['derivation']))
        self.assertIs(proof['completeApplicationOperationInventory'],False)
        self.assertIs(proof['mainFileLengthOrVfsPreallocationBounded'],False)
        self.assertIs(proof['physicalFilesystemClosureClaimed'],False)
