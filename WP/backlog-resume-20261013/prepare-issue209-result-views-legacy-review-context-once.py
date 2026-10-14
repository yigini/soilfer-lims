"""Classify28 original positive evidence setup failures and add only owned legacy order declarations."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-result-views-legacy-review-context-review'
assert not dest.exists() and (wp/'issue209-report-pdf-queue-bounds-context-singles/index.json').exists()
names=['audit_0_10_current_result_views.test.js','audit_0_5_legacy_review.test.js'];old={n:(root/'server/tests/contracts'/n).read_bytes() for n in names}
dest.mkdir()
for n,b in old.items():(dest/(n+'.before-original')).write_bytes(b)
cases=[]
for suite in json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes())['testResults']:
 n=Path(suite['name']).name
 if n not in names:continue
 for c in suite['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages']);assert m.splitlines()[0]=='Error: A reasoned order revision with the complete analysis set is required before starting this execution.'
  cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'DECLARED_USABLE_LEGACY_ORDER_FOR_FRESH_RETAINED_EXECUTION_WITNESS','sourceDecision':'SOC view fixtures get one legacy NULL SOC order before evidence, including approved/archived/other-lab contexts; sentinel-safe existing id() generator retained. Method/unit/censoring ambiguity, no-selection errors, invalid/superseded data, saved policy/date/scope filters and all assertions unchanged.' if n==names[0] else 'Only evidence:true legacy PH review fixtures get one legacy NULL PH order before their witness; evidence:false remains exactly missing. Legacy ACCEPT/RETURN/WAIVE, scope/state/permissions/QC refusals and scalar flags/values remain unchanged. No Lab/policy/approval metadata is invented for other-lab fixture.','assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d missing orders remain zero-write refused/readonly lists/approvednonzeroSTOP under6167740581; declaration applies only to NEW owned positive witness assembly, not runtime repair.'})
assert len(cases)==28
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':28,'cases':cases,'productionOperations':0},indent=2)+'\n').encode())
blocks={names[0]:"    "}
texts={n:b.decode().replace('\r\n','\n') for n,b in old.items()};additions={n:[] for n in names}
def insert(n,anchor,block):
 assert texts[n].count(anchor)==1
 texts[n]=texts[n].replace(anchor,block+anchor);additions[n].append(block)
insert(names[0],'        return { sample, item, projectCode };\n',"        // #209: the NEW owned retained SOC history declares its usable legacy order.\n        await prisma.$transaction(tx => tx.sampleOrderRevision.create({ data: { id: id('ORDER-010'), sampleId,\n            version: 1, status: 'ACTIVE', reason: 'Owned retained selected-value execution context', requestedBy: jwt.decode(token).username,\n            lines: { create: [{ id: id('LINE-010'), analysis: 'SOC', workItemId: null, status: 'ACTIVE', isRequired: true }] } } }));\n")
insert(names[1],"        const result = evidence ? await createExecutionResultFixture", "        // #209: only the positive evidence witness gets a declared retained usable order.\n        if (evidence) await prisma.$transaction(tx => tx.sampleOrderRevision.create({ data: { id: id('ORDER-05'), sampleId,\n            version: 1, status: 'ACTIVE', reason: 'Owned retained legacy review execution context', requestedBy: require('jsonwebtoken').decode(manager).username,\n            lines: { create: [{ id: id('LINE-05'), analysis: 'PH_H2O', workItemId: null, status: 'ACTIVE', isRequired: true }] } } }));\n")
proof=[]
for n,text in texts.items():
 recovered=text
 for block in reversed(additions[n]):assert block in recovered;recovered=recovered.replace(block,'',1)
 assert recovered==old[n].decode().replace('\r\n','\n')
 p=root/'server/tests/contracts'/n;newline='\r\n' if b'\r\n' in old[n] else '\n';p.write_bytes(text.replace('\n',newline).encode())
 proof.append({'path':p.relative_to(root).as_posix(),'beforeSha256':hashlib.sha256(old[n]).hexdigest(),'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'oldSourceAndEveryAssertionRecoveredByRemovingAdditions':True,'additions':additions[n]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'originalCasesClassified':28,'fixturePaths':2,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
