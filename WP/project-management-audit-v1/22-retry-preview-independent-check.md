# Independent check of a40e049

2026-09-14 02:48 UTC. Antigravity pushed a40e049; GitHub CI 34800321584 was running. No new deployment verified. Focused real-route tests use a fresh schema-only disposable SQLite database; server/prisma/dev.db remains unchanged.

Evidence: independent-retry-a40e049-probes.cjs and independent-retry-a40e049-results.json.

- C02 mixed existing/new preview now signs the valid subset and commits one new sample correctly: independently PASS.
- C02 stale signed preview plus fresh If-Match header is rejected with PREVIEW_STALE_REVISION: independently PASS.
- C01 archive with the same key and DIFFERENT reason still returns 200 cached success, not 409 collision: independently FAIL. First and identical replay both correctly return 200.

The archive caller passes payloadHash as a top-level property to recordReceipt, but commandReceiptService.recordReceipt does not accept/store this property. checkReceipt reads parsedOutcome.payloadHash, which archive's outcome does not contain. Persist the hash through the actual shared contract (and preserve response compatibility); add the differing archive-reason case to the regression test. Do not weaken collision assertions or change unrelated APIs.

UI retry coverage remains partial: project_governance_retry_preview.test.js uses Supertest against the API and does not render either React modal. Calling this "Real UI Retry Recovery" overstates the evidence. Retained keys and receipt lookup are now present in source, but effects clear keys on edited inputs, changed preview, modal close and project-prop refresh. An uncertain committed operation can therefore lose its recovery identity before being resolved. Verify actual React behavior with a dropped response, same-form retry, edit while outcome uncertain, background project refresh and close/reopen. Keep unresolved operation identity/snapshot available and resolve its receipt before intentionally starting a replacement operation; present a clear recover/review choice. At minimum, demonstrate the actual modal lost-response and mixed-manifest flows, not only manually repeating API calls with the same key. Mark untested journeys partial.

The SIS CI fixture correction now uses authorized and foreign RELEASED samples and separately denies the authorized ACCEPTED sample, preserving the release filter. Full CI result is still pending at this check. Continue the authorized implementation and safe deployment after relevant checks, avoiding repeated evidence-only release cycles.
