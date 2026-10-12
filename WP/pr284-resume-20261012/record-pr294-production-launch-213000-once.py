"""Retain the actual single launch and prepend a documentation checkpoint."""
import datetime
import hashlib
import json
from pathlib import Path

d = Path(__file__).resolve().parent
repo = d.parent.parent
names = [
    'pr294-gate-213000-intent.json', 'pr294-gate-213000-result.json',
    'pr294-gate-213000.stdout', 'pr294-gate-213000.stderr',
    'pr294-production-gate-213000.json',
    'pr294-production-launch-213000-intent.json',
    'pr294-production-launch-213000-result.json',
    'pr294-production-launch-213000.stdout',
    'pr294-production-launch-213000.stderr',
    'pr294-held-production-observation-213000-20261012T213217626127Z.json',
]
launch = json.loads((d / names[6]).read_bytes())
assert launch['exitCode'] == 0
assert launch['actualLaunch']['status'] == 'SINGLE_NEW_RELEASE_LAUNCHED_NOT_YET_DEPLOYED'
record = {
    'recordedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'actualLaunch': launch,
    'files': {n: hashlib.sha256((d / n).read_bytes()).hexdigest() for n in names},
    'nativeBoundary': {
        'observation': 'Fresh capture after the actual 21:32:16 unit observation; delivery visually verified before this record.',
        'thread': 'LIMS Audit / Lab workflow audit and plan',
        'actualLaunchMessageVisuallyVerified': True,
        'humanDraftPreserved': True,
        'decisionCardsAnswered': False,
    },
    'status': 'SINGLE_PRODUCTION_UNIT_ACTIVE_NOT_YET_DEPLOYED',
}
with (d / 'pr294-production-launch-213000-checkpoint.json').open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
text = '''PR294 single reviewed 213000 production unit ACTIVE — 2026-10-12T21:32 UTC

Actual exact-kit PASS6132886810 verified; ONE gate fac9e2418ba7376b99e2e57b2e66ad4e66edf3d417bc2b8f083adfb1da56212a collected once, verified21:27:01.413314UTC, completed21:28:00.872354UTC. SAME collector54496 completed0 and must NEVER be restarted/recollected. ONE reviewed launch completed21:32:02.033679UTC, exit0, SINGLE_NEW_RELEASE_LAUNCHED_NOT_YET_DEPLOYED. Launcher82776 completed; no local launch process remains. Gate is now consumed by this execution and must never be replaced/reused.

Observe ONLY /opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z / lims-release-instrument-import-release-959d17e1-20261012t213000z.service. Read-only21:32:16.901366UTC shows active/running, no terminal receipt, no running LIMS container yet. Head959d17e11c357266f7c2a41b0c84ab76914c591e/image7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2/manifest39b054dbc89889493ac02984675ca72e5fc0da1593706a6abcab450ed481b76e/coordinator24479eb79a6bdf9d900321dcbc25f2b15e6aa56c110aaf9028e205a5139d6d6d. Actual native launch boundary sent and visually verified. LIMS maintenance/jobsHOLD until actual reviewed forward process reopens ingress before jobs; no Deployed claim yet. Same writer continues through all guards, terminal receipt, independent verification and actual Claudio handoff. No new human go required.

Original144000PASS/135400build remain sole proof/build authority; all31 proof bytes unchanged. Original202400 unused kit and failed161000 remain untouched/excluded. Never retry/replay/restart/restore/olderimage/installerreplay/cleanup; any failure requires separately audited forward fix. Other application merges held until#200live/postchecked. Both workload pins and all data/disk/memory guards remain in force.

Previous checkpoint follows:

'''
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']:
    path = repo / name
    previous = path.read_text(encoding='utf-8')
    path.write_text(text + previous, encoding='utf-8', newline='\n')
print(json.dumps({'status': record['status'], 'files': names}))
