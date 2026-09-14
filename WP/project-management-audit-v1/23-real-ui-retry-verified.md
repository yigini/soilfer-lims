# Real UI Retry Recovery & Archive Payload Hash Verification

Date: 2026-09-14 03:00 UTC
Repository: soilfer-lims (branch main)
Source dev.db SHA-256: 388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b (Intact)

## 1. Summary of Gaps Addressed

### C01: Archive Differing-Reason Collision Rejection
- **Root Cause**: `archiveProject` passed `payloadHash` at top level to `CommandReceiptService.recordReceipt`, but `recordReceipt` ignored the property and did not include it in the serialized outcome. When replayed with a different reason and the same key, `checkReceipt` read `parsedOutcome.payloadHash`, which was undefined, returning 200 instead of 409 collision.
- **Fix**:
  1. `server/services/commandReceiptService.js`: `recordReceipt` now accepts `payloadHash` and embeds it into the stored outcome JSON.
  2. `server/controllers/projectController.js:archiveProject`: `payloadHash` is explicitly included in `outcomePayload`.
  3. `server/tests/contracts/project_governance_retry_preview.test.js`: added regression test verifying 409 collision on differing reason replay.
  4. Verified with `node WP/project-management-audit-v1/independent-retry-a40e049-probes.cjs`: `C01-ARCHIVE-PAYLOAD` independently PASSES (first=200, identical replay=200, different reason=409).

### Real UI Retry Recovery in React Modals
- **Root Cause**: Previous retry keys were retained only in component-level `useRef` and were cleared on modal close, background project prop refresh, and input changes.
- **Fix**:
  1. Persistent module-level stores (`pendingOperationsStore` in `ProjectActionsModal.jsx` and `pendingManifestStore` in `ImportPreviewModal.jsx`) persist in-flight command identities across modal close/reopen and background prop refreshes.
  2. Unresolved command banner rendered in modal UI with explicit "Recover previous attempt" (`GET /api/projects/:id/operations/:key`) and "Discard attempt" actions.
  3. Conflict guards prevent submitting modified form inputs or sample manifest rows while an unresolved operation remains pending.
  4. Tested and verified in actual headless Chrome on built React bundle via Playwright script (`WP/project-management-audit-v1/real-ui-modal-verification.cjs`):
     - Dropped connection / network abort simulation on commit and archive.
     - Recovery banner displayed with "Recover previous attempt" and "Discard attempt".
     - Submit button dynamically updated to "Retry archive" and "Retry registration".
     - Retention across modal close and reopen.
     - Input modification while uncertain triggers explicit conflict notice.
     - "Recover previous attempt" queries server receipt, resolves state, and closes modal.
     - Both modal journeys independently verified 100% PASS.
