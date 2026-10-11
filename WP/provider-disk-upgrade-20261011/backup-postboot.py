"""Create a fresh, consistent online SQLite backup; never modify live evidence."""
import datetime, hashlib, json, pathlib, shutil, sqlite3, tarfile

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()

def assets_index(root):
    return {str(path.relative_to(root)): {'bytes': path.stat().st_size, 'sha256': sha(path)}
            for path in sorted(root.rglob('*')) if path.is_file()}

root = pathlib.Path('/opt/lims/backups/postboot-feac6534-20261011T131200Z')
live = pathlib.Path('/var/lib/docker/volumes/lims_lims-data/_data/dev.db')
assets = pathlib.Path('/var/lib/docker/volumes/lims_lims-assets/_data')
assert not root.exists(), 'Never overwrite a retained backup'
free_before = shutil.disk_usage(root.parent).free
assert free_before > 10556150894 + live.stat().st_size + 268435456
root.mkdir(mode=0o700)
before = assets_index(assets)
source = sqlite3.connect('file:' + str(live) + '?mode=ro', uri=True, timeout=30)
target = sqlite3.connect(str(root / 'database.db'))
try:
    source.backup(target)
finally:
    target.close()
    source.close()
backup = root / 'database.db'
db = sqlite3.connect('file:' + str(backup) + '?mode=ro', uri=True)
assert db.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
assert not db.execute('PRAGMA foreign_key_check').fetchall()
names = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
counts = {name: db.execute('SELECT count(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0] for name in names}
reference = json.loads(pathlib.Path('/opt/lims/releases/combined-release-eb6de2e8-feac6534-20261010T214130Z/production-receipt.json').read_text())['installedTables']
assert set(counts) == set(reference) and all(counts[name] == reference[name]['count'] for name in counts)
db.close()
archive = root / 'assets.tar.gz'
with tarfile.open(archive, 'x:gz') as output:
    output.add(assets, arcname='uploads')
assert assets_index(assets) == before, 'Assets changed while backing up'
with tarfile.open(archive) as bundle:
    members = [member for member in bundle if member.isfile()]
    observed = {str(pathlib.PurePosixPath(member.name).relative_to('uploads')):
                {'bytes': member.size, 'sha256': hashlib.sha256(bundle.extractfile(member).read()).hexdigest()}
                for member in members}
assert observed == before
receipt = {'status': 'POST_BOOT_CONSISTENT_ONLINE_BACKUP_PASSED',
    'completedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'root': str(root),
    'databaseSha256': sha(backup), 'databaseBytes': backup.stat().st_size,
    'assetsArchiveSha256': sha(archive), 'assetsArchiveBytes': archive.stat().st_size,
    'assetsIndex': before, 'integrity': 'ok', 'foreignKeyViolations': 0,
    'tableCount': len(counts), 'allCountsMatchLastVerifiedProduction': True,
    'sourceConnectionMode': 'ro', 'liveDatabaseCheckpointOrStopPerformed': False,
    'isPreRebootBackup': False, 'recoveryPolicy': 'FORWARD_ONLY_NO_RESTORE',
    'freeBytesBefore': free_before, 'freeBytesAfter': shutil.disk_usage(root).free}
with (root / 'backup-receipt.json').open('x') as output:
    json.dump(receipt, output, indent=2)
for path in [backup, archive, root / 'backup-receipt.json']:
    path.chmod(0o400)
print(json.dumps({'receipt': receipt, 'backupReceiptSha256': sha(root / 'backup-receipt.json')}, indent=2))
