"""Classified workbench request/order contexts; fresh sequential ordinary single-suite invocations, once."""
import datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;server=root/'server';dest=wp/'issue209-workbench-request-order-context-singles'
assert not dest.exists() and not os.environ.get('NODE_OPTIONS')
assert (wp/'issue209-profile-scope-workspace-context-singles/index.json').exists()
assert (wp/'issue209-single-entry-refusal-observation-singles/index.json').exists()
assert (wp/'issue209-qc-units-catalogue-context-singles/index.json').exists()
assert (wp/'issue209-mobile-offline-context-singles/index.json').exists()
assert (wp/'issue209-validation-provenance-context-singles/index.json').exists()
assert (wp/'issue209-resubmission-report-revisions-context-singles/index.json').exists()
assert (wp/'issue209-qc-disposition-context-singles/index.json').exists()
assert (wp/'issue209-keyed-receipt-decisions-6169628053/index.json').exists()
assert (wp/'issue209-keyed-mode-response-contract-singles/index.json').exists()
assert (wp/'issue209-workbench-review-legacy-context-singles/index.json').exists()
assert (wp/'issue209-report-pdf-queue-bounds-context-singles/index.json').exists()
assert (wp/'issue209-result-views-legacy-review-context-singles/index.json').exists()
assert (wp/'issue209-workbench-request-order-context-review/pre-correction-classification.json').exists()
assert (wp/'issue209-approved-orphan-decisions-6167740581/index.json').exists()
assert (wp/'issue209-result-policy-qc-cancellation-serial-singles/index.json').exists()
assert (wp/'issue209-historical-corrected-serial-singles/index.json').exists()
assert (wp/'issue209-result-policy-qc-cancellation-context-review/pre-correction-classification.json').exists()
assert (wp/'issue209-result-policy-qc-cancellation-context-review/fixture-additions-dispatch-bound.json').exists()
assert (wp/'issue209-historical-shape-corrected-context-review/corrected-additions-original.json').exists()
assert (wp/'issue209-historical-shape-corrected-context-review/correction-classification.json').exists()
assert (wp/'issue209-historical-column-spectral-publication-context-review/pre-correction-classification.json').exists()
assert (wp/'issue209-historical-column-spectral-publication-context-review/fixture-additions-original.json').exists()
directories=['shared','server/prisma_client','server/services','server/scripts','server/controllers','server/tests/contracts','server/tests/scenarios','server/tests/security','server/tests/helpers','server/prisma/migrations','client/src/components/sample','client/src/translations','server/locales']
paths=sorted({p.relative_to(root).as_posix() for directory in directories for p in (root/directory).rglob('*') if p.is_file() and p.suffix in ['.js','.cjs','.jsx','.sql','.json']})
paths+=['server/index.js','server/tests/globalSetup.js','server/prisma/schema.prisma','.gitattributes','Dockerfile','docker-entrypoint.sh','docs/audit/209-order-revisions.md']
dest.mkdir();env=dict(os.environ)
env['LIMS_OWNED_TEST_TEMPLATE']=str(server/'tests/.owned-templates/test_template_33522c62-1788-4298-8db6-06a0d4e5ff38.db')
paths.append('WP/backlog-resume-20261013/issue209-local-owned-physical-retention-spectral-finalizer.cjs')
paths.append(env['LIMS_OWNED_TEST_TEMPLATE'])
env['LIMS_OWNED_RETENTION_LEDGER']=str(dest/'physical-retention-original.jsonl')
before={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths}
(dest/'source-before.json').write_bytes((json.dumps(before,indent=2)+'\n').encode())
def run(command,stdout,stderr):
 with (dest/stdout).open('wb') as out,(dest/stderr).open('wb') as err:
  return subprocess.run(command,cwd=server,env=env,stdout=out,stderr=err)
assert run(['node','node_modules/jest/bin/jest.js','--listTests','--json','--testMatch','**/tests/**/*.test.js'],'inventory-original.json','inventory-stderr-original.log').returncode==0
inventory=json.loads((dest/'inventory-original.json').read_bytes());assert len(inventory)==len(set(inventory))==370
selected=[str(server/('tests/'+name)) for name in ['contracts/workbench_single_entry.test.js','contracts/workbench_draft_integrity.test.js','contracts/workbench_pipeline_twostep.test.js','contracts/qc_disposition_flagging.test.js','contracts/audit_1_2_state_authority.test.js','contracts/issue_209_order_revision_integration.test.js','security/audit_1_2_state_writes.test.js','security/audit_1_2_migration_sources.test.js']]
args=['--setupFilesAfterEnv',str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(wp/'issue209-local-owned-physical-retention-spectral-finalizer.cjs'),'--globalTeardown',str(wp/'issue214-policy-owner-local-retention-teardown.cjs'),'--testMatch','**/tests/**/*.test.js']
assert run(['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--showConfig'],'config-original.json','config-stderr-original.log').returncode==0
cfgText=(dest/'config-original.json').read_text(encoding='utf8');cfg=json.loads(cfgText[cfgText.index('{'):])
assert cfg['globalConfig']['maxWorkers']==1 and cfg['globalConfig']['workerIdleMemoryLimit']==512000000
assert cfg['configs'][0]['setupFilesAfterEnv']==[str(server/'tests/ownedSuiteSetup.js'),str(server/'tests/setup.js'),str(wp/'issue209-local-owned-physical-retention-spectral-finalizer.cjs')]

prior=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes())
expected={s['name']:len(s['assertionResults']) for s in prior['testResults']}
for child in (wp/'issue209-historical-corrected-serial-singles').iterdir():
 if child.is_dir():
  report=json.loads((child/'report-original.json').read_bytes());expected.update({s['name']:len(s['assertionResults']) for s in report['testResults']})
review=json.loads((wp/'issue209-workbench-request-order-context-review/fixture-additions-original.json').read_bytes())
for row in review: assert hashlib.sha256((root/row['path']).read_bytes()).hexdigest()==row['afterSha256']
expected[str(server/'tests/contracts/audit_1_2_state_authority.test.js')]+=8
expected={name:expected[name] for name in selected}
assert len(expected)==len(selected)==8
plannedTests=sum(expected.values())
assert plannedTests==343
(dest/'started-open.json').write_bytes((json.dumps({'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'kind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','plannedSuites':8,'plannedTests':plannedTests,'sourceFrozen':True,'nodeOptions':'','productionOperations':0},indent=2)+'\n').encode())
closed=[]
for ordinal,name in enumerate(selected,1):
 child=dest/(f'{ordinal:02d}-'+Path(name).stem);child.mkdir()
 argv=['cmd.exe','/d','/c','npm.cmd','test','--',*args,'--runTestsByPath',name,'--json','--outputFile',str(child/'report-original.json')]
 (child/'command.json').write_bytes((json.dumps({'argv':argv,'nodeOptions':'','ordinarySetups':True,'stockAssertions':True,'workerIdleMemoryLimit':512000000,'productionOperations':0},indent=2)+'\n').encode())
 with (child/'stdout-original.log').open('wb') as out,(child/'stderr-original.log').open('wb') as err:
  result=subprocess.run(argv,cwd=server,env=env,stdout=out,stderr=err)
 (child/'exit-original.txt').write_bytes((str(result.returncode)+'\n').encode())
 report=json.loads((child/'report-original.json').read_bytes()) if (child/'report-original.json').exists() else None
 current={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
 summary={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'suite':name,'exit':result.returncode,'originalReportPresent':report is not None,'tests':report.get('numTotalTests') if report else None,'passed':report.get('numPassedTests') if report else None,'failed':report.get('numFailedTests') if report else None,'expectedTests':expected[name],'sourceUnchanged':current==before}
 summary['status']='PASS' if result.returncode==0 and report and report.get('success') and current==before and report.get('numTotalTestSuites')==1 and report.get('numTotalTests')==report.get('numPassedTests')==expected[name] and set(s['name'] for s in report['testResults'])=={name} and all(report.get(k)==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites']) else 'FAILED_OR_INCOMPLETE'
 (child/'observed-closed-summary.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode());closed.append(summary);print(json.dumps(summary),flush=True)
 if summary['status']!='PASS':break

after={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths};(dest/'source-after.json').write_bytes((json.dumps(after,indent=2)+'\n').encode())
summary={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'verificationKind':'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR','plannedSuites':8,'plannedTests':plannedTests,'closedSuites':len(closed),'closedTests':sum(c['tests'] or 0 for c in closed),'passedTests':sum(c['passed'] or 0 for c in closed),'sourceUnchanged':after==before,'selectedInventoryEqual':set(c['suite'] for c in closed)==set(selected),'fullDiscovery':370,'ordinarySetups':True,'stockAssertions':True,'maxWorkers':1,'workerIdleMemoryLimit':512000000,'nodeOptions':'','productionOperations':0,'children':closed}
summary['status']='PASS' if len(closed)==8 and all(c['status']=='PASS' for c in closed) and summary['closedTests']==plannedTests and before==after and summary['selectedInventoryEqual'] else 'FAILED_OR_INCOMPLETE'
(dest/'summary-observed.json').write_bytes((json.dumps(summary,indent=2)+'\n').encode());print(json.dumps({k:v for k,v in summary.items() if k!='children'}),flush=True)
assert summary['status']=='PASS'
