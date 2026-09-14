# SoilFER first-visit guide

Prepared 14 September 2026. **Implementation now approved; deployment not yet verified.** Read **[IMPLEMENT-NOW.md](IMPLEMENT-NOW.md)** first. It supersedes the earlier draft-only wording in this package.

The proposed experience is a temporary guide over the real LIMS: a short introduction, practical role chapters, and a complete laboratory story. It is distinct from the permanent Help Centre. New users learn what to do next and why, rather than reading a catalogue of menus.

**Beginner revision:** the audience may know only the name LIMS. Start with **[absolute-beginner-foundation.md](absolute-beginner-foundation.md)**. The preview now explains LIMS, the relationship between samples/tasks/reports, normal navigation and draft-versus-submitted work before asking the visitor to choose a role. Three short practice questions and a per-lesson glossary are included. The full new-user path is approximately 16–18 minutes; an illustrated overview requires no account.

- Open **[review-preview.html](review-preview.html)** for the interactive design. Start at login, change chapters, complete the preparation practice, try invalid texture totals, load an illustrative spectrum, and return a result with a reason. All screens and data in this preview are illustrative. It makes no LIMS requests.
- Read **[implementation-plan.md](implementation-plan.md)** for integration, authentication, privacy, routing, data boundaries, accessibility, language, delivery and removal.
- Use **[journey-and-copy.md](journey-and-copy.md)** for the exact teaching sequence and role handovers.
- Use **[acceptance-checklist.md](acceptance-checklist.md)** for implementation acceptance.
- Give Antigravity **[ANTIGRAVITY-HANDOFF.md](ANTIGRAVITY-HANDOFF.md)** with this entire directory.

Proposed entry: `https://lims.yigini.net/login?tutorialmode=true&tour=first-visit&lang=en`

Root `/?tutorialmode=true` should also work. The query syntax is `?tutorialmode=true`, not `/tutorialmode?true`. These are proposed entry points, not verified working links.

Recommended release: **Guided orientation on real pages plus clearly labelled practice inside the guide.** Authentication uses normal assigned accounts. Practice changes only tutorial memory; it does not receive, submit, approve or transmit anything in LIMS. Actual end-to-end training with real application write actions belongs in a separately isolated training deployment.

The actual overlay requires a small attachment to the app. Aim for one existing-file mount in `client/src/App.jsx` and a new dedicated directory. A few stable `data-tour` attributes may be justified if existing semantic selectors are insufficient. No backend/database/authentication/RBAC changes are requested for the first release. An independent static page can have zero application edits, but cannot truthfully be described as an overlay navigating the real application.

The older `WP/director-tutorial-3min-v1` is a useful narrative reference. Do not blindly execute its historical IMPLEMENT-NOW authorization or rebuild its isolated-demo scope as part of this new draft. Current source does not contain a tutorial loader; verify the deployed situation before integration. Antigravity has concurrent workflow changes: preserve them.

Preparation changed only new planning/preview files under WP. Implementation is now authorized as recorded in IMPLEMENT-NOW.md. Testing writes on production records and publishing live credentials remain outside the tutorial scope.
