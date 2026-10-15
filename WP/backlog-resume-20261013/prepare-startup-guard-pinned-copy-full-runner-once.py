"""Prepare a new full ordinary successor only after the final focused167 PASS."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];W=R/'WP/backlog-resume-20261013';D=R/'WP/startup-order-readiness-20261015'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()=='7611ae485d1a29818d62fb53c32825abaac409f1'
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R).strip()
focused=json.loads((D/'retained-copy-validation-focused-once/summary.json').read_bytes());assert focused['status']=='PASS' and focused['passed']==167
frozen=json.loads((D/'retained-copy-validation-focused-once/source-after.json').read_bytes());assert all(hashlib.sha256((R/n).read_bytes()).hexdigest()==v for n,v in frozen.items())
runner=W/'verify-startup-guard-pinned-copy-full-ordinary-once.py';assert not runner.exists()
text=(W/'verify-startup-context-full-ordinary-once.py').read_text(encoding='utf-8')
text=text.replace('full-ordinary-once','full-guard-pinned-copy-ordinary-once').replace('nested-qc-context-guards-focused-once','retained-copy-validation-focused-once').replace("focused['passed']==focused['tests']==23","focused['passed']==focused['tests']==167").replace('5672','5679')
old="originalInputs=json.loads((R/'WP/startup-order-readiness-20261015/private-context-focused-once/source-before.json').read_bytes());unchangedTests={n:v for n,v in originalInputs.items() if n.startswith(('server/tests/contracts/issue_209_','server/tests/contracts/issue_214_'))};assert unchangedTests and all(before[n]==v for n,v in unchangedTests.items());"
new="unchangedTests=json.loads((R/'WP/startup-order-readiness-20261015/closed-successor-original-test-hashes-unchanged.json').read_bytes());assert len(unchangedTests)==371 and all(before[n]==v for n,v in unchangedTests.items());"
assert old in text;text=text.replace(old,new);runner.write_bytes(text.encode())
print(json.dumps({'status':'NEW_FULL_RUNNER_PREPARED_NOT_EXECUTED','helper':runner.relative_to(R).as_posix(),'expectedSuites':373,'expectedTests':5679,'stockTestsUnchanged':371}))
