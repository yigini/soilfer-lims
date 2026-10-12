"""Record the actual single launch and consumed authority without relaunching."""
import datetime
import json
from pathlib import Path

d=Path(__file__).resolve().parent;w=d.parent.parent
launch=json.loads((d/'pr294-production-launch-161000-result.json').read_bytes())
gate=json.loads((d/'pr294-gate-161000-result.json').read_bytes())
review=json.loads((d/'pr294-kit-pass-6131228500-verified.json').read_bytes())
assert launch['exitCode']==gate['exitCode']==0
assert launch['actualLaunch']['gateSha256']==gate['actualGate']['gateSha256']
prefix=f'''PR294 SINGLE forward production deployment ACTIVE {datetime.datetime.now(datetime.timezone.utc).isoformat()}

Actual NEW exact-kit Audit passed: OK to merge and deploy162/6131228500 at19:33:01UTC independently verified all129tokens/current959d/no laterfailure/rawAPI5ce54085a704da7789d21216557a8ae70cc37ffa0f92c5ade46a6140ca0581a4; actual native Claudio approval read. ONE fresh single-use gate collected19:36:06.395171UTC SHA14ddeac6b483c5f67856c4f507049fef4e43e5d4597870b075aebcf648b3b557, exclusive0400 at161000kit. NEVER recollect/overwrite/reuse.

ONE reviewed forward launcher completed19:37:54.492417UTC/exit0; local81549 CLOSED. SAME remoteunit lims-release-instrument-import-release-959d17e1-20261012t161000z.service ACTIVE/running at19:38:37UTC, not completed. Current root /opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z/head959d/image7aeb/frozenmanifest5392; no successful deployment claim yet. NEVER launch/restart/retry/replay/refreeze/another writer. Continue ONLY this SAME unit and read-only observations. Gate consumed/reserved to this attempt and never another.

Read-only19:34:10 healthy original51f/d4eb0restart/HTTPShealth-login200TLS/samevolumes/free73483026432B vs20152477989B including16backupallocations/assets/state/absolute10556150894. All subsequent fresh guards remain enforced. Backup/quiesce/importDRY-APPLY-immediateNO_OP/full10438-to10639preservation/jobsOFFzero/defaultstartup/ingressBEFOREnormaljobs/660healthy observation remain required; no success until actual inactive0/original0400DEPLOYED_NEW_IMPORT_FORWARD receipt then independentread-only verification. AfterANYinstaller/defaultstartupattempt inclNOOP/failure recover only separately audited forwardfix; no restore/olderimage/retry/override/heapraise/cleanup.

Frozen kit and originalstopped144000PASSEDproof/135400validbuild unchanged; failed105200/134000proofs and154640package excludedforever. OriginalPR293 consumedkits/gates/receipts retained. BOTHworkloadpins/allreserve/500MBunexplainedgrowthaborts unchanged. SAMEwriter/humanDocuments/drafts/cards untouched. Under existing YYAutoafterreviewgo, finishactualdeployment thenONCEDeployedSHAUTChealthreceipt162+294+200/nativeClhandoff. Claudio owns actualpostchecks/closure/ticks; otherappmergeshelduntil200liveandpostchecked. No additional YY decision required.

Previous checkpoint follows:

'''
for relative in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=w/relative;p.write_bytes(prefix.encode()+p.read_bytes())
with (d/'pr294-production-launch-161000-checkpoint.json').open('x',encoding='utf-8',newline='\n') as out:
 json.dump({'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualLaunch':launch,'actualGate':gate,'actualKitReview':review,'status':'SAME_SINGLE_REMOTE_PRODUCTION_UNIT_IN_PROGRESS_NOT_DEPLOYED'},out,indent=2)
print('Actual launch checkpoint recorded; no launch executed by this helper')
