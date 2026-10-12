"""Checkpoint original immutable failure and read-only held-state evidence once."""
import datetime
import json
from pathlib import Path

d=Path(__file__).resolve().parent;w=d.parent.parent
v=json.loads((d/'failed-production-161000/read-only-failure-verification.json').read_bytes())
assert v['originalPhysicalTripleUnchanged'] and v['originalStoppedBackupHashUnchanged'] and v['noApplyOrRepeatArtifacts']
prefix=f'''PR294 production FAILED / forward-only maintenance hold {datetime.datetime.now(datetime.timezone.utc).isoformat()}

The ONE reviewed161000Z production unit FAILED/exit1 at2026-10-12T19:43:21.598020UTC. Original0400 receiptSHA2562a03e66071406c58b754d9c63ed8200373c55a0433c2d1ad1cbdc2836d72499e/statusFAILED_IMPORT_FORWARD_HOLD. Unit is failed/stopped, no active production writer. Root161000 and consumedgate14ddeac6 permanently excluded; NEVER replay/restart/retry/recollect/refreeze/resume/reusepartialoutputs. LIMS ingress maintenance and jobs HOLD, old51f/d4eb remainsSTOPPED; HTTPShealth/login503.

Actual error: FileExistsError import-dry-copy-authority.json, already an immutable frozen proof artifact. Native stage completed its separate DRY then refused exclusive creation BEFORE APPLY. Actual independentread-only19:45:07: DRYexit0totalChanges0, noAPPLY/repeat/defaultstartup artifacts; alloriginalDB/WAL/SHM physicalbytes+attributes EXACTLY matchoriginalstoppedseal, backuphashunchanged; allwritersstopped/heldingress/all62frozenfiles/original144000PASSunchanged. No liveSQLiteconnections or mutationbyverifier. Original failedreceipt/unitjournal/dryCLIcontainer/output/stoppedsealrawauthority retained WP/pr284-resume-20261012/failed-production-161000; source/build/backups untouched. Do not claim a successful deployment or postDeployedcomments.

FailurepostedONCE162/6131429200 at19:45:48UTC and nativeClaudiodelivery visuallyverified. Separately reviewed forwardfix REQUIRED; existingSource/kitPASS cannot authorize changedsource. Proposed distinctproductionartifactnamespace plus exhaustivegeneratedpath/frozenpath audit and explicitreceipt/verifierreaders, all31 originalproofbytes/migration/schema/row/heap/disk/timing policies unchanged. Recovery entry must independentlybind actualheldstopped51f/rawtriples/backup/heldingress underNEWauditedauthority, no olderimage/restore/retryof161000root/installerreplay/cleanup. Claudio scope/verdict pending; SAMEwriter continues independentpathinventory/sourcepreparation thenactualNEWsourcePASS/ONEdistinctkit/exactaudit/freshsingleusegate/forwarddeploy/handoff. OtherappmergesHELDuntil200liveandClactualpostchecked. Original failedproof105200/134000/package154640/completedPR293 remainsretained/excluded. HumanDocuments/drafts/YYcards untouched. Existinggo/BOTHworkloadpins/absolute-scaledreserve500MBunexplainedabort unchanged.

Previous checkpoint follows:

'''
for relative in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=w/relative;p.write_bytes(prefix.encode()+p.read_bytes())
with (d/'pr294-failed-production-161000-checkpoint.json').open('x',encoding='utf-8',newline='\n') as out:json.dump(v,out,indent=2)
print('Actual failed production and verified held originals checkpointed; no host mutation')
