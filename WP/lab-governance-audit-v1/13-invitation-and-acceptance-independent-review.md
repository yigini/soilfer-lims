# Independent review 13: invitation lifecycle and acceptance evidence

Reviewed commit: `c41d60da73788c9fcd9c1babe29867056e26dc01` on 11 September 2026. PR #94 is open; CI run 34607438577 passed. Merge and deployment remain on hold.

The corrected open-dialog dark screenshot is visually verified: it shows the real dark invitation form, with readable inputs and reachable footer actions. The screenshot helper now captures before dismissal and uses the real appearance control. The previously verified mobile geometry and Escape focus-return fixes remain accepted. These successes do not close unrelated onboarding requirements.

## Reproduction and safety

Run `node C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/invitation-review.cjs`.

Evidence: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/invitation-review-results.json`, captured at `2026-09-11T14:12:27.701Z`.

The runner imports the real app/services against a new database built only from read-only SQL schema. All users, labs, projects and invitations are fictional. No existing source data rows are copied. Source database SHA-256 before and after is `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b`. No invitation tokens are printed. The audit failure is injected through a disposable SQLite trigger so it also exercises transaction-client writes. Preserve this active reviewer runner and its evidence.

## Confirmed results

| ID | Existing requirement | Actual outcome | Required repair |
|---|---|---|---|
| I00 | Valid companion onboarding | Own-lab technician invitation returns 201. | Preserve this positive path. |
| I01 | A12, one pending identity and safe retries | Two identical POSTs to `/api/staff/invitations` both return 201 and leave two live pending invitations for the same normalized email. | Enforce the intended identity uniqueness transactionally, including concurrent requests. Return a useful existing-invitation conflict or explicit safe reissue operation; do not leave multiple usable secrets from a retry. |
| I02 | A34, invitation/audit atomicity | Injecting an `INVITE_CREATED` audit insert failure returns HTTP 500 but leaves one invitation persisted. | Commit invitation and audit in one transaction. Audit failure must leave neither an invitation nor a success claim. Keep link generation separate from claims of actual email delivery. |
| I03 | A08/A12/A25, preserve reviewed project access | Administrator invites a PROJECT_MANAGER with `projects: ['INV-PROJECT']`; invitation and activation both return 201, but the new user's projects are `[]`. | Validate requested project grants against canonical authority at creation and activation, then persist the approved grants through the canonical membership model. Do not fix the loss by blindly copying unvalidated JSON. Test real project list/detail access and a forbidden project companion. |
| I04 | A01/A04/A12, invitation scope before wiring | Direct calls to exported `getPendingInvitations(managerB, 'INV-A')` return three foreign records; `revokeInvitation(managerB, invitationId)` successfully revokes an A invitation. | Enforce current actor, target lab, hierarchy and role scope inside both services; audit revocation transactionally. These functions currently have no route/UI callers, so this is a service-boundary defect, not a demonstrated remotely reachable endpoint exploit. Repair before exposing the planned controls. |

## Missing connected functionality

`server/routes/staffRoutes.js` exposes creation only. Repository-wide caller search finds `getPendingInvitations` and `revokeInvitation` only in their definition/export in `staffLifecycleService.js`. No reissue/resend operation or connected pending-invitation roster was found. The People tab currently lists users, so a created-but-not-activated person disappears from this normal management journey.

Finish the existing A12 design with a scoped pending-invitation view, expiry/state, safe reissue and revoke controls, and an explicit manual-link/delivery status. Include expired/revoked/consumed states and meaningful errors without exposing token hashes or previously generated raw secrets. Verify these controls through the actual browser and API with fictional accounts. Verify that revoked/old reissued links no longer activate an account. Avoid implying an email was sent if only a link was generated.

## Reconcile the original acceptance ledger

Update `07-implementation-and-acceptance-evidence.md` with one disposition per A01–A42 from the unchanged `05-acceptance-and-release.md`: passed, partial, failed or untested; exact test/scenario and artifact; actual coverage and remaining action. Reuse existing evidence rather than rerunning every suite without a reason. Implement and test outstanding required behavior in the existing authorized scope.

Particular evidence limits still need honest disposition:

- A06 requires ten actual roles and resource-policy coverage; a manager browser run or a ten-role dropdown is not equivalent.
- A11 requires the usable planned handover/emergency journey, not only a count of unfinished work.
- A20 currently cites real module code executed with mocked browser/storage context. That is useful unit coverage, but it is not the actual A logout / B login / reconnect browser-and-IndexedDB journey.
- A39's modal tests press Tab twice and Shift+Tab once, which does not reach either focus boundary in the invitation form. Explicitly test last-to-first and first-to-last before claiming wrapping. The dark check now has valid visual evidence; strengthen its assertion to actual expected surface/text contrast rather than merely “background is not pure white” if claiming automated readability.
- A40 and A42 still need named route/old-client and migration rerun/partial-failure/recovery evidence. A one-time SQL execution plus sample count does not establish those outcomes. The rehearsal uses `copyFileSync` on the main SQLite file only; do not claim a consistent WAL-mode restore without a proper backup/snapshot procedure.
- `07` still calls the static `verify_multilang_render.cjs` a rendering test in IR-15 while correctly calling it static later; reconcile this and inconsistent test totals. Cite the actual React locale checks with their limited scope.

These are existing acceptance requirements, not a request for an unrelated redesign. Keep prior fixes, do not weaken existing tests, push only intended corrective application/tests/docs changes to PR #94, and retain the merge/deployment hold. No production user, invitation, sample or database mutations are authorized by this review.
