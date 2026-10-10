"""Shared release/rehearsal operations. Importing this module performs no I/O."""
import datetime, hashlib, json, os, pathlib, re, shutil, sqlite3, subprocess

HEAD = 'eb6de2e88df889be28972d393662ff0fc0abf711'
LAST_DEPLOY = '283a8bb54b66a2167d34d80ad724bdd6460850b1'
OLD_IMAGE = 'sha256:b02ddff8d7549e981edc49215fef2d54ca654adaa2a8924eceb5d4ea0af00394'
LIVE = pathlib.Path('/var/lib/docker/volumes/lims_lims-data/_data/dev.db')
ASSETS = pathlib.Path('/var/lib/docker/volumes/lims_lims-assets/_data')
CONF = pathlib.Path('/etc/httpd/conf/extra/httpd-lims.conf')
INSTALLERS = [
    ('179', 'install_workflow_state_guards.js'),
    ('182', 'install_result_attempt_links.js'),
    ('183', 'install_sample_holds.js'),
    ('184', 'install_reference_materials.js'),
    ('185', 'install_qc_rules.js'),
    ('186', 'install_qc_runs.js'),
    ('187', 'install_qc_gate_scope.js'),
    ('272', 'install_result_raw_input.js'),
    ('193', 'bootstrap_pt_nonconformity.js'),
    ('189', 'install_result_equipment_evidence.js'),
    ('178', 'install_workitem_uniqueness.js'),
    ('190', 'install_work_attempt_contract.js'),
    ('191', 'install_work_repeat_contract.js'),
    ('192', 'install_reported_value_selections.js'),
    ('194', 'install_batch_reagent_lots.js'),
    ('199', 'install_calculation_templates.js'),
    ('197', 'install_result_override_requests.js'),
    ('201', 'install_cross_check_evaluations.js'),
    ('210', 'install_sample_amendment_authorisation.js'),
    ('211', 'install_report_revisions.js'),
    ('202', 'install_bench_credentials.js'),
]
READY_EVENTS = ['WORKFLOW', 'RESULT_ATTEMPT', 'SAMPLE_HOLD', 'REFERENCE',
    'QC_RULE', 'QC_RUN', 'QC_GATE_SCOPE', 'PT', 'NCR', 'RESULT_EQUIPMENT',
    'WORK_ATTEMPT', 'WORK_REPEAT', 'REPORTED_VALUE', 'REAGENT_LOT',
    'RESULT_OVERRIDE', 'CALCULATION', 'CROSS_CHECK', 'AMENDMENT',
    'REPORT_REVISION', 'BENCH_CREDENTIAL']

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def sha(file):
    value = hashlib.sha256()
    with pathlib.Path(file).open('rb') as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()

def canonical(value):
    return {'blobSha256': hashlib.sha256(value).hexdigest()} if isinstance(value, bytes) else value

def fingerprint(rows):
    value = hashlib.sha256()
    for row in rows:
        value.update(json.dumps(row, separators=(',', ':'), ensure_ascii=False,
            default=canonical).encode() + b'\n')
    return value.hexdigest()

def quoted(name):
    return '"' + name.replace('"', '""') + '"'

def snapshot(file, original=None):
    db = sqlite3.connect('file:' + str(file) + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    try:
        objects = {row['type'] + ':' + row['name']: dict(row) for row in db.execute(
            'SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name')}
        names = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        tables, shapes, keyed = {}, {}, {}
        for name in names:
            shapes[name] = [dict(row) for row in db.execute('PRAGMA table_xinfo(' + quoted(name) + ')')]
            fields = original['tables'][name]['fields'] if original and name in original['tables'] else [row['name'] for row in shapes[name] if row['hidden'] == 0]
            selected = ','.join(quoted(field) for field in fields)
            count = db.execute('SELECT count(*) FROM ' + quoted(name)).fetchone()[0]
            rows = db.execute('SELECT ' + selected + ' FROM ' + quoted(name) + ' ORDER BY ' + selected)
            tables[name] = {'fields': fields, 'count': count, 'sha256': fingerprint([canonical(value) for value in row] for row in rows)}
            if name in ['Result', 'WorkAttempt', '_schema_migrations']:
                keyed[name] = {row['id']: {field: canonical(row[field]) for field in fields}
                    for row in db.execute('SELECT ' + selected + ' FROM ' + quoted(name) + ' ORDER BY id')}
        attempts = {row['id']: dict(row) for row in db.execute('SELECT * FROM WorkAttempt ORDER BY id')}
        return {'tables': tables, 'shapes': shapes, 'keyed': keyed, 'objects': objects, 'fullAttempts': attempts,
            'integrity': db.execute('PRAGMA integrity_check').fetchone()[0],
            'foreignKeyViolations': len(db.execute('PRAGMA foreign_key_check').fetchall())}
    finally:
        db.close()

def preserve(before, after, attempts=None):
    assert before['integrity'] == after['integrity'] == 'ok'
    assert before['foreignKeyViolations'] == after['foreignKeyViolations'] == 0
    assert set(before['tables']) <= set(after['tables']), 'An original table disappeared'
    links = {row['resultId']: row['attemptId'] for row in (attempts or {}).get('receipt', {}).get('links', [])}
    created = {row['id'] for row in (attempts or {}).get('receipt', {}).get('createdAttempts', [])}
    for table, original in before['tables'].items():
        current_columns = {row['name']: row for row in after['shapes'][table]}
        assert all(current_columns.get(row['name']) == row for row in before['shapes'][table]), table + ' original column shape changed'
        if table == 'Result':
            expected = {key: {**row, 'attemptId': links.get(key, row['attemptId'])}
                        for key, row in before['keyed'][table].items()}
            assert after['keyed'][table] == expected, 'Result fields changed beyond approved NULL attempt links'
            assert all(key in before['keyed'][table] and before['keyed'][table][key]['attemptId'] is None for key in links)
        elif table == 'WorkAttempt':
            current = after['keyed'][table]
            assert all(current.get(key) == row for key, row in before['keyed'][table].items()), 'Original attempt fields changed'
            assert set(current) - set(before['keyed'][table]) == created, 'Unapproved attempt rows were added'
        elif table == '_schema_migrations':
            assert all(after['keyed'][table].get(key) == row for key, row in before['keyed'][table].items()), 'An original migration receipt changed'
        else:
            assert after['tables'][table] == original, table + ' original rows/fields changed'
    assert set(before['objects']) <= set(after['objects']), 'An original schema object disappeared'
    if attempts:
        assert attempts['flaggedAttemptCount'] == 0 and attempts['receipt']['flaggedGroups'] == []
        assert len(created) == attempts['newAttemptCount'] and len(links) == attempts['linkedResultCount']
        equipment = {row['workItemId']: row for row in attempts['receipt']['historicalEquipmentEvidence']}
        for row in attempts['receipt']['createdAttempts']:
            actual = after['fullAttempts'][row['id']]
            assert all(actual[field] == row[field] for field in ['workItemId', 'attemptNo', 'status', 'batchId'])
            retained = equipment[row['workItemId']]
            assert actual['instrumentId'] == retained['instrumentId'] and actual['evidenceData'] == retained['evidenceData']
            assert all(actual.get(field) is None for field in ['qcBatchId', 'reason', 'requestedBy', 'requestedAt',
                'rawData', 'calcVersion', 'dilutionFactor', 'aliquotId', 'legacyAttemptNoConflict', 'parentAttemptId', 'note'])
            assert actual['createdAt'] == actual['updatedAt']
    return {'originalTableCount': len(before['tables']),
        'originalRowsAndFieldsPreserved': True, 'approvedNullResultLinks': len(links),
        'createdAttempts': len(created), 'originalReceiptsPreserved': len(before['keyed']['_schema_migrations']),
        'additionalReceiptCount': len(after['keyed']['_schema_migrations']) - len(before['keyed']['_schema_migrations']),
        'newTables': sorted(set(after['tables']) - set(before['tables'])),
        'changedSchemaObjects': sorted(key for key in before['objects'] if before['objects'][key] != after['objects'][key]),
        'integrity': 'ok', 'foreignKeyViolations': 0}

def physical(file):
    return {suffix: {'sha256': sha(path), 'bytes': path.stat().st_size} if path.exists() else None
        for suffix in ['', '-wal', '-shm'] for path in [pathlib.Path(str(file) + suffix)]}

def consistent_backup(source, target):
    with pathlib.Path(target).open('xb'):
        pass
    src = sqlite3.connect('file:' + str(source) + '?mode=ro', uri=True)
    dst = sqlite3.connect(str(target))
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    pathlib.Path(target).chmod(0o400)

def disk_reserve(live_bytes, image_bytes, assets_bytes):
    assert all(isinstance(value, int) and value >= 0 for value in [live_bytes, image_bytes, assets_bytes])
    return max(8589934592, 3 * (live_bytes + image_bytes),
               4294967296 + live_bytes + assets_bytes + 268435456)

def disk_free():
    return {path: shutil.disk_usage(path).free for path in ['/opt/lims', '/var/lib/docker']}

def check_drop(before, current, allocated):
    assert set(before) == set(current) == set(allocated)
    unexplained = {path: max(0, before[path] - current[path] - allocated[path]) for path in before}
    assert max(unexplained.values()) <= 500000000, 'Unexplained disk growth exceeds 500 MB'
    return unexplained

def command(root, args, label, expected=0, timeout=240, stdin=None):
    try:
        result = subprocess.run(args, capture_output=True, text=True, input=stdin, timeout=timeout)
    except subprocess.TimeoutExpired as error:
        for suffix, content in [('stdout', error.stdout), ('stderr', error.stderr)]:
            with (root / (label + '.' + suffix)).open('x') as output:
                output.write(content.decode(errors='replace') if isinstance(content, bytes) else content or '')
        raise
    for suffix, content in [('stdout', result.stdout), ('stderr', result.stderr)]:
        with (root / (label + '.' + suffix)).open('x') as output:
            output.write(content)
    if expected is not None:
        assert result.returncode == expected, label + ' failed; see retained logs'
    return result

CLI_WRAPPER = """const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const child=spawnSync(process.execPath,process.argv.slice(1),{stdio:'inherit'});
const peak=Number(fs.readFileSync('/sys/fs/cgroup/memory.peak','utf8').trim());
process.stderr.write(JSON.stringify({releaseCliPeakBytes:peak,childStatus:child.status,childSignal:child.signal})+'\\n');
process.exit(child.status===null?1:child.status);"""

def stop_owned_cli(name, owner):
    observed = subprocess.run(['docker', 'inspect', name, '--format',
        '{{index .Config.Labels "io.soilfer.release-owned"}}'], capture_output=True, text=True, timeout=30)
    if observed.returncode == 0:
        assert observed.stdout.strip() == owner, 'Refusing to stop an unowned CLI container'
        stopped = subprocess.run(['docker', 'stop', '-t', '10', name], capture_output=True, text=True, timeout=30)
        assert stopped.returncode == 0, 'Owned CLI stop failed; hold writers for manual recovery'
        running = subprocess.run(['docker', 'inspect', name, '--format', '{{.State.Running}}'],
            capture_output=True, text=True, timeout=30)
        assert running.returncode != 0 or running.stdout.strip() == 'false', 'An owned CLI writer remains'

def cli(root, image, database_dir, script, mode, label):
    assert mode in ['--dry-run', '--apply']
    mount = 'type=volume,src=lims_lims-data,dst=/app/server/prisma' if database_dir == LIVE.parent else 'type=bind,src=' + str(database_dir) + ',dst=/app/server/prisma'
    assert re.fullmatch('[a-zA-Z0-9_.-]+', label)
    owner = str(root.resolve()) + ':' + label
    name = 'lims-owned-cli-' + hashlib.sha256(owner.encode()).hexdigest()[:24]
    # These bounds failed the original #193 implementation. Deployment still
    # requires a successful fresh-copy proof of the audited streaming repair.
    args = ['docker', 'run', '--rm', '--name', name, '--label', 'io.soilfer.release-owned=' + owner,
        '--network', 'none', '--memory', '768m',
        '-e', 'NODE_OPTIONS=',
        '--mount', mount, '--entrypoint', 'node', image, '-e', CLI_WRAPPER,
        '/app/server/scripts/' + script, '--db', '/app/server/prisma/dev.db', mode]
    try:
        result = command(root, args, label, expected=None)
    except BaseException:
        stop_owned_cli(name, owner)
        raise
    measured = [json.loads(line) for line in result.stderr.splitlines()
        if line.startswith('{"releaseCliPeakBytes":')]
    metadata = {'containerName': name, 'memoryLimitBytes': 805306368,
        'nodeOptions': None, 'exitCode': result.returncode,
        'cgroupMemoryPeak': measured[-1] if measured else None}
    with (root / (label + '-container.json')).open('x') as output:
        json.dump(metadata, output, indent=2)
    assert result.returncode == 0, label + ' failed; see retained logs'
    assert len(measured) == 1 and 0 < measured[0]['releaseCliPeakBytes'] <= 805306368
    return json.loads(result.stdout)

def verify_attempt_plan(dry, reviewed_sha=None):
    assert dry['totalChanges'] == 0 and dry['mode'] == 'DRY_RUN'
    if dry['classification'] == 'COMPLETE':
        return
    assert dry['classification'] == 'PRE_190' and dry['plan']['status'] == 'READY', 'Whole #190 backfill refused; Claudio must pin blockers'
    if reviewed_sha is not None:
        assert dry['plan']['planSha256'] == reviewed_sha, 'The reviewed #190 row plan changed'

def install_series(root, image, database_dir, reviewed_sha=None, before_apply=None):
    stages, attempts = [], None
    for key, script in INSTALLERS:
        dry = cli(root, image, database_dir, script, '--dry-run', key + '-dry')
        assert dry['totalChanges'] == 0
        if key == '190':
            verify_attempt_plan(dry, reviewed_sha)
        if before_apply:
            before_apply(key)
        applied = cli(root, image, database_dir, script, '--apply', key + '-apply')
        assert applied['mode'] in ['APPLIED', 'NO_OP']
        if key == '190' and applied['mode'] == 'APPLIED':
            attempts = applied
        if key != '190':
            for field in ['backfillCount', 'backfilledCount', 'newSelectionCount', 'newNcrCount', 'newAmendmentCount', 'newAttemptLinkCount', 'newWithdrawalCount', 'activationInsertCount', 'unitInsertCount']:
                assert applied.get(field, 0) == 0, key + ' unexpected ' + field
        stages.append({'key': key, 'script': script, 'dryRun': dry, 'apply': applied})
        print(json.dumps({'stage': key, 'mode': applied['mode'], 'totalChanges': applied['totalChanges']}), flush=True)
    return stages, attempts

def repeat_series(root, image, database_dir):
    rows = []
    for key, script in INSTALLERS:
        value = cli(root, image, database_dir, script, '--apply', key + '-repeat')
        assert value['mode'] == 'NO_OP' and value['totalChanges'] == 0
        rows.append({'key': key, 'mode': value['mode'], 'totalChanges': value['totalChanges']})
    return rows

def ready_logs(log):
    events = []
    for line in log.splitlines():
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if str(value.get('event', '')).endswith('_STARTUP_READY'):
            assert value.get('totalChanges', 0) == 0
            events.append(value)
    expected = [prefix + '_STARTUP_READY' for prefix in READY_EVENTS]
    assert [event['event'] for event in events] == expected, 'Missing or out-of-order startup READY events'
    return events
