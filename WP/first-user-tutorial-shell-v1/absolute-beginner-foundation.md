# Required foundation for visitors who know only the name LIMS

Revision: 14 September 2026, following the user's clarification. This is part of the required first-user implementation, not an optional extra. The earlier full workflow sequence is retained after this foundation.

## Audience and honest scope

The visitor may not know what a sample record, workbench, submission, reviewer or workflow map means. They may be a director, project colleague or new staff member. Do not ask them to choose a technical role before explaining the basic story. First establish purpose, vocabulary and navigation; then offer deeper practice.

This onboarding should make the visitor comfortable navigating and understanding the work. It cannot confer laboratory competence, train every analytical method or certify the platform's operational readiness. Advanced administrative operations and specialist methods remain in role training and Help.

## Opening foundation: approximately 2–3 minutes

### F01 — What is this system? (30 seconds)

**Heading:** A shared record for the laboratory.

**Copy:** “LIMS means Laboratory Information Management System. It helps the team know which sample they have, what work is needed, who is doing it, and which results have been checked.”

**Concrete story:** “A labelled bag of soil arrives. The team records it, prepares the material, carries out the requested tests, checks the results and issues a report. SoilFER connects those records so the history stays with the sample.”

**Boundary:** “People and laboratory equipment carry out the physical work. LIMS records and coordinates that work.”

Show five connected stops with plain verbs: **Receive → Prepare → Analyse → Review → Report**. Define review as checking recorded work; use “result ready to share” instead of an unexplained release term. The specialist label may appear secondarily.

**Local check:** “A record says the sample is expected. Has the laboratory received the container?” Answer: No; arrival is confirmed separately. If wrong, explain and allow retry—no score or shame.

### F02 — How do the records fit together? (35 seconds)

**Heading:** One sample, connected records.

- **Laboratory:** the facility and team handling the work; your account determines which facilities you can access.
- **Project:** a group of related samples and work. A project can involve more than one laboratory; do not draw a false strict lab → project ownership hierarchy.
- **Sample:** the physical material and its digital record.
- **Requested analysis:** a test the sample needs; one sample can require several tests.
- **Task:** a piece of assigned work, such as preparation or a particular analysis.
- **Result/report:** a result is a recorded finding; a report presents authorized results with their context.

Show the same stable example ID on the container, sample record, task and report. Explain field ID versus local laboratory ID, without exposing UUIDs. The five-sample tray is supporting context; the novice follows one sample first.

People own different actions. Reception records arrival; technicians prepare and analyse; reviewers check submitted work. A project coordinator oversees project progress. These are software responsibilities, not assignments to the visitor.

**Local check:** “Are the sample page and workbench two separate copies of the sample?” Answer: No; they are different views of connected records. In the real system their states must agree; this lesson does not claim unresolved synchronization defects are fixed.

### F03 — Where do I go, and how do I recover? (45–60 seconds)

**Heading:** Find the next useful action.

Explain five destinations before spotlighting actual controls:

1. **Home / dashboard:** what needs attention for the current account. Empty is not necessarily broken; explain no assigned work, a filter, wrong lab or loading/error separately.
2. **Samples:** find a sample by its readable identifier, check its identity, request, progress and history. Demonstrate local guide-owned searching before any real search.
3. **Workbench:** a technician's place to record the assigned work. Grouping by method helps handle many samples consistently.
4. **Review queue:** a manager's list of submitted work to check.
5. **Reports and Help:** find an existing report or instructions; do not create a report to complete an introductory lesson.

Teach: select the correct project/lab, clear a filter before concluding a sample is absent, open a row for detail, use Back and the guide's chapter navigation, and return Home. Do not instruct a beginner to refresh unsaved work indiscriminately.

Show a plain status strip: **Not started → In progress/draft → Submitted for checking → Checked/accepted → Released for reporting**, with a return arrow for corrections. Describe these as conceptual stages that differ by task; operational checklist completion, work-item acceptance and sample/report release are not one interchangeable status enum.

**Local check:** “Your result is saved as a draft. Is it in the manager's review queue yet?” Answer: No; it still needs the applicable record/submit handover. Show the reason for the distinction.

### F04 — Choose how far to go (20–30 seconds)

Offer after the foundation, with Skip basics available from the start:

- **Just show me the platform:** a standalone, illustrated 3-minute introduction for a visitor who has no account. It includes a condensed F01–F03 rather than adding 3 minutes of jargon-heavy features on top. Clearly label it an illustrated explanation. This does not expose private application pages.
- **Follow a sample:** foundation plus the existing 14½-minute detailed route: approximately **16–18 minutes**, excluding sign-ins and actual laboratory work.
- **Learn my role:** reception, technician, manager, coordinator or viewer, each explained in a plain sentence. Show the role from verified account when signed in; never require someone to know an internal role code.

Do not promise a full 12–15-minute lesson after adding this foundation without retiming it. The returning-user Skip basics path retains the earlier approximate time.

## Before entering real pages

State the distinction in one friendly sentence: “Practice here uses example data. When you leave the guide to work in LIMS, use your assigned account and designated test samples.”

New visitor with no account: stay in the labelled introductory illustrations; offer “Ask your facilitator for access.” No self-created users/labs/projects and no public admin credentials. Passwords are shared separately. A forgotten/incorrect password follows the existing approved recovery/access process.

Existing user: identify actual name, lab and role; inspect allowed pages. Do not automatically log out. Explain that role switching in the current app can affect other tabs. The tutorial follows normal permissions and never grants wider access.

Errors/help: “If a page or task is unavailable, keep the sample ID and message, then ask the facilitator or record a GitHub issue.” The learner does not need browser developer tools to report a useful problem. Provide the known issue link explicitly, with clear instructions before opening it. No automated issue or email submission.

Current project issue destination: **https://github.com/yigini/soilfer-lims/issues/new**. Opening it is user-driven and may require GitHub access. If access is unavailable, ask the facilitator to record the issue. Do not include passwords/tokens or unrelated personal details. Reconfirm repository destination before release if project configuration has changed.

## Plain-language glossary embedded in the guide

Provide tap/keyboard-accessible “Words used here” on each lesson. Expand acronyms at first use; do not show a tooltip dependent only on hover.

| Term | First-visitor wording |
| --- | --- |
| Intake / reception | Recording that the laboratory has received the sample and checked its condition. |
| Workbench | The technician's workspace for assigned preparation and analysis work. |
| Worksheet | A table for entering results using a particular method. |
| Analysis / determination | A test / the recorded outcome of carrying out that test. Define distinction only when needed. |
| Method | The procedure used to carry out an analysis. |
| Prerequisite | Something that must be completed before the next task can begin. |
| Draft | Work saved for the person entering it to continue; it is not yet submitted for review. |
| Submit | Send the completed work to the next person for checking. |
| QA / QC | Quality assurance / quality control; explain the actual check or evidence, not just the acronym. |
| Return for correction | Ask the technician to resolve a specific problem and submit again. |
| Release | Authorize the result or report for its intended use under the lab's process. |
| Audit history | A record of who did what and when. |
| Kobo | The field-data collection connection used to bring in source records. |
| SIS | Soil Information System; an authorized destination or interface for exchanging soil information. |
| Spectrum / MIR / NIR | A measured signal across a spectral range / mid-infrared / near-infrared analysis. Explain why a file is needed before details about axes or models. |

## Beginner acceptance gate

Test the completed guide with three people who have not used this LIMS. Ask them to use it without coaching and then:

1. Explain what LIMS does and what work people still do physically.
2. Find their role/lab or explain how to request access.
3. Find a sample and tell whether it is merely expected or actually received.
4. Choose sample page versus workbench for the intended task.
5. Explain why a saved draft is not reviewed/approved, and what happens after a return.
6. Find Help/reporting instructions and exit/resume the guide.

Record where each person hesitates, takes a wrong route or needs help. Revise the copy/navigation before claiming the guide is complete for beginners. Automated clicks and a polished preview cannot substitute for this evaluation. Technical correctness and controlled real-lab testing remain separate gates.
