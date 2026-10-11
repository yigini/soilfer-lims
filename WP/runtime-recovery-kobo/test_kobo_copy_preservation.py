"""Owned SQLite regression fixtures for the read-only copy preservation guard."""
import json
import contextlib
import pathlib
import shutil
import sqlite3
import tempfile
import unittest
from kobo_copy_preservation import verify_copy

SCHEMA = '''
CREATE TABLE Sample(id TEXT PRIMARY KEY,assignedLab TEXT,projectCode TEXT,status TEXT,labId TEXT,metadata TEXT);
CREATE TABLE AuditLog(id TEXT PRIMARY KEY,entity TEXT,entityId TEXT,action TEXT,performedBy TEXT,sampleId TEXT,labId TEXT,after TEXT);
CREATE TABLE SampleHold(id TEXT PRIMARY KEY,sampleId TEXT,type TEXT,raisedBy TEXT,compatMarker TEXT,attributionSource TEXT,resolvedBy TEXT,resolvedAt TEXT,resolution TEXT,raisedAt INTEGER);
CREATE TABLE Notification(id TEXT PRIMARY KEY,userId TEXT,title TEXT,message TEXT,type TEXT,isRead INTEGER,link TEXT);
CREATE TABLE KoboConfig(id TEXT PRIMARY KEY,labId TEXT,projectCode TEXT,formId TEXT,koboServerUrl TEXT,apiToken TEXT,isActive INTEGER,lastSubmissionId TEXT,lastSyncAt TEXT,updatedAt TEXT,syncIntervalMins INTEGER);
CREATE TABLE User(id TEXT PRIMARY KEY,labId TEXT,isActive INTEGER,role TEXT);
CREATE TABLE Result(id TEXT PRIMARY KEY,value TEXT);
CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,receipt TEXT);
'''


class CopyGuardTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='lims-owned-copy-guard-')
        self.addCleanup(self.directory.cleanup)
        self.prior = pathlib.Path(self.directory.name) / 'baseline.db'
        self.current = pathlib.Path(self.directory.name) / 'current.db'
        with contextlib.closing(sqlite3.connect(self.prior)) as db, db:
            db.executescript(SCHEMA)
            db.execute("INSERT INTO Sample VALUES('old','ZMB','P','APPROVED',NULL,'original')")
            db.execute("INSERT INTO AuditLog VALUES('old-audit','SAMPLE','old','APPROVE','human','old','ZMB',NULL)")
            db.execute("INSERT INTO KoboConfig VALUES('cfg','ZMB','P','form','https://kobo.example','synthetic-secret',1,'6','old-clock','old-clock',15)")
            db.execute("INSERT INTO User VALUES('manager','ZMB',1,'LAB_MANAGER')")
            db.execute("INSERT INTO User VALUES('other','OTHER',1,'LAB_MANAGER')")
            db.execute("INSERT INTO Result VALUES('scientific','123')")
            db.execute("INSERT INTO _schema_migrations VALUES('receipt','immutable')")
        shutil.copyfile(self.prior, self.current)

    def mutate(self, sql, parameters=()):
        with contextlib.closing(sqlite3.connect(self.current)) as db, db:
            db.execute(sql, parameters)

    def verify(self, previous_ids=None, fetched_ids=None):
        return verify_copy(self.prior, self.current, expected_table_count=8, prior_fetched_ids=previous_ids,
            fetched_ids={'cfg': ['7', '8']} if fetched_ids is None else fetched_ids)

    def intake(self, submission_id='7', lab='ZMB'):
        meta = json.dumps({'sourceFormId': 'form', 'sourceServerUrl': 'https://kobo.example', 'kobo_id': submission_id})
        self.mutate("INSERT INTO Sample VALUES('new',?,'P','EXPECTED',NULL,?)", (lab, meta))
        self.mutate("INSERT INTO AuditLog VALUES('new-audit','SAMPLE','new','CREATE_KOBO_SYNC','KOBO_SCHEDULER','new',?,NULL)", (lab,))

    def test_no_changes_and_secret_not_serialized(self):
        result = self.verify()
        self.assertTrue(result['allOriginalRowsPreserved'])
        self.assertNotIn('synthetic-secret', json.dumps(result))
        self.assertEqual(result['copySyncIntervalMins'], {'cfg': 15})

    def test_scoped_intake_audit_notification_and_cursor(self):
        self.intake()
        self.mutate("INSERT INTO Notification VALUES('notice','manager','🌾 New Field Samples Collected','1 new sample synced from Kobo (Zambia)','SUCCESS',0,'/samples?view=expected&projects=P&labs=ZMB')")
        self.mutate("UPDATE KoboConfig SET lastSubmissionId='7',lastSyncAt='new-clock',updatedAt='new-clock'")
        result = self.verify()
        self.assertEqual(result['newSubmissionIds'], {'cfg': ['7']})
        self.assertEqual(len(result['additions']['Notification']), 1)

    def test_original_sample_protected(self):
        self.mutate("UPDATE Sample SET metadata='changed' WHERE id='old'")
        with self.assertRaisesRegex(RuntimeError, 'Original row changed: Sample'):
            self.verify()

    def test_scientific_result_protected(self):
        self.mutate("UPDATE Result SET value='456'")
        with self.assertRaisesRegex(RuntimeError, 'Protected rows changed: Result'):
            self.verify()

    def test_original_audit_protected(self):
        self.mutate("UPDATE AuditLog SET action='REVISED'")
        with self.assertRaisesRegex(RuntimeError, 'Original row changed: AuditLog'):
            self.verify()

    def test_deleted_sample_refuses(self):
        self.mutate("DELETE FROM Sample WHERE id='old'")
        with self.assertRaisesRegex(RuntimeError, 'Original row disappeared: Sample'):
            self.verify()

    def test_foreign_intake_refuses(self):
        self.intake(lab='OTHER')
        with self.assertRaisesRegex(RuntimeError, 'exact active config provenance'):
            self.verify()

    def test_api_token_is_protected(self):
        self.mutate("UPDATE KoboConfig SET apiToken='changed'")
        with self.assertRaisesRegex(RuntimeError, 'Protected Kobo config field'):
            self.verify()

    def test_second_sync_clock_updates_only(self):
        self.mutate("UPDATE KoboConfig SET lastSyncAt='new-clock',updatedAt='new-clock'")
        result = self.verify({'cfg': ['7']})
        self.assertFalse(any(result['additions'].values()))

    def test_second_sync_repeated_intake_refuses(self):
        self.intake()
        with self.assertRaisesRegex(RuntimeError, 'duplicated prior fetched intake'):
            self.verify({'cfg': ['7']})

    def test_second_sync_genuinely_new_id_enumerated(self):
        self.intake(submission_id='8')
        self.mutate("UPDATE KoboConfig SET lastSubmissionId='8'")
        result = self.verify({'cfg': ['7']})
        self.assertEqual(result['newSubmissionIds'], {'cfg': ['8']})

    def test_second_sync_cursor_without_intake_refuses(self):
        self.mutate("UPDATE KoboConfig SET lastSubmissionId='8'")
        with self.assertRaisesRegex(RuntimeError, 'Cursor changed outside enumerated upstream intake'):
            self.verify({'cfg': ['7']}, {'cfg': ['7']})

    def test_second_sync_genuine_new_skip_may_advance_cursor(self):
        self.mutate("UPDATE KoboConfig SET lastSubmissionId='8'")
        result = self.verify({'cfg': ['7']})
        self.assertFalse(any(result['additions'].values()))

    def test_intake_must_match_upstream_record(self):
        self.intake()
        with self.assertRaisesRegex(RuntimeError, 'retained upstream fetch ids'):
            self.verify(fetched_ids={'cfg': ['8']})

    def test_kobo_hold_and_immutable_audit_bind_same_row(self):
        self.intake()
        hold = {'id': 'hold', 'sampleId': 'new', 'type': 'PROVENANCE', 'raisedBy': 'system:kobo-sync',
            'compatMarker': 'KOBO_PROVENANCE', 'attributionSource': 'LIVE', 'resolvedBy': None,
            'resolvedAt': None, 'resolution': None, 'raisedAt': '1970-01-01T00:00:00.000Z'}
        self.mutate("INSERT INTO SampleHold VALUES('hold','new','PROVENANCE','system:kobo-sync','KOBO_PROVENANCE','LIVE',NULL,NULL,NULL,0)")
        self.mutate("INSERT INTO AuditLog VALUES('hold-audit','SAMPLE_HOLD','hold','HOLD_RAISED','system:kobo-sync','new','ZMB',?)", (json.dumps(hold),))
        self.assertEqual(len(self.verify()['additions']['SampleHold']), 1)

    def test_wrong_manager_notification_refuses(self):
        self.intake()
        self.mutate("INSERT INTO Notification VALUES('notice','other','🌾 New Field Samples Collected','1 new sample synced from Kobo (Zambia)','SUCCESS',0,'/samples?view=expected&projects=P&labs=ZMB')")
        with self.assertRaisesRegex(RuntimeError, 'manager scope'):
            self.verify()

    def test_hold_on_existing_sample_refuses(self):
        self.mutate("INSERT INTO SampleHold VALUES('hold','old','PROVENANCE','system:kobo-sync','KOBO_PROVENANCE','LIVE',NULL,NULL,NULL,0)")
        with self.assertRaisesRegex(RuntimeError, 'protected original Sample'):
            self.verify()

    def test_unapproved_audit_refuses(self):
        self.mutate("INSERT INTO AuditLog VALUES('new-audit','SAMPLE','old','ACCEPT','KOBO_SCHEDULER','old','ZMB',NULL)")
        with self.assertRaisesRegex(RuntimeError, 'Unapproved Sample audit'):
            self.verify()

    def test_old_receipt_protected(self):
        self.mutate("UPDATE _schema_migrations SET receipt='changed'")
        with self.assertRaisesRegex(RuntimeError, 'Protected rows changed: _schema_migrations'):
            self.verify()

    def test_schema_change_refuses(self):
        self.mutate('ALTER TABLE Result ADD COLUMN override TEXT')
        with self.assertRaisesRegex(RuntimeError, 'schema changed'):
            self.verify()


if __name__ == '__main__':
    unittest.main(verbosity=2)
