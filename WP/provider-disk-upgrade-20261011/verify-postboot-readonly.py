"""Post-upgrade observation; no server, account or database mutations."""
import datetime, hashlib, json, pathlib, shutil, sqlite3, subprocess

def run(args, stdin=None):
    result = subprocess.run(args, input=stdin, capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, args[0] + ': ' + result.stderr[:200]
    return result.stdout

def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()

root = pathlib.Path('/opt/lims/releases/combined-release-eb6de2e8-feac6534-20261010T214130Z')
receipt_path = root / 'production-receipt.json'
assert sha(receipt_path) == '1f2e2d6621456bc11664ab7800ba0ab9e95d783b4efafde2a1175d3e1fade8c6'
receipt = json.loads(receipt_path.read_text())
baseline = receipt['installedTables']
manifest = json.loads((root / 'prepared-manifest.json').read_text())
assert all(sha(root / name) == digest for name, digest in manifest['files'].items())
db_path = pathlib.Path('/var/lib/docker/volumes/lims_lims-data/_data/dev.db')
db = sqlite3.connect('file:' + str(db_path) + '?mode=ro', uri=True, timeout=30)
db.execute('PRAGMA query_only=ON')
db.execute('BEGIN')
quoted = lambda value: '"' + value.replace('"', '""') + '"'
names = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
counts = {name: db.execute('SELECT count(*) FROM ' + quoted(name)).fetchone()[0] for name in names}
integrity = [row[0] for row in db.execute('PRAGMA integrity_check')]
foreign_keys = sum(1 for _ in db.execute('PRAGMA foreign_key_check'))
assert integrity == ['ok'] and foreign_keys == 0 and set(names) == set(baseline)
deltas = {name: {'baseline': baseline[name]['count'], 'postBoot': counts[name]}
          for name in names if baseline[name]['count'] != counts[name]}
assert not deltas, 'Table counts differ from last verified production record'
receipt_fields = baseline['_schema_migrations']['fields']
rows = db.execute('SELECT ' + ','.join(map(quoted, receipt_fields)) + ' FROM _schema_migrations ORDER BY '
                  + ','.join(map(quoted, receipt_fields)))
digest = hashlib.sha256()
for row in rows:
    digest.update(json.dumps(list(row), separators=(',', ':'), ensure_ascii=False).encode() + b'\n')
assert digest.hexdigest() == baseline['_schema_migrations']['sha256']
acceptance = {
    'attemptStatus': db.execute('SELECT status FROM WorkAttempt WHERE id=?', ('att-s02-p-2',)).fetchone()[0],
    'reviewDecisionAttemptId': db.execute('SELECT attemptId FROM ReviewDecision WHERE id=?', ('dec-s02-p-acc',)).fetchone()[0],
    'reportStatus': db.execute('SELECT status FROM Report WHERE id=?', ('RPT-GTM-DEMO-S02-v1',)).fetchone()[0],
}
assert acceptance == {'attemptStatus': 'ACCEPTED', 'reviewDecisionAttemptId': None, 'reportStatus': 'PUBLISHED'}
db.rollback()
db.close()
containers = []
for name in ['soilfer-lims', 'soilfer-hub', 'soilfer-gateway', 'soilfer-lab-admin']:
    found = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True, timeout=20)
    if found.returncode:
        assert name == 'soilfer-lab-admin'
        containers.append({'name': name, 'exists': False, 'acceptedOnDemandByYY': True})
        continue
    value = json.loads(found.stdout)[0]
    assert value['State']['Running']
    containers.append({'name': name, 'exists': True, 'id': value['Id'], 'image': value['Image'],
        'startedUtc': value['State']['StartedAt'], 'restartCount': value['RestartCount'],
        'health': value['State'].get('Health', {}).get('Status'),
        'mounts': [{'name': mount.get('Name'), 'source': mount['Source'], 'destination': mount['Destination']}
                   for mount in value['Mounts']]})
lims = containers[0]
assert lims['image'] == 'sha256:159057d56c456a0c7cdef917fd04f53f9a66d6285cc476d7203d63047bfff8e1'
assert lims['health'] == 'healthy' and lims['restartCount'] == 0
assert {row['name']: row['destination'] for row in lims['mounts']} == {
    'lims_lims-data': '/app/server/prisma', 'lims_lims-assets': '/app/server/uploads'}
image = json.loads(run(['docker', 'image', 'inspect', lims['image']]))[0]
assert image['Config']['Labels']['org.opencontainers.image.revision'] == 'feac653495d6b8a21e082cec596f1e14672fb389'
checks = []
for url, expected in [('https://lims.yigini.net/', 200), ('https://lims.yigini.net/login', 200),
                      ('https://lims.yigini.net/api/auth/me', 401), ('https://training.yigini.net/lab/hub/login', 200)]:
    observed = run(['curl', '-sS', '-L', '--max-time', '20', '-o', '/dev/null', '-w', '%{http_code} %{ssl_verify_result}', url]).split()
    assert observed == [str(expected), '0']
    checks.append({'url': url, 'httpStatus': expected, 'tlsVerificationPassed': True})
node = """const Database=require('better-sqlite3'),jwt=require('jsonwebtoken');
const db=new Database('/app/server/prisma/dev.db',{readonly:true,fileMustExist:true});
const u=db.prepare("SELECT id,role,tokenVersion,isActive,mustChangePassword FROM User WHERE id=?").get('1770311018064');db.close();
if(!u||!u.isActive||u.role!=='SUPER_ADMIN'||u.mustChangePassword)throw Error('Principal unavailable');
const token=jwt.sign({id:u.id,tokenVersion:u.tokenVersion||0},process.env.JWT_SECRET,{expiresIn:'2m'});
(async()=>{const rows=[];for(const base of ['http://127.0.0.1:3000','https://lims.yigini.net']){const r=await fetch(base+'/api/auth/me',{headers:{Authorization:'Bearer '+token}});const body=await r.json();if(r.status!==200||body.id!==u.id||body.role!==u.role)throw Error('Authenticated GET failed');rows.push({url:base+'/api/auth/me',httpStatus:200,principalMatched:true});}console.log(JSON.stringify(rows));})().catch(e=>{console.error(e.message);process.exitCode=1});"""
authenticated = json.loads(run(['docker', 'exec', '-i', '-w', '/app/server', 'soilfer-lims', 'node'], node))
home = json.loads(run(['docker', 'volume', 'inspect', 'soilfer-home-admin']))[0]
files = [path for path in pathlib.Path(home['Mountpoint']).rglob('*') if path.is_file()]
build_root = pathlib.Path('/opt/lims/releases/preparation-ae64f169-build-20261011T110500Z')
assert sha(build_root / 'build-receipt.json') == '08714c72470839d5cb8011423e1510f08d63a998a97b6e5a1fc25ce4f418a2b1'
build = json.loads((build_root / 'build-receipt.json').read_text())
assert sha(build_root / 'source.tar.gz') == build['sourceArchiveSha256']
assert sha(build_root / 'source-index.json') == build['sourceIndexSha256']
candidate = json.loads(run(['docker', 'image', 'inspect', build['image']]))[0]
assert candidate['Config']['Labels']['org.opencontainers.image.revision'] == build['head']
assert candidate['Size'] == build['imageBytes']
assets = sum(path.stat().st_size for path in pathlib.Path('/var/lib/docker/volumes/lims_lims-assets/_data').rglob('*') if path.is_file())
print(json.dumps({'status': 'READ_ONLY_POST_BOOT_CHECKS_PASSED_LABS_ON_DEMAND',
    'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'bootId': pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
    'uptimeSeconds': float(pathlib.Path('/proc/uptime').read_text().split()[0]),
    'disks': json.loads(run(['lsblk', '-b', '-J', '-o', 'NAME,TYPE,SIZE,FSTYPE,MOUNTPOINTS'])),
    'freeBytes': {path: shutil.disk_usage(path).free for path in ['/opt/lims', '/var/lib/docker']},
    'databaseBytes': db_path.stat().st_size, 'assetsBytes': assets, 'integrityCheck': 'ok',
    'foreignKeyViolations': 0, 'tableCount': len(names), 'allCountsMatch': True, 'tableCountDeltas': deltas,
    'baseline': 'Original feac production receipt installedTables at 06:00:46 UTC; no immediate preboot snapshot',
    'counts': counts, 'all37SchemaReceiptRowsAndFieldsMatch': True, 'acceptance': acceptance,
    'containers': containers, 'httpsGetChecks': checks, 'authenticatedGetChecks': authenticated,
    'passwordLoginAttempted': False, 'health': json.loads(run(['curl', '-fsS', '--max-time', '20', 'https://lims.yigini.net/api/health'])),
    'homeAdmin': {'volume': home['Name'], 'regularFileCount': len(files), 'notebookCount': sum(path.suffix == '.ipynb' for path in files)},
    'originalProductionReceiptSha256': sha(receipt_path), 'originalFrozenKitUnchanged': True,
    'candidateBuildReceiptSha256': sha(build_root / 'build-receipt.json'), 'candidateImage': build['image'],
    'productionMutationsByThisProbe': 0}, indent=2))
