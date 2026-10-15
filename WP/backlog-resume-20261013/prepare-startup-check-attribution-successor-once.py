"""Attribute the unresolved extra physical check to its real startup stage."""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/check-attribution-preparation-once';assert not D.exists();D.mkdir()
p=R/'server/tests/contracts/startup_readiness_context.test.js';b=p.read_bytes();(D/'test-before-original.js').write_bytes(b);s=b.decode()
s=s.replace('    let context;','    let context, activeStage;',1).replace('physical.push({ target, sql });','physical.push({ target, sql, stage: activeStage });',1)
s=s.replace('                for (const [script, method] of selected) {','                for (const [script, method] of selected) {\n                    activeStage = script;',1)
p.write_bytes(s.encode())
p=R/'WP/backlog-resume-20261013/verify-startup-check-attribution-focused-once.py';assert not p.exists();s=(R/'WP/backlog-resume-20261013/verify-startup-shared-pragma-views-focused-once.py').read_text(encoding='utf-8').replace('shared-pragma-views-focused-once','check-attribution-focused-once').replace("'failureMessages':case['failureMessages']","'failureMessages':['\\n'.join(m.splitlines()[:18]) for m in case['failureMessages']]");p.write_bytes(s.encode())
(D/'preparation.json').write_text(json.dumps({'status':'TEST_OBSERVABILITY_ONLY','runtimeSourceChanged':False,'previousRun':'shared-pragma-views-focused-once','previousTotals':{'tests':17,'passed':15,'failed':2},'all26ReportsEquivalent':True,'unresolvedPhysicalIntegrityChecks':2},indent=2),encoding='utf-8')
print(json.dumps({'status':'CHECK_ATTRIBUTION_PREPARED'}))
