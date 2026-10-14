"""Classify each of the last37 original failures, then declare owned accepted-reference order context, once."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-exchange-spectral-context-review'
assert not dest.exists() and (wp/'issue209-governance-reason-sync-context-singles/index.json').exists()
pins={'nsis_policy_and_scoping.test.js':'e7977325d5989ac413184a785a14cd2b11e1dc6232fa63ff8f11f15b19adf340',
'exchange_error_semantics.test.js':'b64c5b7ae14863a44109fd2642b668352c7847eab7b6e976949cfeea45b20d02',
'nsis_v2_exchange.test.js':'28e9ce488d569103f13bcfd4f8b098495a79d4c8fbe1c16926de0840ba101524',
'export_normalization.test.js':'f930850ad6c6bfa1a2a3a3d78c1bcae2ce3fde81878c43dce66604d86cc5defb',
'spectral_stage_e.test.js':'76c59c38e14df19f0307a365563ccd19c991f54cfbacb2a9e6bd0600f1606beb'}
originals={n:(root/'server/tests/contracts'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
decisions={
'nsis_policy_and_scoping.test.js':'All five failures are the same beforeAll ORDER_LINE_REQUIRED from new explicit accepted PH_H2O witness with existing owner. Add one legacy NULL PH_H2O order only to that NEW GTM fixture before accepted attempt insertion. No order for ownerless HND/processing/held samples. Preserve approved-only publication, status filters, lab isolation404, empty scope denies all, scoped stats and existing QC/reported-selection path.',
'exchange_error_semantics.test.js':'All17 failures are beforeAll ORDER_LINE_REQUIRED at new accepted PH_H2O witness. Declare one legacy NULL line for existing approved owner. Preserve correlation IDs, held/processing exclusion/genuine-empty200, once-only policy scan, every503/Retry-After/redaction alias assertion, snapshot/change routing, and400/404/401. No policyService missing-table catch, scope bypass, journal or runtime changes.',
'nsis_v2_exchange.test.js':'All9 fail beforeAll at new accepted two-replica execution, ORDER_LINE_REQUIRED. Declare one legacy NULL PH_H2O line on existing sample1 owner before original single accepted attempt. Keep original two values6.4/6.5/replicate1/2 and one-attempt assertions; profile/accession metadata, strict exclusion, lossless observations, RFC7946, snapshot/highwater/change cursor/receipt retry/conflict/no sample mutation/keyset cached total unchanged. No order/owner/value added for no-lab or pagination samples.',
'export_normalization.test.js':'Both fail at new accepted SOC witness order preflight. Declare one legacy NULL SOC line on its existing owner; no extra methodology or unit inference. Preserve literal1.8percent,18g/kg normalization, headline1.8, both export routes/authoritative stored specimen lab scopes and reviewed selection.',
'spectral_stage_e.test.js':'All4 fail beforeAll at paired new accepted SOC reference ORDER_LINE_REQUIRED. Declare one legacy NULL SOC order before reference insertion. Keep literal Walkley-Black Result.methodologyId with executedMethodRevision null,18.5g/kg/AIR_DRY/MEASURED, unchanged MIR/NIR signal/axis/preparation/QC/scoped keys/absent scope/ETag304/bulk export. No order for MOZ ownerless spectrum; no synthetic controlled method or spectrum changes.'}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in originals:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages']);assert 'orderLineResolutionService.js' in m and 'insertFixtureExecution' in m and 'reasoned order revision' in m
  cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalObservedHeader':m.splitlines()[:10],'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'FIXTURE_ONLY_NEW_OWNED_ACCEPTED_REFERENCE_WITHOUT_ORDER_CONTEXT','sourceDecision':decisions[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d missing/partial orders are reachable from caught intake failures; unchanged new-execution preflight refuses zero writes. Current normal intake atomically creates initial order and rolls back failure. Approved runtime orphan remains noneditable/refused and readonly kit nonzeroSTOP for separate forward fix; these are declared NEW historical fixture assemblies, never runtime repair/backfill/relink/amendment step.'})
assert len(cases)==37
dest.mkdir()
for n,b in originals.items():(dest/(n+'.before-original')).write_bytes(b)
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':37,'cases':cases,'changedLegacyExpectations':0,'runtimeSources':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['server/tests/helpers/workAttemptFixtures.js','server/services/workAttemptWriteService.js','server/services/orderLineResolutionService.js','server/services/orderService.js']},'productionOperations':0},indent=2)+'\n').encode())
proof=[]
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode()
 if n=='nsis_policy_and_scoping.test.js':sample='sampleApprovedGtm.id';code='PH_H2O';anchor='        for (const data of ['
 elif n=='exchange_error_semantics.test.js':sample='sampleApproved.id';code='PH_H2O';anchor='        for (const data of ['
 elif n=='nsis_v2_exchange.test.js':sample='sample1.id';code='PH_H2O';anchor='        await createExecutionResultsFixture(prisma, '
 elif n=='export_normalization.test.js':sample='testSample.id';code='SOC';anchor='        await createExecutionResultFixture(prisma, '
 else:sample='sampleGtmId';code='SOC';anchor='        // Create paired reference wet chemistry result'
 added="""        // #209: declared legacy order for this NEW owned accepted numerical/reference assembly.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: SAMPLE,
            version: 1, status: 'ACTIVE', reason: 'Owned accepted reference order context', requestedBy: 'system:fixture',
            lines: { create: [{ id: require('node:crypto').randomUUID(), analysis: 'CODE',
                workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
""".replace('SAMPLE',sample).replace('CODE',code).replace('\n',newline)
 assert text.count(anchor)==1,n;text=text.replace(anchor,added+anchor,1)
 assert text.replace(added,'',1).encode()==b,n
 raw=text.encode();(root/'server/tests/contracts'/n).write_bytes(raw)
 proof.append({'path':'server/tests/contracts/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'existingOwnersOnly':True,'additions':[added.replace('\r\n','\n')]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
runner=(wp/'verify-issue209-governance-reason-sync-context-singles-once.py').read_text(encoding='utf8')
runner=runner.replace('issue209-governance-reason-sync-context','issue209-exchange-spectral-context')
runner=runner.replace("['contracts/audit_1_1_reconcile_duplicates.test.js','contracts/sample_detail.test.js','contracts/interim_gaps_verification.test.js','contracts/reopened_governance_scenarios.test.js'","['contracts/nsis_policy_and_scoping.test.js','contracts/exchange_error_semantics.test.js','contracts/nsis_v2_exchange.test.js','contracts/export_normalization.test.js','contracts/spectral_stage_e.test.js'")
runner=runner.replace('len(selected)==8','len(selected)==9').replace('plannedTests==365','plannedTests==353').replace("'plannedSuites':8","'plannedSuites':9").replace('len(closed)==8','len(closed)==9')
runner=runner.replace("assert not dest.exists() and not os.environ.get('NODE_OPTIONS')","assert not dest.exists() and not os.environ.get('NODE_OPTIONS')\nassert (wp/'issue209-governance-reason-sync-context-singles/index.json').exists()")
for p in re.findall(r"\(wp/'([^']+)'\)\.exists\(\)",runner):assert (wp/p).exists(),p
target=wp/'verify-issue209-exchange-spectral-context-singles-once.py';assert not target.exists();compile(runner,str(target),'exec');target.write_bytes(runner.encode())
print(json.dumps({'classifiedOriginalCases':37,'fixturePaths':5,'oldSourceAndAssertionsRecovered':True,'plannedSuites':9,'expectedTests':353,'runtimeChanges':0,'productionOperations':0}))
