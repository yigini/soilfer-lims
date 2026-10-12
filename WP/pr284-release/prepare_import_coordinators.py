"""Prepare NEW proposed source from exact reviewed historical bytes, never execute.

This writes only new PR284 tooling files. Original proofs/kits and historical
helper files remain byte-identical. Unbound application constants deliberately
refuse every build/proof launcher until actual merge and NEW source approval.
"""
import hashlib
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
historical = 'f5cb18176a9d6efa3560182534f57280af71f66a'
output = root / 'WP/pr284-release'
def raw(name):
    return subprocess.check_output(['git', 'show', historical + ':WP/runtime-recovery-kobo/' + name]).decode()
def replace(text, old, new, count=1):
    if text.count(old) != count:
        raise RuntimeError('Historical source anchor changed: ' + old[:100])
    return text.replace(old, new)
def write(name, text):
    path = output / name
    if path.exists():
        raise RuntimeError('Never overwrite a prepared coordinator: ' + name)
    compile(text, str(path), 'exec')
    path.write_text(text, encoding='utf-8', newline='\n')
    print(name, hashlib.sha256(path.read_bytes()).hexdigest())

guard = raw('known_core_disk_guard_proof.py')
guard = replace(guard, 'from known_core_disk_guard_v3 import confirm_baseline, EMPTY_FILES',
    'from known_core_disk_guard_v3 import confirm_baseline\nfrom import_source_graph import SOURCE_FILES, require_source_set')
guard = replace(guard, "POLICY = 'EXACT_HASHED_PROOF_AUTHORITY_LAYOUT'", "POLICY = 'EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT'")
start = guard.index('SOURCE_FILES = (EMPTY_FILES')
end = guard.index('\n\n\ndef require_proof_root', start)
guard = guard[:start] + guard[end:]
guard = replace(guard, "root.name.startswith('runtime-kobo-proof-')", "root.name.startswith('instrument-import-proof-')")
guard = replace(guard, "    required = {name: row['sha256'] for name, row in source['files'].items()}",
    "    require_source_set({name: row['sha256'] for name, row in source['files'].items()})\n    required = {name: row['sha256'] for name, row in source['files'].items()}")
write('known_core_disk_guard_import.py', guard)

proof = raw('rehearse_runtime.py')
proof = replace(proof, 'from known_core_disk_guard_proof import KnownCoreDiskGuard, POLICY as PROOF_LAYOUT_POLICY',
    'from known_core_disk_guard_import import KnownCoreDiskGuard, POLICY as PROOF_LAYOUT_POLICY')
proof = replace(proof, 'from proof_contract import *', 'from import_proof_contract import *\nfrom import_source_graph import UNCHANGED_HELPER_HASHES, require_source_set\nfrom import_stage import install_once\nfrom import_startup_checks import startup_checks as import_startup_checks\nfrom import_sealing import sealed_stopped_state')
start = proof.index('HELPER_HASHES = {')
end = proof.index('\n\n\ndef write_new', start)
proof = proof[:start] + 'HELPER_HASHES = UNCHANGED_HELPER_HASHES' + proof[end:]
proof = replace(proof, "sys.argv[1:] == ['--new-owned-runtime-proof']", "sys.argv[1:] == ['--new-owned-import-proof']")
proof = replace(proof, "ROOT.name.startswith('runtime-kobo-proof-')", "ROOT.name.startswith('instrument-import-proof-')")
proof = replace(proof, "    for name, item in source['files'].items():", "    require_source_set({name: item['sha256'] for name, item in source['files'].items()})\n    for name, item in source['files'].items():")
start = proof.index('    source_review_pass(source_review,')
end = proof.index('    built_root =', start)
proof = proof[:start] + "    source_review_pass(source_review, source['head'], {name: item['sha256'] for name, item in source['files'].items()})\n" + proof[end:]
proof = replace(proof, "built_root.name.startswith('runtime-kobo-build-')", "built_root.name.startswith('instrument-import-build-')")
proof = replace(proof, "    require(live['Image'] == LIVE_IMAGE,", "    require(live['State']['Running'] and live['State']['Health']['Status'] == 'healthy' and\n        not live['State']['OOMKilled'] and live['RestartCount'] == 0 and live['Image'] == LIVE_IMAGE,")
proof = replace(proof, "env.get('ALLOW_AUTO_SEED') == 'false',", "env.get('ALLOW_AUTO_SEED') == 'false' and env.get('DISABLE_BACKGROUND_JOBS') == 'false',")
proof = replace(proof, 'reserve + 4 * s.LIVE.stat().st_size', 'reserve + 12 * s.LIVE.stat().st_size')
proof = replace(proof, "'status': 'NEW_RUNTIME_PROOF_IN_PROGRESS'", "'status': 'NEW_IMPORT_PROOF_IN_PROGRESS'")
proof = replace(proof, "'separateInstallerCommands': 0", "'separateInstallerCommands': 3, 'importDeltaPolicy': NATIVE_DELTA_POLICY, 'retainedDatabaseAllocationCount': 12")
proof = replace(proof, "HELPER_HASHES['known_core_disk_guard_proof.py']", "s.sha(ROOT / 'known_core_disk_guard_import.py')")
proof = replace(proof, "s.sha(ROOT / 'proof_contract.py')", "s.sha(ROOT / 'import_proof_contract.py')")
proof = replace(proof, "        original_physical = s.physical(database)\n        configs =", """        original_physical = s.physical(database)
        def seal_owned(label, installed=False):
            require_owned_writers_stopped(database_dir)
            state, evidence = sealed_stopped_state(ROOT, label, database, guard, installed=installed)
            return evidence
        receipt['nativeImportInstallation'], expected = install_once(ROOT, pin['image'], database_dir,
            ROOT / 'fresh-live-backup.db', original_physical, ROOT, guard, s, seal_owned)
        installed_baseline = ROOT / 'after-import-stopped' / 'dev-stopped-backup.db'
        receipt['installedBaselineSha256'] = s.sha(installed_baseline)
        receipt['installedProtectedStateSha256'] = write_new('installed-protected-state.json', expected)
        original_physical = s.physical(database)
        configs ="""
)
proof = replace(proof, "c.startup_checks(ROOT, name, database, expected, 'candidate-jobs-off')",
    "import_startup_checks(ROOT, name, database, expected, 'candidate-jobs-off', c, s)")
proof = replace(proof, "        c.exact_state(database, expected); c.main_bytes(database, original_physical)",
    """        require_owned_writers_stopped(database_dir)
        _, jobs_off_seal = sealed_stopped_state(ROOT, 'after-jobs-off-stopped', database,
            guard, installed=True, expected=expected)
        receipt['jobsOffStoppedSeal'] = jobs_off_seal"""
)
proof = replace(proof, "c.startup_checks(ROOT, name, database, expected, 'candidate-jobs-on', jobs_guard=watch)",
    "import_startup_checks(ROOT, name, database, expected, 'candidate-jobs-on', c, s, jobs_guard=watch)")
proof = replace(proof, "verify_copy(ROOT / 'fresh-live-backup.db', ROOT / 'after-first-sync.db',\n            fetched_ids=",
    "verify_copy(installed_baseline, ROOT / 'after-first-sync.db', expected_table_count=106,\n            fetched_ids=")
proof = replace(proof, "        s.consistent_backup(database, ROOT / 'after-second-sync.db')", """        require_owned_writers_stopped(database_dir)
        _, final_seal = sealed_stopped_state(ROOT, 'after-second-stopped', database, guard, installed=True)
        final_backup = pathlib.Path(final_seal['backupPath'])
        receipt['finalStoppedSeal'] = final_seal"""
)
proof = replace(proof, "verify_copy(ROOT / 'after-first-sync.db', ROOT / 'after-second-sync.db',\n            prior_fetched_ids=",
    "verify_copy(ROOT / 'after-first-sync.db', final_backup, expected_table_count=106,\n            prior_fetched_ids=")
proof = replace(proof, "verify_copy(ROOT / 'fresh-live-backup.db', ROOT / 'after-second-sync.db',\n            fetched_ids=",
    "verify_copy(installed_baseline, final_backup, expected_table_count=106,\n            fetched_ids=")
proof = replace(proof, "receipt['protectedReceiptCount'] = 38", "receipt['protectedReceiptCount'] = 39\n        receipt['originalProtectedReceiptCount'] = 38\n        receipt['originalProtectedTableCount'] = 104")
proof = replace(proof, "s.verify_retained_acceptance(database_dir)",
    "s.verify_retained_acceptance(ROOT / 'after-second-stopped' / 'scratch')")
proof = proof.replace('PASSED_NEW_CANDIDATE_NATURAL_KOBO_PROOF', 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF').replace(
    'FAILED_NEW_CANDIDATE_NATURAL_KOBO_PROOF', 'FAILED_NEW_IMPORT_NATURAL_KOBO_PROOF')
anchor = '\n\nclass CopyObservation:'
proof = replace(proof, anchor, """

def require_owned_writers_stopped(directory):
    # Observe every mount; never stop unrelated containers or the live writer.
    directory = pathlib.Path(directory).resolve()
    ids = subprocess.check_output(['docker', 'ps', '-q'], text=True, timeout=15).split()
    if not ids: return
    for container in json.loads(subprocess.check_output(['docker', 'inspect', *ids], text=True, timeout=15)):
        for mount in container.get('Mounts', []):
            source = pathlib.Path(mount['Source']).resolve()
            require(not (mount.get('RW') and (source == directory or source in directory.parents or directory in source.parents)),
                'An owned-copy writer remains active before its detached seal')
""" + anchor)
write('rehearse_import.py', proof)

build = raw('build_candidate.py')
build = replace(build, 'import tarfile', 'import tarfile\nfrom import_proof_contract import *')
build = replace(build, "ROOT.name.startswith('runtime-kobo-build-')", "ROOT.name.startswith('instrument-import-build-')")
build = replace(build, "'51f6798806f630773786a08432290c1b21a841da'", 'CANDIDATE_HEAD')
build = replace(build, "'990a4cb535fd3ccb2a81ca019f453123b60a14b8'", 'AUDITED_PR_HEAD')
build = replace(build, "'f830f900f597f20e12570b583e4e32ce9cb50a1d'", 'BASE_HEAD')
build = replace(build, "spec['pr'] == 293", "spec['pr'] == PR_NUMBER")
build = replace(build, "'90ed6a26c72bfab5a348dfdb9d6e59876c61ee4c'", 'MERGED_TREE', count=2)
build = replace(build, "    spec = json.loads((ROOT / 'build-input.json').read_bytes())", """    bound_candidate()
    spec = json.loads((ROOT / 'build-input.json').read_bytes())
    source = json.loads((ROOT / 'tooling-source-index.json').read_bytes())
    require_source_set({name: item['sha256'] for name, item in source['files'].items()})
    for name, item in source['files'].items():
        require(pathlib.PurePosixPath(name).name == name and not (ROOT / name).is_symlink() and
            (ROOT / name).stat().st_mode & 0o777 == 0o400 and sha(ROOT / name) == item['sha256'], 'Build tooling changed')
    source_review = json.loads((ROOT / 'proof-source-review.json').read_bytes())
    require(source_review['id'] == spec['proofSourceReviewId'], 'Build source authority differs')
    source_review_pass(source_review, source['head'], {name: item['sha256'] for name, item in source['files'].items()})"""
)
write('build_import.py', build)

launch = raw('export_launch_runtime_proof.py')
launch = launch.replace('runtime-kobo-proof-', 'instrument-import-proof-').replace('rehearse_runtime.py', 'rehearse_import.py').replace(
    '--new-owned-runtime-proof', '--new-owned-import-proof').replace('export_launch_runtime_proof.py', 'export_launch_import_proof.py')
launch = replace(launch, 'from proof_contract import *', 'from import_proof_contract import *\nfrom import_source_graph import git_source')
launch = launch.replace('/pulls/293', '/pulls/284').replace('/pull/293#', '/pull/284#').replace('/issues/293/', '/issues/284/').replace('PR293', 'PR284')
launch = replace(launch, "(AUDITED_PR_HEAD in review['body'] or AUDITED_PR_HEAD[:8] in review['body'])", "AUDITED_PR_HEAD in review['body']")
start = launch.index('    paths = {name:')
end = launch.index('    source_comments =', start)
launch = launch[:start] + """    raw_files, source_index = git_source(tooling, lambda *args: subprocess.check_output(['git', *args]))
    files = {name: base64.b64encode(data).decode() for name, data in raw_files.items()}
    index = source_index['files']
    source_review = github('repos/yigini/soilfer-lims/issues/comments/' + str(pin['proofSourceReviewId']))
    source_review_pass(source_review, tooling, {name: item['sha256'] for name, item in index.items()})
""" + launch[end:]
write('export_launch_import_proof.py', launch)

prepare = raw('prepare_candidate_build.py')
prepare = prepare.replace('runtime-kobo-build-', 'instrument-import-build-').replace('build_candidate.py', 'build_import.py').replace(
    'lims-runtime-build-export-', 'lims-import-build-export-').replace('WP/runtime-recovery-kobo/', 'WP/pr284-release/')
prepare = replace(prepare, 'from proof_contract import *', 'from import_proof_contract import *\nfrom import_source_graph import git_source')
prepare = prepare.replace('/pulls/293', '/pulls/284').replace('/pull/293#', '/pull/284#').replace('/issues/293/', '/issues/284/').replace('PR293', 'PR284')
prepare = replace(prepare, "(AUDITED_PR_HEAD in review['body'] or AUDITED_PR_HEAD[:8] in review['body'])", "AUDITED_PR_HEAD in review['body']")
start = prepare.index('    raw = {name:')
end = prepare.index('    source_comments =', start)
prepare = prepare[:start] + """    tooling_files, tooling_index = git_source(tooling, lambda *args: subprocess.check_output(['git', *args]))
    source_review = github('repos/yigini/soilfer-lims/issues/comments/' + source_review_id)
    source_review_pass(source_review, tooling, {name: item['sha256'] for name, item in tooling_index['files'].items()})
""" + prepare[end:]
prepare = replace(prepare, "    (local / 'build_import.py').write_bytes(builder)", """    for name, data in tooling_files.items():
        (local / name).write_bytes(data)
    (local / 'tooling-source-index.json').write_text(json.dumps(tooling_index, indent=2), encoding='utf-8')
    (local / 'proof-source-review.json').write_text(json.dumps(source_review, indent=2), encoding='utf-8')"""
)
prepare = replace(prepare, "*map(str, [archive, local / 'source-index.json', local / 'build-input.json', local / 'build_import.py'])",
    "*map(str, [archive, local / 'source-index.json', local / 'build-input.json', local / 'tooling-source-index.json', local / 'proof-source-review.json', *[local / name for name in tooling_files]])")
prepare = replace(prepare, "(r/'build-input.json').chmod(0o400)", """(r/'build-input.json').chmod(0o400)
for name in ['tooling-source-index.json','proof-source-review.json']:
 (r/name).chmod(0o400)
idx=json.loads((r/'tooling-source-index.json').read_bytes())
for name,item in idx['files'].items():
 assert pathlib.PurePosixPath(name).name==name and hashlib.sha256((r/name).read_bytes()).hexdigest()==item['sha256']
 (r/name).chmod(0o400)"""
)
write('prepare_import_build.py', prepare)
