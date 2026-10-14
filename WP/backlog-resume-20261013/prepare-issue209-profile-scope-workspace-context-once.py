"""Classify17 scope/profile/workspace cases and preserve every legacy assertion."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-profile-scope-workspace-context-review'
assert not dest.exists() and (wp/'issue209-qc-units-catalogue-context-singles/index.json').exists()
pins={'profile_identity_routes.test.js':'70b686e4e835d82ad85c588b5f8ed3dfebca5625d0357be4a7699c8c525e67e8','api_key_scoping_isolation.test.js':'ade7c7567cabd111af981512f089355e388c5fc9ce1b06ca4d42fe6833b2a8e6','workspace_projection_p2.test.js':'904010154621d9ed523f1236510aa94f46da624305494982c200591aedf4a5b0'}
originals={n:(root/'server/tests/contracts'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
decisions={'profile_identity_routes.test.js':'Only NEW owned released APPROVED/ACCEPTED PH history gets a usable legacy NULL order before its unchanged6.4 witness. Draft and project-move samples remain untouched/orderless. Canonical/alias amendment restrictions, distinct authoriser, identity values, frozen export snapshot/journal, clerical key replay/conflict/current-scope/missing-reason/stale-revision checks remain byte-identical. No runtime amendment order step.',
'api_key_scoping_isolation.test.js':'Two explicit existing accepted pH owners in NEW owned GTM/MOZ history get separate matching legacy NULL orders before their two witnesses. Raw pH alias,6.5/5.2, units and lab/keys/scopes unchanged; no Lab row manufactured. Absent-scope empty feeds/detail404, cross-lab isolation and exact foreign WorkItem/attempt non-disclosure remain byte-identical.',
'workspace_projection_p2.test.js':'Projection NEW retained SUBMITTED PH witness gets legacy NULL lines for existing PH_H2O/VIS_NIR owners only, no operational lines or spectral evidence. Missing accepted spectral evidence/history gap remains unchanged. First-revision1 order test is separately assembled as an owned runtime-reachable48d missing-order shape: fresh PROCESSING sample with same two logical owners/statuses/aliases and no order/measurement. Same original reasoned request/remediation assertions run on that fresh fixture, then original projection sample restored in finally before custody test. No revision0 invention, no old version assertion change, no runtime/backfill repair. Original EXPECTED/reception/cross-lab/projection counts/history-gap/keyed order replay/custody audits unchanged.'}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in pins:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages']);assert m.splitlines()[0]=='Error: A reasoned order revision with the complete analysis set is required before starting this execution.'
  cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalObservedHeader':m.splitlines()[0],'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'NEW_OWNED_RETAINED_POSITIVE_ORDER_CONTEXT_AND_EXPLICIT_FIRST_ORDER_ORPHAN_REMEDIATION_SCENARIO','sourceDecision':decisions[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d missing/partial-order WIs remain runtime-reachable zero-write refused, reasoned ordinary full-target revision is accepted remedy; readonly distinct impact lists and approvednonzeroSTOP unchanged.'})
assert len(cases)==17
dest.mkdir()
for n,b in originals.items():(dest/(n+'.before-original')).write_bytes(b)
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':17,'cases':cases,'versionDecision':'Preserve original first-revision1 assertion on separately owned runtime-reachable missing-order fixture; projection context has legitimate revision1. Current orderService createRevision max+1 inspected before changes.','productionOperations':0},indent=2)+'\n').encode())
proof=[]
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode();additions=[]
 def add(anchor,block,after=False):
  global text
  block=block.replace('\n',newline);assert text.count(anchor)==1,(n,anchor);text=text.replace(anchor,anchor+block if after else block+anchor);additions.append(block)
 if n=='profile_identity_routes.test.js':
  add("        await createExecutionResultFixture(prisma, {attemptStatus:'ACCEPTED'", """        // #209: declared only for this NEW owned released numerical history.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: ids.released,
            version: 1, status: 'ACTIVE', reason: 'Owned released profile execution order context', requestedBy: 'system:fixture',
            lines: { create: [{ id: require('node:crypto').randomUUID(), analysis: 'PH_H2O', workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
""")
 elif n=='api_key_scoping_isolation.test.js':
  anchor='        for (const data of ['
  add(anchor,"""        // #209: each NEW owned accepted scope witness has its own unchanged pH owner/order.
        require('../../services/workflowStateRules').assertFixtureContext();
        for (const sampleId of [sampleGtmId, sampleMozId]) await prisma.sampleOrderRevision.create({ data: {
            id: crypto.randomUUID(), sampleId, version: 1, status: 'ACTIVE', reason: 'Owned API scope execution order context',
            requestedBy: 'system:fixture', lines: { create: [{ id: crypto.randomUUID(), analysis: 'pH',
                workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
""")
 else:
  add('        // Add result for pH so it has evidence',"""        // #209: NEW owned projection history declares both existing analytical owners, preserving the spectral gap.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: testSample.id,
            version: 1, status: 'ACTIVE', reason: 'Owned workspace projection execution order context', requestedBy: 'system:fixture',
            lines: { create: ['PH_H2O', 'VIS_NIR'].map(analysis => ({ id: require('node:crypto').randomUUID(), analysis,
                workItemId: null, status: 'ACTIVE', isRequired: true })) } } });
""")
  anchor="    test('5. POST /api/samples/:id/orders applies revision atomically and records receipt', async () => {"+newline
  add(anchor,"""        // #209: preserve the original first-revision1 remedy scenario on NEW owned missing-order work.
        const projectionSample = testSample;
        const firstOrderSampleId = 'ws-first-order-' + require('node:crypto').randomUUID();
        testSample = await createSampleFixture(prisma, { data: { id: firstOrderSampleId, originalId: firstOrderSampleId,
            labId: 'S-P2-FIRST-ORDER', assignedLab: 'LAB-P2', country: 'P2C', status: 'PROCESSING',
            dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify(['PH_H2O', 'VIS_NIR']) } });
        for (const [analysis, status] of [['PH_H2O', 'SUBMITTED'], ['VIS_NIR', 'ACCEPTED']])
            await createWorkItemFixture(prisma, { data: { id: firstOrderSampleId + '-' + analysis, sampleId: firstOrderSampleId,
                analysis, status, assignedLab: 'LAB-P2', assignedTo: techUser.username, labId: 'LAB-P2' } });
        try {
""",after=True)
  anchor=next(line+newline for line in text.splitlines() if 'await cleanupWorkflowFixtures(prisma, "workItem"' in line and "analysis: 'EC'" in line)
  add(anchor,"""        } finally { testSample = projectionSample; }
""",after=True)
 recovered=text
 for added in reversed(additions):assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered.encode()==b,n
 raw=text.encode();(root/'server/tests/contracts'/n).write_bytes(raw)
 proof.append({'path':'server/tests/contracts/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':[s.replace('\r\n','\n') for s in additions]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':17,'fixturePaths':3,'oldSourceAndAssertionsRecovered':True,'originalFirstRevisionOneScenarioPreserved':True,'runtimeChanges':0,'productionOperations':0}))
