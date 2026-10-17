"""Actual NEW LOCAL SQLite readers/seals; no Linux, Docker or scientific owner."""
import copy
import json
import pathlib
import shutil
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import kit_schema_collection as collector
import retained_files as retained
from kit_contract import canonical,sha
from retained_contract import exact_json
from kit_capture_native_inventory import RECEIPT_SQL

HERE=pathlib.Path(__file__).resolve().parent
FIXTURES=HERE/'schema-collection-local-retained-fixtures'


def directory():
    FIXTURES.mkdir(exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='new-',dir=FIXTURES)).resolve()


def fixture(extra='',wal=False):
    root=directory();source=root/'new-source.db';db=sqlite3.connect(source)
    if wal:
        db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA wal_autocheckpoint=0')
    db.execute(RECEIPT_SQL);db.execute('CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY)')
    db.execute('CREATE TABLE old_rows(id INTEGER PRIMARY KEY,value TEXT UNIQUE)')
    db.execute("INSERT INTO old_rows VALUES(1,'PRESERVE')")
    db.execute("INSERT INTO _schema_migrations(id,details) VALUES('old','old receipt')")
    if extra:db.executescript(extra)
    db.commit()
    return root,source,db


def seal_fixture(extra='',wal=False):
    root,source,db=fixture(extra,wal)
    before=retained.identity_record(retained.triple(source))
    backup,state=retained.seal(root,'capture-prepared-206',source,lambda:None,
        schema_original='capture-schema-206.json')
    observation=exact_json((root/'capture-schema-206.json').read_bytes())
    return root,source,db,backup,state,observation,before


class FullSchemaCollection(unittest.TestCase):
    def test_real_wal_owned_reader_full_internal_schema_same_transaction_and_new_backup(self):
        root,source,db=fixture('ANALYZE',True);calls=[];connect=sqlite3.connect
        def watched(path,*args,**kwargs):
            text=str(path).replace('\\','/');calls.append(text)
            self.assertNotEqual(text,str(source));self.assertNotIn('/raw/',text)
            connection=connect(path,*args,**kwargs)
            connection.set_trace_callback(lambda sql:calls.append(('SQL',sql)))
            return connection
        try:
            with patch.object(retained.sqlite3,'connect',watched):
                backup,state=retained.seal(root,'capture-prepared-206',source,lambda:None,
                    schema_original='capture-schema-206.json')
            value=exact_json((root/'capture-schema-206.json').read_bytes())
            names={row[1]:row for row in value['schema']['rows']}
            self.assertIn('sqlite_stat1',names)
            self.assertIsNone(names['sqlite_autoindex__schema_migrations_1'][4])
            self.assertGreater(names['sqlite_autoindex__schema_migrations_1'][3],1)
            self.assertNotIn('sqlite_stat1',{row[1] for row in state['objects']})
            self.assertEqual(retained.logical(backup,True),(state,value['schema']))
            self.assertEqual(value['logicalStateOriginal'],{'bytes':len((root/'capture-prepared-206/logical-state.json').read_bytes()),
                'sha256':sha((root/'capture-prepared-206/logical-state.json').read_bytes())})
            self.assertEqual(value['copiedSourceDbWalShm'],value['rawDbWalShm'])
            statements=[v[1] for v in calls if type(v) is tuple]
            self.assertEqual(statements.count(collector.FULL_SCHEMA_SQL),2)
            for i,sql in enumerate(statements):
                if sql==collector.FULL_SCHEMA_SQL:
                    self.assertIn('BEGIN',statements[:i]);self.assertIn('PRAGMA integrity_check',statements[:i])
            self.assertTrue(value['sameReadTransactionAsLogicalState'])
            self.assertFalse(value['independentSchemaToPrivateDbBytesProof'])
        finally:db.close()

    def test_actual_receipt_trigger_and_index_are_collected_and_rejected_by_bound_native_profile(self):
        for extra in ("CREATE TRIGGER receipt_extra AFTER INSERT ON _schema_migrations BEGIN DELETE FROM old_rows; END;",
            "CREATE INDEX receipt_extra ON _schema_migrations(details)"):
            root,source,db,backup,state,value,before=seal_fixture(extra)
            try:
                self.assertIn('receipt_extra',{row[1] for row in value['schema']['rows']})
                with patch.object(sqlite3,'connect',side_effect=AssertionError('No retained target SQL')):
                    with self.assertRaisesRegex(RuntimeError,'Extra or missing receipt'):
                        collector.schema_bound_native_plan('capture-214-prepare',value,source)
                self.assertEqual(before,retained.identity_record(retained.triple(source)))
            finally:db.close()

    def test_real_bound_pre206_clone_checks_complete_source_bytes_without_target_sql(self):
        root,source,db=fixture()
        try:
            backup,state=retained.seal(root,'fresh-production-snapshot',source,lambda:None,
                schema_original='capture-schema-initial.json')
            value=exact_json((root/'capture-schema-initial.json').read_bytes())
            target=root/'new-clone.db';shutil.copyfile(backup,target);target.chmod(0o600)
            before=retained.triple(target)
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No target SQL')):
                plan=collector.schema_bound_native_plan('capture-206-prepare',value,target)
            self.assertTrue(plan['collectorSourceByteBindingVerified'])
            self.assertEqual(plan['bound']['createdRoots'],7)
            self.assertEqual(plan['bound']['nativeDeleteCalls'],2)
            for key in ('callerReviewVerified','writerGraphAdmissionImplemented',
                'mainFileLengthOrVfsPreallocationBounded','physicalFilesystemClosureClaimed'):
                self.assertIs(plan[key],False)
            self.assertEqual(before,retained.triple(target))
            with sqlite3.connect(target) as changed:changed.execute("UPDATE old_rows SET value='CHANGED'")
            with self.assertRaisesRegex(RuntimeError,'Target bytes differ'):
                collector.schema_bound_native_plan('capture-206-prepare',value,target)
        finally:db.close()

    def test_before_seal_creation_refuses_consumed_or_wrong_schema_original_and_utf16(self):
        root,source,db=fixture()
        try:
            with self.assertRaises(RuntimeError):retained.seal(root,'capture-prepared-206',source,lambda:None,
                schema_original='capture-schema-initial.json')
            self.assertFalse((root/'capture-prepared-206').exists())
            retained.seal(root,'capture-prepared-206',source,lambda:None,schema_original='capture-schema-206.json')
            before={p.name for p in root.iterdir()}
            with self.assertRaises(RuntimeError):retained.seal(root,'capture-prepared-206',source,lambda:None,
                schema_original='capture-schema-206.json')
            self.assertEqual(before,{p.name for p in root.iterdir()})
        finally:db.close()
        root=directory();source=root/'utf16.db'
        with sqlite3.connect(source) as db:db.execute("PRAGMA encoding='UTF-16le'");db.execute('CREATE TABLE t(id TEXT)')
        with self.assertRaisesRegex(RuntimeError,'UTF-8'):retained.logical(source,True)

    def test_full_rows_never_clipped_and_read_transaction_and_authority_types_are_strict(self):
        root,source,db=fixture()
        try:
            with self.assertRaises(RuntimeError):collector.collect_full_schema(db)
            with patch.object(collector,'SCHEMA_LIMIT',512):
                with self.assertRaisesRegex(RuntimeError,'no rows may be omitted'):retained.logical(source,True)
            backup,state=retained.seal(root,'capture-prepared-206',source,lambda:None,
                schema_original='capture-schema-206.json')
            original=exact_json((root/'capture-schema-206.json').read_bytes())
            for fault in ('version','root','foreign','authority','source','schema-sha'):
                bad=copy.deepcopy(original)
                if fault=='version':bad['version']=True
                if fault=='root':bad['schema']['rows'][0][3]=True;bad['schemaSha256']=sha(canonical(bad['schema']))
                if fault=='foreign':bad['unknown']=True
                if fault=='authority':bad['writerGraphAdmissionImplemented']=True
                if fault=='source':bad['copiedSourceDbWalShm']['']['sha256']='f'*64
                if fault=='schema-sha':bad['schemaSha256']='f'*64
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):collector.validate_observation(bad)
        finally:db.close()

    def test_full_source_pins_detect_same_size_caller_mutation_in_new_local_copy(self):
        value=exact_json((HERE/collector.PROOF).read_bytes());root=directory()
        for name in (*value['files'],collector.PROOF):shutil.copyfile(HERE/name,root/name)
        with patch.object(collector,'__file__',str(root/'kit_schema_collection.py')):
            self.assertEqual(collector.collection_proof(),sha((root/collector.PROOF).read_bytes()))
            source=root/'kit_capture_science.py';data=source.read_bytes();source.write_bytes(b'#'+data[1:])
            with self.assertRaisesRegex(RuntimeError,'source changed'):collector.collection_proof()

    def test_package_replays_every_schema_original_and_source_chain_without_sql(self):
        import verify_kit_capture_review as fixtures
        import kit_capture_review as review
        with fixtures.review_fixture() as current:
            receipt=current.review_controller.execute()
            files={name:(current.root/name).read_bytes() for name in receipt['files']}
            with patch.object(sqlite3,'connect',side_effect=AssertionError('No package target SQL')):
                result=collector.verify_schema_originals(files)
            self.assertEqual(result['completeSchemaOriginalsReplayed'],3)
            self.assertEqual(len(receipt['files']),28)
            for name in collector.SCHEMA_ORIGINALS:
                missing=dict(files);del missing[name]
                with self.subTest(name=name),self.assertRaises(RuntimeError):collector.verify_schema_originals(missing)
            for fault in ('source','backup','preservation','proof','authority','noncanonical'):
                changed=dict(files);name='capture-schema-206.json';value=exact_json(changed[name])
                if fault=='source':
                    for key in ('copiedSourceDbWalShm','rawDbWalShm','readerBeforeDbWalShm','readerAfterDbWalShm'):
                        value[key]['']['sha256']='f'*64
                elif fault=='backup':value['backup']['bytes']=1
                elif fault=='preservation':
                    name='capture-206-preservation.json';value=exact_json(changed[name]);value['fullSchemaOriginal']['sha256']='f'*64
                elif fault=='proof':value['collectorProofSha256']='f'*64
                elif fault=='authority':value['independentSchemaToPrivateDbBytesProof']=True
                changed[name]=canonical(value)+(b'\n ' if fault=='noncanonical' else b'\n')
                with self.subTest(direct=fault),self.assertRaises(RuntimeError):collector.verify_schema_originals(changed)
                if name=='capture-206-preservation.json':
                    scientific=exact_json(changed['actual-scientific-impact.json'])
                    scientific['preparationReferences']['206']['preservation'].update(bytes=len(changed[name]),sha256=sha(changed[name]))
                    changed['actual-scientific-impact.json']=canonical(scientific)+b'\n'
                rebound=copy.deepcopy(receipt)
                rebound['scienceSha256']=sha(canonical(exact_json(changed['actual-scientific-impact.json'])))
                rebound['files']={n:{'bytes':len(raw),'sha256':sha(raw)} for n,raw in changed.items()}
                with self.subTest(fault=fault),self.assertRaises(RuntimeError):
                    review.verify_capture_receipt(rebound,lambda n:changed[n],current.index,current.review)
