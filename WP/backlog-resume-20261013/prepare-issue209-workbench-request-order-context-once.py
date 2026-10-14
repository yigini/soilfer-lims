"""Classify11 workbench/QC cases before fixture-only request/order contexts."""
import datetime,hashlib,json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-workbench-request-order-context-review'
assert not dest.exists() and (wp/'issue209-single-entry-refusal-observation-singles/index.json').exists()
analysis=json.loads((wp/'issue209-single-entry-refusal-observation-review/actual-refusal-classification.json').read_bytes());assert analysis['actualResponse']['status']==500 and analysis['actualRefusal']=='MOCK_REQ_HEADERS_ABSENT_BEFORE_ORDER_SERVICE'
pins={'workbench_draft_integrity.test.js':'7028f2c638fa5fb8cdf92588408050019a382decdd44df4ca75b3d2ef80691f9','workbench_pipeline_twostep.test.js':'b6e7c33e5d522cd9551c186b875672d4571cc445a8da63bd2f2a15c0b3d8ee00','qc_disposition_flagging.test.js':'46557757f86ee32a5152dc7de0cdac2ad6d5e97281958043a4a4e2b7792551a1'}
originals={n:(root/'server/tests/contracts'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
single='workbench_single_entry.test.js';originals[single]=(wp/'issue209-single-entry-refusal-observation-review/workbench_single_entry.test.js.before-original').read_bytes();pins[single]=hashlib.sha256(originals[single]).hexdigest();assert pins[single]=='bcbc290a0cd9d5c07fe0e8fb965d05d97a37a7986757996aa12edbc22b0aa41f'
observations=json.loads((wp/'issue209-single-entry-refusal-observation-review/observation-addition-original.json').read_bytes());diagnostic=(root/'server/tests/contracts'/single).read_bytes();assert hashlib.sha256(diagnostic).hexdigest()==observations[0]['afterSha256']
decisions={'workbench_single_entry.test.js':'Actual closed13/11/2 diagnostic found500 missing mock req.headers before order service; existing ACTIVE revision1/PH+EC lines valid. Add req.headers={} at sole direct updateSampleAnalyses mock site, remove only NEW diagnostic console. Mounted Express route supplies headers; no reachable runtime gap observed. Existing POTASSIUM name/units/request/reason, version2/three-line/supersession, all operational/approval/custody/report/workspace assertions preserved.',
'workbench_draft_integrity.test.js':'Only positive fifth non-draft write gets one legacy NULL PH line for existing canonical+duplicate owners; original same legacy match supports both retained readings. Earlier draft-only zero Results/report exclusion/discard/conflict/KEEP_LOCAL required reason remain orderless and unchanged. Two independent7.25/7.30 retained replicates/policy/no overwrite/versions/basis/purge assertions unchanged. Original null result/zero replicates observed; current execution order preflight source inspected, no unobserved old response code invented.',
'workbench_pipeline_twostep.test.js':'Only positive second commitCompletion gets PH+EC legacy NULL order lines for existing owners before recording. Earlier invalid-number preview remains orderless/unchanged. Original commit success undefined then zero eligible package/receipt failures are source-inferred downstream of refused recording; no old error code fabricated. Original two values/versions/receipt/full submission/bundling/status and recent receipt assertions unchanged.',
'qc_disposition_flagging.test.js':'NEW explicit completed PH owner gets one legacy NULL order before its numerical witness, preserving Batch absent at execution time and all original values/flags/statuses. Pure blank/RPD/recovery and typed failed controls/result invalidation/manager warning restoration assertions unchanged. No new Batch/owner/evidence or runtime changes.'}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in originals:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages']);cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalObservedHeader':m.splitlines()[:8],'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'FIXTURE_ONLY_MISSING_HTTP_HEADERS_OR_NEW_OWNED_POSITIVE_EXECUTION_ORDER_CONTEXT','sourceDecision':decisions[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d missing/partial-order WIs remain reachable zero-write refused with distinct readonly lists/approvednonzeroSTOP. Direct mocked HTTP request missing headers is unreachable at mounted Express route; no application normalization/backfill/relink/amendment order step.'})
assert len(cases)==11
dest.mkdir()
for n,b in originals.items():(dest/(n+'.before-original')).write_bytes(b)
(dest/'single-entry-diagnostic-dispatched-source-original.js').write_bytes(diagnostic)
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':11,'cases':cases,'actualSingleEntryDiagnosticIndex':'issue209-single-entry-refusal-observation-singles/index.json','productionOperations':0},indent=2)+'\n').encode())
proof=[]
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode()
 if n==single:
  anchor='            await sampleController.updateSampleAnalyses(req, res);'
  block='            // #209: this direct controller mock has the headers object supplied by the actual HTTP route.'+newline+'            req.headers = {};'+newline
 else:
  if n=='workbench_draft_integrity.test.js':anchor="    test('5. Non-draft batchSave records determinations into Result and purges draft', async () => {"+newline;codes="['PH']"
  elif n=='workbench_pipeline_twostep.test.js':anchor="    test('2. commitCompletion records determinations, completes items and returns receipt', async () => {"+newline;codes="['PH', 'EC']"
  else:anchor='        // Create result attached to batchId';codes="['PH']"
  block="""        // #209: usable legacy order context only for this NEW owned positive execution assembly.
        require('../../services/workflowStateRules').assertFixtureContext();
        await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: testSampleId,
            version: 1, status: 'ACTIVE', reason: 'Owned workbench/QC execution order context', requestedBy: 'system:fixture',
            lines: { create: CODES.map(analysis => ({ id: require('node:crypto').randomUUID(), analysis,
                workItemId: null, status: 'ACTIVE', isRequired: true })) } } });
""".replace('CODES',codes).replace('\n',newline)
 assert text.count(anchor)==1,(n,anchor)
 modified=text.replace(anchor,anchor+block) if n in ['workbench_draft_integrity.test.js','workbench_pipeline_twostep.test.js'] else text.replace(anchor,block+anchor)
 assert modified.replace(block,'',1).encode()==b,n
 raw=modified.encode();(root/'server/tests/contracts'/n).write_bytes(raw)
 proof.append({'path':'server/tests/contracts/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'newDiagnosticConsoleRemoved':n==single,'additions':[block.replace('\r\n','\n')]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':11,'fixturePaths':4,'oldSourceAndAssertionsRecovered':True,'singleEntryHeaderContextOnly':True,'runtimeChanges':0,'productionOperations':0}))
