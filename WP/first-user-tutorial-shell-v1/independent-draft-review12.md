# Independent bounded draft check — checkpoint 12

Checked on 14 September 2026 at 13:53 UTC. **The narrow T10 confirmation race is reproduced.**

This check used the committed application `be9309384050f9f6b940c8e41f6a89258fceb050`, with the current local `client/dist` frozen in memory, a temporary local HTTP server, synthetic technician authentication and mocked API reads. It made no production requests, used no database and changed no application or build files. There were no attempted API writes and no page errors.

## Actual interaction

1. Open the real Workbench with the guide on the workflow-map lesson.
2. Open Activity Receipts and type into its real React-controlled **Search sample or receipt...** input, outside the tutorial.
3. Enter a synthetic sample ID in the guide and select **View Map**.
4. The existing unsaved-changes dialog appears correctly, before any sample lookup.
5. Select **Discard & Proceed**. Hold the mocked sample-detail response pending.
6. Type new text into the same real Workbench input while the lookup waits.
7. Release the successful sample-detail response.

**Observed:** the application navigates to `/samples/TEST-SAMPLE/map?tutorialmode=true` without another confirmation. The old Workbench input is unmounted. The earlier confirmation therefore also authorizes edits made *after* that confirmation.

**Expected:** an input/change event after the initial confirmation should require a fresh confirmation before the delayed navigation.

The tested control is a harmless Activity Receipts search. This demonstrates the global draft guard's behavior on a real controlled app input; it does **not** demonstrate that a laboratory result was lost or make any claim about server persistence. No synthetic elements, application test hooks or direct React-state changes were added.

## Minimal correction

`TutorialShell.jsx` currently calls `performNavigation(url, true)` from the draft dialog and carries that `force` value across the awaited sample lookup. Its final `if (!force && hasDirtyDraft())` skips the newly dirty state.

Keep the fix inside the tutorial module. Track a monotonically increasing revision for existing outside-guide input/change events. Snapshot the revision covered by the user's confirmation. Immediately before delayed navigation, require a new confirmation if that revision changed. A confirmation should cover existing edits only. Do not clear application inputs or drafts, change Workbench autosave, or alter the router/backend.

Avoid merely removing `force`: pre-existing filled inputs would then repeatedly trigger the same confirmation even when nothing new was edited. Keep the existing sample/actor/route cancellation checks intact.

Focused verification after the fix:

- This held-response interaction remains on Workbench and shows a fresh confirmation.
- Confirmed navigation with no intervening app edit proceeds once, without a confirmation loop.
- Canceling the fresh confirmation leaves the current page and its input intact.

## Evidence

- Script: `independent-draft-review12.cjs`
- Captured result: `independent-draft-review12.json`
- Source shell SHA-256: `09e6ef649582d4dcd8e98f3457e559f825e38136300458d49d97bcaecfd45077`
- Built index SHA-256: `63caa88f312186ed3d5a60455bb5e4463c280042b58200228b5492a19931c28d`
- `TutorialShell-Bb5_VIl7.js`: `a40a0fbe134896fb700351ba73795969f24a957ee76d9b5aebb6b82c2c65d4b4`
- `TutorialShell-DBnTsSTn.css`: `ddfa2508a6d18fc92852cdf676ba1f20ea7bf3e5457a1a3eba659985c12b2d7d`

This is one remaining bounded guard correction. It does not reopen previously accepted tutorial, removal, deployment or operational checks.
