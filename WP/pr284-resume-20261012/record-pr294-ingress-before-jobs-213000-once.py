"""Retain an actual mid-run boundary; no release action or completion claim."""
import datetime
import hashlib
import json
from pathlib import Path

d=Path(__file__).resolve().parent
path=max(d.glob('pr294-held-production-observation-213000-*.json'))
raw=path.read_bytes();observation=json.loads(raw)
assert observation['unitState']['ActiveState']=='active'
assert observation['receipt']['status']=='IMPORT_FORWARD_IN_PROGRESS'
times=observation['receipt']['timesUtc']
assert 'ingressReopenedBeforeJobs' in times and 'completed' not in times
record={'recordedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observationFile':path.name,'observationSha256':hashlib.sha256(raw).hexdigest(),'observation':observation,'status':'SAME_PRODUCTION_UNIT_ACTIVE_AFTER_JOBS_OFF_PASS_NOT_COMPLETED','nativeMigrationBoundaryVisuallyDelivered':True,'nativeClaudioActualPostcheckClaimed':False}
with (d/'pr294-ingress-before-jobs-213000-checkpoint.json').open('x',encoding='utf-8',newline='\n') as out:json.dump(record,out,indent=2)
note=f'''PR294 SAME213000 deployment ACTIVE after migration/jobsOFF preservation PASS — {observation['observedUtc']}

ONE reviewed unit remains active/running, IMPORT_FORWARD_IN_PROGRESS; NEVER restart/replay/recollect/retry. All3CLI succeeded: DRY0/APPLY1/NO_OP0, 0restart/OOMfalse/blankheap/maximum106627072B. Full native delta and immediate repeat preservation passed {times['nativeImportDeltaAndImmediateRepeatPassed']}. Candidate jobsOFF readiness112.605671s/0restart/noOOM. JobsOFF full preservation/31checks+6probes passed {times['jobsOffPreservationAndProbesPassed']}. Ingress health/login200/deniedPOST401 passed and normal ingress restored BEFORE jobs at {times['ingressReopenedBeforeJobs']}. The process has stopped its jobsOFF container to seal full stopped logical state, then will start the distinct same-image final jobsON container. Current observation has no running LIMS name during that reviewed transition; do not claim currently healthy/live/completed from the earlier200 probes. Final jobsON readiness/startup/660healthy seconds/terminal0400receipt/independent verification remain required. No further YY decision; original automatic-after-review go applies.

Gatefac9e241 consumed/kitPASS6132886810/source92e32PASS6132712806/currentapp959d/image7aeb/manifest39b054/coordinator24479 unchanged. Actual native migration boundary delivered, Claudio waits for actual completed receipt and independent verification. Sole144000PASS/135400build and all original evidence retained,161000failed/202400superseded excluded. Any failure is forwardfix only; no restore/olderimage/installerreplay/cleanup. Other application merges remain held until#200live/Clpostchecked.

Previous checkpoint follows:

'''
for name in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=d.parent.parent/name;p.write_text(note+p.read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
print(json.dumps({'status':record['status'],'observedUtc':observation['observedUtc']}))
