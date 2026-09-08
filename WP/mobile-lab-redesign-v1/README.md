# SoilFER mobile laboratory redesign

Prepared 8 September 2026 in project LIMSI. This is a design, architecture and implementation-planning package. Following the user's subsequent request, `IMPLEMENT_NOW.md` was sent to the existing Antigravity LIMS Dev chat, with desktop-preservation requirements. Antigravity was observed beginning to read the package. Codex's files in this package are plans and previews; they do not implement the application or establish deployment completion.

The user explicitly requires **full offline work with later synchronization**, alongside a complete, practical phone/tablet experience for Android, iPhone and iPad. This goes beyond responsive CSS and beyond adding a home-screen icon.

## Recommended direction

Keep the existing React application and laboratory services. Add adaptive phone/tablet views and one shared offline work engine. Deliver an installable web application, and include packaged Android/iOS applications with native durable storage in the production offline rollout. Do not promise that a browser cache or a thin WebView wrapper is durable laboratory storage.

The proposed mobile identity inherits the approved SoilFER signature design and existing light/graphite preferences. Every feature remains discoverable according to the user's actual permissions. Offline work is clearly distinguished from centrally accepted work.

## Read in order

1. [Implementation plan](IMPLEMENTATION_PLAN.md) — product decisions, technical boundaries, phases and delivery.
2. [Screen specifications](SCREEN_SPECIFICATIONS.md) — all modules, role navigation, phone/tablet behavior and task flows.
3. [Offline and synchronization contract](OFFLINE_SYNC_CONTRACT.md) — work packs, storage, commands, conflicts, authentication and recovery.
4. [Audit findings](AUDIT_FINDINGS.md) — verified source and live observations with limits.
5. [Acceptance and device tests](ACCEPTANCE_TESTS.md) — real-device and failure scenarios required for release.
6. [Research and platform decisions](RESEARCH.md) — official sources and practical implications.
7. [Antigravity handoff prompt](ANTIGRAVITY_PROMPT.md) — detailed implementation instructions.
8. [Active implementation request](IMPLEMENT_NOW.md) — user-authorized handoff, staged delivery and mandatory desktop protection.

## Visual review

The interactive phone study covers a shift home, a 40-sample method run, single-sample entry, drying/preparation, sample/workflow, reception, manager review, equipment and synchronization/conflict handling. It uses demonstration data and simulated device/sync states. Its interactions illustrate the design; they do not prove offline durability, scientific correctness or a working backend.

The package also contains `mobile-lab.fragment.html`, `review-preview.html`, prototype screenshots and `prototype-qa.json`. The conversation version is stored separately in the task's visualization directory. Design controls allow the reviewer to explore role, light/graphite appearance and phone/tablet presentation.

## Evidence

`source-audit.json` records 168 source files, 35 route declarations and 509 review candidates, with hashes and the concurrent dirty-worktree state. Counts are not confirmed defect counts. `ROUTE_COVERAGE.md` deliberately starts every route as pending application verification. `audit-mobile.cjs` performs a read-only source scan and writes only this package.

Antigravity's visual changes were in progress during this audit. The checkout subsequently advanced through visual commit `b3e3faa` to `16908a4`; this is a local Git observation, not production deployment verification. Reconcile against the finished visual/localization baseline before changing shared components. Mockup tests and read-only inspection do not certify the production application.

## Preview validation

Run `build-preview.cjs` to rebuild the standalone and conversation previews, then `verify-prototype.cjs` using Node with the installed Playwright runtime. These scripts operate on this isolated package. They do not start the LIMS, contact its API or save laboratory records. The screenshots are design studies; only demonstration numeric/panel validation is implemented. The real implementation must use the current method schemas and scientific services.

The source audit can be rerun to capture a new baseline, but retain the original evidence if comparing versions. The route design register is manually maintained and must not be replaced by generated placeholder rows.
