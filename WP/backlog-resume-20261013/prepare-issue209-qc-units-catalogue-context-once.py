"""Classify14 QC/unit/catalogue cases before adding NEW owned usable order context."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-qc-units-catalogue-context-review'
assert not dest.exists() and (wp/'issue209-original-case-reconciliation-566/index.json').exists()
pins={'qc_controls.test.js':'5116c1d1a8b9b0d177a654e9edcb278ae75564f693d222c47fd0ccdc2dd343f0','issue_278_texture_closure_policy.test.js':'86943385f66050a535972e557929dc7127a6f21f583936d65bcb414a914fb612','controlled_units_interpretation.test.js':'9c8331920af922d8960a2c413ad9f546254dd9fabc7bdc6f82f690a2dbd84bb0','catalogue_result_entry.test.js':'a5dc72ca28049d692b6fe4a96822c12e87b24d57d2b8baab81774a43428bb8b5','catalogue_governance.test.js':'760bc3ad0f161f02e84ffd20beb81be669ae25275285ce6d49b1a03ccc356cf2'}
originals={n:(root/'server/tests/contracts'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
decisions={'qc_controls.test.js':'Only positive fifth SUBMITTED PH witness gets its declared legacy NULL order before evidence. Fourth evidence-free QC_FAIL/QC_GATE_FAILED409 stays orderless. Pure blank/RPD/recovery arithmetic, stored PROFILE_ONLY runs, measured6.8, warning reason, locked failure and fresh passing run assertions unchanged.',
'issue_278_texture_closure_policy.test.js':'NEW owned explicit three existing fraction owners get three matching legacy NULL lines before submitTriple execution. No TEXTURE/fraction owners manufactured, values40/40/19 and default2 vs strict0.5 unchanged. All pure inclusive boundary, unit/censoring unknown, per-replicate, lab default/policy and strict422/zero-state-change assertions unchanged.',
'controlled_units_interpretation.test.js':'Shared NEW owned APPROVED/ACCEPTED retained history gets11 legacy NULL lines for actual11 existing owners before accepted witnesses. RequiredAnalyses still contains absent EXCH_NA; no Na owner/value invented. All original unit factors, concentration/basis/censoring, FAO tiers/soil-plant/method interpretation, USDA texture/CN/base values and reported selection assertions unchanged. All8 original failures occurred at same first beforeAll ORDER_LINE_REQUIRED witness.',
'catalogue_result_entry.test.js':'Only valid assigned measurement positive test gets its usable legacy NULL order, retaining custom parameter/method/unit/lab. Earlier unknown/gate/spectral/foreign analyst/method/unit/duplicate key negatives stay orderless. Original positive HTTP409 and later sealed-edit400 observed, current writer/source-inferred missing recorded execution; no old response code invented. Later correction-required409/full snapshot preservation and stored5 assertions unchanged.',
'catalogue_governance.test.js':'Only NEW owned historical accepted custom parameter witness gets a matching legacy NULL order before execution. Exact original parameter/lab/value12/mg/kg retained; no alias or Lab row invention. Deletion/units409 and usage.results1, allowed retirement/rename and all unsafe definitions/packages/defaults/permissions/audit assertions unchanged.'}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in pins:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages'])
  if n!='catalogue_result_entry.test.js':assert m.splitlines()[0]=='Error: A reasoned order revision with the complete analysis set is required before starting this execution.'
  cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalObservedHeader':m.splitlines()[:8],'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'NEW_OWNED_POSITIVE_RETAINED_HISTORY_ORDER_CONTEXT','sourceDecision':decisions[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d missing/partial-order WIs remain reachable zero-write refused with distinct readonly impact causes and approvednonzeroSTOP; no runtime amendment step/backfill/relink.'})
assert len(cases)==14
dest.mkdir()
for n,b in originals.items():(dest/(n+'.before-original')).write_bytes(b)
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':14,'cases':cases,'productionOperations':0},indent=2)+'\n').encode())
proof=[]
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode()
 if n=='qc_controls.test.js':
  anchor="        await createExecutionResultFixture(prisma, { attemptStatus: 'SUBMITTED', data: {"
  sample='sampleId';codes='[item.analysis]';indent='        '
 elif n=='issue_278_texture_closure_policy.test.js':
  anchor='        for (const [param, value] of values) await createExecutionResultFixture';sample='sampleId';codes="['SAND', 'SILT', 'CLAY']";indent='        '
 elif n=='controlled_units_interpretation.test.js':
  anchor='        const now = new Date();';sample='sampleId';codes="(await prisma.workItem.findMany({ where: { sampleId, status: 'ACCEPTED' } })).map(item => item.analysis)";indent='        '
 elif n=='catalogue_result_entry.test.js':
  anchor="    test('Valid assigned measurement is saved and still uses a human parameter name', async () => {"+newline;sample='sampleId';codes='[param]';indent='        '
 else:
  anchor="        await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data: {";sample='sample.id';codes='[a.code]';indent='        '
 block="""        // #209: declare usable legacy order lines only in this NEW owned positive assembly.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: SAMPLE,
            version: 1, status: 'ACTIVE', reason: 'Owned QC/unit/catalogue execution order context', requestedBy: 'system:fixture',
            lines: { create: CODES.map(analysis => ({ id: require('node:crypto').randomUUID(), analysis,
                workItemId: null, status: 'ACTIVE', isRequired: true })) } } });
""".replace('SAMPLE',sample).replace('CODES',codes).replace('\n',newline)
 assert text.count(anchor)==1,(n,anchor)
 modified=text.replace(anchor,anchor+block) if n=='catalogue_result_entry.test.js' else text.replace(anchor,block+anchor)
 assert modified.replace(block,'',1).encode()==b,n
 raw=modified.encode();(root/'server/tests/contracts'/n).write_bytes(raw)
 proof.append({'path':'server/tests/contracts/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':[block.replace('\r\n','\n')]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':14,'fixturePaths':5,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
