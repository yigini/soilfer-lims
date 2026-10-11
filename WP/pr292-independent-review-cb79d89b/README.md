# Independent runtime-fix review

Exact PR292 head: cb79d89bfd104466ab7d29a83312dbc7bb48b7a0, baseae64f169.
Owned raw-Git review copy has2,233 regular files, all Git blob SHA1 verified.
Generated Prisma client was reused only after schema-byte equality. The test
template was copied through SQLite's read-only backup API including WAL.
No production data or production writes in these Windows tests.

Source review: the duplicate index keeps identity/ownership/status/coordinates.
Stored metadata and fieldMetadata are hydrated once by matched id before the
existing hold/provenance decisions. Foreign/ambiguous/historical scope guards,
transactional rechecks and audit append behavior remain. A missing matched row
fails explicitly. There is no schema/installer/policy/scheduler change.

Eight focused Kobo/hold suites passed149/149 tests, zero failures/skips, exit0,
28.801 seconds. Additional owned synthetic scale replay passed:38,773 rows,
409,074,808 metadata/fieldMetadata characters,67 idempotent submissions,0 new,
67 skipped,410.379ms sync. Full Sample/AuditLog/SampleHold streaming SHA256 values
are identical before/after. Heap before164,183,840B/after181,095,632B; process
maximumRSS399,200KiB. Windows test used --max-old-space-size=384 (V8 actual
heapLimit603,979,776B); this is a synthetic regression, not the768MiB real Docker
proof. The scale test selected one additional test by name;23 unrelated cases
were filtered, independently covered by the149-test run where applicable.

This establishes focused independent code/regression PASS at the exact head.
Full CI, Claudio exact-head audit, merged-main CI, fresh-copy bounded Docker
workload proof, frozen exact-kit review and fresh execution gate remain before
any release. Temporary jobs-pause authority remains YY's pending native card.
Original runtime failure/proofs/receipts are retained. Forward-only; no replay,
restore, older image, heap increase or cleanup.
