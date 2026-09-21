# Ready-to-send Antigravity plan

Work in `C:\Users\yigin\Documents\soilfer-lims`; verify the checkout and current baseline first. Read these files in order:

1. `WP/project-management-country-kobo-v2/REVIEW.md`
2. `WP/project-management-country-kobo-v2/IMPLEMENTATION-PLAN.md`

The product direction is confirmed: this is a generic laboratory project platform with a versioned SoilFER template. New projects must onboard with Kobo, open intake or walk-in samples without inheriting SoilFER-specific rules. Existing predefined-manifest projects must continue working.

For SoilFER, create separate projects for the seven currently configured countries: Guatemala, Honduras, Ghana, Kenya, Zambia, Mozambique and Tunisia. Migrate existing and future samples into their country projects while preserving identifiers, analytical results, original programme provenance, audit history and released reports. Keep USA/Japan as programme/reporting groupings. Kobo is the default registration source, with explicit recorded manual/CSV exceptions. Platform admins manage connections and exceptions; lab managers may do so only within their own lab.

The review identifies fifteen current source issues, including Open Intake seed definitions, hidden existing connections, broken Kobo project creation, null-project connection saves incompatible with sync, unknown-ID intake bypass, lifecycle inconsistencies, wrong-form/insufficiently-scoped single-sample resync, mismatched project IDs/codes, capability overrides and misleading status/help text. Repair the shared contracts and all connected readers/writers, not just visible labels.

Preserve recent physical-receipt, membership, import transaction/cursor and historical-data safeguards. Use a common project policy and precise capabilities; avoid SoilFER name checks and separate duplicated workflows. Demonstrate generic Kobo/open-intake/walk-in journeys alongside SoilFER country migration acceptance.

Audit source was `762c46e`. Local read-only database findings are not production truth. The reviewer's live browser session was expired, so establish the actual deployed revision and authenticated inventory. Do not import the local development database or run mutation probes against production.

This is an implementation plan prepared for handoff, not proof of implementation or new production-deployment authorization. Follow the user's current instructions in the receiving task for execution and deployment. Produce the documented migration dry run, integrity/access evidence and reviewable changes before any authorized cutover. Report concrete conflicts and preserve unresolved records rather than guessing country, lab, programme, grants or form mappings.

Keep updates short and practical. Report completion against the acceptance matrix, with exact evidence and remaining exceptions.
