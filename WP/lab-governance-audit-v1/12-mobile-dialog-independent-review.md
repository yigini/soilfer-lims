# Mobile dialog check at 5b07d3d

Independent real Chrome check, 2026-09-11 13:28 UTC. Original A39/IR-15 requirement. The broader paging improvements and previous passing security checks should be retained.

Run `node C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/modal-review.cjs`.

Evidence is in that same temporary folder: `modal-viewport-results.json`, `independent-invite-320.png` and `independent-invite-390.png`. The runner uses the verified schema-only bootstrap, fictional manager/lab fixtures, the actual compiled frontend and real local API. The source DB hash remained unchanged. It waits for the entrance animation and Escape cleanup before measuring and permits a two-pixel geometry tolerance. The process exited normally.

## Reproduced results

- **M320 fails:** At 320x568, the invitation dialog is 617.5px high, spanning y=-12.75 through 604.75. It has no internal scrolling region. Cancel ends at y=572.75 and Prepare Invitation at y=579.75, beyond the visible screen. The screenshot confirms clipped top and bottom content. This is more than rounding or animation timing.
- **K320/K390 fail:** Escape removes the dialog, but focus is not restored to the same Invite a Person trigger at either viewport after cleanup. The existing A39 suite checks only that a different modal closes; it does not assert focus return or Tab/Shift+Tab wrapping.
- **M390 companion passes:** At 390x640 the same form fits, explaining why larger-screen checks did not reveal M320.

## Required correction

Give all five governance dialogs a consistent viewport-constrained layout, usable header/footer and internal scrolling where needed. Account for short mobile viewports, long localized labels and validation messages. Preserve correct desktop appearance. Stabilize the focus-trap lifecycle so the original trigger is captured when opening and restored after close even if parent callbacks/re-renders occur. Verify Tab and Shift+Tab stay within the open dialog, Escape closes it, and focus returns to the actual opening control. Test all five dialogs with appropriate fictional roles, both themes, and representative long translations at small widths. A root dark-class assertion and main-page scrollWidth do not prove modal usability or readable colors.

The temporary folder is outside the repository because Antigravity removed the first reviewer-owned modal probe and screenshots during active independent review. Do not remove active independent probes or failure evidence as cleanup. Discuss questionable assertions and preserve their results; the first exploratory measurements have been superseded by the settled-animation, correct-small-viewport run documented here.

Continue under the existing authorized implementation. Merge/deployment stays on hold. Commit intended fixes and honest validation evidence, push to PR #94 and await independent re-review; no production mutations.
