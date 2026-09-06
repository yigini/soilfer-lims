# Approved: implement and safely deploy the director tutorial

Authorization recorded 6 September 2026, after the user viewed the mockup. The user asked: “ask antigravity to quickly and safely deploy this”. They also expressed concern about changing the real LIMS. The explanation given is that an actual overlay needs new UI files and small connections to existing pages, while normal laboratory behavior and genuine records must be preserved.

This instruction **satisfies and supersedes every earlier preview-approval hold in this packet**, including the historical status embedded in storyboard.json, preview.html and the presenter script. Do not pause to ask the same design approval again. Implement, validate, push the reviewed changes to the correct GitHub repository and deploy through the project's established process. Do not treat unrelated changes from another task as part of this commit.

## Scope and speed

Work in `C:\Users\yigin\Documents\soilfer-lims`, project LIMSI, chat LIMS Dev. Read ANTIGRAVITY-HANDOFF.md and the linked packet. The source audit was at c996beb; current HEAD at handoff is fe171e4. Start from the latest project state, preserve intervening work and avoid broad refactors.

Deliver the approved 180-second English tour, twelve scenes, five clearly labelled SOILFER-US demonstration samples, and the requested multilingual options, equipment/inventory, batch analysis bench, workflow map, spectroscopy/library, Kobo provenance, review/report and SIS preview. Optional detail must not lengthen the main show. Use the real page components for the implemented overlay. The mockup is a visual reference, not a replacement application to publish as if it were the live LIMS.

Keep new tutorial code and styling in a dedicated module. Existing files should need only the small integration points justified by the real-page guide: opt-in route entry, provider, stable target attributes, locale strings and necessary tour-intent persistence. The guide must be absent during ordinary LIMS use. Preserve result entry, preparation, approvals, permissions, catalogue, calculations and existing API contracts. No production schema or data migration is requested for this tutorial. Report any necessary wider change before including it.

## Demonstration boundary

Use the same application build in an isolated rehearsal deployment, entered from the main site's tutorial link as described in implementation-plan.md. The production site's optional guide is read-only. Demonstration processing, snapshots and persona switching must not reach the production database, file store, queues, notifications, Kobo forms or national SIS receivers. A query flag or per-row “demo” tag is not adequate isolation. Do not copy or replace a production DB to set up this show. Do not create or approve real samples to demonstrate it.

Prefer the smallest proven implementation. If the complete isolated operational rehearsal cannot be made ready quickly, report the concrete blocker and a labelled read-only alternative; do not silently publish a mock screen or pretend a real operation succeeded. The user expects the actual site with a guide.

## Verify, push, deploy and report

Follow acceptance-and-rehearsal.md. Check the guide absent, enabled, interrupted and exited; normal login/navigation and role restrictions; five-sample identity/evidence consistency; map/report links; timing, language and responsive placement. Real drying and analysis use recorded checkpoints and must not appear to happen instantly. Keep secrets hidden and SIS in preview until any actual delivery is acknowledged.

Push only intended source and durable handoff assets; exclude node_modules, local databases, credentials, uploads and incidental captures. Use the existing GitHub/CI/deployment workflow, record the deployed commit, retain the rollback switch, and check the actual tutorial entry plus ordinary site use after deployment. If tracking issues are updated, close only those whose stated acceptance checks have passed, with evidence.

Return the exact working tutorial URL, deployed commit/CI status, demonstration environment boundary, the files that connect to the existing LIMS, test results and any remaining limitations. Do not say it is live based only on a successful local build. Keep updates short and friendly: what now works, what is being checked and what remains.
