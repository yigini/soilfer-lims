# Laboratory management — audit and implementation package

**Prepared 11 September 2026 · local baseline `ecb7c91aee041febfb60de51d248f322b6d6376c`**

The laboratory-management screens need a functional repair, not just a visual refresh. The highest risks are inconsistent authority over staff and labs, shared credentials, project/integration access and a separate offline result-writing path.

This package contains **29 findings: 4 Critical, 18 High, 7 Medium**. The priorities describe potential impact, not evidence of an actual incident. It is ready for Antigravity to implement in phases. It is **not a production readiness certificate**.

## Start here

1. Open [the interactive preview](review-preview.html). It uses fictional staff and data; its actions only affect the preview in memory. Try People → Review access, Projects → Review project access, and Administrator → Settings → Review pause.
2. Read [the evidence register](01-audit-findings.md) and [implementation plan](02-implementation-plan.md).
3. Use [the role and API contracts](03-policy-and-contracts.md), [dependency map](04-connections-and-migration.md) and [acceptance/release checklist](05-acceptance-and-release.md).
4. Give Antigravity [the complete handoff prompt](ANTIGRAVITY-PROMPT.md), with this entire folder.

## What was checked

- Read-only live browser review as the previously authorized administrator: login, dashboard, laboratory list, lab edit/deep link, staff list and Add User form. Forms were closed without saving. The live interface showed nine labs, one inactive lab, and eight missing-timezone warnings at the time of review. Counts are observations, not migration input.
- Source tracing through lab/user/project routes and controllers; canonical role registry; HTTP authentication, impersonation and WebSocket lifecycle; scope guard; work assignment; offline packs and synchronization; equipment; inventory location transfer; language settings; method-default configuration; dashboard integration and relevant client pages.
- **31 reproducible VM checks** against actual handler/source code with synthetic dependencies: 29 finding checks and two positive controls. Every described behavior reproduced. See [results](probe-results.json) and [runner](audit-probes.cjs).
- The latest local commit includes Help v2 and its feedback correction. Preserve that work and all existing workbench, spectral, mobile, language and theme improvements.

## Evidence limits

The local code baseline was verified. The exact server commit was **not** independently matched to that baseline. Live administrative mutations were deliberately not tested. Synthetic adapters do not enforce Prisma/SQLite constraints, real transactions, middleware mounting, rate limits or browser sessions; write-path reproduction is not proof of a committed production write. Actual database/API regressions on an isolated database are release requirements.

This was a deep source/UX audit of laboratory governance and its connected paths, not a penetration test of every endpoint, an exhaustive scientific-method audit, or a scan of production data. Remaining verification is specified explicitly rather than marked as passed.

## Preserve these working protections

- Main Users API rejects a lab manager editing a user in another lab; its list filter cannot be overridden by a query labId.
- HTTP authentication checks the current database role, account status and token version; password change increments the version.
- Assignment prevents a technician from another receiving lab being assigned, including when the actor is a super administrator.
- Lab-method defaults validate every selection before transactional update and verify method availability in the lab.
- Dashboard already has a dedicated scope/eligibility service and working lab-configuration deep links. Integrate it; do not build a second dashboard engine.
- Inventory already uses transactional quantity and audit operations in several commands. Retain those invariants.
- WebSocket lab broadcast refuses missing lab IDs. Correct the event producer rather than making broadcasts global.

## Files and reproduction

Run only the isolated audit runner from the repository root:

```powershell
node WP/lab-governance-audit-v1/audit-probes.cjs
node WP/lab-governance-audit-v1/build-evidence.cjs
```

These scripts read source and write evidence inside this folder. They do not import Prisma, start the server, connect to a database or access the network. `reproduced: true` means the described current behavior exists; it is **not** a passing security regression. After implementation, preserve the original evidence and add a separate real regression report.

Keep detailed security evidence and exploit-oriented regression fixtures in the private project/security workflow. Public release notes should describe the fixes without disclosing credentials, customer data or actionable unpatched bypass details.

Only this new `WP/lab-governance-audit-v1` folder was created for the audit. No LIMS source, account, database, Git commit or deployment was changed.
