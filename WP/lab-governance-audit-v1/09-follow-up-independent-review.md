# Follow-up independent review: release hold remains

Reviewed 11 September 2026 at commit `85fbfdfba1183432d8ada91982ab026128bf4638`.

GitHub CI run [34595641465](https://github.com/yigini/soilfer-lims/actions/runs/34595641465) passed the server tests, frontend build and Docker build. The latest offline ownership correction is present. Those are useful improvements; they do not close the original governance acceptance matrix.

## Actual follow-up results

Runner: [final-review-probes.cjs](final-review-probes.cjs). Output: [final-review-results.json](independent-review/final-review-results.json).

The runner exercises the actual Express routes, authentication, Prisma and SQLite, plus an actual loopback WebSocket connection. It writes only fictional fixtures into a newly created disposable database. SQL schema is read from local dev.db through a read-only connection; no existing data rows are copied. The source database file SHA-256 is unchanged before and after. This is not certification of the remote production database or a complete migration rehearsal. Application code was not changed by this review. Original probe files/results have not been overwritten by this runner.

Seven required behaviors failed, and the own-country invitation control passed. The `passed` field is literal: false means the expected behavior failed. The script's exit code zero only means execution finished.

| Case | Original scope | Expected | Observed |
|---|---|---|---|
| F01 | IR-01 / A03-A05 | Guatemala national lead cannot invite staff into France lab; no invitation persisted | HTTP 201 and one foreign-lab invitation persisted |
| F02 | IR-06/10 / onboarding scenario 1 | Admin can appoint a pending manager while lab remains SETUP | HTTP 400 LAB_PAUSED; SETUP is treated as paused |
| F03 | IR-04/11 / A25 | Valid ProjectLab-only servicing relationship appears in laboratory workspace | Workspace HTTP 200 omits that project |
| F04 | IR-04 / A36 | Expected/unreceived and released samples do not count as active analytical work | One EXPECTED + one RELEASED produces active=2 |
| F05 | IR-03 / A11 | Role-change preview includes submitted work still awaiting review | One SUBMITTED task produces openAssignmentsCount=0 |
| F06 | IR-09 / A13/A29 | Revoked legacy JWT without version claim denied consistently | Same signed token returns HTTP 401 at auth/me but 200 at SIS samples |
| F07 | IR-09 / A15 | Suspending a user revokes already established subscriptions | Suspension HTTP 200; existing socket stays open and receives a later lab event |

## Concrete repairs

1. **National invitation authority:** `staffLifecycleService.createInvitation` calls `canManageUser` before loading the target lab, so no country reaches the policy. `actionPolicyService.canManageUser` permits national actions when target country is missing. Resolve the actual target/proposed lab and country before authorization, fail closed on missing scope, and preserve the own-country positive case. Apply the same requirement across preview, creation, redemption and other administrative routes rather than fixing only the tested payload.
2. **Session revocation:** `apiKeyAuth` skips version comparison when the JWT claim is absent. Treat legacy version consistently with canonical HTTP authentication; preserve valid current tokens. `wsServer.revokeUserSockets` exists but has no production callers. Wire revocation into successfully committed suspension/access/recovery changes across all entry points and verify existing connections stop receiving old-scope events. Failed/rolled-back changes must not cause a misleading successful revocation event.
3. **Real work impact:** centralize the unfinished-work definition used by access previews, planned handovers, workspace counts and retirement safeguards. Include submitted/returned/draft states according to their actual lifecycle; do not simply rename a count while leaving orphaned work. Preserve authorship and the emergency-suspension path.
4. **Workspace wiring:** use the canonical project membership resolver/query and paginate authorized data. The current workspace still filters only owner/legacy assignedLabIds and loads the entire roster. Derive workload from actual sample/work eligibility so expected and released records are displayed in their own categories. Test mixed states and link/count agreement.
5. **SETUP onboarding:** support the specified pending manager appointment before activation, with explicit setup capability and activation readiness checks. Do not turn an unconfigured lab ACTIVE simply to get past invitation validation. Keep genuinely paused/retired laboratory restrictions intact and demonstrate the full provision -> pending manager -> readiness -> activation journey.

These are unfinished original requirements, not a request for unrelated redesign. Add regression assertions to actual APIs/services and preserve companion valid actions. Re-run this runner and the relevant existing checks on a new disposable database, then obtain CI on the resulting PR head. Do not rewrite expected values to accept the defect or use mock-only demonstrations to close it.

Update 07-implementation-and-acceptance-evidence.md to reopen the corresponding items and distinguish implementation, test evidence, untested scenarios and independent review. No all-closed or deployment-ready claim is supported yet. Keep PR #94 open and retain the merge/deployment hold.
