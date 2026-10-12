"""Export exact proposed packaging bytes and compose its separate review request."""
import datetime
import hashlib
import importlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = 'd994991753618c1f88858f7cba6d4e9a0ea890f7'


def save(name, value):
    with (ROOT / name).open('xb') as output:
        output.write((json.dumps(value, indent=2) + '\n').encode())


def read_guard(platform):
    path = ROOT / ('production-source-d994.' + platform + '.stdout.log')
    data = path.read_bytes()
    encoding = 'utf-16' if data.startswith(b'\xff\xfe') else 'utf-8-sig'
    value = json.loads(data.decode(encoding))
    assert value['sourceCommit'] == SOURCE and value['tests'] == 164
    assert value['failures'] == value['errors'] == value['skips'] == 0
    assert value['productionDatabaseAccess'] is False
    return {key: value[key] for key in ['tests', 'failures', 'errors', 'skips', 'completedUtc', 'elapsedSeconds']} | {
        stream + 'Sha256': hashlib.sha256((ROOT / ('production-source-d994.' + platform + '.' + stream + '.log')).read_bytes()).hexdigest()
        for stream in ['stdout', 'stderr']}


def main():
    sys.path.insert(0, str(ROOT / 'proof-source-export-f5e59428'))
    from import_source_graph import git_source, SOURCE_FILES
    raw, index = git_source(SOURCE, lambda *args: subprocess.check_output(['git', *args]))
    approved = json.loads((ROOT / 'source-pass-6122670828.json').read_bytes())
    proof_hashes = {name: row['sha256'] for name, row in approved['sourceIndex']['files'].items()}
    assert {name: row['sha256'] for name, row in index['files'].items()} == proof_hashes
    paths = {name: 'WP/pr284-release/' + name for name in ['import_release_contract.py',
        'deploy_import.py', 'freeze_import.py', 'known_core_disk_guard_import_deploy.py',
        'collect_import_gate.py', 'export_freeze_import_kit.py', 'launch_import_release.py']}
    paths['yy-authorization-evidence.md'] = 'WP/forward-ae64f169/yy-authorization-evidence.md'
    for name, path in paths.items():
        metadata, returned = subprocess.check_output(['git', 'ls-tree', SOURCE, '--', path]).decode().strip().split('\t')
        mode, kind, blob = metadata.split()
        assert returned == path and mode in ['100644', '100755'] and kind == 'blob'
        data = subprocess.check_output(['git', 'cat-file', 'blob', blob])
        assert hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() == blob
        raw[name] = data
        index['files'][name] = {'path': path, 'blob': blob, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    export = ROOT / 'production-source-export-d9949917'
    export.mkdir()
    for name, data in raw.items():
        with (export / name).open('xb') as output:
            output.write(data)
        if name.endswith('.py'):
            compile(data, '/compile-only-proposed-package/' + name, 'exec')
    sys.path.insert(0, str(export))
    release = importlib.import_module('import_release_contract')
    assert release.REVIEWED_PROOF_SOURCE == 'f5e59428c1bbf19247db2555f5158bc3a2ac5fad'
    assert release.PROOF_SOURCE_REVIEW_ID == 6122670828
    assert release.REVIEWED_PROOF_FILES == proof_hashes
    assert set(raw) == release.PACKAGE_SOURCE_FILES and len(raw) == 39
    assert len(release.FROZEN_FILE_SET) == 60
    guards = {platform: read_guard(platform) for platform in ['windows', 'linux']}
    hashes = {name: row['sha256'] for name, row in index['files'].items()}
    tokens = release.release_binding_tokens() + release.source_policy_tokens() + [SOURCE,
        release.REVIEWED_PROOF_SOURCE, 'proofSourceReviewId=' + str(release.PROOF_SOURCE_REVIEW_ID)]
    tokens += [name + '=' + digest for name, digest in sorted(hashes.items())]
    text = f'''Claudio: NEW separate #200 production-source review request. This is proposed source, not a kit audit or execution gate.

Exact packaging source {SOURCE} is pushed. It binds actual proof/build source {release.REVIEWED_PROOF_SOURCE}, actual primary PASS6122670828, all31 approved source/asset bytes unchanged, actual merged application5dd5488d138514351fffd54d0b0232ae19fcb64d/tree9b3b77496c3aa2cdad7c7594a0b258ec4b491753 and applicationPASS6121933894. MainCI38233444989 is fully SUCCESS360/5473/client/both real Docker/boundary/readiness.

The single approved build is running at /opt/lims/releases/instrument-import-build-5dd5488d-20261012T104515Z, unit lims-build-instrument-import-build-5dd5488d-20261012t104515z.service. No isolated proof/kit/gate/native installer/default startup/production mutation yet. No build completion or proof PASS is claimed. This source review may happen while the build/proof proceeds, but freezing and deployment still require the actual original stopped proof PASS, full retained evidence and NEW exact-kit review.

Production family has39 raw source files and60 fixed frozen files. The only change from f5e production bytes is the actual proof source/review/all31hash binding plus a comment correcting thirteen allocations. It retains separate owned0400 dry copy authority, native3 bounded CLI dry/apply/immediate repeat, exact104table38receipt->106table39receipt empty additive delta/all original rows/schema, CLI networknone/memory=swap805306368/blankheap/600s measured bound. Final measured proof must show full-size CLI margin; no margin is claimed from the tiny mount guard. The original real-WAL mount witness and all failed/intermediate/final logs are now committed in3fa36fbc.

The frozen manifest must bind the original stopped PASSED proof/root/build archive/rawGit index/image, first+second natural scheduler completions/full preservation, separate dry-copy authority, jobsOFF/default23NO_OP0/22READY0/31+6zero and explicit jobsON boundary. No later documentation HEAD or rejected proof contributes. The original41-file completedPR293 kit/receipt stays retained; it supplies only predecessor ingress/history, never a reused execution gate.

Before fresh gate and quiesce: unusedkit/noattempt/noproductionreceipt/currentmain/all actual green/exactNEWprimary kit phrase/healthy same51f/d4eb predecessor/env/volumes/0restart, original proof/build/YY/source hashes and fresh13DBallocations/assets/state/log headroom above10556150894/scaledreserve. The unchanged500MB unexplained-growth abort and original old/V2/V3 helpers remain bound. One exclusive fresh10minute gate is never early/recollected/overwritten/reused. Original YY auto-after-review evidence remains verbatim with historicalscopeHead; new releaseHead is separately bound. Both workload pins required.

ONE forward coordinator: #189 held ingress/writers stopped/full WAL-aware stopped400backup+raw triples/assets seal; ONE new native200 dry/apply/repeat, no historical explicit installer replay; default jobsOFF23NO_OP0/22READY0/31+6zero/full seal/readiness600. Reopen ingress BEFORE normal jobs, retain stopped containers, then same-image jobsON readiness/660 healthy seconds/0restart/peak<=805306368/blankheap. After ANY native/default-entrypoint attempt includingNO_OP/failure: hold maintenance/jobs and separately audited forwardfix only. No restore, old image, retry/override/heapraise/delete/move/prune/cleanup or source/schema/row weakening.

Final exact proposed source guards: {json.dumps(guards, sort_keys=True)}. No productionDB access. Separate source approval is still pending; no kit can freeze without the actual stopped PASSED proof and your NEW production Source review: PASS. Please post that primary phrase with all full tokens below if these exact bytes pass. Other app merges remain held until#200live/postchecked. I continue the same writer/worktree; human cards/drafts/checkout untouched.

''' + '\n'.join(tokens) + '\n'
    with (ROOT / 'production-source-d994-request.md').open('x', encoding='utf-8', newline='\n') as output:
        output.write(text)
    save('production-source-index-d9949917.json', index)
    save('production-source-d994-evidence.json', {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'sourceCommit': SOURCE, 'proofSourceCommit': release.REVIEWED_PROOF_SOURCE,
        'proofSourceReviewId': 6122670828, 'sourceFiles': 39, 'fixedFrozenFiles': 60,
        'guards': guards, 'sourceHashes': hashes, 'approvalClaimed': False, 'productionMutations': 0})
    print(json.dumps({'status': 'PRODUCTION_SOURCE_REQUEST_PREPARED_ONLY', 'source': SOURCE,
        'sourceFiles': len(raw), 'frozenFiles': len(release.FROZEN_FILE_SET), 'guards': guards,
        'coordinatorSha256': hashes['deploy_import.py'], 'contractSha256': hashes['import_release_contract.py']}))


if __name__ == '__main__':
    main()
