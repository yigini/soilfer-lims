# Acceptance and removal checklist

These are requirements for the implementation. The standalone preview is only a design review artifact; its own checks do not satisfy production acceptance.

Three-person beginner usability sessions, specialist language review and physical-device checks are human acceptance items. Keep them explicitly pending if people/devices are unavailable; continue authorized technical work and report the technical release separately. Do not fabricate human evidence or treat an unavailable review session as a reason to stop implementation that can safely proceed.

## Test setup

Use the exact candidate app build against disposable synthetic data. Do not copy the production DB or mutate staff/samples for a tutorial test. Preserve unrelated edits and outbox data. Observe tutorial-owned requests and background app requests separately. Record pass/fail/not-run with screenshots and meaningful DOM/response assertions. No skipped assertion may be called PASS. No status updates directly in fixture data after setup may stand in for user action.

| ID | Scenario | Required outcome |
| --- | --- | --- |
| T01 | Normal login, dashboard, reception, workbench, manager, reports without flag | No tutorial UI/style/request/listener; normal forms and interactions remain unchanged; no tutorial-heavy chunk downloaded. |
| T02 | Canonical URL, root URL, existing query/hash, false/unknown values | Exact opt-in; unrelated parameters preserved; invalid tour/step safely rejected; false clears intent. |
| T03 | Anonymous start, valid login, cached stale user, 401, forced password change | Correct auth wait and ordinary guards; no sensitive content or privileged navigation before verified identity; forced flows are not covered. |
| T04 | Role change, failed login, wrong lab, inactive account, stale /me response | No permission bypass; prior live entity references cleared; stale request discarded; retry/unavailable state understandable. |
| T05 | Actual logout/login and login redirect to `/` | Guide position retained without auth edits; manual Resume after hard reload if no flag; no old role permissions or data inherited. |
| T06 | Refresh, Back/Forward, duplicate/new tab, copied URL, expiry | Predictable resume; no unsolicited full overlay from copied storage; expired content deactivates; no secrets in URL/storage. |
| T07 | Intro, live docked guide, app modal, practice modal | Modal semantics match behavior; app modals take priority; no simultaneous conflicting focus traps. |
| T08 | Every route and anchor, slow load, missing/duplicate anchor, unauthorized/missing record | Exactly correct target or honest docked fallback. No `.first()` guess, infinite spinner or fabricated result state. |
| T09 | Practice receipt/checklist/numeric/texture/spectra/review | All fields owned by tutorial; no LIMS write or staging requests; no real autosave/outbox entries; results clearly labelled synthetic. |
| T10 | Existing unsaved live draft while open/pause/exit/navigation | Draft and normal app guards preserved; guide never overwrites/clears live fields or storage. |
| T11 | Full role story and each individual-role path | Logical sequence; eligible pages only; proper handover, unavailable/illustrated/skipped states; no admin credential required. |
| T12 | Texture and number exercises | Blank/NaN/non-finite/negative/out-of-range fraction/non-closing values rejected locally, zero distinct from blank, locale decimals explained, no invented classification/real validator changes. |
| T13 | Spectrum and integrations | Local synthetic curve labelled, axes explicit, no spectroscopy predictions claimed; no Kobo sync, API-key reveal, SIS call/transmission. |
| T14 | All five locales, long text, asset/key failure | Complete visible and accessibility strings; scientific reviewer sign-off; language change doesn't persist an unsolicited profile preference; fallback is disclosed. |
| T15 | Keyboard, screen reader, touch, 200% zoom, reduced motion | Logical focus; visible focus; Escape/pause/exit; live-region announcements concise; targets reachable; no focus on inert content. |
| T16 | Desktop 1440/1280, tablet, 390/320px mobile, landscape, virtual keyboard | No overlap with explained control or action bar, no horizontal page overflow, readable bottom sheet, safe-area support. Physical device test recorded separately from emulation. |
| T17 | Chunk/content failure, enable flag off, asset removed, manifest expires | Ordinary LIMS keeps working; clean failure/exit; no reload loop. Old open tab sees graceful retirement. |
| T18 | Pause, explicit Exit, finish | Only tutorial state removed/cancelled; no residual mask/inert/listener/body-style; focus restored; normal app route/query/drafts preserved. |
| T19 | Version update and old director entry | Separate namespaces, bounded migration or restart prompt; no replay of wrong story; legacy URL handling explicit. |
| T20 | Source/build/security scan | No passwords/tokens/live IDs in assets; no eval/arbitrary URL route injection; scoped styles; no backend/RBAC/schema changes; every existing-file edit enumerated. |
| T21 | Exact candidate build delivery | Intended commit pushed, CI passes, deployed commit verified, actual tutorial URL works, normal pages checked, rollback/disable route demonstrated. |
| T22 | Removal rehearsal | Disable → remove mount/assets/optional anchors; Help Centre and laboratory behavior remain intact. No leftover service worker or normal storage deletion. |
| T23 | Visitor knows only the name LIMS and has no account | Understandable illustrated foundation with expanded terms; no private pages or credentials exposed. Understands purpose, connected sample/task/result model and how to get access. |
| T24 | Beginner usability review with three new users | Each can find a sample/next destination, distinguish expected/received and draft/submitted, find Help and pause/exit without coaching. Record hesitations and correct them before calling onboarding complete. |

## Evidence thresholds

- A beautiful screenshot proves only appearance. A Next click proves lesson navigation, not a received/submitted/approved sample.
- An actual-work training environment, if separately implemented, adds full authoritative API/UI persistence checks and production isolation tests. It must not use the old shortcut of forced preparation/submission/release statuses.
- An overlay cannot certify open core workflow issues as resolved. Any lesson relying on an unresolved feature must be explanatory/illustrated until that app behavior has passed its own acceptance.
- Review the final diff for unrelated changes. Keep existing Antigravity work separate; no reset/restore of its files.

## Deployment run sheet (when implementation is authorized)

1. Confirm current release and relevant original lab workflow status; do not mix tutorial and unrelated fixes accidentally.
2. Use normal project CI/build/deployment, with feature disabled by default and a retained prior frontend artifact.
3. Run test matrix on the exact candidate. Exclude passwords, local databases, live uploads and private screenshots from commits.
4. Verify the deployed tutorial URL and exact release; inspect normal login and at least reception/workbench/manager on the live site read-only. No production form input exercises.
5. Enable for the intended temporary window. Record retire date and responsible maintainer. User decides how long it should remain; no arbitrary automatic removal of app assets.
6. Return deployed link, boundary, file-touch list, test evidence, locale review and known limitations. Do not claim zero possible defects.
