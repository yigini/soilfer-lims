# Audit and design direction

## Evidence and limits

Local baseline: **6915824**, `fix(help): publish reviewed application guidance, enable 5-language editor workflows, and structured availability (#92)`. Source hashes are recorded in source-baseline.json. Git was clean when this review began. The live `/help` and drying article were inspected in Chrome without modifying records. Application operations were traced in source; this was not a complete live role or laboratory workflow test. Recheck the baseline before implementation because Antigravity is also working in this folder.

The earlier zero-publication incident is no longer the whole problem. The live Help home now shows categories with guides, and the drying article is readable. The present request concerns usefulness, depth, organization and presentation.

## Observed shortcomings

| Evidence | Why this fails a user | Required replacement |
|---|---|---|
| 27 source articles average **112 words**, ranging from 85 to 135, including title/summary/steps/success/caution | A short introduction is being presented as a complete procedure. More words alone would not solve it; missing decisions and actions do. | Separate quick answer from a real procedure, field guidance, example, recovery and handoff. |
| Live drying guide has four general steps; the final one says to use the available confirmation action | A technician still does not know which control to select or whether another submission is needed. | Name **Confirm Complete**, show **Checklist Verified**, explain the confirmation receipt and the online requirement found in the application. |
| Home is a large generic search hero, eight equal category tiles and another card grid | Users must browse the subject taxonomy before identifying their immediate task. | Small search header, role-specific tasks, a clear “Solve a problem” route and a compact library tree. |
| Visible role filters are all/technician/reception/manager | Six configured roles have no deliberate journey; users cannot infer their permitted controls from these filters. | Cover all ten actual roles. Permissions still decide actions; reader role selection only changes recommendations. |
| Live first recommended cards start with equipment/inventory subjects for the broad list | Alphabetical or database order is not a useful start-of-shift order. | Rank by the role's next task and the current page/blocker. Keep the full library available. |
| Live help pages are visually detached from the main app navigation | Users lose laboratory/account context and cannot easily return to the task they were doing. | Signed-in Help inherits the application shell and a safe return-to-work link. Public Help has a deliberately smaller public shell. |
| Guides contain no illustrated field examples or expected-state screenshots in their content schema | A new operator must translate abstract advice into an unfamiliar form unaided. | Versioned figures, structured examples, exact control bindings and before/after state explanations. |
| “Was my result saved or submitted?” compresses several distinct states into a few sentences | This does not resolve the recurring technician/manager handoff confusion. | A state reference plus a worked entry → record → submit → review example with clear actor ownership. |
| Generic support/language guides are mapped to specialist admin pages such as `/admin/labs` | A mapping exists but does not teach the actual page. | A dedicated lab-configuration guide plus relevant task and recovery guides. Count generic fallback separately from coverage. |
| Article data has only flat string steps and a generic reviewOwner | Cannot represent conditional steps, exact fields, examples, screenshot provenance or the app version that was tested. | A richer, structured article revision rendered consistently across all surfaces. |
| Live home claims procedures are verified for active laboratory methods | Product publication alone cannot establish scientific method validation. | Show honest “Application guidance checked against…” metadata; reserve scientific review claims for actual evidence. |
| Current batch paste parser expects two tab-separated columns | A vague “paste from Excel” guide hides ID matching, excluded rows and the distinction between drafts and recorded values. | A literal synthetic paste example and a preview/reconciliation procedure. |
| Spectral import and offline capabilities vary by implementation/configuration | A broad capability claim can mislead staff into attempting unavailable actions. | Bind guidance to enabled profiles/actions. Describe what the user can actually do and who resolves the unavailable case. |

## The new experience

Call the product area **Help & lab guide**. It should feel like a practical laboratory handbook: readable type, annotated work screens, method and sample context, clear procedures and an uncluttered contents tree. Avoid marketing-style claims, decorative KPI tiles, reward badges, stock scientist images or a conversational AI box as the main answer mechanism.

Three user intentions determine the navigation:

1. **Do a task** — direct, task-specific instructions for someone already at work.
2. **Solve a problem** — choose what happened, understand the cause, follow the permitted recovery and verify the outcome.
3. **Learn the workflow** — safe training examples and role-specific learning paths for newcomers.

A fourth, quieter **Reference** destination holds status definitions, fields, methods, permissions, terminology and integration specifications. FAQs are concise entry points into this content, not another copy of the manual.

## Practical scenario that drives the design

A technician has forty pH tasks. They should find **Record and submit a batch of results**, see how to select the method, match sample IDs, preview pasted values, deal with exclusions, record the eligible determinations, submit the correct samples and verify the handoff. A separate state explanation clarifies why a saved draft is not yet visible in the review queue. The guide must never make “40 rows pasted” look like “40 results approved.”

A second technician needs to complete preparation. Their page help should open with the relevant preparation procedure and the current blocker, not a general article list. Once they select **Confirm Complete**, the guide explains the receipt they should see. If the sample page and workbench contradict each other, the recovery describes preserving the receipt and escalating the inconsistency; it does not tell the technician to repeat the work through another page.

## Preserve versus replace

Preserve the current Help IDs/URLs where useful, publication history, feedback, permissions, approved local notes, locale records and scoped offline integration. Replace the reading layout, shallow bodies, recommendation logic, incomplete task coverage and editor ergonomics. Add structured content through an additive migration and compatibility adapter. Do not replace the entire laboratory application shell or alter laboratory state machines as part of a Help redesign.

Any current content that is verified and useful remains visible until its replacement is published. Do not withdraw the entire collection, reseed production or deploy an empty new UI while writing the replacements.
