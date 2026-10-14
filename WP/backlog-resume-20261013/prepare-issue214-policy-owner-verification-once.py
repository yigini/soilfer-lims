"""Prepare unique focused/full successors; preserve held owned databases locally."""
from pathlib import Path
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
original = (wp / 'verify-issue214-scanner-call-form-full-once.py').read_text(encoding='utf-8')
retention = wp / 'issue214-policy-owner-local-retention-teardown.cjs'
assert not retention.exists()
retention.write_text("// Local verification only: keep all held DB/WAL/SHM files; stock CI uses its unchanged teardown.\nmodule.exports = async () => {};\n", encoding='utf-8')
added = ['server/services/labPolicyMigrationSource.js','server/scripts/install_lab_policy_schema.js',
         'server/tests/contracts/issue_214_lab_policy_schema.test.js',
         'server/prisma/migrations/20261004085500_add_lab_policy_settings/migration.sql',
         'server/scripts/rehearsal_deployment_readiness.cjs',
         'WP/backlog-resume-20261013/issue214-policy-owner-local-retention-teardown.cjs']
focused = ['issue_214_lab_policy_schema.test.js','issue_214_control_chart_integration.test.js',
           'issue_214_control_chart_rules.test.js','issue_214_control_chart_ui.test.js',
           'deployment_readiness_bootstrap.test.js','audit_1_0_policy_components.test.js',
           'audit_1_2_state_writes.test.js','sql_write_scanner.test.js']
for mode in ['focused','full']:
    target = wp / ('verify-issue214-policy-owner-' + mode + '-once.py')
    assert not target.exists()
    text = original.replace("issue214-scanner-call-form-full'", "issue214-policy-owner-" + mode + "'")
    text = text.replace("assert len(inventory) == len(set(inventory)) == 365 and set(inventory) == set(previous)",
        "assert len(inventory) == len(set(inventory)) == 366 and set(inventory) == set(previous) | {str(server / 'tests/contracts/issue_214_lab_policy_schema.test.js')}")
    text = text.replace("paths = sorted(set(paths))", "paths += " + repr(added) + "\npaths = sorted(set(paths))")
    text = text.replace("args = ['--testMatch'", "args = ['--globalTeardown', str(wp / 'issue214-policy-owner-local-retention-teardown.cjs'), '--testMatch'")
    text = text.replace("'productionOperations': 0}", "'productionOperations': 0, 'localRetentionTeardownOnly': True}")
    if mode == 'focused':
        text = text.replace("command = ['cmd.exe'", "args += ['--runTestsByPath', *[str(server / 'tests' / ('security' if name in ['audit_1_2_state_writes.test.js','sql_write_scanner.test.js'] else 'contracts') / name) for name in " + repr(focused) + "]]\ncommand = ['cmd.exe'")
        text = text.replace("set(inventory) == {suite['name'] for suite in report.get('testResults', [])} and report.get('numTotalTestSuites') == len(inventory)",
            "report.get('numTotalTestSuites') == " + str(len(focused)))
    target.write_text(text, encoding='utf-8')
print('Prepared unique focused/full runners. Local cleanup is held; stock CI teardown is unchanged.')
