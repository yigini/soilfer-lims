# Order revisions

Both analysis-edit routes and intake generation use `orderService`. A changed
order requires a reason and the complete normalized target analysis set. The
transaction reconciles actual WorkItems, supersedes every prior ACTIVE revision,
retains its lines, and creates one ACTIVE revision. Approved, archived and
disposed samples require the amendment workflow.

New lines carry a fixed nullable `workItemId`. This is a historical identifier:
it is validated against the sample and analysis when inserted, rather than a
foreign key that would prevent the existing removal of unstarted work. Removing
such work leaves its retained order-line identifier unchanged. Installation
does not link, normalize or otherwise rewrite historical lines or attempts.

A new execution, repeat or scientific amendment first resolves a linked line,
then exactly one legacy null-linked line in exactly one ACTIVE revision. Zero
matches, ambiguous matches and multiple ACTIVE revisions return
`409 ORDER_LINE_REQUIRED`; a reasoned full order revision resolves that context.
Already-reserved OPEN attempts retain their original identity during first fill.

When the logical target contains TEXTURE, every existing non-WAIVED SAND, SILT
and CLAY WorkItem, including completed work, receives its own fixed companion
line alongside the canonical TEXTURE line. The same reasoned transaction retains
these owners. One or two fractions refuse with
`409 TEXTURE_FRACTION_OWNERS_INCOMPLETE`, naming missing fractions without writes.
No fraction owner is created, and the catalogue normalizer, requiredAnalyses and
derivation remain unchanged. An explicit target without TEXTURE uses normal
reasoned removal. Intake continues to generate the collapsed TEXTURE owner only.

The source-bound additive installer runs after the policy and control-chart
owners. Direct startup checks readiness before loading the app or jobs. Partial,
tampered and unmarked linked schemas refuse startup with zero writes. Docker
retains the exact migration under `.migrations-backup/209` outside its data volume.

The deployment kit must retain read-only counts and identifiers for samples with
multiple ACTIVE revisions and prospective new-attempt order-line refusals,
split by cause. Continuing OPEN reservations and ambiguous OPEN reservations are
reported separately using the execution allocator's actual decision. Claudio
also reviews `FRACTION_OWNER_LINE_REQUIRED` refusals (the fraction subset of the
runtime's unchanged NO_LINE cause) and incomplete texture-owner sample lists.
Either nonzero count requires YY to see its sample list before the gate. Claudio
reviews these counts, and YY sees any refusal list before the fresh release gate.
All retained-copy allocations must be included in disk accounting. This document
does not authorize production collection or an installer attempt.
