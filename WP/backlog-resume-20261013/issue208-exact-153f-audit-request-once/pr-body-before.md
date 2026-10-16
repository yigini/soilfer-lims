References #208.

Labels use the exact issued sample/container identity for both QR and Code128. Sample, container and aliquot printing share one scoped server command and dialog; reprints require a reason before the browser print dialog opens.

- Add immutable `LabelPrintEvent` rows with identity, issued code, count, ordinal, format, reason, actor and timestamp. SQL guards protect references, copy counts, print ordering and reprint reasons.
- Re-read permissions, sample scope and state at print time; refuse missing, ambiguous or unsupported codes with stable localized 4xx codes in all five locales. Preserve historical issued bytes and the approved numbering authority.
- Document the ISO 7064 MOD 37,36 hybrid system's adjacent-transposition limitation. Preserve physical label sizes and require larger stock when Code128 modules would otherwise be compressed below 0.19 mm.

The supported historical image can lack all four #180 schema objects. A guarded schema-only owner now runs before #206 containers and #208 labels, and label readiness explicitly requires it. The owner executes the unchanged approved #180 DDL only when all four objects are absent: two nullable columns, the sample-code unique index and an empty `LabSequence`. Complete canonical or exact Prisma storage is a no-op; partial or modified storage is refused. Every original-column row and prior receipt is preserved. It performs no backfill, allocation, renumbering or receipt write. The scanner change adds only the digest-bound source entry to the existing resolver; it grants no writer exemption.

Validation of the frozen correction tree:

- Complete ordinary server suite: **376 suites / 5,725 tests passed** (3,505.14 s), with exact discovery/PASS inventory reconciliation and both ordinary setup files.
- Focused label/schema/startup/bootstrap/guard/scanner/wiring run: 10 suites / 235 tests passed. Visible-fixture preflight: 14 suites / 259 tests passed.
- Client production build passed; lint passed with 0 errors and 14 existing warnings.
- New contracts cover absent installation, populated predecessor rows and receipts, complete canonical/Prisma no-ops, partial/modified shapes, empty new sequence storage, existing issued codes/counters, DB/WAL/SHM preservation and pinned-source refusal. Existing label/React contracts cover QR/Code128 parity, reprint reasons/concurrency, scope/permissions, stale dialog requests and commit-before-print behavior.

Windows local validation used a retained, Git-free visible Temp fixture because hidden `.codex` paths break Jest discovery and Express file downloads. Repository Jest/CI configuration, stock assertions and scanner rules remain unchanged; local discovery uses only a relative `testMatch` CLI override. The scanner uses a hash-verified native read-only index copy. All 2,445 mapped source/build/template inputs and 21 generated Prisma runtime files were checked before and after. The selected fixture template and fixture `server/prisma/dev.db` both came from the same WAL-aware canonical owned backup; the manifest explicitly maps the default database through `sourcePath`. The raw worktree default database was outside this run's input domain. The only declared generated-output change was the fixture help manifest; before/after bytes were retained and it was restored after the run closed.

The twelve reviewed correction paths match the tested working files exactly for `docs/audit/208-labels.md`, `server/scripts/install_sample_code_schema.js`, `server/services/sampleCodeMigrationSource.js` and `server/tests/contracts/issue_208_sample_code_schema.test.js`. The other eight differ solely by Git's CRLF-to-LF normalization. The pinned loader and unchanged #180 DDL retain their exact reviewed byte hashes. No source changed during the complete run.

Original CI [38898578537, attempt 1](https://github.com/yigini/soilfer-lims/actions/runs/38898578537) remains completed/failed and retained unchanged. It passed 375 suites / 5,702 tests, candidate and supported-baseline Docker builds, and the real Docker boundary rehearsal; real deployment-readiness acceptance failed at PRE_199 startup with `LABEL_PRINT_PREREQUISITE_REQUIRED` because `Sample.labSampleCode` was absent. That run was not retried. Earlier failed local discovery/fixture attempts and the initial three focused correction failures are retained; they are not counted as final validation.

Related limitation: the existing preanalytic deletion handler can return a generic 500 when a RESTRICT foreign key blocks deletion. A printed RECEIVED sample is retained by the new evidence reference and may reach that existing handler path, as containers already can. This PR preserves evidence and leaves deletion authority unchanged.

Tested correction commit: `72adbe43b36319e6f9d8088baa61b0fbe26bb3ff`; tree `2e562ca28eff2229b321db490b4f243882e44021`; base `be8379745bdfae52ce46496ff26514dc7d729640`. One ordinary new-head PR CI is pending. Exact-head audit, physical printer/scanner acceptance, deployment and actual post-deploy acceptance remain pending. The issue stays open; this draft PR authorizes no merge or deployment.
