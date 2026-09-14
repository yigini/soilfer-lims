# Independent monitor: 57f4284 recovery boundary

2026-09-14 03:03 UTC. The preceding a40e049 full CI is green; new 57f4284 CI 34801083406 is running. New deployment not yet independently verified.

Independent fixture rerun: independent-retry-57f4284-probes.cjs/results.json PASS all three focused cases: identical archive retry returns 200, differing reason returns 409, mixed manifest commits eligible subset, stale token with fresh header returns 409. Source database hash unchanged. This is the independent confirmation of the archive correction; do not relabel a rerun against newer code as evidence about a40e049.

## Remaining boundary in new recovery implementation

ProjectActionsModal pendingOperationsStore and ImportPreviewModal pendingManifestStore are module-global Maps keyed only by project/action. Neither store is keyed by actor/session or cleared on logout. AuthContext logout clears token/user state without a page reload. On a shared lab computer, user A can leave an uncertain operation, log out, and user B can inherit A's pending attempt for the same project: the import modal restores rawInput/previewResult, and project actions restore the archival reason. Recovery can be blocked by actor collision or misrepresent whose operation completed. This is a source-confirmed path, not a production test.

Scope entries by authenticated actor and session identity as well as project/action; invalidate visible sensitive state on logout, account switch, session expiry and scope revocation. Check that A's pending values and key never appear or replay as B after logout/login in the same SPA. Keep same-user modal close/reopen recovery working. Use the existing session/cache lifecycle rather than adding another disconnected logout mechanism.

Also retain the ORIGINAL expected revision in the immutable pending request. The current handlers compute If-Match from current project.updatedAt on every retry. If the first request never committed and another manager edits the project before retry, a background prop refresh supplies the fresh revision to an OLD form payload and allows an unintended overwrite. Retry should replay the old snapshot/revision or resolve its receipt; a stale response should lead to explicit refresh/review rather than silently rebasing old values. Manifest snapshot comparison should cover destination/token as well as IDs.

## Evidence quality and test hygiene

real-ui-modal-verification.cjs does render the built React app, which is useful screen coverage. Its backend is completely mocked: it aborts the first request before any server commit and fabricates success for every receipt key. Label it as React UI with mocked API, and pair it with the real-route tests; do not claim an independent end-to-end committed/lost-response journey from this script alone. Extend it with same-SPA account-switch isolation and stale-revision retry assertions.

Make that script portable: remove the alternate C:/Users/yigin/Documents/LIMSI dependency path, avoid fixed user-machine dependency paths where the project runtime suffices, bind its static fixture server to loopback, and use a clearly fake per-run fixture signing secret instead of a hard-coded secret-looking literal. No production secret exposure has been established by this review.

Batch these bounded recovery corrections into the current work, then continue the already-authorized safe GitHub and production release with exact CI/live evidence. Original acceptance remains partial until its remaining journeys are credibly evidenced; this review does not add a new approval hold.
