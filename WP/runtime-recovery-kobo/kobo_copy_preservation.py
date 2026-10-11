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
    return hashlib.sha256(encoded(row)).hexdigest()


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


def verify_copy(prior_database, current_database, expected_table_count=104, prior_fetched_ids=None, fetched_ids=None):
    """Compare a retained baseline to one consistent current read-only snapshot.

    On the second sync prior_fetched_ids maps config ids to a conservative
    superset of first-fetch ids. Additions from those ids refuse. Genuinely new
    ids must exceed that set's maximum and be present in a separately retained
    read-only Kobo fetch record; the caller verifies that upstream record.
    """
    prior = pathlib.Path(prior_database).resolve()
    current = pathlib.Path(current_database).resolve()
    require(prior != current, 'Baseline and current database must differ')
    prior_wal = pathlib.Path(str(prior) + '-wal')
    require(not prior_wal.exists() or prior_wal.stat().st_size == 0, 'Baseline must be a stopped/backup copy without committed WAL')
    uri = current.as_uri() + '?mode=ro'
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
        managers = {row['id']: row['labId'] for row in db.execute(
            "SELECT id,labId FROM prior.User WHERE isActive=1 AND role='LAB_MANAGER'")}
        table_records = {}
        table_fields = {}
        additions = {name: [] for name in APPEND_TABLES}
        config_changes = []
        new_samples = {}
        new_holds = {}
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
                        require(not changed or key in active, 'Inactive/unmapped config changed')
                        require(set(changed) <= CURSORS, 'Protected Kobo config field changed')
                        if changed:
                            config_changes.append({'id': key, 'fields': changed,
                                'before': {field: old[field] for field in changed},
                                'after': {field: row[field] for field in changed}})
                        normalized = [old[field] if field in CURSORS else row[field] for field in columns]
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

        sample_scopes = {}
        new_submission_ids = {}
        for sample_id, sample in new_samples.items():
            meta = json.loads(sample.get('metadata') or '{}')
            matching = [key for key, config in active.items() if
                config['labId'] == sample['assignedLab'] and config['projectCode'] == sample['projectCode'] and
                config['formId'] == meta.get('sourceFormId') and config['koboServerUrl'] == meta.get('sourceServerUrl')]
            require(len(matching) == 1, 'New Sample lacks exact active config provenance')
            config_id = matching[0]
            require(sample['status'] == 'EXPECTED' and sample.get('labId') is None,
                'Intake invented a sample workflow disposition')
            require(all(sample.get(field) is None for field in ['acceptedBy', 'acceptedAt',
                'approvedBy', 'approvedAt', 'receivedBy', 'receptionDate']), 'Intake invented scientific/reception authority')
            submission_id = str(meta.get('kobo_id', ''))
            require(submission_id.isdigit(), 'New Sample lacks numeric Kobo submission id')
            require(fetched_ids is not None and submission_id in {str(value) for value in fetched_ids.get(config_id, [])},
                'New Sample not bound to retained upstream fetch ids')
            if prior_fetched_ids is not None:
                require(config_id in prior_fetched_ids, 'Missing first-fetch record for config')
                previous_ids = {str(value) for value in prior_fetched_ids[config_id]}
                require(submission_id not in previous_ids and
                    (not previous_ids or int(submission_id) > max(map(int, previous_ids))),
                    'Second sync duplicated prior fetched intake')
            sample_scopes[sample_id] = config_id
            new_submission_ids.setdefault(config_id, set()).add(submission_id)

        for hold in additions['SampleHold']:
            require(hold['sampleId'] in new_samples, 'New hold targets a protected original Sample')
            require(hold['type'] == 'PROVENANCE' and hold['raisedBy'] == 'system:kobo-sync' and
                hold['compatMarker'] == 'KOBO_PROVENANCE' and hold['attributionSource'] == 'LIVE' and
                all(hold.get(field) is None for field in ['resolvedBy', 'resolvedAt', 'resolution']),
                'New hold is outside Kobo provenance scope')
        created_audits = set()
        for audit in additions['AuditLog']:
            if audit['entity'] == 'SAMPLE':
                require(audit['entityId'] in new_samples and audit['action'] in
                    ['CREATE_KOBO_SYNC', 'KOBO_INTRA_SUBMISSION_DUPLICATE'], 'Unapproved Sample audit addition')
                sample = new_samples[audit['entityId']]
                require(audit['performedBy'] == 'KOBO_SCHEDULER', 'Non-scheduled Sample intake audit')
                if audit['action'] == 'CREATE_KOBO_SYNC':
                    require(audit['sampleId'] == sample['id'] and audit['labId'] == sample['assignedLab'],
                        'Intake audit scope mismatch')
                    require(sample['id'] not in created_audits, 'Duplicate Sample creation audit')
                    created_audits.add(sample['id'])
            else:
                require(audit['entity'] == 'SAMPLE_HOLD' and audit['entityId'] in new_holds and
                    audit['action'] == 'HOLD_RAISED' and audit['performedBy'] == 'system:kobo-sync',
                    'Unapproved audit addition')
                hold = new_holds[audit['entityId']]
                sample = new_samples[hold['sampleId']]
                require(audit['sampleId'] == sample['id'] and audit['labId'] == sample['assignedLab'],
                    'Hold audit scope mismatch')
                audited_hold = json.loads(audit['after'])
                require(set(audited_hold) == set(hold), 'Hold audit fields differ')
                require(all(audited_hold[field] == hold[field] for field in hold if field != 'raisedAt') and
                    instant(audited_hold['raisedAt']) == instant(hold['raisedAt']), 'Hold audit does not bind exact hold')
        require(created_audits == set(new_samples), 'New Sample missing scheduled creation audit')
        for notification in additions['Notification']:
            lab_id = managers.get(notification['userId'])
            matching = {sample_scopes[key] for key, sample in new_samples.items() if sample['assignedLab'] == lab_id}
            links = {key: '/samples?view=expected&projects=' + quote(active[key]['projectCode'], safe="~!*'()") +
                '&labs=' + quote(lab_id, safe="~!*'()") for key in matching}
            matched = [key for key, link in links.items() if link == notification['link']]
            require(bool(lab_id) and len(matched) == 1, 'Notification is outside new intake manager scope')
            config_id = matched[0]
            count = sum(value == config_id for value in sample_scopes.values())
            message = re.fullmatch(r'(\d+) new samples? synced from Kobo \(.+\)', notification['message'] or '')
            require(message is not None and int(message.group(1)) == count, 'Notification intake count mismatch')
            require(notification['type'] == 'SUCCESS' and
                notification['title'] == '🌾 New Field Samples Collected' and not notification.get('isRead'),
                'Notification is outside Kobo intake scope')
            require(all(notification.get(field) is None for field in ['senderId', 'titleCode', 'titleParams',
                'messageCode', 'messageParams']), 'Notification invented fields outside sync')

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
        return {'scopeCommentIds': PIN_IDS, 'protectedTableCount': len(names),
            'schemaPreserved': True, 'allOriginalRowsPreserved': True, 'tables': table_records,
            'additions': enumerated, 'configChanges': config_changes,
            'newSubmissionIds': {key: sorted(values, key=int) for key, values in new_submission_ids.items()},
            'retainedUpstreamFetchIds': fetched_ids,
            'copySyncIntervalMins': {key: row.get('syncIntervalMins') or 15 for key, row in active.items()},
            'integrity': 'ok', 'foreignKeyViolations': 0}
    finally:
        db.close()
