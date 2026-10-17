# Sample custody and retention (#207)

`InventoryLocation.purpose` distinguishes reagent locations (including all existing locations) from sample storage. Sample moves select an active `SAMPLE` location in the receiving laboratory. Container identities remain immutable; current location is projected from their custody events.

Physical receipt writes one `RECEIVED` event with the authenticated receiving user and server timestamp. The first receipt supplies the compatibility custody fields in sample list/detail/workspace and consignment detail responses. New writes do not create signature strings. Existing scalar custody fields and serialized evidence remain unchanged, and legacy events explicitly do not claim an authenticated acknowledgement.

The append-only ledger records sample/container/consignment references, movement type, source/destination, actor, time, counterparty, reference and evidence. `GET /api/samples/:id/custody` reads the scoped history; `POST /api/samples/:id/custody` records `MOVED`, `ISSUED`, `RETURNED` or `SENT_OUT`. Move/return require a destination; issue/send require a counterparty. Receipt and disposal use their dedicated workflow commands. The existing movement dialog uses controlled locations and optional containers.

Report publication resolves `sample.retentionDaysAfterReport` through `policyService.get` inside its transaction and stores `Sample.retainUntil` plus a report snapshot of the chosen period. Project settings can override the period with `policyConfig.sample.retentionDaysAfterReport`; the existing project settings editor and `PUT /api/projects/:id` expose `retentionDaysAfterReport` (a non-negative integer, or `null` to inherit). Existing issued reports are not retrospectively assigned guessed retention dates.

The disposal queue at `GET /api/samples/disposal-queue` and the Samples screen include only overdue approved/archived material without an open amendment or canonical/legacy hold. The same conditions are rechecked atomically at final disposal. Rejected material may be disposed immediately with a reason through `transitionSample`; approved material continues through closure review. Archival selects a controlled location, with the movement event appended when review completes.

## Additive installation

The normal entrypoint runs `install_sample_custody.js` after the existing prerequisites. Before an upgrade, use its explicit `--db <owned-copy-path> --dry-run` mode; `--apply` installs the same guarded migration. Startup checks readiness without writes. Docker keeps the release SQL outside the overlaid Prisma volume.

The installer checks schema/guard definitions and integrity, refuses partial or unmarked populated custody storage, preserves all existing rows and adds legacy `RECEIVED` events without rewriting old columns or JSON. A receipt binds the source and backfill; repeated installation is a no-op. Legacy receipt evidence without a receiving laboratory or recorded time stops installation for review. It never invents a receipt date, signature, storage location or retention date.

Contract coverage: `server/tests/contracts/audit_5_3_custody_retention.test.js` exercises missing location, tenant/purpose boundaries, acknowledgement/immutability, retention, queue exclusions, rejected disposal and preservation/idempotence of the installer.
