"""Fresh-copy Docker proof. Production containers/volumes are never changed."""
import json, pathlib, re, shutil, subprocess, time
import release_support as s

ROOT = pathlib.Path(__file__).resolve().parent
NAME = 'lims-owned-' + ROOT.name
PROBES = ['postflight-roles.cjs', 'postflight-auth.cjs', 'postflight-reference.cjs',
          'postflight-qc-runs.cjs', 'postflight-policy.cjs']

def check(args):
    return subprocess.check_output(args, text=True, timeout=30).strip()

if __name__ == '__main__':
    assert ROOT.parent == pathlib.Path('/opt/lims/releases')
    assert ROOT.name.startswith('combined-eb6de2e8-')
    assert not (ROOT / 'rehearsal-receipt.json').exists(), 'Never overwrite a retained rehearsal'
    build = json.loads((ROOT / 'build-receipt.json').read_text())
    assert build['head'] == s.HEAD and build['status'] == 'BUILT_ONLY_NOT_DEPLOYED'
    image = build['image']
    assert check(['docker', 'inspect', 'soilfer-lims', '--format', '{{.Image}}']) == s.OLD_IMAGE
    assert check(['docker', 'inspect', 'soilfer-lims', '--format', '{{.State.Running}}']) == 'true'
    reserve = s.disk_reserve(s.LIVE.stat().st_size, build['imageBytes'],
        sum(file.stat().st_size for file in s.ASSETS.rglob('*') if file.is_file()))
    assert min(s.disk_free().values()) >= reserve
    receipt = {'status': 'PREPARING_OWNED_COPY', 'head': s.HEAD, 'candidateImage': image,
        'startedUtc': s.utc(), 'productionExecution': False, 'reserveBytes': reserve,
        'freeBytesBefore': s.disk_free(), 'buildReceiptSha256': s.sha(ROOT / 'build-receipt.json'),
        'scriptSha256': {file.name: s.sha(file) for file in ROOT.iterdir()
            if file.name in ['rehearse.py', 'release_support.py', 'release-forward.py', 'readonly-smoke.cjs'] + PROBES}}
    started = False
    try:
        backup = ROOT / 'fresh-production-copy.db'
        s.consistent_backup(s.LIVE, backup)
        receipt['copyUtc'] = s.utc()
        receipt['productionCopySha256'] = s.sha(backup)
        owned = ROOT / 'owned-copy'
        owned.mkdir(mode=0o700)
        prisma = owned / 'prisma'
        prisma.mkdir(mode=0o700)
        database = prisma / 'dev.db'
        with backup.open('rb') as source, database.open('xb') as target:
            shutil.copyfileobj(source, target)
        database.chmod(0o600)
        shutil.copytree(s.ASSETS, owned / 'uploads')
        before = s.snapshot(database)
        assert before['integrity'] == 'ok' and before['foreignKeyViolations'] == 0
        receipt['originalTables'] = before['tables']
        receipt['installers'], attempts = s.install_series(ROOT, image, prisma)
        dry = next(row['dryRun'] for row in receipt['installers'] if row['key'] == '190')
        receipt['attemptPlanSha256'] = dry.get('plan', {}).get('planSha256')
        receipt['attemptDryRun'] = dry
        after = s.snapshot(database, before)
        receipt['preservation'] = s.preserve(before, after, attempts)
        receipt['installedTables'] = after['tables']
        installed_sha = s.sha(database)
        receipt['repeatInstallers'] = s.repeat_series(ROOT, image, prisma)
        assert s.snapshot(database, before) == after and s.sha(database) == installed_sha
        receipt['repeatTotalChanges'] = 0
        receipt['repeatedInstallDatabaseBytesPreserved'] = True
        s.command(ROOT, ['docker', 'run', '-d', '--name', NAME, '--network', 'none', '--memory', '1g',
            '--env-file', '/opt/lims/.env', '-e', 'DATABASE_PATH=/app/server/prisma/dev.db',
            '-e', 'DATABASE_URL=file:/app/server/prisma/dev.db', '-e', 'DISABLE_BACKGROUND_JOBS=true',
            '-e', 'ALLOW_PRISMA_DB_PUSH=false', '-e', 'ALLOW_AUTO_SEED=false',
            '--mount', 'type=bind,src=' + str(prisma) + ',dst=/app/server/prisma',
            '--mount', 'type=bind,src=' + str(owned / 'uploads') + ',dst=/app/server/uploads', image], 'owned-start')
        started = True
        for index in range(90):
            ready = subprocess.run(['docker', 'exec', NAME, 'node', '-e',
                "fetch('http://127.0.0.1:3000/api/health').then(async r=>{if(r.status!==200)process.exit(1);console.log(JSON.stringify(await r.json()))}).catch(()=>process.exit(1))"],
                capture_output=True, text=True, timeout=10)
            if ready.returncode == 0:
                receipt['health'] = json.loads(ready.stdout)
                assert receipt['health']['status'] == 'ok'
                break
            time.sleep(1)
        else:
            raise RuntimeError('Owned candidate did not become healthy')
        logs = s.command(ROOT, ['docker', 'logs', NAME], 'startup-ready')
        receipt['startupReady'] = s.ready_logs(logs.stdout + '\n' + logs.stderr)
        assert s.snapshot(database, before) == after, 'Default entrypoint/server startup changed database rows'
        receipt['startupChanges'] = 0
        args = ['docker', 'exec', '-w', '/app/server', '-e', 'POSTFLIGHT_ADMIN_ID=1770311018064',
            '-e', 'POSTFLIGHT_MANAGER_ID=user-mgr-gha', '-e', 'POSTFLIGHT_TECH_ID=user-tech-gha',
            '-e', 'POSTFLIGHT_BASE_URL=http://127.0.0.1:3000']
        legacy = s.command(ROOT, args + [NAME, 'node', 'scripts/postflight_issue140.cjs'], 'api-postflight')
        counts = re.search(r'POSTFLIGHT SUMMARY: (\d+)/(\d+) checks passed \((\d+) failed\)', legacy.stdout)
        assert counts and tuple(map(int, counts.groups())) == (31, 31, 0)
        receipt['apiChecks'] = {'passed': 31, 'total': 31, 'failed': 0}
        receipt['probes'] = []
        for file in PROBES + ['readonly-smoke.cjs']:
            result = s.command(ROOT, args + ['-i', NAME, 'node'], file[:-4], stdin=(ROOT / file).read_text())
            receipt['probes'].append({'file': file, 'sha256': s.sha(ROOT / file), 'exitCode': 0})
            if file == 'readonly-smoke.cjs':
                receipt['smoke'] = json.loads(result.stdout.strip().splitlines()[-1])
        assert s.snapshot(database, before) == after, 'Read-only probes changed evidence'
        receipt['readOnlyProbeChanges'] = 0
        with __import__('sqlite3').connect('file:' + str(database) + '?mode=ro', uri=True) as db:
            receipt['benchCredentialCount'] = db.execute('SELECT count(*) FROM UserBenchCredential').fetchone()[0]
            assert receipt['benchCredentialCount'] == 0
        s.command(ROOT, ['docker', 'stop', '-t', '20', NAME], 'owned-stop')
        started = False
        assert s.sha(backup) == receipt['productionCopySha256']
        receipt['ownedDatabaseSha256'] = s.sha(database)
        receipt['status'] = 'PASSED'
        receipt['completedUtc'] = s.utc()
        receipt['freeBytesAfter'] = s.disk_free()
    except BaseException as error:
        receipt['status'] = 'REFUSED_OR_FAILED_OWNED_COPY'
        receipt['error'] = str(error)
        if started:
            subprocess.run(['docker', 'stop', '-t', '20', NAME], capture_output=True, timeout=30)
        raise
    finally:
        with (ROOT / 'rehearsal-receipt.json').open('x') as output:
            json.dump(receipt, output, indent=2)
        (ROOT / 'rehearsal-receipt.json').chmod(0o400)
        print(json.dumps({'status': receipt['status'], 'receiptSha256': s.sha(ROOT / 'rehearsal-receipt.json'),
            'error': receipt.get('error'), 'preservation': receipt.get('preservation')}), flush=True)
