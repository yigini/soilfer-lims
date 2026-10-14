"""Classify six independent fixture groups before inserting only order context, once."""
import datetime, hashlib, json, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2]; wp=Path(__file__).parent
dest=wp/'issue209-result-policy-qc-cancellation-context-review'
assert not dest.exists()
names=['audit_0_15_duplicate_loq.test.js','audit_1_0_lab_policies.test.js','audit_1_5_result_writes.test.js','audit_4_7_instrument_import_install.test.js','audit_0_2_qc_lock.test.js','audit_1_6_intake_cancellation.test.js']
source={name:(root/'server/tests/contracts'/name).read_bytes() for name in names}
inventory=json.loads((wp/'issue209-closed-runtime-boundary-analysis/closed-failed-case-inventory.json').read_bytes())
reportPath=wp/'issue209-full-ordinary-companion/report-original.json'
report=json.loads(reportPath.read_bytes())
assert (wp/'issue209-approved-orphan-decisions-6167740581/index.json').exists()
dest.mkdir()
for name,body in source.items():(dest/(name+'.before-original')).write_bytes(body)
decisions={
 names[0]:'Fresh PROCESSING sample owners in both LOQ builders receive declared usable orders before execution. Recorded/cached methodology distinction, nonpositive values, flags, QC verdict, and raw evidence stay unchanged. Generated legacy closure already has the column; no schema alteration.',
 names[1]:'The export owner receives its initial current order. The freshly assembled APPROVED report context declares an already retained ACTIVE legacy NULL PH line before accepted fixture evidence; no approved edit, approval metadata, policy version, or report content change.',
 names[2]:'Fresh controlled measurement owners receive usable legacy NULL order lines (PSA canonical TEXTURE). Orphan and duplicate-child historical import builders stay untouched and unlinked. The raw conflicting-batch attempt receives only a valid orderLineId, leaving the batch fault and all-table refusal assertion intact. Parser smuggling, provenance, sealed work, replay and numerical assertions unchanged.',
 names[3]:'The literal PRE200 fixture lacks the current nullable OrderLine.workItemId model primitive. Add only digest-bound schemaSql in its NEW owned assembly, plus current initial orders for its two owners before measurements/capture. Instrument-import owner, PRE200 classification, drafts, all old row/DDL/dry/apply/no-op checks unchanged.',
 names[4]:'Only the three seedCachedEvidence warning-review positive contexts receive an initial PH order before their accepted fixture evidence. QC_FAIL locks, negative cached-evidence and UNKNOWN historical contexts unchanged.',
 names[5]:'Only the five evidence-bearing cancellation scenarios receive usable order context before their execution/attempt witness. A raw attempt gets only orderLineId. Cancellation state/provenance, other unstarted owner, intake undo/rejection predicates and zero-write snapshots unchanged.'}
cases=[]
for case in inventory:
 if case['suite'] not in names:continue
 suite=next(s for s in report['testResults'] if Path(s['name']).name==case['suite'])
 result=next(t for t in suite['assertionResults'] if t['fullName']==case['test'])
 text='\n'.join(result['failureMessages'])
 frames=[line.strip() for line in text.splitlines() if case['suite'] in line][:8]
 cases.append({**case,'classification':'NEW_OWNED_POSITIVE_CONTEXT_OR_INDEPENDENT_GUARD_WITNESS',
 'productionReachabilityClassification':'CURRENT_INTAKE_EQUIVALENT_POSITIVE_CONTEXT; RELEASED_48D_MISSING_ORDER_VARIANT_SEPARATELY_RUNTIME_REACHABLE_AND_ZERO_WRITE_REFUSED',
 'sourceDecision':decisions[case['suite']],'originalFailureSha256':hashlib.sha256(text.encode()).hexdigest(),'originalTestFrames':frames,
 'releasedRuntimeEvidence':'issue209-closed-runtime-boundary-analysis/source-analysis.json; current main2242 initial order exists; baseline48d catches order creation errors after WI writes',
 'runtimeVariantTreatment':'No automatic repair/backfill/relink/wider fallback; readonly noACTIVE/noMatching/ambiguous/multiple/fraction lists and prospective approved STOP per6167740581',
 'assertionChanges':0,'productionInspections':0})
assert len(cases)==30
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLASSIFIED_BEFORE_EDITS','originalFailedCases':30,'cases':cases,'originalFullReportSha256':hashlib.sha256(reportPath.read_bytes()).hexdigest()},indent=2)+'\n').encode())
additions={name:[] for name in names}
texts={name:body.decode('utf8').replace('\r\n','\n') for name,body in source.items()}
def insert(name,anchor,added,after=False):
 text=texts[name]; assert text.count(anchor)==1,(name,anchor,text.count(anchor))
 texts[name]=text.replace(anchor,anchor+added if after else added+anchor)
 additions[name].append(added)
def order_block(sample,analysis,indent='    ',username="'system:fixture'"):
 return (f"{indent}// #209: declare the usable retained order during NEW owned fixture assembly.\n"
 f"{indent}await prisma.$transaction(tx => tx.sampleOrderRevision.create({{ data: {{ id: randomUUID(), sampleId: {sample},\n"
 f"{indent}    version: 1, status: 'ACTIVE', reason: 'Owned execution context with a retained usable order', requestedBy: {username},\n"
 f"{indent}    lines: {{ create: [{{ id: randomUUID(), analysis: {analysis}, workItemId: null, status: 'ACTIVE', isRequired: true }}] }} }} }}));\n")
# All new legacy lines are assembled before any execution, never relinked after it.
n=names[0]
# This suite uses its existing id() generator rather than randomUUID().
def loq_block():return order_block('sampleId','analysis','            ').replace('randomUUID()',"id('ORDER015')",1).replace('randomUUID()',"id('LINE015')",1)
insert(n,'            methods.push(methodId);\n',loq_block())
insert(n,"        }\n        if (legacyPrior) {\n",loq_block())
insert(n,'            recorded.push({ methodId, sampleId });\n',loq_block())
n=names[1]
initial="        // #209: current intake creates this order before the first export witness.\n        await prisma.$transaction(tx => require('../../services/orderService').createInitialOrder(tx,\n            { id: sampleId }, ['SOC'], actor));\n"
insert(n,"        const old = await createExecutionResultFixture(prisma, { data: { id: id('POL-EXPORT-RES'),",initial)
block=order_block('sampleId',"'PH_H2O'",'        ',"actor.username").replace('randomUUID()',"id('POL-REPORT-ORDER')",1).replace('randomUUID()',"id('POL-REPORT-LINE')",1)
insert(n,"        await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data: { id: id('POL-REPORT-RES'),",block)
n=names[2]
block="    if (![\"SPEC_MIR\", \"DRYING\"].includes(analysis)) {\n"+order_block('sampleId',"analysis === 'PSA' ? 'TEXTURE' : analysis",'        ',"actor.username")+"    }\n"
insert(n,'    return { sample, item };\n',block)
insert(n,"    await prisma.workAttempt.create({ data: { id: attemptId, workItemId: f.item.id,", "    const orderLine = await prisma.orderLine.findFirstOrThrow({ where: { orderRevision: { sampleId: f.sample.id, status: 'ACTIVE' } } });\n")
insert(n,"id: attemptId, workItemId: f.item.id, ","orderLineId: orderLine.id, ",after=True)
n=names[3]
block="        // #209: this NEW literal PRE200 copy lacks only the current model's nullable line identity.\n        read(raw => raw.exec(require('../../utils/orderRevisionMigrationSource').schemaSql));\n        for (const item of f.items) await f.db.$transaction(tx => require('../../services/orderService').createInitialOrder(tx,\n            { id: item.sampleId }, [item.analysis], f.actor));\n"
insert(n,"        const run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, f.input)).id, f.actor);\n",block)
n=names[4]
block="        if (seedCachedEvidence) await prisma.$transaction(tx => require('../../services/orderService').createInitialOrder(tx,\n            { id: sampleId }, ['PH_H2O'], jwt.decode(tokens.LAB_MANAGER)));\n"
insert(n,"        // Pin6060005962: only the three successful warning reviews opt in.\n",block)
n=names[5]
block="    if (['result', 'attempt', 'evidence-event'].includes(evidence)) {\n"+order_block('f.sample.id','f.item.analysis','        ',"actor.username")+"    }\n"
insert(n,"    if (['result', 'evidence-event'].includes(evidence)) {\n",block)
insert(n,"    if (evidence === 'attempt') await prisma.workAttempt.create", "    const orderLine = evidence === 'attempt' ? await prisma.orderLine.findFirstOrThrow({ where: { orderRevision: { sampleId: f.sample.id, status: 'ACTIVE' } } }) : null;\n")
insert(n,"if (evidence === 'attempt') await prisma.workAttempt.create({ data: { id: randomUUID(), workItemId: f.item.id, ","orderLineId: orderLine.id, ",after=True)
# Two separate HTTP refusal scenarios each build a positive evidence witness first.
anchor="    await createExecutionResultFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id, param: f.item.analysis, value: '1.2', numericValue: 1.2 } });\n"
assert texts[n].count(anchor)==2
block=order_block('f.sample.id','f.item.analysis','    ',"actor.username")
texts[n]=texts[n].replace(anchor,block+anchor);additions[n].extend([block,block])
proof=[]
for name,text in texts.items():
 recovered=text
 for added in reversed(additions[name]):
  assert added in recovered,(name,added)
  recovered=recovered.replace(added,'',1)
 assert recovered==source[name].decode('utf8').replace('\r\n','\n'),name
 path=root/'server/tests/contracts'/name
 newline='\r\n' if b'\r\n' in source[name] else '\n'
 path.write_bytes(text.replace('\n',newline).encode('utf8'))
 proof.append({'path':path.relative_to(root).as_posix(),'beforeSha256':hashlib.sha256(source[name]).hexdigest(),'afterSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'oldSourceAndAssertionsExactlyRecoveredByRemovingOnlyAdditions':True,'additions':additions[name]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalFailures':30,'changedFixtures':6,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
