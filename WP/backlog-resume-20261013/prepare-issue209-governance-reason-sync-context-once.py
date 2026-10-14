"""Classify five original governance failures before request/order fixture additions, once."""
import datetime, hashlib, json, re, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'issue209-governance-reason-sync-context-review'
assert not dest.exists() and (wp/'issue209-workbench-request-order-retention-bound-context-singles/index.json').exists()
pins={'audit_1_1_reconcile_duplicates.test.js':'eb977dbffd3f0b10360c16e71ab3d6072368acac4da98c1b84a05072f2efa681',
'sample_detail.test.js':'7acf27e33ec67871d95add7236f3532c6be687a4c751093b53325e81c906be94',
'interim_gaps_verification.test.js':'8df929edd09a529d6c6b8ee55d48f2776b3fbdb3ebfdba3f6f5b56f8558fe847',
'reopened_governance_scenarios.test.js':'e532b588e1ec04a8db01d9600e8947290625cf888b36370c1bcec3c5ecebe237'}
originals={n:(root/'server/tests/contracts'/n).read_bytes() for n in pins}
for n,b in originals.items():assert hashlib.sha256(b).hexdigest()==pins[n],n
decisions={
'audit_1_1_reconcile_duplicates.test.js':'Only positive unrelated unstarted CEC removal request lacks mandatory reason. Add reason input to original full PH_H2O/SOC target; ordinary orderService reconciles and creates revision in one TX. No initial order fixture needed. Preserve duplicate SOC rows, four duplicate removal zero-write refusals, injected FK/audit rollback and cold catalogue transaction guards.',
'sample_detail.test.js':'Only requests3.1 unstarted OC removal and3.4 recorded EC removal lack mandatory reason. Add explicit reason at these two input sites. Preserve3.2 deliberate missing-reason400; reasoned3.3 creates usable EC order before existing numerical witness so no additional order. Keep recorded-owner409, all scopes/preparation/waiver/approval and zero-write assertions.',
'interim_gaps_verification.test.js':'Only positive COMPLETE_WORK numerical witness receives one declared legacy NULL order with exact two existing analytical owners PH_H2O/SPEC_MIR; exclude operational DRYING. Original observed REJECTED vs APPLIED, no old refusal code captured. Current sync canonical execution/resolveOrderLine source explains missing-order preflight; this is a new manually assembled fixture equivalent to successful current intake. Earlier draft/replay/operational/spectral/unassigned refusal cases remain orderless. Value6.85/basis/author/RECORDED/completed item/canonical receipt unchanged.',
'reopened_governance_scenarios.test.js':'Only positive grouped TEXTURE closure receives legacy NULL order with three existing analytical owners PH_H2O/SPEC_MIR/TEXTURE; no new fraction owners. Original REJECTED vs APPLIED/SUCCESS, no old refusal code captured. Existing matching TEXTURE line supports canonical one-attempt four-results writer. Earlier invalid90percent closure and custom-spectral scalar refusals remain orderless. Original40/40/20, exact four IDs/one attempt/author and all outbox/lease/scope/assignment/broadcast guards unchanged.'}
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());cases=[]
for s in report['testResults']:
 n=Path(s['name']).name
 if n not in originals:continue
 for c in s['assertionResults']:
  if c['status']!='failed':continue
  m='\n'.join(c['failureMessages']);cases.append({'suite':n,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalObservedHeader':m.splitlines()[:8],'originalCaseLineNumbers':re.findall(re.escape(n)+r':(\d+):',m),'classification':'FIXTURE_ONLY_MISSING_MANDATORY_REASON_OR_NEW_POSITIVE_EXECUTION_ORDER_CONTEXT','sourceDecision':decisions[n],'assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d caught initial-order failures can retain missing/partial-order WorkItems. Current normal intake creates initial order and rolls back initial order failures. Legacy runtime orphans remain zero-write refused, readonly cause/sample lists and approved nonzeroSTOP; no normalization/backfill/relink/amendment-side order step.'})
assert len(cases)==5
dest.mkdir()
for n,b in originals.items():(dest/(n+'.before-original')).write_bytes(b)
runtime=['server/services/orderRevisionContract.js','server/services/orderService.js','server/services/orderLineResolutionService.js','server/services/syncService.js']
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':5,'cases':cases,'runtimeSourceSha256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in runtime},'changedLegacyExpectations':0,'productionOperations':0},indent=2)+'\n').encode())
proof=[]
for n,b in originals.items():
 newline='\r\n' if b'\r\n' in b else '\n';text=b.decode();additions=[]
 if n=='audit_1_1_reconcile_duplicates.test.js':
  anchor=".send({ analyses: ['PH_H2O', 'SOC']";added=", reason: 'Reviewed removal of unrelated unstarted CEC'"
  assert text.count(anchor)==1; text=text.replace(anchor,anchor+added,1);additions.append(added)
 elif n=='sample_detail.test.js':
  for anchor,added in [("analyses: ['PH_H2O', 'EC_1_5']",", reason: 'Reviewed removal of unstarted OC'"),("analyses: [] // Attempt to remove EC_1_5",", reason: 'Reviewed recorded EC removal refusal'")]:
   assert text.count(anchor)==1
   if ' //' in anchor:text=text.replace(anchor,anchor.replace(' //',added+' //'),1)
   else:text=text.replace(anchor,anchor+added,1)
   additions.append(added)
 else:
  if n=='interim_gaps_verification.test.js':
   anchor="        test('COMPLETE_WORK creates canonical Result and WorkAttempt records in transaction', async () => {"+newline;sample='testSample.id';codes="['PH_H2O', 'SPEC_MIR']"
  else:
   anchor="        test('COMPLETE_WORK on grouped texture with valid closure atomically writes SAND, SILT, CLAY, and TEXTURE results', async () => {"+newline;sample='sampleA.id';codes="['PH_H2O', 'SPEC_MIR', 'TEXTURE']"
  added="""            // #209: declared legacy order only for this NEW owned positive sync execution assembly.
            require('../../services/workflowStateRules').assertFixtureContext();
            await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: SAMPLE,
                version: 1, status: 'ACTIVE', reason: 'Owned positive canonical sync order context', requestedBy: 'system:fixture',
                lines: { create: CODES.map(analysis => ({ id: require('node:crypto').randomUUID(), analysis,
                    workItemId: null, status: 'ACTIVE', isRequired: true })) } } });
""".replace('SAMPLE',sample).replace('CODES',codes).replace('\n',newline)
  assert text.count(anchor)==1;text=text.replace(anchor,anchor+added,1);additions.append(added)
 recovered=text
 for added in reversed(additions):assert recovered.count(added)==1;recovered=recovered.replace(added,'',1)
 assert recovered.encode()==b,n
 raw=text.encode();(root/'server/tests/contracts'/n).write_bytes(raw)
 proof.append({'path':'server/tests/contracts/'+n,'beforeSha256':pins[n],'afterSha256':hashlib.sha256(raw).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':[a.replace('\r\n','\n') for a in additions]})
(dest/'fixture-additions-original.json').write_bytes((json.dumps(proof,indent=2)+'\n').encode())
runner=(wp/'verify-issue209-workbench-request-order-retention-bound-singles-once.py').read_text(encoding='utf8')
runner=runner.replace('issue209-workbench-request-order-retention-bound-context','issue209-governance-reason-sync-context')
runner=runner.replace("['contracts/workbench_single_entry.test.js','contracts/workbench_draft_integrity.test.js','contracts/workbench_pipeline_twostep.test.js','contracts/qc_disposition_flagging.test.js'","['contracts/audit_1_1_reconcile_duplicates.test.js','contracts/sample_detail.test.js','contracts/interim_gaps_verification.test.js','contracts/reopened_governance_scenarios.test.js'")
runner=runner.replace('plannedTests==343','plannedTests==365')
runner=runner.replace("assert not dest.exists() and not os.environ.get('NODE_OPTIONS')","assert not dest.exists() and not os.environ.get('NODE_OPTIONS')\nassert (wp/'issue209-workbench-request-order-retention-bound-context-singles/index.json').exists()")
for p in re.findall(r"\(wp/'([^']+)'\)\.exists\(\)",runner):assert (wp/p).exists(),p
target=wp/'verify-issue209-governance-reason-sync-context-singles-once.py';assert not target.exists();target.write_bytes(runner.encode())
print(json.dumps({'classifiedOriginalCases':5,'fixturePaths':4,'oldSourceAndAssertionsRecovered':True,'expectedTests':365,'runtimeChanges':0,'productionOperations':0}))
