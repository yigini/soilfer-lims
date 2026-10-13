"""Prepare a unique focused successor; do not redispatch any consumed runner."""
from pathlib import Path
wp = Path(__file__).parent
target = wp / 'verify-issue214-fixture-correction-focused-once.py'
assert not target.exists()
source = (wp / 'verify-issue214-full-fixture-corrected-once.py').read_text(encoding='utf-8')
source = source.replace("dest = wp / 'issue214-full-fixture-corrected'", "dest = wp / 'issue214-fixture-correction-focused'")
targets = ['audit_2_3_compatibility_runs', 'audit_4_8_cross_check_evidence', 'audit_4_7_xlsx_commit',
    'audit_3_3_selection_backfill', 'audit_4_7_calculation_import', 'spectral_multipart_upload',
    'reception_route_smoke', 'spectral_stage_b', 'issue_214_control_chart_rules',
    'issue_214_control_chart_integration', 'issue_214_control_chart_ui', 'audit_2_3_native_runs']
old = "args = ['--testMatch', '**/tests/**/*.test.js', '--setupFilesAfterEnv', str(server / 'tests/ownedSuiteSetup.js'),"
replacement = ("targets = " + repr(targets) + "\n" +
    "expected = [str(server / 'tests/contracts' / (name + '.test.js')) for name in targets]\n" +
    "assert set(expected) <= set(inventory)\n" +
    "args = ['--testMatch', '**/tests/**/*.test.js', '--runTestsByPath', *expected, '--setupFilesAfterEnv', str(server / 'tests/ownedSuiteSetup.js'),")
assert source.count(old) == 1
source = source.replace(old, replacement)
old = "exactInventory = set(inventory) == {suite['name'] for suite in report.get('testResults', [])} and report.get('numTotalTestSuites') == len(inventory)"
replacement = "exactInventory = set(expected) == {suite['name'] for suite in report.get('testResults', [])} and report.get('numTotalTestSuites') == len(expected)"
assert source.count(old) == 1
source = source.replace(old, replacement)
target.write_bytes(source.encode('utf-8'))
print('Prepared one unique 12-suite focused successor; no test runner started.')
