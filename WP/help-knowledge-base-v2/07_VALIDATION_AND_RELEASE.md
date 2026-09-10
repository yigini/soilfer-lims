# Validation, rollout and definition of done

## Validate usefulness before polishing every page

Use the new home, batch guide, drying guide and problem solver in a small test with representative intake, technician and manager users. Give a goal, not instructions on how to use the Help UI. Observe whether they can find the answer, finish the task in a demo lab, distinguish the final state and recover from the supplied failure. Record where they guess, backtrack or ask for coaching; revise the content and navigation there.

Suggested initial targets are finding the correct guide within two deliberate navigation actions or a successful search, and identifying the next responsible person without coaching. These are proposed acceptance targets, not measured performance claims. Do not infer task success from a “helpful” click alone.

## Task-based acceptance cases

| Case | Setup and user goal | Must be demonstrated |
|---|---|---|
| T01 — First shift | New technician, five synthetic assigned samples | Can find preparation and result instructions, identify the correct sample and know when work reaches the reviewer. |
| T02 — Forty-row batch | Same-method results, two invalid/unmatched rows | Preview accounts for all rows; user understands drafts versus recorded values; excluded rows are not silently submitted. |
| T03 — Drying confirmation | Checklist checked but not yet confirmed | User finds Confirm Complete and recognizes the saved receipt; does not enter a number as drying evidence. |
| T04 — Preparation contradiction | Receipt present but another view appears incomplete | User compares task/attempt and blocker, preserves evidence and does not repeat completion through the sample page. |
| T05 — Saved versus submitted | Recorded result absent from manager review queue | Technician performs the actual submission handoff; manager finds the submitted version. |
| T06 — Intake | Source project sample exists; physical material just arrived | Intake follows identity, condition, analyses and handover; draft/expected records are not mistaken for receipt. |
| T07 — Missing location | Reopened draft and source field data disagree | User distinguishes missing display from missing source; no invented coordinates or duplicate intake. |
| T08 — Texture | Configured grouped sand/silt/clay result, invalid total | User identifies the joint validation and derived class; no silent normalization or manual overwrite of the derived class. |
| T09 — Spectra | Correct file, unmatched file and unsupported profile fixture | User matches sample/scan, understands exclusions and distinguishes import, QC, prediction and report approval. |
| T10 — Manager approval | Fresh intake, partial submission, complete reviewed sample | Guide never suggests all are approvable; each next step respects actual server capability and completeness. |
| T11 — Amendment | Previously approved result/report | User follows the controlled correction and replacement history; no direct overwrite recommended. |
| T12 — Equipment | Method-ineligible or service-held instrument | User finds the cause and responsible owner; no unauthorized bypass. |
| T13 — Inventory | Expired/quarantined lot | Help explains actual eligibility and traceability; no acceptance criteria invented. |
| T14 — Offline | Cached permitted tasks, partial sync and conflict | User identifies local/server state, reconciles by receipt and preserves pending work. |
| T15 — All ten roles | Separate fixtures for the configured roles | Useful role home and permitted task guidance for each; Explore another role never changes identity/permissions. |
| T16 — Languages | en/es/es-419/fr/pt across reader, context and editor | Complete article blocks, examples/captions/alt text, terms and error states; truthful fallback only. |
| T17 — Field/project/SIS | KoBo import, expected material and rejected delivery | Reader distinguishes source import, physical receipt, lab processing, report and external delivery. |
| T18 — QA/audit | Versioned result and evidence trail | Auditor can follow who changed what and why within read-only scope. |
| T19 — Context and drafts | Typed worksheet values, Help open/drill-down/back/close | Values, focus and selection remain; zero laboratory mutation from Help itself. |
| T20 — Public reader | Login help and a valid/expired public report fixture | Only approved public content; no token leakage, private titles or authenticated record access. |
| T21 — Content publication | Drafts, reviewed locales, prior v1 release and v2 replacements | Readers see the correct approved revision; no empty collection during cutover; rollback preserves history. |
| T22 — Editor concurrency | Two editors change/publish from the same starting version | Clear conflict rather than a silent lost edit or multiple current publications. |
| T23 — Support | Configured and unconfigured destination; offline mode | Exact recipient/message preview; no secret leakage or false sent/copied/queued confirmation. |
| T24 — Navigation/media | Old URLs, section links, missing/stale screenshots | Canonical redirects work; content remains understandable without an image; editor sees stale dependencies. |

## Automated and manual coverage

Automate shared content schema validation, duplicate/missing IDs, broken links/anchors, cycles in decision flows, source/locale hash coherence, registry binding validation, publication selection and cache scope. Add real React/API integration tests around data contracts. A mocked array response or a passing build is not evidence that the guide renders its title and steps.

Run actual browser scenarios for home → task → article, keyword/symptom search, contextual blocker → relevant section, reader language change, editor draft/review/publish and return-to-work preservation. Use isolated fixtures for mutation tests; production checks should normally be read-only. Verify operational records and values are unaffected by help read/search/feedback/release tests, not just the number of Sample rows.

Test real IndexedDB storage for account/lab/locale isolation, sign-out behavior, withdrawal learned on reconnect, stale pack replacement, missing media and offline reload. Feedback must either be durably queued or explicitly not sent. Never clear the operational offline queue to repair a Help test.

## Accessibility and visual acceptance

Target WCAG 2.2 AA. Check headings/landmarks, article contents navigation, meaningful links, keyboard-only use, mobile focus containment/return, screen-reader naming, 200% zoom and 400% reflow where applicable. Test at 320, 390, 768, 1024 and a wide desktop width, in light and graphite. Long French/Portuguese phrases, narrow viewport field tables and translated decision paths must not clip.

Respect reduced motion; no forced autoplay. Content works without hover. Figures have useful alternative text and surrounding instructions. Keep language selection consistent with the app. No dark text on dark panels, pale text on white panels, or decorative labels that appear interactive.

The provided prototype QA is evidence only for the isolated proposed design. It cannot certify the new production React UI, content accuracy, actual permissions or offline synchronization.

## Content completeness gate

For every enabled operational route and important tab/control, record a relevant published task/reference/problem guide, tested role, language availability and evidence. A route linked only to general support is **fallback**, not complete. Declared aliases inherit a canonical mapping. Institutional pages may reference their own non-operational explanation instead of commissioning an unrelated procedure.

Every commissioned brief must be completed, deliberately merged with a documented successor, or explicitly marked not applicable because the capability is absent. Do not call disabled/future features supported. Each enabled method input family has an appropriate verified guide. All ten roles have a clear first-use path or deliberate read-only introduction.

Article counts are reported from the resulting manifest. The plan's inventory count is a scope tool, not a quality score or substitute for user task success. Content with missing screenshots may be released only if the text fully explains the task and the absent visual is not essential; missing steps cannot be excused that way.

## Five-language gate

Each published locale must match its actual approved source and publication membership. Verify visible strings and full body blocks, not just translation-key parity. Include search aliases, method terms, screenshots/captions and printable output. Independent regional/terminology review is recorded honestly; automated translation or QA is not called human scientific review.

If a particular language remains incomplete, surface that precise status and keep a coherent approved fallback. Do not advertise the complete five-language launch until the stated scope is actually available. Preserve the prior working content during translation work.

## Rollout sequence

1. Record current code/content release, existing publications, help assets and non-sensitive baseline evidence. Use the established backup and recovery process.
2. Ship additive schema support, legacy adapter and v2 renderer behind a Help-only flag; v1 approved content remains readable.
3. Verify complete representative v2 journeys in a demo/staging environment, including failure paths and locale behavior.
4. Stage the full replacement collection, assets, translations, old-link redirects and release manifest. Verify actual publication-read coverage.
5. Build the exact production image from the reviewed commit; inspect runtime assets and test fresh and upgrade behavior against disposable data.
6. Publish the reviewed content manifest and enable the v2 reader through the established release process. Coordinate renderer and content compatibility; do not expose an empty UI between the two.
7. Verify the live build/content release and representative role/page/language reads. Report number of available guides and unresolved exceptions accurately.
8. Push relevant source, documentation and non-sensitive evidence to GitHub. Update existing Help issues and create linked defects for demonstrated out-of-scope workflow bugs. Close only completed scope.

Rollback switches to a compatible previous reader/content release and preserves publication history. It must never restore an old operational database over new sample/results work. Do not deploy by manually patching a running container or copying the whole design package into runtime.

## Ongoing release discipline

Require a small content-impact section for PRs changing bound controls, status labels, method input schemas, permissions or integration behavior. It names affected guides/figures/locales and either updates them or provides a verified compatibility reason. A build-time stale binding warning should become an editor action with a named owner. Avoid automatic bulk withdrawal of harmless content because a source file changed.
