# Checkpoint10 — accept the latest fixes; complete pending sample-context handling

14 September2026, approximately15:15 Europe/Rome. Commit b421a9a502fc77a96a20b2317e761baa8bc5002d is pushed with successful CI34846772962. Read-only SSH confirms healthy soilfer-lims:v3.5.8-b421a9a. The anonymous production smoke in independent-live-review10.cjs/.json passes ordinary Login without tutorial assets, explicit first-visit foundation and Exit restoring Login. No credentials, laboratory forms or production writes were used. No rollback is requested.

## Accepted and closed

Canonical sample.id routing, lookup timeout and malformed/403/404 handling, abort/sequence invalidation on Exit/Pause/unmount and actor/lab/token/chapter changes, default-off module configuration with explicit release enablement, English fallback, and removal of production test globals are accepted. Independent-map-race-review09.cjs rerun at13:12UTC on b421a9a confirms delayed response after Exit is ignored: route remains /workbench, guide absent, storage not recreated. Keep these closed; no repeated full suite/removal build.

## One remaining map lifecycle gap — reproduced

independent-map-selection-review10.cjs/.json freezes the same built assets and holds synthetic TEST-SAMPLE detail GET. While it is pending, the visitor changes the guide input to SECOND-SAMPLE. Releasing the first reply still navigates to /samples/TEST-SAMPLE/map?tutorialmode=true. Expected: stay on the current page until the new selection is explicitly requested. No backend/database/production access; all APIs mocked, external blocked, zero errors/non-read attempts. Snapshot TutorialShell-BUnyJsyA.js SHAe7189ec18ac92f7e7eda62702c04a984059f34240be0202db7d4a34bf93d3f52, index SHA4280b65873974d0fa6748b078d09f8af1db37d204fe0e23bba4eb807a4b196e7.

The effect at Shell98–113 does not depend on selectedSampleId or URL context, and the input handler at1603 only updates selection. Separate request cancellation/sequence invalidation from the effect that resets selection; simply adding selectedSampleId to that clearing effect would erase every keystroke. Cancel old lookup on sample edits and page/URL changes, and compare a genuinely current context before routing. The existing freshActorKey at586 uses the same captured verifiedUser, so it is not an independent fresh-state check. Preserve draft protection if a live input becomes dirty while waiting; re-check before the eventual navigation and use the existing confirmation flow. These are the same pending-lookup requirement, not new features. Keep the fix inside the tutorial module.

## Make evidence match the checks

- T11 selects roles and checks counters/unavailable, then returns; label role selection accurately instead of claiming full traversal.
- T14's bounded wording is accepted; its missing-key test is extracted-function evidence, not a rendered missing-key state. Keep human scientific/novice/device review pending.
- T21's health200 plus local HEAD/assets and a hardcoded sample count cannot verify the deployed commit or DB count. Reference actual independently matched public assets/image evidence, or label this health-only. Do not rerun database audits merely to fix a report label.
- T23's same-document actor-change section uses page.goto and discards the old URL, remounting AuthProvider. Correct the claim and add one focused synthetic same-document case through normal AuthContext/SPA sign-in; do not alter production auth or add public hooks. Existing new-document wrong-lab403 is already covered.

Please finish this narrow follow-through, relevant checks and safe focused GitHub/CI/deployment under existing authorization. No new approval, expanded feature list, server/RBAC change or wholesale rollback. Provide a short plain-English progress update. No literal perfection or all-role operational sign-off should be claimed from these tutorial checks.
