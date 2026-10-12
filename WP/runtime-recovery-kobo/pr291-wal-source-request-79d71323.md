Request for NEW production-source review: WAL-preserving forward correction (scope #162/6115903244). This is a proposal, not a verdict or execution.

Exact source commit: 79d7132322fd482733d350384b0a8b2e5278c757
Application stays f830f900f597f20e12570b583e4e32ce9cb50a1d, candidate image sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413. Main CI38182451105 remains successful. Production remains current171/bac52 STOPPED, maintenance503/jobs held. No new production entrypoint, original SQLite connection, checkpoint, cleanup or gate.

The coordinator seals exact stopped main/WAL/SHM files at400 with sha256/size/inode/device/mtime/mode before and after. Copy races, sidecar changes or symlinks refuse. A second scratch triple alone is opened normally; expected full104tables/38receipts/integrityok/FK0 and the stopped logical backup include committed WAL data. Main-only immutable state is retained and every folded count must be at least the main-only count. All original file metadata/hashes and raw copy hashes are rechecked after scratch inspection. Originals are never checkpointed/truncated/deleted/re-written by the coordinator.

The candidate can legitimately recover WAL into the main file. The measured data_version/startup/probe helpers remain byte-identical. Coordinator c.main_bytes calls are replaced with complete logical equality. After jobs-OFF is stopped and before jobs-ON, a NEW raw triple/scratch/logical-backup/full-state seal must exactly equal the initial WAL-aware expected state (all schema, fields, table content hashes, keyed audit rows, attempts and acceptance context), not counts alone. The receipt claims full logical preservation and separately retained original raw triples, not unchanged physical main bytes after SQLite folding. Headroom includes all six raw/scratch/backup allocations, assets and536870912B state/log margin above floor/scaled reserve; unchanged disk guard physically counts all retained allocations.

Exactly ONE entry is selected and bound at gate collection, then rechecked at gate installation, launch and immediately before forward progress: RUNNING_NORMAL same bac52/current container, original ingress and normal quiesce; OR STOPPED_HELD exit137/OOMfalse/0restarts, frozen held ingress, exact diagnosed original triple hashes and immutable failed e274 receipt anyEntrypointAttempted=false. Held path does NO_SECOND_STOP. Unreviewed/wrong entry, hash/state drift or another writer refuses.

Required packaging integration: freezer reads only hash-bound original ingress bytes from immutable failed004200 manifest/receipt rather than treating the existing503 configuration as a fresh normal ingress. It binds the complete WAL recovery authority in the new manifest. Collector and launcher recheck the one actual gate entry; no old source/kit/gate can satisfy the new authority. This changes coordinator/contract/freezer/collector/launcher plus tests; exporter, original/deploy/V2/V3/proof guards, verifier, measured proof/startup/support and original234650Z PASSED evidence remain byte-identical. The FAILED receipt is only held-state authority, NEVER a PASSED proof/build/execution input.

Tests cover committed nonempty WAL included with originals unchanged, empty/absent WAL, changed-during-copy and appearing sidecar, lower folded count/missing table, equal counts but protected-content mismatch, wrong entry and held triple mismatch, gate entry drift, and no second original stop. Exact raw source174/174 Windows and174/174 Linux guards passed, no failures/errors/skips or production DB access. Linux completed2026-10-12T01:16:12.830772+00:00 / 4.836025518998213seconds. Original first AST-fixture failure at ecae4404 is retained; only its literal-command filter was corrected, no production code changed after ecae.

7 production source raw SHA256 values:
known_core_disk_guard_deploy.py d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
deploy_runtime.py 72baa9cb901aec8baaf35d33284eea2c23395150ee8cca211239b1ffa61d445d
freeze_runtime.py 9b76e19f3d4ea2002aa38f4748eb05a62d160866c852245a4320e1b6ec626cec
runtime_release_contract.py f1f252b967c2b2434ea94a9b5c782d3368ee3122c24bdd6cb551b36dbe32c86c
collect_runtime_gate.py d263a168472411b63fdb06291aeba947c187953a61c43a8b460c893f21d39cd5
export_freeze_runtime_kit.py c55f7067c5207d1ac3875135f8e394f768f8f928aa1f5d250c9ee538a4f0f23e
launch_runtime_release.py 5e1816ffa1fe5fa89314f0bdddc7b0ee79fc000f479449cc24dc9f606f773cc3

Review binding tokens (please issue actual NEW Source review: PASS with every full binding; this request is not that PASS):
171dd36c5b2dbeea8763520dd18fbdb158ffca05
5d3550d709f0b62ef013f9114e9da9344f9818a1
f830f900f597f20e12570b583e4e32ce9cb50a1d
48678dda23fa876d8d233db812149c8d1792bf16
2292fbf2a2626ad89c5abdcc49843dffffdefd02
sha256:bac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320
ac4ffc39c0b8e2c27f7aa1494edffcfd45e5c47d2c4aa5b7fffee1c2b6b1781e
releasePr=291
mergePolicy=EXACT_REVIEWED_PARENTS_AND_UNION_TREE
naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM
Source review: PASS
79d7132322fd482733d350384b0a8b2e5278c757
d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
productionBaselineScopeCommentId=6113922488
REQUIRED_HASHED_MANIFEST_AND_GATE
JOURNAL_UNIT_OUTPUT
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED
72baa9cb901aec8baaf35d33284eea2c23395150ee8cca211239b1ffa61d445d
9b76e19f3d4ea2002aa38f4748eb05a62d160866c852245a4320e1b6ec626cec
f1f252b967c2b2434ea94a9b5c782d3368ee3122c24bdd6cb551b36dbe32c86c
d263a168472411b63fdb06291aeba947c187953a61c43a8b460c893f21d39cd5
c55f7067c5207d1ac3875135f8e394f768f8f928aa1f5d250c9ee538a4f0f23e
5e1816ffa1fe5fa89314f0bdddc7b0ee79fc000f479449cc24dc9f606f773cc3
refusalPairingScopeCommentId=6114143349
schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE
REFUSAL_PAIR_WINDOW_SECONDS=1
EXACT_STOPPED_TRIPLE_WAL_AWARE_COPY_FULL_LOGICAL_ZERO_WRITE
walScopeCommentId=6115903244
/opt/lims/releases/runtime-kobo-release-f830f900-20261012T004200Z
e274d3b8cf6514e7fe878ad7d712caa6303d3f969fd49372f8bb0147efbb6588
5f75662a3394dd01a490338e0e389a0cfe5854d3ffcb170b9a48200b914c3a27
f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20
d92601efd55a8112b4775d101ce5f18beea29e33686c6b53dafa6efbae811b2c
RUNNING_NORMAL
STOPPED_HELD
NO_SECOND_STOP
44d174bdda174cc6fd81e6d0e958fd8bd48c8255e34cb9927bb562aa14cffd34
9f0981c7b5adad656ff544890af68a211a6daf8a52360b5c5e6cb12ffe2bb2e0
5ad9f8e2bdf448f719997dd8d28a3aee0351d7f86ac152df8c3d328755b0423d
206c4dc41a99045ab8a47871ebe8782fda4cba20
c47ef37880185fa7c8ac565f28fc16fe7040b549ed3bea482ab1c0295478d5f0
cd190348d332fd12e53694ca080819c2d095bfa5c4ee86eb058686a65a38fb0e
49c76b8d0312a38820ea8dff707cdfd6674614c63344bedf2655755b6ca6f1b6
proofBaselineLayoutPolicy=EXACT_HASHED_PROOF_AUTHORITY_LAYOUT
proofSourceReviewId=6115225815
PASS_HEADER_NEGATED_QUOTED_FAILURE_REFERENCE_ONLY

After actual source PASS: ONE NEW unique immutable kit from SAME original stopped/PASSED234650Z receipt257196f530a0494ca0ba43023091febe670bc894c063d4bdd99e98f23d979c0d/build7993/image4894; NEW exact-kit audit; ONE fresh unused10min gate; ONE forward deploy under original YY AUTO_AFTER_REVIEW go and both workload pins. Never replay004200/unit, reuse consumed ef23, rebuild/rehearse, restore/olderimage/heapraise/cleanup/override or answer YY restart card. Other app merges held until291 live and your actual postchecks.
