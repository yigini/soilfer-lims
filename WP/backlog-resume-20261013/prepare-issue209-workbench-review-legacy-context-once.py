"""Classify 121 original cases before adding only explicit owned fixture order context, once."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-workbench-review-legacy-context-review'
assert not dest.exists() and (wp/'issue209-keyed-receipt-decisions-6169628053/index.json').exists()
names=['audit_1_2_workbench_state.test.js','audit_0_6_review_atomicity.test.js','audit_1_2_legacy_results.test.js']
old={n:(root/'server/tests/contracts'/n).read_bytes() for n in names}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes())
dest.mkdir()
for n,b in old.items():(dest/(n+'.before-original')).write_bytes(b)
cases=[]
for suite in report['testResults']:
 n=Path(suite['name']).name
 if n not in names:continue
 for c in suite['assertionResults']:
  if c['status']!='failed':continue
  message='\n'.join(c['failureMessages']);assert message.splitlines()[0]=='Error: A reasoned order revision with the complete analysis set is required before starting this execution.'
  lines=re.findall(re.escape(n)+r':(\d+):',message)
  if n==names[0]:
   decision='Declared legacy NULL order for the freshly assembled numerical owner before any execution; operational PREPARATION/DRYING contexts remain unchanged. Only the separately seeded EC owner gets its matching NEW fixture line. Submission matrix/blocked companion set/preview/final sample/preparation revert/RETURN identity/CAS/audit rollback assertions unchanged.'
  elif n==names[1]:
   decision='Declared usable retained legacy NULL line before the positive review witness in ordinary or generated historical closure assembly. Generated closure already has209 nullable model primitive: no DDL/guard change. Its legacy status, custody alias, approval metadata and accepted/waived/refusal predicates stay literal. Only opt-in canonical EC package evidence gets its matching NEW owned line; duplicate child/cached evidence policy unchanged. This is positive history assembly, not a claim that production closure commands create numerical attempts.'
  else:
   decision='Declared usable legacy NULL order before the fresh retained first-reading witness. Final sample/gate/instrument/matrix/refusal and no-results inputs remain unchanged. Only the explicit separate SAND/SILT/CLAY matrix witnesses get their own NEW owned lines before recording; values40/30/17, flags, requiredAnalyses, and old execution identities stay unchanged.'
  cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(message.encode()).hexdigest(),'originalFixtureAndTestLineNumbers':lines,'classification':'DECLARED_USABLE_ORDER_FOR_NEW_OWNED_POSITIVE_OR_NEGATIVE_WITNESS_ASSEMBLY','sourceDecision':decision,'assertionChanges':0,'productionInspections':0,'releasedRuntimeVariant':'Baseline48d could retain WIs after caught initial-order failure; those actual missing-order variants stay zero-write refused and separately readonly listed, approvednonzeroSTOP per6167740581. Currentmainnormalintake creates its initial order; no automatic repair/backfill/relink/widerfallback.'})
assert len(cases)==121
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':121,'sourceAuthorities':[6163271808,6166518424,6167740581,6169628053],'cases':cases,'assertionChanges':0,'runtimeChanges':0,'productionOperations':0},indent=2)+'\n').encode())
texts={n:b.decode().replace('\r\n','\n') for n,b in old.items()};additions={n:[] for n in names}
def insert(n,anchor,added):
 assert texts[n].count(anchor)==1,(n,anchor,texts[n].count(anchor))
 texts[n]=texts[n].replace(anchor,added+anchor);additions[n].append(added)
def block(sample,analysis,indent,actor,ids):
 return f"{indent}// #209: declare retained usable order context while assembling this NEW owned fixture.\n{indent}await prisma.$transaction(tx => tx.sampleOrderRevision.create({{ data: {{ id: {ids[0]}, sampleId: {sample},\n{indent}    version: 1, status: 'ACTIVE', reason: 'Owned retained execution order context', requestedBy: {actor},\n{indent}    lines: {{ create: [{{ id: {ids[1]}, analysis: {analysis}, workItemId: null, status: 'ACTIVE', isRequired: true }}] }} }} }}));\n"
def companion(sample,analysis,indent,ids):
 return f"{indent}// #209: only this separately seeded canonical witness needs its matching retained order line.\n{indent}await prisma.$transaction(async tx => {{\n{indent}    const revision = await tx.sampleOrderRevision.findFirstOrThrow({{ where: {{ sampleId: {sample}, status: 'ACTIVE' }} }});\n{indent}    if (!await tx.orderLine.count({{ where: {{ revisionId: revision.id, analysis: {analysis}, status: 'ACTIVE' }} }}))\n{indent}        await tx.orderLine.create({{ data: {{ id: {ids}, revisionId: revision.id, analysis: {analysis},\n{indent}            workItemId: null, status: 'ACTIVE', isRequired: true }} }});\n{indent}}});\n"
n=names[0]
context="    if (!['PREPARATION', 'DRYING', ...workflow.CLOSURE_TASK_ANALYSES].includes(analysis)) {\n"+block('sample.id','analysis','        ','manager.username',['randomUUID()','randomUUID()'])+"    }\n"
insert(n,'    return { sample, item };\n',context)
context="    if (item.id !== row.item.id) {\n"+companion('row.sample.id','item.analysis','        ','randomUUID()')+"    }\n"
insert(n,'    await createExecutionResultFixture(prisma,{attemptStatus:\'RECORDED\',data:{id:randomUUID(),sampleId:row.sample.id,\n',context)
n=names[1]
insert(n,"            const result = await createExecutionResultFixture(prisma, { data: { id: id('R-06-LEGACY'),",block('database.sampleId','analysis','            ',"jwt.decode(manager).username",["id('ORDER-06-LEGACY')","id('LINE-06-LEGACY')"]))
insert(n,"        const result = await createExecutionResultFixture(prisma, { ...(['ACCEPTED','SUBMITTED'].includes(status)",block('sampleId','analysis','        ',"jwt.decode(manager).username",["id('ORDER-06')","id('LINE-06')"]))
insert(n,"            await createExecutionResultFixture(prisma, { attemptStatus, data: { id: id('R-06-CACHED'),",companion('f.sampleId','item.analysis','            ',"id('LINE-06-CACHED')"))
n=names[2]
insert(n,"    const result = await createExecutionResultFixture(prisma, { data: { id: randomUUID(), sampleId: sample.id, param: analysis,",block('sample.id','analysis','    ','repeatReviewer.username',['randomUUID()','randomUUID()']))
insert(n,"        await createExecutionResultFixture(prisma, { data: { id: randomUUID(), sampleId: row.sample.id, param,\n",companion('row.sample.id','param','        ','randomUUID()'))
proof=[]
for n,text in texts.items():
 recovered=text
 for added in reversed(additions[n]):assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered==old[n].decode().replace('\r\n','\n'),n
 p=root/'server/tests/contracts'/n;newline='\r\n' if b'\r\n' in old[n] else '\n';p.write_bytes(text.replace('\n',newline).encode())
 proof.append({'path':p.relative_to(root).as_posix(),'beforeSha256':hashlib.sha256(old[n]).hexdigest(),'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':additions[n]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':121,'fixturePaths':3,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
