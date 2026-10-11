# Corrected disk measurement source proposed; no replacement writer launched

Claudio, the FAILED200210Z proof remains stopped/retained and cannot feed a kit.
Its original0400 receipt is ee68fd53f099a9e68840dae2ff4e8eeabbbc24e8e3b16ffd5a63d4fbf2cb8109;
the exact failure/ledger is on162/6113248570. Production remains untouched.

The read-only47-record/151.044149s all-process/core watch completed at
2026-10-11T20:14:43.584463Z. Raw watch SHA256
**98651f27de7528fd6d918230c832ba3258fc29d8fa56a0f0351f0c99aaca0404**.
It captured two raw-core close/free-byte recovery transitions:1066762240B
and1066729472B recovered in3.27s/3.26s between adjacent samples. After-samples
showed no core descriptors held by other processes. This corroborates a
brief release/sampling race; it does not turn the earlier refusal into PASS.

NEW corrected measurement and complete proof source is proposed at
**55c18943f569e9b031c8aae008f167ab399473af**. Please audit this exact source before
any NEW proof. Original base guard, support/readiness/verifier/fetch bytes are
unchanged and remain retained. The new helper imports the original guard.

Exact raw hashes:
- `known_core_disk_guard_v2.py`: **f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c**.
- `rehearse_runtime.py`: **9f175f1355413fd66c6dbf7082eea64f50a97fea6cec4ee1c6a0055384f70a71**.
- `proof_contract.py`: **d61d7d5c48b83dce8e2c7ea76c8ee39551cef4ef1b3530a82379a216fdf6b52f**.
- `export_launch_runtime_proof.py`: **204bbf2a20e90237ab7fc13730a466bd985c15b28c4bf0ee96e09b059485a8f9**.
- Original guard: **f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169**.

The measurement amendment is explicit: an anomalous sample can enter a
ten-second READ-ONLY confirmation window only when a previously successful,
paired, physically measured **active** core inode is absent from the after-scan
and its blocks on that same filesystem cover the excess over500000000B.
An ordinary unknown drop, retained-file disappearance, different filesystem,
still-present inode or excess beyond those measured blocks aborts immediately.
There is **zero credit for vanished allocation**. Every physical sample is
retained and checks the absolute reserve immediately. No forward progress is
permitted until fresh actual df/core/root observations independently pass the
original500000000B residual rule. Persistent residual or an I/O sample finishing
after the10s deadline refuses. This changes confirmation timing and therefore
requires your explicit new source approval; it is not an override of a failed run.

The corrected launcher now requires a NEW exact source-review comment bound to
the full source commit/coordinator/new helper/original helper and both workload
pins. It rejects old6112725472, later source/audit failure and changed main, and
the coordinator independently checks that frozen authority before creating a
copy. All other natural2sync/strict original rows/768MiB/no heap override/
104tables38receipts/22NO_OP0/21READY0/31+6 probes/660s/interval+2min/ownedstop/
forward-only rules remain as reviewed. No new copy or writer has started.

61 synthetic Windows guards PASS, and the exact source61/61 Linux guards PASS
at20:23:44.357723UTC,1.240611s,0failure/error/skip, no production DB access.
Linux stderr SHA256 **788ea20dadd2d800b8085b70729634ddebed2771966ef93e3f8404bb7ce1c1ec**.
This includes13 measurement cases and5 exact source-authority cases, plus
all31 earlier preservation/scheduler/fetch guards and12 release-gate guards.

If you pass this source, please put the following exact bindings in the new
#162 comment so the launcher can enforce your verdict:
`Source review: PASS`; full55c18943 commit; full9f175f13 coordinator; fullf88ec6a9
new guard; fullf4712a7c original guard; **CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10**;
**labAndHubBuildsOwnedByYY=true**; **RELEASE_DAY_DISK_ABORTS_ACCEPTED**.

The build/application do not change:171dd36c5b2dbeea8763520dd18fbdb158ffca05,
imagebac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320,
valid original build e2437e978eed81244f6860e9a92c0755654e7945137f8c0146852b7d544b2f1d,
mainCI38168329149 fully green340suites/5124tests plus actual Docker checks.
Keep291 and other merges held; never rebuild/replay the old proof or kits.

The proposed production coordinator/freezer export also imports/binds the NEW
measurement helper (deploy8fa6fb7d2086ea95000cbfe4dddb6eab15cc40c58c7ef22fdb85847491d5a6d5;
export freezerda028460f82e8d90968e131d949e5a7d2d6cb841a2d551b5da34dc9e9350764b).
The earlier f61dc33c source request is superseded. Runtime_release_contract
deliberately still pins the old a882/6112725472, so it refuses packaging of a
corrected proof until your NEW source pass hash/id is explicitly pinned. Your
NEW actual frozen-kit review still comes after a fresh PASSED workload proof.
No frozen kit, production gate, quiesce, deployment or cleanup.

Native failure coordination was delivered20:13; your workspace permission
card and YY's separate live jobs-pause decision remain untouched.
