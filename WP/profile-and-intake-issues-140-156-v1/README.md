# Soil profile identity and reception improvements

Prepared on 3 October 2026 for Yigini and Antigravity. This is a reviewed implementation proposal. No application code, laboratory records, permissions or production configuration were changed while preparing it.

## What is finished

The theme software is live as `v3.5.32-25535b6`. Documentation [PR 157](https://github.com/yigini/soilfer-lims/pull/157) is merged, and its checks on the merged commit have passed. The previously listed physical device, printer and human accessibility checks remain pending. They do not prevent preparing this next piece of work.

## What Marcos and Eloi are asking for

There are two related requests, with different purposes:

- **[Eloi, issue 140](https://github.com/yigini/soilfer-lims/issues/140):** preserve the identifier that tells the national soil system which bags came from the same soil pit or sampling point. Complete the two-layer example and investigate slow or unexpectedly empty data responses.
- **[Marcos, issue 156](https://github.com/yigini/soilfer-lims/issues/156):** let authorized managers configure reception checks and context fields for different projects and commercial samples. The present form is too closely tied to SoilFER.

Neither request concerns the login account's personal profile. We should call configurable reception forms **intake templates**, so they are not confused with a **soil profile**.

## The soil profile identifier explained

Imagine collecting two bags from one pit:

| What it identifies | First bag | Second bag |
|---|---|---|
| Soil pit or profile | PIT-DEMO-01 | PIT-DEMO-01 |
| Sampling depth | 0–20 cm | 20–50 cm |
| Field bag label | DEMO-BAG-A | DEMO-BAG-B |
| Laboratory accession | DEMO-LAB-A | DEMO-LAB-B |
| Internal specimen identifier | One unique identifier | Another unique identifier |

The pit code links the bags. Their individual identities and results stay separate. A namespace tells us which survey or dataset owns the pit code, because another project may also have a `PIT-DEMO-01`.

**A site or plot code does not automatically prove that a sample belongs to a described soil profile.** LIMS must preserve the source's meaning. Matching GPS positions, similar bag labels or matching depths are insufficient proof.

For a commercial fertility sample, a pit code may be unknown or irrelevant. The lab must still be able to receive it, analyse it and issue its report. The national integration can show that the profile information is missing without inventing it.

## What already works and what needs attention

Eloi [reported a successful scoped staging import on 29 September](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5888715148). Field-bag and laboratory IDs, dates, depths and observations arrived correctly. We should retain that working connection.

The current API can already export a soil profile reference. Older demo records do not contain the necessary source values. The source review also found that the extractor may prefer a site code to an explicit pit code, and it derives the namespace from project/country labels rather than preserving a saved reference. These are focused fixes; they do not require rebuilding the integration.

Eloi also [reported approximately five-second responses and occasional empty results](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5910614372). We found a real code path where failure to check a provenance hold becomes a successful empty response. That may explain his experience, but a production incident still needs to be correlated. The correct behavior is a clear temporary error, with protected data withheld, so the receiver can retry safely.

Marcos's request needs more than changing form labels. The same reception rules must be used for a single sample, a consignment, a saved draft and any older acceptance button. Otherwise one page can accept a sample that another page rejects.

## What staff will see

**Reception staff:** the right form appears automatically for the sample's project, laboratory, origin and material. They see why that template applies. A soil profile code is recorded when known; a missing value stays clearly marked. Drafts reopen with their answers, photos and original rules intact.

**Laboratory managers:** an “Intake rules and form” area allows them to copy a template, adjust relevant checks or fields, preview it and publish a new version within their authority. Publishing a new version does not rewrite past intake decisions.

**Technicians:** their ordinary analytical work stays in the workbench. No national profile-management task or new result field is added to their queue.

**Integration operators:** errors distinguish “no eligible data” from “temporarily unable to read eligibility.” A protected two-layer fixture lets Eloi confirm that one pit produces two distinct layers and specimens in OpenNSIS.

## Recommended delivery

1. Finish the profile-reference capture, two-layer fixture and API reliability work for issue 140 in a focused change.
2. Add versioned intake templates for issue 156 in a separate change, using the same canonical field mappings.
3. Review the relevant tests and deploy each accepted change through the established safe release process.
4. Keep issue 140 open until the remaining real receiver acceptance is recorded. Close issue 156 only after its configured forms work consistently across intake paths.

Antigravity implements the LIMS changes. Eloi's team owns OpenNSIS. An actual receiver receipt proves ingestion; a successful LIMS request proves only fetching.

## Files to review or share

- [Interactive explanation](review-preview.html)
- [Full implementation plan](IMPLEMENTATION-PLAN.md)
- [Instructions for Antigravity](ANTIGRAVITY-HANDOFF.md)
- [Acceptance checklist](ACCEPTANCE-CHECKLIST.md)
- [Synthetic two-layer example](examples/two-layer-pit.json)
- [Review sources and limitations](REVIEW-EVIDENCE.md)

The example and preview are demonstration assets. They are not live records, import scripts or completed test evidence.
