# Implement the complete replacement — latest user instruction

Date: 10 September 2026. Project **LIMSI**, active chat **LIMS Dev**.

The user has reviewed the v2 package and now requests that it be sent to Antigravity for full implementation and replacement of the existing Knowledge Base/Help. The user also suggests rolling back and removing the previous work. The authorized outcome is one coherent v2 Help & lab guide, with complete, practical content and no competing old Help experience.

Work only in **C:\Users\yigin\Documents\soilfer-lims**. Inspect the current branch, worktree changes and active work first. The design was audited against commit `691582487e04b5e29bccbf338d54ea9bf4e1434d`; reconcile subsequent changes rather than overwriting them. This file supersedes any earlier sentence saying implementation authorization is still pending.

## Replace the experience; retain valuable records

1. Implement the new reader, role home, problem solver, learning paths, reference/FAQ and content studio in the actual application. The HTML preview demonstrates design and interaction; it is not a production frontend to embed or deploy unchanged.
2. Fully replace the old generic Help home, shallow article presentation, weak bodies and generic specialist-page mappings with verified v2 equivalents. Do not leave two user-facing Knowledge Bases or a separate competing Help button. Keep `/help` and the established compatible article/topic/FAQ routes canonical.
3. Preserve immutable article identities, publication/revision history, existing useful links, scoped local guidance, feedback and user preferences. Rewrite or supersede old content through new revisions. Old bodies can be archived/superseded and removed from current search/recommendations when their verified replacements publish. History is not active duplicate content.
4. Use `migration-map.json` to reconcile all 27 existing source articles against the actual database. Inventory identifiers are writing-brief scopes, not instructions to create duplicate article identities. Preserve meaningful old URLs and section links with specific successor mappings.
5. Once the new path passes its tests, remove unreachable old reader components, obsolete styles, duplicate content loaders and unused old frontend assets, after tracing imports and runtime references. Preserve temporary compatibility adapters until the migration/offline compatibility window permits their removal. Produce a keep/replace/remove table in the completion report so retirement is verifiable.

## What rollback means here

Do not begin by reverting a series of old commits, dropping Help tables, deleting publication/audit history or wiping the current content. Previous commits may include permission, translation, publication and unrelated LIMS fixes. A broad rollback could undo them and leave users with no usable Help.

Use a controlled replacement: preserve the current working release, build and test v2, publish the approved replacement content, and switch the existing Help entry points to v2. Back up the code/image reference and versioned content/publication state using the established secure process. Verify backup restoration and code/content compatibility before cutover. Keep backup artifacts out of Git and ordinary public assets.

If an actual regression requires rollback during deployment, restore the last verified compatible application/content pair through the established release process. Do not reset the entire laboratory database or remove pending offline operations to roll back a Help change. Routine obsolete-code cleanup is authorized; a destructive data reset is neither necessary nor requested as the implementation method.

## Full scope and publication gate

- Finish the 96 commissioned task scopes across all enabled features. Meaningful merge/split is allowed with explicit coverage. Eight English examples and 17 FAQ answers establish the minimum clarity standard; they are not the entire finished collection.
- Cover all ten configured roles, all 42 audited route declarations and their meaningful tabs/control/blocker contexts, then reconcile any newer routes. Permission and lab/project scope remain authoritative.
- Produce complete en, es, es-419, fr and pt content: bodies, figures/captions/alt text, fields, examples, recovery branches, glossary, reader UI, editor and errors. Prototype language demonstrations are intentionally partial and must not be counted as production translations.
- Bind instructions to real labels, state transitions, input families and enabled capabilities. Capture annotated actual-UI figures with synthetic records. Preserve scientific distinctions and use applicable controlled SOP/vendor evidence. Never fabricate operating conditions, supported file profiles, reviews or approvals.
- Keep the full practical workflows: preparation receipts; batch result entry and exclusions; record versus submit; manager review and final release; texture panels/derived classes; spectra, QC and predictions; equipment and inventory; intake/source-location issues; mobile/offline recovery; KoBo/SIS; configuration and translations.
- Help must preserve the technician's unsaved values, selections and pending offline work. It never marks an analysis complete, changes a result, approves a sample or takes over the workflow's permission/readiness logic.
- Every active page must have meaningful applicable help or an honest, useful availability explanation. Generic support links and empty responses do not count as completed page guidance.

Follow all files in this package, especially `02_IMPLEMENTATION_PLAN.md`, `03_CONTENT_STANDARD.md`, `06_TECHNICAL_CONTRACT.md` and `07_VALIDATION_AND_RELEASE.md`. Build the batch/drying vertical slice first and show its progress, then continue to complete the full authorized scope without stopping for another generic go-ahead. If real missing information prevents a scientific claim, isolate that claim and continue application guidance; disclose the exact dependency instead of inventing a review.

## GitHub, deployment and final checks

Commit the intentional implementation, content, tests and documentation in reviewable groups; include this handoff/design package where appropriate. Push to the correct GitHub repository and branch using the existing delivery workflow. Do not add credentials, backups, runtime databases, real laboratory exports or unrelated local work.

Build and test the actual production artifact. Test migrations against a safe fixture and prove current published content remains available during transition. Deploy after the relevant release gates pass; publish the verified coherent replacement collection rather than only the Help button or empty UI. Verify the live role views, language bodies, contextual drawers, deep links, authorized search, offline behavior and report the exact code/content/image revisions and remaining exceptions.

Update the relevant GitHub issues with concrete evidence. Inspect issue #92 and linked work before deciding whether to reopen it or create a follow-up. Close only the scope actually delivered; do not mark the whole handbook complete while important bodies remain briefs or fallback English. Avoid duplicating existing issues.

## Communication with the user

Use friendly, short, plain-English updates. Say what is improving and what you are checking. Explain a real blocker and its practical consequence without long internal technical monologues. Examples:

- “The drying guide now names the correct confirmation button and explains the receipt. I am checking the same instructions in the technician view.”
- “The new Help pages are working locally. I am filling the remaining guides and checking all five languages before replacing the live version.”
- “The new version is live. I checked the key technician, intake and manager pages, and the previous Help layout is no longer active.”

Make those claims only when supported by evidence. Report design implementation, content completion, translation status, publication and deployment separately. The user wants the complete replacement carried through, not another plan-only response.
