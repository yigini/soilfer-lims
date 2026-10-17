"""Source-only target frame review; NEW LOCAL native fixtures, never a host."""
import copy
import json
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_readonly_target_wal as dry
from kit_contract import canonical,sha
from kit_wal_content import wal_content_bound
import verify_kit_wal_content as wal_tests

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'readonly-target-wal-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='dry-',dir=FIXTURES)).resolve()


def node(root,program,*arguments):
    command=[shutil.which('node'),'-e',program,*map(str,arguments)]
    (root/'native-program.cjs').write_text(program,encoding='utf-8')
    (root/'native-command.json').write_bytes(canonical(command)+b'\n')
    result=subprocess.run(command,cwd=ROOT/'server',capture_output=True)
    (root/'stdout-original.json').write_bytes(result.stdout)
    (root/'stderr-original.txt').write_bytes(result.stderr)
    (root/'exit-original.json').write_bytes(canonical({'exitCode':result.returncode})+b'\n')
    return result


class ReadonlyTargetWal(unittest.TestCase):
    def test_complete_source_pins_raw_application_git_bytes_and_native_readonly_barrier(self):
        raw=(HERE/dry.PROOF_NAME).read_bytes();proof=json.loads(raw)
        self.assertEqual(dry.source_proof(),sha(raw))
        for name,record in proof['applicationGitBlobs'].items():
            data=subprocess.check_output(['git','show',proof['applicationHead']+':'+name],cwd=ROOT)
            self.assertEqual(sha(data),record['sha256'],name)
            self.assertEqual(record,proof['files'][name],name)
        source=(ROOT/proof['nativeSource']['path']).read_bytes()
        for part in proof['nativeExcerpts']:
            self.assertEqual(source[part['startByte']:part['endByte']].decode(),part['text'],part['label'])
        barrier=next(row['text'] for row in proof['nativeExcerpts'] if row['label']=='btree_readonly_write_refusal')
        self.assertIn('BTS_READ_ONLY',barrier);self.assertIn('SQLITE_READONLY',barrier)
        self.assertFalse(proof['wholeOwnerFrameInventoryVerified'])
        self.assertFalse(proof['runtimeBinaryToSourceBindingVerified'])

    def test_all_three_dry_paths_zero_native_entries_sets_commits_and_full_initial_extent_all_page_sizes(self):
        for label in dry.LABELS:
            value=dry.readonly_target_inventory(label);inventory=value['targetFrameInventory']
            self.assertEqual([inventory[k] for k in ('maximumPageFrameEntries','maximumFrameSets','maximumCommitFrameSets')],[0,0,0])
            for size in (512,1024,2048,4096,8192,16384,32768,65536):
                for initial in (0,32,32+17*(size+24)):
                    bound=wal_content_bound(size,initial,inventory)
                    self.assertEqual(bound['maximumWalLogicalContentBytes'],initial)
            self.assertTrue(value['originalTargetFrameInventoryDerived'])
            self.assertFalse(value['zeroFromSqlStatementOrBtreeOrPageCounts'])
            self.assertFalse(value['retainedCopyWritersInventoried'])
            for key in ('runtimeDefaultVfsVerified','writerGraphAdmissionImplemented','shmGrowthBounded',
                'mainCheckpointGrowthBounded','statementOrSqlScratchBounded','physicalFilesystemClosureClaimed'):
                self.assertIs(value[key],False)

    def test_apply_repeat_noop_result_and_malformed_label_cannot_borrow_dry_inventory(self):
        for value in ('206-apply','214-apply','209-apply','206-repeat','214-repeat','209-repeat',
            'canonical-policy','206-dry --apply','COMPLETE_206','NO_OP',True,None,{'mode':'DRY_RUN','totalChanges':0}):
            with self.subTest(value=value),self.assertRaisesRegex(RuntimeError,'Only exact'):
                dry.readonly_target_inventory(value)

    def test_descriptor_only_source_plan_and_replay_refuse_invented_authority_and_real_source_changes(self):
        _,target=wal_tests.observed_fixture()
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No original target SQL')):
            plan=dry.readonly_target_plan('206-dry',target);dry.recheck_readonly_target(plan)
        self.assertEqual(plan['observation']['bound']['maximumWalLogicalContentBytes'],plan['observation']['walObservation']['bytes'])
        for path,value in [('writerGraphAdmissionImplemented',True),('extra',True)]:
            changed=copy.deepcopy(plan);changed[path]=value
            with self.assertRaisesRegex(RuntimeError,'record changed'):dry.recheck_readonly_target(changed)
        changed=copy.deepcopy(plan);changed['inventory']['targetFrameInventory']['maximumPageFrameEntries']=1
        with self.assertRaisesRegex(RuntimeError,'record changed'):dry.recheck_readonly_target(changed)
        raw=target.read_bytes();target.write_bytes(raw[:-1]+bytes([raw[-1]^1]))
        with self.assertRaises(RuntimeError):dry.recheck_readonly_target(plan)

    def test_new_full_source_copy_detects_same_length_native_and_caller_mutations(self):
        root=directory();proof=json.loads((HERE/dry.PROOF_NAME).read_bytes());tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            if name in proof['applicationGitBlobs']:continue
            dest=root/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,dest)
        (tooling/dry.PROOF_NAME).write_bytes((HERE/dry.PROOF_NAME).read_bytes())
        for name in (proof['nativeSource']['path'],'WP/batch-release-kit-be837974-20261016/kit_readonly_target_wal.py'):
            p=root/name;raw=p.read_bytes()
            with patch.object(dry,'__file__',str(tooling/'kit_readonly_target_wal.py')):
                self.assertEqual(dry.source_proof(),sha((tooling/dry.PROOF_NAME).read_bytes()))
                p.write_bytes(b'#'+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):dry.source_proof()
            p.write_bytes(raw)
        changed=copy.deepcopy(proof);name='server/scripts/install_order_revisions.js'
        original=changed['applicationSourceText'][name]
        changed['applicationSourceText'][name]=chr(ord(original[0])^1)+original[1:]
        (tooling/dry.PROOF_NAME).write_bytes(canonical(changed)+b'\n')
        with patch.object(dry,'__file__',str(tooling/'kit_readonly_target_wal.py')):
            with self.assertRaisesRegex(RuntimeError,'source changed'):dry.source_proof()

    def test_actual_raw_installers_dry_native_classification_with_explicit_prerequisite_standins(self):
        root=directory();application=pathlib.Path(tempfile.mkdtemp(prefix='cj-native-dry-')).resolve()
        (root/'runtime-reference.json').write_bytes(canonical({'newRetainedRuntime':str(application),
            'purpose':'NEW raw application source tree only; short Windows paths',
            'loadedCompiledBinaryBindingVerified':False,'privateBytesPublished':False})+b'\n')
        proof=json.loads((HERE/dry.PROOF_NAME).read_bytes())
        for name in proof['applicationGitBlobs']:
            dest=application/name;dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(subprocess.check_output(['git','show',proof['applicationHead']+':'+name],cwd=ROOT))
        program=r"""const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
        const Native=require('better-sqlite3'),[root,application]=process.argv.slice(1),target=path.join(root,'target.db');
        const writer=new Native(target),opens=[],hash=b=>crypto.createHash('sha256').update(b).digest('hex');
        const hashes=p=>Object.fromEntries(['','-wal','-shm'].map(s=>[s,fs.existsSync(p+s)?hash(fs.readFileSync(p+s)):null]));
        // NEW LOCAL setup only. Real predecessor scientific prerequisites are STAND-INS below.
        writer.pragma('journal_mode=WAL');writer.pragma('wal_autocheckpoint=0');
        writer.exec(`CREATE TABLE Sample(id TEXT PRIMARY KEY,status TEXT,requiredAnalyses TEXT);
        CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,status TEXT,duplicateOf TEXT);
        CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,aliquotId TEXT,workItemId TEXT,orderLineId TEXT,status TEXT);
        CREATE TABLE EquipmentAsset(id TEXT PRIMARY KEY);CREATE TABLE QcEvaluation(details TEXT);
        CREATE TABLE Batch(startedAt TEXT);CREATE TABLE QcMeasurement(supersededById TEXT);
        CREATE TABLE LabPolicyOverride(value TEXT);CREATE TABLE SampleOrderRevision(id TEXT,sampleId TEXT,status TEXT,version INTEGER);
        CREATE TABLE OrderLine(id TEXT,revisionId TEXT,analysis TEXT,status TEXT);
        CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,appliedAt TEXT,details TEXT);`);
        const originalLoad=Module._load;let mode;
        Module._load=function(request,parent,isMain){
          if(request==='better-sqlite3')return function(filename,options){
            opens.push({mode,filename,options});
            if(!options||options.readonly!==true)throw Error('UNREVIEWED_WRITER_OPEN');
            return new Native(filename,options);
          };
          if(request==='./install_instrument_imports')return {assertInstrumentImportStartupReady(){return {};}};
          if(request==='./install_sample_containers')return {assertSampleContainerStartupReady(){return {};}};
          if(request==='./install_control_charts')return {assertControlChartStartupReady(){return {};}};
          if(request==='./install_lab_policy_schema')return {assertLabPolicyStartupReady(){
            const before=hashes(target),folder=fs.mkdtempSync(path.join(root,'policy-')),copy=path.join(folder,'snapshot.db');
            for(const suffix of ['','-wal'])fs.copyFileSync(target+suffix,copy+suffix);
            return {readonlySnapshot:{path:copy,originalDbWalShmSha256:before}};
          }};
          return originalLoad.apply(this,arguments);
        };
        const mainBefore=fs.readFileSync(target),walBefore=fs.readFileSync(target+'-wal'),results=[];
        for(const [issue,file,method] of [['206','install_sample_containers.js','installSampleContainers'],
          ['214','install_control_charts.js','installControlCharts'],['209','install_order_revisions.js','installOrderRevisions']]){
          mode=issue;const script=path.join(application,'server/scripts',file);
          // Load exact original top-level installer, leaving its body/classifier/DDL loader unmodified.
          const loaded=originalLoad.call(Module,script,module,false),value=loaded[method]({dbPath:target});
          if(value.classification!=='PRE_'+issue||value.mode!=='DRY_RUN'||value.totalChanges!==0)throw Error('CLASSIFICATION');
          results.push({issue,classification:value.classification,mode:value.mode});
        }
        const unchanged=mainBefore.equals(fs.readFileSync(target))&&walBefore.equals(fs.readFileSync(target+'-wal'));
        const value={results,opens,unchanged,version:writer.prepare('SELECT sqlite_version() v').get().v,
          sourceId:writer.prepare('SELECT sqlite_source_id() v').get().v,platform:process.platform,
          prerequisitesAreStandins:true,fullInstallerChainExecuted:false,nativeFrameRequestsMeasured:false,
          continuousPeakMeasured:false,physicalFilesystemClosureClaimed:false};
        writer.close();process.stdout.write(JSON.stringify(value));
        """
        result=node(root,program,root,application)
        self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'))
        value=json.loads(result.stdout);self.assertTrue(value['unchanged']);self.assertEqual(len(value['opens']),3)
        self.assertEqual(value['version'],'3.51.2');self.assertEqual(value['sourceId'],wal_tests.SOURCE_ID)
        for row in value['opens']:self.assertIs(row['options']['readonly'],True)
        self.assertEqual([r['mode'] for r in value['opens']],['206','214','209'])
        self.assertEqual(value['opens'][0]['filename'],value['opens'][1]['filename'])
        self.assertNotEqual(value['opens'][0]['filename'],value['opens'][2]['filename'])

    def test_actual_native_readonly_handles_refuse_all_three_write_forms_preserve_main_and_wal(self):
        root=directory()
        program=r"""const fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
        const root=process.argv[1],cases=[];
        for(const p of [512,4096,65536]){
          const target=path.join(root,'page-'+p+'.db'),writer=new Database(target);
          writer.pragma('page_size='+p);writer.pragma('journal_mode=WAL');writer.pragma('wal_autocheckpoint=0');
          writer.exec("CREATE TABLE payload(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO payload VALUES(1,'ORIGINAL')");
          const main=fs.readFileSync(target),wal=fs.readFileSync(target+'-wal'),db=new Database(target,{readonly:true,fileMustExist:true});
          const errors=[];
          for(const sql of ["UPDATE payload SET value='CHANGED'",'CREATE TABLE forbidden(x)','PRAGMA user_version=123']){
            try{db.exec(sql);throw Error('WRITE_SUCCEEDED');}catch(e){if(e.code!=='SQLITE_READONLY')throw e;errors.push(e.code);}
          }
          const value=db.prepare('SELECT value FROM payload').get().value;db.close();
          cases.push({pageSize:p,errors,value,mainUnchanged:main.equals(fs.readFileSync(target)),
            walUnchanged:wal.equals(fs.readFileSync(target+'-wal')),readonlyTarget:true});writer.close();
        }process.stdout.write(JSON.stringify({cases,platform:process.platform,continuousPeakMeasured:false,
          fullLifetimeOriginalsRetained:false,physicalFilesystemClosureClaimed:false}));"""
        result=node(root,program,root)
        self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'))
        for row in json.loads(result.stdout)['cases']:
            self.assertEqual(row['errors'],['SQLITE_READONLY']*3);self.assertEqual(row['value'],'ORIGINAL')
            self.assertTrue(row['mainUnchanged']);self.assertTrue(row['walUnchanged'])
