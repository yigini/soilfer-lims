"""GENERATED independent capture-only stop-post; no import actions or local imports."""

import hashlib,io,json,os,pathlib,re,stat,subprocess,sys,time

# Exact AST definitions from kit_contract.py

IMAGE = 'sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a'

MEMORY_MAX = 805306368

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()

def require(value, message):
    if not value:
        raise RuntimeError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

# Exact AST definitions from retained_contract.py

def exact_json(raw):

    def pairs(items):
        out = {}
        for k, v in items:
            require(k not in out, 'Duplicate JSON key')
            out[k] = v
        return out
    return json.loads(raw, object_pairs_hook=pairs)

# Exact AST definitions from controller_output.py

CONTROLLER_OUTPUT_BYTES = 16 * 1024 ** 2

CONTROLLER_NAMES = frozenset(('controller-original.stdout', 'controller-original.stderr', 'controller-output-intent.json', 'controller-output-intent.json.pending', 'controller-output-closed.json', 'controller-output-closed.json.pending', 'controller-output-bootstrap-failure.json', 'controller-output-bootstrap-failure.json.pending'))

# Exact AST definitions from kit_evidence.py

BLOCK = 4096

SHARES = {'commands': 1536 * 1024 ** 2, 'memory': 512 * 1024 ** 2, 'controller': 512 * 1024 ** 2, 'journal': 624 * 1024 ** 2}

MAIN_POOL_BYTES = 3200 * 1024 ** 2

HOOK_RECORD_LIMIT = 16 * 1024 ** 2

HOOK_RESULT_NAMES = frozenset(('stop-post-controller-1.json', 'stop-post-controller-2.json', 'stop-post-result.json'))

HOOK_NAMESPACE_BYTES = 64 * 1024 ** 2

APACHE_TRANSITION_LIMIT = 6

APACHE_NAMESPACE_BYTES = 32 * 1024 ** 2

EMERGENCY_CALL_LIMIT = 96

EMERGENCY_STREAM_LIMITS = {'stdout': 4 * 1024 ** 2, 'stderr': 64 * 1024}

EMERGENCY_METADATA_LIMIT = 8192

EMERGENCY_NAMESPACE_BYTES = 400 * 1024 ** 2

INDEPENDENT_EMERGENCY_BYTES = 2 * EMERGENCY_NAMESPACE_BYTES

_runtime = None

def allocation(byte_count, entries=1):
    require(type(byte_count) is int and byte_count >= 0 and (type(entries) is int) and (entries > 0), 'Exact evidence bytes and directory entries required')
    return (byte_count + BLOCK - 1) // BLOCK * BLOCK + entries * BLOCK

def fixed_envelope_bounds():
    hook = len(HOOK_RESULT_NAMES) * allocation(HOOK_RECORD_LIMIT, 2)
    apache = APACHE_TRANSITION_LIMIT * (allocation(1024 ** 2) + allocation(1024 ** 2, 256) + 4 * BLOCK)
    require(hook <= HOOK_NAMESPACE_BYTES and apache <= APACHE_NAMESPACE_BYTES, 'Fixed independent record/Apache allowances do not cover source maxima')
    require(sum(SHARES.values()) + CONTROLLER_OUTPUT_BYTES == MAIN_POOL_BYTES and MAIN_POOL_BYTES + INDEPENDENT_EMERGENCY_BYTES + HOOK_NAMESPACE_BYTES + APACHE_NAMESPACE_BYTES == 4 * 1024 ** 3, 'Declared evidence allowances must partition the unchanged4GiB')
    return {'hookRecordAllocationBytes': hook, 'apacheDeclaredAllocationBytes': apache, 'physicalFilesystemClosureClaimed': False}

class EvidenceLedger:

    def __init__(self, root, shares=None):
        fixed_envelope_bounds()
        self.root = pathlib.Path(root)
        require(self.root.is_absolute() and self.root.is_dir() and (not self.root.is_symlink()), 'Real absolute evidence root required')
        self.shares = dict(SHARES if shares is None else shares)
        require(set(self.shares) == set(SHARES) and all((type(n) is int and n > 0 for n in self.shares.values())) and (sum(self.shares.values()) <= MAIN_POOL_BYTES - CONTROLLER_OUTPUT_BYTES), 'Shared runtime evidence shares would double-spend the fixed controller namespace')
        for part in (self.root, *self.root.parents):
            require(not part.is_symlink(), 'Evidence root ancestor alias refused')
        self.used = dict.fromkeys(self.shares, 0)
        self.paths = set()
        self.directories = set()
        self.open = {}
        self.number = 0
        self.active_window = None
        self.window_number = 0

    def reserve(self, paths, maximum_bytes, category, future_directory=None):
        require(category in self.shares and isinstance(paths, tuple) and (len(paths) in (1, 2)), 'Declared evidence category and one/two entry paths required')
        names = tuple((pathlib.Path(p) for p in paths))
        require(all((p.parent != self.root or p.name not in CONTROLLER_NAMES for p in names)), 'Controller pipe namespace is already held by its independent fixed admission')
        if future_directory is not None:
            future_directory = pathlib.Path(future_directory)
            require(future_directory.is_absolute() and self.root in future_directory.parents and future_directory.parent.is_dir() and (not future_directory.exists()) and (not future_directory.is_symlink()) and all((p.parent == future_directory for p in names)), 'Only one exact unused direct parent may be admitted before mkdir')
        relative = []
        parents = set()
        for p in names:
            require(p.is_absolute() and self.root in p.parents, 'Evidence file outside exact root')
            parts = p.relative_to(self.root).parts
            require(0 < len(parts) <= 8 and all((x not in ('', '.', '..') for x in parts)), 'Bounded canonical evidence path required')
            for parent in (p.parent, *p.parent.parents):
                if parent == self.root:
                    break
                require(not parent.is_symlink() and (parent.is_dir() or parent == future_directory), 'Evidence parent alias/missing directory refused')
                parents.add(parent.relative_to(self.root).as_posix())
            relative.append(p.relative_to(self.root).as_posix())
        require(len(set(names)) == len(names) and all((n not in self.paths for n in relative)) and all((not p.exists() and (not p.is_symlink()) for p in names)), 'Evidence path is aliased or consumed')
        new_directories = parents - self.directories
        directory_charge = len(new_directories) * 3 * BLOCK
        amount = allocation(maximum_bytes, len(names)) + directory_charge
        window = self.active_window
        if window is None:
            require(self.used[category] + amount <= self.shares[category] and sum(self.used.values()) + amount <= sum(self.shares.values()), 'Shared ' + category + ' evidence share exhausted before allocation')
            self.used[category] += amount
        else:
            require(window.used[category] + amount <= window.maximum[category], 'Allocation exceeds the complete pre-start ' + category + ' envelope')
            window.used[category] += amount
        self.paths.update(relative)
        self.directories.update(new_directories)
        self.number += 1
        ticket = self.number
        self.open[ticket] = (category, amount, maximum_bytes, len(names), directory_charge, window)
        return ticket

    def settle(self, ticket, actual_bytes):
        require(type(ticket) is int and ticket in self.open, 'Evidence reservation already settled or absent')
        category, amount, maximum_bytes, entries, directory_charge, window = self.open[ticket]
        require(window is None or not window.closed, 'Closed evidence window cannot resume')
        require(type(actual_bytes) is int and 0 <= actual_bytes <= maximum_bytes, 'Actual evidence exceeds its pre-allocation reservation')
        refund = amount - allocation(actual_bytes, entries) - directory_charge
        if window is None:
            self.used[category] -= refund
        else:
            window.used[category] -= refund
        del self.open[ticket]

    def begin_window(self, label, maximum):
        require(self.active_window is None, 'Concurrent/nested evidence windows refused')
        require(isinstance(label, str) and 0 < len(label) <= 80 and all((x in 'abcdefghijklmnopqrstuvwxyz0123456789-' for x in label)), 'Exact bounded evidence window label required')
        require(isinstance(maximum, dict) and set(maximum) == set(self.shares) and all((type(n) is int and n > 0 for n in maximum.values())), 'Complete evidence envelope required')
        require(sum(self.used.values()) + sum(maximum.values()) <= sum(self.shares.values()), 'Complete CLI evidence envelope does not fit before container creation')
        self.window_number += 1
        window = EvidenceWindow(self, label, maximum, self.window_number)
        for category, amount in maximum.items():
            self.used[category] += amount
        self.active_window = window
        return window

    def summary(self):
        return {'sharesBytes': dict(self.shares), 'chargedOrReservedBytes': dict(self.used), 'openReservations': len(self.open), 'activePreStartWindow': None if self.active_window is None else self.active_window.receipt(), 'directoryEntriesCounted': len(self.paths), 'nestedDirectoriesCounted': len(self.directories), 'coveredProducerMaximumBytes': sum(self.shares.values()), 'controllerOutputNamespaceBytesWithinSharedPool': CONTROLLER_OUTPUT_BYTES, 'independentEmergencyEnvelopesBytes': INDEPENDENT_EMERGENCY_BYTES, 'independentHookRecordsBytes': HOOK_NAMESPACE_BYTES, 'apacheTransitionAllowanceBytes': APACHE_NAMESPACE_BYTES, 'unassignedWithinExisting4GiBBytes': 4 * 1024 ** 3 - sum(self.shares.values()) - CONTROLLER_OUTPUT_BYTES - INDEPENDENT_EMERGENCY_BYTES - HOOK_NAMESPACE_BYTES - APACHE_NAMESPACE_BYTES, 'fullGlobalEvidenceClosure': False, 'allOriginalsPrivate': True}

class EvidenceWindow:

    def __init__(self, ledger, label, maximum, number):
        self.ledger = ledger
        self.label = label
        self.maximum = dict(maximum)
        self.number = number
        self.used = dict.fromkeys(maximum, 0)
        self.closed = False

    def receipt(self):
        return {'label': self.label, 'number': self.number, 'maximumBytes': dict(self.maximum), 'chargedOrReservedBytes': dict(self.used), 'heldBeforeContainerCreate': True, 'sharedPoolBytes': sum(self.ledger.shares.values()), 'filesystemPreallocationClaimed': False}

    def close(self):
        require(not self.closed and self.ledger.active_window is self, 'Evidence window consumed or foreign')
        for category, maximum in self.maximum.items():
            self.ledger.used[category] -= maximum - self.used[category]
        self.closed = True
        self.ledger.active_window = None

def bind_runtime(root):
    global _runtime
    require(_runtime is None, 'Shared runtime evidence ledger cannot resume or rebind')
    _runtime = EvidenceLedger(root)
    return _runtime

def admit_evidence(path, byte_count, pending=False, reservation=False, future_directory=None):
    """Inert outside the explicitly bound runtime; local reader fixtures stay local.

    The standalone emergency hook intentionally has no bound runtime ledger:
    quota/retention failure must never suppress an exact owned stop. Its fixed
    namespace envelopes are independent; full filesystem/copy closure is pending.
    """
    if _runtime is None:
        return None
    p = pathlib.Path(path)
    name = p.name
    category = 'controller' if name.startswith('controller-memory-') else 'memory' if '-memory-' in name else 'commands' if name.endswith(('.stdout', '.stderr')) else 'journal'
    paths = (p, p.with_name(p.name + '.pending')) if pending else (p,)
    ticket = _runtime.reserve(paths, byte_count, category, future_directory)
    if not reservation:
        _runtime.settle(ticket, byte_count)
    return (_runtime, ticket)

# Exact AST definitions from kit_journal.py

def real_directory(value):
    path = pathlib.Path(value)
    require(path.is_absolute() and path.is_dir(), 'Existing absolute journal directory required')
    for part in (path, *path.parents):
        require(not part.is_symlink(), 'Journal directory alias refused')
    return path

def exclusive_record(directory, name, value, require_directory_sync=True, independent_namespace=None):
    directory = real_directory(directory)
    require(isinstance(name, str) and re.fullmatch('[a-z0-9][a-z0-9.-]{0,150}', name), 'Exact record basename required')
    raw = canonical(value) + b'\n'
    require(len(raw) <= 16 * 1024 ** 2, 'Record exceeds bounded receipt size')
    path = directory / name
    pending = directory / (name + '.pending')
    if path.exists() or path.is_symlink():
        raise FileExistsError('Published record already consumed')
    if independent_namespace is None:
        admit_evidence(path, len(raw), pending=True)
    elif independent_namespace == 'hook-results':
        require(name in HOOK_RESULT_NAMES and len(raw) <= HOOK_RECORD_LIMIT, 'Independent hook record outside its fixed three-name envelope')
    else:
        require(independent_namespace in ('controller', 'stop-post'), 'Unknown independent record namespace')
        match = re.fullmatch('emergency-' + independent_namespace + '-([0-9]{6})[.]json', name)
        require(match is not None and 1 <= int(match.group(1)) <= EMERGENCY_CALL_LIMIT and (len(raw) <= EMERGENCY_METADATA_LIMIT), 'Independent emergency record outside its fixed envelope')
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

# Exact AST definitions from kit_io.py

OUTPUT_LIMIT = 64 * 1024 ** 2

READ_CHUNK = 65536

def drain_streams(streams, outputs, captured, eof, exceeded, rounds=16, limits=None):
    """Copy bounded original pipe bytes; no reader threads or direct child files.

    Each descriptor is nonblocking. An inherited pipe can therefore neither
    strand a writer after sealing nor hide behind the direct child's exit.
    Only a fully drained, EOF-observed stream can be called complete.
    """
    limits = limits or dict.fromkeys(('stdout', 'stderr'), OUTPUT_LIMIT)
    progress = False
    for _ in range(rounds):
        changed = False
        for name, pipe in streams.items():
            if eof[name] or exceeded[name]:
                continue
            remaining = limits[name] + 1 - captured[name]
            require(remaining > 0, 'No unreserved output read permitted')
            try:
                raw = os.read(pipe.fileno(), min(READ_CHUNK, remaining))
            except BlockingIOError:
                continue
            if not raw:
                eof[name] = True
                changed = True
                continue
            outputs[name].write(raw)
            captured[name] += len(raw)
            changed = True
            if captured[name] > limits[name]:
                exceeded[name] = True
        progress = progress or changed
        if not changed:
            break
    return progress

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
        directory = real_directory(self.root)
        require(self.sequence <= EMERGENCY_CALL_LIMIT, 'Independent emergency retained-call envelope exhausted')
        require(all((len(content) <= EMERGENCY_STREAM_LIMITS[name] + 1 for name, content in zip(('stdout', 'stderr'), raw))), 'Independent emergency stream envelope exceeded')
        require(len(canonical(metadata)) + 1 <= EMERGENCY_METADATA_LIMIT, 'Independent emergency metadata bound exceeded')
        worst = sum((allocation(n + 1) for n in EMERGENCY_STREAM_LIMITS.values())) + allocation(EMERGENCY_METADATA_LIMIT, 2)
        require(EMERGENCY_CALL_LIMIT * worst <= EMERGENCY_NAMESPACE_BYTES, 'Independent emergency namespace declaration insufficient')
        for suffix, content in zip(('stdout', 'stderr'), raw):
            path = directory / (label + '.' + suffix)
            fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 256)
            with os.fdopen(fd, 'wb') as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
        exclusive_record(directory, label + '.json', metadata, self.sync, independent_namespace=self.namespace)

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
        outputs = {name: io.BytesIO() for name in ('stdout', 'stderr')}
        streams = {}
        captured = dict.fromkeys(outputs, 0)
        eof = dict.fromkeys(outputs, False)
        exceeded = dict.fromkeys(outputs, False)
        try:
            process = self.spawn(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, bufsize=0)
            streams = {'stdout': process.stdout, 'stderr': process.stderr}
            for pipe in streams.values():
                os.set_blocking(pipe.fileno(), False)
            while process.poll() is None or not all(eof.values()):
                progress = drain_streams(streams, outputs, captured, eof, exceeded, limits=EMERGENCY_STREAM_LIMITS)
                require(not any(exceeded.values()), 'Emergency output incomplete/oversized')
                require(time.monotonic() - began < 30, 'Emergency transport deadline reached')
                if not progress:
                    time.sleep(0.005)
            code = process.returncode
        except BaseException as failure:
            error = type(failure).__name__
            if process is not None and process.poll() is None:
                process.kill()
                try:
                    process.wait(timeout=5)
                except BaseException:
                    pass
        finally:
            try:
                while drain_streams(streams, outputs, captured, eof, exceeded, limits=EMERGENCY_STREAM_LIMITS):
                    pass
            except BaseException as failure:
                error = error or type(failure).__name__
            finally:
                for pipe in streams.values():
                    pipe.close()
        complete = all(eof.values()) and (not any(exceeded.values())) and (error is None)
        raw = [outputs[name].getvalue() for name in ('stdout', 'stderr')]
        metadata = {'argvSha256': sha(canonical(argv)), 'exitCode': code, 'errorType': error, 'elapsedSeconds': time.monotonic() - began, 'completeNotTruncated': complete, 'neverRetry': True, 'streamLimitsBytes': dict(EMERGENCY_STREAM_LIMITS), 'eofObserved': eof, 'outputLimitExceeded': exceeded, 'stdout': {'sha256': sha(raw[0]), 'bytes': len(raw[0])}, 'stderr': {'sha256': sha(raw[1]), 'bytes': len(raw[1])}, 'rawHostOnly': True}
        try:
            self.retain(label, raw, metadata)
        except BaseException as failure:
            self.retention_errors.append({'call': label, 'errorType': type(failure).__name__, 'metadata': metadata, '_privateUnretainedOriginals': raw})
        require(complete and code == 0 and (apache or not raw[1]), 'Emergency bounded interface refused; never retry')
        return raw[0]

# Exact AST definitions from kit_owned.py

def selected_fields(value, spec, label_key, command, running=None, emergency=False):
    """Shared inspection predicates; callers first validate their typed spec.

    Release and fresh-capture owners have different roots, labels, commands
    and database mounts. Neither wrapper accepts the other specification.
    """
    require(isinstance(value, dict) and re.fullmatch('[a-f0-9]{64}', value.get('Id', '')), 'Exact full owned ID required')
    config = value.get('Config', {})
    host = value.get('HostConfig', {})
    state = value.get('State', {})
    require(value.get('Name') == '/' + spec['name'] and value.get('Image') == IMAGE and (config.get('Labels', {}).get(label_key) == spec['owner']), 'Owned name/image/owner differs')
    require(config.get('Entrypoint') == ['node'] and config.get('Cmd') == command and (config.get('WorkingDir') == '/app/server'), 'Owned CLI entrypoint/command differs')
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
    if not emergency:
        require(host.get('LogConfig') == {'Type': 'none', 'Config': {}}, 'CLI daemon logging must be disabled explicitly')
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

# Exact AST definitions from kit_apache_capture.py

APACHE_CAPTURE_ROOT = '/opt/lims/releases/workflow-batch-review-capture-be837974-20261016T170000Z'

# Exact AST definitions from kit_capture_owned.py

CAPTURE_ROOT = pathlib.Path('/opt/lims/releases/workflow-batch-review-capture-be837974-20261016T170000Z')

CAPTURE_UNIT = 'lims-workflow-batch-review-capture-be837974-20261016t170000z.service'

CAPTURE_LABEL = 'io.soilfer.review-capture-owned'

CAPTURE_DATABASE = '/app/server/prisma/dev.db'

CAPTURE_COMMANDS = {'capture-integrity': ('/release/stopped_integrity.cjs', None), 'capture-canonical-policy': ('/app/server/scripts/install_lab_policy_schema.js', '--dry-run'), 'capture-206-prepare': ('/app/server/scripts/install_sample_containers.js', '--apply'), 'capture-214-prepare': ('/app/server/scripts/install_control_charts.js', '--apply'), 'capture-chart-impact': ('/app/server/scripts/control_chart_prebinding_impact.js', None), 'capture-order-impact': ('/release/order_impact.cjs', None)}

def capture_spec(label):
    require(label in CAPTURE_COMMANDS, 'Only compiled fresh-capture owner permitted')
    require(CAPTURE_ROOT.as_posix() == APACHE_CAPTURE_ROOT, 'Apache and scientific capture roots differ')
    owner = CAPTURE_ROOT.as_posix() + ':' + label
    name = 'lims-review-capture-' + hashlib.sha256(owner.encode()).hexdigest()[:24]
    script, mode = CAPTURE_COMMANDS[label]
    child = [script, '--db', CAPTURE_DATABASE] + ([] if mode is None else [mode])
    writable = label in ('capture-206-prepare', 'capture-214-prepare')
    tmp = (CAPTURE_ROOT / (label + '-retained-temp')).as_posix()
    mounts = [{'Type': 'bind', 'Source': (CAPTURE_ROOT / 'scientific-database').as_posix(), 'Destination': '/app/server/prisma', 'RW': writable}, {'Type': 'bind', 'Source': (CAPTURE_ROOT / 'tooling').as_posix(), 'Destination': '/release', 'RW': False}, {'Type': 'bind', 'Source': tmp, 'Destination': '/tmp', 'RW': True}]
    environment = {'NODE_OPTIONS': '', 'ALLOW_PRISMA_DB_PUSH': 'false', 'ALLOW_AUTO_SEED': 'false', 'DISABLE_BACKGROUND_JOBS': 'true', 'DATABASE_PATH': CAPTURE_DATABASE, 'DATABASE_URL': 'file:' + CAPTURE_DATABASE, 'TMPDIR': '/tmp', 'TMP': '/tmp', 'TEMP': '/tmp'}
    args = ['docker', 'create', '--name', name, '--label', CAPTURE_LABEL + '=' + owner, '--network', 'none', '--memory', str(MEMORY_MAX), '--memory-swap', str(MEMORY_MAX), '--restart', 'no', '--entrypoint', 'node', '--workdir', '/app/server', '--no-healthcheck', '--log-driver', 'none']
    for key, value in sorted(environment.items()):
        args += ['-e', key + '=' + value]
    for mount in mounts:
        args += ['--mount', 'type=bind,src=' + mount['Source'] + ',dst=' + mount['Destination'] + ('' if mount['RW'] else ',readonly')]
    args += [IMAGE, '/release/capture_cli_guard.cjs', '/tmp', label, *child]
    return {'label': label, 'owner': owner, 'name': name, 'image': IMAGE, 'child': child, 'tmp': tmp, 'mounts': mounts, 'environment': environment, 'argv': args, 'neverRetry': True, 'dataWritable': writable}

def validate_capture_spec(spec):
    require(isinstance(spec, dict) and spec == capture_spec(spec.get('label')), 'Fresh-capture intent differs from compiled specification')
    return spec

def capture_selected(value, spec, running=None, emergency=False):
    validate_capture_spec(spec)
    return selected_fields(value, spec, CAPTURE_LABEL, ['/release/capture_cli_guard.cjs', '/tmp', spec['label'], *spec['child']], running, emergency)

def stop_capture_owners(call, owners=None):
    """Independent exact-owner stops; no release, predecessor or serving path.

    Lookup works after a lost create/start return. Refused reads or retention
    failures for one owner cannot suppress an attempt for the next owner.
    """
    owners = sorted(CAPTURE_COMMANDS) if owners is None else list(owners)
    require(len(owners) == len(set(owners)) and all((x in CAPTURE_COMMANDS for x in owners)), 'Only compiled fresh-capture stops permitted')
    stopped = []
    absent = []
    errors = []
    for label in owners:
        phase = 'inventory'
        try:
            spec = capture_spec(label)
            raw = call(['docker', 'ps', '-aq', '--no-trunc', '--filter', 'label=' + CAPTURE_LABEL + '=' + spec['owner']])
            require(isinstance(raw, bytes) and len(raw) <= 512 * 1024, 'Bounded fresh-capture inventory required')
            ids = raw.decode('ascii').splitlines()
            require(len(ids) <= 1 and all((re.fullmatch('[a-f0-9]{64}', x) for x in ids)), 'Duplicate/malformed fresh-capture owner inventory')
            if not ids:
                absent.append({'owner': spec['owner'], 'observedAbsent': True})
                continue
            identity = ids[0]
            phase = 'inspectBefore'
            rows = exact_json(call(['docker', 'inspect', identity]))
            require(isinstance(rows, list) and len(rows) == 1 and isinstance(rows[0], dict) and (rows[0].get('Id') == identity), 'Exact full fresh-capture inspection required')
            before = capture_selected(rows[0], spec, emergency=True)
            runtime_violation = False
            try:
                capture_selected(rows[0], spec)
            except BaseException:
                runtime_violation = True
            if before['running']:
                phase = 'stop'
                call(['docker', 'stop', '-t', '10', identity])
            phase = 'inspectAfter'
            rows = exact_json(call(['docker', 'inspect', identity]))
            require(isinstance(rows, list) and len(rows) == 1 and isinstance(rows[0], dict) and (rows[0].get('Id') == identity), 'Exact full stopped fresh-capture inspection required')
            after = capture_selected(rows[0], spec, False, emergency=True)
            same_retained(before, after)
            stopped.append({'before': before, 'after': after, 'stoppedAndRetained': True, 'actualExitCode': rows[0]['State'].get('ExitCode'), 'runtimeViolationObservedBeforeStop': runtime_violation})
        except BaseException as failure:
            errors.append({'ownerLabel': label, 'phase': phase, 'errorType': type(failure).__name__})
    return {'stoppedAndRetained': stopped, 'observedAbsentOwners': absent, 'errors': errors, 'allObservedExactCaptureOwnersStopped': not errors, 'nonvacuousStoppedOwnerCount': len(stopped), 'noForeignStops': True, 'noRemovalOrRestore': True, 'productionVolumeMounted': False}


def main():
    require(os.name=='posix','Linux fresh-capture stop-post required')
    root=pathlib.Path(CAPTURE_ROOT)
    call=EmergencyCommands(root,True,namespace='stop-post')
    # Stop attempts precede ALL source, controller, receipt and filesystem
    # authority reads. Capture has no serving permit or production restart.
    result=stop_capture_owners(call)
    exclusive_record(root,'stop-post-result.json',result,True,independent_namespace='hook-results')
    return 0 if not result['errors'] and not call.retention_errors else 1

if __name__=='__main__':
    try:code=main()
    except BaseException:code=1
    sys.exit(code)

