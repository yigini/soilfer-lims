# Soil profile identity and reception improvements

Prepared on 3 October 2026 for Yigini and Antigravity; revised as **v2** the same day (see [what changed from v1](CHANGES-FROM-V1.md)). The owner has authorized the full sequential implementation and safe deployment without waiting for issue replies. This package describes the work; it does not claim the changes are implemented or live. No application code, laboratory records, permissions or production configuration were changed while preparing it.

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

Marcos's request needs more than changing form labels. The same reception rules and save operation must be used for a single sample, a consignment, a saved draft, an offline intake and any older acceptance button. Otherwise one page can accept a sample that another page rejects, or synchronization can lose facts recorded offline.

The latest [issue 140 update](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5972150911) explains the retryable error and requested receiver evidence. The latest [issue 156 update](https://github.com/yigini/soilfer-lims/issues/156#issuecomment-5972151075) explains the reception delivery. Eloi and Marcos have not replied to those updates yet; the owner's authorization allows implementation to proceed. Their feedback can refine the work, while actual OpenNSIS acceptance remains a separate recorded result.

## What staff will see

**Reception staff:** the right form appears automatically for the sample's project, laboratory, origin and material. They see why that template applies. A soil profile code is recorded when known; a missing value stays clearly marked. Drafts reopen with their answers, photos and original valid rules intact. New defaults affect new drafts. Online and offline intake preserve the same information; synchronization cannot quietly turn an unfinished draft into a received sample.

**Laboratory managers:** after B1, an “Intake rules and form” area lets them choose which form applies to each origin (commercial, SoilFER, other projects) and to individual projects, and switch checks and context fields on or off or between required and optional. Each change is saved as a new version that does not rewrite past intake decisions. B2 completes the requested configuration with their own checks and fields, localized labels and a focused draft–preview–publish–retire workflow. Upgrading a saved draft is an explicit choice with a visible comparison; staff do not lose their answers. Existing role permissions remain authoritative.

**Technicians:** their ordinary analytical work stays in the workbench. No national profile-management task or new result field is added to their queue.

**Integration operators:** errors distinguish “no eligible data” from “temporarily unable to read eligibility.” A protected two-layer fixture lets Eloi confirm that one pit produces two distinct layers and specimens in OpenNSIS.

## Recommended delivery

Four small releases instead of two large ones, so each change can be reviewed and shipped on its own:

1. **A0 — clear API errors (issue 140, small).** When the eligibility check fails, the API says "temporarily unavailable, retry" instead of returning an empty list. This fixes a confirmed source defect and ships first; it is not yet proof of the cause of Eloi's reported incidents. The issue update gives the receiver retry notice; acknowledgement is not a deployment gate. The response includes a request ID so actual incidents can be traced.
2. **A — soil profile identity and speed (issue 140).** Inventory current and previously exported profile keys, including journal and snapshot evidence; preserve their exact identity through project/country changes. Then add the saved profile reference, the two-layer test fixture and measured performance fixes. Explicitly unknown references stay unknown; invalid references need a clear correction rather than silent regrouping.
3. **B1 — consistent reception and basic configuration (issue 156).** Every intake path, including the existing offline queue, uses the same server-side rules and save operation. The batch form stops pre-ticking checks and inventing 0–20 cm depths. Managers can pick the form per origin or project and switch checks and fields on or off. Saved valid revisions remain pinned. This is the first useful increment, not completion of Marcos's whole request.
4. **B2 — complete template configuration (issue 156).** Custom criteria and context fields, localized labels, focused draft/preview/publish/retire controls and explicit draft upgrade comparisons. This following increment is already authorized; no new permission or contributor response is needed to start it after B1 acceptance.

Each release goes through the established review and safe deployment process before the next. Keep issue 140 open until Eloi records the real receiver acceptance; that acceptance does not block LIMS releases. Close issue 156 only after both B1 and B2 are verified across the supported intake paths. Hardware and human theme monitoring keeps its separate scope.

Antigravity implements the LIMS changes. Eloi's team owns OpenNSIS. An actual receiver receipt proves ingestion; a successful LIMS request proves only fetching.

## Files to review or share

- [Interactive explanation](review-preview.html)
- [Full implementation plan](IMPLEMENTATION-PLAN.md)
- [Instructions for Antigravity](ANTIGRAVITY-HANDOFF.md)
- [Acceptance checklist](ACCEPTANCE-CHECKLIST.md)
- [Synthetic two-layer example](examples/two-layer-pit.json)
- [Review sources and limitations](REVIEW-EVIDENCE.md)
- [What changed from v1](CHANGES-FROM-V1.md)

The example and preview are demonstration assets. They are not live records, import scripts or completed test evidence.
