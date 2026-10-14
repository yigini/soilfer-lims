"""Create a new source-only batch authority draft; no production connection or operation."""
import datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=root/'WP/batch-release-cde8-20261014'
head='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
tree='638580d50f61254609de3abd42d93afc676a5727'
predecessor='959d17e11c357266f7c2a41b0c84ab76914c591e'
audit_before='194b8dfc89940502a480d20b4e18714925c5d5b0'
releases=[(206,295,'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','6d750914d8565acdd496767a7dd935811b5a89b2',6146939836),
    (214,296,'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8',6163165778),
    (209,297,'6bd516c42a07332d0b0653ed150d1526bf7e424e',head,6178123314)]
def command(*args):return subprocess.check_output(args,cwd=root)
def git(*args):return command('git',*args).decode('utf-8').strip()
def blob(rev,path):
    entry=command('git','ls-tree','-z',rev,'--',path).split(b'\t',1)[0].split()
    assert len(entry)==3 and entry[1]==b'blob',path
    return command('git','cat-file','blob',entry[2].decode())
assert not dest.exists(),'Source draft boundary consumed; never replay.'
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
assert git('rev-parse','HEAD')==audit_before and git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit_before
ci_dir=wp/'pr297-main-ci-38636615469-closed-terminal';ci_pin=json.loads((ci_dir/'index.json').read_bytes())
assert ci_pin['status']=='CLOSED_SUCCESS' and ci_pin['head']==head and ci_pin['exactFullInventoryMatch']
for n,d in ci_pin['files'].items():assert hashlib.sha256(blob(audit_before,(ci_dir/n).relative_to(root).as_posix())).hexdigest()==d['sha256'],n
raw={}
def retain(name,*args):
    d=command('gh',*args);raw[name]=d;return json.loads(d)
main=retain('main-original.json','api','repos/yigini/soilfer-lims/git/ref/heads/main');assert main['object']['sha']==head
main_ci=retain('main-ci-original.json','api','repos/yigini/soilfer-lims/actions/runs/38636615469')
assert main_ci['head_sha']==head and main_ci['run_attempt']==1 and main_ci['event']=='push' and main_ci['status']=='completed' and main_ci['conclusion']=='success'
previous=predecessor;bindings=[]
for issue,number,source,merged,verdict_id in releases:
    pr=retain(f'pr{number}-original.json','api',f'repos/yigini/soilfer-lims/pulls/{number}')
    assert pr['merged'] and pr['merge_commit_sha']==merged and pr['head']['sha']==source
    commit=retain(f'pr{number}-merge-commit-original.json','api','repos/yigini/soilfer-lims/git/commits/'+merged)
    assert [v['sha'] for v in commit['parents']]==[previous,source]
    verdict=retain(f'pr{number}-actual-pass-original.json','api',f'repos/yigini/soilfer-lims/issues/comments/{verdict_id}')
    assert verdict['body'].startswith('Audit passed: OK to merge and deploy') and source in verdict['body'] and verdict['performed_via_github_app']['slug']=='claude'
    issue_row=retain(f'issue{issue}-original.json','api',f'repos/yigini/soilfer-lims/issues/{issue}');assert issue_row['state']=='open'
    view=retain(f'pr{number}-closing-refs-original.json','pr','view',str(number),'--repo','yigini/soilfer-lims','--json','closingIssuesReferences');assert view['closingIssuesReferences']==[]
    bindings.append({'issue':issue,'pr':number,'sourceHead':source,'merge':merged,'mergeBase':previous,'tree':commit['tree']['sha'],'actualAuditCommentId':verdict_id,'actualAuditUrl':verdict['html_url']})
    previous=merged
assert previous==head and commit['tree']['sha']==tree
predecessor_file=root/'WP/pr284-resume-20261012/completed-production-213000/production-receipt.json'
receipt=predecessor_file.read_bytes();receipt_sha=hashlib.sha256(receipt).hexdigest()
assert receipt_sha=='03e3309714cadd956e13e9b34576ed774f1e56c482fdc2b07a828a52c1fcb953'
prior=json.loads(receipt);assert prior['status']=='DEPLOYED_NEW_IMPORT_FORWARD' and prior['head']==predecessor
raw['immutable-predecessor-receipt.json']=receipt
batching=retain('actual-batching-direction-6141144901.json','api','repos/yigini/soilfer-lims/issues/comments/6141144901')
assert 'one exact-kit audit, one fresh gate and one forward deploy' in batching['body']
owned_paths=['docker-entrypoint.sh','Dockerfile','server/package.json','server/package-lock.json','server/prisma/schema.prisma',
    'server/scripts/install_sample_containers.js','server/scripts/install_lab_policy_schema.js','server/scripts/install_control_charts.js','server/scripts/install_order_revisions.js',
    'server/scripts/order_revision_impact.js','server/scripts/control_chart_prebinding_impact.js',
    'server/services/sampleContainerMigrationSource.js','server/services/labPolicyMigrationSource.js','server/services/controlChartMigrationSource.js','server/services/orderRevisionMigrationSource.js',
    'server/prisma/migrations/20261013000100_sample_containers/migration.sql','server/prisma/migrations/20261013000200_control_charts/migration.sql',
    'server/prisma/migrations/20261014000100_order_revision_contract/migration.sql','docs/audit/206-containers-aliquots.md','docs/audit/214-control-charts.md','docs/audit/209-order-revisions.md']
source_index={}
for p in owned_paths:
    d=blob(head,p);source_index[p]={'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()}
authority={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'DRAFT_BATCH_SOURCE_AUTHORITY_NOT_A_KIT',
    'candidateHead':head,'candidateTree':tree,'issues':[206,214,209],'sourceAudits':bindings,'mainCi':38636615469,
    'closedMainCiEvidenceAudit':audit_before,'exactJestSummary':ci_pin['exactJestSummary'],
    'predecessor':{'head':predecessor,'image':prior['image'],'completedReceiptSha256':receipt_sha,'historicalReceiptIsBaselineEvidenceOnly':True,
        'freshLiveBaselineVerified':False,'expectedPriorTableCountFromReceipt':106,'expectedPriorReceiptCountFromReceipt':39},
    'candidateOwnedSourceIndex':source_index,
    'intendedNativeDelta':{'newEmptyTables':['SampleContainer','ContainerSequence','ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution'],
        'newNullableScalar':'OrderLine.workItemId','schemaReceipts':['206_sample_containers','214_control_charts','209_order_revision_contract'],
        'expectedInstalledTableCountIfFreshBaselineMatchesReceipt':112,'expectedInstalledReceiptCountIfFreshBaselineMatchesReceipt':42,
        'allOriginalColumnsRowsSchemasObjectsScientificRecordsPoliciesOverridesReportsAndReceiptsPreserved':True,'analyticalBackfill':0,'historicalOrderRelinking':0},
    'policyPrerequisite':'Actual production PRESENT/NO_OP0 on a retained snapshot; anything else STOP before apply, no normalization/preset rows.',
    'impactPlan':{'access':'RETAINED_RAW_PRODUCTION_DB_WAL_SHM_COPY_ONLY','originalSQLiteConnections':0,'originalTripleBeforeAfterEqual':True,
        'orderImpactRequires214Complete':'If the production snapshot is PRE_214, use only a NEW owned candidate copy under the reviewed dry/apply/repeat proof; retain the original copy and all unchanged historical rows. Never install onto production for impact collection.',
        'chartContextCount':'Use actual policyService/qcRuleService via injected readonly reader on the retained snapshot.',
        'required209Lists':['noActiveRevisionWorkItems','noMatchingLineWorkItems','multipleActive','incompleteTextureOwners','refusedOpenWorkItems','continuingReservedOpenWorkItems','ambiguousOpenReservations','prospectiveApprovedAmendmentRefusals','invalidStoredAnalyses'],
        'invalidStoredAnalysisSampleCountRequired':True,'nonzeroListsShownToYY':True,'approvedNonzero':'STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED; separate Claudio-reviewed forward remedy'},
    'guards':{'labAndHubBuildsOwnedByYY':True,'releaseWindowControl':'RELEASE_DAY_DISK_ABORTS_ACCEPTED','memoryBytes':805306368,'nodeOptions':'',
        'reserveFloorBytes':10556150894,'retainedSnapshotAllocationAccountingRequired':True,'unexplainedGrowthAbortBytes':500000000,
        'readinessTimeoutSeconds':600,'productionUnitTimeoutSeconds':5400,'minimumMeasuredStageHeadroomSeconds':60,'minimumMeasuredUnitHeadroomSeconds':600,
        'freshGateMaximumAgeSeconds':600,'recovery':'SEPARATELY_AUDITED_FORWARD_FIX_ONLY','historicalRootsGatesProofsBackupsImagesNeverReplayed':True},
    'pending':{'newBuildProofCoordinatorSourceReview':None,'newOneTimeBuild':None,'newStoppedProductionCopyProof':None,'actualProductionImpactLists':None,'frozenExactKit':None,'actualExactKitAudit':None,'freshSingleUseGate':None},
    'executionAuthority':None,'productionConnections':0,'productionCountsCollected':False,'productionOperations':0,'newBuilds':0,'newProofs':0}
dest.mkdir()
for n,d in raw.items():(dest/n).write_bytes(d)
(dest/'release-authority-draft.json').write_bytes((json.dumps(authority,indent=2)+'\n').encode())
readme='''# Batch source authority preparation for #206, #214 and #209

The three source audits, merges, and main CI are complete. This directory starts a new release authority for candidate `cde8c889`; it contains no kit or execution permission. All pending build, proof, impact, exact-kit review and gate bindings remain empty in `release-authority-draft.json`.

The completed #200 receipt identifies the predecessor only. Its build, proof, kit, gates and production helpers stay consumed. New helper source must bind a healthy current predecessor, the three actual source audits, one new candidate build, one new stopped production-copy proof, exact frozen kit and one fresh single-use gate. The previous held-entry path cannot be reused.

The candidate adds two container tables, four chart tables and nullable `OrderLine.workItemId`, with three schema receipts and no historical data backfill. Counts 106/39 to 112/42 are prospective checks derived from the predecessor receipt and source; they are not fresh production observations.

Before any production apply, require policy PRESENT/NO_OP0 or STOP. Collect chart and order impacts only on retained copies with original DB/WAL/SHM preserved and every allocation measured. The order owner requires COMPLETE_214, so a PRE_214 original must remain immutable while only a separate owned proof copy receives reviewed candidate installers. Print all required cause/sample/owner lists and `invalidStoredAnalysisSampleCount`; show nonzero lists to YY. Approved-amendment impact nonzero is STOP and requires a separate Claudio-reviewed forward remedy.

Next: complete the new source graph, installer-chain preservation validators and source-bound build/proof/kit coordinator, verify its refusal paths locally, and submit that concrete source for Claudio's review before launching a new build or production-copy proof. No production connection, count collection, image build, proof, kit freeze, gate or deployment has occurred here.
'''
(dest/'README.md').write_text(readme,encoding='utf-8',newline='\n')
record={'preparedUtc':authority['preparedUtc'],'status':authority['status'],'candidateHead':head,'tree':tree,'files':{}}
for p in dest.iterdir():d=p.read_bytes();record['files'][p.name]={'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()}
(dest/'preparation-index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'## 2026-10-14 batch206214209 new source authority preparation\n\nMainCI38636615469 CLOSED SUCCESS21:34:24UTC on exact{head},370/5649/allinventory/all realDocker/preservation retained194b8dfc89940502a480d20b4e18714925c5d5b0. New local source-only authority draft at WP/batch-release-cde8-20261014/release-authority-draft.json binds all3 actual audits/merge chain/currentmain and immutable predecessor #200 receipt, and pins candidate installer/collector source. This is NOT a kit; new build/proof/coordinator source review and every execution binding remain EMPTY. No production connections/counts/build/proof/kit/gate/deployment. Existing held-entry/source kits remain consumed; new normal-healthy predecessor authority must be prepared. Prospective106/39→112/42 is source/receipt-derived only, not fresh production counts. Need actual policyPRESENTNO_OP0orSTOP, retained-copy214/209lists/invalidStoredAnalysisSampleCount/disk/YYnonzero/approvedSTOP, Cl exact-kit review/fresh gate. Same writer/branch; all human drafts/cards/history untouched.\n\n'
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for rel in readmes:p=root/rel;p.write_bytes(lead.encode()+p.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[Path(__file__).relative_to(root).as_posix()]+readmes
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').splitlines())==set(owned)
git('commit','-m','Prepare new batch206214209 source authority after green main CI')
audit=git('rev-parse','HEAD')
for p,d in pins.items():assert hashlib.sha256(blob(audit,p)).hexdigest()==d,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit
print(json.dumps({'status':record['status'],'audit':audit,'verifiedBlobs':len(pins),'productionOperations':0,'pendingNewSourceReview':True}))
