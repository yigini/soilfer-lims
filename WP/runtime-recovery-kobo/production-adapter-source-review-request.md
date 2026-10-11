Claudio: NEW separate production-baseline/packaging source review request implementing pin6113922488 and authority-layout clarification6113946226. Exact tooling commit f46170b9303bacdfb848779e3ca22f4a1f26fd9d; compare https://github.com/yigini/soilfer-lims/compare/4bdbf805...f46170b9303bacdfb848779e3ca22f4a1f26fd9d

Raw Git SHA256:
- known_core_disk_guard_deploy.py: d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
- deploy_runtime.py: 1fa13b1b86439bbe37815617c4a78ff6e86ba636bb398d147d10f3b20297c374
- freeze_runtime.py: f85259f9c7b79f0420e49c13555e0d53e41f4cfc7ffc9e6cbb5242158b913fe6
- runtime_release_contract.py: 7b1069fc6347808f4b060ccee0b82a17e63bae4a1f6e97a8f6949c063ce30d20
- collect_runtime_gate.py: ceda220216613549999a986ff286bac73734b874ff05f09dc294e001f98645d1
- export_freeze_runtime_kit.py: 934fe74b199bf39085a987349dcece309fa0085ef67ea47099cc07bd00c6edb8
- launch_runtime_release.py: e82a336a1fa7adfe9d64bf87ca2bc049e418a1d6259abecbfae53783ca3771bf

Original guard f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169, V2 f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c and V3 878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f stay byte-identical. All measured b285 proof helpers remain identical, including coordinatorcb010/verifier3fc08/contract721b/fetch/support/readiness. Same211630Z proof keeps running unaffected.

New adapter imports V3 confirm_baseline/constants/POLICY and subclasses V2. Constructor measures the original two core scans/two root allocations/physical df/per-inode union/max. Before/after every attempt positive layout requires exact gate-bound root, every manifest file hash/mode0400, plus intrinsically required prepared-manifest.json and production-gate.json hash/mode0400 authority files (cannot be manifest.files due circular manifest digest). Only extra files execution-attempt.json(0400,same head/gatehash) and ledger. Missing/changed/extra/symlink/directory/production-receipt/DB/tar/output refuses. Launcher uses systemd journal, so no output files exist inside kit. Adapter runs at current pre-quiesce callsite before guard check/first gate recheck/live Docker or ingress action; failure consumes attempt and remains REFUSED_BEFORE_QUIESCE, no retry. Same3 whole attempts/10s/max1s sleep/late clean refusal/confirmed vanished exactprocPID only/floor each/zero failed-value carryover/finalcleanbaseline. V2 midrun methods unchanged. Receipt carries adapterSHA/attempt/baseline policies even failed receipt includes adapterSHA.

Packaging now explicitly binds actual b285/6113833648 approval plus V3/verifier/proofcontract/refusal/cardinality policies through manifest/gates/receipt. Freezer re-verifies original stopped first,second,full snapshots with exact protected refused configs and all original rows; re-parses original log/refusal counts/two completion identities/Sample-row cardinality/second ids. No new copy/proof/installer. Raw production source PASS is required before package creation and frozen/hash-bound; fresh gate rereads this actual source verdict/no later failure. NEW exact-kit audit still mandatory before any gate/deploy. Original YY evidence untouched.

119/119 Windows and119/119 exact-source Linux guards PASS/0fail/error/skip. Linux2026-10-11T21:30:17.698905UTC/1.617640974s/no productionDBaccess/stderrSHAfe04ffe090a000ecbe75a164b7b6474f26505b9edc2051d34829a7258a1db0f5. All10 V3 cases run through actual adapter constructor; positive-layout failures/static order/rawguardidentity/gate tampering/separate source approval/firstsecondsealed evidence fixtures pass.

Required separate Source review: PASS must bind full tooling and all seven full changed-source hashes above, all three guard hashes, plus literal:
productionBaselineScopeCommentId=6113922488
REQUIRED_HASHED_MANIFEST_AND_GATE
JOURNAL_UNIT_OUTPUT
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED

No frozenkit/gate/productionattempt/cleanup. Sameproof211630Z first natural sync sealed155Sample rows/78D1+77D2/full104tables/schema/originalrows/integrityok/FK0/4protectedconfigs; secondnaturalcompletion and finalstop/fullpreservation still pending. It is NOT PASSED. All3originalFAILEDroots immutable/stopped/noreplay/neverfeedkit. #291 stays held until292live+your actualpostcheck; human cards untouched. Same activewriter continues.
