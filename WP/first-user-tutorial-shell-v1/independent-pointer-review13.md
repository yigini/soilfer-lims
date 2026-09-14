# Independent tutorial pointer and narrow-screen check — checkpoint 13

14 September 2026, 14:16 UTC. Frozen current `client/dist` at source HEAD `76a63b5af7cff0f202150a1037278de4e95027e5`. All APIs intercepted; synthetic authentication only; no application edits, build, database, or production access. External resources and non-read requests were blocked, except the explicitly mocked synthetic login response. No forced clicks, programmatic element clicks, or application auth hooks.

## Accepted: actual pointer account handover

At 1440 × 1000, the real sequence works: select an old-lab sample in the guide → Minimize → User Menu → Sign Out → Expand → Minimize → fill the real Login form → click its real Sign In button → Expand. The guide verifies technician B through `/api/auth/me`, clears technician A and the prior sample, and retains lesson position. The real Workbench navigation link then opens the bench. An old-lab sample lookup is made with B's synthetic token and receives the mocked 403; the app stays on Workbench with B displayed.

One document request and a surviving window marker prove the account change used the same SPA document. No page errors and no unexpected non-read requests. This certifies client handover behavior with synthetic responses; it is not a production account or server-RBAC certification.

Desktop expanded/collapsed controls are within the viewport and receive pointer hits. The expanded Exit button works with an ordinary pointer.

## Remaining: mobile controls are initially clipped

The new account-space layout leaves the Login coach's controls outside narrow viewports:

| Viewport | Expanded coach | Collapsed coach |
| --- | --- | --- |
| 390 × 844 | Coach right edge 394; Exit occupies x=360–413, partially offscreen | Controls fit, though the coach reaches the viewport's right edge |
| 320 × 700 | Coach right edge 324; Pause occupies x=299–348 and Exit x=360–413, outside the viewport | Coach width 320 begins at x=24, ending at344; Exit ends at331 and is clipped |

Screenshots were visually inspected. The 320 expanded screenshot shows Pause cut off and no visible Exit; the collapsed screenshot shows the Exit label cut off. The actual DOM measurements and pointer hit tests agree. Playwright can make the expanded Exit work by scrolling the coach's horizontal overflow into view; therefore this is an initial layout/discoverability failure, not proof that Exit can never be activated.

Evidence images: `independent-pointer-review13-320-expanded.png`, `independent-pointer-review13-320-collapsed.png`, plus equivalent 390 and1440 captures. Machine evidence: `independent-pointer-review13.json`; reproducer: `independent-pointer-review13.cjs`.

## Focused correction

Keep the pointer handover and draft fixes accepted. Correct only the tutorial's mobile dock rules:

- The more specific `.docked.on-login` 24px positioning overrides the 10px mobile dock positioning. Explicitly reset the login variant at the mobile breakpoint.
- Remove/override the inline collapsed `minWidth: 320px` on narrow screens; the whole coach must fit inside its available viewport margins.
- Let the header's badge/position/language and Minimize/Pause/Exit controls wrap into sensible rows, or use an equivalent responsive grid. The header currently has about388px of intrinsic content inside a298px coach at320.
- Keep Expand, Pause and Exit fully visible in both coach states, with no horizontal scrolling required. Retest only these changed controls at320 and390 plus a desktop spot check. No Login/AuthContext/RBAC changes are required.

If deployment is already underway, finish or safely recover that deployment first. This is a tutorial-only forward correction; no whole-app rollback is requested.

## Frozen asset identity and limits

- `TutorialShell-ZKJdI3SM.js`: SHA256 `8c9df3c5db2562581aa374fa86facbc463045284629cf62087f73fe3da966eff`.
- `TutorialShell-BXQUMQ6w.css`: SHA256 `641d60ad90ef27a4cebce1e563209601f6aeae949d853e9ff0dce0255e53af36`.
- Index SHA256: `9eda24d610304927821ebe530fdeb2b8096b9e3311b8112225f451189b267a83`.
- Source Shell SHA256: `16a47a7449bec361cb3a92a6d459179143ab2adb0bcf8b8baaadd50caba8a0a1`.

This is an English desktop-pointer and narrow-viewport control check. It does not claim physical-device, touch keyboard, all-locales, novice-user or scientific-language acceptance. No broad unchanged suites were repeated.
