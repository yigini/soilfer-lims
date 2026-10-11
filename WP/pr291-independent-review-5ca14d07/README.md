# Pip independent review: PR #291, 5ca14d07

Review status: NOT PASSED. One reproduced scientific-unit blocker requires a revised head and new independent/exact-head review before merge or deployment.

Application head: 5ca14d07f8f626252cca9a5560a04a70f5773057. Base/current live: ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf. The ae64 release and its handoff are complete; none of its consumed gates/coordinators/proofs are being replayed. Same managed worktree, chat and writer; no new worker or production writes.

Pip exported and SHA1-verified 2,237 regular source files directly from Git blobs into an owned temporary test directory. The PR's nine focused suites passed 124/124 tests, exit 0. The supplied new tests and existing matrix, cross-check, separate texture and atomic texture regressions all passed. Local initial test provisioning refusals (unpublished help template / archive line endings) were corrected solely in the disposable test extraction, using the existing help publication and raw Git bytes. No source contract was relaxed. Installed relevant runtime dependencies match the PR lock versions; this focused run is not a claimed full-suite or Docker rehearsal.

## P1: preserve stored percent-unit authority in all texture derivations

At server/services/resultWriteService.js:553, the new policy tolerance accepts 40 + 40 + 19 even when the three retained Result.unit values are g/kg. deriveTextureResult uses numericValue, censoring and one picked candidate but never validates their units. The real owned database fixture appended TEXTURE=Loam with isValid=true, provenance=DERIVED, one new Result and its WorkAttempt. For the exact same source rows, validateSampleMatrix correctly returned NOT_EVALUATED / UNIT_MISMATCH. No conversion took place. The prior no-tolerance helper refuses this non-exact tuple; the widened tolerance exposes the missing derivation guard. Percent-only input authority is part of #278 and YY's tolerance sign-off did not approve reinterpreting g/kg as percent.

The pure selected-fraction separateTextureChoice path has the same gap: three g/kg proofs at 40/40/19 produce DERIVED Loam. The composite mean call was also widened and needs the same input-authority guard. Request: share strict stored-unit, finite, censoring and candidate validation across recording and reported texture derivation; preserve current source/attempt rows and perform no new scientific derivation from unresolved inputs. Add non-percent, missing-unit, mixed-unit, censored, ambiguous and valid percent regression cases through the real execution/selection paths.

Independent real-DB reproduction: one failing wrong-unit case and one passing valid-percent control. The failure asserts deriveTextureResult must return null with zero new texture rows for non-percent sources; it received a stored Loam Result. The reproduction and observed rows are retained here. Native finding delivered to Claudio on October 11 at approximately 17:16 UTC.

## Scope clarifications sent to Claudio

The explicit #281 issue says stored out-of-range policy values leave save/submission working with crossChecks=[] / CROSS_CHECK_POLICY_INVALID and no new evidence. The PR's negative texture tolerance test instead pins an exact-closure 422 for 40/40/19. Claudio should reconcile and pin this intentional boundary against #278/#281 before the new review; it is not an independent approval of a new scientific fallback.

The blocking gate also infers a missing Result.unit from the current catalogue; #278 requires explicit missing-unit handling. Pin the intended source authority, and disclose unresolved units consistently rather than silently guess historical units.

Claudio owns the application repair. #213 remains separate/local and held during PR291 repair/review. Pip continues independent review and release preparation under YY's existing automatic-after-review go; no new YY confirmation is needed for continuation.

GitHub review: https://github.com/yigini/soilfer-lims/pull/291#issuecomment-6111607155, posted at 2026-10-11T17:17:21Z. Fresh native inspection at approximately 17:21 UTC confirmed Claudio reproduced the missing stored-unit guard, added a shared guard to the gate, recording, separate selection and mean paths, and was running texture tests before adding regression tests and pushing a revised head. These are observations of work in progress, not a passed review of an unpublished repair.

The existing ten-minute coordination heartbeat was restored ACTIVE in this same chat. Its saved instructions now continue the authorized development backlog after a release handoff, read the live checkpoint first, and stay quiet while evidence is unchanged. A completed application release is not the end of the authorized development task.
