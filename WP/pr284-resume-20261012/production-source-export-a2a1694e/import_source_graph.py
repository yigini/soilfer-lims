"""Closed raw source set for the proposed #200 build/proof, with no import I/O.

Historical helpers remain at their original paths and hashes. Exporting this
graph is not approval and cannot start a writer; the new contract must also
bind the actual merged application and a NEW formal full-source review.
"""
SOURCE_PATHS = {name: 'WP/pr284-release/' + name for name in [
    'rehearse_import.py', 'import_proof_contract.py', 'import_source_graph.py',
    'import_preservation.py', 'import_startup_checks.py', 'import_installation.py',
    'import_stage.py', 'import_sealing.py', 'known_core_disk_guard_import.py',
    'build_import.py', 'prepare_import_build.py', 'export_launch_import_proof.py']}
SOURCE_PATHS.update({name: 'WP/runtime-recovery-kobo/' + name for name in [
    'capture_kobo_fetch.py', 'kobo_copy_preservation.py', 'known_core_disk_guard_v2.py',
    'known_core_disk_guard_v3.py']})
SOURCE_PATHS['runtime_proof_policies.py'] = 'WP/runtime-recovery-kobo/proof_contract.py'
SOURCE_PATHS['known_core_disk_guard.py'] = 'WP/runtime-containment-ae64f169/known_core_disk_guard.py'
SOURCE_PATHS.update({name: 'WP/forward-ae64f169/' + name for name in [
    'release_support.py', 'startup_common.py', 'postflight-roles.cjs', 'postflight-auth.cjs',
    'postflight-reference.cjs', 'postflight-qc-runs.cjs', 'postflight-policy.cjs', 'readonly-smoke.cjs']})
SOURCE_PATHS.update({name: 'server/prisma/migrations/20261010000100_instrument_import_templates/' + name
    for name in ['migration.sql', 'fresh-prisma-tables.json', 'pre-prisma-draft-table.sql',
                 'upgraded-prisma-draft-table.sql', 'post205-draft-tables.json']})
SOURCE_FILES = frozenset(SOURCE_PATHS)
UNCHANGED_HELPER_HASHES = {
    'runtime_proof_policies.py': '08678fb53511e6f0d6b0cac06ff549bcb0fe72894d9e1322a74079cc65d60ccf',
    'known_core_disk_guard.py': 'f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169',
    'known_core_disk_guard_v2.py': 'f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c',
    'known_core_disk_guard_v3.py': '878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f',
    'release_support.py': '9db6932a9b1502bc2db65c816a925e7d9f54611d54d4027d418bb2574b837810',
    'startup_common.py': 'e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00',
    'kobo_copy_preservation.py': '3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23',
    'capture_kobo_fetch.py': '1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86',
    'postflight-roles.cjs': '6724d91d89343387adb18db03f396a1eac14d8c9cc0700ac722b36e82ed924da',
    'postflight-auth.cjs': '37b96bb2f26f8e2c9d4bd8443f5c3e46364408cc413b07c3f5a4428d91e45192',
    'postflight-reference.cjs': '530162ea19e87a2fb59621d5d3cf570cfe4092bcb4160f0ca40df9debe3e5526',
    'postflight-qc-runs.cjs': '4a93ec3c536b13813ddc213791039d0acf04250a8722b28ea5af5cd50581cf8f',
    'postflight-policy.cjs': '6380f9b6513318e0b50a6c1fcda51d3b2094326e39f7651a9a923ae68dfe5e51',
    'readonly-smoke.cjs': '7fcfb2565d55f2d54aa39a2f8ebd636dcf64dbe04b2713de40f4346a3c93c626'}


def require_source_set(files):
    import re
    if set(files) != SOURCE_FILES or any(not isinstance(value, str) or
            re.fullmatch('[a-f0-9]{64}', value) is None for value in files.values()):
        raise RuntimeError('Complete fixed #200 source set and hashes required')
    if any(files[name] != digest for name, digest in UNCHANGED_HELPER_HASHES.items()):
        raise RuntimeError('Historical measured helper changed')


def git_source(tooling, git):
    """Read raw Git blobs only through the explicit caller, never working bytes."""
    import hashlib
    import re
    if re.fullmatch('[a-f0-9]{40}', tooling or '') is None:
        raise RuntimeError('Exact proposed source commit required')
    files, index = {}, {}
    for name, path in SOURCE_PATHS.items():
        row = git('ls-tree', tooling, '--', path).decode().strip()
        metadata, returned_path = row.split('\t')
        mode, kind, blob = metadata.split()
        if returned_path != path or kind != 'blob' or mode not in ['100644', '100755']:
            raise RuntimeError('Unexpected closed source Git object')
        data = git('cat-file', 'blob', blob)
        if hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest() != blob:
            raise RuntimeError('Source Git blob identity differs')
        files[name] = data
        index[name] = {'path': path, 'blob': blob, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    require_source_set({name: row['sha256'] for name, row in index.items()})
    return files, {'head': tooling, 'files': index}


def require_executed_sources(files, entry_path):
    """Bind the running preparer and imported authority to the reviewed blobs.

    Preparers run from a retained flat raw-Git source export. A modified local
    contract or graph must not approve a different source package for export.
    This reads only tooling files, never a database or production directory.
    """
    import hashlib
    import pathlib
    import sys
    require_source_set(files)
    paths = [pathlib.Path(entry_path)]
    for name in ['import_source_graph', 'import_proof_contract', 'runtime_proof_policies']:
        module = sys.modules.get(name)
        if module is None or not getattr(module, '__file__', None):
            raise RuntimeError('Executed authority source is unavailable')
        paths.append(pathlib.Path(module.__file__))
    for path in paths:
        if path.name not in files or path.is_symlink() or not path.is_file() or \
                hashlib.sha256(path.read_bytes()).hexdigest() != files[path.name]:
            raise RuntimeError('Executed authority differs from the exact reviewed raw source')
