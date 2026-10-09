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

Pushed WIP9b8ea7e2 adds the bounded policy definition, all ten policy locale
labels, pure read projection and frozen/current resolver. Owned validation:
two suites,50 tests PASS,zero skips,21.651s, including real DB policy/freeze,
historical missing-count, foreign-scope and malformed-evidence zero-write cases.

[Parent-set pin6080751135](https://github.com/yigini/soilfer-lims/issues/198#issuecomment-6080751135)
keeps all retained parent replica numbers under #191 completeness/replacement
rules, regardless of the current count or pair verdict. A genuinely new number
above the count requires a recorded FAIL pair and number3; a new fourth refuses.
The central Result writer now checks this before any evidence write. Validation
of this new guard is pending. Queue/UI integration remains to implement.

Existing test changes, all under that pin:

| Test | Setup/expectation change | Assertions retained |
| --- | --- | --- |
| #191 repeat command fixture | Explicit required count2 through policyService; the three-reading parent is recorded by the actual writer as a failing pair then its third reading | All original command, authority, completeness, event, rollback, supersession and submission assertions |
| Retained parent3 replacement | Current count becomes1 before the child fills, proving parent-set authority wins | Every original missing-parent, Result preservation, supersession and submission assertion |
| Extra child3 with parent2 | Strengthened to409 REPLICATE_NOT_REQUIRED plus zero-write snapshot; counts exclude refused row | Every original missing-parent2 refusal and eventual append/supersession/submission assertion |

No factory/writer exemption or scanner change. Migration/backfill counts0.
No changes to analytical/QC/audit data or the native QC evaluator. Production
freeze and195 release hold remain in force.
