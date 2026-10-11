# Kobo runtime recovery preparation

PR292 cb79d89bfd104466ab7d29a83312dbc7bb48b7a0 independently passed149/149
tests plus the owned production-scale synthetic regression. CI38161566308
passed18:29:54UTC. Claudio's exact-head full-suite audit is still required.
No application merge, candidate image, Docker release proof, frozen kit or
production gate exists yet for this recovery. PR291 remains separate.

The read-only streaming copy verifier is proposed source, not execution
authority. It enforces Claudio's pins6112209155/6112305172: unchanged schema
and every original row across104tables/38receipts, with only enumerated
new scoped Kobo Sample/AuditLog/SampleHold and manager Notification rows,
plus active-config cursor/clock fields. Existing Sample metadata is protected
just as strictly as scientific Results. Secrets are hashed, never serialized.
Twenty owned Windows SQLite guard tests pass. The initial test fixture held
an open SQLite connection during temporary-directory cleanup; closing the
fixture connections resolved that test-harness issue. No runtime guard was
weakened and no host database was involved.

The second natural sync protects every first-sync row too. Its retained
upstream read-only fetch record must prove that any further intake is from
genuinely new submission ids above the conservative first-fetched set.
Only lastSyncAt/updatedAt may change for prior fetched submissions. New ids
which legitimately skip may advance the cursor without adding Sample rows.
The caller must bind those upstream records and observe the real scheduler
without editing its interval, cursor or timestamps. The observation lasts
at least syncIntervalMins+2 minutes after first completion, containing a
660-second healthy soak at768MiB/no heap override and a natural second sync.

This module performs no fetch, container action, database mutation or release.
The complete new rehearsal/coordinator/kit and exact hashes need peer review
before production. Original consumed kits, failures and backups stay retained;
no restore, older image, installer replay, cleanup or new production writer.
