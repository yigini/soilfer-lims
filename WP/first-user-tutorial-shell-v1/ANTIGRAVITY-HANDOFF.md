# Antigravity handoff — first-user tutorial shell

Project **LIMSI**, working directory **C:\Users\yigin\Documents\soilfer-lims**, conversation **LIMS Dev**.

**Implementation is approved. Read this directory's IMPLEMENT-NOW.md first.** The user wants a beautiful, temporary, hidden tutorial overlay for first-time users, distinct from Help pages, teaching laboratory steps and account roles in a logical order. They require subtle visuals and minimal existing-file changes. This package's current authorization supersedes its earlier draft-only wording; the older director package is historical context only.

Read in this order:

1. `WP/first-user-tutorial-shell-v1/README.md`
   Then `absolute-beginner-foundation.md`: the visitor may know only the name LIMS. This revision is mandatory.
2. `review-preview.html` in a browser; exercise the working controls, not just its opening screen.
3. `implementation-plan.md`
4. `journey-and-copy.md` and `source-notes.md`
5. `acceptance-checklist.md`

## Outcome to implement

A lazy, optional tutorial module activated through `/login?tutorialmode=true&tour=first-visit&lang=en`, also root `/?tutorialmode=true`. No permanent navigation/menu entry or first-login popup. Offer a 3-minute illustrated overview with no account required, a 16–18-minute full beginner story and individual role paths. Start by expanding LIMS, explaining connected records, navigation, who acts next, access/help and saved-versus-submitted work. Then teach identity and provenance, reception, equipment/inventory, procedural gates, batch work, grouped texture, spectral files, submission, review with reason, map/history/report and Kobo/SIS meaning. Support **en, es, es-419, fr, pt**. Expand acronyms at first use and provide a keyboard/touch-accessible per-lesson glossary.

Build the real overlay on existing pages, using the preview as a visual reference. Do not deploy the reconstructed HTML preview as if it were the real application. Keep new code in `client/src/tutorial/`, with one small App.jsx attachment outside Routes. Add only a bounded, documented set of inert stable anchor attributes if necessary. Preserve existing desktop/mobile appearance, RBAC, authentication, validations, sample/result statuses, APIs, offline drafts, integrations and Help Centre. No backend/database migration is needed for the recommended first release.

Current working tree has ongoing workflow corrections: inspect before editing and do not reset, replace or commit somebody else's changes accidentally. The tutorial must not mask failures identified in `WP/project-management-audit-v1/44-review-of-final-journey-claims.md`. Keep the operational corrective implementation distinct from tutorial work.

## Rules that prevent a misleading or disruptive tour

- Real pages may be annotated within the user's actual permission scope. Exercises are guide-owned synthetic controls only. Workbench edits can autosave; spectral preview stages files. Do not type into live fields and claim no changes because Save was not pressed.
- Do not intercept/forge API results, modify underlying page state, force sample statuses, auto-submit/approve or create labs/projects/users for the show. Do not trigger Kobo/SIS/notifications, generate report shares or consume inventory.
- An overlay is not a production sandbox. A complete true write-through training experience needs a separately isolated deployment and is optional follow-on work, not silently added here. Existing background outbox sync may continue independently; don't disable it to satisfy a tutorial claim.
- Use normal sign-in. Never impersonate roles or inject tokens. Provide role/account guidance; passwords go through a separate facilitator access sheet, not a public asset or URL. No shared super-admin shortcut.
- Auth bootstrap can be unknown. Verify current identity through the established /auth/me contract; discard stale responses after changes. Preserve only harmless lesson progress across sign-in and clear live targets. Respect forced password change.
- A missing or unauthorized target gives an honest illustration/retry/role explanation. Do not guess a selector or silently mark an unavailable lesson as completed.
- Preserve normal forms/drafts on Exit. No global CSS or auth/router rewrites. No service worker added for this temporary feature.
- Show actual locale availability. Complete all five copy sets, including scientific terms, validations and screen-reader labels; don't describe English fallback as finished translation.

## Implementation and delivery

Follow the seven implementation phases and T01–T24. Keep commits focused and document every existing file changed. Implementation and safe delivery are authorized as recorded in IMPLEMENT-NOW.md. Use the established GitHub/CI/production process, retain rollback, verify the deployed build and exact entry URL, and verify the normal app with the flag absent. Do not deploy evidence-only docs as an application fix. Do not close unrelated GitHub issues on account of this tutorial.

Report real progress in short, friendly English. For example:

- “The guide now opens only from the special link. Ordinary pages look the same.”
- “I am checking that switching accounts keeps the lesson position without carrying the previous user's sample.”
- “The texture exercise works locally. It sends no result to the laboratory database.”
- “The mobile layout is checked in the browser emulator; physical phone checks remain to be done.”

Avoid long technical monologues, “all perfect” claims, unexplained codes and repeated requests for approval that the user has already given. Clearly distinguish implemented locally, tested, pushed and actually deployed.

Final delivery: working entry URL, exact deployed commit, proof normal pages are unchanged, practice-versus-live boundary, changed-file inventory, language/device evidence, known limitations and exact disable/removal instructions.
