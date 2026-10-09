# Audit 4.5 — replicate grid (#198), WIP

Branch `audit/4.5-replicate-grid` begins at merged main663c9664.
Dependencies186 and190 are merged. Cited dropdown/single-editor defects
remain. The existing Result writer supports an absent replicate in the same
recorded execution; native QC positions remain one observation each.

[Pin6080225630](https://github.com/yigini/soilfer-lims/issues/198#issuecomment-6080225630)
specifies `results.replicatesRequired` (integer1..2, default1 in all presets),
Result replicates1/2 within one WorkAttempt for SAMPLE rows, and server read
projection using existing duplicate math. Frozen native criteria take precedence;
legacy missing count uses current policy with its source displayed. A failing
sample pair is amber only; no QC gate/status/NCR or reported-value selection.

Third entry appends replicate3 to the same RECORDED execution only when the
required pair fails. The fourth refuses. Submitted work retains the existing
reviewer repeat authority. Third-entry values/range require review; no automatic
n=3 decision. Texture is deferred. No migration or backfill is planned.

Initial WIP adds the bounded policy definition and pure read projection with
behavioral edge tests. Queue/context/writer/UI integration, all locale labels
and owned validation remain to implement. No validation pass is claimed.
No changes to analytical/QC/audit data or the native QC evaluator. Production
freeze and195 release hold remain in force.
