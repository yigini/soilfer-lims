import sqlite3, json, hashlib

backup_path = '/opt/lims/backups/dev_release_17e5ef1_consistent_20260922_232558.db'
live_path = '/var/lib/docker/volumes/lims_lims-data/_data/dev.db'

dbs = [sqlite3.connect('file:' + p + '?mode=ro', uri=True) for p in [backup_path, live_path]]
for tag, db in zip(['backup', 'live'], dbs):
    qc = db.execute('PRAGMA quick_check').fetchone()[0]
    ic = db.execute('PRAGMA integrity_check').fetchone()[0]
    print(f'{tag}: quick_check={qc}, integrity_check={ic}')

tables = ['Sample', 'Result', 'Report', 'ReportShareLink', 'WorkItem', 'Batch', 'Project', 'Lab', 'User', 'AuditLog']
for table in tables:
    counts = []
    hashes = []
    for db in dbs:
        rows = [json.dumps(row, default=lambda b: b.hex(), ensure_ascii=True, separators=(',', ':')) for row in db.execute(f'SELECT * FROM "{table}"')]
        counts.append(len(rows))
        hashes.append(hashlib.sha256('\n'.join(sorted(rows)).encode()).hexdigest())
    match = (counts[0] == counts[1]) and (hashes[0] == hashes[1])
    print(f'{table:16}: count={counts[0]:<6} match={match}')
