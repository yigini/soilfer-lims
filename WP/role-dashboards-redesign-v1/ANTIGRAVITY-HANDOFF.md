# Antigravity execution instructions

Project **LIMSI**, task **LIMS Dev**, working folder **C:\Users\yigin\Documents\soilfer-lims**. Keep the existing model/settings. This package is the next coordinated dashboard work, prepared at the user's request. Earlier authorization to implement, push all intended changes to GitHub, test, deploy to production with backup/verification and reconcile issues last remains in force.

## First reconcile, then implement

Finish and verify the current reception correction before starting this broader change. Reception commit `3c4121a` and subsequently merged `cdcc2cb` appeared during preparation. The latest source uses composeWhere for reception queries; earlier D13/D14 findings were sent during implementation and you reported corrections. Recheck latest HEAD and evidence, do not revert those fixes. No old snapshot restoration or dirty-file overwrite.

Read this entire packet in order: README.md, source-audit.md, contracts.md, role-control-matrix.md, implementation-plan.md and acceptance.md. Open prototype.html with its sibling CSS/JS/assets, inspect all ten roles and the failed-refresh/empty/blocked cases. The design is synthetic; its route previews deliberately do not act on production. `dashboard-contract.reference.cjs` contains tested examples of contract mechanics, not production authorization/eligibility. Adopt only after adapting to the real schema and policy.

The user wants practical laboratory home screens with complete connections. Prioritize the shared meaning of counts, readiness and permissions before styling. Do not merely apply the mockup skin to the old endpoints.

## Work to complete

1. Resolve role/scope/capability mismatches, including missing dashboards for audit, field and external users, and restricted report/detail/PDF paths. All ten registered roles need a functioning useful home. Never turn a legacy unknown role into privileged access.
2. Correct count definitions, exact grouped pagination and default queue selection. No 200/500-row truncation; no expected samples in drying/prep; no data failure reported as zero. Enforce AND-composed access filters everywhere.
3. Share tested readiness and final-approval rules across home, workbench, sample and commands. Existing sample/workspace flags conflict in places; audit and reconcile instead of trusting them blindly. No result draft before prerequisites, no missing QC treated as pass, no approval from receipt/dry/prep alone.
4. Build the restrained queue-first design. Technicians work by method/revision/run, including forty-sample worksheets, checklists, texture groups and spectra. Managers see actual decisions; reception has one intake flow. Preserve every existing control listed in the coverage matrix at its proper destination.
5. Implement both ends of each deep link and scoped filter. Recheck destination authorization and command state; no mutation on dashboard click. Fix update/error/scope-switch behavior and scoped invalidation events. Missing lab cannot mean global private event broadcast.
6. Complete acceptance.md with real integration and browser evidence, retain existing regressions, and push the intended source/assets/tests/docs through PR and successful CI. Deploy the exact tested image with a fresh coordinated backup and verified restore compatibility; check live read-only journeys. Record commit/image/backup/health and remaining limitations.
7. Reconcile GitHub issues last. Close only fixes demonstrated in the candidate and production verification where required. Open/reopen remaining relevant defects without duplicates; never close everything based only on a green build.

Scope is dashboards and their required connections. No production fixture records, bulk historical state rewrite, invented GPS/receipt dates, scientific tolerance changes, destructive DB cleanup, new generic task framework or unrequested dashboard personalization system. Use the existing stack/brand/language system. Do not block on routine permission already granted; if a real unresolved laboratory policy decision prevents safe implementation, explain that specific point and continue independent work.

## How to speak to the user while working

The user explicitly requests simpler, friendlier progress messages. Give a short summary when something meaningful changes or a phase finishes, and enough periodic progress that the user knows work is continuing. Explain the practical effect first, then what you are checking and what remains. Put technical evidence, command output, raw identifiers and detailed test logs in the project files.

Good examples:

- “Reception now separates samples that have arrived from field records still expected. I’m checking that every number opens the right list.”
- “The technician home now groups work by method, so forty pH samples open together. I’m checking saved runs and samples that are still waiting for preparation.”
- “The review screen now uses the same approval rules as the sample page. I’m testing a case where someone changes the sample while a manager is reviewing it.”
- “The changes passed the local checks. I’ve pushed them to GitHub; the cloud checks are running. Deployment is next if they pass.”
- “The new version is live. I checked reception, technician work and manager review. One issue remains: [specific issue and impact].”

Avoid repeated timer/wait announcements, unexplained gate numbers, “reconciliation/hydration/projection” jargon in progress messages, robotic “executing phase...” narration, exaggerated praise, or blanket “zero issues / fully verified” claims. The user needs an understandable progress summary, not hidden reasoning. Distinguish prepared, implemented, tested and live.

## Evidence files to maintain

Add an implementation ledger mapping D01–D26 and A01–A46 to changes/tests/screenshots. Preserve failing expectations until repaired. Capture actual browser outcomes across all roles, scope changes and supported languages; screenshots from the prototype are design assets, not application evidence. Record release results in a concise deployment receipt and link it from the GitHub issue/PR. Preserve secrets and private records outside published evidence.
