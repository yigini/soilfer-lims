"""Gated combined release. Default invocation refuses before production actions.

Never restores a database or removes a schema. Any installer attempt makes a
later failure forward-only, with ingress and writers held for an audited fix.
"""
import datetime, fcntl, json, os, pathlib, re, shutil, signal, subprocess, sys, tarfile, time
import release_support as s
import prepare_manifest as preparation

ROOT = pathlib.Path(__file__).resolve().parent
POSTFLIGHTS = ['postflight-roles.cjs', 'postflight-auth.cjs', 'postflight-reference.cjs',
              'postflight-qc-runs.cjs', 'postflight-policy.cjs', 'readonly-smoke.cjs']
receipt = {'head': s.HEAD, 'lastDeployedSha': s.LAST_DEPLOY, 'timesUtc': {}}
held = False
installer_attempted = False

def check(args):
    return subprocess.check_output(args, text=True, timeout=30).strip()

def save():
    temporary = ROOT / 'production-receipt.in-progress'
    temporary.write_text(json.dumps(receipt, indent=2))
    os.replace(temporary, ROOT / 'production-receipt.json')

def mark(event):
    receipt['timesUtc'][event] = s.utc()
    save()
    print(event + ' ' + receipt['timesUtc'][event], flush=True)

def verify_gate(manifest, gate, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    assert manifest['status'] == 'PREPARED_ONLY_NOT_EXECUTED'
    assert manifest['head'] == gate['head'] == s.HEAD and gate['image'] == manifest['image']
    assert gate['manifestSha256'] == s.sha(ROOT / 'prepared-manifest.json')
    assert gate['coordinatorSha256'] == manifest['files']['release-forward.py'] == s.sha(__file__)
    assert gate['rehearsalReceiptSha256'] == manifest['files']['rehearsal-receipt.json']
    fetched = datetime.datetime.fromisoformat(gate['verifiedUtc'].replace('Z', '+00:00'))
    assert 0 <= (now - fetched).total_seconds() <= 600, 'GitHub gate is stale'
    evidence = gate['prGates']
    assert evidence['head'] == s.HEAD and evidence['includedPrCount'] == 20 and evidence['ungatedPrs'] == []
    assert set(row['number'] for row in evidence['prs']) == {258,257,259,260,263,264,265,266,267,268,269,273,271,276,275,280,282,285,286,287}
    for row in evidence['prs']:
        assert row['gated'] and row['state'] == 'MERGED' and not row['laterAuditFailure']
        assert 'Audit passed: OK to merge and deploy' in row['auditPass']['body']
        assert row['head'] in row['auditPass']['body'] or row['head'][:7] in row['auditPass']['body']
        assert row['checks'] and all(check['conclusion'] == 'SUCCESS' for check in row['checks'])
    main = [run for run in evidence['mainCi'] if run['name'] == 'CI' and run['headSha'] == s.HEAD]
    assert main and main[0]['status'] == 'completed' and main[0]['conclusion'] == 'success'
    review = gate['kitReview']
    assert review['issue'] == 162 and review['reviewedBy'] == 'Claudio'
    assert review['url'].startswith('https://github.com/yigini/soilfer-lims/issues/162#issuecomment-')
    assert 'Audit passed: OK to merge and deploy' in review['body'], 'Exact kit has no audit pass'
    assert s.HEAD in review['body'], 'Kit audit does not name the exact release commit'
    assert all(value in review['body'] for value in [gate['manifestSha256'], gate['coordinatorSha256'], gate['rehearsalReceiptSha256']])
    assert review['approvedAttemptPlanSha256'] == manifest['attemptPlanSha256']
    yy = gate['yyGo']
    assert yy['confirmedByYY'] is True
    assert yy['source'] == 'CLAUDE_LIMS_AUDIT_THREAD' and re.fullmatch('[a-f0-9]{64}', yy['evidenceSha256'])
    assert yy['evidenceSha256'] == manifest['files']['yy-authorization-evidence.md']
    approved = datetime.datetime.fromisoformat(yy['timeUtc'].replace('Z', '+00:00'))
    reviewed = datetime.datetime.fromisoformat(review['timeUtc'].replace('Z', '+00:00'))
    assert reviewed <= now, 'Kit review timestamp is in the future'
    if yy.get('authorizationMode') == 'AUTO_AFTER_REVIEW':
        # YY's Oct 10 decision authorizes this exact application commit after
        # review/rehearsal, and does not require another permission request.
        assert yy['text'] in ['Auto after review', 'go with the deploy']
        assert yy['scopeHead'] == s.HEAD and approved <= now
        assert yy['scopeDecision'] == 'Main now'
        assert re.fullmatch('[a-f0-9]{64}', yy['scopeEvidenceSha256'])
        assert yy['scopeEvidenceSha256'] == yy['evidenceSha256']
    else:
        assert yy['text'].strip().lower() == 'go'
        assert reviewed <= approved <= now and (now - approved).total_seconds() <= 1800
    assert gate['workloadControl']['labAndHubBuildsOwnedByYY'] is True
    assert gate['workloadControl']['releaseWindowControl'] in ['NO_LAB_HUB_BUILDS_OR_IMPORTS', 'RELEASE_DAY_DISK_ABORTS_ACCEPTED']
    for name, expected in manifest['files'].items():
        file = ROOT / name
        assert pathlib.Path(name).name == name and not file.is_symlink() and s.sha(file) == expected, 'Prepared file changed: ' + name

def allocated():
    total = 0
    for file in ROOT.rglob('*'):
        assert not file.is_symlink(), 'The execution directory must contain no symlinks'
        if file.is_file():
            total += file.stat().st_blocks * 512
    return total

def require_reserve(reserve, stage):
    free = s.disk_free()
    assert min(free.values()) >= reserve, 'Disk reserve fell at ' + stage
    return free

def guard_install_disk(key, reserve):
    global installer_attempted
    writers_stopped()
    free = require_reserve(reserve, 'installer ' + key)
    growth = max(0, allocated() - receipt['ownedAllocatedBeforeQuiesce'])
    known = {path: growth if os.stat(path).st_dev == os.stat(ROOT).st_dev else 0 for path in free}
    drop = s.check_drop(receipt['freeBytesBeforeQuiesce'], free, known)
    receipt.setdefault('installerDiskChecks', []).append({'key':key, 'freeBytes':free,
        'knownAllocationBytes':known, 'unexplainedDropBytes':drop})
    installer_attempted = True
    mark('installerAttempt_' + key)

def writers_stopped():
    ids = check(['docker', 'ps', '-q']).split()
    if not ids:
        return
    # Inspect in memory only; do not expose environment secrets.
    containers = json.loads(check(['docker', 'inspect'] + ids))
    data = s.LIVE.parent.resolve()
    for container in containers:
        for mount in container.get('Mounts', []):
            source = pathlib.Path(mount['Source']).resolve()
            assert not (mount.get('RW') and (source == data or source in data.parents or data in source.parents)), 'A database writer remains'

def maintenance():
    text = (ROOT / 'apache-before.conf').read_text()
    assert text.count('SSLCertificateKeyFile ') == 1
    lines = text.splitlines()
    index = next(index for index, line in enumerate(lines) if 'SSLCertificateKeyFile ' in line)
    lines[index+1:index+1] = ['', '    RewriteEngine On', '    RewriteRule .* - [R=503,L]']
    s.CONF.write_text('\n'.join(lines) + '\n')
    tag = 'maintenance-' + str(time.time_ns())
    s.command(ROOT, ['apachectl', 'configtest'], tag + '-configtest')
    s.command(ROOT, ['systemctl', 'reload', 'httpd'], tag + '-reload')

def http(path, expected, label, method='GET'):
    result = s.command(ROOT, ['curl', '-sS', '--max-time', '15', '-o', str(ROOT / (label + '.body')),
        '-w', '%{http_code}', '-X', method, 'https://lims.yigini.net' + path], label)
    assert result.stdout == str(expected), label + ' returned ' + result.stdout

def stop_app():
    present = subprocess.run(['docker', 'container', 'inspect', 'soilfer-lims'], capture_output=True, text=True)
    if present.returncode == 0:
        s.command(ROOT, ['docker', 'stop', '-t', '20', 'soilfer-lims'], 'app-stop-' + str(time.time_ns()))

def start_app(jobs, image):
    stop_app()
    present = subprocess.run(['docker', 'container', 'inspect', 'soilfer-lims'], capture_output=True, text=True)
    if present.returncode == 0:
        s.command(ROOT, ['docker', 'logs', 'soilfer-lims'], 'retained-app-log-' + str(time.time_ns()))
        s.command(ROOT, ['docker', 'rm', 'soilfer-lims'], 'app-remove-' + str(time.time_ns()))
    tag = 'jobs' if jobs else 'held'
    s.command(ROOT, ['docker', 'run', '-d', '--name', 'soilfer-lims', '--restart', 'unless-stopped',
        '-p', '127.0.0.1:3000:3000', '--env-file', '/opt/lims/.env',
        '-e', 'DATABASE_PATH=/app/server/prisma/dev.db', '-e', 'DATABASE_URL=file:/app/server/prisma/dev.db',
        '-e', 'ALLOW_PRISMA_DB_PUSH=false', '-e', 'ALLOW_AUTO_SEED=false',
        '-e', 'DISABLE_BACKGROUND_JOBS=' + ('false' if jobs else 'true'),
        '-v', 'lims_lims-data:/app/server/prisma', '-v', 'lims_lims-assets:/app/server/uploads',
        '--health-cmd', 'wget -q --spider http://localhost:3000/api/health', '--health-interval', '30s',
        '--health-timeout', '10s', '--health-retries', '3', '--health-start-period', '30s', image],
        'app-start-' + tag + '-' + str(time.time_ns()))
    assert check(['docker', 'inspect', 'soilfer-lims', '--format', '{{.Image}}']) == image
    for index in range(90):
        result = subprocess.run(['curl', '-fsS', '--max-time', '2', 'http://127.0.0.1:3000/api/health'], capture_output=True, text=True)
        if result.returncode == 0 and json.loads(result.stdout).get('status') == 'ok':
            return json.loads(result.stdout)
        time.sleep(1)
    raise RuntimeError('Candidate did not become healthy; maintenance stays held')

def reopen(label):
    s.CONF.write_bytes((ROOT / 'apache-before.conf').read_bytes())
    s.command(ROOT, ['apachectl', 'configtest'], label + '-configtest')
    s.command(ROOT, ['systemctl', 'reload', 'httpd'], label + '-reload')
    http('/api/health', 200, label + '-health')
    http('/api/v2/data-exchange/receipts', 401, label + '-denied-post', 'POST')

def recover_failure(error):
    global held
    receipt['status'] = 'FAILED_FORWARD_HOLD' if held else 'REFUSED_BEFORE_MAINTENANCE'
    receipt['error'] = str(error)
    if held and not installer_attempted and receipt.get('preApplyState'):
        try:
            writers_stopped()
            assert s.snapshot(s.LIVE) == receipt['preApplyState'] and s.physical(s.LIVE) == receipt['preApplyFiles']
            old = s.cli(ROOT, s.OLD_IMAGE, s.LIVE.parent, 'install_qc_gate_scope.js', '--dry-run', 'precommit-old-verifier')
            assert old['classification'] == 'COMPLETE' and old['totalChanges'] == 0
            assert s.snapshot(s.LIVE) == receipt['preApplyState'] and s.physical(s.LIVE) == receipt['preApplyFiles']
            receipt['precommitRecoveryHealthJobsOff'] = start_app(False, s.OLD_IMAGE)
            assert s.snapshot(s.LIVE) == receipt['preApplyState']
            reopen('precommit-reopen')
            receipt['precommitRecoveryHealth'] = start_app(True, s.OLD_IMAGE)
            http('/api/health', 200, 'precommit-final-health')
            held = False
            receipt['status'] = 'ABORTED_BEFORE_INSTALL_PREVIOUS_RELEASE_REOPENED'
            mark('precommitRecoveryCompleted')
        except BaseException as recovery_error:
            receipt['precommitRecoveryError'] = str(recovery_error)
    if held:
        for action in [maintenance, stop_app]:
            try:
                action()
            except BaseException as hold_error:
                receipt.setdefault('holdErrors', []).append(str(hold_error))
        receipt['priorityAction'] = 'Notify Claudio on #162; recover forward through a reviewed fix. Never restore a database or start the previous image after an installer attempt.'
    save()

def interrupted(signum, frame):
    raise RuntimeError('Release interrupted by signal ' + str(signum))

if __name__ == '__main__':
    if sys.argv[1:] != ['--execute-gated-production']:
        raise SystemExit('REFUSED: execution needs the reviewed manifest, fresh GitHub gate and YY go')
    assert ROOT.parent == pathlib.Path('/opt/lims/releases') and ROOT.name.startswith('combined-release-eb6de2e8-')
    assert not (ROOT / 'production-receipt.json').exists(), 'Never replay an execution directory'
    lock = open('/opt/lims/apply.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    for signum in [signal.SIGINT, signal.SIGTERM, signal.SIGHUP]:
        signal.signal(signum, interrupted)
    try:
        manifest = json.loads((ROOT / 'prepared-manifest.json').read_text())
        gate = json.loads((ROOT / 'production-gate.json').read_text())
        verify_gate(manifest, gate)
        image = manifest['image']
        rehearsal = json.loads((ROOT / 'rehearsal-receipt.json').read_text())
        build = json.loads((ROOT / 'build-receipt.json').read_text())
        preparation.validate(rehearsal, build, gate['prGates'])
        assert rehearsal['buildReceiptSha256'] == manifest['files']['build-receipt.json']
        assert build['sourceArchiveSha256'] == manifest['files']['source.tar.gz']
        assert build['sourceIndexSha256'] == manifest['files']['source-index.json']
        assert rehearsal['status'] == 'PASSED' and rehearsal['head'] == s.HEAD and rehearsal['candidateImage'] == image
        assert rehearsal['repeatTotalChanges'] == rehearsal['startupChanges'] == rehearsal['readOnlyProbeChanges'] == 0
        assert rehearsal['scriptSha256']['release-forward.py'] == s.sha(__file__)
        assert check(['docker', 'inspect', 'soilfer-lims', '--format', '{{.Image}}']) == s.OLD_IMAGE
        assert check(['docker', 'inspect', 'soilfer-lims', '--format', '{{.State.Running}}']) == 'true'
        assert check(['docker', 'image', 'inspect', image, '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}']) == s.HEAD
        ports = json.loads(check(['docker', 'inspect', 'soilfer-lims', '--format', '{{json .HostConfig.PortBindings}}']))
        assert ports == {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3000'}]}
        assets_bytes = sum(file.stat().st_size for file in s.ASSETS.rglob('*') if file.is_file())
        image_bytes = int(check(['docker', 'image', 'inspect', image, '--format', '{{.Size}}']))
        reserve = s.disk_reserve(s.LIVE.stat().st_size, image_bytes, assets_bytes)
        require_reserve(reserve, 'pre-quiesce initial')
        receipt.update({'candidateImage': image, 'retainedImage': s.OLD_IMAGE, 'githubGate': gate,
            'manifestSha256': s.sha(ROOT / 'prepared-manifest.json'), 'coordinatorSha256': s.sha(__file__),
            'diskReserveRequiredBytes': reserve, 'freeBytesBeforeQuiesce': s.disk_free()})
        old = s.cli(ROOT, s.OLD_IMAGE, s.LIVE.parent, 'install_qc_gate_scope.js', '--dry-run', 'old-prerequisite')
        assert old['classification'] == 'COMPLETE' and old['totalChanges'] == 0
        assert 'R=503' not in s.CONF.read_text(), 'Existing maintenance requires review'
        shutil.copy2(s.CONF, ROOT / 'apache-before.conf')
        require_reserve(reserve, 'pre-quiesce final')
        receipt['ownedAllocatedBeforeQuiesce'] = allocated()
        receipt['freeBytesBeforeQuiesce'] = s.disk_free()
        mark('preflightPassed')
        held = True
        maintenance()
        for path, method in [('/api/health', 'GET'), ('/ws', 'GET'), ('/api/v2/data-exchange/receipts', 'POST')]:
            http(path, 503, 'hold-' + method + '-' + path.strip('/').replace('/', '-'), method)
        mark('ingressQuiesced')
        stop_app()
        writers_stopped()
        mark('jobsQuiesced')
        require_reserve(reserve, 'stopped-writer backup')
        backup = ROOT / 'dev-before-combined-release.db'
        s.consistent_backup(s.LIVE, backup)
        before = s.snapshot(backup)
        assert before['integrity'] == 'ok' and before['foreignKeyViolations'] == 0
        assert s.snapshot(s.LIVE) == before
        receipt['preApplyState'] = before
        receipt['preApplyFiles'] = s.physical(s.LIVE)
        receipt['backupSha256'] = s.sha(backup)
        with tarfile.open(ROOT / 'assets-before-combined-release.tar.gz', 'x:gz') as archive:
            archive.add(s.ASSETS, arcname='uploads')
        (ROOT / 'assets-before-combined-release.tar.gz').chmod(0o400)
        receipt['assetsBackupSha256'] = s.sha(ROOT / 'assets-before-combined-release.tar.gz')
        mark('stoppedWriterBackupVerified')
        dry = s.cli(ROOT, image, s.LIVE.parent, 'install_work_attempt_contract.js', '--dry-run', '190-preflight-dry')
        s.verify_attempt_plan(dry, manifest['attemptPlanSha256'])
        assert s.snapshot(s.LIVE) == before
        receipt['installers'], attempts = s.install_series(ROOT, image, s.LIVE.parent,
            manifest['attemptPlanSha256'], before_apply=lambda key: guard_install_disk(key, reserve))
        after = s.snapshot(s.LIVE, before)
        receipt['preservation'] = s.preserve(before, after, attempts)
        receipt['installedTables'] = after['tables']
        receipt['repeatInstallers'] = s.repeat_series(ROOT, image, s.LIVE.parent)
        assert s.snapshot(s.LIVE, before) == after
        mark('schemaVerified')
        receipt['healthJobsOff'] = start_app(False, image)
        startup = s.command(ROOT, ['docker', 'logs', 'soilfer-lims'], 'candidate-startup')
        receipt['startupReady'] = s.ready_logs(startup.stdout + '\n' + startup.stderr)
        assert s.snapshot(s.LIVE, before) == after
        receipt['startupChanges'] = 0
        mark('candidateHealthyJobsOff')
        args = ['docker', 'exec', '-w', '/app/server', '-e', 'POSTFLIGHT_ADMIN_ID=1770311018064',
            '-e', 'POSTFLIGHT_MANAGER_ID=user-mgr-gha', '-e', 'POSTFLIGHT_TECH_ID=user-tech-gha',
            '-e', 'POSTFLIGHT_BASE_URL=http://127.0.0.1:3000']
        legacy = s.command(ROOT, args + ['soilfer-lims', 'node', 'scripts/postflight_issue140.cjs'], 'api-postflight')
        counts = re.search(r'POSTFLIGHT SUMMARY: (\d+)/(\d+) checks passed \((\d+) failed\)', legacy.stdout)
        assert counts and tuple(map(int, counts.groups())) == (31, 31, 0)
        receipt['apiChecks'] = {'passed': 31, 'total': 31, 'failed': 0}
        for file in POSTFLIGHTS:
            s.command(ROOT, args + ['-i', 'soilfer-lims', 'node'], file[:-4], stdin=(ROOT / file).read_text())
        assert s.snapshot(s.LIVE, before) == after
        receipt['readOnlyProbeChanges'] = 0
        mark('readOnlyProbesPassed')
        reopen('ingress-reopen')
        mark('ingressReopenedJobsOff')
        receipt['productionHealth'] = start_app(True, image)
        mark('jobsReopened')
        http('/api/health', 200, 'production-health')
        http('/api/v2/data-exchange/receipts', 401, 'production-denied-post', 'POST')
        receipt['status'] = 'DEPLOYED'
        receipt['freeBytesAfter'] = s.disk_free()
        held = False
        mark('completed')
        (ROOT / 'production-receipt.json').chmod(0o400)
        print(json.dumps({'status': receipt['status'], 'head': s.HEAD, 'image': image,
            'receiptSha256': s.sha(ROOT / 'production-receipt.json'), 'health': receipt['productionHealth']}), flush=True)
    except BaseException as error:
        recover_failure(error)
        print(json.dumps({'status': receipt['status'], 'error': str(error)}), flush=True)
        raise SystemExit(1)
