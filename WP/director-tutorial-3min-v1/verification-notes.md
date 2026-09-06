# Verification boundary

This package is a reviewed proposal and an interactive mockup. It does not implement the application overlay or certify the production laboratory workflow.

## Checked locally

- Source routes and feature connections were inspected against repository baseline `c996beb`; see source-and-feature-map.md. The implementer must recheck current HEAD before editing.
- One storyboard supplies all twelve scenes, the preview, and the English speaker script. Durations total 180 seconds.
- The isolated browser checks light and dark appearances at 1440, 1024, 736, 390 and 320 pixels across all scenes. It checks page overflow and whether the guide obscures its highlighted content.
- Playback completion, manual navigation, restart, paused speaker notes, optional feature details, five sample rows, alternate guide placement and exit behavior are checked.
- Browser errors and external HTTP requests are recorded. This preview makes no LIMS, Kobo or SIS requests.
- Screenshots and the latest machine-readable results are in preview-checks/. They cover login, the five intake receipts, equipment/inventory, the analysis bench, workflow map/report, SIS preview and narrow-screen presentation.

## Still required after preview approval

Actual authentication, role transitions, translated overlay strings, source-page readiness, saved laboratory records and real route timing must be tested in the proposed isolated deployment. The local accelerated timer check is not a wall-clock rehearsal of the live application. Synthetic spectrum drawings and values are presentation fixtures, not measurements or proof of analytical validity.

Follow acceptance-and-rehearsal.md before describing the platform as ready for controlled laboratory testing. Keep this proposal's visual QA separate from application and pilot acceptance.

## Reproduce the preview checks

From the repository root, run `node WP/director-tutorial-3min-v1/build-preview.cjs`, then `node WP/director-tutorial-3min-v1/verify-preview.cjs`. The current checker uses the existing scratch Puppeteer dependency and locally installed Chrome. It opens only the generated local preview and does not use an authenticated browser profile. Adapt those local paths on another machine without changing the storyboard or requiring production access.
