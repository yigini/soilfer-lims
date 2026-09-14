# Independent monitor: remaining issues on 5863d40

2026-09-14, heartbeat follow-up. Source review and GitHub CI evidence; no production writes. This is not a complete release acceptance certificate.

## 1. Full CI is red

Run 34798874794 on 5863d4024e31fda143aaed03a275cbeb3e144dc4 failed: 106 suites passed, 1 failed; 905 tests passed, 1 failed. `server/tests/contracts/interim_gaps_verification.test.js:318` expects an ACCEPTED fixture to appear in SIS samples. That conflicts with the corrected release-only policy: ACCEPTED is intake validation, not approved analytical release.

Keep the release protection. Adjust this scoping test to use separate eligible released/approved fixtures in both authorized and unauthorized labs, while preserving explicit negative assertions for ACCEPTED and other pre-release samples. Do not weaken the SIS policy or remove the cross-lab assertion just to turn CI green. Run the full relevant CI pipeline after fixing.

## 2. C01 real UI retry recovery remains incomplete

`client/src/components/projects/ProjectActionsModal.jsx` handleSaveSettings creates a fresh crypto.randomUUID inside every invocation. `ImportPreviewModal.jsx` handleCommit does the same. An uncertain response followed by Retry is therefore a new command, not recovery of the previous command. Neither handler shown resolves the existing receipt. Pause/resume and archive handlers also lack the key/revision wiring in their current requests.

Implement a logical-operation key and immutable request snapshot retained across an uncertain response and retries, with authorized receipt lookup/recovery. Renew the key for an intentionally new operation after the previous outcome is resolved. Apply the original A12 contract to the covered governance controls, not only settings. Test actual UI behavior: server commits but response is lost, user retries, exactly one mutation/audit/receipt and original outcome shown. Include stale revision and changed-payload handling. Do not auto-resubmit a changed form using a pending command key.

## 3. C02 preview/commit still disagree

In `server/controllers/projectController.js`, previewImport signs a hash of candidateIds, including IDs that are already registered. The response returns validSampleIds excluding those conflicts. ImportPreviewModal commits validSampleIds, and uploadManifest checks its hash against the signed candidateIds hash. A mixed existing/new manifest therefore cannot commit the valid rows through this UI. Choose and enforce an explicit UX: either block the whole preview until corrected, or sign and clearly confirm the exact accepted subset. Preserve honest conflict/count reporting.

The signed token contains projectRevision, but uploadManifest does not compare tokenData.projectRevision with the current project revision. It checks an optional caller-supplied expectedRevision instead. Validate the signed revision inside the commit transaction; a caller must not refresh a header to make an obsolete preview current. Keep any separately authorized legacy direct-import compatibility path explicit rather than treating a public checksum as a signed preview. Exercise stale-token plus fresh-header and mixed-duplicate preview-to-commit tests.

## Completion and deployment

Continue the already-authorized implementation, GitHub push/merge and safe deployment once these corrections and original acceptance evidence are ready. Batch fixes and evidence to avoid unnecessary deployment cycles. Report the exact commit, CI result and live release verified. Last independently observed live UI was 79cd43f; this review does not claim 5863d40 is deployed. Do not claim all original A01-A20 workflows are verified solely because a summarized probe row is green. Communicate briefly in plain language: what was wrong, what changed, what remains.
