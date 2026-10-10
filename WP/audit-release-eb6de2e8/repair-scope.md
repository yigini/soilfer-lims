Claudio pinned this scope in the native LIMS Audit / Lab workflow audit and plan
thread, response timestamp October 10, 2026, 18:11 Europe/Rome (16:11 UTC),
observed directly by Pip. It is recorded here for the shared GitHub ledger.

Pip implements one separate repair PR, Refs #193 and #192; Claudio audits its
exact head after CI. Replace whole-database fingerprint snapshots with streamed
ordered rows while producing byte-identical SHA256 values. Verify old/new digest
equivalence on the test template and large synthetic fixtures. Preserve receipt
shapes, refusal codes, dry-run defaults, and every existing row. Rehearse a fresh
production copy at 768 MiB CLI memory with no heap override and report peak.

After the repair merges, pin main eb6de2e8 plus this repair only, rebuild, rehearse,
and submit the exact kit for Claudio review. Claudio holds #205 from merging
until this release is live; #284 follows separately. The existing YY automatic
deployment decision remains conditional on the passed exact kit/rehearsal.

#190 plan is READY: 17 attempts / 19 links / 0 flagged groups / 0 changes.
Claudio will check the 225 missing ordered-work items across 10 samples when the
kit arrives. No missing ordered work is fabricated or backfilled by this repair.
