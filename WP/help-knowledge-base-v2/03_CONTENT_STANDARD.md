# Content standard: instructions people can use

## The acceptance question

Could a person with the stated role, on the stated release and method configuration, finish the task and recognize success without guessing a control, a value or a handoff? If not, the article is incomplete even if it is grammatically polished.

The goal is completeness of decisions and actions, not length. A short FAQ answer might need 60–120 words; a procedure may need several phases, a figure and a field table. Put the quick answer first, then enough detail to complete the job. Avoid a long introduction explaining the benefits of LIMS.

## Required procedure template

| Block | What the writer must provide |
|---|---|
| Task title | An action and object: “Record and submit a batch of pH results.” Avoid “Manage laboratory workflows efficiently.” |
| Outcome | What exists after completion and who can use it. |
| Applies to | Current role/capability, page, enabled method/input family, online/offline requirements and verified release. |
| Quick answer | Exact path and finishing action, plus the most important state distinction. |
| Before starting | Only relevant prerequisites, required information, instrument/file context and permissions. |
| Procedure phases | Numbered steps with location, exact control, action and expected on-screen outcome. |
| Field/example panel | Meaning of each important field, allowed source, units/qualifiers, a synthetic example and a common mistake. |
| Check it worked | Receipt/status location, durable confirmation, included/excluded items and next actor. |
| If something differs | At least the relevant common errors, how to identify them, permitted recovery and escalation evidence. |
| Related reference | A specific status, method or SOP reference that helps the task; no random article recommendations. |
| Editorial metadata | Source/UI bindings, review provenance, locale and content revision, compatibility and figures. |

Not every article needs every block. A concept explanation should not pretend to be a procedure; a status reference should use a table; a task guide should not become a scientific textbook. Missing a block must be an intentional editorial decision, not a placeholder.

## Step-writing rules

1. Say where the user is before the action when context changes: “In **Workbench**, open **Ready to Submit**.”
2. Use the exact visible label resolved through the application's locale catalogue. Stable UI keys are stored separately; never display code identifiers to normal readers.
3. Start with a concrete verb: Open, Select, Enter, Compare, Review, Confirm. Prefer **Select** to mouse-only “click” when touch/keyboard also work.
4. Put the result next to the action: “Select **Confirm Complete**. A **Checklist Verified** receipt should replace the editable checklist.”
5. Explain the finishing action and any separate handoff. “Draft saved” cannot stand in for “submitted for review.”
6. When a field value comes from the sample label, instrument, approved SOP or external record, name that source. Do not invent values to make the example look complete.
7. Put a critical caution immediately before the risky action. A repeated generic warning at the end of every article is easy to ignore.
8. For a branching action, state the condition and choice explicitly. Avoid sentences such as “use the appropriate option as required.”
9. Use synthetic examples such as DEMO-001 and clearly label them as examples. Do not imply a sample exists in the user's lab.
10. When a screenshot and the current UI differ, the text must still be usable, and the mismatch must be reported. Do not ask users to hunt for a missing button under a different name.

## Before and after

**Rejected style:** “Use the available confirmation action and inspect the resulting receipt or pending synchronization status.”

**Required style, verified against the source baseline:** “Once you have performed and checked every item, select **Confirm Complete** on the drying row. Look for **Checklist Verified**, the receipt identifier, the confirming user and the recorded time. If you see a connection error instead, the confirmation has not been verified; keep the task open and check the receipt after reconnecting before trying again.”

This names the action and observable result without inventing an analytical temperature or promising an unsupported offline operation. Representative live verification is still required before production publication.

## Problem-solver template

Each problem has a recognizable symptom, what to check, one or more explicit causes, the next permitted action, the responsible role, the evidence of recovery and a safe escalation payload. Decision nodes have stable IDs, an accessible question and labeled answers. Include “I cannot tell.” Detect loops and unreachable terminal nodes in validation.

Example: **I saved results but the manager cannot see them.** First establish whether the result is only a draft, has been recorded, or has been submitted. Do not begin with “refresh the page.” If recorded but not submitted, guide the technician to the submission step. If a server submission receipt exists but the manager cannot find it, check lab/queue/filter and escalate using the receipt reference. Never tell the technician to create another result to make it appear.

## Field reference template

Use columns: **Field**, **What to enter/check**, **Where it comes from**, **Example**, **If missing or wrong**. Mark required/optional/conditional from the actual method configuration, not from a manually maintained contradictory help rule. Explain why the field matters when that changes the user's choice. Keep defaults distinct from measurements. Never put 0 in a missing result example.

For numeric inputs document units, basis, decimal convention, qualifier support and the treatment of missing/not-measured values as implemented. For grouped outputs describe their joint validation and derived display. For spectra describe file/sample matching, actual import profile and acquisition metadata. Supported extensions displayed by a file picker are not proof that every file of that extension is parseable.

## Figures and learning material

- Use actual app screenshots from a dedicated synthetic/demo environment. Record code build, UI locale, figure version and the exact guide steps it supports.
- Use close crops plus a small page/tab reference. Annotate controls with numbers that correspond to the nearby text, not color alone.
- Supply meaningful alt text and a text equivalent for important state changes. Do not write “screenshot” as the complete alternative.
- Never include credentials, report tokens, personal details or real results. Check every crop before publication.
- Version screenshots with their source step. A changed label should flag the related figure and translations for review.
- If video is used, keep it focused on one action, include captions/transcript, stop/play controls and an equivalent written procedure. Video is optional; text is always sufficient.

## Scientific and operational truth

Help explains how to use the software. A controlled SOP explains how to perform the laboratory method. Link them without conflating their authority. No help article may establish a new temperature, preparation endpoint, texture tolerance, pH ratio, instrument acceptance limit, conversion formula or report interpretation.

Parameter articles must identify the configured method variant and measurement basis. “pH” alone may not identify the method. MIR/NIR acquisition, predicted properties, wet-chemistry reference measurements, spectrum acceptance and report release are separate concepts. Soil texture fractions, their configured size boundaries and the classification system must be explicit. Any scientific facts introduced during writing require primary references and appropriate method review.

External references are checked for edition, language, method applicability and licensing. GLOSOLAN and instrument vendor documentation are sources to evaluate; their existence does not validate a local instrument profile or authorize a new procedure.

## Five-language content

English, Spanish, Latin American Spanish, French and Portuguese are required. Translate headings, steps, examples, field explanations, decisions, error recovery, captions, alt text, glossary and UI labels. Preserve scientific IDs, formulas, units and example identities. Spanish and Latin American Spanish require explicit regional decisions, not a file copy disguised as separate review.

Store a stable concept ID for terminology and a stable block/step ID for translation matching. Keep source hash, translated-source hash, translation status and actual review evidence. A source edit invalidates only affected blocks and their dependent review, but the currently published coherent translation remains readable until its replacement is ready or withdrawn.

Do not display a language as fully available when only the menus are translated. If an approved language is missing, show the actual approved fallback language and a clear notice. Never label an unapproved translation as fallback while showing its bytes.

## Quality rubric for editorial review

Review each item with evidence rather than an invented numerical score:

- User intent is clear and matched to a role/task.
- All control names and finishing actions exist on the tested release.
- Important fields and sources are explained.
- A concrete worked example is internally consistent.
- Expected state, receipt and next actor are explicit.
- Relevant failure paths are covered safely.
- Core calculations/permissions are neither redefined nor bypassed.
- Text is readable, well structured and translated completely.
- Screenshots and links match the published content revision.
- A representative user can finish the task without coaching or guessing.

An article with a technical unknown remains an editorial task until that unknown is resolved. Do not publish placeholder prose such as “follow your normal process,” “as applicable,” “use the relevant screen” or “contact support” as a substitute for actual instructions.
