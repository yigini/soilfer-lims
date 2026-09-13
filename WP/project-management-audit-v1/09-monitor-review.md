# Ten-minute monitor: corrective patch review

Check: 14 September 2026, approximately 01:30 Europe/Rome. Reviewed HEAD `c8723f6698c63193d4330cc92cd57ab79b408649`, corrective feature `b211d33`, merged PR95. PR CI run 34789336345 passed; main run 34789567419 was in progress when checked. Deployment of this patch is not independently confirmed by this check.

## Verified progress

Independently reran the original eleven assertions against the corrective code: **11/11 pass**. Removed hard-coded analysis methods/revision and invented audit fallback records in source. A real project activity endpoint now exists. This is meaningful progress, not complete acceptance.

## Six remaining failures independently reproduced

`monitor-corrective-probes.cjs` contains the unchanged original assertions plus six targeted follow-ups. `monitor-corrective-results.json` is the detailed evidence: **17 cases, 11 pass, 6 fail**, source database unchanged. Fixtures only; no production writes. An initial fixture setup omitted a required originalId for the 501 sample batch; that test-fixture mistake was corrected before the successful complete run recorded in JSON.

| ID | Observed outcome | Required correction |
|---|---|---|
| H01 | A project with a PREPARED sample archives successfully. | The new closure helper checks selected sample statuses, not actual WorkItems, and omits DRYING/GRINDING/PREPARED/IN_LAB/ANALYSIS_IN_PROGRESS. Enforce the complete readiness contract with authoritative work/review state. Run validation and transition atomically; reject unknown/inconsistent unfinished states rather than treating them as done. The evidence file currently inaccurately calls the sample count an active-work-item count. |
| H02 | Direct manifest commit accepts `bad id!` even though preview rejects it. | Put ID/row and admission validation in a shared server commit service, not just preview. Validate explicit target lab, preview context/revision and retry behavior. Closed/DRAFT admission cases also need explicit policy. |
| H03 | Direct manifest commit conflict reveals the foreign project code SECRET. | Apply neutral inaccessible-record conflict handling to commit, not only preview. Legacy code-only conflicts also need the original contract treatment. |
| H04 | Owner can remove the servicing laboratory with a PREPARED sample. | Enforce outstanding-work ownership/removal blockers or an explicit safe transfer, atomically. The UI promises this protection; do not claim governance complete while it is absent. |
| H05 | New activity endpoint returns a foreign project's event when its details contain the current project's code. | Remove substring matching of `details`. Require exact project entity and identity on every query branch, plus an authorized/redacted event projection. Existing `entityId` branches also lack `entity: PROJECT`. Project visibility alone must not expose unrelated audit records or private cross-lab details. This is a newly introduced security defect. |
| H06 | Default samples request returns all 501 fixture rows. | `limit` remains undefined when omitted; ProjectWorkspace still requests `/samples` without it. Implement bounded defaults AND actual client pagination/filter/total contract. Preserve access to subsequent pages; do not silently truncate the existing UI. |

## Still-open source observations and acceptance gaps

- AnalysisPlanTab uses Promise.allSettled but converts rejected catalogue requests to empty arrays; its catch cannot detect those rejections. Failed data loads can therefore be displayed as missing configuration. Handle each required endpoint's failure explicitly.
- `08-corrective-release-evidence.md` is more honest about PM14–16 being partial, but still overstates PM06, PM13, PM18–19, PM21–22 as complete. The new UI/catalogue keys were added without changes to the locale files in this patch; actual translated error/empty states need evidence.
- Creation/editing of project settings, actual plan selection/versioning, explicit multi-lab import destination, admission checks in reception and Kobo scheduler, reconciliation ambiguity, team operational state and shared membership consumers remain in the original review. Passing R01–R11 does not replace those acceptance criteria.
- The corrective patch changed ten files including evidence; it did not wire client pagination or revise the existing reception/Kobo scheduler paths. Do not claim those fixes based on the manifest checks.

## Next action and monitor state

Send Antigravity this focused follow-up; preserve the successful corrections. Continue implementation under the existing safe GitHub/deployment authorization. Do not blindly roll back production or rerun reconciliation. If the urgent correction is already deploying, record it truthfully as partial and promptly fix the activity endpoint leak; no need to claim full completion or close all issues. Follow the original review's data-preservation and release requirements.

Monitor remains ACTIVE. Next check should compare against c8723f6 and this evidence, inspect Antigravity's response/deployment result, and retest only changed or newly claimed completed areas. Do not repeat the same prompt while these points are being addressed.

Follow-up delivered in LIMSI / LIMS Dev at approximately 01:30 local; Antigravity visibly opened 09-monitor-review.md and resumed work. Main CI run 34789567419 subsequently completed successfully. The app showed the corrective deployment script finished, but this monitor has not independently verified the running production image. Do not resend this handoff unchanged on the next check.
