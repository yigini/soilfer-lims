# Connected workbench, catalogue and dashboard follow-up

**Updated handoff:** Start with `WP/antigravity-safe-handoff-2026-09-06/START-HERE.md`. Catalogue, naming and execution safeguards now exist as uncommitted source changes. Checkpoint and review them before implementing the remaining plan. The instructions and inventory below describe the earlier planning baseline; they are not a command to replace current code.

Work only in `C:\Users\yigin\Documents\soilfer-lims`. Read all material under `WP/lab-operations-redesign-v3` together with `WP/sample-workspace-redesign-v2` before implementation. Inspect current Git state and preserve overlapping/unrelated work; this audit's baseline is `bee0b6e`.

The latest user report concerns Elena's S004 drying worksheet, preparation gates, practical 40-sample method batches, texture as one order/task with grouped fraction results and derived class, other catalogue families, and correct dashboards for every user group. This is a connected implementation, not a UI relabeling.

Start with O1 containment: explicit task kinds, no scalar drying fallback, real typed preparation evidence, no analytical result drafts before prerequisites, no silently skipped array/checklist drafts, no fabricated `[true]` checklist, shared preview/commit validation, truthful per-item save receipts, and scoped dashboard submissions. Do not preserve a legacy endpoint that bypasses these checks.

Then implement O2–O8: versioned orderable/procedure/output definitions; method/material-specific preparation; batch-centric workbench using existing Batch/QC entities; one texture task and atomic three-fraction result set with independently verified class; canonical results/reports/amendments; shared scoped dashboard counts, priorities, links, refresh and role coverage; migration and regression tests.

Read the 32 source findings and actual utility probe results. The current calculator misclassifies 50/35/15, 20/50/30 and 45/20/35; it also accepts negative or missing fractions. Do not copy those conditions into tests as the expected answers. Use the cited USDA boundaries and test all 12 classes. A universal ±2% closure tolerance and silent normalization are not approved scientific policies.

The catalogue register inventories 214 seeded analyses and 543 methodologies, including 38 active placeholders. It is provisional triage, not a scientifically validated production catalogue. Compare live definitions, lab defaults and historical orders before migration; verify required lab method/SOP settings without inventing instruments, units or evidence. Preserve measured, calculated and predicted outputs distinctly.

The HTML prototype uses synthetic data only. Its 58 passing checks validate the demonstration, not application behavior. The separate 100-case acceptance checklist defines implementation verification. Preserve all revision-2 controls and approvals/amendment/report requirements while changing the workbench and catalogue.

Deliver a tested implementation with explicit migration and old-data impact reports, exact pushed/deployed commit where deployment is authorized, production verification and any unresolved method configuration. Never mark production acceptance or instrument/SOP checks passed solely because the mockup or a build passed. Do not mutate real sample records for testing or silently rewrite approved results/released reports.
