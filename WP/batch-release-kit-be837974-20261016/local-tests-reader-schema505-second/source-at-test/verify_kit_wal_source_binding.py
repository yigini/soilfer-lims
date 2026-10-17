"""NEW LOCAL schema originals and pinned native recovered-index fixtures only."""
import copy
import json
import pathlib
import shutil
import sqlite3
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_wal_source_binding as binding
import kit_wal_content as wal
import retained_files as retained
import verify_kit_schema_collection as schema_tests
import verify_kit_wal_content as wal_tests
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'wal-binding-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='bind-',dir=FIXTURES)).resolve()


def synthetic(size=512,order='little',big=False,frames=7):
    header=struct.pack('>6I',0x377f0682+int(big),3007000,size,0,11,22)
    sums=wal.checksum(header,big);pieces=[header+struct.pack('>2I',*sums)];pages=[]
    for ordinal in range(frames):
        page=(1,8193,1,16385,17,17,33)[ordinal%7];pages.append(page)
        prefix=struct.pack('>2I',page,20000 if ordinal==frames-1 else 0);data=bytes([ordinal%251])*size
        sums=wal.checksum(data,big,wal.checksum(prefix,big,sums))
        pieces.append(prefix+header[16:24]+struct.pack('>2I',*sums)+data)
    raw=b''.join(pieces);regions=1+max(0,frames-4062+4095)//4096;index=bytearray(regions*32768)
    for region in range(regions):
        zero=0 if region==0 else 4062+(region-1)*4096;count=min(frames-zero,4062 if region==0 else 4096)
        begin=region*32768+(136 if region==0 else 0);hashes=[0]*8192
        for n in range(count):
            page=pages[zero+n];index[begin+n*4:begin+n*4+4]=page.to_bytes(4,order);slot=(page*383)&8191
            while hashes[slot]:slot=(slot+1)&8191
            hashes[slot]=n+1
        for slot,value in enumerate(hashes):
            start=region*32768+16384+slot*2;index[start:start+2]=value.to_bytes(2,order)
    h=bytearray(48)
    for offset,value,width in [(0,3007000,4),(14,1 if size==65536 else size,2),(16,frames,4),(20,20000,4),(24,sums[0],4),(28,sums[1],4)]:
        h[offset:offset+width]=value.to_bytes(width,order)
    h[12]=1;h[13]=int(big);h[32:40]=header[16:24]
    h[40:48]=b''.join(n.to_bytes(4,order) for n in wal.checksum(bytes(h[:40]),order=='big'))
    index[:96]=h*2
    for offset,value in [(100,0),(104,frames),(108,0xffffffff),(112,0xffffffff),(116,0xffffffff),(128,frames)]:
        index[offset:offset+4]=value.to_bytes(4,order)
    return raw,bytes(index)


def source_observation(label='206-apply',extra=''):
    root,live,db=schema_tests.fixture(extra,True)
    target=root/'stable/dev.db';target.parent.mkdir()
    shutil.copyfile(live,target);shutil.copyfile(str(live)+'-wal',str(target)+'-wal');db.close()
    seal={'206-apply':('fresh-production-snapshot','capture-schema-initial.json'),
        '214-apply':('capture-prepared-206','capture-schema-206.json')}[label]
    backup,state=retained.seal(root,seal[0],target,lambda:None,schema_original=seal[1])
    value=json.loads((root/seal[1]).read_bytes());raw=(root/seal[0]/'logical-state.json').read_bytes()
    return root,target,value,raw


class WalSourceBinding(unittest.TestCase):
    def test_full_source_and_native_header_recovery_hash_excerpts_with_explicit_no_runtime_authority(self):
        raw=(HERE/binding.PROOF).read_bytes();proof=json.loads(raw);self.assertEqual(binding.source_proof(),sha(raw))
        source=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:
            part=source[row['startByte']:row['endByte']];self.assertEqual(part.decode(),row['text'],row['label'])
            self.assertEqual(sha(part),row['sha256'])
        pieces={row['label']:row['text'] for row in proof['nativeExcerpts']}
        self.assertIn('WalIndexHdr',pieces['headers']);self.assertIn('nBackfillAttempted = pWal->hdr.mxFrame',pieces['recovery_checkpoint'])
        self.assertIn('walIndexAppend',pieces['recovery_frames']);self.assertIn('HASHTABLE_NPAGE',pieces['hash_constants'])
        for key in ('writerGraphAdmissionImplemented','nativeRecoveryExecutionVerified','runtimeBinaryToSourceBindingVerified'):
            self.assertIs(proof[key],False)

    def test_all_eight_page_sizes_both_native_orders_both_wal_checksum_orders_with_repeated_colliding_pages(self):
        for size in (512,1024,2048,4096,8192,16384,32768,65536):
            for order in ('little','big'):
                for big in (False,True):
                    raw,index=synthetic(size,order,big);result=binding.verify_fresh_index(raw,index,size,order)
                    self.assertEqual(result['mappedFrameEntries'],7);self.assertEqual(result['regions'],1)
                    self.assertTrue(result['fullMapsHashesAndUnusedBytesVerified']);self.assertFalse(result['nativeRecoveryExecutionVerified'])
                    self.assertFalse(result['nativeKernelLocksOrQuiescenceVerified']);self.assertFalse(result['walToMainSemanticAssociationVerified'])

    def test_complete_multiple_regions_all_header_checkpoint_hash_map_tail_and_type_hazards_refuse(self):
        raw,index=synthetic(frames=4064);self.assertEqual(binding.verify_fresh_index(raw,index,512,'little')['regions'],2)
        for offset in (0,4,8,12,13,14,16,20,24,32,40,48,96,104,108,120,128,132,136,136+4061*4,16384,32768,32768+16384,65535):
            changed=bytearray(index);changed[offset]^=1
            if offset<40:
                changed[40:48]=b''.join(n.to_bytes(4,'little') for n in wal.checksum(bytes(changed[:40]),False))
                changed[48:96]=changed[:48]
            with self.subTest(offset=offset),self.assertRaises(RuntimeError):binding.verify_fresh_index(raw,bytes(changed),512,'little')
        for bad in (index[:-1],index+b'\0'*32768,bytearray(index),True):
            with self.assertRaises(RuntimeError):binding.verify_fresh_index(raw,bad,512,'little')
        for order in (True,None,'native','middle'):
            with self.assertRaises(RuntimeError):binding.verify_fresh_index(raw,index,512,order)
        for corrupt in (raw[:-1],raw+b'\0',bytes([raw[0]^1])+raw[1:]):
            with self.assertRaises(RuntimeError):binding.verify_fresh_index(corrupt,index,512,'little')
        with patch.object(binding,'MAX_INDEX_BYTES',32768),self.assertRaisesRegex(RuntimeError,'never clip'):
            binding.verify_fresh_index(raw,index,512,'little')
        with patch.object(binding,'MAX_WAL_PROOF_BYTES',128),self.assertRaisesRegex(RuntimeError,'never clip'):
            binding.verify_fresh_index(raw,index,512,'little')

    def test_actual_new_full_schema_logical_wal_source_binding_both_profiles_and_pure_replay_without_target_sql(self):
        for label in ('206-apply','214-apply'):
            root,target,observation,logical=source_observation(label)
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                result=binding.schema_bound_dirty_plan(label,observation,logical,target)
                binding.recheck_schema_bound_dirty(result)
            self.assertTrue(result['collectorSourceByteBindingVerified']);self.assertTrue(result['collectorIntegrityAndFkObservationBound'])
            for key in ('independentSchemaToPrivateDbBytesProof','intactSourceAndNativeRecoveredIndexVerified',
                'writerGraphAdmissionImplemented','wholeOwnerFrameInventoryVerified','runtimeBinaryToSourceBindingVerified'):
                self.assertIs(result[key],False)
            (root/'new-wal-binding-plan.json').write_bytes(canonical(result)+b'\n')
            for key in ('writerGraphAdmissionImplemented','intactSourceAndNativeRecoveredIndexVerified','collectorSourceByteBindingVerified'):
                changed=copy.deepcopy(result);changed[key]=not changed[key]
                with self.assertRaisesRegex(RuntimeError,'record changed'):binding.recheck_schema_bound_dirty(changed)

    def test_receipt_source_logical_integrity_boolean_foreign_schema_and_original_chain_mutations_refuse(self):
        root,target,observation,logical=source_observation()
        for fault in ('logical-pin','integrity','bool-fk','foreign','schema-objects','source','label'):
            obs=copy.deepcopy(observation);state=json.loads(logical)
            if fault=='logical-pin':state['tables']={}
            elif fault=='integrity':state['integrity']='not ok'
            elif fault=='bool-fk':state['foreignKeyViolations']=False
            elif fault=='foreign':state['unknown']=True
            elif fault=='schema-objects':state['objects']=[]
            elif fault=='source':
                for key in ('copiedSourceDbWalShm','rawDbWalShm','readerBeforeDbWalShm','readerAfterDbWalShm'):
                    obs[key]['']['sha256']='a'*64
            elif fault=='label':obs['sealLabel']='capture-prepared-206'
            changed=canonical(state)+b'\n'
            if fault!='logical-pin':obs['logicalStateOriginal']={'bytes':len(changed),'sha256':sha(changed)}
            with self.subTest(fault=fault),self.assertRaises(RuntimeError):binding.schema_bound_dirty_plan('206-apply',obs,changed,target)
        _,other,obs,raw=source_observation(extra='CREATE INDEX receipt_extra ON _schema_migrations(details)')
        with self.assertRaisesRegex(RuntimeError,'Extra or missing receipt'):binding.schema_bound_dirty_plan('206-apply',obs,raw,other)
        with patch.object(binding.os,'open',side_effect=AssertionError('No target access')):
            with self.assertRaises(RuntimeError):binding.schema_bound_dirty_plan('209-apply',observation,logical,target)
        original=root/'retained-original.db';target.rename(original);shutil.copyfile(original,target)
        # A brand-new declaration could bind same bytes, but original record replay must refuse identity replacement.
        result=binding.schema_bound_dirty_plan('206-apply',observation,logical,target)
        target.rename(root/'second-original.db');shutil.copyfile(original,target)
        with self.assertRaises(RuntimeError):binding.recheck_schema_bound_dirty(result)

    def test_actual_pinned_native_readonly_recovery_full_index_originals_descriptor_pairs_and_same_byte_inode_change(self):
        program=r"""const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const [root,size]=process.argv.slice(1),p=path.join(root,'source.db'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
        const src=new Database(p);src.pragma('page_size='+size);src.pragma('journal_mode=WAL');src.pragma('wal_autocheckpoint=0');
        src.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,value TEXT)');const put=src.prepare('INSERT INTO payload(value) VALUES(?)');
        src.transaction(()=>{for(let i=0;i<(Number(size)===512?2048:128);i++)put.run('x'.repeat(Number(size)===512?1024:8192));})();
        const reader=path.join(root,'reader.db');fs.copyFileSync(p,reader);fs.copyFileSync(p+'-wal',reader+'-wal');
        const before={main:hash(fs.readFileSync(reader)),wal:hash(fs.readFileSync(reader+'-wal'))};
        if(fs.existsSync(reader+'-shm'))throw Error('NEW_READER_INDEX_NOT_ABSENT');
        const db=new Database(reader,{readonly:true,fileMustExist:true});db.exec('BEGIN');
        const integrity=db.pragma('integrity_check',{simple:true}),count=db.prepare('SELECT count(*) n FROM payload').get().n;
        fs.mkdirSync(path.join(root,'proof'));fs.copyFileSync(reader+'-wal',path.join(root,'proof/dev.db-wal'));
        fs.copyFileSync(reader+'-shm',path.join(root,'proof/dev.db-shm'));
        const after={main:hash(fs.readFileSync(reader)),wal:hash(fs.readFileSync(reader+'-wal'))};
        const result={integrity,count,version:db.prepare('SELECT sqlite_version() v').get().v,
          sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,byteOrder:require('node:os').endianness()==='LE'?'little':'big',
          before,after,indexBytes:fs.statSync(reader+'-shm').size,platform:process.platform,
          collectionQueriesUseOnlyNewOwnedReader:true,nativeSyntheticFixtureSourceCreated:true,nativeKernelLocksMeasured:false,
          runtimeLinuxBuildAttested:false,scientificOwnerExecuted:false};
        db.exec('ROLLBACK');db.close();src.close();process.stdout.write(JSON.stringify(result));"""
        for size in (512,4096,65536):
            root=directory();args=[shutil.which('node'),'-e',program,str(root),str(size)]
            (root/'native-program.cjs').write_text(program,encoding='utf8');(root/'native-command.json').write_bytes(canonical(args)+b'\n')
            child=subprocess.run(args,cwd=ROOT/'server',capture_output=True)
            (root/'stdout-original.json').write_bytes(child.stdout);(root/'stderr-original.txt').write_bytes(child.stderr)
            self.assertEqual(child.returncode,0,child.stderr.decode(errors='replace'));value=json.loads(child.stdout)
            self.assertEqual(value['version'],'3.51.2');self.assertEqual(value['sourceId'],wal_tests.SOURCE_ID)
            self.assertEqual(value['before'],value['after']);self.assertEqual(value['integrity'],'ok')
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No pair observer SQL')):
                observation=binding.observe_index_pair(root/'proof/dev.db-wal',root/'proof/dev.db-shm',size,value['byteOrder'])
                binding.recheck_index_pair(observation)
            self.assertTrue(observation['indexCheck']['walIndexByteConsistencyVerified'])
            if size==512:self.assertGreater(observation['indexCheck']['regions'],1)
            (root/'index-pair-observation.json').write_bytes(canonical(observation)+b'\n')
            p=root/'proof/dev.db-shm';p.rename(root/'retained-original-index.bin');shutil.copyfile(root/'retained-original-index.bin',p)
            with self.assertRaisesRegex(RuntimeError,'record changed'):binding.recheck_index_pair(observation)
            self.assertFalse(observation['nativeRecoveryExecutionVerified']);self.assertFalse(value['runtimeLinuxBuildAttested'])

    def test_new_complete_source_copy_detects_same_length_native_and_tooling_mutation(self):
        root=directory();proof=json.loads((HERE/binding.PROOF).read_bytes());tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/binding.PROOF).write_bytes((HERE/binding.PROOF).read_bytes())
        with patch.object(binding,'__file__',str(tooling/'kit_wal_source_binding.py')):
            binding.source_proof()
            for name in (proof['nativeSource']['path'],(HERE/'kit_wal_source_binding.py').relative_to(ROOT).as_posix()):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):binding.source_proof()
                p.write_bytes(raw)
