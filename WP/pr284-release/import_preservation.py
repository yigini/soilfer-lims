"""Proposed, read-only #200 installation verifier. Not execution authority.

The separately reviewed coordinator must supply two consistent stopped backups,
the exact candidate's hash-bound assets, and its bounded original-row hash.
Only the native nullable pointer, empty import tables/guards and one exact
installation receipt are admitted. Every original row and schema remains bound.
No container, installer, network, restore or database writer is invoked here.
"""
import hashlib
import json
import pathlib
import re
import sqlite3

BASE_TABLE_COUNT = 104
BASE_RECEIPT_COUNT = 38
MARKER = '200_instrument_import_templates'
ASSETS = {
    'migration.sql': '68555c0f9901a48c1c87a7d4ccb8320d0c515e388df094a47865064ee0ad6fc8',
    'fresh-prisma-tables.json': '9e098129de487fdb8ae551da9756a48c5627821ebe8da899f965824f815849df',
    'pre-prisma-draft-table.sql': 'a523b351ff7046f21c448c637600ddbbc159c38487a4cd982163e0ada13ef6af',
    'upgraded-prisma-draft-table.sql': '4f444bdf15f710a2c0223764b650713ce6b413c3d4469a950bb8bfaa05bf666b',
    'post205-draft-tables.json': '208c61cfed932cdf44bdc2b36e6d337d7687a71d13ac99dc4d48f406fcdf50ad',
}
SOURCES = dict(zip(
    ['migrationSha256', 'oracleSha256', 'preDraftSha256',
     'upgradedDraftSha256', 'post205DraftsSha256'], ASSETS.values()))
NEW_TABLES = {'ImportTemplate', 'InstrumentImportReceipt'}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def quoted(name):
    return '"' + name.replace('"', '""') + '"'


def digest(path):
    result = hashlib.sha256()
    with pathlib.Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            result.update(chunk)
    return result.hexdigest()


def assets(directory):
    result = {}
    for name, expected in ASSETS.items():
        raw = (pathlib.Path(directory) / name).read_bytes()
        require(hashlib.sha256(raw).hexdigest() == expected,
                'Candidate import asset changed: ' + name)
        result[name] = raw.decode('utf-8')
    return result


def objects(db, schema='main'):
    return [tuple(row) for row in db.execute('SELECT type,name,tbl_name,sql FROM ' +
        schema + ".sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")]


def shape(db, schema, table):
    return [tuple(row) for row in db.execute('PRAGMA ' + schema + '.table_xinfo(' + quoted(table) + ')')]


def row_hash(db, schema, table, columns, exclude_marker=False):
    statement = 'SELECT ' + ','.join(map(quoted, columns)) + ' FROM ' + schema + '.' + quoted(table)
    values = ()
    if exclude_marker:
        statement += ' WHERE id<>?'
        values = (MARKER,)
    result, count = hashlib.sha256(), 0
    for row in db.execute(statement + ' ORDER BY rowid', values):
        raw = json.dumps(list(row), ensure_ascii=False, separators=(',', ':'),
            allow_nan=False, default=lambda value: {'blobSha256': hashlib.sha256(value).hexdigest()}).encode()
        result.update(raw + b'\n')
        count += 1
    return {'count': count, 'sha256': result.hexdigest()}


def json_no_duplicates(raw):
    def exact_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate receipt key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=exact_pairs)


def verify_import_installation(before, after, source_directory, original_rows_sha256):
    before, after = pathlib.Path(before).resolve(), pathlib.Path(after).resolve()
    require(before != after, 'Original and candidate snapshots must differ')
    require(re.fullmatch('[a-f0-9]{64}', original_rows_sha256 or ''),
            'Bounded original-row hash is required')
    for path in (before, after):
        require(path.is_file(), 'Consistent snapshot is missing')
        for suffix in ('-wal', '-journal'):
            sidecar = pathlib.Path(str(path) + suffix)
            require(not sidecar.exists() or sidecar.stat().st_size == 0,
                    'Snapshots must have no unsealed WAL or journal')
    raw_hashes = {str(path): digest(path) for path in (before, after)}
    source = assets(source_directory)
    db = sqlite3.connect(after.as_uri() + '?mode=ro&immutable=1', uri=True)
    try:
        db.execute('PRAGMA query_only=ON')
        db.execute('ATTACH DATABASE ? AS prior', (before.as_uri() + '?mode=ro&immutable=1',))
        db.execute('BEGIN')
        for schema in ('prior', 'main'):
            require(db.execute('PRAGMA ' + schema + '.integrity_check').fetchall() == [('ok',)], 'Integrity refusal')
            require(not db.execute('PRAGMA ' + schema + '.foreign_key_check').fetchall(), 'Foreign-key refusal')
        prior_objects = objects(db, 'prior')
        prior_tables = [row[1] for row in prior_objects if row[0] == 'table']
        require(len(prior_tables) == BASE_TABLE_COUNT and not NEW_TABLES.intersection(prior_tables),
                'Original table inventory differs')
        require(db.execute('SELECT count(*) FROM prior._schema_migrations').fetchone()[0] == BASE_RECEIPT_COUNT and
                not db.execute('SELECT 1 FROM prior._schema_migrations WHERE id=?', (MARKER,)).fetchone(),
                'Original receipt inventory differs')
        draft = next(row[3] for row in prior_objects if row[0] == 'table' and row[1] == 'WorkItemDraft')
        oracle = json.loads(source['post205-draft-tables.json'])
        require(draft in (oracle['preFresh'], oracle['preUpgraded'], oracle['preNativeWorkbench']),
                'Exact #205 draft predecessor differs')
        # Construct only the schema delta in memory from the immutable native
        # ALTER source. All other original objects remain byte-for-byte bound.
        model = sqlite3.connect(':memory:')
        try:
            model.executescript(draft + ';\n' + source['migration.sql'])
            delta = objects(model)
            expected = sorted([row for row in prior_objects if row[1] != 'WorkItemDraft'] + delta)
            require(objects(db) == expected, 'Schema changed beyond the exact native import delta')
            require(shape(db, 'main', 'WorkItemDraft') == shape(model, 'main', 'WorkItemDraft'),
                    'Native pointer shape differs')
        finally:
            model.close()
        row_records = {}
        for table in prior_tables:
            prior_shape = shape(db, 'prior', table)
            current_shape = shape(db, 'main', table)
            require(current_shape[:len(prior_shape)] == prior_shape and
                    (table == 'WorkItemDraft' or current_shape == prior_shape),
                    'Original column shape changed: ' + table)
            columns = [row[1] for row in prior_shape if row[6] == 0]
            old = row_hash(db, 'prior', table, columns)
            current = row_hash(db, 'main', table, columns, table == '_schema_migrations')
            require(old == current, 'Original rows changed: ' + table)
            row_records[table] = old
        for table in NEW_TABLES:
            require(db.execute('SELECT count(*) FROM ' + quoted(table)).fetchone()[0] == 0,
                    'Installation created import data')
        require(db.execute('SELECT count(*) FROM WorkItemDraft WHERE importReceiptId IS NOT NULL').fetchone()[0] == 0,
                'Installation linked a historical draft')
        require(db.execute('SELECT count(*) FROM _schema_migrations').fetchone()[0] == BASE_RECEIPT_COUNT + 1,
                'Unapproved installation receipt delta')
        marker = db.execute('SELECT details FROM _schema_migrations WHERE id=?', (MARKER,)).fetchone()
        require(marker is not None, 'New installation receipt missing')
        receipt = json_no_duplicates(marker[0])
        require(list(receipt) == ['sources', 'originalRowsSha256', 'originalRowsPreserved',
                'newTemplateCount', 'newReceiptCount', 'backfilledCount', 'receiptSha256'] and
                receipt['sources'] == SOURCES and receipt['originalRowsSha256'] == original_rows_sha256 and
                receipt['originalRowsPreserved'] is True and all(type(receipt[key]) is int and receipt[key] == 0
                    for key in ['newTemplateCount', 'newReceiptCount', 'backfilledCount']),
                'New installation receipt authority differs')
        fingerprint = {key: value for key, value in receipt.items() if key != 'receiptSha256'}
        require(receipt['receiptSha256'] == hashlib.sha256(json.dumps(fingerprint,
                separators=(',', ':'), ensure_ascii=False).encode()).hexdigest(), 'Installation receipt hash differs')
        require(all(digest(path) == raw_hashes[str(path)] for path in (before, after)), 'Snapshot bytes changed')
        return {'status': 'READ_ONLY_EXACT_IMPORT_DELTA_PASS', 'originalTableCount': BASE_TABLE_COUNT,
            'originalReceiptCount': BASE_RECEIPT_COUNT, 'candidateTableCount': BASE_TABLE_COUNT + 2,
            'candidateReceiptCount': BASE_RECEIPT_COUNT + 1, 'allOriginalRowsAndSchemaPreserved': True,
            'newTables': sorted(NEW_TABLES), 'historicalDraftLinks': 0, 'scientificChanges': 0,
            'originalRows': row_records, 'snapshotSha256': raw_hashes, 'sources': SOURCES,
            'originalRowsSha256': original_rows_sha256}
    finally:
        db.close()
