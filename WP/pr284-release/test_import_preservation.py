"""Pure owned-snapshot guards for the proposed #200 verifier; no live DB."""
import hashlib
import json
import pathlib
import sqlite3
import tempfile
import unittest

import import_preservation as verifier

ASSET_ROOT = pathlib.Path(__file__).resolve().parents[2] / 'server/prisma/migrations/20261010000100_instrument_import_templates'
ORIGINAL_HASH = 'a' * 64


class ImportPreservationGuards(unittest.TestCase):
    def setUp(self):
        self.owned = tempfile.TemporaryDirectory(prefix='owned-import-guard-')
        self.root = pathlib.Path(self.owned.name)
        self.before = self.root / 'before.db'
        self.after = self.root / 'after.db'
        self.source = verifier.assets(ASSET_ROOT)
        self.make_pair()

    def tearDown(self):
        self.owned.cleanup()

    def make_pair(self, variant='preFresh'):
        db = sqlite3.connect(self.before)
        db.executescript('''CREATE TABLE Lab(id TEXT PRIMARY KEY, code TEXT);
            CREATE TABLE EquipmentAsset(id TEXT PRIMARY KEY, labId TEXT);
            CREATE TABLE WorkItem(id TEXT PRIMARY KEY);
            CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY, appliedAt TEXT, details TEXT);
            INSERT INTO WorkItem VALUES ('owned-work');
            INSERT INTO Lab VALUES ('owned-lab','OWNED');
            INSERT INTO EquipmentAsset VALUES ('owned-equipment','owned-lab');''')
        db.executescript(json.loads(self.source['post205-draft-tables.json'])[variant])
        db.execute('''INSERT INTO WorkItemDraft(id,workItemId,sampleId,userId,analysis,value,records,updatedAt)
            VALUES ('owned-draft','owned-work','owned-sample','owned-user','P','1.20',?, 'owned-time')''',
            ('{"literal":"é\\n中","null":null}',))
        for number in range(99):
            db.execute('CREATE TABLE owned_' + str(number) + '(id TEXT PRIMARY KEY, value, raw BLOB)')
            db.execute('INSERT INTO owned_' + str(number) + ' VALUES (?,?,?)',
                ('original', 'unicode-é中-"-\\', bytes([0, 255, number])))
        for number in range(38):
            db.execute('INSERT INTO _schema_migrations VALUES (?,?,?)',
                ('old-' + str(number), 'retained-time', '{"retained":true}'))
        db.commit()
        candidate = sqlite3.connect(self.after)
        db.backup(candidate)
        db.close()
        candidate.executescript(self.source['migration.sql'])
        self.receipt = {'sources': verifier.SOURCES, 'originalRowsSha256': ORIGINAL_HASH,
            'originalRowsPreserved': True, 'newTemplateCount': 0, 'newReceiptCount': 0, 'backfilledCount': 0}
        self.receipt['receiptSha256'] = hashlib.sha256(json.dumps(self.receipt,
            ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        candidate.execute('INSERT INTO _schema_migrations VALUES (?,?,?)',
            (verifier.MARKER, 'new-install-time', json.dumps(self.receipt, ensure_ascii=False, separators=(',', ':'))))
        candidate.commit()
        candidate.close()

    def mutate(self, sql, values=()):
        db = sqlite3.connect(self.after)
        db.execute(sql, values)
        db.commit()
        db.close()

    def verify(self):
        return verifier.verify_import_installation(self.before, self.after, ASSET_ROOT, ORIGINAL_HASH)

    def refused(self, text):
        with self.assertRaisesRegex(RuntimeError, text):
            self.verify()

    def test_exact_additive_delta_passes_and_preserves_raw_bytes(self):
        before, after = verifier.digest(self.before), verifier.digest(self.after)
        result = self.verify()
        self.assertEqual(result['status'], 'READ_ONLY_EXACT_IMPORT_DELTA_PASS')
        self.assertEqual((result['originalTableCount'], result['candidateTableCount']), (104, 106))
        self.assertEqual((result['originalReceiptCount'], result['candidateReceiptCount']), (38, 39))
        self.assertEqual(len(result['originalRows']), 104)
        self.assertEqual((verifier.digest(self.before), verifier.digest(self.after)), (before, after))

    def test_native_upgraded_records_predecessor_passes(self):
        # A second owned pair uses the exact other captured #205 predecessor.
        self.before = self.root / 'upgraded-before.db'
        self.after = self.root / 'upgraded-after.db'
        self.make_pair('preUpgraded')
        self.assertEqual(self.verify()['scientificChanges'], 0)

    def test_original_value_change_refuses(self):
        self.mutate("UPDATE owned_0 SET value='changed'")
        self.refused('Original rows changed')

    def test_original_blob_change_refuses(self):
        self.mutate('UPDATE owned_1 SET raw=?', (b'changed',))
        self.refused('Original rows changed')

    def test_original_records_change_refuses(self):
        self.mutate("UPDATE WorkItemDraft SET records='[]'")
        self.refused('Original rows changed')

    def test_deleted_original_row_refuses(self):
        self.mutate('DELETE FROM owned_2')
        self.refused('Original rows changed')

    def test_added_original_row_refuses(self):
        self.mutate("INSERT INTO owned_3(id) VALUES ('extra')")
        self.refused('Original rows changed')

    def test_original_receipt_change_refuses(self):
        self.mutate("UPDATE _schema_migrations SET details='changed' WHERE id='old-0'")
        self.refused('Original rows changed')

    def test_extra_receipt_refuses(self):
        self.mutate("INSERT INTO _schema_migrations(id) VALUES ('extra')")
        self.refused('Original rows changed')

    def test_missing_install_receipt_refuses(self):
        self.mutate('DELETE FROM _schema_migrations WHERE id=?', (verifier.MARKER,))
        self.refused('Unapproved installation receipt delta')

    def test_wrong_marker_refuses(self):
        self.mutate("UPDATE _schema_migrations SET id='wrong-marker' WHERE id=?", (verifier.MARKER,))
        self.refused('Original rows changed')

    def test_receipt_original_hash_mismatch_refuses(self):
        changed = dict(self.receipt, originalRowsSha256='b' * 64)
        self.mutate('UPDATE _schema_migrations SET details=? WHERE id=?', (json.dumps(changed), verifier.MARKER))
        self.refused('receipt authority differs')

    def test_receipt_sources_mismatch_refuses(self):
        changed = dict(self.receipt, sources=dict(verifier.SOURCES, migrationSha256='b' * 64))
        self.mutate('UPDATE _schema_migrations SET details=? WHERE id=?', (json.dumps(changed), verifier.MARKER))
        self.refused('receipt authority differs')

    def test_receipt_boolean_count_refuses(self):
        changed = dict(self.receipt, backfilledCount=False)
        self.mutate('UPDATE _schema_migrations SET details=? WHERE id=?', (json.dumps(changed), verifier.MARKER))
        self.refused('receipt authority differs')

    def test_duplicate_receipt_key_refuses(self):
        raw = json.dumps(self.receipt)[:-1] + ',"backfilledCount":0}'
        self.mutate('UPDATE _schema_migrations SET details=? WHERE id=?', (raw, verifier.MARKER))
        self.refused('Duplicate receipt key')

    def test_receipt_fingerprint_mismatch_refuses(self):
        changed = dict(self.receipt, receiptSha256='b' * 64)
        self.mutate('UPDATE _schema_migrations SET details=? WHERE id=?', (json.dumps(changed), verifier.MARKER))
        self.refused('Installation receipt hash differs')

    def test_extra_schema_table_refuses(self):
        self.mutate('CREATE TABLE extra(id TEXT)')
        self.refused('Schema changed beyond')

    def test_extra_original_column_refuses(self):
        self.mutate('ALTER TABLE owned_0 ADD COLUMN extra TEXT')
        self.refused('Schema changed beyond')

    def test_extra_original_index_refuses(self):
        self.mutate('CREATE INDEX extra ON owned_1(value)')
        self.refused('Schema changed beyond')

    def test_missing_immutable_guard_refuses(self):
        self.mutate('DROP TRIGGER ImportTemplate_immutable_delete')
        self.refused('Schema changed beyond')

    def test_extra_pointer_constraint_refuses(self):
        self.mutate('ALTER TABLE WorkItemDraft ADD COLUMN unapproved TEXT')
        self.refused('Schema changed beyond')

    def test_nonempty_import_template_refuses(self):
        self.mutate('''INSERT INTO ImportTemplate(id,labId,instrumentId,name,version,mapping,createdBy)
            VALUES ('new','owned-lab','owned-equipment','Owned',1,'{}','owned-user')''')
        self.refused('Installation created import data')

    def test_historical_pointer_link_refuses_fk(self):
        self.mutate("UPDATE WorkItemDraft SET importReceiptId='invented'")
        self.refused('Foreign-key refusal')

    def test_missing_original_table_refuses(self):
        db = sqlite3.connect(self.before)
        db.execute('DROP TABLE owned_4')
        db.commit()
        db.close()
        self.refused('Original table inventory differs')

    def test_before_has_unsealed_wal_refuses(self):
        pathlib.Path(str(self.before) + '-wal').write_bytes(b'unsealed')
        self.refused('no unsealed WAL')

    def test_after_has_unsealed_journal_refuses(self):
        pathlib.Path(str(self.after) + '-journal').write_bytes(b'unsealed')
        self.refused('no unsealed WAL')

    def test_same_snapshot_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'snapshots must differ'):
            verifier.verify_import_installation(self.before, self.before, ASSET_ROOT, ORIGINAL_HASH)

    def test_missing_bound_hash_refuses(self):
        with self.assertRaisesRegex(RuntimeError, 'original-row hash is required'):
            verifier.verify_import_installation(self.before, self.after, ASSET_ROOT, '')

    def test_changed_asset_refuses(self):
        target = self.root / 'changed-assets'
        target.mkdir()
        for name in verifier.ASSETS:
            (target / name).write_bytes((ASSET_ROOT / name).read_bytes())
        (target / 'migration.sql').write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError, 'Candidate import asset changed'):
            verifier.verify_import_installation(self.before, self.after, target, ORIGINAL_HASH)


if __name__ == '__main__':
    unittest.main(verbosity=2)
