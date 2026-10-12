import datetime
import json
import pathlib

root = pathlib.Path(__file__).resolve().parents[2]
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
note = ('PR284 pre-review checkpoint ' + stamp + ': Claudio requested three pinned refusal tests (409 instrument mismatch preview+commit, direct+QC dilution10, QC under input-only mapping whole-file/zero writes), plus optional same-lab revision/unit commit tightening. Proposed test bytes are retained separately in WP/pr284-resume-20261012/refusal-test-proposals, NOT applied while SAME full session33162/CI38218977639 on36ee remain running. Native actual scope correction: remove the two out-of-scope SPA/download delivery hunks in the final head. Pip acknowledged and will restore prior delivery behavior after the current run; owned R: alias resolves SAME physical checkout without hidden ancestor/new checkout. Final head must receive fresh full validation; draft NOT audit-ready. NEW proposed one-shot import_stage source c435f2e18032a01641d64233068ec4eecfa6d1f4 passed76/76 Windows and76/76 exact-source Linux guards with0failures/errors/skips/no production DB access at08:02 UTC. Stage connects SQLite only to immutable detached backups, verifies exact104/38 to106/39 delta, refuses original-row/dry/repeat writes and reuse, and persists forward-only intent before first CLI. Initial owned-harness Windows connection-close failures retained; fixed harness explicitly closes connections. No production mutation/build/proof/kit/gate/cleanup/cards. Full reviewed coordinator/layout/source authority remains to prepare. Completed PR293 remains untouched.\n\nPrevious checkpoint follows:\n\n')
for name in ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md', 'WP/pr284-release/README.md']:
    path = root / name
    path.write_text(note + path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
(root / 'WP/pr284-resume-20261012/checkpoint-0804.json').write_text(json.dumps({
    'updatedUtc': stamp, 'status': 'PROPOSED_TESTS_AND_SOURCE_ONLY', 'appHead': '36ee761789a1eb42bceee537ff419456f6cd484d',
    'sameLocalFullSession': 33162, 'sameExactCi': 38218977639, 'finalHeadPending': True,
    'nativeClaudioGaps': ['INSTRUMENT_MISMATCH_PREVIEW_AND_COMMIT_409', 'DIRECT_AND_QC_DILUTION10', 'INPUT_ONLY_QC_WHOLE_FILE_ZERO_WRITES'],
    'scopeCorrection': 'REMOVE_TWO_DELIVERY_HUNKS', 'proposedAdapterSource': 'c435f2e18032a01641d64233068ec4eecfa6d1f4',
    'windowsGuards': 76, 'linuxGuards': 76, 'productionMutations': 0}, indent=2) + '\n', encoding='utf-8')
print(note.split('\n')[0])
