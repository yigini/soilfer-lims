Current checkpoint: October11,20:02UTC. Exact merged-main CI38168329149 SUCCESS at20:02:00UTC for171dd36c5b2dbeea8763520dd18fbdb158ffca05, including full server suite/both Docker builds/real boundary/readiness acceptance. ONE NEW isolated candidate proof launched, original root /opt/lims/releases/runtime-kobo-proof-171dd36c-20261011T200210Z, unit lims-owned-runtime-kobo-proof-171dd36c-20261011t200210z.service. Raw tooling84b4ce497b4b242021f7ce6f4a093ceda7978cd8 exports unchanged reviewed coordinator a88223aa90e22253118b56ce72770ec1a219d0a82f71b3c9556a00c79e8f4271; source-index fa3def3e637cd8d407913beaa0bbcea807ee510df075f11b430a98134ab37fc9. Proof is RUNNING, not PASSED. Read only the same unit/root; never relaunch/new writer. Candidate build/image/target pin unchanged. No production mutation/gate/frozen kit. Proposed release source f61dc33c is with Claudio for review on162/6112979531; native workspace permission card still awaits YY and is untouched. Keep291/other merges held until292live. Continue samewriter/chat/worktree through actual natural2sync/PASS/stopped proof/freeze/newexactkitreview/freshgate/forwarddeploy; all retained roots/receipts and abort pins unchanged.

Previous19:43 checkpoint follows:

# Kobo runtime recovery preparation

Current checkpoint: October 11, 19:43 UTC. Claudio posted formal PR292 exact-head
audit PASS6112846321. Pip verified unchanged cb79d89b, green exact-head CI and
main ae64f169, then merged292 at19:30:41UTC as171dd36c5b2dbeea8763520dd18fbdb158ffca05.
Merged and audited trees both5209112a0c66d8cef8578018b415a7511b4daba7. Main
CI38168329149 is running. PR291 must remain unmerged until292 is live.

ONE NEW build completed19:37:27.522725UTC, unit inactive/exit0, original root
`/opt/lims/releases/runtime-kobo-build-171dd36c-20261011T193050Z`. Immutable
BUILT_ONLY_NOT_DEPLOYED receipt e2437e978eed81244f6860e9a92c0755654e7945137f8c0146852b7d544b2f1d;
image sha256:bac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320,
413547526B/exact revision,2234 raw Git blobs verified, no production DB mount.
Free114597490688B after build. Original receipt/index bytes and independent
image inspection are retained under build-observation-20261011T1940Z.
Target pin is prepared; approved proof source533c5451 remains unchanged.
No proof writer launches until exact merged-main CI SUCCESS.

New production kit/coordinator/gate/freezer source is PROPOSED_ONLY_NOT_EXECUTED.
Twelve synthetic Windows contract guards pass; these do not replace actual
Linux/Docker proof or Claudio's exact-kit review. The freezer independently
rechecks the original stopped final backup before binding its physical hash.
Fresh gate collection refuses existing gates/attempts, checks current main,
formal292 and new exact-kit passes, and requires measured backup headroom first.
Deployment preserves originals, holds ingress/stops all writers/takes a hashed
backup, runs only candidate default entrypoint, proves jobs-off zero writes,
reopens ingress before jobs, then observes660s healthy at768MiB/zero restarts.
Any post-quiesce failure retains maintenance/stopped jobs; forward recovery only.

Earlier19:29 checkpoint follows:

Current checkpoint: October 11, 19:29 UTC. Claudio's source review of the NEW
jobs-ON rehearsal at 533c545190bfedb955386610d20faaf86398ba04 PASSED in #162
comment 6112725472. This approves the isolated proof source, not the PR292
application audit or production kit. Both natural scheduled syncs, strict
existing-row preservation, 660-second healthy observation and 768MiB limit
remain required. Exact-source Linux guards passed 31/31 with no skips.

The native audit thread showed 174 of 340 test files completed at 19:26 UTC.
Claudio must rerun the client-component suites after linking their packages
and post the formal exact-head verdict. PR292 is still open; merge it before
PR291 so the candidate main tree equals the audited cb79d89b tree.
An immutable build exporter is ready; it can build after audit/merge while
main CI runs. The proof launcher still requires main CI to pass first.

Latest read-only production check at 19:17:31 UTC: 93 restarts, HTTP 500,
same ae64f169/bc2557a5 image and volumes; original receipt unchanged, free
118445289472 bytes. Protected counts remain, but this is not full-row
preservation proof. YY's separate live jobs-pause card remains untouched.
No candidate build, new jobs-ON writer, frozen kit or production gate exists.
The isolated jobs-OFF proof183405Z is stopped/PASSED and must not replay.

Earlier preparation notes follow:

PR292 cb79d89bfd104466ab7d29a83312dbc7bb48b7a0 independently passed149/149
tests plus the owned production-scale synthetic regression. CI38161566308
passed18:29:54UTC. Claudio's exact-head full-suite audit is still required.
No application merge, candidate image, Docker release proof, frozen kit or
production gate exists yet for this recovery. PR291 remains separate.

The read-only streaming copy verifier is proposed source, not execution
authority. It enforces Claudio's pins6112209155/6112305172: unchanged schema
and every original row across104tables/38receipts, with only enumerated
new scoped Kobo Sample/AuditLog/SampleHold and manager Notification rows,
plus active-config cursor/clock fields. Existing Sample metadata is protected
just as strictly as scientific Results. Secrets are hashed, never serialized.
Twenty owned Windows SQLite guard tests pass. The initial test fixture held
an open SQLite connection during temporary-directory cleanup; closing the
fixture connections resolved that test-harness issue. No runtime guard was
weakened and no host database was involved.

The second natural sync protects every first-sync row too. Its retained
upstream read-only fetch record must prove that any further intake is from
genuinely new submission ids above the conservative first-fetched set.
Only lastSyncAt/updatedAt may change for prior fetched submissions. New ids
which legitimately skip may advance the cursor without adding Sample rows.
The caller must bind those upstream records and observe the real scheduler
without editing its interval, cursor or timestamps. The observation lasts
at least syncIntervalMins+2 minutes after first completion, containing a
660-second healthy soak at768MiB/no heap override and a natural second sync.

This module performs no fetch, container action, database mutation or release.
The complete new rehearsal/coordinator/kit and exact hashes need peer review
before production. Original consumed kits, failures and backups stay retained;
no restore, older image, installer replay, cleanup or new production writer.
