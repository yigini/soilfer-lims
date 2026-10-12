"""Prepare a reviewable handoff only from the actual completed and verified release."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

d=Path(__file__).resolve().parent
destination=d/'completed-production-213000'
receipt_raw=(destination/'production-receipt.json').read_bytes()
receipt=json.loads(receipt_raw)
verified=json.loads((d/'completed-production-213000-independent-verification.json').read_bytes())
assert receipt['status']=='DEPLOYED_NEW_IMPORT_FORWARD'
assert verified['status']=='INDEPENDENT_READ_ONLY_IMPORT_POST_DEPLOY_PASS'
assert verified['receiptSha256']==hashlib.sha256(receipt_raw).hexdigest()
assert verified['head']==receipt['head']=='959d17e11c357266f7c2a41b0c84ab76914c591e'
assert verified['image']==receipt['image']=='sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2'
assert verified['restartCount']==0 and verified['jobsEnabled'] is True and verified['exactImportDeltaRecomputed'] is True
measurements=receipt['nativeImportInstallation']['measurements']
assert len(measurements)==3 and all(row['exitCode']==0 for row in measurements)
summary={
 'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'completedUtc':receipt['timesUtc']['completed'],
 'head':receipt['head'],'image':receipt['image'],
 'root':verified['root'],'receiptSha256':verified['receiptSha256'],
 'manifestSha256':verified['manifestSha256'],
 'coordinatorSha256':receipt['coordinatorSha256'],
 'productionGateSha256':receipt['productionGateSha256'],
 'exactKitReviewId':6132886810,'productionSourceReviewId':6132712806,
 'independentVerificationUtc':verified['observedUtc'],
 'status':'DEPLOYED_AND_INDEPENDENTLY_VERIFIED_AWAITING_ACTUAL_CLAUDIO_POSTCHECK',
 'cliMeasurements':measurements,
 'healthyObservationSeconds':verified['healthObservationElapsedSeconds'],
 'healthSamples':verified['healthSamples'],'peakBytes':verified['peakBytes'],
 'freeBytes':verified['freeBytes'],'requiredIncludingAllocationBytes':verified['requiredIncludingAllocationBytes'],
 'allOriginal104Tables38ReceiptsPreserved':True,
 'additiveInstalledState':'106 tables / 39 receipts, empty import tables and no analytical backfill',
 'fullDataPreservationRecomputed':True,'allFrozenBytesUnchanged':True,
 'nativeClaudioPostcheckClaimed':False,
}
with (d/'pr294-completed-deployment-213000-checkpoint.json').open('x',encoding='utf-8',newline='\n') as out:json.dump(summary,out,indent=2)
repo=d.parent.parent
note=f'''PR294 / #200 forward deployment COMPLETE; independent checks PASSED

Application {receipt['head']} / image {receipt['image']} completed at {receipt['timesUtc']['completed']} in the ONE213000 unit, inactive/exit0. Original immutable0400 receipt {verified['receiptSha256']}; manifest {verified['manifestSha256']}; coordinator {receipt['coordinatorSha256']}. Exact-kit PASS6132886810/source PASS6132712806 and single consumed gate {receipt['productionGateSha256']} remain bound. Never replay/restart/recollect/retry/restore/olderimage/installerreplay/cleanup this release or any historical root.

Independent read-only verification PASSED at {verified['observedUtc']}: exact image/revision, same lims_lims-data+lims_lims-assets, healthy/0restarts/noOOM/768MiB/blank heap/jobsON/autopush-autoseedfalse, verifiedTLS health/login200 and unauthorized receiptPOST401. Full104originaltables/38receipts/rows/schema preserved;106tables/39receipts with only approved empty additive import tables/one schema receipt/no scientific changes/backfill. DRY0/APPLY1/immediate NO_OP0 and full detached repeat equality; both defaultstartups23NO_OP0/22READY0/31+6probes zero changes before jobs. Original backups/rawtriples/modes and all67 frozen files unchanged. Ingress reopened BEFORE jobs. Healthy observation {verified['healthObservationElapsedSeconds']:.6f}s/{verified['healthSamples']}samples/peak{verified['peakBytes']}B. Free{min(verified['freeBytes'].values())}B vs required{verified['requiredIncludingAllocationBytes']}B including16retainedDBallocations/assets/logs. Historical acceptance/event/ReviewDecisionNULL/PUBLISHEDreport retained. Production is live; actual Claudio postcheck/closure/ticks remain pending. Same writer sends the concrete receipt and independent evidence on162294200 once, then native handoff; never invent Claudio verification or close for him.

Previous checkpoint follows:

'''
for name in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=repo/name;p.write_text(note+p.read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
print(json.dumps(summary))
