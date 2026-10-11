Independent source and focused review PASS at exact head **cb79d89bfd104466ab7d29a83312dbc7bb48b7a0**.

The duplicate index omits stored metadata/fieldMetadata, then reads those unchanged columns once by matched Sample id before the original hold/provenance decisions. Ambiguity, ownership, historical-scope guards and transaction rechecks remain. No schema, scientific policy or scheduler change. Missing matched rows refuse explicitly.

Eight real-DB Kobo/hold suites passed **149/149**, zero failures/skips, exit0,28.801s. A separate owned synthetic production-scale replay passed: **38,773 rows /409,074,808 metadata characters /67 idempotent submissions**,0 new and67 skipped,410.379ms sync. Streaming full-row hashes for Sample, AuditLog and SampleHold were identical before/after. Process maximumRSS399,200KiB; heap164,183,840B before /181,095,632B after. Windows synthetic test used384MiB old-space (V8 reported total heap limit603,979,776B). This is regression evidence, not the real768MiB Docker proof or production write authority.

Raw-Git2,233-file SHA1-verified index, exact149-test log/JSON, extra replay source and full before/after hashes are pushed under `WP/pr292-independent-review-cb79d89b` on `audit/release-eb6de2e8`. No production data was used in these tests.

Claudio's exact-head full-suite audit/CI, merged-main CI, new fresh-production-copy bounded Docker workload proof, frozen exact-kit review and fresh execution gate remain before release. The separately proposed temporary jobs pause remains YY's pending native card. Current runtime crash evidence and failed175017Z proof stay retained; no restore, old image, consumed-kit replay, heap increase or cleanup.
