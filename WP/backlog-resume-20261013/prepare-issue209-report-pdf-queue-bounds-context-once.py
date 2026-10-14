"""Classify nineteen cases before inserting only owned positive order contexts, once."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-report-pdf-queue-bounds-context-review'
assert not dest.exists() and (wp/'issue209-workbench-review-legacy-context-singles/index.json').exists()
names=['audit_0_8_report_truthfulness.test.js','report_pdf.test.js','audit_0_11_workbench_queue.test.js','issue_281_cross_check_bounds.test.js']
old={n:(root/'server/tests/contracts'/n).read_bytes() for n in names};dest.mkdir()
for n,b in old.items():(dest/(n+'.before-original')).write_bytes(b)
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
decisions={names[0]:'Fresh owned approved or review-needed PH history gets its declared retained legacy NULL order before accepted/submitted evidence. Approval/review/QC/disposition/report-lineage/number/PDF/publication-date/policy snapshot inputs and assertions unchanged.',names[1]:'Fresh owned approved history already has five accepted PH/SOC/fraction owners and a five-code requiredAnalyses set without TEXTURE. Declare exactly their five legacy NULL matching lines before accepted results; preserve all values/units/selections, binary PDF/share/revocation assertions. No approved edit/normalizer change.',names[2]:'Fresh PROCESSING controlled owner receives its declared usable legacy NULL order during assembly. Required instrument eligibility/draft selection/readiness/current-invalid/superseded/cache inputs and assertions unchanged.',names[3]:'All existing explicit fraction/carbon/nitrogen owners receive one declared legacy NULL line each during NEW owned assembly, before recorded/saved values. No TEXTURE owner, normalization, policy value, invalid-bounds disclosure, strict blocking threshold, or scientific value change.'}
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in names:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  message='\n'.join(c['failureMessages']);fk='Foreign key constraint violated' in message
  cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(message.encode()).hexdigest(),'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',message),'classification':'ORIGINAL_FOREIGN_KEY_SETUP_FAILURE_NOT_ATTRIBUTED_TO_MISSING_ORDER' if fk else 'DECLARED_CURRENT_OR_RETAINED_USABLE_ORDER_FOR_OWNED_EXECUTION_WITNESS','sourceDecision':decisions[n], 'foreignKeyBoundary': 'Referenced Sample and Batch are created before WorkItem. The new context is inserted after WorkItem, so it does not change or conceal the original failing FK site. Original cause remains unconfirmed; verify this same unchanged site in the successor, retaining any repeat failure honestly.' if fk else None,'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'releasedVariant':'48d missing orders remain runtime-reachable/0write refusal/readonly noACTIVE or noMatching/fraction lists, approvednonzeroSTOP per6167740581; no automatic repair/backfill/relink/widerfallback.'})
assert len(cases)==19 and sum(c['classification'].startswith('ORIGINAL_FOREIGN') for c in cases)==1
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':19,'cases':cases,'sourceAuthorities':[6163271808,6166518424,6167740581,6169628053],'originalForeignKeyCauseNotInferred':True,'productionOperations':0},indent=2)+'\n').encode())
texts={n:b.decode().replace('\r\n','\n') for n,b in old.items()};additions={n:[] for n in names}
def insert(n,anchor,added):
 assert texts[n].count(anchor)==1,(n,anchor,texts[n].count(anchor))
 texts[n]=texts[n].replace(anchor,added+anchor);additions[n].append(added)
def block(sample,codes,indent,actor,idfn):
 return f"{indent}// #209: declare usable retained order lines during NEW owned positive fixture assembly.\n{indent}await prisma.$transaction(tx => tx.sampleOrderRevision.create({{ data: {{ id: {idfn}, sampleId: {sample},\n{indent}    version: 1, status: 'ACTIVE', reason: 'Owned retained positive execution order context', requestedBy: {actor},\n{indent}    lines: {{ create: ({codes}).map(analysis => ({{ id: {idfn}, analysis, workItemId: null, status: 'ACTIVE', isRequired: true }})) }} }} }}));\n"
insert(names[0],"        await createExecutionResultFixture(prisma, { attemptStatus: item.status,\n",block('sampleId',"['PH_H2O']",'        ',"require('jsonwebtoken').decode(token).username","id('ORDER-08')"))
insert(names[1],"        // Add verified results to the sample in DB\n",block('s.id',"['PH_H2O','SOC','SAND','SILT','CLAY']",'        ',"require('jsonwebtoken').decode(mgrToken).username","require('node:crypto').randomUUID()"))
insert(names[2],"        return { analysis, sampleId, workItemId, equipmentId };\n",block('sampleId','[analysis]','        ','jwt.decode(token).username',"id('ORDER-11')"))
insert(names[3],"        for (const [param, value, unit] of values) await createExecutionResultFixture",block('sampleId','codes','        ','jwt.decode(token).username','randomUUID()'))
proof=[]
for n,text in texts.items():
 recovered=text
 for added in reversed(additions[n]):assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered==old[n].decode().replace('\r\n','\n'),n
 p=root/'server/tests/contracts'/n;newline='\r\n' if b'\r\n' in old[n] else '\n';p.write_bytes(text.replace('\n',newline).encode())
 proof.append({'path':p.relative_to(root).as_posix(),'beforeSha256':hashlib.sha256(old[n]).hexdigest(),'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':additions[n]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':19,'fixturePaths':4,'oldSourceAndAssertionsRecovered':True,'originalForeignKeySiteUnchanged':True,'runtimeChanges':0,'productionOperations':0}))
