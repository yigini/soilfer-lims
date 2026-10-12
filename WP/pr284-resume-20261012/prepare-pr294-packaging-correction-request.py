"""Prepare one new source-review request from actual read-only measurements."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

directory = Path(__file__).resolve().parent
source = 'abceab95b8d68b1b3202df9f4f9fc229d9baa2ae'
preparation = json.loads((directory / 'production-source-abceab95-preparation.json').read_bytes())
assert preparation['sourceCommit'] == source and preparation['all31ProofBytesUnchanged'] is True
assert all(row['exitCode'] == 0 and row['result']['tests'] == 190 for row in preparation['guards'].values())
main_raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main'])
assert json.loads(main_raw)['object']['sha'] == '959d17e11c357266f7c2a41b0c84ab76914c591e'
ci_raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38256676268'])
ci = json.loads(ci_raw)
assert ci['head_sha'] == '959d17e11c357266f7c2a41b0c84ab76914c591e' and ci['conclusion'] == 'success'
measurement = json.loads((directory / 'pr294-packaging-readonly-measurement-1600.result.json').read_bytes())
receipt_sha = measurement['receiptSha256']
table = '\n'.join('| ' + row['stage'] + ' | ' + format(row['elapsedSeconds'], '.6f') + ' |' for row in measurement['stages'])
text = f'''NEW production-source review request: narrow packaging-only timeout/progress correction

The reviewed5fa ONE first package154640Z failed at its300-second read-only verification deadline. Failure#162/6127786378 is retained. No execution kit/destination existed after it, no freezer process remains, and it is permanently excluded. Never rerun5fa or reuse the failed package/root/partialoutputs. Its precise unfinished validation was unlogged; I cannot retrospectively identify which component used the original300seconds.

Exact NEW proposed source {source}. Only export_freeze_import_kit.py and freeze_import.py differ within the39-file packaging graph. All31 measured proof files, production coordinator/contract/gate/launcher, preservation policies, readiness600s, productionunit5400s,60s stage/600s unitheadroom and both workloadpins are byte-identical. No new application change, proof, build, installer or production operation.

Actual read-only validator measurement completed{measurement['completedUtc']} on the SAME original immutable stopped144000Z backups. It did NOT invoke the freezer or create a kit/copy. All six backup bytes/modes/mtime and original receipt were unchanged. All validations equaled the original recorded evidence. Original PASSED receipt: {receipt_sha}.

| Read-only stage | Actual seconds |
| --- | ---: |
{table}

Measured sum {measurement['measuredSeconds']:.9f}s. NEW packaging-only deadline900s = round up to300s of(2*253.819321910+300s explicitly reserved for other authority/hash/live/build/reserve checks). SSH transport960s leaves60s for termination/evidence retention. This is not a production/installer/startup deadline increase and not a measured total-freezer-wall claim. Actual old failed component remains unknown. New per-stage START/PASSED/REFUSED JSON progress flushes immediately into package stdout/stderr files opened exclusively before the child. Timeout kills/waits the child, retains0400 progress/stderr/result with one attempt and no retry. Destination creation remains after all validations. Pure transport tests exercise success, partial-output timeout, nonzero refusal and overwrite refusal.

190/190 Windows and190/190 exact-source Linux guards passed,0fail/error/skip/no productionDB. All39 rawGit files compile. Full proof/default-entrypoint/scientific-row guards unchanged.

After an actual NEW formal Source review: PASS, ONE distinct package and kit are proposed: /opt/lims/releases/instrument-import-package-959d17e1-20261012T161000Z and /opt/lims/releases/instrument-import-release-959d17e1-20261012T161000Z. They may consume ONLY the SAME original stoppedPASS144000Z and unchanged135400Z build/image7aeb. No failed partialoutput reused. Old154640 execution root permanently excluded. Kit must then receive its separate actual exact-kit Audit passed: OK to merge and deploy; only unchanged currenthead/allgreen/unusedkit/headroom ready can collect ONE fresh10minute single-use gate and ONE forwarddeployment under standinggo. No gate collected now.

Original proof source201bb/6126765238, applicationPASS6125341751/currentmain959d, full360/5478 PR+mainCI and original approval bindings stand. Measured productionstage+seal+660health1169.471064s/headroom4230.528936s remains unchanged; other quiesce/backup/seal/API/ingress costs explicitly unmeasured. Both workloadpins,16allocationreserve and500MB unexplained-growth abort unchanged. Old51f/d4eb remains live, no production mutation. Other app merges held until#200live/Clpostchecked.

Please post NEW primary Source review: PASS with the full bindings below for this exact39-file packaging-only correction. This request is not an exact-kit approval or deployment receipt.

''' + '\n'.join(preparation['requiredReviewTokens']) + '\n'
with (directory / 'production-source-abceab95-request.md').open('x', encoding='utf-8', newline='\n') as out: out.write(text)
for name, raw in [('current-main', main_raw), ('main-ci', ci_raw)]:
    with (directory / ('production-request-abceab95-' + name + '.json')).open('xb') as out: out.write(raw)
print(json.dumps({'sourceCommit': source, 'status': 'NEW_REQUEST_PREPARED_NOT_POSTED',
    'requestSha256': hashlib.sha256(text.encode()).hexdigest(), 'productionOperations': 0}))
