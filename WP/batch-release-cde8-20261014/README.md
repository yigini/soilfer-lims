# Batch source authority preparation for #206, #214 and #209

The three source audits, merges, and main CI are complete. This directory starts a new release authority for candidate `cde8c889`; it contains no kit or execution permission. All pending build, proof, impact, exact-kit review and gate bindings remain empty in `release-authority-draft.json`.

The completed #200 receipt identifies the predecessor only. Its build, proof, kit, gates and production helpers stay consumed. New helper source must bind a healthy current predecessor, the three actual source audits, one new candidate build, one new stopped production-copy proof, exact frozen kit and one fresh single-use gate. The previous held-entry path cannot be reused.

The candidate adds two container tables, four chart tables and nullable `OrderLine.workItemId`, with three schema receipts and no historical data backfill. Counts 106/39 to 112/42 are prospective checks derived from the predecessor receipt and source; they are not fresh production observations.

Before any production apply, require policy PRESENT/NO_OP0 or STOP. Collect chart and order impacts only on retained copies with original DB/WAL/SHM preserved and every allocation measured. The order owner requires COMPLETE_214, so a PRE_214 original must remain immutable while only a separate owned proof copy receives reviewed candidate installers. Print all required cause/sample/owner lists and `invalidStoredAnalysisSampleCount`; show nonzero lists to YY. Approved-amendment impact nonzero is STOP and requires a separate Claudio-reviewed forward remedy.

Next: complete the new source graph, installer-chain preservation validators and source-bound build/proof/kit coordinator, verify its refusal paths locally, and submit that concrete source for Claudio's review before launching a new build or production-copy proof. No production connection, count collection, image build, proof, kit freeze, gate or deployment has occurred here.
