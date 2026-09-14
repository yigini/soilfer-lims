# Independent same-document account handover — checkpoint 11

Executed 2026-09-14 13:35 UTC against a frozen in-memory copy of the existing local `client/dist`. Source HEAD was `b421a9a502fc77a96a20b2317e761baa8bc5002d`; the working source had newer changes, so the exact built assets below identify this check more precisely than HEAD alone.

- Tutorial JavaScript: `TutorialShell-Bb5_VIl7.js`, SHA-256 `a40a0fbe134896fb700351ba73795969f24a957ee76d9b5aebb6b82c2c65d4b4`.
- Tutorial CSS: `TutorialShell-DBnTsSTn.css`, SHA-256 `ddfa2508a6d18fc92852cdf676ba1f20ea7bf3e5457a1a3eba659985c12b2d7d`.
- Index HTML: SHA-256 `63caa88f312186ed3d5a60455bb5e4463c280042b58200228b5492a19931c28d`.
- Source TutorialShell SHA-256: `09e6ef649582d4dcd8e98f3457e559f825e38136300458d49d97bcaecfd45077`.

## Result: PASS for reactive account and sample context

The actual built React application begins on the workbench with a synthetic technician A in synthetic lab A. The guide independently verifies A through an intercepted `/api/auth/me`. An old-lab sample ID is entered into the guide-owned map selector. The real user-menu Sign Out button then signs A out, and the real login form signs in synthetic technician B from lab B. No authentication test hooks are added to the app, and no storage or auth state is changed by the harness after the initial setup.

Observed outcomes:

1. Sign Out routes to `/login`; the guide drops A's identity and clears the selected sample input.
2. The normal login form makes a completely intercepted synthetic login POST. The guide verifies B through `/api/auth/me`, shows B, and does not retain A or the old selected sample.
3. The existing visible workbench navigation link returns to `/workbench`.
4. Explicitly entering the old-lab sample again makes its read-only detail request with B's synthetic token. The intercepted server response is 403. The guide displays an access-denied explanation and keeps the user on `/workbench`; it does not navigate to an old-lab map.
5. A window marker set after initial loading survives all these steps. Exactly one document request is recorded, so logout, login, and workbench navigation occur in the same JavaScript document, without a reload.
6. No uncaught browser errors or attempted laboratory writes were observed.

## Interaction and evidence limits

At 1440 × 1000, the expanded dock overlaps the user-menu Sign Out pointer target. The initial ordinary pointer click timed out because the dock intercepted it. This check therefore activates the **real** Sign Out button using keyboard Enter and submits the **real** login form with Enter. It uses neither forced pointer clicks nor application auth hooks. This is evidence for reactive account-state behavior; it is not a claim that the expanded dock allows an unobstructed mouse-only account switch. Users can collapse/pause a coach when operating covered page controls; that separate pointer sequence was not rerun here.

All API traffic is fulfilled locally by Playwright. The only POST allowed by the harness is the synthetic login request, and it never reaches a server. Other non-read requests and all external requests are blocked. No backend, database, production account, real credentials, or production sample is used. A mocked 403 checks client handling, not server-side RBAC correctness. These results do not claim a physical-device or human novice usability review.

Reproduce with `node WP/first-user-tutorial-shell-v1/independent-spa-handover-review11.cjs`. Structured observations are in `independent-spa-handover-review11.json`.
