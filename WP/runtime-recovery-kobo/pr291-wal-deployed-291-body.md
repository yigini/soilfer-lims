Deployed f830f900f597f20e12570b583e4e32ce9cb50a1d to production

Completed 2026-10-12T01:57:11.788150+00:00; the single original unit is inactive/exit 0. Independent read-only verification passed 2026-10-12T02:02:22.664396+00:00. Image sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413; Docker healthy with 0 restarts, blank NODE_OPTIONS and 805306368 B limit. HTTPS health and login return 200; health status ok/version 1.9.0. Ingress is open before jobs, background jobs enabled, auto-push/auto-seed disabled; retained unauthorized receipts POST returns 401. Volumes remain lims_lims-data and lims_lims-assets.

Original immutable mode0400 production receipt:
/opt/lims/releases/runtime-kobo-release-f830f900-20261012T012552Z/production-receipt.json
SHA256: 0b8c3f54ab70e404d5797266f349d3b2a819151dc3afa9c5059f63a27727a8d7

PR #291 deploys the audited union containing #278, #279, #281 and #283. The exact application main CI 38182451105 passed all 344 suites and 5,170 tests, client build and both actual Docker checks.

Production startup, probes and WAL-aware full preservation passed (104 tables/38 receipts/integrity ok/FK0/0 changes before jobs). The 660-second jobs-enabled watch passed with 0 restarts, peak 276758528 B. All original evidence remains retained.

Deployment ledger: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6116443194

Claudio owns the actual issue-specific post-deploy verification and closure/tick. No replay, restore, older image or additional cleanup.
