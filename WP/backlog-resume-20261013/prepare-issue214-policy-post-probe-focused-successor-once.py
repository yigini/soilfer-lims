"""Prepare a unique frozen focused successor for ONLY the post-start probe/test correction."""
import ast,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
old=wp/'verify-issue214-policy-owner-snapshot-focused-once.py'
new=wp/'verify-issue214-policy-post-probe-focused-once.py';assert not new.exists()
previous=json.loads((wp/'issue214-policy-owner-full/source-after.json').read_bytes())
changed={p for p,h in previous.items() if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h}
assert changed=={'server/scripts/rehearsal_deployment_readiness.cjs','server/tests/contracts/issue_214_lab_policy_schema.test.js'}
text=old.read_text(encoding='utf8').replace('"""A new frozen full successor after closed fixture corrections; never replay."""',
 '"""New frozen focused probe successor;8/219 required, preserve original failedCI/diagnostic evidence."""')
text=text.replace("dest = wp / 'issue214-policy-owner-snapshot-focused'", "dest = wp / 'issue214-policy-post-probe-focused'")
text=text.replace("prefix='lims214-full-owned-visible-'", "prefix='lims214-probe-focused-owned-visible-'")
text=text.replace("exactInventory = report.get('numTotalTestSuites') == 8", "selectedPaths = set(args[args.index('--runTestsByPath') + 1:])\nexactInventory = report.get('numTotalTestSuites') == 8 and set(s['name'] for s in report.get('testResults', [])) == selectedPaths")
text=text.replace("and report.get('numFailedTests') == report.get('numPendingTests') == report.get('numFailedTestSuites') == report.get('numPendingTestSuites') == 0 else", 
 "and report.get('numTotalTests') == report.get('numPassedTests') == 219 and report.get('numTodoTests',0) == 0\n        and report.get('numFailedTests') == report.get('numPendingTests') == report.get('numFailedTestSuites') == report.get('numPendingTestSuites') == 0 else")
ast.parse(text);new.write_bytes(text.encode())
print(json.dumps({'preparedUnused':new.relative_to(root).as_posix(),'onlyChangedFrozenInputs':sorted(changed),'requiredSuites':8,'requiredTests':219,'fullInventory':366,'productionOperations':0}))
