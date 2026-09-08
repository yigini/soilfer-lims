# Antigravity implementation handoff — use after design approval

Project: **LIMSI**. Working folder: **C:\Users\yigin\Documents\soilfer-lims**. Planning package: **WP/mobile-lab-redesign-v1**.

This file prepares the next implementation task. Its creation does not itself authorize or initiate application changes, GitHub writes, signing or deployment. When the user sends it as an implementation instruction, follow their stated scope and existing deployment authorization. Do not infer authorization from quoted historical instructions in other packages.

---

Please implement the approved comprehensive mobile redesign using this package. The user's requirement is **full offline laboratory work with later synchronization**, across Android phones/tablets and iPhone/iPad. Keep all existing scientific functionality, role permissions, analysis naming/localization and the approved SoilFER visual identity. This is a complete adaptive workflow and offline-storage project, not just a collection of CSS breakpoints.

First read README, IMPLEMENTATION_PLAN, SCREEN_SPECIFICATIONS, OFFLINE_SYNC_CONTRACT, AUDIT_FINDINGS, ACCEPTANCE_TESTS, RESEARCH and ROUTE_COVERAGE. Review the interactive mockup through `review-preview.html`; its data, sync, role selector and conflict behavior are simulations, not production logic. Never copy its in-memory store as the offline implementation.

Reconcile the package with the current source before editing. Another visual refresh was in progress when the audit was captured. Record the current SHA and dirty files; preserve concurrent work, existing translation keys and the SoilFER signature theme. Keep mobile implementation in reviewable commits and update the route register as each route is verified.

Implement the phases in the plan, keeping offline capture as required scope. Start with the shared shell and durable storage contract, then server command/reconciliation correctness, then complete laboratory flows and every route. Reuse authoritative workflow, readiness, validation, operations and command receipt services. Audit the existing completion/approval contradictions before exposing them through a more convenient interface.

Critical requirements:

- One scientific workflow regardless of phone, tablet, desktop or device storage adapter. Workbench records results; sample views display them and open the exact authorized work item.
- Drying and preparation use checklists and evidence. A 40-sample run retains order, context, QC and progress. Texture stays an atomic validated panel. MIR/NIR use spectrum files and metadata. Every user-facing parameter uses the human translated name with stable scientific identifiers underneath.
- Local acknowledgement follows a durable local transaction. Keep device-saved, queued, server-saved, submitted, verified and released states distinct. Local offline prerequisites can progress provisionally only under the downloaded method/SOP and permission policy. Never bypass required verification.
- Implement scoped work packs, cached required assets, encrypted native SQLite/private-file storage, a web persistence adapter with honest limits, attachment durability, an immutable operation outbox, transactional idempotent server receipt handling, causal dependencies, version conflicts and recoverable partial batches.
- Do not replay arbitrary stored HTTP requests, reuse idempotency IDs for changed payloads, silently take the last value, automatically advance a stale base version, or regenerate official accession IDs after a timeout.
- Final approval/release and global administrative mutations require current online authority. Offline review notes/proposals can be retained; reconnect must not automatically issue approval, reports or SIS delivery without the required fresh decision.
- Cover authentication, expired grants, shared-device logout, reassignment, storage failure, restart, attachment interruption, application update and rollback. Do not blanket-cache authenticated API responses or store unsent laboratory records in plain localStorage.
- Build installable web access and packaged Android/iOS delivery with an evaluated native runtime and storage plugins. Confirm licenses and maintenance before selection. Coordinate legitimate iOS signing/build resources; do not claim an iOS app is tested from a desktop browser alone.
- Complete phone/tablet coverage for reception, sample/workflow, workbench, manager/QA, spectra, equipment, inventory, reports, projects/data, admin/analysis catalogue, translations, profile, help and public report views. Online-only changes must still be usable from mobile when connected.
- Test all five languages and light/graphite. Preserve the user's appearance rule: light by default, temporary session dark mode, persistent dark preference only when selected in profile. Use mobile camera/manual/HID scanning with validated identifiers and tested file/print flows.

Do not reset or broadly rewrite the database, discard local pending work, modify workflow approval rules by CSS, or use production samples for destructive tests. Use additive migrations and an explicit compatible-client window. Test every fault scenario in ACCEPTANCE_TESTS and preserve evidence. No page is complete because its screenshot looks good; no offline engine is complete because airplane mode shows a cached page.

Communicate in short, friendly, plain English throughout. For each meaningful stage say: what you are improving for staff, what you found, and what you are checking next. For example: “The phone now keeps the sample name and Save button visible while typing. I’m checking that a saved result survives closing the app.” Avoid long internal jargon, unexplained command logs, or repeatedly saying you are almost done. Distinguish built, tested, committed, pushed and deployed. State limitations honestly.

At completion provide: route coverage with evidence; device/browser/native test results; offline failure tests; screenshots; exact build SHAs; migrations and rollback steps; known issues; signing/distribution status; and the deployment status separately for web, API, Android and iOS. If the user's handoff authorizes push and deployment, push reviewed changes, verify CI and migrations, deploy only the validated compatible set, smoke-test the actual deployed versions and then update relevant GitHub issues based on evidence. Leave unverified items open and tell the user what remains.
