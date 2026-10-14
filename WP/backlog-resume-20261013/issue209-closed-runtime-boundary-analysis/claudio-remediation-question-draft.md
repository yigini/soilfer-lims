#209 runtime reachability follow-up to your native compatibility caution, not an audit-ready request.

The full ordinary run closed at 11:39:13 UTC: 305/370 suites and 4980/5630 tests passed; 650 failures in 65 suites. Original report/logs/inventory/exit are retained at audit daca2a12. All 57 application draft paths are among the 1309 frozen inputs that stayed unchanged. The sole changed input was the generated help manifest written by the existing help rollout test; that failure/provenance is retained honestly.

I am inspecting each failed context before changing fixtures. One released runtime shape is already confirmed by pinned source:

- Supported baseline 48d0e52 creates WorkItems before its separately caught initial-order block. Revision or line creation can fail, be logged, and still return the WorkItems. Missing or partial orders are therefore reachable from a released production path.
- Current main 2242bcb4 normal intake does create an initial revision and matching legacy null-linked lines. I am not claiming current normal intake is inherently orderless.
- #209 preserves exact single legacy matching and otherwise refuses new attempt INSERT with zero writes. The kit currently combines missing ACTIVE revision and missing matching line under NO_LINE, and counts prospective new-insert open WorkItems separately from continuing OPEN reservations.

There is an additional approved-history boundary: an APPROVED sample with no usable order cannot use the ordinary reasoned order remedy, because both edit routes correctly return AMENDMENT_WORKFLOW_REQUIRED. Scientific amendment authorisation resolves the order line before APPROVED-to-PROCESSING, so the amendment also refuses before changing anything. Current open-WorkItem impact counts do not cover these accepted owners' future amendment reservations.

Source proof, original blobs and the complete failed-case inventory are independently pushed at [runtime-boundary analysis](https://github.com/yigini/soilfer-lims/blob/b5e2e4c8f9f52f1b8c07820e57959de267743631/WP/backlog-resume-20261013/issue209-closed-runtime-boundary-analysis/source-analysis.json). This proves released-source reachability, not inspection of actual production rows or measured live impact.

Please choose the #209 boundary for these approved orphan contexts: keep zero-write refusal and make their separately counted/listed remediation a kit STOP prerequisite pending a separately reviewed forward fix, or add an explicit reasoned full-target order step within the existing scientific amendment workflow (new order/lines only before the new child INSERT, preserving all retained identities and scientific evidence)? I propose separate read-only missing-revision/missing-matching-line counts and a separate prospective approved-amendment refusal list in either case.

No automatic backfill, legacy relink, widened fallback, approved-edit guard relaxation, production collection, or fixture correction for these orphan contexts has been performed. Original accepted directions 6163271808/6166518424 remain intact. I will list runtime-reachable gaps and fixture-only current-context gaps separately in the audit request.
