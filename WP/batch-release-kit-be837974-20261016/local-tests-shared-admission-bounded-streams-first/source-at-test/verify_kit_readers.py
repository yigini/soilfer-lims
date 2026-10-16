"""NEW local SQLite fixtures and injected kernel readers; no production I/O."""
import copy
import os
import pathlib
import shutil
import sqlite3
import tempfile
import unittest
import importlib
from unittest import mock
import retained_files as files
import retained_memory as memory
from retained_contract import ROOT,canonical
from retained_health import derive_healthcheck,assert_healthcheck

FIXTURES=pathlib.Path(__file__).parent/'reader-local-retained-fixtures'

class SharedReaderBoundaries(unittest.TestCase):
    def directory(self):
        FIXTURES.mkdir(exist_ok=True)
        return pathlib.Path(tempfile.mkdtemp(prefix='owned-',dir=FIXTURES)).resolve()

    def test_wal_is_folded_only_in_new_reader_and_raw_masters_remain_exact(self):
        root=self.directory();source=root/'synthetic.db';db=sqlite3.connect(source)
        try:
            db.execute('PRAGMA journal_mode=WAL');db.execute('CREATE TABLE synthetic(id INTEGER PRIMARY KEY,value TEXT)')
            db.execute("INSERT INTO synthetic VALUES(1,'SYNTHETIC_ONLY')");db.commit()
            original=files.triple(source)
            self.assertGreater(original['-wal']['bytes'],0)
            backup,state=files.seal(root,'new-seal',source,lambda:None)
            self.assertEqual(state['tables']['synthetic']['count'],1)
            self.assertEqual(files.triple(source),original)
            raw=root/'new-seal/raw/dev.db'
            self.assertEqual(files.identity_record(files.triple(raw)),files.identity_record(original))
            with sqlite3.connect(str(backup)) as check:self.assertEqual(check.execute('SELECT value FROM synthetic').fetchone()[0],'SYNTHETIC_ONLY')
        finally:db.close()

    def test_full_all_column_preservation_refuses_changed_old_value(self):
        root=self.directory();before=root/'before.db';after=root/'after.db'
        with sqlite3.connect(before) as db:
            db.executescript("CREATE TABLE original(id TEXT PRIMARY KEY,value TEXT);INSERT INTO original VALUES('synthetic','SYNTHETIC_OLD');CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY);INSERT INTO _schema_migrations VALUES('old');")
        shutil.copyfile(before,after)
        with sqlite3.connect(after) as db:db.executescript("CREATE TABLE new_evidence(id TEXT);INSERT INTO _schema_migrations VALUES('new');")
        a=files.logical(before);b=files.logical(after)
        self.assertTrue(files.delta_from_state(a,b,after,{'new_evidence'},'new')['allOriginalRowsAndReceiptsPreserved'])
        with sqlite3.connect(after) as db:db.execute("UPDATE original SET value='SYNTHETIC_CHANGED'")
        with self.assertRaises(RuntimeError):files.delta_from_state(a,files.logical(after),after,{'new_evidence'},'new')

    def test_copied_canonical_keeps_unicode_representation(self):
        self.assertEqual(canonical({'value':'\u00e9'}),b'{"value":"\xc3\xa9"}')

    def test_all_adapted_readers_import_without_sql_network_or_process_calls(self):
        names=('retained_files','retained_privacy','retained_provenance','retained_intake','retained_fetch','retained_runtime_policy','retained_health','retained_memory','retained_controller')
        with mock.patch('sqlite3.connect',side_effect=AssertionError('No SQL during import')),mock.patch('subprocess.Popen',side_effect=AssertionError('No process during import')),mock.patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('No network during import')):
            for name in names:importlib.import_module(name)

    def test_unmatched_renamed_failure_site_uses_hmac_without_payload_text(self):
        import retained_privacy as privacy
        with mock.patch.object(privacy,'_value_key',b'S'*32):
            try:raise RuntimeError('SYNTHETIC_PRIVATE_PAYLOAD_ONLY')
            except RuntimeError as error:result=privacy.public_failure(error)
        self.assertEqual(set(result),{'errorType','errorHmacSha256'})
        self.assertEqual(len(result['errorHmacSha256']),64)
        self.assertNotIn('SYNTHETIC_PRIVATE_PAYLOAD_ONLY',str(result))

    def test_exact_owned_identity_rejects_old_proof_owner_or_restarted_pid(self):
        identity='a'*64;owner=str(ROOT)+':candidate'
        value={'Id':identity,'Config':{'Labels':{'io.soilfer.release-owned':owner}},'State':{'Running':True,'OOMKilled':False,'Pid':123,'StartedAt':'SYNTHETIC_TIME'},'RestartCount':0,'HostConfig':{'Memory':805306368,'MemorySwap':805306368}}
        memory.container_identity(value,identity,owner)
        for mutation in ({'RestartCount':1},{'State':{**value['State'],'Pid':0}},{'HostConfig':{'Memory':805306368,'MemorySwap':1610612736}}):
            with self.assertRaises(RuntimeError):memory.container_identity({**value,**mutation},identity,owner)
        old='/opt/lims/releases/workflow-batch-mount-order-forward-be837974-20261016T100000Z:startup-2'
        with self.assertRaises(RuntimeError):memory.container_identity({**value,'Config':{'Labels':{'io.soilfer.release-owned':old}}},identity,old)

    def test_peak_is_observation_but_any_oom_or_75_percent_overrun_refuses(self):
        sample={'memoryPeakBytesObservation':806625280,'memoryMaxBytes':805306368,'memorySwapMaxBytes':0,
                'memoryEvents':dict.fromkeys(memory.EVENT_REQUIRED,0),'memoryStat':dict.fromkeys(memory.STAT_REQUIRED,0)}
        self.assertEqual(memory.gate(sample),0)
        for counter in ('oom','oom_kill'):
            changed=copy.deepcopy(sample);changed['memoryEvents'][counter]=1
            with self.assertRaises(RuntimeError):memory.gate(changed)
        changed=copy.deepcopy(sample);changed['memoryStat']['anon']=603979777
        with self.assertRaises(RuntimeError):memory.gate(changed)

    def test_same_compose_health_parameters_and_every_field_guard_remain(self):
        raw=(pathlib.Path(__file__).parent/'compose-source.yml').read_bytes();derived=derive_healthcheck(raw)
        expected=derived['expectedDockerHealthcheck'];assert_healthcheck(expected,derived)
        for key in expected:
            changed=copy.deepcopy(expected);changed[key]=0 if key!='Test' else ['CMD','false']
            with self.assertRaises(RuntimeError):assert_healthcheck(changed,derived)
        with self.assertRaises(RuntimeError):derive_healthcheck(raw+b' ')

if __name__=='__main__':unittest.main()
