"""Prepare unique current-head CI/request successors; never execute failed-head helpers."""
import ast,json
from pathlib import Path
wp=Path(__file__).parent
terminal=wp/'retain-pr296-post-probe-new-ci-terminal-once.py'
request=wp/'request-pr296-post-probe-exact-head-audit-after-green-once.py'
assert not terminal.exists() and not request.exists()
text=(wp/'retain-pr296-policy-owner-new-ci-terminal-59paths-once.py').read_text(encoding='utf8')
text=text.replace('issue214-policy-owner-source-pr-update','issue214-policy-post-probe-source-pr-update')
text=text.replace('issue214-policy-owner-new-ci-open','issue214-policy-post-probe-new-ci-open')
text=text.replace('issue214-policy-owner-ci-{identifier}-closed-terminal','issue214-policy-post-probe-ci-{identifier}-closed-terminal')
text=text.replace('issue214-policy-owner-full/inventory-original.json','issue214-policy-post-probe-focused/inventory-original.json')
text=text.replace('5565','5566')
text=text.replace("identifier!=38467368095", "identifier not in [38467368095,38515104824]")
text=text.replace("if fragment in e.filename]", "if fragment in e.filename and '_Post ' not in Path(e.filename).name]")
text=text.replace("assert after['dbWalShmPreserved'] and after['ready']['classification']=='PRESENT'", 
 "assert after['dbWalShmPreserved'] and after['secondaryInspectionsOnRetainedSnapshot'] and after['ready']['classification']=='PRESENT'")
text=text.replace('Original failed38467368095 immutable.', 'Both failed38467368095/e47b and38515104824/8d immutable; never retry either.')
ast.parse(text);terminal.write_bytes(text.encode())
text=(wp/'request-pr296-policy-owner-exact-head-audit-after-green-once.py').read_text(encoding='utf8')
text=text.replace('issue214-policy-owner-source-pr-update','issue214-policy-post-probe-source-pr-update')
text=text.replace('issue214-policy-owner-new-ci-open','issue214-policy-post-probe-new-ci-open')
text=text.replace('issue214-policy-owner-ci-{identifier}-closed-terminal','issue214-policy-post-probe-ci-{identifier}-closed-terminal')
text=text.replace('issue214-policy-owner-exact-head-audit-request','issue214-policy-post-probe-exact-head-audit-request')
text=text.replace('5565','5566').replace('identifier!=38467368095','identifier not in [38467368095,38515104824]')
text=text.replace('Pip #214 policy-owner exact-head audit request:', 'Pip #214 post-probe exact-head audit request:')
text=text.replace("or 'Pip #214 post-probe exact-head audit request:' in c['body']", "or 'Pip #214 policy-owner exact-head audit request:' in c['body'] or 'Pip #214 post-probe exact-head audit request:' in c['body']")
text=text.replace('Focus','Focus')
text=text.replace('Focused8/218 and full366/5566 local proofs retained exact frozen inputs;',
 'Focused8/219 passed with all421 frozen inputs unchanged; all other419 inputs equal prior actual stockCI. Previous full local/stockCI366/5565 evidence remains bound to previous8d head; no fresh localfull5566 claim;')
text=text.replace('Focus','Focus')
text=text.replace('Original failed CI38467368095 was never retried; its server365/5547/client/builds/boundary pass and Scenario6 readiness refusal remain retained honestly.',
 'Both failed CI38467368095/e47b and38515104824/8d were never retried. The latter actualserver366/5565/client/builds/boundary passed, but its new post-start proof failed after secondary original-file readonly inspections created WAL/SHM. Owned reproduction and actual-programme regression verify inspecting the retained snapshot keeps every old predicate plus original triple equality; runtime owner/scientific source unchanged.')
text=text.replace('preserve human draftn', 'preserve every human draft')
ast.parse(text);request.write_bytes(text.encode())
assert 'Focused8/219' in text and 'full366/5566 local' not in text
print(json.dumps({'preparedUnused':[terminal.name,request.name],'expectedSuites':366,'expectedTests':5566,'boundHead':'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','boundAutomaticRun':38524553288,'productionOperations':0}))
