"""Record the actual completed freeze once, preserving previous checkpoints."""
import datetime
import hashlib
import json
from pathlib import Path

directory=Path(__file__).resolve().parent
workspace=directory.parent.parent
kit=workspace/'WP/pr284-frozen-kit-20261012T161000Z'
result=json.loads((directory/'pr294-freeze-161000-result.json').read_bytes())
terminal=json.loads((directory/'packaging-terminal-161000/freeze-result.json').read_bytes())
assert result['exitCode']==0 and terminal['status']=='PASSED' and terminal['attemptCount']==1 and not terminal['retried']
actual=result['actualFreeze']
assert hashlib.sha256((kit/'prepared-manifest.json').read_bytes()).hexdigest()==actual['manifestSha256']
prefix=f'''PR294 frozen kit COMPLETE / exact-kit review boundary {datetime.datetime.now(datetime.timezone.utc).isoformat()}

The SAME one-shot freezer session47957 completed exit0 at {result['finishedUtc']}; no active freezer remains. Original retained terminal result PASSED/attemptCount1/retriedfalse/292.064876s within900s. All preservation/authority/hash/live-build/reserve stages passed before destination creation. No repeat/refreeze/rebuild/newproof/production operation occurred.

ONE immutable unused kit {actual['root']},62 frozen files plus manifest, independently re-read with0400 modes and exact rawabce sources. ManifestSHA256 {actual['manifestSha256']}; deploycoord {actual['coordinatorSha256']}; original stopped firstPASSEDproofreceipt {actual['receiptSha256']}; targetpin {actual['targetPinSha256']}. All31 approved201bb proof bytes unchanged; actual NEW packagingSourcePASS6130963561/exactabceab95. Original135400build/image7aeb and144000proof retained unchanged. Failed105200/134000proofs and154640package permanently excluded; never replay/restart/retry/refreeze/cleanup.

Raw62kit files/manifest retained WP/pr284-frozen-kit-20261012T161000Z. Original package freeze.stdout SHAa79aee5c735d7437a12d716b6402b2c4e6a2bdea950ef2e90f51afb18c173ee1 and freeze-result.json SHAeb6f83fca2ac839e8ee1753281a872e8270b904e3da327a0599219518f9c2277 retained WP/pr284-resume-20261012/packaging-terminal-161000. No execution gate/attempt/production receipt exists. Actual NEW exact-kit Audit passed: OK to merge and deploy still REQUIRED; not inferred from source review. SAME writer sends actual kit for review then fresh allgreen/currenthead/unusedkit/headroom, ONE single-use10minute gate and ONE forwarddeployment under existing automatic-after-review go. No extra YY decision required. Claudio owns actual postchecks/closure/ticks. Otherapplicationmerges held until#200live and postchecked. Live old51f/d4eb remains current; no production mutation/card/humancheckout/cleanup.

Previous checkpoint follows:

'''
for relative in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 path=workspace/relative
 previous=path.read_bytes()
 if not previous.startswith(b'PR294 frozen kit COMPLETE / exact-kit review boundary '):
  path.write_bytes(prefix.encode()+previous)
record={'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'freezeResult':result,'terminalResult':terminal,'manifestSha256':actual['manifestSha256'],'productionOperations':0,'kitAuditPending':True}
with (directory/'pr294-frozen-161000-checkpoint.json').open('x',encoding='utf-8',newline='\n') as out: json.dump(record,out,indent=2)
request=kit/'exact-kit-review-request.md'
with request.open('a',encoding='utf-8',newline='\n') as out:
 out.write('''
Actual original package terminal records (immutable0400 on host, retained byte-for-byte):
- freeze.stdout SHA256 a79aee5c735d7437a12d716b6402b2c4e6a2bdea950ef2e90f51afb18c173ee1
- freeze-result.json SHA256 eb6f83fca2ac839e8ee1753281a872e8270b904e3da327a0599219518f9c2277
- Terminal PASSED, returncode0, attemptCount1, retriedfalse, 292.064876094 seconds within900. All per-stage preservation checks passed before destination creation.

Raw kit: https://github.com/yigini/soilfer-lims/tree/audit/release-eb6de2e8/WP/pr284-frozen-kit-20261012T161000Z
Stage log: https://github.com/yigini/soilfer-lims/blob/audit/release-eb6de2e8/WP/pr284-resume-20261012/packaging-terminal-161000/freeze.stdout
Terminal record: https://github.com/yigini/soilfer-lims/blob/audit/release-eb6de2e8/WP/pr284-resume-20261012/packaging-terminal-161000/freeze-result.json
''')
print(json.dumps({'status':'ACTUAL_FROZEN_KIT_CHECKPOINT_RECORDED_NOT_AUDIT_PASSED','manifestSha256':actual['manifestSha256']}))
