"""NEW LOCAL future backup observations; no owner/runtime admission."""
import copy,json,pathlib,shutil,sqlite3,tempfile,unittest
from unittest.mock import patch
import kit_backup_source_binding as binding
from kit_backup_main import PAGES,LIMIT,TERMINATIONS
from kit_contract import canonical,sha

HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[1]
FIXTURES=HERE/'backup-binding-local-retained-fixtures'
def directory():
    FIXTURES.mkdir(exist_ok=True);return pathlib.Path(tempfile.mkdtemp(prefix='bb-',dir=FIXTURES)).resolve()
def fixture(page=4096,wal=True):
    root=directory();reader=root/'reader';reader.mkdir();path=reader/'dev.db'
    writer=sqlite3.connect(path);writer.execute('PRAGMA page_size='+str(page));writer.execute('PRAGMA journal_mode='+('WAL' if wal else 'DELETE'));writer.execute('PRAGMA wal_autocheckpoint=0')
    writer.execute('CREATE TABLE data(id INTEGER PRIMARY KEY,value BLOB)');writer.executemany('INSERT INTO data VALUES(?,?)',[(n,bytes([n])*8192) for n in range(1,25)]);writer.commit()
    db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True);db.execute('PRAGMA temp_store=MEMORY');db.execute('PRAGMA query_only=ON');db.execute('BEGIN');db.execute('SELECT count(*) FROM main.sqlite_schema').fetchone()
    return root,writer,db

class BackupBinding(unittest.TestCase):
    def observation(self,db):return binding.collect_backup_snapshot(db,binding.declared_observation_entry())
    def test_complete_source_pins_actual_callers_journal_and_native_metadata_ranges(self):
        proof,digest=binding.source_proof();self.assertEqual(digest,sha((HERE/binding.PROOF).read_bytes()))
        raw=(ROOT/proof['nativeSource']['path']).read_bytes()
        for row in proof['nativeExcerpts']:self.assertEqual(raw[row['startByte']:row['endByte']].decode(),row['text'])
        self.assertEqual(proof['journalProofSha256'],sha((HERE/'live-backup-sqlite-source.json').read_bytes()))
        texts={x['label']:x['text'] for x in proof['nativeExcerpts']}
        self.assertIn('OP_Pagecount',texts['backup_observer_pagecount']);self.assertIn('sqlite3BtreeGetPageSize',texts['backup_observer_pagesize'])
        self.assertTrue(any('pages=256' in x['text'] for x in proof['callerExcerpts']))
    def test_complete_main_plus_full_journal_all_pages_profiles_and_terminations(self):
        root,writer,db=fixture()
        try:
            value=self.observation(db)
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                for p in PAGES:
                    v=copy.deepcopy(value);v['observedPageSize']=p;v['observedPageCount']=257
                    for profile in ('node-live-backup','python-owned-seal'):
                        for end in TERMINATIONS:
                            plan=binding.conditional_backup_charge(canonical(v)+b'\n',profile,end);binding.replay_backup_charge(plan)
                            self.assertEqual(plan['completeMainAndJournalLayout']['contentBytes'],257*p+131072)
                            self.assertEqual(plan['completeMainAndJournalLayout']['fileCount'],2)
                            self.assertFalse(plan['destinationActualEqualPageSizeObserved']);self.assertFalse(plan['beforeDestinationCreateHeldAdmissionImplemented'])
                v=copy.deepcopy(value);v['observedPageSize']=512;v['observedPageCount']=LIMIT//512
                with self.assertRaises(RuntimeError):binding.conditional_backup_charge(canonical(v)+b'\n','node-live-backup','commit')
                v['observedPageCount']=(LIMIT-131072)//512
                plan=binding.conditional_backup_charge(canonical(v)+b'\n','node-live-backup','commit');self.assertEqual(plan['completeMainAndJournalLayout']['roundedContentBytes'],LIMIT)
        finally:db.close();writer.close()
    def test_future_entry_settings_attached_database_and_complete_original_refusals(self):
        root,writer,db=fixture()
        try:
            value=self.observation(db)
            for key,v in binding.declared_observation_entry().items():
                if v is True:
                    with self.assertRaises(RuntimeError):binding.collect_backup_snapshot(db,{**binding.declared_observation_entry(),key:False})
            for k,x in [('version',True),('observedPageCount',True),('observedPageCount',0),('observedPageSize',True),('observedPageSize',513),('readerPath',[]),('foreign',1),('collectorEngineVersion','')]:
                bad={**value,k:x}
                with self.assertRaises(RuntimeError):binding.original_snapshot(canonical(bad)+b'\n')
            for key in binding.FALSE_FIELDS:
                with self.assertRaises(RuntimeError):binding.validate_snapshot({**value,key:True})
            with self.assertRaises(RuntimeError):binding.original_snapshot(canonical(value))
            db.execute('PRAGMA query_only=OFF')
            with self.assertRaises(RuntimeError):self.observation(db)
            db.execute('PRAGMA query_only=ON');db.execute("ATTACH ':memory:' AS extra")
            with self.assertRaises(RuntimeError):self.observation(db)
        finally:db.close();writer.close()
    def test_whole_original_nested_main_journal_and_authority_replay_refuses(self):
        root,writer,db=fixture()
        try:
            plan=binding.conditional_backup_charge(canonical(self.observation(db))+b'\n','python-owned-seal','finish-after-first-error')
            for fault in ('count','original-pin','journal','main','layout','authority','extra'):
                b=copy.deepcopy(plan)
                if fault=='count':b['snapshotOriginal']['observedPageCount']+=1
                elif fault=='original-pin':b['snapshotOriginalPin']['bytes']-=1
                elif fault=='journal':b['fullJournalLogicalChargeBytes']=0
                elif fault=='main':b['mainPlan']['producerInventory'].pop()
                elif fault=='layout':b['completeMainAndJournalLayout']['contentBytes']=0
                elif fault=='authority':b['destinationActualEqualPageSizeObserved']=True
                else:b['extra']=True
                with self.assertRaises(RuntimeError):binding.replay_backup_charge(b)
        finally:db.close();writer.close()
    def test_descriptor_recheck_inode_substitution_and_before_create_namespace_refusals(self):
        root,writer,db=fixture(wal=False)
        try:
            plan=binding.conditional_backup_charge(canonical(self.observation(db))+b'\n','node-live-backup','finish-after-prefix')
            db.close();writer.close()
            target=root/'destination.db'
            with patch.object(sqlite3,'connect',side_effect=AssertionError('Descriptor-only replay')):
                binding.recheck_backup_source(plan);check=binding.check_unused_destination(plan,str(target))
                self.assertFalse(check['destinationCreatedOrReserved']);self.assertFalse(target.exists())
                side=pathlib.Path(str(target)+'-shm');side.write_bytes(b'held')
                with self.assertRaises(RuntimeError):binding.check_unused_destination(plan,str(target))
                p=pathlib.Path(plan['snapshotOriginal']['readerPath']);replacement=p.parent/'same-bytes.db';shutil.copyfile(p,replacement);replacement.replace(p)
                with self.assertRaises(RuntimeError):binding.recheck_backup_source(plan)
                binding.replay_backup_charge(plan)  # package replay does not claim to observe current target
        finally:db.close();writer.close()
    def test_new_complete_source_copy_same_length_native_caller_module_and_journal_mutations(self):
        proof,_=binding.source_proof();root=directory();tool=root/HERE.relative_to(ROOT)
        for name in proof['files']:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,p)
        (tool/binding.PROOF).write_bytes((HERE/binding.PROOF).read_bytes())
        with patch.object(binding,'__file__',str(tool/'kit_backup_source_binding.py')):
            binding.source_proof()
            for name in (proof['nativeSource']['path'],*((HERE/n).relative_to(ROOT).as_posix() for n in ('kit_backup_source_binding.py','retained_files.py','live_backup.cjs','live-backup-sqlite-source.json'))):
                p=root/name;raw=p.read_bytes();p.write_bytes(bytes([raw[0]^1])+raw[1:])
                with self.assertRaisesRegex(RuntimeError,'source changed'):binding.source_proof()
                p.write_bytes(raw)
    def test_actual_new_python_wal_snapshots_and_backups_at_three_page_sizes(self):
        for page in (512,4096,65536):
            root,writer,db=fixture(page)
            try:
                observation=self.observation(db);raw=canonical(observation)+b'\n';(root/'snapshot-original.json').write_bytes(raw)
                plan=binding.conditional_backup_charge(raw,'python-owned-seal','commit');(root/'plan-before-backup.json').write_bytes(canonical(plan)+b'\n')
                target=root/'destination.db';binding.check_unused_destination(plan,str(target))
                with target.open('xb'):pass
                after=sqlite3.connect(target);after.execute('PRAGMA temp_store=MEMORY');after.execute('PRAGMA journal_mode=MEMORY')
                try:db.backup(after,pages=256,sleep=0.05);after.execute('PRAGMA journal_mode=MEMORY');rows,payload=after.execute('SELECT count(*),sum(length(value)) FROM data').fetchone()
                finally:after.close()
                binding.recheck_backup_source(plan)
                result={'observedPageSize':observation['observedPageSize'],'observedPageCount':observation['observedPageCount'],
                    'collectorEngineVersion':observation['collectorEngineVersion'],'sourceMainBytes':observation['originalFiles']['']['bytes'],
                    'sourceWalBytes':observation['originalFiles']['-wal']['bytes'],'backupBytes':target.stat().st_size,'rows':rows,'payloadBytes':payload,
                    'sourceOriginalRechecked':True,'planPrecedesDestinationCreate':True,'runtimeBinaryBindingVerified':False,
                    'nativePagerOrFileRequestsMeasured':False,'physicalFilesystemClosureClaimed':False}
                (root/'python-case-result.json').write_bytes(canonical(result)+b'\n')
                self.assertEqual(result['observedPageSize'],page);self.assertEqual(result['backupBytes'],observation['observedPageCount']*page)
                self.assertEqual(rows,24);self.assertEqual(payload,24*8192);self.assertGreater(result['sourceWalBytes'],32)
                self.assertFalse(plan['actualPythonWrapperToNativeBindingVerified'])
                with self.assertRaises(RuntimeError):binding.check_unused_destination(plan,str(target))
            finally:db.close();writer.close()
