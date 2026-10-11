# Combined production release in progress

Application: `feac653495d6b8a21e082cec596f1e14672fb389`.
Last deployed: `283a8bb54b66a2167d34d80ad724bdd6460850b1` (#188).
Reviewed manifest state remains **PREPARED_ONLY_NOT_EXECUTED**, frozen at
2026-10-10 21:37:25 UTC. Production execution is now **RUNNING** in the single
unit `lims-release-feac6534-production-20261011t0543z.service`. Ingress was
quiesced at 2026-10-11T05:43:07.183735Z. Read the live production receipt and
unit before any continuation; never replay this execution directory or gate.

Claudio's exact-kit audit **PASSED at 2026-10-10 21:42:44 UTC**:
https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6102481848.
The unchanged head, manifest/coordinator/PASSED receipt, both plans, YY choice
hash and workload pins are all bound in the pass. The full API record is
retained in `kit-audit-feac6534-e6b8b8de.json`. YY authorized image-only cleanup
and deployment in the current user request, with guards in #162 comment
6105830882. The cleanup and two disk samples passed. Fresh production gate
`c4e0a8f582526af97b4295080049b6087d5e07584e8a65ee4aaa3ff9b0d33f03`
was collected at 2026-10-11T05:42:26.104Z and installed once without overwrite.

The NEW complete real Docker rehearsal passed at **2026-10-10 21:33:43 UTC**,
unit `lims-owned-feac6534-proof-20261010211834z.service`, exit 0. Its retained
original root is
`/opt/lims/releases/combined-eb6de2e8-rehearsal-feac6534-20261010211834Z`.
The frozen, non-executed production kit is
`/opt/lims/releases/combined-release-eb6de2e8-feac6534-20261010T214130Z`.
The directory suffix is an identifier; actual preparation time is the
offset-qualified `preparedUtc` in the manifest, converted above to UTC.

## Exact bindings for review

| Evidence | SHA256 |
| --- | --- |
| Prepared manifest | `e6b8b8decd82fcb5fde05547bb0a8c32ce60081bcad1f76570e05034f724114a` |
| Production coordinator | `08ca5584f79893d0ffb4f8c525f1ec40e4438969c11a294c91f82cdc118ba3c7` |
| PASSED rehearsal receipt | `1e8f8929f7d5a905abbd643ea0199c00ef6bd004dc64c7a2c84f9915f64efb11` |
| #190 dry row plan | `7ffdb375cab35663d188d6087f02ee81161ec950feae7611bbbad6d8706d57f9` |
| #191 acceptance-link dry plan | `d894e33add6e7458077141d45922e27d2172b4975c2e7e9e650ab25c05bc1215` |
| Original YY #191 choice transcription | `c1b07d025d1aa790c37d32bbf33f8f9a8cffe1c7c35727441d6e39f1d9e28d14` |
| Valid original build receipt | `3ccc75f9902de974b55f3f2e39fcf2ef758ad2fe413511b323e9351e0b8b93e2` |
| Application source archive | `5ae6039446bbd3cb038e2ac202b6fee966c89de1513f144dfd29d5260ce9f10d` |
| Application Git-blob index | `70b9bf21d560ec932ef7613fc32971b7a693e5a6e15b697cc2327c70b3edb720` |
| Packaging Git-source index | `21749428a1ec9da5c961f8082be252f1a01e8e84c90d4d91a5e9205e1f625529` |
| Public rehearsal summary | `19a6450f920d44ed1a15b015a1f4f34dcd7ff56a206f30a9f0605eaa7eb95cfc` |
| Green 21-PR/main gate snapshot | `2a44ff340a25e88f5b51bd02dee960ee888a346005631ac9f34eadaeb74ea58f` |

Image:
`sha256:159057d56c456a0c7cdef917fd04f53f9a66d6285cc476d7203d63047bfff8e1`,
413,507,742 bytes. Fresh image inspection matches the build receipt and exact
application revision label. All 2,224 application Git blobs were individually
verified before the real build, with no production DB mount.

## Rehearsal and application gates

- All **22 ordered steps**, with dry/apply/repeat, passed. The acceptance-link
  repeat runs immediately between #190/#191, and all 21 existing end repeats
  remain. Repeats made zero changes and preserved installed database bytes.
- All **66 CLI cgroup peaks** were recorded at the original 768 MiB limit,
  no heap override, exit 0 and no child signal. Maximum peak: **550,342,656 B**.
  Startup peak: **335,179,776 B**. All **20 ordered READY events** report zero
  changes. Startup and API probes changed no database evidence.
- **31/31 postflight checks and all six additional read-only probes passed**.
  Health is ok; bench credential count is zero. Integrity ok, foreign-key
  violations zero. All **90 original tables/fields and 18 original receipts**
  are preserved, with only the explicitly approved changes below.
- #190 dry plan: **17 new attempts, 19 NULL Result links, 0 flagged groups /
  attempts, 225 missing ordered WorkItems across 10 samples, zero writes**.
  Apply totalChanges 39. Missing work remains reported and deferred in #274.
- The exact named acceptance link made **one original status-field change
  plus one immutable WORK_ATTEMPT event**, totalChanges 2. Its immediate
  repeat made zero changes and preserved bytes. #191 then found **zero
  blocked owners** and installed. The existing ReviewDecision attemptId stays
  NULL; no submission or scientific decision was invented, and the published
  report and other original evidence remain unchanged.
- Other installers: #193/#192/#194/#197/#201/#210/#211/#202 each reported
  totalChanges 1, with no historical backfill/new NCR/selection/amendment.
  #199 reported totalChanges 17, backfill/activation/unit insert counts all 0.
  The other 10 prerequisite/raw/equipment/uniqueness steps were NO_OP/0.
  Preservation records 19 additional schema receipts and 13 additive tables.
- All **21 included PRs** have matching-head Claudio audit passes and green CI:
  258, 257, 259, 260, 263, 264, 265, 266, 267, 268, 269, 273, 271, 276, 275,
  280, 282, 285, 286, 287, 289. Ungated count 0.
- Merged-main **CI 38085615017 is fully green**: **339/339 suites,
  5,087/5,087 tests**, 1,521.729 seconds, client build and both real Docker
  checks. Lint passes with 0 errors and 14 existing warnings. #289's reviewed
  head and merged target have the identical tree. Pip's independent focused
  verification was 301/301 tests, zero skips.

## Valid build reuse and packaging-only correction

The build remains the actual **21:14:48.006477 UTC** build from
`combined-eb6de2e8-main-feac6534-retry-20261010210829Z`, with its original
tag/time/source/blob bindings and build log hash
`ed04e713e64fc5b73cd0e3a230cf64bf8f375f236b12c0f1a2cfefdcd756476e`.
That runner subsequently refused reserve **before any DB copy/rehearsal
receipt**. It supplies the valid build-only receipt/image, not a failed proof.
The later rehearsal used a genuinely new consistent production copy. No
failed proof feeds this receipt; earlier failed receipts stay retained.

Rehearsed tooling: `b02238df5ef4da6f91d2757f8a0498c45e7b1326`, 30 guards pass.
Packaging tooling: `a05791d6b8484c249dbfb9156962e66a568ba6b5`, **31/31 Linux
guards passed, exit 0, 0.670s**. Guard log hash
`66588a370662d917716e8ffdc1f3764275b6ef14dfc989deada6a9389fe09ace`.

The first freeze attempt found that the public formatter asked a DRY_RUN plan
for `flaggedGroups`, which belongs to the APPLY receipt. It refused before
creating a destination. The formatter now reports planned
`duplicateAttemptNumberGroups`, including zero/nonzero regression coverage.
Only **summarize-proof.py, prepare_manifest.py and test_release_guards.py**
changed. The new preparer reads packaging sources from its own raw Git export
and original proof files from the unchanged PASSED root. Every measured
source, coordinator, row plan and original YY transcription is byte-identical
to the proof. The retained PASSED receipt hash was checked before and after
freezing and remains exactly the hash above. Both source commits and the
original rehearsal root are explicit in the manifest. All 26 frozen files
were independently hash-verified and have mode 0400. No execution gate exists.

## Storage clearance and production execution

YY's Remove old images choice at 05:27 UTC is recorded in #162 comment
6105830882. The current trusted user request explicitly authorized cleanup
and deployment. Native card navigation failed twice; Pip stopped UI input
and does not claim fresh inspection of that card. The authorization record
is `storage-authorization-20261011.md` and the original GitHub API record is
`storage-choice-6105830882.json`.

Three explicitly named, unreferenced LIMS images were removed by digest with
no force or prune, retaining all 25 other images and all containers. Before
free: 8,556,904,448 B; first sample at 05:36:55.609918 UTC: 11,210,469,376 B;
second at 05:42:10.196010 UTC: 11,209,916,416 B. Separation 314.586092 seconds,
drop 552,960 B. Net cleanup freed 2,653,564,928 B. The conservative required
free space is 9,425,599,031 B (8 GiB reserve + DB/assets backup + 256 MiB logs).
Before/after `docker image ls --digests`, `df -B1`, removal results and samples
are in `image-cleanup-feac6534-20261011T053500Z/` and the corresponding retained
host directory. No DB/WAL/SHM, volume, backup, proof or receipt was removed.

Read-only verification at 05:39:24 UTC reconfirmed all 26 frozen files, 2,224
source blobs, 22 installer stages, 66 bounded CLI measurements, 21 end repeats,
20 zero-change READY events, 31 checks, 6 read-only probes and full preservation.
The fresh gate binds the unchanged exact-kit pass 6102481848 and both workload
pins `labAndHubBuildsOwnedByYY=true` and `RELEASE_DAY_DISK_ABORTS_ACCEPTED`.

YY's previously verified Main now / Auto after review authorizes this scope
only after every gate passes. Deployment will use a fresh 10-minute GitHub
gate, the reviewed #189 stopped-writer backup and ingress/jobs hold/reopen
pattern, the scaled reserve formula with 8 GiB floor, and 500 MB unexplained
drop aborts. Before any installer, old-image recovery also requires unchanged
logical/physical DB/WAL/SHM plus COMPLETE/0 verification and ingress before
jobs. After any installer attempt, including NO_OP/failure, recovery is a
separately reviewed forward fix with maintenance/jobs held; no DB restore,
old-image start, retry or override.

#205/draft #288 and #284 remain excluded; Claudio holds new application
merges. After actual deployment Pip posts exact SHA/UTC/health/receipt on the
19 included issues in `deployment-issue-targets-feac6534.json` and #162.
Claudio owns post-deploy checks and issue closures. Before execution, live was
healthy #188: HTTP 200, `status=ok`, version 1.9.0, zero restarts, original image
`sha256:b02ddff8d7549e981edc49215fef2d54ca654adaa2a8924eceb5d4ea0af00394`.

Public metadata is retained beside this document:
`prepared-manifest-feac6534-e6b8b8de.json`,
`rehearsal-summary-feac6534-passed.json`,
`build-receipt-feac6534-159057d5.json`, `kit-source-index-a05791d6.json`,
`application-source-index-feac6534.json`, `pr-gates-feac6534-passed.json`.
Private DB copies and full proof logs remain on the production host.
