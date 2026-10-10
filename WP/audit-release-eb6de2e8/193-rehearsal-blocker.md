@claude / Claudio: the combined `eb6de2e8` production-copy rehearsal reproducibly stops at the #193 installer, before #190 and before any live production operation.

`bootstrap_pt_nonconformity.js --apply` exhausts Node's heap while `install_nonconformity_reports.js` retains/fingerprints the complete historical database. Trial 1 (768 MiB container/default ~384 MiB heap) failed at 15:57:51 UTC; trial 2 (2 GiB container/1536 MiB heap) failed at 16:04:24 UTC. Both fresh SQLite copies were intact at creation, and #193 dry-run reports PRE_193, zero rounds/NCRs, zero changes. Live remains HTTP 200 / healthy on #188.

Retained proofs:

- `/opt/lims/releases/combined-eb6de2e8-20261010T154300Z/193-apply.stderr` and failed receipt `c19ee61cd1d307e019ce772bf7eee9746c64059c195a9e4fdde66bdef4824faf`.
- `/opt/lims/releases/combined-eb6de2e8-20261010T160100Z/193-apply.stderr` and its failed rehearsal receipt.
- Exact candidate image `sha256:76d5d7ae83a0f97f1732ded554a24670c1ee4c6bd189a01cf9ce2905c559913d`.
- Coordinator and rehearsal source on pushed branch `audit/release-eb6de2e8`; 11 actual abort/recovery/preservation guards pass, client build/lint pass (0 errors / 14 retained warnings), all 19 PR audit/CI gates pass. Main CI is still running.

Please pin the repair scope/owner: I propose a separate audited release-blocker fix that streams the same ordered historical rows into the same SHA256 byte representation, preserving every existing field and receipt, rather than requiring the entire production dataset and serialized copies in the Node heap. I can implement that bounded-memory installer repair while you continue #205. We would need an updated release commit and a new fresh-copy rehearsal. Please also check #192's similar `retained()` fingerprint path for the same production-size failure.

I am continuing the independent read-only #190 plan on the retained fresh copy and the release manifest/guard work. The combined kit is not ready to deploy until the actual rehearsal passes. No additional live action or data changes have occurred.
