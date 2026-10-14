"""Classify12 mobile/offline cases before NEW owned execution order contexts."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-mobile-offline-context-review'
assert not dest.exists() and (wp/'issue209-validation-provenance-context-singles/index.json').exists()
pins={'mobile_offline_sync.test.js':'43dc43179e9be55b9e24ff90f9e31696325b4af5f1ce29f28e9c7e830b31c1bc','audit_1_2_offline_state.test.js':'b2d8f64d1fac35ba61053acc4ebe8a0d498888ac4793b430d25b84bc12504494'}
originals={n:(root/'server/tests/contracts'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
decisions={'mobile_offline_sync.test.js':'Only positive PH COMPLETE_WORK after unchanged DRYING checklist/duplicate operation gets a fresh legacy NULL PH_H2O order. Original receipts were REJECTED vs APPLIED and subsequent cross-target CONFLICT; no old refusal code observed/invented. Actual syncService sameTX writer.writeResult followed by receipt inspected: source-inferred missing execution order prevents first receipt and therefore later conflict. Device/health/work-pack/operational gates and all original sync receipt/status/result/key-conflict assertions remain byte-identical.',
'audit_1_2_offline_state.test.js':'Shared NEW owned retained initial6.2 witness declares one legacy NULL line for its existing numeric owner before execution. Includes APPROVED/ARCHIVED/DISPOSED retained-history fixtures without changing their statuses or executable-refusal boundaries. Original ORDER_LINE_REQUIRED occurred during positive fixture assembly. Draft base-version/audit, explicit independent CONFIRMATION repeat/new first-fill/history, stale CAS and fresh lab-scope/audit-failure full snapshot rollback, terminal refusal, actual zero-WI offline intake custody/receipt assertions remain unchanged. No runtime amendment order step.'}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in pins:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages']);cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalObservedHeader':m.splitlines()[:8],'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'NEW_OWNED_EXECUTION_CONTEXT_WITH_ORIGINAL_SYNC_FAILURES_RETAINED','sourceDecision':decisions[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d missing-order WIs remain runtime-reachable zero-write refused with readonly distinct impact causes/approvednonzeroSTOP per6167740581; no automatic repair/backfill/relink.'})
assert len(cases)==12 and sum(c['suite']=='mobile_offline_sync.test.js' for c in cases)==2
dest.mkdir()
for n,b in originals.items():(dest/(n+'.before-original')).write_bytes(b)
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':12,'cases':cases,'runtimeSourceInspected':'server/services/syncService.js:706-753','productionOperations':0},indent=2)+'\n').encode())
proof=[]
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode()
 if n=='mobile_offline_sync.test.js':
  anchor="        test('COMPLETE_WORK: validates determination and updates WorkItem status', async () => {"+newline
  block="""            // #209: only this NEW owned positive analytical execution gets its order context.
            require('../../services/workflowStateRules').assertFixtureContext();
            await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(),
                sampleId: testSample.id, version: 1, status: 'ACTIVE', reason: 'Owned mobile execution order context',
                requestedBy: 'system:fixture', lines: { create: [{ id: require('node:crypto').randomUUID(),
                    analysis: 'PH_H2O', workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
""".replace('\n',newline)
  assert text.count(anchor)==1;modified=text.replace(anchor,anchor+block)
 else:
  anchor='    const result = await createExecutionResultFixture(prisma,'
  block="""    // #209: NEW owned retained evidence declares its actual existing owner's order.
    require('../../services/workflowStateRules').assertFixtureContext();
    await prisma.sampleOrderRevision.create({ data: { id: randomUUID(), sampleId: sample.id,
        version: 1, status: 'ACTIVE', reason: 'Owned offline execution order context', requestedBy: 'system:fixture',
        lines: { create: [{ id: randomUUID(), analysis, workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
""".replace('\n',newline)
  assert text.count(anchor)==1;modified=text.replace(anchor,block+anchor)
 assert modified.replace(block,'',1).encode()==b,n
 raw=modified.encode();(root/'server/tests/contracts'/n).write_bytes(raw)
 proof.append({'path':'server/tests/contracts/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':[block.replace('\r\n','\n')]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':12,'fixturePaths':2,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
