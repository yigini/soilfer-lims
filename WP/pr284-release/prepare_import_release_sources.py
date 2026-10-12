"""Development-only new source generation; never run a remote action.

Reads the retained historical Git blobs and writes only new proposed files.
Existing files refuse overwrite. Generated source still needs guard tests,
actual target/source bindings and independent formal reviews before execution.
"""
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
HISTORICAL = 'f5cb18176a9d6efa3560182534f57280af71f66a'


def original(name):
    return subprocess.check_output(['git', 'show', HISTORICAL + ':WP/runtime-recovery-kobo/' + name]).decode()


def write(name, data):
    with (ROOT / name).open('x', encoding='utf-8', newline='\n') as stream: stream.write(data)


def between(data, first, second, replacement):
    begin, end = data.index(first), data.index(second)
    return data[:begin] + replacement + '\n\n' + data[end:]


def common(data):
    substitutions = {
        'runtime_release_contract': 'import_release_contract',
        'known_core_disk_guard_deploy': 'known_core_disk_guard_import_deploy',
        'deploy_runtime': 'deploy_import', 'freeze_runtime': 'freeze_import',
        'collect_runtime_gate': 'collect_import_gate', 'launch_runtime_release': 'launch_import_release',
        'export_freeze_runtime_kit': 'export_freeze_import_kit',
        'runtime-kobo-proof-': 'instrument-import-proof-', 'runtime-kobo-release-': 'instrument-import-release-',
        'runtime-kobo-build-': 'instrument-import-build-', 'runtime-kobo-package-': 'instrument-import-package-',
        'FRESH_SINGLE_USE_RUNTIME_GATE': 'FRESH_SINGLE_USE_IMPORT_GATE',
        'pulls/293': 'pulls/284', 'issues/293/comments': 'issues/284/comments',
        "manifest['walRecovery']": "manifest['entryBinding']",
        "'walRecovery':": "'entryBinding':", 'wal_recovery_binding()': 'entry_binding()',
        'failed_wal_authority': 'predecessor_ingress_authority',
    }
    for old, new in substitutions.items(): data = data.replace(old, new)
    return data


def main():
    # Pure scheduler evidence checks keep their already reviewed strict policy.
    old_contract = original('runtime_release_contract.py')
    natural = old_contract[old_contract.index('def original_cursor_intake('):old_contract.index('def measurement_manifest(')]
    with (ROOT / 'import_release_contract.py').open('a', encoding='utf-8', newline='\n') as stream:
        stream.write('\n\n' + natural)

    data = common(original('deploy_runtime.py'))
    data = data.replace('from import_release_contract import *', 'from import_release_contract import *\n'
        'from import_sealing import sealed_stopped_state\nfrom import_stage import install_once\n'
        'from import_startup_checks import startup_checks as import_startup_checks')
    data = between(data, 'def copy_triple(', 'def predecessor_ingress_authority(', '')
    authority = '''def predecessor_ingress_authority():
    # Only a completed successful predecessor supplies hash-bound ingress bytes.
    # No failed proof/kit/database/triple is an execution input.
    predecessor = pathlib.Path(HISTORICAL_ROOT_PATH)
    receipt = predecessor / 'production-receipt.json'
    require(not receipt.is_symlink() and receipt.stat().st_mode & 0o777 == 0o400 and
        sha(receipt) == HISTORICAL_RECEIPT_SHA, 'Completed predecessor receipt changed')
    value = json.loads(receipt.read_bytes())
    require(value['status'] == 'DEPLOYED_NEW_RUNTIME_FORWARD' and value['head'] == BASE_HEAD and
        value['image'] == LIVE_IMAGE, 'Successful healthy predecessor history differs')
    result = {}
    for name, digest in [('apache-before.conf', ORIGINAL_INGRESS_SHA), ('apache-held.conf', HELD_INGRESS_SHA)]:
        path = predecessor / name
        require(not path.is_symlink() and path.stat().st_mode & 0o777 == 0o400 and sha(path) == digest,
            'Completed predecessor ingress changed')
        result[name] = path.read_bytes()
    return result
'''
    data = between(data, 'def predecessor_ingress_authority(', 'def select_entry_state(', authority)
    data = data.replace("require(pathlib.PurePosixPath(name).name == name and not (proof / name).is_symlink() and\n            sha(proof / name) == digest,", "require(sha(safe_reference(proof, name)) == digest,")
    data = data.replace('required = reserve + 6 * database_bytes + assets + 536870912',
        'required = reserve + 12 * database_bytes + assets + 536870912')
    data = data.replace('--execute-new-reviewed-runtime-gate', '--execute-new-reviewed-import-gate')
    data = data.replace("'RUNTIME_FORWARD_IN_PROGRESS'", "'IMPORT_FORWARD_IN_PROGRESS'")
    data = data.replace("'separateInstallerCommands': 0, 'anyEntrypointAttempted': False,",
        "'separateInstallerCommands': 3, 'anyInstallerAttempted': False, 'anyEntrypointAttempted': False,\n"
        "        'importDeltaPolicy': NATIVE_DELTA_POLICY, 'retainedDatabaseAllocationCount': 12,")
    data = data.replace("'productionBaselineScopeCommentId': PRODUCTION_BASELINE_SCOPE_ID,", '')
    data = data.replace("expected, stopped = sealed_stopped_state(ROOT, 'original-stopped-seal', s.LIVE, guard)",
        "expected, stopped = sealed_stopped_state(ROOT, 'original-stopped-seal', s.LIVE, guard, installed=False)")
    marker = "        retained = 'soilfer-lims-before-' + ROOT.name"
    stage = '''        # The intent marker precedes even the dry-run. All later failure
        # paths remain held with jobs stopped, including NO_OP or dry failure.
        receipt['anyInstallerAttempted'] = True
        save('nativeImportInstallerAttemptedForwardOnly')
        def seal_import(label, installed=False):
            all_writers_stopped()
            _, evidence = sealed_stopped_state(ROOT, label, s.LIVE, guard, installed=installed)
            return evidence
        receipt['nativeImportInstallation'], expected = install_once(ROOT, pin['image'], s.LIVE.parent,
            pathlib.Path(stopped['backupPath']), s.physical(s.LIVE), ROOT, guard, s, seal_import)
        c.write_new(ROOT / 'installed-protected-state.json', expected)
        receipt['installedProtectedStateSha256'] = sha(ROOT / 'installed-protected-state.json')
        receipt['protectedTableCount'] = 106; receipt['protectedReceiptCount'] = 39
        receipt['originalProtectedTableCount'] = 104; receipt['originalProtectedReceiptCount'] = 38
        all_writers_stopped(); guard.check(); save('nativeImportDeltaAndImmediateRepeatPassed')
'''
    assert data.count(marker) == 1
    data = data.replace(marker, stage + marker)
    data = data.replace("c.startup_checks(ROOT, 'soilfer-lims', s.LIVE, expected, 'production-jobs-off')",
        "import_startup_checks(ROOT, 'soilfer-lims', s.LIVE, expected, 'production-jobs-off', c, s)")
    data = data.replace("guard, expected)\n        receipt['jobsOffStoppedLogicalSeal']",
        "guard, installed=True, expected=expected)\n        receipt['jobsOffStoppedLogicalSeal']")
    data = data.replace("c.startup_checks(ROOT, 'soilfer-lims', s.LIVE, expected,\n            'production-jobs-on', jobs_guard=watch)",
        "import_startup_checks(ROOT, 'soilfer-lims', s.LIVE, expected,\n            'production-jobs-on', c, s, jobs_guard=watch)")
    data = data.replace("'DEPLOYED_NEW_RUNTIME_FORWARD'", "'DEPLOYED_NEW_IMPORT_FORWARD'")
    # Restore the predecessor status validator; its original successful receipt
    # remains the historical runtime receipt, not a claimed import deployment.
    data = data.replace("value['status'] == 'DEPLOYED_NEW_IMPORT_FORWARD'", "value['status'] == 'DEPLOYED_NEW_RUNTIME_FORWARD'")
    data = data.replace("'FAILED_RUNTIME_FORWARD_HOLD'", "'FAILED_IMPORT_FORWARD_HOLD'")
    data = data.replace('No historical execution, explicit installer, restore, old-image recovery,',
        'Only ONE new native import installer dry/apply/repeat; no historical installer, restore, old-image recovery,')
    write('deploy_import.py', data)

    data = common(original('known_core_disk_guard_deploy.py'))
    data = data.replace('if root.parent !=', "if root.parent !=")
    write('known_core_disk_guard_import_deploy.py', data)
    # The collector and launcher run only against the future immutable kit.
    data = common(original('collect_runtime_gate.py'))
    data = data.replace("'productionBaselineScopeCommentId': PRODUCTION_BASELINE_SCOPE_ID,", '')
    data = data.replace("'head': current,\n        'currentMainHead': current,", "'head': current,\n        'frozenFiles': manifest['files'], 'currentMainHead': current,")
    write('collect_import_gate.py', data)
    data = common(original('launch_runtime_release.py')).replace('--execute-new-reviewed-runtime-gate',
        '--execute-new-reviewed-import-gate')
    write('launch_import_release.py', data)


if __name__ == '__main__': main()
