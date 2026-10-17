"""Pinned Unix source and NEW LOCAL native files; no Linux/host authority."""
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
import kit_linux_main_vfs as vfs
from kit_contract import canonical,sha
from kit_capture_native_inventory import capture_native_inventory,RECEIPT_SQL,RECEIPT_INDEX

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'linux-main-vfs-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='unix-',dir=FIXTURES)).resolve()


def header(size,pages=3):
    value=bytearray(100);value[:16]=b'SQLite format 3\0'
    value[16:18]=(1 if size==65536 else size).to_bytes(2,'big');value[18:20]=b'\1\1'
    value[21:24]=bytes([64,32,32]);value[24:28]=(1).to_bytes(4,'big')
    value[28:32]=pages.to_bytes(4,'big');value[56:60]=(1).to_bytes(4,'big');value[92:96]=value[24:28]
    return bytes(value)


def operations(calls=1,payload=0):
    return {'version':1,'scope':'DECLARED_NATIVE_NORMAL_BTREE_MUTATIONS','callerReviewSha256':'a'*64,
        'createdRoots':0,'normalInsertions':[{'calls':calls,'maximumPayloadBytes':payload}], 'deletions':0}


class LinuxMainVfs(unittest.TestCase):
    def test_full_native_build_binding_excerpts_and_prebuilt_gap_are_explicit(self):
        value=json.loads((HERE/vfs.PROOF_NAME).read_bytes());self.assertEqual(vfs.source_proof(),sha((HERE/vfs.PROOF_NAME).read_bytes()))
        native=(ROOT/'server/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c').read_bytes()
        self.assertEqual(sha(native),vfs.NATIVE_SHA);self.assertGreaterEqual(len(value['nativeExcerpts']),24)
        for excerpt in value['nativeExcerpts']:
            self.assertEqual(native[excerpt['startByte']:excerpt['endByte']].decode(),excerpt['text'])
        docker=bytes.fromhex(value['applicationDockerfile']['contentHex'])
        self.assertEqual(sha(docker),value['applicationDockerfile']['sha256'])
        self.assertIn(b'npm rebuild better-sqlite3',docker)
        package=json.loads((ROOT/'server/node_modules/better-sqlite3/package.json').read_bytes())
        self.assertEqual(package['scripts']['install'],'prebuild-install || node-gyp rebuild --release')
        self.assertTrue(value['buildMayUsePrebuiltAddon']);self.assertFalse(value['runtimeBinaryToSourceBindingVerified'])
        self.assertFalse(value['runtimeDefaultVfsVerified']);self.assertFalse(value['writerGraphAdmissionImplemented'])
        self.assertIn('server/node_modules/better-sqlite3/src/addon.cpp',value['files'])

    def test_all_eight_page_sizes_and_both_complete_native_profiles_have_conditional_file_bound(self):
        schema={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':[
            ['table','_schema_migrations','_schema_migrations',2,RECEIPT_SQL],
            ['index',RECEIPT_INDEX,'_schema_migrations',3,None],
            ['table','WorkAttempt','WorkAttempt',4,'CREATE TABLE WorkAttempt(id TEXT)']]}
        for label in ('capture-206-prepare','capture-214-prepare'):
            op=capture_native_inventory(label,schema)['operations'];original=copy.deepcopy(op)
            for size in (512,1024,2048,4096,8192,16384,32768,65536):
                plan=vfs.default_linux_main_file_bound(header(size,8),8*size,op,vfs.declared_default_linux_profile())
                bound=plan['nativeMutationBound'];self.assertEqual(plan['conditionalMaximumMainFileLengthBytes'],bound['maximumLogicalMainPages']*size)
                self.assertEqual(plan['conditionalMaximumMainGrowthBytes'],bound['maximumAdditionalPages']*size)
                for key in ('sourceDeclarationIsRuntimeObservation','runtimeBinaryToSourceBindingVerified',
                    'runtimeDefaultVfsVerified','callerReviewVerified','writerGraphAdmissionImplemented',
                    'mainFileLengthOrVfsPreallocationBounded','walGrowthBounded','statementOrSqlScratchBounded',
                    'continuousPeakMeasured','physicalFilesystemClosureClaimed'):self.assertIs(plan[key],False)
            self.assertEqual(op,original)

    def test_pinned_request_high_water_includes_zero_chunk_mmap_and_nondefault_chunk_rounding(self):
        request={'kind':'size-hint','bytes':8193,'chunkBytes':0,'mmapBytes':0}
        self.assertEqual(vfs.unix_request_high_water(4096,request),4096)
        request['mmapBytes']=65536;self.assertEqual(vfs.unix_request_high_water(4096,request),8193)
        request['chunkBytes']=4096;self.assertEqual(vfs.unix_request_high_water(4096,request),12288)
        self.assertEqual(vfs.unix_request_high_water(20000,request),20000)
        self.assertEqual(vfs.unix_request_high_water(4096,{'kind':'write','offset':8192,'bytes':4096}),12288)
        self.assertEqual(vfs.unix_request_high_water(12288,{'kind':'truncate','bytes':1,'chunkBytes':0}),12288)
        self.assertEqual(vfs.unix_request_high_water(1,{'kind':'truncate','bytes':4097,'chunkBytes':4096}),8192)
        for row in ({'kind':'write','offset':vfs.MAX_BYTES,'bytes':1},
            {'kind':'truncate','bytes':vfs.MAX_BYTES,'chunkBytes':2147483647},
            {'kind':'write','offset':False,'bytes':1},{'kind':'write','offset':0,'bytes':0},
            {'kind':'size-hint','bytes':1,'chunkBytes':0,'mmapBytes':True},dict(request,foreign=True)):
            with self.assertRaises(RuntimeError):vfs.unix_request_high_water(1,row)

    def test_declared_profile_refuses_custom_platform_vfs_chunks_mmap_and_invented_authority(self):
        valid=vfs.declared_default_linux_profile()
        for key,item in [('platform','win32'),('platform','darwin'),('vfs','unix-excl'),('vfs','custom'),
            ('chunkBytes',4096),('chunkBytes',False),('defaultMmapBytes',4096),('uriFileName',True),
            ('customVfs',True),('customSystemCalls',True),('automaticExtensions',True),
            ('version',True),('sourceProofSha256','0'*64),('runtimeDefaultVfsVerified',True)]:
            row=dict(valid);row[key]=item
            with self.subTest(key=key,item=item),self.assertRaises(RuntimeError):
                vfs.default_linux_main_file_bound(header(4096),12288,operations(),row)

    def test_complete_oversized_or_unsupported_mutations_refuse_and_planning_never_opens_target_sql(self):
        profile=vfs.declared_default_linux_profile();op=operations(1000000,2147483647)
        with self.assertRaises(RuntimeError):vfs.default_linux_main_file_bound(header(4096),12288,op,profile)
        for offset,byte in [(18,2),(20,1),(21,63),(52,1)]:
            raw=bytearray(header(4096));raw[offset]=byte
            with self.assertRaises(RuntimeError):vfs.default_linux_main_file_bound(bytes(raw),12288,operations(),profile)
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
            plan=vfs.default_linux_main_file_bound(header(4096),12288,operations(),profile)
        self.assertFalse(plan['mainFileLengthOrVfsPreallocationBounded'])

    def test_real_new_source_copy_detects_native_or_addon_mutation_without_reading_old_fixtures(self):
        root=directory();tooling=root/'WP'/HERE.name;tooling.mkdir(parents=True)
        proof=(HERE/vfs.PROOF_NAME).read_bytes();value=json.loads(proof)
        for name in value['files']:
            target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
        (tooling/vfs.PROOF_NAME).write_bytes(proof)
        with patch.object(vfs,'__file__',str(tooling/'kit_linux_main_vfs.py')):
            self.assertEqual(vfs.source_proof(),sha(proof))
            target=root/'server/node_modules/better-sqlite3/src/addon.cpp';raw=target.read_bytes()
            target.write_bytes(raw.replace(b'ConfigureURI',b'ConfigureURX',1));self.assertNotEqual(target.read_bytes(),raw)
            with self.assertRaisesRegex(RuntimeError,'source changed'):vfs.source_proof()

    def test_actual_local_pinned_native_commit_rollback_options_and_file_lengths_do_not_prove_linux(self):
        node=shutil.which('node');self.assertIsNotNone(node);application=ROOT/'server'
        program=r"""const fs=require('node:fs'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const dir=process.argv[1],rows=[];const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        for(const page of [512,4096,65536])for(const mode of ['rollback','commit']){
          const file=dir+'/'+page+'-'+mode+'.db',db=new Database(file);db.pragma('page_size='+page);
          db.exec('CREATE TABLE payload(id INTEGER PRIMARY KEY,v BLOB); CREATE INDEX payload_v ON payload(v)');
          db.prepare('INSERT INTO payload(v) VALUES(?)').run(Buffer.alloc(1536,65));
          const before=fs.readFileSync(file),originalHash=hash(file),samples=[];
          const write=db.prepare('INSERT INTO payload(v) VALUES(?)');let rolled=false;
          try{db.transaction(()=>{for(let i=0;i<96;i++){const b=Buffer.alloc(1536,66);b.writeUInt32LE(i);write.run(b);samples.push(fs.statSync(file).size);}
            if(mode==='rollback')throw Error('LOCAL_ROLLBACK');}).immediate();}
          catch(e){if(e.message!=='LOCAL_ROLLBACK')throw e;rolled=true;}
          const row={page,mode,headerHex:before.subarray(0,100).toString('hex'),initialBytes:before.length,originalHash,
            afterHash:hash(file),samples,finalBytes:fs.statSync(file).size,rolled,rows:db.prepare('SELECT count(*) n FROM payload').get().n,
            platform:process.platform,version:db.prepare('SELECT sqlite_version() v').get().v,
            sourceId:db.prepare('SELECT sqlite_source_id() v').get().v,options:db.pragma('compile_options').map(x=>x.compile_options),
            applicationInstallersExecuted:false,continuousPeakMeasured:false,linuxVfsTested:false,physicalFilesystemClosureClaimed:false};
          db.close();rows.push(row);
        }process.stdout.write(JSON.stringify(rows));"""
        root=directory();(root/'program.cjs.txt').write_text(program,encoding='utf8')
        result=subprocess.run([node,'-e',program,str(root)],cwd=application,capture_output=True)
        (root/'stdout-original.json').write_bytes(result.stdout);(root/'stderr-original.txt').write_bytes(result.stderr)
        self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'));rows=json.loads(result.stdout)
        self.assertEqual(len(rows),6);profile=vfs.declared_default_linux_profile()
        for row in rows:
            self.assertEqual(row['version'],'3.51.2');self.assertEqual(row['sourceId'],vfs.SOURCE_ID)
            plan=vfs.default_linux_main_file_bound(bytes.fromhex(row['headerHex']),row['initialBytes'],operations(192,8192),profile)
            self.assertLessEqual(max(row['samples']+[row['finalBytes']]),plan['conditionalMaximumMainFileLengthBytes'])
            self.assertEqual(row['rows'],1 if row['mode']=='rollback' else 97)
            if row['mode']=='rollback':self.assertEqual(row['originalHash'],row['afterHash'])
            if row['platform']!='linux':
                with self.assertRaises(RuntimeError):vfs.runtime_option_preconditions(row['platform'],row['version'],row['sourceId'],row['options'])
        required=['DEFAULT_MMAP_SIZE=0','ENABLE_LOCKING_STYLE=0','MUTEX_PTHREADS','THREADSAFE=2','USE_URI=0','OMIT_SHARED_CACHE','TEMP_STORE=1']
        observed=vfs.runtime_option_preconditions('linux','3.51.2',vfs.SOURCE_ID,required)
        self.assertFalse(observed['runtimeBinaryToSourceBindingVerified']);self.assertFalse(observed['runtimeDefaultVfsVerified'])
        for options in [required[:-1],required+[required[0]],required+['DEFAULT_UNIX_VFS=custom'],required+[True]]:
            with self.assertRaises(RuntimeError):vfs.runtime_option_preconditions('linux','3.51.2',vfs.SOURCE_ID,options)


if __name__=='__main__':unittest.main()
