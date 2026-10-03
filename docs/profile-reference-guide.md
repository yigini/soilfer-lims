# Soil profile references and the two-layer demonstration

This guide accompanies issue #140. A profile reference identifies a recorded field profile or sampling point. It is separate from the specimen UUID, field bag label, laboratory accession and institutional laboratory ID. An unknown profile never prevents ordinary laboratory work.

## Recording a reference

Reception and a manifest can record an optional field code and its meaning: sampling point, composite area, explicitly confirmed soil profile, or unspecified. Use the source record; depths, coordinates and similar bag labels do not establish a shared soil profile. A confirmed profile must be supported by recorded field evidence.

The source namespace comes from authorized project/Kobo mapping or the compatible capture-time project/country context. It is saved with the reference and is not recalculated after a project rename or transfer. The receiver owns any crosswalk to a national soil-profile registry; LIMS does not create national identifiers.

On the sample page, the reference is read-only beside the bag/accession identities. Scoped reception staff or managers can correct an unreleased reference. A released correction requires an authorized clerical amendment, a reason and the current profile revision. The amendment changes current provenance and the change feed, retains analytical results and preserves older frozen snapshots. A stale revision returns a recoverable conflict rather than overwriting another person's correction.

"Record as unknown" explicitly stores a null identity. A legacy site alias cannot silently replace it. A malformed stored reference is shown as needing review and cannot silently become a different exported identity.

## Kobo configuration and replay

The project connection editor offers exact field paths for profile code, namespace, meaning, collection date and top/bottom depth. Flat and nested paths are supported; no suffix guessing selects a pit field. Saving mapping uses the current connection revision and current project/lab authority. An in-flight fetch cannot commit against a subsequently changed mapping.

Normal synchronization and force refresh preserve manual facts, provenance holds and released identity protections. A legacy fingerprint remains comparable on an unchanged replay. A real source change creates retained revision evidence and a review hold. Missing GPS, depth or collection date remains missing; upload/interview time is not substituted for collection date. Numeric zero and decimal depth are preserved.

## Current exchange shape

All current exports use the shared identity adapter. V2, GeoJSON properties, snapshots and change payloads retain the established field names:

```json
{
  "specimenId": "PROFILE-FIXTURE-140-A",
  "fieldSampleId": "DEMO-BAG-A",
  "labSampleId": "<allocated during reception>",
  "laboratoryId": "PROFILE-FIXTURE-140-LAB",
  "profile": {
    "code": "PIT-DEMO-01",
    "namespace": "DEMO-SURVEY-2026",
    "key": "DEMO-SURVEY-2026:PIT-DEMO-01",
    "relation": "CONFIRMED_PROFILE"
  },
  "sampling": {
    "collectionDate": "2026-10-01",
    "depths": {"topCm": 0, "bottomCm": 20, "unit": "cm"}
  }
}
```

This is an excerpt of the actual serializer shape, not a database seed or complete API response. The second bag has its own specimen/bag/accession and depths 20–50 cm, with the same profile key. An explicit unknown exports `code`, `namespace` and `key` as null with `relation: UNSPECIFIED`. Spatial authorization remains unchanged. V1 retains its existing transport shape while using the same reference resolver.

## Safe isolated fixture

`server/scripts/profile_fixture.js` requires `NODE_ENV=test` or `staging`, `LIMS_PROFILE_FIXTURE_ENV=issue140-two-layer-v1`, and an existing disposable database. A test database must be under `server/tests/.tmp`; a staging database must be under the operating system's temporary `issue140-two-layer-v1` folder. The loader refuses production, an ordinary application database and a database with more than 1,000 samples. Do not run it against a production copy containing real laboratory records.

Use the existing test-database setup to create a small compatible disposable database, then invoke the loader with that explicitly selected database. It records its database path and exact synthetic lab, project, configuration and five specimen IDs in its returned manifest. Re-running an intact owned fixture reuses it; partial fixtures or ID collisions fail without overwriting records. Keep the manifest with staging evidence. The disposable database itself is the cleanup boundary; do not issue broad sample/lab deletes against any other database.

The loader creates five EXPECTED specimens, with no results or approval bypass:

| Suffix | Bag | Recorded namespace | Depth, cm | Purpose |
|---|---|---|---|---|
| A | DEMO-BAG-A | DEMO-SURVEY-2026 | 0–20 | First confirmed pit layer |
| B | DEMO-BAG-B | DEMO-SURVEY-2026 | 20–50 | Second confirmed pit layer |
| DECIMAL | DEMO-BAG-DECIMAL | DEMO-SURVEY-2026 | 0–20.5 | Decimal precision |
| OTHER | DEMO-BAG-OTHER | DEMO-SURVEY-OTHER | 0–20 | Same local code, different namespace |
| UNKNOWN | DEMO-BAG-UNKNOWN | None | Unknown | Ordinary work without a profile |

The mounted `profile_fixture_workflow.test.js` takes all five through reception, assigned drying/preparation, pH recording, submission, manager review and final approval before fetching through a restricted synthetic machine connection. It verifies five distinct accessions, the shared two-layer key, exported decimal precision, namespace separation and explicit unknown. Test observations are synthetic; they are not laboratory scientific validation or OpenNSIS ingestion evidence.

For Eloi's actual receiver demonstration, use an isolated deployed staging instance and a designated connection scoped only to the fixture lab/project. Process the specimens through the same valid workflow, verify the key's scope, and retain snapshot/checkpoint/receipt evidence. The ordinary loader does not create an unrestricted key, expose test credentials or write real results. No national production ingestion is authorized by this fixture.

Receiver acceptance remains separately tracked on [issue #140](https://github.com/yigini/soilfer-lims/issues/140): two layers, namespace separation, decimal depths, replay, reasoned amendment, withdrawal and checkpoint-expiry rebaseline. A successful LIMS fetch does not establish those external outcomes. Retain existing data/checkpoints on retryable exchange 503 responses; see [the operator runbook](nsis-operator-runbook.md#7-exchange-publication-eligibility--retry-semantics-http-503).

## Data preservation and release

This increment uses existing JSON provenance and requires no table migration or bulk backfill. Exact legacy identity preservation occurs only before a relevant authorized context change; scientific identity correction remains a separate audited action. Production counts and retained journal/snapshot inventory are aggregate evidence, not authorization to infer missing identities. Use [UPGRADING.md](UPGRADING.md) for pinned source/image, stopped-writer backup, guarded cutover and postflight. Never restore an old database over new laboratory writes.
