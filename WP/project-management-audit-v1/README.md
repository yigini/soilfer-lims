# Project management: audit and implementation handoff

Prepared 13 September 2026. **Planning package, not an application release.**

The redesign should make a project a reliable coordination workspace: what is expected, what physically arrived, which laboratory is responsible, what is blocked, and what has been released. Results continue to be recorded in the workbench. Project administration must not silently change sample history or grant access to another laboratory.

## Review order

1. Open [review-preview.html](review-preview.html). This is an interactive, offline design proposal using synthetic data. Try the role selector, project selection, attention filters, sample stages, analysis plan, labs and people, import preview and lifecycle dialog. No action contacts the LIMS.
2. Read [01-audit-findings.md](01-audit-findings.md): live observations, source defects and 14 isolated API/service probes.
3. Implement [02-implementation-plan.md](02-implementation-plan.md) and [03-contracts-and-connections.md](03-contracts-and-connections.md).
4. Use [04-acceptance-and-release.md](04-acceptance-and-release.md) as the completion gate.
5. Paste [ANTIGRAVITY-HANDOFF.md](ANTIGRAVITY-HANDOFF.md) into the correct Antigravity project chat.

## Most urgent findings

- Archive can save `COMPLETED` and then return HTTP 500 because the response helper arguments are wrong.
- Project trash rewrites even released samples to `RESTORE:<project>` and removes their project relationship.
- Different endpoints disagree about project visibility, sample scope, edit rights and servicing-lab membership.
- Removing all servicing labs can cause country-based fallback to add them back into resolved membership.
- The live SoilFER US project row says total volume **0**, while its statistics show **26,603 expected samples**.
- Project creation can claim success after its manifest sample creation fails.

## Evidence and limits

Source baseline: `aeb62f7fac91412ea23a7c6871f0f7370d656a23`, local branch `codex/lab-governance-v1`. PR #94 was still open when checked. **This source is not proven to be the deployed revision.** Antigravity must establish the actual deployment and upstream baseline before implementing; preserve the existing lab-governance work.

Live review: authenticated administrator, `https://lims.yigini.net/projects`; list, statistics and settings inspected without saving. Other roles were exercised with synthetic local principals, not by manipulating production accounts. Kobo/SIS remote exchanges and released reports were not modified or exercised against production. Source tracing identifies their dependencies; integration acceptance tests remain required.

`audit-probes.cjs` mounts only the real project router/auth middleware against a new temporary database containing schema and synthetic fixtures. It never loads the full app or integration scheduler. `probe-results.json` records outcomes; the source database SHA-256 was unchanged. `probe-console.log` contains fixture diagnostics. These are **defect demonstrations**, not passing release tests. Reruns overwrite the evidence report, so preserve the baseline report before rerunning after fixes.

Only this WP package was added during this task. No application code, real sample, project, user, production configuration or deployment was changed. The pre-existing untracked lab-governance handoff was preserved.

## Product decisions built into this proposal

- An explicit project grant or lab relationship is required; a matching country is not a servicing-lab grant.
- Lab managers manage their own lab's work; shared-project membership does not make them owners of the whole project.
- A project pause stops new admissions/imports; work already physically received can continue. Use a separate controlled operational hold if existing work must stop.
- Closing admissions, completing scientific work and archiving a project are different operations.
- Project defaults affect future orders. Changing a bundle never silently rewrites existing work or released results.
- Archive preserves history; no project operation uses sample unlinking as a visibility mechanism.

The preview illustrates these decisions. The contracts and acceptance criteria are authoritative for implementation; mockup numbers, people and connection states are demonstration data.
