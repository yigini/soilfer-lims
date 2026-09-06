# Handoff for Antigravity — approved to implement and deploy

**The user explicitly approved implementation and safe deployment on 6 September 2026.** Read IMPLEMENT-NOW.md first and proceed without requesting the same preview approval again. The earlier preview gate is satisfied. Normal verification and protection of genuine lab data still apply.

Project: **LIMSI**. Chat: **LIMS Dev**. Folder: **C:\Users\yigin\Documents\soilfer-lims**. Packet: **WP/director-tutorial-3min-v1**.

## Requested outcome

A **three-minute English** guided show for a director's project meeting, starting at login and following **five SOILFER-US demonstration soil samples** through field provenance, physical reception, assignment, drying/preparation, analysis bench, spectroscopy, scientific review, workflow map, report and SIS exchange preview. The main story must also visibly include **multilingual support, equipment and inventory**. Additional features are optional questions, not extra mandatory minutes.

Read README, storyboard.json, presenter-script.md, fixture-manifest.json, implementation-plan.md, source-and-feature-map.md and acceptance-and-rehearsal.md. Open preview.html and inspect the interactions before designing your implementation. The English mock uses synthetic states; it is not a replacement UI or a scientific validation result.

## Proceed with implementation

1. Reconcile latest HEAD, current Workbench changes and deployed build. Follow current source, not older snapshots. The audit baseline was c996beb; recheck it.
2. Update your implementation plan with all T01–T30 checks and the exact rollout/isolation choice. Default to the same application build in a separate rehearsal deployment entered from `/login?tutorialmode=true&tour=director-3m&lang=en`. Production annotations can be read-only. A query parameter must never make production safe for demo writes or impersonation by itself.
3. Generate five fresh synthetic SOILFER-US rehearsal samples with consistent orders, real core-command receipts, preparation evidence, method results, five parser-verified spectral files, proper submissions/reviews and watermarked reports. Existing production samples, including W001, are out of scope. All checkpoints follow the same demonstration identities; time compression is explicit.
4. Add a reusable route-aware overlay on actual pages with stable data-tour anchors, permission/context checks, readable captions, gentle spotlight/docked layouts, manual/timed navigation, notes, optional detail, pause/error/exit/resume and deterministic checkpoints.
5. Do not omit multilingual UI/tour strings, equipment/stock subbeats, the actual workflow map, grouped analysis bench or spectral library. Narration remains English by default. Do not present incomplete translations as a fully translated tutorial.
6. Treat Kobo and SIS honestly: dedicated test data or recorded provenance, redacted previews, no secret/config screens and no actual national delivery without an acknowledged test exchange. Inspect the SIS server's actual released-data filtering before claiming approved-only exports.
7. Validate all five samples and the actual live-page sequence; test RBAC, language/viewport, failures, timing, cleanup and absence of production mutations. A 180-second mock timer and synthetic screenshot are not sufficient evidence.
8. Use the normal reviewed GitHub PR/CI/deploy process only after design approval and checks. Keep the lab-data changes in rehearsal. Record exact build, feature flag, links and rollback. Do not replace production DB with a demo/local DB or automatically share/send demonstration reports.

## Communication

Use short, friendly updates explaining what a person will see and what remains to check. Example: “The guide now starts at login and follows all five demonstration samples. I am checking that language changes keep the same scene, and that the map and report match.” Avoid repeated waiting messages, hidden reasoning, unexplained acronyms and premature claims of readiness.

The closing message is a proposed **controlled real-laboratory pilot**. Use stronger readiness wording only after an actual readiness sign-off. Return the implementation plan, a working preview URL after deployment, final three-minute script, rehearsal evidence, GitHub/CI/build IDs and any unmet checks. Do not close issues or claim the pilot is complete merely because the show runs.
