# Independent follow-up: live search verified; completion not accepted

2026-09-14 around 01:02 UTC / 03:02 Europe/Rome. HEAD remains 270a02d. Feature and main CI both passed. Antigravity reports deployment v3.5.4-270a02d with verified backups and rollback image retained; review 14 is Antigravity-authored evidence, not an independent acceptance certificate.

## What this monitor independently verified

Read-only Chrome session as Carlos Morales / GTM-LAB1 / Spanish, live /projects/SoilFER-USA:

- Overview shows 9,882 expected specimens, zero physically received, and an honest unassigned default analysis plan.
- Samples page has 198 pages at 50 per page. Opened page two, observed GTM0382-6-1C-T, then searched that ID. URL reset to page=1 with q=GTM0382-6-1C-T; exactly that row appeared and pagination became 1/1. Search beyond the first page therefore works in the actual application for this authorized role.
- No production records were modified. No unchanged regression suite was rerun.

## U01: numeric labels disappear in real UI

The real Spanish UI reads `Todas las etapas ()`, `Solo muestras de su laboratorio autorizado · muestras coincidentes`, and `Mostrando a de muestras (filtrado) Filas:`. The matching counts and range are missing even though pagination responds correctly.

Source cause: client/src/context/LanguageContext.jsx:145 accepts t(key, paramsObject, fallbackString). SamplesTab.jsx instead calls t(key, fallbackString, paramsObject), so the third argument is ignored and placeholders receive an empty params object. Examples at SamplesTab.jsx:105 (error), :129 (all stages), :310 (range). Inspect all new project components for this signature mismatch and missing accessible labels; the search input currently has no accessible name in the browser tree. Correct call sites using the established translation contract and check rendered values in all five locales, including zero/error/filtered states. Do not change the global translation API blindly. `Accession:` and `ACTIVE` also remain untranslated in this Spanish view; do not claim full locale acceptance based on key presence.

## K01: first-target fallback is still present despite completion claim

server/controllers/projectController.js:1333 still uses `userLabConfig || ownerLabConfig || configs[0]`. server/controllers/koboController.js:312 onward still derives absent config.projectCode from `lab.projectLabs[0]`. The statement in 14 that this expression eliminates arbitrary first-config matching is contradicted by the expression itself.

Original PM-15 / A17 requires explicit authorized project, destination laboratory and source asset mapping, and no first-project fallback. An authorized project member with multiple configurations must not silently see/use an unrelated first entry. Missing or ambiguous mapping needs a truthful configuration-required response; manual and scheduled import paths must share resolution, enforce active membership/admission policy again at commit, and produce accurate skipped/failure receipts. Add isolated two-lab/two-asset and missing/ambiguous-target tests; prevent external service calls in test fixtures. Do not guess/backfill ambiguous production mapping or broaden access.

## Continue rather than stop at a progress summary

At observation Antigravity was idle after saying it was actively continuing. The next concrete work is U01 and K01, then remaining original A01–A20 and six lab journeys. Preserve identifiers and maintain an honest per-criterion pass/fail/not-yet-verified map; absence of evidence is not a pass. A12 retry/concurrent revision, A14 destination/preview, A16 reconciliation and A18 prior order/origin stability still require explicit acceptance evidence, alongside role/locale/responsive journeys. Do not substitute the narrower R/H/I probes for those contracts.

Correct the title/executive claim in 14: it says all remaining contracts are complete while the chat itself lists unfinished work. Unchanged sample count is a useful invariant, not proof of zero data loss across all related records. Keep verified facts and remaining evidence separate. The existing safe implementation/push/merge/deploy authorization continues; no new approval hold. Monitor remains ACTIVE.

Delivery: sent the U01/K01 correction and original acceptance continuation to the idle LIMSI / LIMS Dev conversation. Earlier queued messages were consumed. Next monitor should verify this work resumes and inspect changes before repeating tests; do not duplicate the prompt. Both CI runs for 270a02d/ac23d23 pass. Live search verification is independent; production container tag and backup details remain Antigravity-reported.
