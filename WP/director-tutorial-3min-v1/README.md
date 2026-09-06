# Director meeting walkthrough — three minutes, English

**Status: user approved implementation, GitHub push and safe deployment on 6 September 2026.** Read [IMPLEMENT-NOW.md](IMPLEMENT-NOW.md) first. This approval satisfies the earlier preview gate; preparation of the demonstration data remains restricted to the isolated rehearsal environment.

## The show

**Five samples. One traceable laboratory journey.**

A calm guided overlay follows five clearly labelled SOILFER-US demonstration samples through login, role-specific home, Kobo field provenance, reception, assignment, preparation, method worksheets, spectroscopy, review, workflow map/report and SIS exchange preview. It closes with the proposed real-laboratory pilot.

The main story visibly includes **multilingual interface options, equipment, inventory, the analysis bench and the workflow map**. Optional detail is available for questions. It is not a three-minute reading of every menu.

## Review these assets

- **[preview.html](preview.html):** clickable mockup, twelve scenes, 3:00 timed replay, Back/Next, scene chooser, presenter notes and optional feature details. There is no connection to LIMS. The inline version also offers spotlight/docked guide design variants.
- **[presenter-script.md](presenter-script.md):** timed English narration generated from the storyboard; 358 words at the reviewed version.
- **[implementation-plan.md](implementation-plan.md):** real application overlay, data isolation, roles, integration, multilingual design and rollout.
- **[source-and-feature-map.md](source-and-feature-map.md):** current routes, gaps and full feature coverage.
- **[acceptance-and-rehearsal.md](acceptance-and-rehearsal.md):** delivery checks and meeting run sheet.
- **[ANTIGRAVITY-HANDOFF.md](ANTIGRAVITY-HANDOFF.md):** approved implementation instructions, with the current authorization in IMPLEMENT-NOW.md.
- **[storyboard.json](storyboard.json)** and **[fixture-manifest.json](fixture-manifest.json):** stable scene definitions, timing, anchors and the five synthetic sample specifications.

## Proposed entry link

`https://lims.yigini.net/login?tutorialmode=true&tour=director-3m&lang=en`

This URL is a **proposed feature**, not an existing deployed link. A root `/?tutorialmode=true` entry should resolve to the start safely. Support the user's `tutirialmode` spelling as an alias and canonicalize it.

The recommended operational show uses the **same application build in an isolated demonstration deployment**, opened from that entry link. Actual production annotations can remain read-only. A query parameter alone must never enable sample processing, role impersonation or credential access in production.

## What the mockup does and does not prove

It shows the presentation style and story. The five readings, sample names, preparation states, spectrum and report are synthetic illustrative states. The spectrum files named in the manifest are planned fixtures, not supplied instrument exports. The underlying application screens are sketches, not captured live screenshots. Production implementation must use the real pages and commands.

No real samples were received, dried, prepared, measured, approved, exported or otherwise changed. No external Kobo sync, SIS transmission, credentials or Antigravity execution was triggered by this package.

The closing claim is deliberately **“Next: controlled testing in a real laboratory.”** Use “ready for controlled testing” only after the final application/workflow checks have passed on the demonstrated build. A polished tutorial is not proof of pilot readiness.
