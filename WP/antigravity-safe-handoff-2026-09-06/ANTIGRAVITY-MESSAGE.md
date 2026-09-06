Continue in **C:\Users\yigin\Documents\soilfer-lims**.

We now have both uncommitted implementation changes and unfinished design plans. Read **WP/antigravity-safe-handoff-2026-09-06/START-HERE.md** first, then its manifest and release checklist. Verify the snapshot against the working tree and save a checkpoint commit before changing anything. The source changes are already in this folder; do not reapply the patch, reset the folder or overwrite newer work.

Review the catalogue/naming/entry safeguards already implemented, then complete the connected laboratory-operations v3 plan while preserving sample-workspace v2, spectral provenance, approvals and amendments. Keep an evidence ledger for all requirements. The saved 120 server tests and 16 fixture-browser checks are baseline results, not completion of the whole redesign.

You are authorized to implement, commit, push and deploy. Proceed in the phases and release gates documented in START-HERE.md: integrate and test, rehearse an idempotent migration on an isolated copy, preserve and verify database/files backups, then deploy the exact tested commit/image. Resolve the current startup script's automatic schema push/seed behaviour before production migration. Do not replace the live catalogue with a force-clean seed or test mutations on real laboratory records.

Finish with the deployed commit/image, migration and preservation report, actual acceptance evidence and any remaining laboratory SOP/instrument configuration. Do not declare the whole redesign complete merely because it builds.
