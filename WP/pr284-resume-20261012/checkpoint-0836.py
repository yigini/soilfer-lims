import datetime
import hashlib
import json
import pathlib

root = pathlib.Path(__file__).resolve().parents[2]
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
head = 'c26591698c1e974a3bf771e5c333578755aef315'
note = ('PR284 final-head checkpoint ' + stamp + ': existing DRAFT fast-forwarded to ' + head +
    '/tree9b3b77496c3aa2cdad7c7594a0b258ec4b491753. Both out-of-scope SPA/download hunks restored exactly to217a; pinned mismatch HTTP409 preview/commit, direct+QC dilution10, input-only QC whole-file refusal and revision/unit zero-write tests added. Focused8/8suites146/146PASS. Intermediate36ee full360/360suites5466/5466tests1839.261s and exactCI38218977639 SUCCESS including both actual Docker gates; raw evidence retained, not final-head approval. FINAL full unfiltered360-suite local SAMEsession61602 and exactCI38224227228 IN_PROGRESS. Verified listTests inventory matches all360actualfiles; normal hooks/closed fixture identities retained. Local-only resolver addresses two unchanged delivery files through R: SAME physical checkout alias, no app change/new checkout/worktree/writer. Native final-head boundary delivered and Claudio actually acknowledged starting his own final c265 run, audit after actual CI completion. NEW proposed detached sealing source02c93ec199e0de0e6a7cc9aa078e2d08cc2ad4bc passes86/86 Windows+Linux guards,0failure/error/skip/no production DB access. Full new coordinator/layout/source authority preparation continues; no source pass/build/proof/kit/gate/production mutation/cleanup/cards. Completed PR293 remains untouched.\n\nPrevious checkpoint follows:\n\n')
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_text(note + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
record = {'updatedUtc': stamp, 'appHead': head, 'appTree': '9b3b77496c3aa2cdad7c7594a0b258ec4b491753',
    'status': 'FINAL_FULL_AND_CI_IN_PROGRESS', 'localSession': 61602, 'ciRun': 38224227228,
    'focusedSuites': 8, 'focusedTests': 146, 'intermediateFullSuites': 360, 'intermediateFullTests': 5466,
    'intermediateCiRun': 38218977639, 'intermediateCiStatus': 'SUCCESS',
    'draft': True, 'nativeFinalBoundaryDelivered': True, 'sourceAdapterCommit': '02c93ec199e0de0e6a7cc9aa078e2d08cc2ad4bc',
    'proposedWindowsGuards': 86, 'proposedLinuxGuards': 86, 'productionMutations': 0}
record['evidenceHashes'] = {str(path.relative_to(root)).replace('\\', '/'): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in (root / 'WP/pr284-resume-20261012').glob('*') if path.is_file() and path.name in [
    'ci-36ee7617-success.log', 'ci-36ee7617-success-run.json', 'full-server-36ee7617-0740.stdout.log',
    'full-server-36ee7617-0740.stderr.log', 'final-refusals-focused-corrected-0824.stdout.log',
    'final-refusals-focused-corrected-0824.stderr.log', 'final-refusals-application-commit.json',
    'owned-path-resolver.cjs', 'final-discovered-tests-0833.json']}
(root / 'WP/pr284-resume-20261012/checkpoint-0836.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
body = '''Refs #200.

Import instrument CSV/TXT/XLSX files into raw work drafts and pending QC observations using a scoped, immutable mapping. Preview shows unmatched sample IDs and per-cell refusals; a conflict on any matched row refuses the whole file with zero writes. Successful commits retain exact source evidence and an immutable receipt. Recording, calculation and scientific acceptance remain explicit actions through their existing owners.

The workbench supports current activated calculation inputs, preview invalidation, all five languages and lab-label paste with comma/semicolon/tab delimiters. XLSX uses the approved separator-only round trip through the unchanged lab-number parser. Unknown units, unsupported dilution, formulas, external references and ambiguous numbers refuse. No scientific defaults or conversions are inferred.

The additive installer creates two empty immutable tables with their guards, a nullable restrictive WorkItemDraft.importReceiptId and one installation receipt. Native ALTER preserves existing rows. A digest-bound finite predecessor oracle protects #205 records in fresh/native-ALTER variants, with unknown columns/types refused. Historical 89/92-model literals and factories stay unchanged. The streamed preservation digest is byte-identical to the original ordered JSON hash, including records. A new closed schema-only fixture represents released main51f. No analytical backfill.

Current head c26591698c1e974a3bf771e5c333578755aef315 incorporates released main51f and retains PR293 reported-value exports and #283 unit authority. The SQL scanner rules are unchanged; installer tests use explicit inspectable SQL. Existing SPA/spectral delivery is byte-identical to the integrated predecessor. Added refusal tests cover HTTP instrument mismatch at preview and commit, direct/QC dilution10, input-only QC whole-file rejection, same-lab revision and unit failures, with every original row retained.

YY's existing dependency approval on 6099365745/6099368373 covers saxes6.0.0 ISC and xmlchars2.2.0 MIT. Decoding uses built-in zlib; no extraction, entity expansion or external loading. Caps:16MiB upload/64MiB expanded/4096 ZIP entries/250000 XML nodes/depth64/4096 merges.

Validation: DRAFT, final full validation in progress.
- Final focused8 suites/146 tests pass, including actual HTTP/import/installer and Chromium keyboard paths.
- Intermediate36ee passed360 suites/5466 tests and CI38218977639, including actual Docker boundary/readiness checks. This is not final-head approval.
- Final c265 unfiltered360-suite local run and exactCI38224227228 are running; no final-green claim yet.
- Client build passed, lint0errors/14 existing warnings. All earlier failed logs remain retained.
- Local hidden-path handling uses a verified alias of the same physical checkout and two-module environment resolver outside the PR. All360 files, normal setup/hooks and closed fixture identities remain. Original local DB/WAL/SHM files are preserved.

Evidence: audit/release-eb6de2e8, WP/pr284-resume-20261012. All #200 scope pins apply, including6096643904. No #200 production installer or deployment has run; a new reviewed source/proof/frozen kit and fresh single-use gate are required under YY's standing go. Claudio owns post-deploy checks and closure.
'''
(root / 'WP/pr284-resume-20261012/pr284-description-draft-c2659169.txt').write_text(body, encoding='utf-8', newline='\n')
print(json.dumps(record, indent=2))
