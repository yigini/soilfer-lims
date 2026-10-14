"""Classify21 original cases before declaring NEW owned resubmission/report order context."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-resubmission-report-revisions-context-review'
assert not dest.exists() and (wp/'issue209-qc-disposition-context-singles/index.json').exists()
pins={'audit_0_7_resubmission.test.js':'fe096c8066a537cbdb557a716a5234f49dd5e2556f92bf226272ea3420ad9d35','audit_0_9_public_report_superseded.test.js':'a1be589e9793a0e85dc85df62152d432b312b69b30c6718dc25ee980b1a9f4a1','audit_6_2_report_revisions.test.js':'ec401e8ef4ffcf7aa9aa97b9a94e02192dccaec3465be957059e57ff8d1f24c5'}
originals={n:(root/'server/tests/contracts'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
boundaries={
'audit_0_7_resubmission.test.js':'Shared manually assembled SUBMITTED/ACCEPTED evidence lacks an order. Declare one legacy NULL line for the existing numeric analysis before its first execution witness, and a matching line for the separately assembled remaining S1 owner before its witness. RETURN history, unchanged prior package/result, later S2 submission identity, stale-S1 refusals, QC mutable-only detachment and zero item-review/audit assertions remain byte-identical. Existing duplicate accepted child shares the exact legacy line; no new owners.',
'audit_0_9_public_report_superseded.test.js':'Shared manually assembled APPROVED sample with ACCEPTED PH_H2O witness declares its usable legacy NULL order in NEW owned retained history. No runtime amendment order step. Old HTML/PDF link refusal/access-log behavior, other-sample isolation, immutable prior revocation metadata, missing-token zero access rows and injected publication rollback assertions remain byte-identical.',
'audit_6_2_report_revisions.test.js':'Shared manually assembled APPROVED sample with retained approver/ACCEPTED PH_H2O witness declares its usable legacy NULL order in NEW owned retained history. Approval metadata, amendment refusal/zero-table-writes, predecessor/reason/issuer freezing, SQL immutability, stored statement after policy change, concurrent one-revision result and tombstone privacy/PDF marking assertions remain byte-identical; no runtime amendment order step.'}
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in pins:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages'])
  assert m.splitlines()[0]=='Error: A reasoned order revision with the complete analysis set is required before starting this execution.'
  cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'NEW_OWNED_HISTORY_POSITIVE_EXECUTION_WITNESS_MISSING_CURRENT_INTAKE_EQUIVALENT_ORDER','sourceDecision':boundaries[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d caught-order-failure WIs remain reachable zero-write refused with separate readonly noACTIVE/noMatching/fraction/approved amendment impact lists; approved nonzero STOP under6167740581. No automatic backfill/relink/wider fallback.'})
assert len(cases)==21
assert {n:sum(c['suite']==n for c in cases) for n in pins}==dict(zip(pins,[8,7,6]))
dest.mkdir()
for n,b in originals.items():(dest/(n+'.before-original')).write_bytes(b)
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':21,'cases':cases,'productionOperations':0},indent=2)+'\n').encode())
proof=[]
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode();additions=[]
 if n=='audit_0_7_resubmission.test.js':
  anchor='        const result = await createExecutionResultFixture(prisma,'
  addition="""        // #209: NEW owned retained execution history declares its existing owner's order.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: id('ORDER-07'), sampleId, version: 1,
            status: 'ACTIVE', reason: 'Owned resubmission execution order context', requestedBy: 'system:fixture',
            lines: { create: [{ id: id('LINE-07'), analysis, workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
"""
  extraAnchor='        // Pin6059085200: only this named S1/S2 fixture opts into cached evidence.'
  extra="""        // #209: only the newly assembled remaining S1 owner gets a new matching line.
        require('../../services/workflowStateRules').assertFixtureContext();
        const retainedOrder = await prisma.sampleOrderRevision.findFirst({ where: { sampleId: f.sampleId, status: 'ACTIVE' } });
        await prisma.orderLine.create({ data: { id: id('LINE-07-REMAINING'), revisionId: retainedOrder.id,
            analysis: remaining.analysis, workItemId: null, status: 'ACTIVE', isRequired: true } });
"""
 else:
  anchor='        await createExecutionResultFixture(prisma,'
  suffix='09' if '0_9' in n else '62'
  addition="""        // #209: declare only this NEW owned retained PH execution's legacy order context.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: id('ORDER-SUFFIX'), sampleId, version: 1,
            status: 'ACTIVE', reason: 'Owned retained report execution order context', requestedBy: 'system:fixture',
            lines: { create: [{ id: id('LINE-SUFFIX'), analysis: 'PH_H2O', workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
""".replace('SUFFIX',suffix)
 addition=addition.replace('\n',newline);assert text.count(anchor)==1;text=text.replace(anchor,addition+anchor);additions.append(addition)
 if n=='audit_0_7_resubmission.test.js':
  extra=extra.replace('\n',newline);assert text.count(extraAnchor)==1;text=text.replace(extraAnchor,extra+extraAnchor);additions.append(extra)
 recovered=text
 for added in reversed(additions):assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered.encode()==b
 raw=text.encode();(root/'server/tests/contracts'/n).write_bytes(raw)
 proof.append({'path':'server/tests/contracts/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':[s.replace('\r\n','\n') for s in additions]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':21,'fixturePaths':3,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
