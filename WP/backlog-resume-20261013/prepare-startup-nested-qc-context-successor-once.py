"""Complete the observed direct QC prerequisite binding; retain predecessor."""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/nested-qc-context-preparation-once';assert not D.exists();D.mkdir()
for rel in ['server/scripts/install_qc_gate_scope.js','server/index.js','server/tests/contracts/startup_readiness_context.test.js','server/tests/contracts/startup_readiness_telemetry.test.js']:
 p=R/rel;(D/(p.name+'.before-original')).write_bytes(p.read_bytes())
p=R/'server/scripts/install_qc_gate_scope.js';s=p.read_text(encoding='utf-8');old=".installQcRuns({ dbPath: target });";assert s.count(old)==1;s=s.replace(old,'.installQcRuns({ dbPath: target, startupContext: apply ? undefined : startupContext });');p.write_bytes(s.encode())
p=R/'server/index.js';s=p.read_text(encoding='utf-8');old='    process.exit(1);\n} finally {';assert s.count(old)==1;s=s.replace(old,'    startupContext.close();\n    process.exit(1);\n} finally {');p.write_bytes(s.encode())
p=R/'WP/backlog-resume-20261013/verify-startup-nested-qc-context-guards-focused-once.py';assert not p.exists();s=(R/'WP/backlog-resume-20261013/verify-startup-check-attribution-focused-once.py').read_text(encoding='utf-8').replace('check-attribution-focused-once','nested-qc-context-guards-focused-once').replace("report.get('numTotalTests')==17","report.get('numTotalTests')==23");p.write_bytes(s.encode())
(D/'preparation.json').write_text(json.dumps({'status':'OBSERVED_DIRECT_QC_INSTALLER_BINDING_COMPLETED','priorRun':'check-attribution-focused-once','priorExtraPhysicalIntegrityStage':'install_qc_gate_scope','sameReadonlyContextNowPassedToInstallQcRuns':True,'noSourceGuardOrRefusalChanges':True,'newGuardCases':'mixed pragma views/full26 bad-integrity and FK/refusal/copy race/order race/source digest revalidation','closedBeforeProcessExit':True},indent=2),encoding='utf-8')
print(json.dumps({'status':'NESTED_QC_CONTEXT_BOUND'}))
