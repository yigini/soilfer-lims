"""Shared release/rehearsal operations. Importing this module performs no I/O."""
import datetime, hashlib, json, os, pathlib, re, shutil, sqlite3, subprocess

HEAD = 'ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf'
LAST_DEPLOY = 'feac653495d6b8a21e082cec596f1e14672fb389'
OLD_IMAGE = 'sha256:159057d56c456a0c7cdef917fd04f53f9a66d6285cc476d7203d63047bfff8e1'
LIVE = pathlib.Path('/var/lib/docker/volumes/lims_lims-data/_data/dev.db')
ASSETS = pathlib.Path('/var/lib/docker/volumes/lims_lims-assets/_data')
CONF = pathlib.Path('/etc/httpd/conf/extra/httpd-lims.conf')
LEGACY_VERIFIERS = [
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
    ('191-link', 'link_recorded_acceptance.js'),
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
ACCEPTANCE_KEY = '191-link'
ACCEPTANCE_RECONCILIATION = '191-recorded-acceptance-link-v1'
ACCEPTANCE_ACTOR = 'system:release-191-acceptance-link'
ACCEPTANCE_TUPLE = {'workItemId':'WI-GTM-DEMO-S02-P', 'sampleId':'GTM-DEMO-S02',
    'analysis':'P_OLSEN', 'attemptId':'att-s02-p-2', 'resultIds':['res-s02-p-run2'],
    'reviewDecisionId':'dec-s02-p-acc'}
INCLUDED_PRS = [288,290]
INSTALLERS = [("205", "install_preparation_records.js")]
MIGRATION_SHA = "e2d59e7b54096d97de5d1443f28516869672b2178cb3da345299d24838a7013c"
RAW_INPUT_MIGRATION_SHA = '850a47806543f1e6587641daa918fe586b6cbb4bfece5a6920132e4b74c593cc'
READY_EVENTS = ['WORKFLOW', 'RESULT_ATTEMPT', 'SAMPLE_HOLD', 'REFERENCE',
    'QC_RULE', 'QC_RUN', 'QC_GATE_SCOPE', 'PT', 'NCR', 'RESULT_EQUIPMENT',
    'WORK_ATTEMPT', 'WORK_REPEAT', 'REPORTED_VALUE', 'REAGENT_LOT',
    'RESULT_OVERRIDE', 'CALCULATION', 'CROSS_CHECK', 'AMENDMENT',
    'REPORT_REVISION', 'BENCH_CREDENTIAL', 'PREPARATION_RECORD']

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
            if name in ['Result', 'WorkAttempt', '_schema_migrations', 'AuditLog']:
                keyed[name] = {row['id']: {field: canonical(row[field]) for field in fields}
                    for row in db.execute('SELECT ' + selected + ' FROM ' + quoted(name) + ' ORDER BY id')}
        attempts = {row['id']: dict(row) for row in db.execute('SELECT * FROM WorkAttempt ORDER BY id')}
        context = None
        if 'WorkItem' in shapes and {'id','labId','assignedLab'} <= {row['name'] for row in shapes['WorkItem']}:
            row = db.execute('SELECT labId,assignedLab FROM WorkItem WHERE id=?', (ACCEPTANCE_TUPLE['workItemId'],)).fetchone()
            context = dict(row) if row else None
        return {'tables': tables, 'shapes': shapes, 'keyed': keyed, 'objects': objects, 'fullAttempts': attempts,
            'acceptanceContext': context,
            'integrity': db.execute('PRAGMA integrity_check').fetchone()[0],
            'foreignKeyViolations': len(db.execute('PRAGMA foreign_key_check').fetchall())}
    finally:
        db.close()

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

def cli(root, image, database_dir, script, mode, label, extra_args=()):
    assert mode in ['--dry-run', '--apply']
    assert mode != '--apply' or script == 'install_preparation_records.js', 'No prior release installer or acceptance may apply'
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
        '/app/server/scripts/' + script, '--db', '/app/server/prisma/dev.db', mode, *extra_args]
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

def ready_logs(log):
    events = []
    for line in log.splitlines():
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if isinstance(value, dict) and str(value.get('event', '')).endswith('_STARTUP_READY'):
            assert value.get('totalChanges', 0) == 0
            events.append(value)
    expected = [prefix + '_STARTUP_READY' for prefix in READY_EVENTS]
    assert [event['event'] for event in events] == expected, 'Missing or out-of-order startup READY events'
    return events


def normalized_sql(sql):
    tokens = re.findall(r"'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|\s+|[^\s'\"]+", sql)
    return ''.join(token for token in tokens if not token.isspace()).rstrip(';')


def preserve(before, after):
    assert before['integrity'] == after['integrity'] == 'ok'
    assert before['foreignKeyViolations'] == after['foreignKeyViolations'] == 0
    assert set(after['tables']) - set(before['tables']) == {'PreparationRecord'}
    assert set(before['tables']) <= set(after['tables'])
    for name, original in before['tables'].items():
        current_columns = {row['name']:row for row in after['shapes'][name]}
        assert all(current_columns.get(row['name']) == row for row in before['shapes'][name]), name+' original column changed'
        if name == '_schema_migrations':
            assert all(after['keyed'][name].get(key)==value for key,value in before['keyed'][name].items())
            assert set(after['keyed'][name])-set(before['keyed'][name]) == {'205_preparation_records'}
            assert after['tables'][name]['count'] == original['count']+1
            installed=json.loads(after['keyed'][name]['205_preparation_records']['details'])
            assert installed['sources']=={'migrationSha256':MIGRATION_SHA,'contractVersion':'205-v1'}
            assert installed['originalRowsPreserved'] is True and installed['backfilledCount']==0
        else:
            assert after['tables'][name]==original, name+' original rows or fields changed'
    assert after['tables']['PreparationRecord']['count']==0
    assert set(before['objects']) <= set(after['objects'])
    changed = [key for key in before['objects'] if before['objects'][key] != after['objects'][key]]
    assert changed==['table:WorkItemDraft'], 'Only nullable draft column may alter original schema'
    old_sql=before['objects']['table:WorkItemDraft']['sql'].rstrip().rstrip(';')
    assert old_sql.endswith(')')
    assert normalized_sql(after['objects']['table:WorkItemDraft']['sql']) == normalized_sql(old_sql[:-1]+', "records" TEXT)')
    columns=after['shapes']['WorkItemDraft']
    assert columns[-1] == {'cid':len(before['shapes']['WorkItemDraft']),'name':'records','type':'TEXT','notnull':0,'dflt_value':None,'pk':0,'hidden':0}
    added=set(after['objects'])-set(before['objects'])
    assert len(added)==7 and all(after['objects'][key]['tbl_name']=='PreparationRecord' for key in added)
    return {'originalTableCount':len(before['tables']),'originalRowsAndFieldsPreserved':True,
        'originalReceiptsPreserved':len(before['keyed']['_schema_migrations']),
        'additionalReceiptCount':1,'newTables':['PreparationRecord'],
        'changedSchemaObjects':changed,'analyticalChanges':0,'acceptanceChanges':0,
        'integrity':'ok','foreignKeyViolations':0}


def validate_legacy(key, value):
    assert value['mode']=='DRY_RUN' and value['totalChanges']==0
    if key=='191-link':
        assert value['blockedWorkItemCount']==0 and value['eligible']==value['unresolved']==[]
    elif key=='272':
        # #272 has no receipt: its read-only classifier verifies the nullable
        # rawInput column and reports ALREADY_PRESENT, never COMPLETE.
        assert value['classification']=='ALREADY_PRESENT', '272 prior schema not complete'
        assert value['backfillCount']==0
        assert value['sources']=={'migrationSha256':RAW_INPUT_MIGRATION_SHA}
    else:
        assert value['classification'].startswith('COMPLETE'), key+' prior schema not complete'
    if key=='191':
        assert value['releaseInventory']['blockedWorkItemCount']==0 and value['releaseInventory']['blockedWorkItems']==[]


def verify_legacy(root,image,directory,label_prefix='legacy'):
    before=snapshot(directory/'dev.db'); files=physical(directory/'dev.db'); rows=[]
    for key,script in LEGACY_VERIFIERS:
        value=cli(root,image,directory,script,'--dry-run',label_prefix+'-'+key+'-dry')
        validate_legacy(key,value)
        rows.append({'key':key,'script':script,'dryRun':value})
        print(json.dumps({'verifiedLegacy':key,'totalChanges':0}),flush=True)
    assert snapshot(directory/'dev.db')==before and physical(directory/'dev.db')==files
    return rows


def install_series(root,image,directory,before_apply=None):
    database=directory/'dev.db'; files=physical(database)
    dry=cli(root,image,directory,'install_preparation_records.js','--dry-run','205-dry')
    assert dry['classification']=='PRE_205' and dry['totalChanges']==dry['backfilledCount']==0
    assert dry['sources']=={'migrationSha256':MIGRATION_SHA,'contractVersion':'205-v1'}
    assert physical(database)==files
    if before_apply: before_apply('205')
    applied=cli(root,image,directory,'install_preparation_records.js','--apply','205-apply')
    assert applied['mode']=='APPLIED' and applied['classification']=='COMPLETE_205'
    assert applied['totalChanges']==1 and applied['backfilledCount']==0
    assert applied['receipt']['originalRowsPreserved'] is True
    assert applied['sources']==dry['sources']
    return [{'key':'205','script':'install_preparation_records.js','dryRun':dry,'apply':applied}]


def repeat_series(root,image,directory,before_apply=None):
    before=snapshot(directory/'dev.db'); files=physical(directory/'dev.db')
    if before_apply: before_apply('205-repeat')
    repeated=cli(root,image,directory,'install_preparation_records.js','--apply','205-repeat')
    assert repeated['classification']=='COMPLETE_205' and repeated['mode']=='NO_OP'
    assert repeated['totalChanges']==repeated['backfilledCount']==0
    assert snapshot(directory/'dev.db')==before and physical(directory/'dev.db')==files
    return [{'key':'205','mode':'NO_OP','totalChanges':0}]
