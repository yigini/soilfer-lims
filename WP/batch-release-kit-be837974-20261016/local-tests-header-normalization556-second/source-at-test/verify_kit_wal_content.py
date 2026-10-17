"""WAL source/content tests; NEW LOCAL files and native SQL fixtures only."""
import copy
import io
import json
import os
import pathlib
import shutil
import sqlite3
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_wal_content as wal
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'wal-content-local-retained-fixtures'
SOURCE_ID='2026-01-09 17:27:48 b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='wal-',dir=FIXTURES)).resolve()


def inventory(entries=16,sets=4,commits=1):
    return wal.declared_frames(entries,sets,commits,'c'*64)


def binary_wal(size=4096,big=False,frames=3,commit=True):
    header=struct.pack('>6I',0x377f0682+int(big),3007000,size,0,11,22)
    sums=wal.checksum(header,big);result=header+struct.pack('>2I',*sums)
    for n in range(frames):
        first=struct.pack('>2I',n+1,8 if commit and n==frames-1 else 0)
        data=bytes([65+n])*size;sums=wal.checksum(first,big,sums);sums=wal.checksum(data,big,sums)
        result+=first+header[16:24]+struct.pack('>2I',*sums)+data
    return result


def observed_fixture():
    root=directory();source=root/'new-source.db';target=root/'new-observation/dev.db';target.parent.mkdir()
    db=sqlite3.connect(source)
    try:
        db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA wal_autocheckpoint=0')
        db.execute('CREATE TABLE payload(id INTEGER PRIMARY KEY,value TEXT)')
        db.execute("INSERT INTO payload VALUES(1,'NEW LOCAL NATIVE PYTHON FIXTURE')");db.commit()
        shutil.copyfile(source,target);shutil.copyfile(str(source)+'-wal',str(target)+'-wal')
    finally:db.close()
    return root,target


class WalContent(unittest.TestCase):
    def test_full_pinned_native_sources_exact_excerpts_and_no_application_inventory_authority(self):
        raw=(HERE/wal.PROOF_NAME).read_bytes();proof=json.loads(raw)
        self.assertEqual(wal.source_proof(),sha(raw));source=(ROOT/proof['nativeSource']['path']).read_bytes()
        self.assertEqual(sha(source),proof['nativeSource']['sha256'])
        for row in proof['nativeExcerpts']:
            self.assertEqual(source[row['startByte']:row['endByte']].decode(),row['text'],row['label'])
        self.assertGreaterEqual(len(proof['nativeExcerpts']),16)
        self.assertFalse(proof['completeApplicationFrameInventory']);self.assertFalse(proof['writerGraphAdmissionImplemented'])
        self.assertFalse(proof['walFileLengthOrVfsPreallocationBounded'])
        self.assertIn('sqlite3SectorSize(pWal->pWalFd)',next(r['text'] for r in proof['nativeExcerpts'] if r['label']=='commit_padding'))
        self.assertIn('pWal->pDbFd',next(r['text'] for r in proof['nativeExcerpts'] if r['label']=='checkpoint_main_writes'))

    def test_all_eight_page_sizes_full_sector_padding_and_no_overwrite_restart_truncate_credit(self):
        for size in (512,1024,2048,4096,8192,16384,32768,65536):
            frame=size+24
            for initial in (0,32,32+7*frame):
                bound=wal.wal_content_bound(size,initial,inventory())
                padding=(65535+frame-1)//frame
                self.assertEqual(bound['frameBytes'],frame);self.assertEqual(bound['maximumPaddingFramesPerCommit'],padding)
                self.assertEqual(bound['maximumWalLogicalContentBytes'],32+(max(0,initial-32)//frame+16+padding)*frame)
                self.assertEqual(bound['overwriteRestartTruncateRollbackCreditBytes'],0)
                for sector in (32,512,4096,12345,32768,65536):
                    for frames in (1,2,17,128,511):
                        end=32+frames*frame;gap=(-end)%sector
                        self.assertLessEqual((gap+frame-1)//frame,padding)
                self.assertFalse(bound['mainCheckpointGrowthBounded']);self.assertFalse(bound['shmWriterGrowthBounded'])
                self.assertFalse(bound['runtimeDefaultVfsVerified']);self.assertFalse(bound['callerReviewVerified'])
        zero=wal.wal_content_bound(4096,0,inventory(0,0,0));self.assertEqual(zero['maximumWalLogicalContentBytes'],0)

    def test_strict_native_inventory_types_sql_substitutions_error_continuation_and_oversize_refuse(self):
        valid=inventory()
        for key,value in [('version',True),('maximumPageFrameEntries',True),('maximumFrameSets',0),
            ('maximumCommitFrameSets',2),('maximumFrameSets',17),('oneWalWriterHandle',False),
            ('oneForwardTransaction',False),('continuedWritingAfterRollbackOrSqlError',True),
            ('sqlStatements',16),('scope','DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS')]:
            row=dict(valid);row[key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):wal.wal_content_bound(4096,0,row)
        for size in (True,0,511,513,131072):
            with self.subTest(size=size),self.assertRaises(RuntimeError):wal.wal_content_bound(size,0,valid)
        for initial in (True,-1,1,31,33,33+4096+24):
            with self.subTest(initial=initial),self.assertRaises(RuntimeError):wal.wal_content_bound(4096,initial,valid)
        with self.assertRaisesRegex(RuntimeError,'never clip'):
            wal.wal_content_bound(65536,0,inventory(1000000000,1000000000,1))

    def test_both_checksum_byte_orders_complete_frames_and_every_bad_or_uncommitted_tail_refuse(self):
        for size in (512,4096,65536):
            for big in (False,True):
                raw=binary_wal(size,big);value=wal.wal_bytes_profile(raw,size)
                self.assertEqual(value['physicalFrames'],3);self.assertEqual(value['lastCommitFrame'],3)
                self.assertEqual(value['lastCommittedDatabasePages'],8);self.assertEqual(value['sha256'],sha(raw))
                for offset in (0,4,8,24,32+8,32+16,32+24):
                    damaged=bytearray(raw);damaged[offset]^=1
                    with self.subTest(size=size,big=big,offset=offset),self.assertRaises(RuntimeError):
                        wal.wal_bytes_profile(bytes(damaged),size)
                with self.assertRaises(RuntimeError):wal.wal_bytes_profile(raw+b'X',size)
                with self.assertRaises(RuntimeError):wal.wal_bytes_profile(binary_wal(size,big,3,False),size)
        with self.assertRaises(RuntimeError):wal.scan_wal(io.BytesIO(b'X'),0,4096)

    def test_actual_new_source_observation_and_recheck_use_descriptors_only_and_refuse_real_byte_mutation(self):
        root,target=observed_fixture();before={s:pathlib.Path(str(target)+s).read_bytes() for s in ('','-wal')}
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No observation target SQL')):
            plan=wal.wal_content_plan(target,inventory());wal.recheck_wal_content(plan)
        self.assertTrue(plan['sourceByteIdentityObserved']);self.assertFalse(plan['nativeRecoveredWalIndexObserved'])
        self.assertFalse(plan['mainHeaderPageCountIsCurrentWalDatabaseSize'])
        self.assertFalse(plan['independentHeaderToPrivateDbBytesProof']);self.assertFalse(plan['sourceQuiescenceVerified'])
        self.assertEqual(before,{s:pathlib.Path(str(target)+s).read_bytes() for s in ('','-wal')})
        with pathlib.Path(str(target)+'-wal').open('r+b') as stream:
            stream.seek(32+24);byte=stream.read(1);stream.seek(32+24);stream.write(bytes([byte[0]^1]))
        with self.assertRaises(RuntimeError):wal.recheck_wal_content(plan)
        # Tamper with a NEW owned fixture only. The old inode and every byte
        # remain retained under another name; this is not housekeeping.
        root,target=observed_fixture();plan=wal.wal_content_plan(target,inventory())
        require_root=root.resolve();self.assertEqual(target.resolve().parent,require_root/'new-observation')
        retained=root/'retained-original-main-inode.db';os.link(target,retained)
        replacement=root/'new-independent-main.db';shutil.copyfile(target,replacement)
        os.replace(replacement,target)
        self.assertEqual(target.read_bytes(),retained.read_bytes())
        self.assertNotEqual(target.stat().st_ino,retained.stat().st_ino)
        with self.assertRaisesRegex(RuntimeError,'changed'):wal.recheck_wal_content(plan)
        for fault in ('shm','journal','alias','rollback-header'):
            root,target=observed_fixture()
            if fault=='shm':pathlib.Path(str(target)+'-shm').write_bytes(b'FOREIGN INDEX')
            if fault=='journal':pathlib.Path(str(target)+'-journal').write_bytes(b'FOREIGN JOURNAL')
            if fault=='alias':os.link(target,str(target)+'-shm')
            if fault=='rollback-header':
                with target.open('r+b') as stream:stream.seek(18);stream.write(b'\1\1')
            with self.subTest(fault=fault),self.assertRaises(RuntimeError):wal.wal_content_plan(target,inventory())

    def test_new_complete_source_copy_detects_same_length_native_change_without_old_private_reads(self):
        root=directory();tooling=root/'WP'/HERE.name;tooling.mkdir(parents=True)
        proof=json.loads((HERE/wal.PROOF_NAME).read_bytes())
        for name in proof['files']:
            destination=root/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,destination)
        (tooling/wal.PROOF_NAME).write_bytes((HERE/wal.PROOF_NAME).read_bytes())
        with patch.object(wal,'__file__',str(tooling/'kit_wal_content.py')):
            self.assertEqual(wal.source_proof(),sha((tooling/wal.PROOF_NAME).read_bytes()))
            p=root/proof['nativeSource']['path'];raw=p.read_bytes();p.write_bytes(b'#'+raw[1:])
            with self.assertRaisesRegex(RuntimeError,'source changed'):wal.source_proof()

    def test_actual_pinned_native_wal_commits_rollbacks_samples_and_initial_full_checksums(self):
        program=r"""const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const [target,p,mode,baseline]=process.argv.slice(1),db=new Database(target),samples=[];
        const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
        db.pragma('page_size='+p);db.pragma('journal_mode=WAL');
        // TEST ONLY settings; no application command or default is changed.
        db.pragma('wal_autocheckpoint=0');db.pragma('cache_size=4');db.pragma('synchronous=FULL');
        db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value BLOB)');
        const add=db.prepare('INSERT INTO payload VALUES(?,?)');
        db.transaction(()=>{for(let i=0;i<96;i++)add.run(i,Buffer.alloc(8192,65));}).immediate();
        fs.mkdirSync(baseline);fs.copyFileSync(target,path.join(baseline,'dev.db'));
        fs.copyFileSync(target+'-wal',path.join(baseline,'dev.db-wal'));
        const initialWal=fs.readFileSync(target+'-wal'),initialMain=fs.readFileSync(target);
        process.stdout.write(JSON.stringify({phase:'BEFORE_FORWARD_TRANSACTION',walBytes:initialWal.length,
          walSha256:hash(initialWal),mainSha256:hash(initialMain),version:db.prepare('SELECT sqlite_version() v').get().v,
          sourceId:db.prepare('SELECT sqlite_source_id() v').get().v})+'\n');
        if(fs.readFileSync(0,'utf8')!=='GO')throw Error('LOCAL parent refused before update');
        const write=db.prepare('UPDATE payload SET value=? WHERE id=?');let rolled=false;
        try{db.transaction(()=>{for(let pass=0;pass<2;pass++)for(let i=0;i<96;i++){
          const data=Buffer.alloc(8192,66+pass);data.writeUInt32LE(i);write.run(data,i);
          samples.push(fs.statSync(target+'-wal').size);
        }if(mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();}
        catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;rolled=true;}
        const finalWal=fs.readFileSync(target+'-wal');fs.writeFileSync(target+'.wal-after-original',finalWal);
        const value={phase:'AFTER_FORWARD_TRANSACTION',samples,rolled,walBytes:finalWal.length,
          committedPrefixPreserved:hash(finalWal.subarray(0,initialWal.length))===hash(initialWal),
          mainBytesUnchanged:hash(fs.readFileSync(target))===hash(initialMain),
          firstByte:db.prepare('SELECT value FROM payload WHERE id=0').get().value[4],
          integrity:db.pragma('integrity_check',{simple:true}),platform:process.platform,
          nativeFrameRequestInventoryMeasured:false,continuousPeakMeasured:false,
          fullLifetimeOriginalsRetained:false,physicalFilesystemClosureClaimed:false};
        db.close();process.stdout.write(JSON.stringify(value)+'\n');"""
        for size in (512,4096,65536):
            for mode in ('rollback','commit'):
                root=directory();target=root/'native.db';baseline=root/'baseline'
                command=[shutil.which('node'),'-e',program,str(target),str(size),mode,str(baseline)]
                (root/'native-program.cjs').write_text(program,encoding='utf-8')
                (root/'native-command.json').write_bytes(canonical(command)+b'\n')
                child=subprocess.Popen(command,cwd=ROOT/'server',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                first=child.stdout.readline()
                try:
                    initial=json.loads(first);self.assertEqual(initial['version'],'3.51.2');self.assertEqual(initial['sourceId'],SOURCE_ID)
                    # This is a generous DECLARATION, not measured native call
                    # inventory or a complete application caller review.
                    with patch.object(sqlite3,'connect',side_effect=AssertionError('No observed target SQL')):
                        plan=wal.wal_content_plan(baseline/'dev.db',inventory(4096,4096,1))
                    (root/'conditional-plan.json').write_bytes(canonical(plan)+b'\n')
                except BaseException:
                    out,err=child.communicate(input=b'REFUSE')
                    (root/'stdout-original.jsonl').write_bytes(first+out);(root/'stderr-original.txt').write_bytes(err)
                    raise
                out,err=child.communicate(input=b'GO')
                (root/'stdout-original.jsonl').write_bytes(first+out);(root/'stderr-original.txt').write_bytes(err)
                self.assertEqual(child.returncode,0,err.decode(errors='replace'));self.assertEqual(err,b'')
                final=json.loads(out);self.assertEqual(len(final['samples']),192)
                self.assertTrue(final['mainBytesUnchanged']);self.assertEqual(final['integrity'],'ok')
                self.assertEqual(final['rolled'],mode=='rollback');self.assertEqual(final['firstByte'],65 if mode=='rollback' else 67)
                self.assertEqual(plan['walObservation']['sha256'],initial['walSha256'])
                self.assertGreater(plan['walObservation']['lastCommittedDatabasePages'],plan['mainPhysicalPages'])
                for sample in final['samples']+[final['walBytes']]:
                    self.assertLessEqual(sample,plan['bound']['maximumWalLogicalContentBytes'])
                self.assertGreater(max(final['samples']),initial['walBytes'])
                if mode=='commit':
                    observed=wal.wal_bytes_profile((root/'native.db.wal-after-original').read_bytes(),size)
                    self.assertEqual(observed['lastCommitFrame'],observed['physicalFrames'])
                else:self.assertTrue(final['committedPrefixPreserved'])
                self.assertFalse(final['nativeFrameRequestInventoryMeasured']);self.assertFalse(final['continuousPeakMeasured'])
