"""GENERATED self-contained exact-root stop-post. No local imports; no import actions."""

import datetime,hashlib,json,os,pathlib,re,stat,subprocess,sys,threading,time

# Exact AST definitions from kit_contract.py

HEAD = 'be8379745bdfae52ce46496ff26514dc7d729640'

IMAGE = 'sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a'

TREE = '676b01e71211786d1aeace50f19a0b2c9f9c482e'

BUILD_RECEIPT_SHA = 'cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'

ACCEPTANCE_ID = 6212990400

TIMING_DIRECTION_ID = 6213266959

POSTFLIGHT_POLICY = 'AFTER_FIRST_NATURAL_SYNC_BEFORE_INGRESS_REOPEN_ENUMERATED_INTAKE_DELTA'

MEMORY_MAX = 805306368

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()

def require(value, message):
    if not value:
        raise RuntimeError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

# Exact AST definitions from retained_contract.py

ROOT_NAME = 'workflow-batch-release-be837974-20261016T150000Z'

ROOT = pathlib.PurePosixPath('/opt/lims/releases') / ROOT_NAME

MEMORY = 805306368

LIVE_DATA = '/var/lib/docker/volumes/lims_lims-data/_data'

LIVE_ASSETS = '/var/lib/docker/volumes/lims_lims-assets/_data'

def exact_json(raw):

    def pairs(items):
        out = {}
        for k, v in items:
            require(k not in out, 'Duplicate JSON key')
            out[k] = v
        return out
    return json.loads(raw, object_pairs_hook=pairs)

# Exact AST definitions from kit_journal.py

def real_directory(value):
    path = pathlib.Path(value)
    require(path.is_absolute() and path.is_dir(), 'Existing absolute journal directory required')
    for part in (path, *path.parents):
        require(not part.is_symlink(), 'Journal directory alias refused')
    return path

def exclusive_record(directory, name, value, require_directory_sync=True):
    directory = real_directory(directory)
    require(isinstance(name, str) and re.fullmatch('[a-z0-9][a-z0-9.-]{0,150}', name), 'Exact record basename required')
    raw = canonical(value) + b'\n'
    require(len(raw) <= 16 * 1024 ** 2, 'Record exceeds bounded receipt size')
    path = directory / name
    pending = directory / (name + '.pending')
    if path.exists() or path.is_symlink():
        raise FileExistsError('Published record already consumed')
    descriptor = os.open(str(pending), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 384)
    try:
        with os.fdopen(descriptor, 'wb', closefd=False) as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(pending, 256)
        require(stat.S_ISREG(pending.stat().st_mode), 'Journal record is not regular')
    finally:
        os.close(descriptor)
    os.link(pending, path)
    directory_synced = False
    if os.name == 'posix':
        descriptor = os.open(str(directory), os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0))
        try:
            os.fsync(descriptor)
            directory_synced = True
        finally:
            os.close(descriptor)
    require(directory_synced or not require_directory_sync, 'Directory fsync unavailable; no operational call may follow')
    return {'file': name, 'sha256': sha(raw), 'bytes': len(raw), 'directorySynced': directory_synced}

# Exact AST definitions from kit_owned.py

LABEL = 'io.soilfer.release-owned'

DATABASE = '/app/server/prisma/dev.db'

INSTALLERS = {'206': 'install_sample_containers.js', '214': 'install_control_charts.js', '209': 'install_order_revisions.js'}

ALLOWED = {'stopped-integrity': ('/release/stopped_integrity.cjs', None), 'canonical-policy': ('/app/server/scripts/install_lab_policy_schema.js', '--dry-run'), 'chart-impact': ('/app/server/scripts/control_chart_prebinding_impact.js', None), 'order-impact': ('/app/server/scripts/order_revision_impact.js', None), 'first-sync-backup': ('/release/live_backup.cjs', None), 'postflight-backup': ('/release/live_backup.cjs', None)}

def cli_spec(label, data_mount):
    require(label in ALLOWED, 'Unreviewed CLI owner refused')
    require(isinstance(data_mount, dict) and data_mount == {'Type': 'volume', 'Name': 'lims_lims-data', 'Source': LIVE_DATA, 'Destination': '/app/server/prisma'}, 'Exact existing live data volume required')
    owner = str(ROOT) + ':' + label
    name = 'lims-owned-batch-' + hashlib.sha256(owner.encode()).hexdigest()[:24]
    script, mode = ALLOWED[label]
    child = [script, '--db', DATABASE] + ([] if mode is None else [mode])
    writable = label.endswith(('-dry', '-apply', '-repeat'))
    tmp = str(ROOT / (label + '-retained-temp'))
    database_mount = {'Type': 'bind', 'Source': str(ROOT / (label + '-database')), 'Destination': data_mount['Destination'], 'RW': True} if label.endswith('-dry') else {'Type': 'volume', 'Name': data_mount['Name'], 'Source': data_mount['Source'], 'Destination': data_mount['Destination'], 'RW': writable}
    mounts = [database_mount, {'Type': 'bind', 'Source': str(ROOT / 'tooling'), 'Destination': '/release', 'RW': False}, {'Type': 'bind', 'Source': tmp, 'Destination': '/tmp', 'RW': True}]
    environment = {'NODE_OPTIONS': '', 'ALLOW_PRISMA_DB_PUSH': 'false', 'ALLOW_AUTO_SEED': 'false', 'DISABLE_BACKGROUND_JOBS': 'true', 'DATABASE_PATH': DATABASE, 'DATABASE_URL': 'file:' + DATABASE, 'TMPDIR': '/tmp', 'TMP': '/tmp', 'TEMP': '/tmp'}
    args = ['docker', 'create', '--name', name, '--label', LABEL + '=' + owner, '--network', 'none', '--memory', str(MEMORY_MAX), '--memory-swap', str(MEMORY_MAX), '--restart', 'no', '--entrypoint', 'node', '--workdir', '/app/server', '--no-healthcheck']
    for key, value in sorted(environment.items()):
        args += ['-e', key + '=' + value]
    for mount in mounts:
        source = mount.get('Name') if mount['Type'] == 'volume' else mount['Source']
        args += ['--mount', 'type=' + mount['Type'] + ',src=' + source + ',dst=' + mount['Destination'] + ('' if mount['RW'] else ',readonly')]
    args += [IMAGE, '/release/cli_guard.cjs', '/tmp', *child]
    return {'label': label, 'owner': owner, 'name': name, 'image': IMAGE, 'child': child, 'tmp': tmp, 'mounts': mounts, 'environment': environment, 'argv': args, 'neverRetry': True, 'dataWritable': writable}

def validate_spec(spec):
    require(isinstance(spec, dict) and spec == cli_spec(spec.get('label'), {'Type': 'volume', 'Name': 'lims_lims-data', 'Source': LIVE_DATA, 'Destination': '/app/server/prisma'}), 'CLI intent differs from compiled exact specification')
    return spec

def selected(value, spec, running=None, emergency=False):
    """Validate every operational field before trusting an owned identity.

    Full mount objects are sealed and compared separately across lifecycle
    reads. Docker's API mount ARRAY order is never treated as semantic.
    """
    validate_spec(spec)
    require(isinstance(value, dict) and re.fullmatch('[a-f0-9]{64}', value.get('Id', '')), 'Exact full owned ID required')
    config = value.get('Config', {})
    host = value.get('HostConfig', {})
    state = value.get('State', {})
    require(value.get('Name') == '/' + spec['name'] and value.get('Image') == IMAGE and (config.get('Labels', {}).get(LABEL) == spec['owner']), 'Owned name/image/owner differs')
    require(config.get('Entrypoint') == ['node'] and config.get('Cmd') == ['/release/cli_guard.cjs', '/tmp', *spec['child']] and (config.get('WorkingDir') == '/app/server'), 'Owned CLI entrypoint/command differs')
    env = config.get('Env', [])
    pairs = {}
    require(isinstance(env, list), 'Owned environment absent')
    for item in env:
        require(isinstance(item, str) and '=' in item, 'Malformed owned environment')
        key, content = item.split('=', 1)
        require(key not in pairs, 'Duplicate owned environment key')
        pairs[key] = content
    if not emergency:
        require(all((pairs.get(key) == content for key, content in spec['environment'].items())), 'CLI flags or default heap changed')
    if not emergency:
        require(host.get('Memory') == host.get('MemorySwap') == MEMORY_MAX and host.get('NetworkMode') == 'none' and (host.get('RestartPolicy', {}).get('Name') == 'no') and (host.get('AutoRemove') is False), 'CLI resource/network/restart/retention settings differ')
    if not emergency:
        require(config.get('Healthcheck') == {'Test': ['NONE']}, 'CLI healthcheck must be disabled explicitly')
    mounts = value.get('Mounts', [])
    require(isinstance(mounts, list) and len(mounts) == 3 and all((isinstance(m, dict) for m in mounts)) and (len({m.get('Destination') for m in mounts}) == 3), 'Complete unique mount inventory required')
    actual = {m['Destination']: m for m in mounts}
    for expected in spec['mounts']:
        require(expected['Destination'] in actual and all((actual[expected['Destination']].get(k) == v for k, v in expected.items())), 'CLI mount identity or read-only protection differs')
    require(type(state.get('Running')) is bool, 'Exact owned running flag required')
    if not emergency:
        require(state.get('OOMKilled') is False and state.get('Restarting') is False and (state.get('Dead') is False) and (value.get('RestartCount') == 0), 'CLI exited/OOM/restarted/dead state refused')
    if running is not None:
        require(state['Running'] is running, 'Owned running state differs')
    require(isinstance(state.get('StartedAt'), str), 'Owned start timestamp missing')
    return {'id': value['Id'], 'owner': spec['owner'], 'name': value['Name'], 'image': value['Image'], 'running': state['Running'], 'startedAt': state['StartedAt'], 'mounts': sorted(mounts, key=lambda x: x['Destination']), 'configSha256': sha(canonical(config)), 'hostConfigSha256': sha(canonical(host))}

def same_retained(before, after):
    require(all((before[k] == after[k] for k in ('id', 'owner', 'name', 'image', 'startedAt', 'mounts', 'configSha256', 'hostConfigSha256'))), 'Owned retained identity/configuration changed')

for _issue, _script in INSTALLERS.items():
    for _phase, _mode in [('dry', '--dry-run'), ('apply', '--apply'), ('repeat', '--apply')]:
        ALLOWED[_issue + '-' + _phase] = ('/app/server/scripts/' + _script, _mode)

# Exact AST definitions from kit_integrity.py

DATA_MOUNT = {'Type': 'volume', 'Name': 'lims_lims-data', 'Source': LIVE_DATA, 'Destination': '/app/server/prisma'}

# Exact AST definitions from retained_health.py

def assert_healthcheck(actual, derived):
    expected = derived['expectedDockerHealthcheck']
    require(isinstance(actual, dict), 'Healthcheck absent: STOP before start')
    require(set(actual) in [set(expected), set(expected) | {'StartInterval'}] and actual.get('StartInterval', 0) == 0, 'Unexpected Docker health field/default')
    require(all((type(actual.get(k)) is type(v) and actual[k] == v for k, v in expected.items())), 'Derived Docker healthcheck mismatch: STOP before start')
    return expected

# Exact AST definitions from kit_runtime.py

PREDECESSOR_ID = '8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b'

PREDECESSOR_IMAGE = 'sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'

PREDECESSOR_HEAD = '959d17e11c357266f7c2a41b0c84ab76914c591e'

CANDIDATE_OWNER = str(ROOT) + ':candidate'

VOLUMES = {'lims_lims-data': ('/app/server/prisma', LIVE_DATA), 'lims_lims-assets': ('/app/server/uploads', LIVE_ASSETS), 'lims_lims-backups': ('/app/server/backups', '/var/lib/docker/volumes/lims_lims-backups/_data')}

def full_mounts(value):
    mounts = value.get('Mounts')
    require(isinstance(mounts, list) and all((isinstance(m, dict) and isinstance(m.get('Destination'), str) for m in mounts)), 'Complete full mount objects required')
    require(len({m['Destination'] for m in mounts}) == len(mounts), 'Duplicate mount destination')
    return sorted(mounts, key=lambda m: m['Destination'])

def environment(config):
    out = {}
    rows = config.get('Env')
    require(isinstance(rows, list), 'Observed predecessor environment required')
    for row in rows:
        require(isinstance(row, str) and '=' in row and ('\x00' not in row), 'Invalid environment record')
        key, value = row.split('=', 1)
        require(re.fullmatch('[A-Za-z_][A-Za-z0-9_]*', key) and key not in out, 'Duplicate/malformed environment key')
        out[key] = value
    return out

def predecessor_projection(value, name='soilfer-lims'):
    require(value.get('Id') == PREDECESSOR_ID and value.get('Name') == '/' + name and (value.get('Image') == PREDECESSOR_IMAGE), 'Exact normal predecessor identity differs')
    require(isinstance(value.get('Config'), dict) and isinstance(value.get('HostConfig'), dict), 'Full predecessor configuration required')
    state = value.get('State', {})
    require(type(state.get('Running')) is bool and isinstance(state.get('StartedAt'), str) and state['StartedAt'], 'Exact predecessor runtime state required')
    return {'id': value['Id'], 'image': value['Image'], 'name': value['Name'], 'startedAt': state['StartedAt'], 'configSha256': sha(canonical(value['Config'])), 'hostConfigSha256': sha(canonical(value['HostConfig'])), 'mounts': full_mounts(value)}

def candidate_projection(value, spec, running=None, emergency=False):
    require(spec.get('owner') == CANDIDATE_OWNER and spec.get('image') == IMAGE and (spec.get('head') == HEAD) and (spec.get('name') == 'soilfer-lims') and (spec.get('neverRetry') is True), 'Candidate intent target differs')
    require(re.fullmatch('[a-f0-9]{64}', value.get('Id', '')) and value.get('Name') == '/soilfer-lims' and (value.get('Image') == IMAGE), 'Exact candidate identity differs')
    config = value.get('Config', {})
    host = value.get('HostConfig', {})
    state = value.get('State', {})
    require(config.get('Labels', {}).get(LABEL) == CANDIDATE_OWNER and config.get('Labels', {}).get('org.opencontainers.image.revision') == HEAD and (config.get('Entrypoint') == ['/app/docker-entrypoint.sh']) and (config.get('Cmd') in (None, [])), 'Candidate owner/revision/default entrypoint differs')
    mounts = full_mounts(value)
    actual = {m['Destination']: m for m in mounts}
    require(len(actual) == len(spec['mounts']) and all((m['Destination'] in actual and all((actual[m['Destination']].get(k) == v for k, v in m.items())) for m in spec['mounts'])), 'Candidate full mount identities differ')
    require(type(state.get('Running')) is bool and isinstance(state.get('StartedAt'), str), 'Candidate runtime identity absent')
    if running is not None:
        require(state['Running'] is running, 'Candidate running state differs')
    if not emergency:
        require(all((environment(config).get(k) == v for k, v in spec['environment'].items())), 'Candidate runtime environment differs')
        require(host.get('Memory') == host.get('MemorySwap') == MEMORY_MAX and host.get('NetworkMode') == spec['network'] and (host.get('PortBindings') == spec['ports']) and (host.get('RestartPolicy', {}).get('Name') == 'no') and (host.get('AutoRemove') is False) and (host.get('NanoCpus') == 1500000000) and (host.get('LogConfig') == {'Type': 'json-file', 'Config': {'max-size': '50m', 'max-file': '3'}}), 'Candidate memory/swap/CPU/network/ports/restart/log retention differs')
        require(state.get('OOMKilled') is False and (not state.get('Dead')) and (not state.get('Restarting')) and (value.get('RestartCount') == 0), 'Candidate OOM/restart/dead state refused')
        assert_healthcheck(config.get('Healthcheck'), spec['health'])
    return {'id': value['Id'], 'owner': CANDIDATE_OWNER, 'name': value['Name'], 'image': value['Image'], 'startedAt': state['StartedAt'], 'running': state['Running'], 'mounts': mounts, 'configSha256': sha(canonical(config)), 'hostConfigSha256': sha(canonical(host))}

# Exact AST definitions from kit_stop.py

MAX_OUTPUT = 4 * 1024 ** 2

class EmergencyCommands:

    def __init__(self, record_root, require_directory_sync=True, spawn=subprocess.Popen, namespace='controller'):
        self.root = record_root
        self.sync = require_directory_sync
        self.spawn = spawn
        require(namespace in ('controller', 'stop-post'), 'Exact independent emergency namespace required')
        self.namespace = namespace
        self.sequence = 0
        self.retention_errors = []

    def retain(self, label, raw, metadata):
        for suffix, content in zip(('stdout', 'stderr'), raw):
            path = self.root / (label + '.' + suffix)
            fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 256)
            with os.fdopen(fd, 'wb') as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
        exclusive_record(self.root, label + '.json', metadata, self.sync)

    def __call__(self, argv):
        docker = isinstance(argv, list) and len(argv) >= 3 and (argv[0] == 'docker') and (argv[1] in ('ps', 'inspect', 'stop'))
        apache = argv == ['apachectl', 'configtest']
        reload = argv == ['systemctl', 'reload', 'httpd']
        curl = isinstance(argv, list) and argv[:-1] == ['curl', '--silent', '--show-error', '--max-time', '15', '--proto', '=https', '--tlsv1.2', '--output', '/dev/null', '--write-out', '%{http_code}'] and (argv[-1] in ('https://lims.yigini.net/api/health', 'https://lims.yigini.net/login'))
        require(isinstance(argv, list) and all((isinstance(x, str) for x in argv)) and ('--rm' not in argv) and (docker or apache or reload or curl), 'Emergency path permits only exact owner reads/stops and503 rehold')
        self.sequence += 1
        label = 'emergency-' + self.namespace + '-' + str(self.sequence).zfill(6)
        began = time.monotonic()
        process = None
        error = None
        code = None
        buffers = [bytearray(), bytearray()]
        overflow = threading.Event()
        threads = []

        def consume(stream, index):
            try:
                while True:
                    chunk = stream.read(65536)
                    if not chunk:
                        break
                    room = MAX_OUTPUT - len(buffers[index])
                    buffers[index].extend(chunk[:max(0, room)])
                    if len(chunk) > room:
                        overflow.set()
                        break
            except BaseException:
                overflow.set()
            finally:
                stream.close()
        try:
            process = self.spawn(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL)
            for index, stream in enumerate((process.stdout, process.stderr)):
                thread = threading.Thread(target=consume, args=(stream, index), daemon=True)
                thread.start()
                threads.append(thread)
            while process.poll() is None:
                require(not overflow.is_set(), 'Emergency output incomplete/oversized')
                require(time.monotonic() - began < 30, 'Emergency transport deadline reached')
                time.sleep(0.02)
            code = process.returncode
        except BaseException as failure:
            error = type(failure).__name__
            if process is not None and process.poll() is None:
                process.kill()
                try:
                    process.wait(timeout=5)
                except BaseException:
                    pass
        for thread in threads:
            thread.join(timeout=5)
        complete = not overflow.is_set() and (not any((t.is_alive() for t in threads))) and (error is None)
        raw = [bytes(x) for x in buffers]
        metadata = {'argvSha256': sha(canonical(argv)), 'exitCode': code, 'errorType': error, 'elapsedSeconds': time.monotonic() - began, 'completeNotTruncated': complete, 'neverRetry': True, 'stdout': {'sha256': sha(raw[0]), 'bytes': len(raw[0])}, 'stderr': {'sha256': sha(raw[1]), 'bytes': len(raw[1])}, 'rawHostOnly': True}
        try:
            self.retain(label, raw, metadata)
        except BaseException as failure:
            self.retention_errors.append({'call': label, 'errorType': type(failure).__name__, 'metadata': metadata, '_privateUnretainedOriginals': raw})
        require(complete and code == 0 and (apache or not raw[1]), 'Emergency bounded interface refused; never retry')
        return raw[0]

def stop_cli_owners(call, owners=None):
    """Look up exact compiled owners even after lost create/start output.

    All 15 possible CLI owners are inspected when called by an independent
    hook. Empty inventories are explicit per-owner absence observations; they
    are never described as a nonvacuous successful container stop.
    """
    owners = sorted(ALLOWED) if owners is None else list(owners)
    require(len(owners) == len(set(owners)) and all((x in ALLOWED for x in owners)), 'Only exact reviewed CLI owners permitted')
    stopped = []
    absent = []
    errors = []
    for label in owners:
        phase = 'inventory'
        try:
            spec = cli_spec(label, DATA_MOUNT)
            raw = call(['docker', 'ps', '-aq', '--no-trunc', '--filter', 'label=' + LABEL + '=' + spec['owner']])
            require(len(raw) <= 512 * 1024, 'Bounded owner inventory required')
            ids = raw.decode('ascii').splitlines()
            require(len(ids) <= 1 and len(ids) == len(set(ids)) and all((re.fullmatch('[a-f0-9]{64}', x) for x in ids)), 'Duplicate/malformed exact-owner inventory')
            if not ids:
                absent.append({'owner': spec['owner'], 'observedAbsent': True})
                continue
            identity = ids[0]
            phase = 'inspectBefore'
            rows = exact_json(call(['docker', 'inspect', identity]))
            require(isinstance(rows, list) and len(rows) == 1 and (rows[0].get('Id') == identity), 'Exact inspected owner ID required')
            before = selected(rows[0], spec, emergency=True)
            runtime_violation = False
            try:
                selected(rows[0], spec)
            except BaseException:
                runtime_violation = True
            if before['running']:
                phase = 'stop'
                call(['docker', 'stop', '-t', '10', identity])
            phase = 'inspectAfter'
            rows = exact_json(call(['docker', 'inspect', identity]))
            require(isinstance(rows, list) and len(rows) == 1 and (rows[0].get('Id') == identity), 'Exact stopped owner ID required')
            after = selected(rows[0], spec, False, emergency=True)
            same_retained(before, after)
            stopped.append({'before': before, 'after': after, 'stoppedAndRetained': True, 'actualExitCode': rows[0]['State'].get('ExitCode'), 'runtimeViolationObservedBeforeStop': runtime_violation})
        except BaseException as failure:
            errors.append({'ownerLabel': label, 'phase': phase, 'errorType': type(failure).__name__})
    return {'stoppedAndRetained': stopped, 'observedAbsentOwners': absent, 'errors': errors, 'allObservedExactCliOwnersStopped': not errors, 'nonvacuousStoppedOwnerCount': len(stopped), 'noForeignStops': True, 'noRemovalOrRestore': True}

# Exact AST definitions from kit_emergency_ingress.py

CONF = '/etc/httpd/conf/extra/httpd-lims.conf'

BASE = 'https://lims.yigini.net'

def attributes(path, production=True):
    if os.name != 'posix':
        require(not production, 'Linux Apache attribute preservation required')
        return {}
    names = os.listxattr(path, follow_symlinks=False)
    require(len(names) <= 256, 'Bounded complete Apache extended attributes required')
    rows = {name: os.getxattr(path, name, follow_symlinks=False) for name in names}
    require(sum((len(name.encode()) + len(value) for name, value in rows.items())) <= 1024 ** 2, 'Apache extended attributes exceed complete bound')
    return rows

def atomic_config(target, original, held, desired, pending, production=True):
    target = pathlib.Path(target)
    pending = pathlib.Path(pending)
    require(target.is_file() and target.is_absolute() and (pending.parent == target.parent), 'Exact existing Apache file and same-directory atomic install required')
    for ancestor in (target, *target.parents):
        require(not ancestor.is_symlink(), 'Apache file alias refused')
    current = target.read_bytes()
    require(current in (original, held) and desired in (original, held), 'Only exact reviewed Apache original/held byte streams allowed')
    before = target.stat()
    extended = attributes(target, production)
    if current != desired:
        descriptor = os.open(str(pending), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 384)
        try:
            with os.fdopen(descriptor, 'wb', closefd=False) as stream:
                stream.write(desired)
                stream.flush()
                os.fsync(stream.fileno())
            if os.name == 'posix':
                os.fchown(descriptor, before.st_uid, before.st_gid)
            os.fchmod(descriptor, stat.S_IMODE(before.st_mode)) if os.name == 'posix' else os.chmod(pending, stat.S_IMODE(before.st_mode))
            for name, value in extended.items():
                os.setxattr(descriptor, name, value)
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        require(target.stat().st_ino == before.st_ino and target.read_bytes() == current and (attributes(target, production) == extended), 'Apache original changed during atomic preparation')
        os.replace(pending, target)
        if os.name == 'posix':
            descriptor = os.open(str(target.parent), os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0))
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
        else:
            require(not production, 'Linux directory fsync required for production Apache install')
    after = target.stat()
    require(target.read_bytes() == desired and stat.S_IMODE(after.st_mode) == stat.S_IMODE(before.st_mode) and (os.name != 'posix' or (after.st_uid, after.st_gid) == (before.st_uid, before.st_gid)) and (attributes(target, production) == extended), 'Apache bytes/owner/mode/extended attributes changed')
    return {'configurationSha256': sha(desired), 'originalModeOwnerAndExtendedAttributesPreserved': True}

class EmergencyIngress:

    def __init__(self, root, call, original, held, original_sha, held_sha, namespace='controller', conf=CONF, production=True):
        require(namespace in ('controller', 'stop-post') and isinstance(original, bytes) and isinstance(held, bytes) and (original != held) and (max(len(original), len(held)) <= 1024 ** 2) and (sha(original) == original_sha) and (sha(held) == held_sha), 'Exact independently reviewed503 byte binding required')
        self.root = pathlib.Path(root)
        self.call = call
        self.original = original
        self.held = held
        self.namespace = namespace
        self.conf = pathlib.Path(conf)
        self.production = production
        self.sequence = 0

    def __call__(self):
        self.sequence += 1
        name = 'emergency-ingress-' + self.namespace + '-' + str(self.sequence).zfill(6)
        result = atomic_config(self.conf, self.original, self.held, self.held, self.conf.parent / (self.conf.name + '.' + self.root.name + '.' + name), self.production)
        self.call(['apachectl', 'configtest'])
        self.call(['systemctl', 'reload', 'httpd'])
        statuses = []
        for path in ('/api/health', '/login'):
            raw = self.call(['curl', '--silent', '--show-error', '--max-time', '15', '--proto', '=https', '--tlsv1.2', '--output', '/dev/null', '--write-out', '%{http_code}', BASE + path])
            require(raw == b'503', 'Independent TLS503 rehold verification refused')
            statuses.append({'path': path, 'status': 503, 'tlsVerified': True})
        require(self.conf.read_bytes() == self.held, 'Apache held bytes changed after independent rehold')
        return {**result, 'holding503': True, 'http': statuses, 'newEvidenceRequiredBeforeAction': False}

# Exact AST definitions from kit_frozen.py

SOURCE_SCOPE = 'PRODUCTION_FORWARD_206_214_209_QUALIFIED_ACC158_REVIEWED_WHOLE_OUTAGE'

REQUIRED_SOURCE = {'kit_contract.py', 'kit_sequence.py', 'kit_journal.py', 'kit_io.py', 'kit_docker.py', 'kit_consumer_inventory.py', 'kit_owned.py', 'kit_integrity.py', 'stopped_integrity.cjs', 'cli_guard.cjs', 'live_backup.cjs', 'kit_install.py', 'kit_runtime.py', 'kit_readiness.py', 'kit_natural.py', 'kit_no_writers.py', 'kit_ingress.py', 'kit_budget.py', 'kit_disk.py', 'kit_probes.py', 'kit_frozen.py', 'kit_preservation.py', 'kit_recovery.py', 'kit_emergency_ingress.py', 'kit_stop.py', 'kit_stop_lifecycle.py', 'build_stop_post.py', 'predecessor-startup-expectations.json', 'kit_ops.py', 'run_release.py', 'stop_post.py', 'prepare_release.py', 'launch_release.py', 'application-source-binding.json', 'copy-site-closure.json', 'whole-outage-disclosure.json', 'startup-expectations.json', 'probe-source-map.json', 'compose-source.yml', 'retained_accounting.py', 'retained_files.py', 'retained_contract.py', 'retained_health.py', 'retained_memory.py', 'retained_controller.py', 'retained_intake.py', 'retained_fetch.py', 'retained_provenance.py', 'retained_privacy.py', 'retained_runtime_policy.py', 'postflight-roles.cjs', 'postflight-auth.cjs', 'postflight-reference.cjs', 'postflight-qc-runs.cjs', 'postflight-policy.cjs', 'readonly-smoke.cjs'}

def source_index(value):
    require(isinstance(value, dict) and value.get('version') == 1 and (value.get('scope') == SOURCE_SCOPE) and (value.get('root') == str(ROOT)) and (value.get('head') == HEAD) and (value.get('tree') == TREE) and (value.get('image') == IMAGE) and (value.get('buildReceiptSha256') == BUILD_RECEIPT_SHA), 'Exact new production source-index target required')
    require(re.fullmatch('[a-f0-9]{40}', value.get('sourceCommit', '')), 'Published exact source commit required')
    files = value.get('files')
    require(isinstance(files, dict) and REQUIRED_SOURCE <= set(files) and (len(files) <= 256), 'Complete production graph required before source review')
    for name, row in files.items():
        require(isinstance(name, str) and re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,150}', name) and isinstance(row, dict) and (set(row) == {'sha256', 'bytes', 'gitBlob'}) and re.fullmatch('[a-f0-9]{64}', row.get('sha256', '')) and re.fullmatch('[a-f0-9]{40}', row.get('gitBlob', '')) and (type(row.get('bytes')) is int) and (0 < row['bytes'] <= 16 * 1024 ** 2), 'Invalid exact frozen source record')
    return value

def actual_claude(review, after_id):
    require(isinstance(review, dict), 'Original actual review required')
    app = review.get('performed_via_github_app') or {}
    require(app.get('id') == 1236702 and app.get('slug') == 'claude' and (type(review.get('id')) is int) and (review['id'] > after_id), 'New actual Claude GitHub-app review required')
    require(review.get('created_at') == review.get('updated_at') and isinstance(review.get('body'), str), 'Edited or missing review body refused')
    created = datetime.datetime.fromisoformat(review['created_at'].replace('Z', '+00:00'))
    require(created.tzinfo is not None, 'Review UTC timestamp required')
    require(review.get('issue_url') == 'https://api.github.com/repos/yigini/soilfer-lims/issues/162' and review.get('html_url') == 'https://github.com/yigini/soilfer-lims/issues/162#issuecomment-' + str(review['id']), 'Review is not the exact release issue comment')
    return created.timestamp()

def require_tokens(body, tokens):
    for token in tokens:
        require(token in body, 'Actual exact review omitted a required source/kit binding')

def source_review(review, index):
    source_index(index)
    actual_claude(review, TIMING_DIRECTION_ID)
    body = review['body']
    require(body.splitlines()[0].strip() == 'Source review: PASS', 'Actual exact source PASS first line required')
    require_tokens(body, [SOURCE_SCOPE, 'sourceIndexSha256=' + sha(canonical(index)), index['sourceCommit'], str(ROOT), HEAD, TREE, IMAGE, BUILD_RECEIPT_SHA, 'acceptedQualificationId=' + str(ACCEPTANCE_ID), 'timingDirectionId=' + str(TIMING_DIRECTION_ID), 'preApplyExactRawDbWalShmRecoveryOnly=true', 'anyApplyIntentOrUnknownOutcomeForwardOnly=true', 'readinessSeconds=600', 'wholeOutageDisclosureRequired=true', 'singleHostWriter=true', 'postflightPolicy=' + POSTFLIGHT_POLICY, *[r['sha256'] for r in index['files'].values()]])
    return {'id': review['id'], 'bodySha256': sha(body.encode()), 'sourceIndexSha256': sha(canonical(index))}

def kit_review(review, manifest, index, source_pass):
    source = source_review(source_pass, index)
    created = actual_claude(review, source_pass['id'])
    require(isinstance(manifest, dict) and manifest.get('version') == 1 and (manifest.get('scope') == SOURCE_SCOPE) and (manifest.get('root') == str(ROOT)) and (manifest.get('head') == HEAD) and (manifest.get('image') == IMAGE) and (manifest.get('sourceIndexSha256') == source['sourceIndexSha256']) and (manifest.get('sourceReviewBodySha256') == source['bodySha256']), 'Frozen kit does not bind exact source PASS')
    for name in ('consumerConfigurationSha256', 'originalIngressSha256', 'heldIngressSha256', 'wholeOutageDisclosureSha256', 'actualScientificImpactSha256', 'packageFilesSha256'):
        require(re.fullmatch('[a-f0-9]{64}', manifest.get(name, '')), 'Incomplete exact frozen kit metadata')
    body = review['body']
    require(body.splitlines()[0].strip() == 'Exact-kit review: PASS', 'Actual exact-kit PASS first line required')
    require_tokens(body, [SOURCE_SCOPE, 'manifestSha256=' + sha(canonical(manifest)), str(ROOT), HEAD, IMAGE, 'sourceReviewId=' + str(source_pass['id']), 'noHostConsumerActsOnUnhealthyWindow=true', 'freshYYWholeOutageIntakeAndWorkloadGateRequired=true', *[manifest[n] for n in ('consumerConfigurationSha256', 'originalIngressSha256', 'heldIngressSha256', 'wholeOutageDisclosureSha256', 'actualScientificImpactSha256', 'packageFilesSha256')]])
    return {'id': review['id'], 'bodySha256': sha(body.encode()), 'createdEpoch': created, 'manifestSha256': sha(canonical(manifest))}

def frozen_source_bytes(tooling, index):
    source_index(index)
    tooling = pathlib.Path(tooling)
    require(tooling.is_absolute() and tooling.is_dir(), 'Exact existing frozen tooling directory required')
    for p in (tooling, *tooling.parents):
        require(not p.is_symlink(), 'Frozen source directory alias refused')
    require({p.name for p in tooling.iterdir()} == set(index['files']), 'Missing or extra frozen source entry')
    for name, row in index['files'].items():
        path = tooling / name
        s = path.lstat()
        require(stat.S_ISREG(s.st_mode) and (not path.is_symlink()) and (stat.S_IMODE(s.st_mode) == 256) and (s.st_nlink == 1), 'Frozen source must be an independent immutable regular file')
        raw = path.read_bytes()
        require(len(raw) == row['bytes'] and sha(raw) == row['sha256'] and (__import__('hashlib').sha1(('blob ' + str(len(raw)) + '\x00').encode() + raw).hexdigest() == row['gitBlob']), 'Frozen source bytes differ from exact source review')
    return True

# Exact AST definitions from retained_controller.py

UNIT = 'lims-' + ROOT_NAME.lower() + '.service'

MAX_BYTES = 16384

def parse_events(raw):
    out = {}
    for line in raw.decode('ascii').splitlines():
        bits = line.split()
        require(len(bits) == 2 and bits[0] not in out and re.fullmatch('0|[1-9][0-9]*', bits[1]), 'Controller memory events malformed')
        out[bits[0]] = int(bits[1])
        require(out[bits[0]] < 2 ** 64, 'Controller counter overflow')
    require({'oom', 'oom_kill', 'max', 'high'} <= set(out), 'Controller memory counters missing')
    return out

def numeric_membership_path():
    return '/proc/' + str(os.getpid()) + '/cgroup'

def actual_reader(path):
    p = pathlib.Path(path)
    for a in [p, *p.parents]:
        require(not a.is_symlink(), 'Controller cgroup alias')
    with p.open('rb') as f:
        b = f.read(MAX_BYTES + 1)
    require(len(b) <= MAX_BYTES, 'Controller memory raw bound')
    return b

def own_snapshot(read=None, evidence=None):
    read = read or actual_reader

    def recorded(path):
        raw = read(path)
        if evidence is not None:
            evidence(path, raw)
        return raw
    member = recorded(numeric_membership_path())
    text = member.decode('ascii').strip()
    require(text == '0::/system.slice/' + UNIT, 'Exact controller unit membership required')
    group = '/sys/fs/cgroup/system.slice/' + UNIT
    before = pathlib.Path(group).stat() if read is actual_reader else None
    raws = {n: recorded(group + '/' + n) for n in ['memory.events', 'memory.current', 'memory.peak', 'memory.max', 'memory.swap.max', 'memory.stat']}
    require(recorded(numeric_membership_path()) == member, 'Controller membership changed')
    if before is not None:
        after = pathlib.Path(group).stat()
        require((before.st_dev, before.st_ino) == (after.st_dev, after.st_ino), 'Controller cgroup identity changed')
    memory_stat = {}
    for line in raws['memory.stat'].decode('ascii').splitlines():
        bits = line.split()
        require(len(bits) == 2 and bits[0] not in memory_stat and re.fullmatch('0|[1-9][0-9]*', bits[1]), 'Controller memory.stat malformed')
        memory_stat[bits[0]] = int(bits[1])
        require(memory_stat[bits[0]] < 2 ** 64, 'Controller memory.stat overflow')
    require({'anon', 'file'} <= set(memory_stat), 'Controller memory.stat anon/file missing')
    events = parse_events(raws['memory.events'])
    scalars = {}
    for n in ['memory.current', 'memory.peak', 'memory.max', 'memory.swap.max']:
        value = raws[n].decode('ascii').strip()
        require(re.fullmatch('[0-9]+', value), 'Controller memory scalar malformed')
        scalars[n] = int(value)
    require(scalars['memory.max'] == MEMORY and scalars['memory.swap.max'] == 0, 'Controller memory limits differ')
    require(events['oom'] == events['oom_kill'] == 0, 'Controller memory OOM guard refused')
    return {'unit': UNIT, 'membershipRaw': member.decode(), 'raw': {k: v.decode('ascii') for k, v in raws.items()}, 'sha256': {k: sha(v) for k, v in raws.items()}, 'events': events, 'scalars': scalars, 'memoryStat': memory_stat, 'cgroupDevice': before.st_dev if before else None, 'cgroupInode': before.st_ino if before else None, 'peakMaxHighObservationOnly': True}

# Exact AST definitions from kit_stop_lifecycle.py

def private_file(root, name, maximum=16 * 1024 ** 2):
    root = pathlib.Path(root)
    require(isinstance(name, str) and re.fullmatch('[A-Za-z0-9][A-Za-z0-9_./-]{0,200}', name) and (not any((part in ('.', '..', '') for part in name.split('/')))), 'Exact owned private file path required')
    path = root / name
    for part in (path, *path.parents):
        require(not part.is_symlink(), 'Private hook input alias refused')
    s = path.stat()
    require(stat.S_ISREG(s.st_mode) and stat.S_IMODE(s.st_mode) == 256 and (0 < s.st_size <= maximum), 'Complete immutable bounded hook input required')
    raw = path.read_bytes()
    require(len(raw) == s.st_size, 'Hook input changed while reading')
    return raw

def frozen_hook_authority(root):
    manifest = exact_json(private_file(root, 'frozen-manifest.json'))
    index = exact_json(private_file(root, 'source-index.json'))
    source = exact_json(private_file(root, 'source-review.json'))
    review = exact_json(private_file(root, 'exact-kit-review.json'))
    kit_review(review, manifest, index, source)
    frozen_source_bytes(pathlib.Path(root) / 'tooling', index)
    files = manifest.get('packageFiles')
    require(isinstance(files, dict) and 1 <= len(files) <= 512 and (sha(canonical(files)) == manifest['packageFilesSha256']), 'Exact full frozen package file map required')
    for name, pin in files.items():
        raw = private_file(root, name)
        require(isinstance(pin, dict) and set(pin) == {'sha256', 'bytes'} and (sha(raw) == pin['sha256']) and (len(raw) == pin['bytes']), 'Frozen package input changed')
    require(all((files.get('tooling/' + name) == {'sha256': pin['sha256'], 'bytes': pin['bytes']} for name, pin in index['files'].items())), 'Frozen package omitted a reviewed tooling file')
    return manifest

def serving_permit(root, manifest, call):
    permit = exact_json(private_file(root, 'controller-completion-permit.json'))
    raw = private_file(root, 'production-receipt.json')
    receipt = exact_json(raw)
    require(permit.get('root') == receipt.get('root') == str(ROOT) and permit.get('manifestSha256') == receipt.get('sourceManifestSha256') == sha(canonical(manifest)) and (receipt.get('head') == HEAD) and (receipt.get('image') == IMAGE) and (permit.get('status') == receipt.get('status')) and (permit.get('receipt', {}).get('file') == 'production-receipt.json') and (permit['receipt'].get('sha256') == sha(raw)) and (permit['receipt'].get('bytes') == len(raw)), 'Complete atomic terminal receipt/permit binding required')
    consumed = exact_json(private_file(root, 'production-gate-consumed.json'))
    require(consumed.get('manifestSha256') == sha(canonical(manifest)) and consumed.get('exclusive') is True, 'Actual consumed single-use gate required')
    require(receipt.get('ingressReopened') is True and (not receipt.get('holdErrors')), 'Serving permit may not conceal a failed ingress rehold/owner stop')
    if receipt['status'] == 'DEPLOYED_AWAITING_CLAUDIO_POSTCHECK':
        require(receipt.get('anyApplyAttempted') is True and receipt.get('anyEntrypointAttempted') is True and (permit.get('candidateId') == receipt.get('candidateId')) and re.fullmatch('[a-f0-9]{64}', receipt.get('candidateId', '')), 'Exact deployed candidate receipt required')
        intent = exact_json(private_file(root, 'candidate-stop-intent.json'))
        spec = intent['privateSpecification']
        require(intent.get('intent') == permit.get('candidateIntent') == receipt.get('candidateIntent') and intent['intent'].get('specificationSha256') == sha(canonical(spec)), 'Exact durable candidate specification required')
        rows = exact_json(call(['docker', 'inspect', receipt['candidateId']]))
        require(isinstance(rows, list) and len(rows) == 1, 'Exact serving candidate inspection required')
        current = candidate_projection(rows[0], spec, True)
        require(current == receipt.get('candidateStartedIdentity') == exact_json(private_file(root, 'candidate-started-identity.json')) and rows[0]['State'].get('Health', {}).get('Status') == 'healthy' and (receipt.get('candidateMemory', {}).get('hostBeforeControllerExitEventsChecked') is True) and (receipt.get('firstSync', {}).get('sealedBeforeIngressReopens') is True) and (receipt.get('postflights', {}).get('fullAllColumnStatePreserved') is True) and (receipt.get('secondSync', {}).get('secondReceiptOnlyAfterReopen') is True), 'Serving candidate changed or final preservation/memory/receipts incomplete')
        return {'status': receipt['status'], 'leaveCandidateServing': True, 'id': receipt['candidateId']}
    require(receipt['status'] == 'ABORTED_PRE_APPLY_PREDECESSOR_RECOVERED' and receipt.get('anyApplyAttempted') is False and (receipt.get('anyEntrypointAttempted') is False) and (receipt.get('preApplyRecoveryProof', {}).get('mainWalShmHashAndLengthExact') is True), 'No other terminal status permits a serving container')
    ready = receipt.get('predecessorAbortReady', {})
    require(ready.get('id') == PREDECESSOR_ID and ready.get('sameRetainedPredecessor') is True and (ready.get('configurationChanged') is False) and (ready.get('noDatabaseRestore') is True), 'Exact verified same-predecessor recovery required')
    rows = exact_json(call(['docker', 'inspect', PREDECESSOR_ID]))
    original = exact_json(private_file(root, 'predecessor-inspect-original.json'))
    require(isinstance(rows, list) and len(rows) == 1, 'Exact recovered predecessor inspection required')
    old = predecessor_projection(original)
    now = predecessor_projection(rows[0])
    state = rows[0]['State']
    old['startedAt'] = ready.get('startedAt')
    require(now == old and state.get('Running') is True and (state.get('Health', {}).get('Status') == 'healthy') and (state.get('OOMKilled') is False) and (rows[0].get('RestartCount') == 0), 'Recovered predecessor no longer has its exact verified identity/configuration/health')
    return {'status': receipt['status'], 'leaveCandidateServing': False, 'leaveSameRecoveredPredecessorServing': True, 'id': PREDECESSOR_ID}

def stop_candidate_compiled(call):
    raw = call(['docker', 'ps', '-aq', '--no-trunc', '--filter', 'label=' + LABEL + '=' + CANDIDATE_OWNER])
    ids = raw.decode('ascii').splitlines()
    require(len(raw) <= 512 * 1024 and len(ids) <= 1 and (len(ids) == len(set(ids))) and all((re.fullmatch('[a-f0-9]{64}', identity) for identity in ids)), 'Complete exact candidate owner inventory required')
    if not ids:
        return {'observedAbsent': True, 'nonvacuousStop': False}
    identity = ids[0]
    rows = exact_json(call(['docker', 'inspect', identity]))
    require(isinstance(rows, list) and len(rows) == 1 and (rows[0].get('Id') == identity), 'Exact candidate ID required')
    value = rows[0]
    mounts = full_mounts(value)
    named = {m.get('Name') for m in mounts if m.get('Type') == 'volume'}
    require(named in ({'lims_lims-data', 'lims_lims-assets'}, set(VOLUMES)) and len(mounts) == len(named) + 1, 'Compiled exact candidate named volumes/tmp required before stop')
    expected = [{'Type': 'volume', 'Name': name, 'Source': VOLUMES[name][1], 'Destination': VOLUMES[name][0], 'RW': True} for name in sorted(named)]
    expected.append({'Type': 'bind', 'Source': str(ROOT / 'candidate-retained-temp'), 'Destination': '/tmp', 'RW': True})
    spec = {'owner': CANDIDATE_OWNER, 'name': 'soilfer-lims', 'head': HEAD, 'image': IMAGE, 'neverRetry': True, 'mounts': expected}
    before = candidate_projection(value, spec, emergency=True)
    if before['running']:
        call(['docker', 'stop', '-t', '10', identity])
    rows = exact_json(call(['docker', 'inspect', identity]))
    require(isinstance(rows, list) and len(rows) == 1 and (rows[0].get('Id') == identity), 'Exact retained candidate inspection required')
    after = candidate_projection(rows[0], spec, False, emergency=True)
    require(all((before[k] == after[k] for k in ('id', 'owner', 'name', 'image', 'startedAt', 'mounts', 'configSha256', 'hostConfigSha256'))), 'Candidate identity/configuration changed during independent stop')
    return {'id': identity, 'stoppedAndRetained': True, 'nonvacuousStop': True, 'actualExitCode': rows[0]['State'].get('ExitCode')}

def stop_restarted_predecessor(root, call):
    intents = list(pathlib.Path(root).glob('phase-*-preapplypredecessorrestartintent.json'))
    if not intents:
        return {'noPreApplyRestartIntentObserved': True}
    require(len(intents) == 1 and exact_json(private_file(root, intents[0].name)).get('phase') == 'preApplyPredecessorRestartIntent', 'Ambiguous same-predecessor restart intent')
    original = exact_json(private_file(root, 'predecessor-inspect-original.json'))
    rows = exact_json(call(['docker', 'inspect', PREDECESSOR_ID]))
    require(isinstance(rows, list) and len(rows) == 1, 'Exact predecessor inspection required')
    before = predecessor_projection(rows[0])
    old = predecessor_projection(original)
    old['startedAt'] = before['startedAt']
    require(before == old, 'Same restarted predecessor configuration differs')
    if rows[0]['State']['Running']:
        call(['docker', 'stop', '-t', '10', PREDECESSOR_ID])
    rows = exact_json(call(['docker', 'inspect', PREDECESSOR_ID]))
    require(isinstance(rows, list) and len(rows) == 1 and (predecessor_projection(rows[0]) == before) and (rows[0]['State']['Running'] is False), 'Same restarted predecessor remains running or changed')
    return {'id': PREDECESSOR_ID, 'stoppedAndRetained': True, 'actualExitCode': rows[0]['State'].get('ExitCode')}

def stop_post_lifecycle(root, call, validate_serving, hold, controller, retain):
    result = {'root': str(ROOT), 'head': HEAD, 'image': IMAGE, 'errors': [], 'postStopErrors': [], 'noRetryRestoreRemovalOrRestart': True, 'candidateLeavePermission': None}

    def attempt(phase, action):
        try:
            return action()
        except BaseException as error:
            result['errors'].append({'phase': phase, 'errorType': type(error).__name__})
            return None
    result['cliOwners'] = attempt('allExactCliOwners', lambda: stop_cli_owners(call))
    if result['cliOwners'] is not None:
        result['errors'] += result['cliOwners']['errors']
    leave = attempt('terminalServingPermission', validate_serving) if not result['errors'] else None
    result['controller'] = attempt('controllerFinalMemoryEvents', controller)
    if leave is not None and (not leave.get('leaveCandidateServing')):
        result['candidate'] = attempt('exactCandidateAbsenceAfterRecovery', lambda: stop_candidate_compiled(call))
        if result['candidate'] is not None and result['candidate'].get('observedAbsent') is not True:
            result['errors'].append({'phase': 'candidateExistsAfterPreApplyRecovery', 'errorType': 'UnexpectedCandidate'})
    if result['errors'] or getattr(call, 'retention_errors', None):
        leave = None
    if leave is None:
        if (pathlib.Path(root) / 'production-gate-consumed.json').exists():
            result['hold503'] = attempt('independentRehold503', hold)
        if 'candidate' not in result:
            result['candidate'] = attempt('exactCandidateStop', lambda: stop_candidate_compiled(call))
        result['restartedPredecessor'] = attempt('samePredecessorRecoveryStop', lambda: stop_restarted_predecessor(root, call))
        result['controllerAfterStops'] = attempt('controllerAfterExactStops', controller)
    else:
        result['candidateLeavePermission'] = leave
    if getattr(call, 'retention_errors', None):
        result['errors'].append({'phase': 'originalCommandRetention', 'errorType': 'RetentionIncomplete'})
    try:
        retain(result)
    except BaseException as error:
        result['postStopErrors'].append({'phase': 'hookReceiptRetention', 'errorType': type(error).__name__})
    return result


def main():
    root=pathlib.Path(ROOT)
    require(os.name=='posix' and root.is_dir() and str(root.resolve())==str(ROOT),'Exact Linux release root required')
    call=EmergencyCommands(root,True,namespace='stop-post')
    controller_number=0
    def controller():
        nonlocal controller_number
        controller_number+=1;raws=[]
        try:
            value=own_snapshot(evidence=lambda path,raw:raws.append({'path':str(path),'rawAscii':raw.decode('ascii'),
                'sha256':sha(raw),'bytes':len(raw)}))
            original=exact_json(private_file(root,'controller-memory-before.json'))
            require(all(value[k]==original[k] for k in ('unit','membershipRaw','cgroupDevice','cgroupInode')),
                'Stop-post controller cgroup differs from actual before snapshot')
            return value
        finally:
            exclusive_record(root,'stop-post-controller-'+str(controller_number)+'.json',{'raws':raws},True)
    def validate():
        manifest=frozen_hook_authority(root)
        return serving_permit(root,manifest,call)
    def hold():
        manifest=exact_json(private_file(root,'frozen-manifest.json'))
        original=private_file(root,'ingress-original.conf',1024**2)
        held=private_file(root,'ingress-held.conf',1024**2)
        return EmergencyIngress(root,call,original,held,manifest['originalIngressSha256'],
            manifest['heldIngressSha256'],namespace='stop-post')()
    result=stop_post_lifecycle(root,call,validate,hold,controller,
        lambda value:exclusive_record(root,'stop-post-result.json',value,True))
    # This fixed public line contains no private command, configuration or data.
    print('RELEASE_STOP_POST_COMPLETE' if not result['errors'] and not result['postStopErrors'] else 'RELEASE_STOP_POST_FAILED_RETAIN_ALL')
    return 0 if not result['errors'] and not result['postStopErrors'] else 1

if __name__=='__main__':
    sys.exit(main())

