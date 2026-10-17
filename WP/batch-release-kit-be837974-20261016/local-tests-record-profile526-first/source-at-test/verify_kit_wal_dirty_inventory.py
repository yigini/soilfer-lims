"""Pinned dirty-path arithmetic and NEW LOCAL native SQL fixtures only."""
import copy
import json
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import kit_wal_dirty_inventory as dirty
import kit_wal_content as wal
import verify_kit_capture_native_inventory as native_tests
import verify_kit_wal_content as wal_tests
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]
FIXTURES=HERE/'wal-dirty-inventory-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='dirty-',dir=FIXTURES)).resolve()


def observed(auto=False):
    root=directory();source=root/'source.db';target=root/'observed/dev.db';target.parent.mkdir()
    db=sqlite3.connect(source)
    try:
        if auto:db.execute('PRAGMA auto_vacuum=FULL')
        db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA wal_autocheckpoint=0')
        db.executescript(native_tests.inventory.RECEIPT_SQL+';CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY);')
        schema={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,
            'rows':[list(row) for row in db.execute('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name')]}
        shutil.copyfile(source,target);shutil.copyfile(str(source)+'-wal',str(target)+'-wal')
    finally:db.close()
    return root,target,schema


class WalDirtyInventory(unittest.TestCase):
    def test_complete_source_pins_and_exact_native_allocation_free_secure_delete_balance_cookie_rekey_paths(self):
        raw=(HERE/dirty.PROOF_NAME).read_bytes();proof=json.loads(raw)
        self.assertEqual(dirty.source_proof(),sha(raw));self.assertEqual(proof['coefficients'],dirty.COEFFICIENTS)
        source=(ROOT/proof['nativeSource']['path']).read_bytes()
        occurrences=[{'line':i,'text':line.rstrip('\r\n')} for i,line in
            enumerate(source.decode().splitlines(keepends=True),1) if 'sqlite3PagerWrite(' in line]
        self.assertEqual(occurrences,[{key:row[key] for key in ('line','text')}
            for row in proof['staticPagerWriteOccurrences']])
        self.assertTrue(all(row['classification'] for row in proof['staticPagerWriteOccurrences']))
        application=json.loads((HERE/proof['applicationSourceContainer']).read_bytes())
        self.assertEqual(proof['applicationGitBlobs'],application['applicationGitBlobs'])
        for name,pin in proof['applicationGitBlobs'].items():
            raw=application['applicationSourceText'][name].encode()
            self.assertEqual({'bytes':len(raw),'sha256':sha(raw)},pin)
        self.assertFalse(proof['applicationContainerReadonlyConclusionUsedForApply'])
        for row in proof['nativeExcerpts']:
            self.assertEqual(source[row['startByte']:row['endByte']].decode(),row['text'],row['label'])
        pieces={row['label']:row['text'] for row in proof['nativeExcerpts']}
        self.assertIn('BTS_SECURE_DELETE',pieces['free_page']);self.assertIn('sqlite3PagerWrite',pieces['metadata'])
        self.assertIn('sqlite3PagerRekey',pieces['balance_rekey']);self.assertIn('PGHDR_DIRTY',pieces['balance_rekey'])
        self.assertIn('pagerStress',pieces['explicit_flush']);self.assertIn('pList==0',pieces['commit_fallback'])
        self.assertFalse(proof['collectorBindingImplemented']);self.assertFalse(proof['writerGraphAdmissionImplemented'])
        self.assertFalse(proof['runtimeBinaryToSourceBindingVerified'])

    def test_both_profiles_all_eight_page_sizes_expand_every_native_category_and_repeat_dirty_marks(self):
        schema=native_tests.schema()
        for label,roots,inserts,deletes,ddl in [('206-apply',7,15,2,9),('214-apply',15,33,4,23)]:
            for size in (512,1024,2048,4096,8192,16384,32768,65536):
                value=dirty.dirty_frame_inventory(label,size,schema);groups=value['normalMutationExpansion']
                self.assertEqual(sum(row['calls'] for row in groups),inserts)
                self.assertEqual(value['pagerWritesPerBalanceLevel'],37)
                self.assertEqual(value['pagerWritesPerBalanceTraversal'],785)
                cats=value['pagerWriteCategories']
                self.assertEqual(cats['rootAllocations'],roots*3);self.assertEqual(cats['emptyNewRootClears'],roots)
                self.assertEqual(cats['schemaMetadataCookies'],ddl*3);self.assertEqual(cats['beginPageCountRepair'],1)
                self.assertEqual(cats['nativeDeletes'],deletes*value['pagerWritesPerNativeDelete'])
                self.assertEqual(cats['normalMutations'],sum(row['calls']*row['pagerWritesPerCall'] for row in groups))
                marks=sum(cats.values())*max(1,65536//size)
                self.assertEqual(value['targetFrameInventory']['maximumPageFrameEntries'],marks+1)
                self.assertEqual(value['targetFrameInventory']['maximumFrameSets'],marks+1)
                self.assertTrue(value['completeConditionalTargetDirtyInventoryDerived'])
                self.assertFalse(value['schemaDeclarationIsCollectorEvidence'])
                self.assertFalse(value['actualNativeFrameRequestsMeasured']);self.assertFalse(value['wholeOwnerFrameInventoryVerified'])

    def test_unsupported_profiles_receipt_hazards_booleans_and_capacity_overflow_refuse_without_clipping(self):
        schema=native_tests.schema()
        for label in ('209-apply','206-repeat','214-repeat','206-dry','capture-206-prepare',True,None):
            with self.subTest(label=label),patch.object(dirty.os,'open',side_effect=AssertionError('No target before profile refusal')):
                with self.assertRaisesRegex(RuntimeError,'Only strict'):dirty.dirty_wal_plan(label,'/unused',schema)
        for size in (True,511,513,131072):
            with self.assertRaises(RuntimeError):dirty.dirty_frame_inventory('206-apply',size,schema)
        for row in [('trigger','receipt_trigger','_schema_migrations',0,'CREATE TRIGGER receipt_trigger AFTER INSERT ON _schema_migrations BEGIN SELECT 1; END'),
            ('index','receipt_extra','_schema_migrations',100,'CREATE INDEX receipt_extra ON _schema_migrations(details)')]:
            changed=copy.deepcopy(schema);changed['rows'].append(list(row))
            with self.assertRaises(RuntimeError):dirty.dirty_frame_inventory('206-apply',4096,changed)
        value=dirty.dirty_frame_inventory('214-apply',65536,schema)
        frame=65536+24;maximum=32+((32*1024**3-32)//frame)*frame
        with self.assertRaisesRegex(RuntimeError,'never clip'):
            wal.wal_content_bound(65536,maximum,value['targetFrameInventory'])

    def test_actual_wal_current_page_one_not_stale_checkpoint_and_descriptor_only_full_replay(self):
        _,target,schema=observed()
        with patch.object(sqlite3,'connect',side_effect=AssertionError('No observation target SQL')):
            plan=dirty.dirty_wal_plan('206-apply',target,schema);dirty.recheck_dirty_wal(plan)
        effective=plan['effectivePageOne'];self.assertIsNotNone(effective['lastPageOneFrame'])
        self.assertGreater(effective['logicalPages'],plan['observation']['mainPhysicalPages'])
        self.assertFalse(plan['schemaToSourceCollectorBindingVerified']);self.assertFalse(plan['nativeRecoveredWalIndexObserved'])
        self.assertFalse(effective['independentPrivateDbSemanticAssociationProved'])
        for key in ('writerGraphAdmissionImplemented','runtimeDefaultVfsVerified','beforeCreateHeldAdmissionImplemented'):
            changed=copy.deepcopy(plan);changed[key]=True
            with self.assertRaisesRegex(RuntimeError,'record changed'):dirty.recheck_dirty_wal(changed)
        changed=copy.deepcopy(plan);changed['inventory']['maximumPagerWriteCalls']=False
        with self.assertRaisesRegex(RuntimeError,'record changed'):dirty.recheck_dirty_wal(changed)

    def test_actual_autovacuum_geometry_nonempty_shm_and_same_byte_inode_substitution_refuse(self):
        _,target,schema=observed(auto=True)
        with self.assertRaisesRegex(RuntimeError,'non-autovacuum'):dirty.dirty_wal_plan('206-apply',target,schema)
        root,target,schema=observed();plan=dirty.dirty_wal_plan('206-apply',target,schema)
        original=root/'retained-original-main.db';target.rename(original);shutil.copyfile(original,target)
        with self.assertRaises(RuntimeError):dirty.recheck_dirty_wal(plan)
        pathlib.Path(str(target)+'-shm').write_bytes(b'UNVALIDATED')
        with self.assertRaisesRegex(RuntimeError,'nonempty WAL index'):dirty.dirty_wal_plan('206-apply',target,schema)

    def test_new_complete_source_copy_and_boolean_coefficients_detect_same_length_mutation(self):
        root=directory();proof=json.loads((HERE/dirty.PROOF_NAME).read_bytes());tooling=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tooling/dirty.PROOF_NAME).write_bytes((HERE/dirty.PROOF_NAME).read_bytes())
        with patch.object(dirty,'__file__',str(tooling/'kit_wal_dirty_inventory.py')):
            dirty.source_proof();p=root/proof['nativeSource']['path'];raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
            with self.assertRaisesRegex(RuntimeError,'source changed'):dirty.source_proof()
            p.write_bytes(raw);changed=copy.deepcopy(proof);changed['coefficients']['allocationPagerWrites']=True
            (tooling/dirty.PROOF_NAME).write_bytes(canonical(changed)+b'\n')
            with self.assertRaisesRegex(RuntimeError,'source derivation'):dirty.source_proof()

    def test_actual_pinned_wal_both_ddl_receipts_freelist_secure_delete_commit_and_rollback_with_source_derived_inventory(self):
        profiles=json.loads((HERE/'capture-native-inventory-source.json').read_bytes())['profiles']
        program=r"""const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Database=require('better-sqlite3');
        const [root,size,mode,inputFile]=process.argv.slice(1),input=JSON.parse(fs.readFileSync(inputFile)),target=path.join(root,'native.db');
        const db=new Database(target),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
        // NEW LOCAL TEST ONLY settings. Actual scientific CLI settings never change.
        db.pragma('page_size='+size);db.pragma('journal_mode=WAL');db.pragma('wal_autocheckpoint=0');
        db.pragma('cache_size=4');db.pragma('synchronous=FULL');db.pragma('secure_delete=ON');
        db.exec(input.receiptSql+';CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY);CREATE TABLE disposable(id INTEGER PRIMARY KEY,value TEXT);');
        const add=db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)'),junk=db.prepare('INSERT INTO disposable(value) VALUES(?)');
        db.transaction(()=>{for(let i=0;i<96;i++)add.run('historical-'+String(i).padStart(4,'0'),'x'.repeat(8192));
          for(let i=0;i<32;i++)junk.run('y'.repeat(8192));}).immediate();
        db.exec('DROP TABLE disposable');
        const schema={version:1,scope:'DECLARED_COMPLETE_SQLITE_SCHEMA',encoding:1,
          rows:db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY type,name').all().map(r=>[r.type,r.name,r.tbl_name,r.rootpage,r.sql])};
        fs.mkdirSync(path.join(root,'baseline'));fs.copyFileSync(target,path.join(root,'baseline/dev.db'));
        fs.copyFileSync(target+'-wal',path.join(root,'baseline/dev.db-wal'));
        const main=fs.readFileSync(target),initial=fs.readFileSync(target+'-wal'),freePages=db.pragma('freelist_count',{simple:true});
        process.stdout.write(JSON.stringify({phase:'BEFORE_FORWARD_TRANSACTION',schema,freePages,initialWalBytes:initial.length,
          version:db.prepare('SELECT sqlite_version() v').get().v,sourceId:db.prepare('SELECT sqlite_source_id() v').get().v})+'\n');
        if(fs.readFileSync(0,'utf8')!=='GO')throw Error('LOCAL_PARENT_REFUSED');
        const programs=[],samples=[];let rolled=false;
        try{db.transaction(()=>{
          for(const sql of input.statements){programs.push({sql,program:db.prepare('EXPLAIN '+sql).all()});db.exec(sql);samples.push(fs.statSync(target+'-wal').size);}
          const sql='INSERT INTO _schema_migrations(id,details) VALUES(?,?)';
          programs.push({sql,program:db.prepare('EXPLAIN '+sql).all(input.marker,input.receipt)});
          db.prepare(sql).run(input.marker,input.receipt);samples.push(fs.statSync(target+'-wal').size);
          if(mode==='rollback')throw Error('LOCAL_FULL_ROLLBACK');
        }).immediate();}catch(e){if(e.message!=='LOCAL_FULL_ROLLBACK')throw e;rolled=true;}
        const final=fs.readFileSync(target+'-wal');fs.writeFileSync(path.join(root,'wal-after-original'),final);
        const value={phase:'AFTER_FORWARD_TRANSACTION',rolled,programs,samples,walBytes:final.length,
          initialPrefixPreserved:initial.equals(final.subarray(0,initial.length)),mainUnchanged:main.equals(fs.readFileSync(target)),
          receiptRows:db.prepare('SELECT count(*) n FROM _schema_migrations').get().n,
          receiptJsonBytes:Buffer.byteLength(input.receipt),integrity:db.pragma('integrity_check',{simple:true}),platform:process.platform,
          actualNativeFrameRequestsMeasured:false,continuousPeakMeasured:false,fullLifetimeOriginalsRetained:false,
          physicalFilesystemClosureClaimed:false,fullApplicationInstallerChainExecuted:false};
        db.close();process.stdout.write(JSON.stringify(value)+'\n');"""
        for label in dirty.LABELS:
            profile=profiles[dirty.LABELS[label]]
            raw=subprocess.check_output(['git','show','be8379745bdfae52ce46496ff26514dc7d729640:'+profile['ddlPath']],cwd=ROOT)
            statements=[];buffer=''
            for line in raw.decode().splitlines(keepends=True):
                buffer+=line
                if sqlite3.complete_statement(buffer):statements.append(buffer);buffer=''
            self.assertFalse(buffer.strip());self.assertEqual(sha(raw),profile['ddlSha256'])
            receipt={'sources':{'migrationSha256':profile['ddlSha256'],'contractVersion':label[:3]+'-v1'},
                'originalRowsSha256':'0'*64,'originalRowsPreserved':True,'backfilledCount':0}
            receipt['receiptSha256']=sha(json.dumps(receipt,separators=(',',':')).encode())
            receipt=json.dumps(receipt,separators=(',',':'))
            for size in (512,4096,65536):
                for mode in ('rollback','commit'):
                    root=directory();data={'receiptSql':native_tests.inventory.RECEIPT_SQL,'marker':profile['receiptMarker'],
                        'receipt':receipt,'statements':statements};(root/'input.json').write_bytes(canonical(data)+b'\n')
                    command=[shutil.which('node'),'-e',program,str(root),str(size),mode,str(root/'input.json')]
                    (root/'native-program.cjs').write_text(program,encoding='utf-8');(root/'native-command.json').write_bytes(canonical(command)+b'\n')
                    child=subprocess.Popen(command,cwd=ROOT/'server',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                    first=child.stdout.readline()
                    try:
                        initial=json.loads(first);self.assertEqual(initial['version'],'3.51.2');self.assertEqual(initial['sourceId'],wal_tests.SOURCE_ID)
                        self.assertGreater(initial['freePages'],0)
                        with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained target SQL')):
                            plan=dirty.dirty_wal_plan(label,root/'baseline/dev.db',initial['schema'])
                        (root/'source-derived-plan.json').write_bytes(canonical(plan)+b'\n')
                    except BaseException:
                        out,err=child.communicate(input=b'REFUSE');(root/'stdout-original.jsonl').write_bytes(first+out)
                        (root/'stderr-original.txt').write_bytes(err);raise
                    out,err=child.communicate(input=b'GO');(root/'stdout-original.jsonl').write_bytes(first+out);(root/'stderr-original.txt').write_bytes(err)
                    self.assertEqual(child.returncode,0,err.decode(errors='replace'));after=json.loads(out)
                    self.assertTrue(after['mainUnchanged']);self.assertEqual(after['integrity'],'ok')
                    self.assertEqual(after['receiptRows'],96 if mode=='rollback' else 97)
                    self.assertEqual(after['receiptJsonBytes'],profile['receiptJsonBytes'])
                    for length in after['samples']+[after['walBytes']]:
                        self.assertLessEqual(length,plan['observation']['bound']['maximumWalLogicalContentBytes'])
                    ops=[row['opcode'] for item in after['programs'] for row in item['program']]
                    native=plan['inventory']['nativeMutationInventory']['operations']
                    self.assertEqual(ops.count('CreateBtree'),native['createdRoots'])
                    self.assertLessEqual(ops.count('SetCookie'),plan['inventory']['maximumCookieWrites'])
                    self.assertLessEqual(ops.count('Clear'),native['createdRoots'])
                    if mode=='rollback':self.assertTrue(after['initialPrefixPreserved'])
                    else:wal.wal_bytes_profile((root/'wal-after-original').read_bytes(),size)
                    self.assertFalse(after['actualNativeFrameRequestsMeasured']);self.assertFalse(after['fullApplicationInstallerChainExecuted'])
