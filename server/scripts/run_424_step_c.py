#!/usr/bin/env python3
"""Manual stop/backup/run/verify/start wrapper; rehearsal is the default.

The production mode additionally requires an operator's separate post-audit YY
approval receipt bound to this script and the reviewed plan. It is never called
by application startup. All database row hashes are produced by JavaScript,
using the maintenance script's own canonical JSON representation.
"""
import argparse
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import posixpath
import shutil
import subprocess
import tempfile
import time
import uuid

SCRIPT_PATH = '/app/server/scripts/fix_424_step_c_packages.js'
DB_PATH = '/app/server/prisma/dev.db'

class Stopped(Exception):
    def __init__(self, code, **details):
        super().__init__(code)
        self.code, self.details = code, details

def require(condition, code, **details):
    if not condition:
        raise Stopped(code, **details)

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def sha_file(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for data in iter(lambda: stream.read(1048576), b''):
            result.update(data)
    return result.hexdigest()

def exact(left, right):
    return json.dumps(left, sort_keys=True, separators=(',', ':')) == json.dumps(right, sort_keys=True, separators=(',', ':'))

def normalized_mounts(mounts):
    require(isinstance(mounts, list), 'INVALID_MOUNT_LIST')
    destinations = [row['Destination'] for row in mounts]
    require(len(set(destinations)) == len(destinations), 'DUPLICATE_MOUNT_DESTINATION')
    return sorted(copy.deepcopy(mounts), key=lambda row: row['Destination'])

def writable_mount_overlaps(mount, expected):
    if not mount.get('RW'):
        return False
    if expected.get('Name') and mount.get('Name') == expected['Name']:
        return True
    if not mount.get('Source') or not expected.get('Source'):
        return False
    # Docker Desktop does not match bind sources with `ps --filter volume=`.
    # Inspect mount metadata instead, including writable parent/subdirectory binds.
    def normalized(value):
        return posixpath.normpath(value.replace('\\', '/')).casefold().rstrip('/') + '/'
    left, right = normalized(mount['Source']), normalized(expected['Source'])
    return left.startswith(right) or right.startswith(left)

def file_set(directory):
    result = {}
    for name in ['dev.db', 'dev.db-wal', 'dev.db-shm']:
        path = directory / name
        if path.exists():
            require(path.is_file() and not path.is_symlink(), 'DATABASE_MEMBER_NOT_REGULAR', name=name)
            result[name] = {'bytes': path.stat().st_size, 'sha256': sha_file(path)}
    require('dev.db' in result, 'DATABASE_FILE_MISSING')
    return result

class Docker:
    def __init__(self, context):
        self.prefix = ['docker', '--context', context] if context else ['docker']

    def command(self, *args, input_bytes=None, timeout=120):
        value = self.result(*args, input_bytes=input_bytes, timeout=timeout)
        require(value.returncode == 0, 'DOCKER_COMMAND_FAILED', operation=args[0], exit=value.returncode,
                stdoutBytes=len(value.stdout), stderrBytes=len(value.stderr))
        return value.stdout

    def result(self, *args, input_bytes=None, timeout=120):
        return subprocess.run([*self.prefix, *args], input=input_bytes, capture_output=True, timeout=timeout)

    def inspect(self, container):
        rows = json.loads(self.command('inspect', container))
        require(len(rows) == 1, 'CONTAINER_INSPECT_AMBIGUOUS')
        return rows[0]

    def writers(self, mount):
        writers = []
        for container in self.command('ps', '--no-trunc', '-q').decode().splitlines():
            mounts = json.loads(self.command('inspect', '--format', '{{json .Mounts}}', container))
            if any(writable_mount_overlaps(row, mount) for row in mounts):
                writers.append(container)
        return sorted(writers)

    def node(self, container, code, value=None):
        args = ['exec', '-i', container, 'node', '-e', code]
        raw = self.command(*args, input_bytes=None if value is None else json.dumps(value).encode(), timeout=900)
        try:
            return json.loads(raw)
        except ValueError:
            raise Stopped('NODE_RECEIPT_INVALID', stdoutBytes=len(raw))

def own_scope(data, token):
    for parent in [data, *data.parents]:
        marker = parent / 'owned-copy-marker.json'
        if marker.is_file() and not marker.is_symlink():
            value = json.loads(marker.read_text(encoding='utf-8'))
            require(parent.parent == Path(tempfile.gettempdir()).resolve() and parent.name.startswith('lims-424c-rehearsal-'), 'REHEARSAL_ROOT_NOT_OWNED_TEMP')
            require(value['task'] == 'issue424-stepC-owned-local-rehearsal' and value['token'] == token, 'REHEARSAL_MARKER_MISMATCH')
            require(data.parent == parent and data.name.startswith('app-data-'), 'REHEARSAL_REQUIRES_SEPARATE_APP_COPY')
            return parent
    raise Stopped('REHEARSAL_MARKER_MISSING')

def projected_receipt(value):
    fields = ['ok', 'issue', 'step', 'mode', 'plannedChanges', 'planSha256', 'totalChanges',
              'auditRowsCreated', 'sqliteTotalChanges', 'databaseBeforeSha256', 'databaseAfterSha256',
              'integrityCheck', 'foreignKeyCheckRows', 'packages', 'retirements', 'retiredCodes',
              'labContexts', 'partnerCount', 'eligibility', 'retainedWithoutDefault',
              'availabilityBefore', 'availabilityAfter',
              'unchangedDefinitionsSha256', 'auditActor', 'newAuditIds', 'failures', 'error', 'rolledBack']
    result = {key: value[key] for key in fields if key in value}
    result['records'] = [{key: row[key] for key in ['kind', 'table', 'target', 'state', 'beforeRowSha256', 'afterRowSha256']}
                         for row in value.get('records', [])]
    return result

VERIFY_JS = r"""const Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>input+=s);process.stdin.on('end',()=>{
const payload=JSON.parse(input);if(crypto.createHash('sha256').update(payload.scriptSource).digest('hex')!==payload.scriptSha256)throw Error('Verifier source hash differs');
// Compile the hash-bound module in memory: no maintenance file is installed in the app.
const filename='/app/server/scripts/fix_424_step_c_packages.js',mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(payload.scriptSource,filename);
const D=Module.createRequire(filename)('better-sqlite3');
const script=mod.exports,r=payload.receipt,db=new D('/app/server/prisma/dev.db',{readonly:true,fileMustExist:true});
try{db.pragma('foreign_keys=ON');db.exec('BEGIN');const ids=new Map(r.records.filter(x=>x.state==='changed').map(x=>[x.target,x]));
for(const row of r.records){if(!['Analysis','AnalysisGroup'].includes(row.table))throw Error('Unapproved table');const key=row.table==='Analysis'?'code':'id';const actual=db.prepare('SELECT * FROM '+row.table+' WHERE '+key+'=?').get(row.target);if(script.rowHash(actual)!==row.afterRowSha256)throw Error('Target after-state differs');}
for(const id of r.newAuditIds){const a=db.prepare('SELECT * FROM AuditLog WHERE id=?').get(id),row=ids.get(a?.entityId);const d=JSON.parse(a.details||'{}');if(!row||a.performedBy!=='system:issue-424'||a.action!=='UPDATE'||d.issue!==424||d.step!=='C'||d.kind!==row.kind||script.rowHash(JSON.parse(a.before))!==row.beforeRowSha256||script.rowHash(JSON.parse(a.after))!==row.afterRowSha256)throw Error('Audit evidence differs');}
if(r.newAuditIds.length!==r.totalChanges||db.pragma('integrity_check').some(x=>Object.values(x)[0]!=='ok')||db.pragma('foreign_key_check').length)throw Error('Integrity/count differs');db.exec('ROLLBACK');console.log(JSON.stringify({allTargetRowsAndAuditBeforeAfterVerified:true,auditActor:'system:issue-424',auditRows:r.newAuditIds.length,integrityCheck:'ok',foreignKeyCheckRows:0,canonicalJsonFromSameJavaScriptImplementation:true}));
}finally{if(db.inTransaction)db.exec('ROLLBACK');db.close();}});"""

def run(args):
    script_argument = Path(args.script).absolute()
    data_argument = Path(args.database_directory).absolute()
    require(script_argument.is_file() and not script_argument.is_symlink(), 'SCRIPT_FILE_NOT_REGULAR')
    require(data_argument.is_dir() and not data_argument.is_symlink(), 'DATABASE_DIRECTORY_NOT_REGULAR')
    root = Path(args.root).resolve()
    data = data_argument.resolve()
    script = script_argument.resolve()
    require(sha_file(script) == args.expected_script_sha256, 'SCRIPT_SHA_MISMATCH')
    require(not root.exists() and not root.is_relative_to(data), 'EVIDENCE_ROOT_ALREADY_EXISTS_OR_INSIDE_DATA')
    docker = Docker(args.docker_context)
    context = json.loads(docker.command('context', 'inspect'))
    endpoint = context[0]['Endpoints']['docker']['Host']
    require(endpoint.startswith(('npipe://', 'unix://')), 'REMOTE_DOCKER_ENDPOINT_REFUSED')
    if args.mode == 'rehearsal':
        owned = own_scope(data, args.scope_token)
        require(root.parent == owned and root.name.startswith('wrapper-'), 'REHEARSAL_EVIDENCE_OUTSIDE_OWNED_SCOPE')
    else:
        require(args.authorization, 'PRODUCTION_REQUIRES_SEPARATE_POST_AUDIT_APPROVAL')
        approval = json.loads(Path(args.authorization).read_text())
        require(approval.get('issue') == 424 and approval.get('step') == 'C' and approval.get('productionRunApproved') is True
                and approval.get('auditedScriptSha256') == args.expected_script_sha256
                and approval.get('auditedWrapperSha256') == sha_file(__file__)
                and approval.get('reviewedPlanSha256') == args.expected_plan_sha256
                and approval.get('reviewedChanges') == args.expected_changes == 18
                and isinstance(approval.get('yyApprovalReference'), str) and approval['yyApprovalReference'].strip(), 'PRODUCTION_APPROVAL_BINDING_MISMATCH')
    os.umask(0o077)
    root.mkdir(mode=0o700)
    def save(name, value):
        with (root / name).open('x', encoding='utf-8') as stream:
            json.dump(value, stream, indent=2, ensure_ascii=False)
            stream.write('\n')
    result = {'startedAt': now(), 'mode': args.mode, 'scriptSha256': args.expected_script_sha256,
              'reviewedPlanSha256': args.expected_plan_sha256, 'changedTargets': 0,
              'configurationChanges': 0, 'scriptApplyCalls': 0, 'scriptApplyCallsWithChanges': 0}
    helper = None
    stage = 'preflight'
    try:
        before = docker.inspect(args.container)
        require(before['State']['Running'] and before['State'].get('Health', {}).get('Status') == 'healthy', 'APPLICATION_NOT_HEALTHY_BEFORE_STOP')
        if args.mode == 'rehearsal':
            require(before['Config'].get('Labels', {}).get('issue424c-owner') == args.scope_token, 'CONTAINER_NOT_OWNED_REHEARSAL')
        mounts = normalized_mounts(before['Mounts'])
        db_mount = next((row for row in mounts if row['Destination'] == '/app/server/prisma'), None)
        require(db_mount and db_mount['RW'], 'DATABASE_MOUNT_MISSING_OR_READONLY')
        require(docker.writers(db_mount) == [before['Id']], 'UNEXPECTED_CONCURRENT_DATABASE_WRITER')
        health_code = "fetch('http://127.0.0.1:3000/api/health').then(async r=>{const h=await r.json();if(!r.ok||h.status!=='ok'||!h.version)process.exit(19);console.log(JSON.stringify({httpStatus:r.status,status:h.status,version:h.version}));}).catch(()=>process.exit(1));"
        initial_health = docker.node(before['Id'], health_code)
        source_guard_code = "const f=require('fs'),c=require('crypto'),paths=['/app/server/package.json','/app/docker-entrypoint.sh','/app/server/data/help/RELEASE_MANIFEST_v1.json'];console.log(JSON.stringify(Object.fromEntries(paths.map(p=>[p,c.createHash('sha256').update(f.readFileSync(p)).digest('hex')]))));"
        source_guards = docker.node(before['Id'], source_guard_code)
        # Compare mounted bytes with the supplied host directory before any stop.
        probe = docker.node(before['Id'], "const f=require('fs'),c=require('crypto');const h=c.createHash('sha256');const fd=f.openSync('/app/server/prisma/dev.db','r'),b=Buffer.alloc(1048576);let n;try{while((n=f.readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{f.closeSync(fd);}console.log(JSON.stringify({sha256:h.digest('hex')}));")
        require(probe['sha256'] == sha_file(data / 'dev.db'), 'HOST_DATABASE_PATH_DOES_NOT_MATCH_MOUNTED_BYTES')
        config, host = copy.deepcopy(before['Config']), copy.deepcopy(before['HostConfig'])
        result.update(containerId=before['Id'], imageId=before['Image'], baselineHealth=initial_health,
                      freeBytesBeforeStop=shutil.disk_usage(data).free)
        require(result['freeBytesBeforeStop'] > 10000000000, 'STRICT_GREATER_THAN_10GB_GATE_FAILED')
        file_set(data)
        save('stop-intent.json', {'at': now(), 'containerId': before['Id']})
        stage = 'stopped-backup'
        docker.command('stop', before['Id'])
        require(not docker.inspect(before['Id'])['State']['Running'] and not docker.writers(db_mount), 'WRITER_REMAINS_AFTER_STOP')
        original_files = file_set(data)
        backup = root / 'stopped-backup'
        backup.mkdir()
        for name in original_files:
            with (data / name).open('rb') as incoming, (backup / name).open('xb') as outgoing:
                shutil.copyfileobj(incoming, outgoing)
        require(file_set(backup) == original_files == file_set(data), 'STOPPED_BACKUP_BYTES_DIFFER')
        result['stoppedBackupFiles'] = original_files
        save('stopped-backup-receipt.json', {'at': now(), 'files': original_files,
             'noDataWriter': True, 'sourceAndCopyExact': True, 'freeBytesBeforeStop': result['freeBytesBeforeStop']})
        stage = 'manual-helper'
        name = 'issue424c-manual-' + uuid.uuid4().hex[:12]
        if db_mount['Type'] == 'volume':
            data_bind = 'type=volume,source=' + db_mount['Name'] + ',target=/app/server/prisma'
        else:
            data_bind = 'type=bind,source=' + str(data) + ',target=/app/server/prisma'
        require(',' not in str(script) and ',' not in str(data), 'MOUNT_PATH_CONTAINS_COMMA')
        helper = docker.command('create', '--name', name, '--network', 'none', '--read-only', '--restart', 'no',
            '--log-driver', 'none', '--memory', '805306368', '--memory-swap', '1610612736',
            '--label', 'issue424c-owner=' + args.scope_token, '--entrypoint', 'node',
            '--mount', data_bind, '--mount', 'type=bind,source=' + str(script) + ',target=' + SCRIPT_PATH + ',readonly',
            before['Image'], '-e', 'setInterval(()=>{},1000)').decode().strip()
        result['manualHelperId'] = helper
        docker.command('start', helper)
        require(not docker.inspect(before['Id'])['State']['Running'] and docker.writers(db_mount) == [helper], 'MANUAL_HELPER_NOT_SOLE_WRITER')
        source = docker.node(helper, "const fs=require('fs'),c=require('crypto');console.log(JSON.stringify({sha256:c.createHash('sha256').update(fs.readFileSync('" + SCRIPT_PATH + "')).digest('hex')}));")
        require(source['sha256'] == args.expected_script_sha256, 'MOUNTED_SCRIPT_SHA_MISMATCH')
        def invoke(label, apply=False):
            require(not docker.inspect(before['Id'])['State']['Running'] and docker.writers(db_mount) == [helper], 'APPLICATION_OR_OTHER_WRITER_RUNNING')
            require(sha_file(script) == args.expected_script_sha256, 'SCRIPT_CHANGED_DURING_RUN')
            mounted = docker.node(helper, "const f=require('fs'),c=require('crypto');console.log(JSON.stringify({sha256:c.createHash('sha256').update(f.readFileSync('" + SCRIPT_PATH + "')).digest('hex')}));")
            require(mounted['sha256'] == args.expected_script_sha256, 'MOUNTED_SCRIPT_CHANGED_DURING_RUN')
            command = ['exec', helper, 'node', SCRIPT_PATH, '--db', DB_PATH] + (['--apply'] if apply else [])
            save(label + '-intent.json', {'at': now(), 'apply': apply})
            if apply:
                result['scriptApplyCalls'] += 1
            process = docker.result(*command, timeout=900)
            raw = process.stdout
            try:
                value = json.loads(raw)
            except ValueError:
                save(label + '-invalid-receipt.json', {'at': now(), 'exit': process.returncode,
                     'stdoutBytes': len(raw), 'stderrBytes': len(process.stderr)})
                raise Stopped('SCRIPT_RECEIPT_INVALID', label=label)
            save(label + '.json', {'at': now(), 'exit': process.returncode, 'stderrBytes': len(process.stderr),
                 'stdoutSha256': hashlib.sha256(raw).hexdigest(), 'result': projected_receipt(value)})
            require(process.returncode == 0 and value['ok'] and value.get('integrityCheck') == 'ok' and value.get('foreignKeyCheckRows') == 0, 'SCRIPT_RECEIPT_REFUSED', label=label)
            if apply and value['totalChanges']:
                result['scriptApplyCallsWithChanges'] += 1
            return value
        stage = 'first-dry-run'
        dry = invoke('first-dry-run')
        require(dry['mode'] == 'DRY_RUN' and dry['planSha256'] == args.expected_plan_sha256
                and dry['plannedChanges'] == args.expected_changes and dry['totalChanges'] == dry['auditRowsCreated'] == 0, 'DRY_PLAN_DIFFERS_FROM_REVIEWED_REHEARSAL')
        stage = 'single-apply'
        require(shutil.disk_usage(data).free > 10000000000, 'STRICT_PRE_APPLY_10GB_GATE_FAILED')
        applied = invoke('single-apply', True)
        require(applied['planSha256'] == dry['planSha256'] and applied['totalChanges'] == applied['auditRowsCreated'] == args.expected_changes
                and applied['sqliteTotalChanges'] == args.expected_changes * 2, 'APPLY_COUNTS_OR_PLAN_DIFFER')
        result.update(changedTargets=applied['totalChanges'], auditRows=applied['auditRowsCreated'], sqliteTotalChanges=applied['sqliteTotalChanges'])
        stage = 'second-dry-run'
        second = invoke('second-dry-run')
        require(second['plannedChanges'] == second['totalChanges'] == second['auditRowsCreated'] == second['sqliteTotalChanges'] == 0, 'SECOND_DRY_RUN_NOT_NO_OP')
        require(exact(second['availabilityBefore'], dry['availabilityAfter'])
                and exact(second['availabilityAfter'], dry['availabilityAfter']), 'MISSING_DEFAULT_LIST_CHANGED_AFTER_APPLY')
        if args.mode == 'rehearsal':
            repeated = invoke('rehearsal-second-apply', True)
            require(repeated['plannedChanges'] == repeated['totalChanges'] == repeated['auditRowsCreated'] == repeated['sqliteTotalChanges'] == 0, 'SECOND_APPLY_NOT_IDEMPOTENT')
        stage = 'independent-readback'
        verification_input = {'receipt': projected_receipt(applied), 'scriptSource': script.read_bytes().decode('utf-8'),
                              'scriptSha256': args.expected_script_sha256}
        verification = docker.node(helper, VERIFY_JS, verification_input)
        require(verification['allTargetRowsAndAuditBeforeAfterVerified'], 'INDEPENDENT_ROW_OR_AUDIT_VERIFICATION_FAILED')
        save('independent-verification.json', verification)
        result.update(changedTargets=applied['totalChanges'], auditRows=applied['auditRowsCreated'],
            sqliteTotalChanges=applied['sqliteTotalChanges'], packages=applied['packages'], retirements=applied['retirements'],
            availabilityBefore=dry['availabilityBefore'], availabilityAfter=second['availabilityAfter'],
            secondDryRunChanges=0, independentVerification=verification)
        docker.command('stop', helper)
        require(not docker.writers(db_mount), 'DATABASE_WRITER_REMAINS_BEFORE_STARTUP')
        require(file_set(backup) == original_files, 'PRESERVED_BACKUP_CHANGED')
        stage = 'same-container-startup'
        current = docker.inspect(before['Id'])
        require(current['Image'] == before['Image'] and exact(current['Config'], config) and exact(current['HostConfig'], host), 'SAME_CONTAINER_CONFIGURATION_CHANGED')
        require(exact(normalized_mounts(current['Mounts']), mounts), 'PERSISTENT_MOUNT_OBJECT_CHANGED')
        require(shutil.disk_usage(data).free > 10000000000, 'STRICT_PRE_STARTUP_10GB_GATE_FAILED')
        restart_at = now()
        save('same-container-start-intent.json', {'at': restart_at, 'containerId': before['Id']})
        docker.command('start', before['Id'])
        deadline = time.monotonic() + args.startup_timeout
        while time.monotonic() < deadline:
            current = docker.inspect(before['Id'])
            require(current['State']['Running'] and not current['State'].get('OOMKilled')
                    and current['RestartCount'] == before['RestartCount'], 'APPLICATION_EXITED_RESTARTED_OR_OOM')
            require(current['Image'] == before['Image'] and exact(current['Config'], config)
                    and exact(current['HostConfig'], host) and exact(normalized_mounts(current['Mounts']), mounts), 'RUNNING_CONFIGURATION_OR_MOUNTS_CHANGED')
            if current['State'].get('Health', {}).get('Status') == 'healthy':
                healthy = docker.node(before['Id'], health_code)
                if healthy == initial_health:
                    result.update(health=healthy, healthAt=now(), startedAt=current['State']['StartedAt'])
                    break
            time.sleep(3)
        else:
            raise Stopped('SAME_CONTAINER_STARTUP_HEALTH_TIMEOUT')
        logs = docker.command('logs', '--since', restart_at, before['Id'])
        summaries = []
        decoder = json.JSONDecoder()
        text = logs.decode(errors='replace')
        offset = 0
        for line in text.splitlines(keepends=True):
            if line.lstrip().startswith('{'):
                try:
                    value, unused = decoder.raw_decode(text, offset + len(line) - len(line.lstrip()))
                    if isinstance(value, dict) and ('classification' in value or 'mode' in value):
                        summaries.append({key: value[key] for key in ['classification', 'mode', 'totalChanges'] if key in value})
                except ValueError:
                    pass
            offset += len(line)
        require(summaries and all(row.get('totalChanges', 0) == 0 and row.get('mode') != 'APPLIED' for row in summaries), 'UNEXPECTED_STARTUP_INSTALLER_WRITES')
        require(any(row.get('classification') == 'COMPLETE_338' and row.get('mode') == 'NO_OP' for row in summaries), 'STARTUP_NO_OP_SUMMARY_MISSING')
        require(b'Loading the standard analysis catalogue for this new installation' not in logs, 'EXISTING_COPY_ENTERED_FIRST_INSTALL_SEED')
        require(exact(docker.node(before['Id'], source_guard_code), source_guards), 'APPLICATION_ENTRYPOINT_OR_HELP_ARTIFACT_CHANGED')
        post_startup = docker.node(before['Id'], VERIFY_JS, verification_input)
        require(post_startup['allTargetRowsAndAuditBeforeAfterVerified'], 'POST_STARTUP_ROWS_OR_AUDITS_DIFFER')
        save('post-startup-independent-verification.json', post_startup)
        result.update(success=True, completedAt=now(), sameContainerAndImage=True, fullConfigAndAllMountObjectsPreserved=True,
            startupSummaries=summaries, postStartupVerification=post_startup,
            rawApplicationLogsNotPersisted=True, sourceAndHelpArtifactsPreserved=source_guards)
        save('completion.json', result)
        print(json.dumps({key: result[key] for key in ['success', 'mode', 'changedTargets', 'auditRows', 'sqliteTotalChanges', 'health']}), flush=True)
        return result
    except Exception as error:
        if helper:
            try:
                if docker.inspect(helper)['State']['Running']:
                    docker.command('stop', helper)
            except Exception:
                pass
        failure = {'at': now(), 'stage': stage, 'error': error.code if isinstance(error, Stopped) else type(error).__name__,
                   'details': error.details if isinstance(error, Stopped) else {}, 'partial': result,
                   'noAutomaticRestoreOrScriptRetry': True, 'restartedUnchanged': False}
        # A refused plan must not leave an unchanged, previously healthy app down.
        # Once an apply was called, even a reported rollback needs a person.
        if result['scriptApplyCalls'] == 0:
            context = locals()
            required = ['before', 'db_mount', 'backup', 'original_files', 'config', 'host', 'mounts',
                        'initial_health', 'health_code', 'source_guard_code', 'source_guards']
            if all(name in context for name in required):
                try:
                    recovered = restart_unchanged_before_apply(docker=docker, data=data, save=save,
                        timeout=args.startup_timeout, **{name: context[name] for name in required})
                    failure.update(restartedUnchanged=True, unchangedRestart=recovered)
                except Exception as recovery_error:
                    failure['unchangedRestartRefused'] = recovery_error.code if isinstance(recovery_error, Stopped) else type(recovery_error).__name__
            else:
                failure['unchangedRestartRefused'] = 'NO_COMPLETE_STOPPED_BACKUP_CONTEXT'
        else:
            failure['unchangedRestartRefused'] = 'APPLY_ALREADY_CALLED'
        save('failure.json', failure)
        raise Stopped('WRAPPER_STOPPED', stage=stage, cause=failure['error'])

def restart_unchanged_before_apply(*, docker, data, save, timeout, before, db_mount, backup,
                                   original_files, config, host, mounts, initial_health, health_code,
                                   source_guard_code, source_guards):
    require(not docker.inspect(before['Id'])['State']['Running'], 'APPLICATION_ALREADY_RUNNING')
    require(not docker.writers(db_mount), 'WRITER_REMAINS_BEFORE_UNCHANGED_RESTART')
    require(file_set(backup) == original_files == file_set(data), 'DATABASE_FILES_DIFFER_FROM_STOPPED_BACKUP')
    current = docker.inspect(before['Id'])
    require(current['Image'] == before['Image'] and exact(current['Config'], config)
            and exact(current['HostConfig'], host) and exact(normalized_mounts(current['Mounts']), mounts), 'UNCHANGED_RESTART_CONFIGURATION_DIFFERS')
    require(shutil.disk_usage(data).free > 10000000000, 'STRICT_UNCHANGED_RESTART_10GB_GATE_FAILED')
    restart_at = now()
    save('unchanged-restart-intent.json', {'at': restart_at, 'containerId': before['Id'],
         'databaseFilesEqualStoppedBackup': True, 'scriptApplyCalls': 0})
    docker.command('start', before['Id'])
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        current = docker.inspect(before['Id'])
        require(current['State']['Running'] and not current['State'].get('OOMKilled')
                and current['RestartCount'] == before['RestartCount'], 'UNCHANGED_APP_EXITED_RESTARTED_OR_OOM')
        require(current['Image'] == before['Image'] and exact(current['Config'], config)
                and exact(current['HostConfig'], host) and exact(normalized_mounts(current['Mounts']), mounts), 'UNCHANGED_APP_CONFIGURATION_DIFFERS')
        if current['State'].get('Health', {}).get('Status') == 'healthy':
            healthy = docker.node(before['Id'], health_code)
            if healthy == initial_health:
                require(exact(docker.node(before['Id'], source_guard_code), source_guards), 'UNCHANGED_APP_SOURCE_OR_HELP_DIFFERS')
                result = {'at': now(), 'health': healthy, 'containerId': before['Id'], 'imageId': before['Image'],
                          'databaseFilesEqualStoppedBackupBeforeRestart': True, 'stoppedBackupFiles': original_files,
                          'sameContainerConfigurationAndMounts': True, 'sourceAndHelpPreserved': True,
                          'scriptApplyCalls': 0, 'noAutomaticApplyRetryOrDataRestore': True}
                save('unchanged-restart-receipt.json', result)
                return result
        time.sleep(3)
    raise Stopped('UNCHANGED_APP_HEALTH_TIMEOUT')

def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('--mode', choices=['rehearsal', 'production'], default='rehearsal')
    result.add_argument('--container', required=True)
    result.add_argument('--database-directory', required=True)
    result.add_argument('--script', required=True)
    result.add_argument('--root', required=True)
    result.add_argument('--expected-script-sha256', required=True)
    result.add_argument('--expected-plan-sha256', required=True)
    result.add_argument('--expected-changes', type=int, required=True)
    result.add_argument('--docker-context', default='')
    result.add_argument('--scope-token', default='')
    result.add_argument('--authorization')
    result.add_argument('--startup-timeout', type=int, default=1800)
    return result

if __name__ == '__main__':
    try:
        run(parser().parse_args())
    except Stopped as error:
        print(json.dumps({'ok': False, 'error': error.code, **error.details}), flush=True)
        raise SystemExit(1)
