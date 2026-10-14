"""Classify21 numerical/matrix/provenance cases before NEW owned order declarations."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-validation-provenance-context-review'
assert not dest.exists() and (wp/'issue209-resubmission-report-revisions-context-singles/index.json').exists()
pins={'contracts/audit_0_14_number_entry.test.js':'4f3cdb09efc6419c9dcdee566d3529bdc8b06810cd76eb2b18d29b89a2907182','contracts/mandatory_reason.test.js':'cf5f7c45118ddf0cc53fcb924f340c669599640dde8f5cf3b344396d9854211b','contracts/matrix_blocking_diagnostics.test.js':'83cb931c61e940d10bab7960d43fac236a2180ee0e3dd16268d6a800d1964a91','contracts/matrix_validation.test.js':'acde16336d561f274c5226fac8b03eab83ccfb89cdaaf373aa02ef98f3fcd006','contracts/prerequisite_gate.test.js':'9134cc3b406f02a44df8676f8e5caf32166203c295af30ed494f617e2a897b85','contracts/result_provenance.test.js':'3a8e5b4eb93b8ca32ef4b2e4539f72d61911bb0fed4f7b2c8f5140bc90b15336','scenarios/scientific_validation.test.js':'a4d86248cc23c9d883636b162084c95eb9ef5d6a8c54a7d968ef9c1af3e6a040'}
originals={n:(root/'server/tests'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
decisions={
'audit_0_14_number_entry.test.js':'Existing single SPEC_GRS/TEXTURE owner in NEW numeric-input fixtures gets one usable legacy NULL order line. No fraction owners manufactured. Raw/canonical numeric values, censored strings, atomic four texture outputs, malformed number/policy zero-write assertions, profile audit and typed QC raw strings remain byte-identical.',
'mandatory_reason.test.js':'Only positive2b SUBMITTED synthetic6.5 execution gets a declared PH_H2O legacy order before its witness. Earlier no-attempt409/no-note400 remain orderless. Approved undo-approval refusals/sample+audit equality, reason and retained duplicate-disagreement request remain byte-identical.',
'matrix_blocking_diagnostics.test.js':'NEW explicit five existing SAND/SILT/CLAY/SOC/TN owners get five legacy NULL matching lines before execution. Keep requiredAnalyses, all input values40/30/17 and40/40/20/90/2, strict87%closure422 and advisoryCN45flag200 unchanged. No normalization/composite/fraction ownership/runtime changes.',
'matrix_validation.test.js':'NEW explicitly assembled nine numeric owners get nine matching legacy NULL lines after owner assembly. Original HTTP409 observed for save cases; later submit400 follows missing measurements. Source shows current execution INSERT order preflight; candidate context declared before execution, original HTTP bodies did not capture refusal code and none is invented. USDA Sandy Loam, invalid80%closure warning, CN/base missingNa behavior and submission diagnostics unchanged.',
'prerequisite_gate.test.js':'Only positive fifth save after actual preparation completion gets legacy PH_H2O order context immediately before its request. Earlier assignment/start state and preparation412 refusal tests remain untouched/orderless. No prerequisite or permission/runtime change.',
'result_provenance.test.js':'NEW four canonical entry owners receive legacy order context; only subsequently assembled PH and TEXTURE owners receive additional NULL lines before their executions, without changing retained lines. First direct fixture ORDER_LINE_REQUIRED observed. Other original failures are null results/no recorded review attempt/zero replicates; source-inferred consequence of execution preflight without usable order, not an invented observed HTTP code. Typed provenance MEASURED vs internal reasoned-repeat spectral PREDICTED, complete texture DERIVED, frozen basis/censoring and two retained replicates/report selections unchanged.',
'scientific_validation.test.js':'Only valid7.2 positive scenario gets PH_H2O legacy order before actual batch-save. Earlier ABOVE_MAX/BELOW_MIN/non-numeric422 with zero Results remain untouched/orderless. Observed old409 without body code; no diagnostic invented, current writer order preflight inspected. All numeric policy/source data unchanged.'}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in decisions:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages']);cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalObservedHeader':m.splitlines()[:8],'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'EXPLICIT_NEW_OWNED_POSITIVE_ORDER_CONTEXT; ORIGINAL_SURFACE_FAILURE_AND_DEPENDENT_FAILURES_RETAINED','sourceDecision':decisions[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d missing/partial-order WIs remain reachable zero-write refused; separate readonly impact causes/approved nonzero STOP unchanged under6167740581. No runtime backfill/relink/amendment order step.'})
assert len(cases)==21
dest.mkdir()
for n,b in originals.items():(dest/(Path(n).name+'.before-original')).write_bytes(b)
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':21,'cases':cases,'productionOperations':0},indent=2)+'\n').encode())
proof=[]
def declaration(sample,codes):
 return """        // #209: usable order context is declared only in this NEW owned fixture assembly.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: SAMPLE,
            version: 1, status: 'ACTIVE', reason: 'Owned numerical execution order context', requestedBy: 'system:fixture',
            lines: { create: CODES.map(analysis => ({ id: require('node:crypto').randomUUID(), analysis,
                workItemId: null, status: 'ACTIVE', isRequired: true })) } } });
""".replace('SAMPLE',sample).replace('CODES',codes)
def extra(sample,analysis):
 return """        // #209: append only the newly assembled owner's line; retain every prior line.
        require('../../services/workflowStateRules').assertFixtureContext();
        const declaredOrder = await prisma.sampleOrderRevision.findFirst({ where: { sampleId: SAMPLE, status: 'ACTIVE' } });
        await prisma.orderLine.create({ data: { id: require('node:crypto').randomUUID(), revisionId: declaredOrder.id,
            analysis: ANALYSIS, workItemId: null, status: 'ACTIVE', isRequired: true } });
""".replace('SAMPLE',sample).replace('ANALYSIS',analysis)
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode();additions=[]
 def add(anchor,block):
  global text
  block=block.replace('\n',newline);assert text.count(anchor)==1,(n,anchor);text=text.replace(anchor,block+anchor);additions.append(block)
 if 'number_entry' in n:
  add('        return { sampleId, workItemId };',declaration('sampleId','[analysis]'))
 elif 'mandatory_reason' in n:
  add('        // Pin6060110991: 6.5 is a synthetic fixture value',declaration('sampleId',"['PH_H2O']"))
 elif 'matrix_blocking' in n:
  add('    });'+newline+newline+'    afterEach',declaration('testSampleId','analysisDefinitions.map(([code]) => code)'))
 elif 'matrix_validation' in n:
  block=declaration('sampleId','parameters.map(([code]) => code)');block='\n'.join(line[4:] if line.startswith('    ') else line for line in block.split('\n'))
  add('}'+newline+newline+"describe('Sample Matrix Cross-Parameter",block)
 elif 'prerequisite_gate' in n:
  add("    test('5. Saving results now succeeds with preparation completed (HTTP 200)', async () => {",'')
  anchor="    test('5. Saving results now succeeds with preparation completed (HTTP 200)', async () => {"+newline
  block=declaration('sampleId',"['PH_H2O']").replace('\n',newline);assert text.count(anchor)==1;text=text.replace(anchor,anchor+block);additions.append(block)
 elif 'result_provenance' in n:
  add("        await require('../../services/qcRuleService').change",declaration('testSampleId',"['EC', 'CLAY_PRED', 'SOC', 'TOTAL_N']"))
  add('        const r = await createExecutionResultFixture(prisma,',extra('testSampleId',"'PH'"))
  add('        // A categorical report outcome retains its actual complete composite execution.',extra('testSampleId',"'TEXTURE'"))
 elif 'scientific_validation' in n:
  anchor="    it('should ACCEPT valid result within range', async () => {"+newline
  block=declaration('sampleId',"['PH_H2O']").replace('\n',newline);assert text.count(anchor)==1;text=text.replace(anchor,anchor+block);additions.append(block)
 recovered=text
 for added in reversed(additions):
  if not added:continue
  assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered.encode()==b,n
 raw=text.encode();(root/'server/tests'/n).write_bytes(raw)
 proof.append({'path':'server/tests/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':[s.replace('\r\n','\n') for s in additions if s]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':21,'fixturePaths':7,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
