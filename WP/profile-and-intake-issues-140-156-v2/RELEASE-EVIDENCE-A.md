# A delivery: independently verified live

4 October 2026. This closes the LIMS-side A acceptance. Receiver ingestion remains external; issue140 stays open.

- PR160 accepted head `d90dfc2e4a05f71f8724f464a9ee6c13cdfe503d`; PR CI37158705092 SUCCESS.
- Merged main `477cc1febc62a7b56d2f31d07ac8854a24a752ff`, tree `6f4ce301ee9ffdb91375825e8bd1e0948589888e`; exact merged-main CI37159196498 SUCCESS, including Docker acceptance/upgrade rehearsals.
- Independently verified production `v3.5.34-477cc1f`, image `sha256:6353d61294d3a4dc0917725e5d51a635ab27b83dc489db3e969d39ad499d36b7`. Source labels, running image, health and public ingress checked.
- Actual read-only postflight31/31 plus admin/manager/technician permission gates PASS before and after ingress release. No synthetic production laboratory results were created.
- Twenty consecutive authenticated approved-cohort reads retained stable specimen IDs and distinct bounded correlation IDs: median195.667ms, p95256.023ms, maximum377.895ms. These are container-loopback routed reads, not public-WAN or receiver-ingestion timings. Cold authentication523ms; later46/60ms.
- Successful stopped-writer counts:38,567 samples,19 results,49 users,10 labs; SQLite integrityOK, foreign keys0. The previous copy had38,566 samples; the owner's genuine input during normal operation explains the difference. No accepted result was changed by this release.

Release ledger `/opt/lims/logs/release_ledger_issue160_20261004_005720.json`; transcript same prefix `.log`. Backup SHA256 `23c93bc4562876affd593b1bac8bb2c14e9bd0330ea3a5086af893a2abf33b2d`; asset archive `7921958ff04086be1b9c2b59490c5aa102123cc8d91d33abbd4600b3cbf9234a`. Apache configuration before/restored `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`.

The first pre-exposure attempt005355 failed the pinned postflight fingerprint: the Windows archive changed line endings. The established wrapper safely restored the prior image/database before opening ingress. Recovery epoch `epoch-1791068127-6449bdc16933`. A byte comparison of all1,664 archived files found1,404 CRLF-only differences and zero substantive differences. The retry pinned the actual reviewed probe SHA256 `2b8861df50bb893da81761b99c26989529b163a261fbe4333352a6a795bb127c` and passed005720. COMMITTED preceded writer/ingress release. Future archives must preserve exact Git blob bytes; do not weaken the fingerprint gate.

Issue140 progress was recorded at https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5974465625. J02–J05 remain receiver-owned. Theme software/manual qualifications are separate. B1 and B2 remain necessary for full issue156 completion.
