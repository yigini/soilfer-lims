# Instruction for Antigravity — full Help redesign v2

Work in **C:\Users\yigin\Documents\soilfer-lims**, project **LIMSI**, chat **LIMS Dev**.

The user has rejected the existing Knowledge Base's quality. This is a full redesign of the Help reading experience and content, not another publication-only fix, color adjustment or rephrasing of the same 27 short articles. The current collection averages about 112 words per article and lacks exact actions, worked examples, field explanations and real recovery instructions. The Help feature must become a useful laboratory handbook for every configured role.

Read the entire **WP/help-knowledge-base-v2** package, starting with README.md, 01_AUDIT_AND_DIRECTION.md, 02_IMPLEMENTATION_PLAN.md and 03_CONTENT_STANDARD.md. Then inspect the inventory, eight full English exemplars, technical contract, validation plan, source/route traceability and interactive review-preview.html. Reconcile the source baseline with your current branch before editing. Existing v1 source, publications and user data must be preserved through the transition.

The user has now instructed you to implement the complete v2 replacement and retire the previous Help experience. Read `11_REPLACEMENT_AUTHORIZATION.md` for the latest authorization and replacement boundaries. Carry the work through implementation, verification, GitHub delivery, publication and production deployment under the existing authorization. The standalone visual prototype is a design reference; implement it in the real LIMS components, not as an iframe or a static replacement website. Do not stop after a plan or a cosmetic first slice, and do not ask repetitive generic permission questions.

## Required outcome

Build Help & lab guide inside the existing LIMS shell, with My tasks, Solve a problem, Learn the workflow and a complete browsable reference library. Role recommendations cover all ten configured roles; reading another role's introduction does not grant that role. Contextual Help explains the active page/tab/control and actual blocker, and returns users to unchanged work. Replace the generic card-grid home and flat four-step articles with the detailed, scannable experience shown in the prototype.

Use `10_MIGRATION_AND_FAQ.md` and `migration-map.json` to reconcile every one of the 27 existing article identities with its expanded replacement. Preserve actual database identities, URLs and histories; the new inventory IDs are editorial brief identifiers, not an instruction to create duplicate articles. Derive FAQ answers from canonical problem blocks so edits and translations cannot diverge.

Every task article must tell the user where to go, the exact controls to select, what to enter and where it comes from, what should happen, what to do if it does not, and who acts next. Include useful annotated screenshots of the actual application with synthetic records, concrete examples and field/state reference. Use the eight exemplar guides as the minimum depth/clarity standard. Do not rewrite them into vague summaries to save time.

Complete the commissioned content inventory across intake, sample tracking and maps, drying/preparation, single/batch results, all enabled input families, texture, spectroscopy, review/reports/amendments, equipment, inventory, mobile/offline, KoBo/project/SIS, configuration, translations and audit. The JSON inventory is a set of writing briefs, not completed content. Deliberately merge/split where that improves usability, retaining explicit route/task coverage. Generic support links do not count as specialized page guidance.

## First implementation milestone

Produce one fully working vertical slice: role home → forty-sample batch guide → relevant field/example/recovery → contextual Help beside Workbench → preserved typed values on return. Also finish drying confirmation with the correct Confirm Complete/Checklist Verified/receipt explanation. Show these actual React pages with realistic content before expanding the design to every subject. Verify the exact current labels and backend transitions rather than reproducing a mockup control that does not exist.

Then complete the editor/schema/migration foundation, problem flows, all role paths, remaining articles and five-language content. The dependency order and exit evidence are defined in the plan. Keep intermediate commits reviewable and avoid a giant untested replacement.

## Integration requirements

- Reuse and extend existing HelpArticle/revision/locale/publication data. Preserve stable IDs, published history, scoped local notes and feedback. Use an adapter for old content; no destructive reseed.
- One authorized content selector supplies article, search, FAQ, context, related links, print and offline pack. Honor both approved locale status and the current publication's locale membership.
- Use stable page/tab/control bindings and real blocker codes. Help never owns readiness decisions and never changes laboratory values or statuses.
- Use the catalogue's human-readable names and actual method/input configuration. Do not infer a scalar field for every analysis. Distinguish observation, calculated result and model prediction.
- Keep complete en, es, es-419, fr and pt coverage, including bodies, examples, captions, alternative text, reference terms, editor actions and errors. Key parity is not full translation.
- Give content authors a usable structured editor, source/translation comparison, review changes, coverage work list and preview of an exact release manifest. Record real review provenance; no fabricated human/scientific approvals. Ordinary application help must not be trapped indefinitely behind a scientist-signoff requirement; isolate actual scientific/SOP decisions.
- Preserve scoped offline work and account/lab boundaries. Reading Help offline does not imply the associated lab operation is offline-supported. Known withdrawals/access failures must not resurrect cached content.
- Keep all success messages truthful. No fake sent/queued/copied results, fake training certification, invented popularity numbers or unsupported verification badges.
- Preserve desktop appearance outside the Help integration. Make the new reading experience responsive and accessible in light and graphite with the existing profile/session theme behavior.

## Verification and release

Follow 07_VALIDATION_AND_RELEASE.md. Test actual React/API flows with isolated fixtures, not only the prototype. A passing build or an endpoint returning an empty array does not demonstrate a useful Help Centre. Verify the real batch handoff, drying receipt, blocked preparation, partial submission, manager review, spectra, offline recovery and all ten role entry points.

Keep working v1 content visible until reviewed v2 replacements are published. Build/test the final production image and package the intentional runtime assets. A zero-publication check is valid for draft seeding only; it is not the launch gate for reader content. Publish a coherent approved collection, verify nonempty and relevant guides on the live pages in every supported language, and report the exact code/content revisions.

Push the reviewed implementation and documentation to GitHub, use the established backed-up deployment and rollback process, and reconcile issue #92 and any linked issues with real completion evidence. Never clear pending offline operations, weaken result approvals, overwrite historical results or expose deployment secrets while doing this work.

If documenting a task reveals a real application defect, capture its evidence and implement a separately scoped correction only within the user's existing authorization. Do not turn a defect into user instructions to bypass another page's rules. Do not silently expand this Help redesign into unrelated core workflow changes.

## Communication

Use short, friendly progress messages a nontechnical person can understand. Explain the visible improvement and the remaining check. For example: “The batch guide now shows the exact recording and submission steps. I am checking that opening it keeps the technician's typed values.” Avoid “certified,” “100% ready,” “enterprise-grade” or a wall of test counts without task evidence.

Report separately: design implemented; guides written and verified; languages ready; actual app tests passed; content published; production build live; exact remaining exceptions. Do not claim the complete handbook is ready while important articles are only briefs or while every page points to generic support.
