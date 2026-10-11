# Isolated jobs-off proof passed; production remains unchanged

The single newly reviewed unit `lims-owned-runtime-jobs-off-ae64f169-proof-20261011t183405z.service`
completed with exit 0 at 2026-10-11T18:50:07.244082Z. Its original root is
`/opt/lims/releases/runtime-jobs-off-ae64f169-proof-20261011T183405Z`.
The owned writer is stopped and retained. Do not replay this proof.

Original immutable receipt SHA256:
`47107490080e1dbf3505f28e6a55d7eb8e4574b07b7111e467f2def5ddf9581b`.
Source 63a352683e2d83aaf5cd531f4b741be0855c6905; coordinator
`c366cc4ecfaa8ee38c08ca4e14fda25897a9eba2fb57ee9abd8eb918643113dd`;
source index `2652b087d03b9a4ee409b02f8ef1ebe513e49deb614b5b00c14dd44416d42cf2`.

The copy passed 660.012 seconds of healthy operation, zero restarts,
326467584 B peak at the unchanged 805306368 B limit and no heap override.
All 22 startup NO_OPs/21 READY events made zero changes; 31 checks and six
read-only probes passed. All 104 tables, 38 receipts, original rows and
main bytes remained unchanged, including after stopping the owned writer.
Effective uid 0, Python optimize 0 and baseline enumeration errors 0 were
enforced. The 104-observation disk ledger SHA256 is
`bc2248c82d091d291b1a911099ba993cd3bfab83d5c8ae086c81f5610668972b`.
The original reserve and unexplained-drop abort remain unchanged.

This proves the isolated same-image jobs-off configuration. It is neither
production containment nor the new PR292 jobs-on release proof. YY's live
jobs-pause card remains pending; no production mutation occurred.

At 18:53:34Z the independently reviewed streaming verifier also passed
against the original backup and stopped copy: all 104 schemas/row sets,
integrity ok, foreign keys 0, both database byte hashes unchanged.
A separate authorized read-only Kobo GET at 18:53:06Z retained 67 pending
ZMB submission ids 41522 through 41588 above cursor 41521; no sync or DB write.
These diagnostics do not replace a fresh candidate-image workload proof.

Claudio reviewed the verifier/fetch source in #162 comment 6112436098.
The fetch recorder passed; the verifier may remain strict under his explicit
alternative. An existing EXPECTED-sample conflict will refuse and be diagnosed
instead of silently expanding the row allowance. Runtime PR292 exact-head
audit remains pending despite green CI; PR291 is separate.
