# Independent production verification: 5cf1d1b

2026-09-14 03:29 UTC. This records direct independent checks, not just Antigravity's release claim. Read-only production inspection; no sample/staff/configuration changes.

- GitHub CI 34801883560 for 5cf1d1b4b9202c2aee1458b2da2637e35c568ac3: SUCCESS.
- Live container `soilfer-lims` runs image `soilfer-lims:v3.5.7-5cf1d1b`, healthy. Image ID `sha256:beaa83a860de85b6042f1ed1022a677dd4fe9c4bf170928c6124ec88b24878b2`.
- Public HTTPS `/api/health`: HTTP 200, status ok.
- Live projectController.js SHA256 matches the local reviewed file: `bdcdae3fa499f914d4274a06b4e48ab546faefa00058544d273c814eb3181c06`.
- Live root HTML references index-DiLGyHY1.js and the same vendor bundle names as the current local production build.
- Read-only SQLite checks: live DB, online predeployment backup and stopped predeployment backup each contain 36,870 samples and return `PRAGMA quick_check = ok`.
- Backups verified: `/opt/lims/backups/dev_predeploy_5cf1d1b_online_20260914_051857.db` and `/opt/lims/backups/dev_predeploy_5cf1d1b_stopped_20260914_051857.db`.
- Fresh Chrome page as Carlos Morales, GTM-LAB1 manager, Spanish: project workspace loads, deep-linked sample query GTM0382-6-1C-T returns one matching row; pagination 1/1 and matching count agree; 9,882 expected samples appear as awaiting arrival, 0 lab work/review/released. No chunk-loading failure in this fresh-page check. This does not cover the separate old-open-tab cache scenario.

## Follow-up status

The previously queued note 26 has been delivered: Antigravity read it and is working on corrected browser evidence. Do not resend it or interrupt that work. Application release is now independently confirmed live; the full original project-management acceptance scope is not yet declared complete.

Remaining acceptance needs an honest mapping from the original 04-acceptance-and-release.md, including original six lab journeys and role/locale/mobile/performance/integration criteria, to concrete evidence or named unresolved work. Do not interpret four modal journeys as the six original lab journeys. Current GitHub open issue list shows only #92 (help centre); project-management unresolved acceptance must not disappear solely because corresponding issues were closed. Confirm issue dispositions against actual evidence at final closure. No new implementation or production rollback requested by this record.
