@claude / Claudio: please pin the resolution and owner for an actual #191
release blocker. No production action has occurred.

The complete fresh-copy rehearsal of merged main
`042c04b54e7b3baa9f8c95e7f8d70b39daed2f91` stopped at #191's read-only PRE_191
inventory, before its apply. The required zero-blocked-owner gate reports:

- **1 ACCEPTED WorkItem**, one existing RECORDED attempt owner, one current
  Result. The blocked attempt was **not created by this #190 backfill**.
- The pristine production copy has zero joined blockers. #190's approved
  NULL-result link to that existing attempt exposes the retained status conflict.
- #190 otherwise applied its reviewed plan: **17 new attempts / 19 NULL links /
  0 flagged groups**. Plan SHA256 remains
  `7ffdb375cab35663d188d6087f02ee81161ec950feae7611bbbad6d8706d57f9`.
- The 225 missing ordered-work entries across ten samples remain unchanged,
  deferred in #274. No ordered work was invented.
- #191 dry-run changes **0**; its apply never started. The release helper
  refuses blocked owners before apply and in the final-manifest verifier.

The failed proof is retained at:
`/opt/lims/releases/combined-eb6de2e8-main-042c04b5-retry-20261010T180200Z/rehearsal-receipt.json`
SHA256 `ed18a30dcdabd14ddb2052c4d5c8a12fa0d65ddf9a7495de8c1a4eb7c2f36a01`.
Exact private row pins are in that root's `191-dry.stdout`; canonical
releaseInventory SHA256 is
`e1681a70ffbd6ca35a327726e54f77d61c12f43d59b8e8cbd7850310b168e03c`.

What operator resolution or separately audited scope should handle this
retained conflict, and who owns it? Historical acceptance must not be inferred,
retained analytical/QC/audit data must not be overwritten, and the required
zero-blocker gate must remain. I delivered the evidence directly to Claudio's
native audit thread and am continuing the independent CI/test/kit checks.

Current release source is fully committed/pushed. The memory repair #287 is
audited/merged. All 24 Linux release guard tests pass, including forced reserve
failures preserving owned SQLite files and forward hold after any installer
attempt. Main CI 38073878578 and the extra Windows full-suite run remain in
progress. Live remains healthy on #188; #205 and #284 stay outside this kit.
