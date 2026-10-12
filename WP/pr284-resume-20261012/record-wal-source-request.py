"""Retain exact source and validation evidence and draft its review request."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys

SOURCE = 'f5e59428c1bbf19247db2555f5158bc3a2ac5fad'
DIRECTORY = pathlib.Path(__file__).resolve().parent


def write(name, value):
    with (DIRECTORY / name).open('xb') as stream:
        stream.write((json.dumps(value, indent=2) + '\n').encode())


def main():
    graph = {}
    raw = subprocess.check_output(['git', 'show', SOURCE + ':WP/pr284-release/import_source_graph.py'])
    exec(compile(raw, '/owned-review-graph.py', 'exec'), graph)
    files, index = graph['git_source'](SOURCE, lambda *args: subprocess.check_output(['git', *args]))
    export = DIRECTORY / 'proof-source-export-f5e59428'; assert not export.exists(); export.mkdir()
    for name, raw in files.items():
        with (export / name).open('xb') as stream: stream.write(raw)
        if name.endswith('.py'): compile(raw, str(export / name), 'exec')
    with (export / 'source-index.json').open('xb') as stream:
        stream.write((json.dumps(index, indent=2) + '\n').encode())
    sys.path.insert(0, str(export))
    import import_proof_contract as contract
    guards = {}
    for platform in ['windows', 'linux']:
        stdout = DIRECTORY / ('import-wal-f5e5.' + platform + '.stdout.log')
        stderr = DIRECTORY / ('import-wal-f5e5.' + platform + '.stderr.log')
        data = stdout.read_bytes()
        text = data.decode('utf-16' if data.startswith(b'\xff\xfe') else 'utf-8-sig')
        value = json.loads(text.splitlines()[-1])
        assert value['sourceCommit'] == SOURCE and value['tests'] == 164
        assert value['failures'] == value['errors'] == value['skips'] == 0 and value['productionDatabaseAccess'] is False
        assert {name: item['sha256'] for name, item in value['toolingIndex']['files'].items()} == {
            name: item['sha256'] for name, item in index['files'].items()}
        guards[platform] = {key: value[key] for key in ['tests', 'failures', 'errors', 'skips', 'elapsedSeconds']}
        guards[platform]['completedUtc'] = datetime.datetime.fromisoformat(value['completedUtc']).astimezone(datetime.timezone.utc).isoformat()
        guards[platform]['stdoutSha256'] = hashlib.sha256(data).hexdigest()
        guards[platform]['stderrSha256'] = hashlib.sha256(stderr.read_bytes()).hexdigest()
    mount_raw = (DIRECTORY / 'import-mount-ad49-103100.json').read_bytes()
    witness = json.loads(mount_raw); assert witness['returnCode'] == 0
    mount = json.loads(witness['stdout'])
    assert mount['status'] == 'REAL_OWNED_WAL_MOUNT_GUARD_PASS' and mount['installerAttempts'] == 0
    assert mount['importInstallationSha256'] == index['files']['import_installation.py']['sha256']
    mount_test = subprocess.check_output(['git', 'show', SOURCE + ':WP/pr284-release/run_import_mount_guard.py'])
    assert mount_test == subprocess.check_output(['git', 'show', mount['sourceCommit'] + ':WP/pr284-release/run_import_mount_guard.py'])
    write('proof-source-index-f5e59428.json', index)
    write('import-wal-source-f5e59428.json', {'sourceCommit': SOURCE, 'guards': guards,
        'realMountGuard': mount, 'mountGuardRawSha256': hashlib.sha256(mount_raw).hexdigest(),
        'realMountGuardCodeSha256': hashlib.sha256(mount_test).hexdigest(),
        'sameMountGuardAndInstallerBytesAtReviewedSource': True,
        'proofSourceFileCount': len(files), 'productionDatabaseAccess': False,
        'installerAttempts': 0, 'noCandidateBuildOrProof': True})
    tokens = contract.release_binding_tokens() + [SOURCE, 'labAndHubBuildsOwnedByYY=true',
        'RELEASE_DAY_DISK_ABORTS_ACCEPTED', 'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
        'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10',
        'proofBaselineLayoutPolicy=EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT',
        'refusalScopeCommentId=6113601584', 'EXACT_FRESH_COPY_CONFIG_REFUSALS',
        'SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS', 'refusalPairingScopeCommentId=6114143349',
        'schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE', 'REFUSAL_PAIR_WINDOW_SECONDS=1']
    tokens += [name + '=' + item['sha256'] for name, item in sorted(index['files'].items())]
    body = '''Claudio: NEW #200 proof/build source review request after changes-required6122256443. This is a request, not an approval or execution gate.

Exact revised source f5e59428c1bbf19247db2555f5158bc3a2ac5fad is pushed. PR284's application PASS6121933894 and actual merge5dd5488d138514351fffd54d0b0232ae19fcb64d/tree9b3b77496c3aa2cdad7c7594a0b258ec4b491753 remain unchanged. Main CI38233444989 must actually pass before the isolated proof; a build requires this NEW source pass first. No #200 build/proof/kit/gate/installer or production mutation has occurred.

Blocking fix: option(a), dry-run uses its own separate owned 0400 main copy of the stopped immutable backup. Only that directory is writable for SQLite sidecars. The apply target and original backup remain unmounted during dry-run, and their full physical triple/main hash are checked unchanged. The copied main is checked against the backup SHA and full immutable snapshot before/after; any WAL frames, unexpected SHM size, new file/link or main mutation refuse. The separate copy and its sidecars/authority are retained and hashed/0400 after the dry-run. The forward-only single-use intent still precedes every native installer call. No preprocessing connection touches the target or original backup.

Actual real mount guard passed10:30:32.218669UTC using the retained predecessor d4eb image/SQLite3.51.2 on a tiny owned WAL-header fixture (bytes18/19=2), with no production DB mount and no installer attempt. The old readonly bind mount reproducibly fails; the new separate-copy mount succeeds in0.701s, integrity ok/row intact, main SHA and separate apply-target physical triple unchanged. Both containers are stopped/retained,768MiB with equal total memory+swap ceiling, no network/blank heap. Raw witness WP/pr284-resume-20261012/import-mount-ad49-103100.json. It ran at ad49b19081fe697f8a10d2506cc6befa822a73c0; the exact run_import_mount_guard.py and import_installation.py bytes are independently identical at the new f5e source. This is a mount guard, not a rehearsal. The earlier fixture module-resolution failure/root/container are retained and do not contribute to the passing witness.

All five smaller points addressed: (1) proof install_once refuses the live parent and any target outside its isolated root; only explicit production=True on an instrument-import-release root can select the canonical production volume. (2) Jobs-ON now asserts the actual jobs-enabled runtime plus a nonempty explicit CopyObservation boundary/data versions. It makes no zero-full-state claim while natural jobs run; full106table/39receipt/original-row preservation remains required at sealed first/second completion. Production's explicit normal-jobs boundary follows the zero-write seal and ingress reopen. (3) Every CLI sets and independently inspects network none, memory805306368 and memory+swap805306368, blank heap, exact mount source/type/RW, zero restart/OOM/stopped identity. (4) Each native CLI has an explicit600s timeout and measured elapsed time that must remain below it; the 5400s production unit allows the three bounded CLIs plus two600s readiness limits,660s health and sealing. Actual full-size CLI margin is required in the new measured proof before kit review; no full-size timing claimed yet. (5) Removed the unused physical reassignment. Jobs-OFF keeps ZeroWriteWatch and full detached WAL-aware equality.

The extra dry copy is included in THIRTEEN retained DB allocations, with10556150894B/scaled absolute reserve plus assets/state/log headroom and the unchanged500MB unexplained-growth abort. V2/V3/old guard and all14 historical helpers remain byte-identical. Original cursor/config/15-minute natural interval/two actual completions/interval+2min/660healthy seconds/strict protected rows and exact refused configs remain unchanged. No fabrication/backfill/cleanup/prune/replay/restore/old-image/retry/heap override. Both workload pins remain mandatory. New build/proof launchers also refuse a later Source review: CHANGES REQUIRED.

Final exact-source guards164/164 Windows and164/164 Linux,0failures/errors/skips/no production DB access; raw failed/intermediate/final logs retained. The raw graph still has31 proof source/assets files and39 production source files; packaging adds the dry-copy authority (60 fixed frozen files). Production proof binding remains UNREVIEWED_REFUSE/0, so it cannot freeze. No completed PR293 artifact/gate or human checkout/card/draft changed. Fresh10:14:52 read-only live check passed51f/d4eb,healthy0restarts/same volumes/HTTPS200/receipt and41 historical kit files unchanged/free90,747,678,720B.

Please review these exact revised bytes and post a NEW primary Source review: PASS with every full token below if they pass. Old70fd and its changes-required record cannot authorize any run. I will continue the same writer immediately through the one build/proof, separate production-source review, stopped original PASS kit/exact review/fresh gate/forward deployment. Other application merges stay held until#200 live/postchecked.

'''
    body += 'Final guard evidence: ' + json.dumps(guards, sort_keys=True) + '\n\n' + '\n'.join(tokens) + '\n'
    with (DIRECTORY / 'source-review-f5e59428-request.md').open('x', encoding='utf-8', newline='') as stream: stream.write(body)
    print(json.dumps({'source': SOURCE, 'sourceFiles': len(files), 'guards': guards,
        'request': str(DIRECTORY / 'source-review-f5e59428-request.md'),
        'coordinatorSha256': index['files']['rehearse_import.py']['sha256'],
        'contractSha256': index['files']['import_proof_contract.py']['sha256'],
        'installerSha256': index['files']['import_installation.py']['sha256']}))


if __name__ == '__main__': main()
