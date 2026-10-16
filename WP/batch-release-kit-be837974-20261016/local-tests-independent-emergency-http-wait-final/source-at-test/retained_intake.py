"""Read-only, streaming copy verifier for #162 pins 6112209155/6112305172.

This module never starts a container, fetches Kobo data, or writes a database.
All original rows and schema remain protected. Only enumerated intake additions
and active-config cursor/clock fields may differ; secret fields are hashed.
"""
import hashlib
import datetime
import json
import pathlib
import re
import sqlite3
from urllib.parse import quote
from retained_privacy import value_hash,public_failure
from retained_provenance import validate_added_and_changed,monotonic,fresh_submission
from retained_contract import child_path
from retained_files import file_state

PIN_IDS = [6112209155, 6112305172]
APPEND_TABLES = {'Sample', 'AuditLog', 'SampleHold', 'Notification'}
CLOCKS = {'lastSyncAt', 'updatedAt'}
CURSORS = CLOCKS | {'lastSubmissionId'}


def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def quoted(name):
    return '"' + name.replace('"', '""') + '"'


def encoded(row):
    return json.dumps(list(row), ensure_ascii=False, separators=(',', ':'),
        default=lambda value: {'blobSha256': hashlib.sha256(value).hexdigest()}).encode()


def row_sha(row):
    return value_hash(list(row))


def objects(db, schema):
    return [tuple(row) for row in db.execute('SELECT type,name,tbl_name,sql FROM ' + schema +
        ".sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")]


def shape(db, schema, table):
    return [tuple(row) for row in db.execute('PRAGMA ' + schema + '.table_xinfo(' + quoted(table) + ')')]


def ordered(db, schema, table, columns, keys):
    return db.execute('SELECT ' + ','.join(map(quoted, columns)) + ' FROM ' + schema + '.' + quoted(table) +
        ' ORDER BY ' + ','.join(map(quoted, keys or columns)))


def rows_hash(rows):
    digest = hashlib.sha256()
    count = 0
    for row in rows:
        digest.update(encoded(row) + b'\n')
        count += 1
    return {'count': count, 'sha256': digest.hexdigest()}


def instant(value):
    if isinstance(value, (int, float)):
        return int(value)
    return round(datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() * 1000)


def verify_copy(prior_database, current_database, expected_table_count=104, prior_fetched_ids=None, fetched_ids=None,
                refusal_configs=None,fetch_records=None,owner_root=None,notification_batches=None):
    """Compare a retained baseline to one consistent current read-only snapshot.

    On the second sync prior_fetched_ids maps config ids to a conservative
    superset of first-fetch ids. Additions from those ids refuse. Genuinely new
    ids must exceed that set's maximum and be present in a separately retained
    read-only Kobo fetch record; the caller verifies that upstream record.
    """
    require(owner_root is not None,"NEW owned root required for proof SQL")
    prior_database=child_path(owner_root,prior_database);current_database=child_path(owner_root,current_database)
    prior = pathlib.Path(prior_database).resolve()
    current = pathlib.Path(current_database).resolve()
    require(prior != current, 'Baseline and current database must differ')
    prior_wal = pathlib.Path(str(prior) + '-wal')
    require(not prior_wal.exists() or prior_wal.stat().st_size == 0, 'Baseline must be a stopped/backup copy without committed WAL')
    for path in [prior,current]:
        wal=pathlib.Path(str(path)+'-wal')
        require(not wal.exists() or wal.stat().st_size==0,'Only consistent NEW backups without committed WAL')
    input_before={str(path):file_state(path) for path in [prior,current]}
    uri = current.as_uri() + '?mode=ro&immutable=1'
    db = sqlite3.connect(uri, uri=True)
    db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA query_only=ON')
        db.execute('ATTACH DATABASE ? AS prior', (prior.as_uri() + '?mode=ro&immutable=1',))
        db.execute('BEGIN')
        require(objects(db, 'main') == objects(db, 'prior'), 'Database schema changed')
        names = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        require(len(names) == expected_table_count, 'Unexpected protected table count')
        require(APPEND_TABLES | {'KoboConfig', 'User'} <= set(names), 'Intake tables missing')
        configs = {row['id']: dict(row) for row in db.execute('SELECT * FROM prior.KoboConfig ORDER BY id')}
        active = {key: row for key, row in configs.items() if row['isActive'] and row['projectCode']}
        protected_configs = set(refusal_configs or [])
        require(protected_configs <= set(active), 'Expected refusal config is not an original active config')
        protected_scopes = {(configs[key]['labId'], configs[key]['projectCode']) for key in protected_configs}
        managers = {row['id']: row['labId'] for row in db.execute(
            "SELECT id,labId FROM prior.User WHERE isActive=1 AND role='LAB_MANAGER'")}
        table_records = {}
        table_fields = {}
        additions = {name: [] for name in APPEND_TABLES}
        config_changes = []
        new_samples = {}
        new_holds = {}
        changed_samples=[]
        for table in names:
            old_shape = shape(db, 'prior', table)
            require(old_shape == shape(db, 'main', table), 'Table shape changed: ' + table)
            columns = [row[1] for row in old_shape if row[6] == 0]
            table_fields[table] = columns
            keys = [row[1] for row in sorted(old_shape, key=lambda row: row[5]) if row[5] > 0]
            if table not in APPEND_TABLES | {'KoboConfig'}:
                before = rows_hash(ordered(db, 'prior', table, columns, keys))
                after = rows_hash(ordered(db, 'main', table, columns, keys))
                require(before == after, 'Protected rows changed: ' + table)
                table_records[table] = {'before': before, 'after': after}
                continue
            require(keys == ['id'], 'Intake verifier requires exact id key: ' + table)
            old_rows = iter(ordered(db, 'prior', table, columns, keys))
            current_rows = iter(ordered(db, 'main', table, columns, keys))
            old = next(old_rows, None)
            before_hash, after_hash = hashlib.sha256(), hashlib.sha256()
            original_count = 0
            for row in current_rows:
                key = row['id']
                if old is not None and old['id'] < key:
                    raise RuntimeError('Original row disappeared: ' + table)
                if old is not None and old['id'] == key:
                    original_count += 1
                    before_hash.update(encoded(old) + b'\n')
                    if table == 'KoboConfig':
                        changed = [field for field in columns if old[field] != row[field]]
                        require(not changed or key not in protected_configs, 'Expected refusal config changed')
                        require(not changed or key in active, 'Inactive/unmapped config changed')
                        require(set(changed) <= CURSORS, 'Protected Kobo config field changed')
                        for field in changed:
                            if field in CLOCKS:require(row[field] is not None and (old[field] is None or monotonic(old[field],row[field])), 'Config clock regressed')
                        if changed:
                            config_changes.append({'id': key, 'fields': changed,
                                'before': {field: old[field] for field in changed},
                                'after': {field: row[field] for field in changed}})
                        normalized = [old[field] if field in CURSORS else row[field] for field in columns]
                    elif table=='Sample' and encoded(old)!=encoded(row):
                        changed_samples.append((dict(old),dict(row)));normalized=list(old)
                    else:
                        require(encoded(old) == encoded(row), 'Original row changed: ' + table)
                        normalized = list(row)
                    after_hash.update(encoded(normalized) + b'\n')
                    old = next(old_rows, None)
                else:
                    require(table in APPEND_TABLES, 'New config row refused')
                    value = dict(row)
                    additions[table].append(value)
                    if table == 'Sample':
                        new_samples[key] = value
                    if table == 'SampleHold':
                        new_holds[key] = value
            require(old is None, 'Original row disappeared: ' + table)
            require(before_hash.digest() == after_hash.digest(), 'Original row fingerprint mismatch')
            table_records[table] = {'originalCount': original_count,
                'originalSha256': before_hash.hexdigest(), 'preserved': True}

        validation_configs={i:{**c,'isActive':0 if (c['labId'],c['projectCode']) in protected_scopes else c['isActive']} for i,c in configs.items()}
        added_result=validate_added_and_changed(changed_samples,new_samples,additions['SampleHold'],additions['AuditLog'],additions['Notification'],validation_configs,fetch_records,fetched_ids,managers,prior_fetched_ids,notification_batches)
        require(len(table_records)==expected_table_count and table_records['_schema_migrations']['before']['count']==42 and table_records['_schema_migrations']['after']['count']==42,'All112 tables and42 receipts required')
        for change in config_changes:
            if 'lastSubmissionId' in change['fields']:
                key = change['id']
                new_cursor = str(change['after']['lastSubmissionId'] or '')
                old_cursor = str(change['before']['lastSubmissionId'] or '0')
                observed_ids = {str(value) for value in (fetched_ids or {}).get(key, [])}
                require(new_cursor.isdigit() and old_cursor.isdigit() and int(new_cursor) > int(old_cursor) and
                    new_cursor in observed_ids, 'Cursor changed outside enumerated upstream intake')
                if prior_fetched_ids is not None:
                    require(key in prior_fetched_ids, 'Missing first-fetch record for cursor')
                    previous_ids = {str(value) for value in prior_fetched_ids[key]}
                    require(new_cursor not in previous_ids and
                        (not previous_ids or int(new_cursor) > max(map(int, previous_ids))),
                        'Second-sync cursor changed without genuinely new upstream intake')
        require(db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok', 'SQLite integrity failed')
        require(not db.execute('PRAGMA foreign_key_check').fetchall(), 'Foreign key violations')
        # Receipt contains ids, scope and full-row hashes, never API tokens,
        # user personal fields or raw analytical/field metadata.
        enumerated = {table: [{'id': row['id'], 'sha256': row_sha([row[field] for field in table_fields[table]])}
            for row in rows] for table, rows in additions.items()}
        require(input_before=={str(path):file_state(path) for path in [prior,current]},'NEW comparison input changed during readonly verification')
        return {'scopeCommentIds': PIN_IDS, 'protectedTableCount': len(names),
            'schemaPreserved': True, 'allOriginalRowsPreserved': not changed_samples,'allOriginalRowsPreservedExceptExactProvenance':True, 'tables': table_records,
            'additions': enumerated, 'configChanges': [{'id':c['id'],'fields':c['fields'],'beforeHmacSha256':value_hash(c['before']),'afterHmacSha256':value_hash(c['after'])} for c in config_changes],
            **added_result,
            'protectedRefusalConfigIds': sorted(protected_configs),
            'retainedUpstreamFetchIds': fetched_ids,
            'copySyncIntervalMins': {key: row.get('syncIntervalMins') or 15 for key, row in active.items()},
            'integrity': 'ok', 'foreignKeyViolations': 0}
    finally:
        db.close()
