Sample storage now uses controlled `InventoryLocation` rows with `SAMPLE`/`REAGENT` purpose. Receipt, transfer, external custody and disposal append authenticated custody events; first-receipt views retain legacy evidence without writing synthetic signature strings. Container identity stays immutable while its current location is projected from the ledger.

Report publication resolves `sample.retentionDaysAfterReport` through the merged policy registry and optional project settings, records the deadline and report snapshot, and exposes an overdue disposal queue. Final disposal rechecks retention, canonical/legacy holds and open amendments in the shared transition; rejected material requires a reason. Archive/disposal UI uses the shared workflow and controlled locations, with all five locales covered.

The additive installer provides explicit dry-run/apply, exact source/schema/guard checks, legacy receipt backfill without rewriting old fields/JSON, retained-row verification and idempotence. Entrypoint/startup readiness and Docker SQL backup wiring include #207. Old issued reports keep their unknown retention dates until an actual publication supplies policy evidence.

The readiness rehearsal captures predecessor Sample and InventoryLocation columns, compares every original row/value and predecessor receipt exactly, then checks only the declared custody column additions/defaults, empty ledger and exact new receipt. Preservation canaries reject altered old values, audit evidence, receipts, undeclared columns, invented retention and unexpected backfill.

References #207. This PR contains source changes only; deployment and the actual Claudio postcheck remain separate.

Validation:
- Full server suite: PASS, 374 suites / 5,710 tests on unchanged corrected inputs (ordinary npm test and stock setup/assertions).
- Client npm run build: PASS.
- Client npm run lint: PASS, 0 errors / 14 existing warnings.
- New custody/retention and affected historical/startup/security contract suites: PASS.

Local Windows verification uses a retained Git-free visible Temp fixture because Express refuses downloads through the `.codex` path. Application/test/build bytes, complete SQLite template backups, generated Prisma dependency inputs and a read-only frozen index are verified against the exclusive source worktree. Normal PR CI is unchanged, including actual candidate/supported-baseline Docker boundary and deployment-readiness checks.

The corrected full local run passed 374 suites / 5,710 tests with the exact discovered inventory and postflight source/dependency/template/index hashes verified. The readiness script was tested with CRLF line endings; its committed form differs only by CRLF-to-LF normalization. The test file is byte-identical.

[Original CI attempt 1](https://github.com/yigini/soilfer-lims/actions/runs/38898969962) passed the full server suite, client build, actual candidate and supported-baseline Docker builds, and all five Docker boundary scenarios. Deployment readiness stopped at the predecessor Sample row-shape comparison corrected here. New-head Docker readiness remains subject to the ordinary PR CI result.
