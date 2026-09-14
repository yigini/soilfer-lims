# Deployment monitor — 14 September 2026, 05:02 UTC

- Git HEAD: 37521e5670cd44dc249c8e1367a16b01c142b462. No new application edits since independent tests in 37.
- CI 34807377036 completed successfully.
- Antigravity reports first VPS deployment attempt failed and it freed 13 GB before restarting deploy_37521e5.sh. Do not infer what was removed from that statement alone.
- Independent read-only verification: root filesystem 59 GB total, approximately 47 GB used / 11 GB available (82%).
- Current serving container remains soilfer-lims:v3.5.7-a21ba17, healthy and up approximately 38 minutes. Public /api/health returns status ok.
- New image soilfer-lims:v3.5.7-37521e5 is present, image ID c787f6be6f83. This is build availability, not deployed traffic.
- Rollback images a21ba17, 5047673 and 5cf1d1b remain present. Existing verified a21ba17 online/stopped backup files remain present. Two new 37521e5 online backups are present, timestamps 20260914_065356 and 20260914_065915; their integrity was not rechecked while cutover is active.
- Antigravity is still executing the deployment. The 37 positive independent verification message remains queued. No duplicate prompt or mid-cutover interruption issued.

Next check: actual running image, deployment outcome, selected new backup pair and integrity, artifact parity, public health and scoped UI smoke. Do not rerun unchanged source test suites or prior-release database checks. Original-scope acceptance disposition remains as documented in 37; monitor stays active.
