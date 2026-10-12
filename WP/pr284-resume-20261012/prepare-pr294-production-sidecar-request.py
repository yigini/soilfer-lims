"""Compose a reviewable request only after the actual retained stopped PASS."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

directory = Path(__file__).resolve().parent
source = '5fa7e65f3d13a04f270e90e0b4b129f8eaf3296e'
export = directory / 'production-source-export-5fa7e65f'
sys.path.insert(0, str(export))
import import_release_contract as release

def api(endpoint):
    raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/' + endpoint])
    return raw, json.loads(raw)

proof_directory = directory / 'completed-proof-144000'
proof_raw = (proof_directory / 'rehearsal-receipt.json').read_bytes()
proof = json.loads(proof_raw); pin = json.loads((proof_directory / 'target-pin.json').read_bytes())
retention = json.loads((proof_directory / 'retention-index.json').read_bytes())
assert retention['unitState']['ActiveState'] == 'inactive' and retention['unitState']['ExecMainStatus'] == '0'
assert proof['status'] == 'PASSED_NEW_IMPORT_NATURAL_KOBO_PROOF'
release.validate_proof(proof, pin)
receipt_sha = hashlib.sha256(proof_raw).hexdigest()
assert receipt_sha == retention['files']['rehearsal-receipt.json']['sha256']
preparation = json.loads((directory / 'production-source-5fa7e65f-preparation.json').read_bytes())
hashes = preparation['sourceHashes']
assert preparation['sourceCommit'] == source and set(hashes) == release.PACKAGE_SOURCE_FILES
assert all(hashlib.sha256((export / name).read_bytes()).hexdigest() == digest for name, digest in hashes.items())
assert {name: hashes[name] for name in release.SOURCE_FILES} == release.REVIEWED_PROOF_FILES
evidence = {}
for label, endpoint in [('main', 'git/ref/heads/main'), ('pr', 'pulls/294'),
    ('application-audit', 'issues/comments/6125341751'), ('proof-source-pass', 'issues/comments/6126765238'),
    ('pr-ci', 'actions/runs/38247731718'), ('main-ci', 'actions/runs/38256676268')]:
    raw, value = api(endpoint); evidence[label] = {'raw': raw, 'value': value}
assert evidence['main']['value']['object']['sha'] == release.CANDIDATE_HEAD
pr = evidence['pr']['value']; assert pr['merged'] and pr['merge_commit_sha'] == release.CANDIDATE_HEAD
assert pr['head']['sha'] == release.AUDITED_PR_HEAD and pr['base']['sha'] == release.MERGE_BASE_HEAD
release.require_pr_review(evidence['application-audit']['value'])
release.source_review_pass(evidence['proof-source-pass']['value'], release.REVIEWED_PROOF_SOURCE, release.REVIEWED_PROOF_FILES)
for label, head in [('pr-ci', release.AUDITED_PR_HEAD), ('main-ci', release.CANDIDATE_HEAD)]:
    value = evidence[label]['value']; assert value['status'] == 'completed' and value['conclusion'] == 'success' and value['head_sha'] == head
pages = json.loads(subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/issues/162/comments?per_page=100', '--paginate', '--slurp']))
assert not any(release.has_failed_verdict(row['body'], True) and row['created_at'] > evidence['proof-source-pass']['value']['created_at'] for page in pages for row in page)
timing = proof['measuredTimingHeadroom']
text = f'''Claudio: NEW separate #200 production-source review request after the actual stopped first-proof PASS.

Exact proposed production source {source}, deploy coordinator {hashes['deploy_import.py']}, release contract {hashes['import_release_contract.py']}. All39 raw source files compile and all185/185 Windows plus185/185 Linux guards pass0failure/error/skip/no production DB access. The only change since the approved201bb proof family is the production contract's actual201bb/6126765238/all31hash binding. Every measured proof byte remains identical. This request grants no execution authority until your correctly bound NEW Source review: PASS; it is separate from the future exact-kit audit and gate.

ONE actual first proof {proof['root']} completed {proof['completedUtc']}, status {proof['status']}; unit inactive/exit0, all owned writers stopped/retained. Immutable original0400 rehearsal receipt SHA256 {receipt_sha}. This is the reviewed144000Z first root, not either failed105200Z/134000Z root. Both failed receipts stay retained and permanently excluded. Original valid build135400Z/image7aebc035/receipt1a983172 was reused unchanged under separate630b/6125544861 authority; no rebuild or retag. The new disabled builder/preparer still refuse before operations.

The proof verified all3 bounded native DRY/APPLY/immediateNO_OP stages, exact104tables38receipts to106tables39receipts empty additive delta/all original rows/schema retained/scientificChanges0, exact-main attributes and emptyWAL/32KiBSHM plus the new detached full installed-state repeat seal. JobsOFF default23NO_OP0/22READY0/31+6zero/full installed preservation, distinct same-image jobsON originalcursor/config/15min interval and two NATURAL scheduler completions, interval+2min/660healthy0restart/peak<=805306368B/blankheap and final full stopped preservation passed. No cursor/interval/timestamp edits or fabricated intake/acceptance. Original acceptance/event/ReviewDecisionNULL/PUBLISHEDreport preserved. All immutable original backups/seals/raw triples retained.

Actual measured timing evidence (not total production wall time): {json.dumps(timing, sort_keys=True)}. All3 CLI and both readiness measurements leave60s each; five measurements plus actual added repeat-seal cost and660s health observation leave at least600s of5400s. Quiesce, backup, other seals, API probes, ingress and coordination costs remain explicitly unmeasured. Production timeout/readiness aborts remain strict.

The ONE future frozen kit has62 fixed files. Freezer independently rechecks original stopped receipt/source/targetpin/build/CLI identities/readonlyrepeat full seal, all original consistent backups/raw triple attributes and first+second full natural preservation, without a new copy/rehearsal. Manifest binds every file plus original reference hashes, source201bb/review6126765238, separate original build authority, actual application audit6125341751/merge959d/parents5dd+5e/tree3362, historical480f receipt and verbatim original YY authority/both workload pins. No prior consumed kit/gate is reused.

Before fresh gate/quiesce: exact unused kit/currentmain959d/all actual green CI/NEW exact primary Audit passed: OK to merge and deploy/no attempt or production receipt, same healthy51f/d4eb predecessor/volumes/environment/0restart, complete source/proof/build/YY hashes and current headroom for16 retained database allocations plus assets/state/logs above10556150894B/scaled floor. Original500MB unexplained-growth abort,10s core-confirmation and both workload pins remain required. Collect only ONE fresh10minute single-use gate when all prerequisites are ready; never early/stale/overwrite/recollect/reuse.

ONE reviewed forward coordinator then #189 maintenance/stopped writers/hashed400 logical backup+raw DB/WAL/SHM/assets seal; ONE new200 native dry/apply/immediate repeat (no historical installer replay), jobsOFF default23NO_OP0/22READY0/31+6zero/full logical seal/readiness600s; reopen ingress BEFORE normal jobs, retain old and jobsOFF containers; same-image jobsON readiness/660 healthy seconds/0restart/768MiB/noheapoverride. After ANY native/default-entrypoint attempt includingNO_OP/failure: hold maintenance/jobs and separately audited forward fix only. Never restoreDB/startolderimage/retryoverride/cleanup/delete/move/prune/heapraise or weaken source/schema/row guards. Independently verify actual deployment and post once; Claudio owns actual postchecks/closure/ticks. Other app merges remain held until#200 live/postchecked.

Please post a NEW primary Source review: PASS with all full binding tokens below if these exact bytes pass. Then I will freeze ONE kit from this original stopped PASS for the separate exact-kit review, fresh gate and forward deployment under YY's standing automatic-after-review go. No additional deployment go needed.

''' + '\n'.join(preparation['requiredReviewTokens']) + '\n'
with (directory / 'production-source-5fa7e65f-request.md').open('x', encoding='utf-8', newline='\n') as output: output.write(text)
for label, row in evidence.items():
    with (directory / ('production-request-5fa7e65f-' + label + '.json')).open('xb') as output: output.write(row['raw'])
record = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourceCommit': source,
    'status': 'REQUEST_PREPARED_FROM_ACTUAL_STOPPED_FIRST_PASS_NOT_POSTED', 'originalProofRoot': proof['root'],
    'proofReceiptSha256': receipt_sha, 'productionOperations': 0, 'actualMeasuredTiming': timing}
with (directory / 'production-request-5fa7e65f-preparation.json').open('x', encoding='utf-8', newline='\n') as output: json.dump(record, output, indent=2)
print(json.dumps(record))
