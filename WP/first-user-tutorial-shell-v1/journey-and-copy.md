# The teaching story and content specification

**Beginner revision:** read `absolute-beginner-foundation.md` first. Its F01–F04 now precede the detailed role journey below. The former opening assumed workflow familiarity; first-time visitors must instead start with what LIMS does, one connected sample example, normal navigation and how to get help. Allow no-account illustrated orientation. Full first-user duration is approximately 16–18 minutes; the 14½-minute detailed route below remains unchanged for the post-foundation segment or returning visitors.

## First 30 seconds

**Title:** From field to trusted result.

**Body:** Follow a sample through the people, steps and evidence that turn laboratory work into a trusted result. Choose the full story or the work your role handles.

**Choices, after explaining the basics:** Show me the platform · About 3 minutes / Follow a sample · About 16–18 minutes including the basics / Learn my role · About 4–8 minutes after the basics. Returning visitors may Skip basics.

**Boundary:** The guide explains the real pages. Practice exercises use example data inside the guide. To carry out actual laboratory work, use your assigned account and designated samples.

**Controls:** Start / Exit guide / Guide language. No automatic audio or timer. Let a returning user Resume or Restart.

The three-minute overview can show restricted-role concepts as clearly marked illustrations without requiring repeated sign-ins. The full story offers actual role sign-ins to inspect authorized pages; optional illustrated explanation keeps a single-role user moving.

## Full story: 14½ minutes of content, excluding sign-in and laboratory time

The timing is a planning target, not auto-advance. No one dries a sample or performs a laboratory analysis in this time. One synthetic sample is the focus, four companion rows explain batch work. Mock data must remain distinct from real eligible records. Practice IDs: TRAIN-US-001…005; display project as “SOILFER-US example”, not as a new production project.

| Lesson / time | Account / destination | Visible instruction and action | Completion and fallback |
| --- | --- | --- | --- |
| 01 · 0:00–0:45 · Sign in and orient | `/login` then `/` | “Start with the right role. Check your name, laboratory and current tasks.” User signs in normally; guide shows verified role. Explain interface language choice. | Verified identity and explicit “I can see my lab”. No permission from cached user alone. If signed in already, preserve their session. |
| 02 · 0:45–1:45 · Field provenance | `/projects/:projectId?tab=overview`, then `?tab=connections` where authorized | “Expected is not received. The field identifier and location travel with the sample.” Inspect project and provenance. | Viewed actual permitted page, or labelled illustration if no suitable project/permission. Never run Kobo sync. |
| 03 · 1:45–2:40 · Match the container | `/samples/:id?tab=request`, `/reception?sampleId=:id` | “Match the container first. Compare field ID, local sample ID, project and site.” Practice choosing a matching label over a mismatched one in an overlay-owned control. | Local answer checked. If no authorized live record, show illustration and record that lesson as illustrated. Never manufacture a location. |
| 04 · 2:40–4:00 · Physical receipt | Reception form | “Record arrival when the container is here. Check mass, condition and custody.” Practice 485.2 g, intact container, required checks; also show insufficient/missing evidence path. | Practice confirmation only. Explain Save Draft versus physical receipt and what changes after a real receipt. No live field typing or completion clicks. |
| 05 · 4:00–5:05 · Assignment | `/manager-queue?lane=assign`, then `/samples/:id?tab=work` | “Ordered work still needs the right technician and readiness.” Show assignment, method and preparation dependencies. | Explain or local match exercise. A coordinator/technician without assignment permission receives an illustrated handover. No actual assignment. |
| 06 · 5:05–5:50 · Equipment | `/equipment` | “Check the instrument before you use it.” Inspect status/readiness/calibration; choose a suitable example instrument in the guide. | Existing permitted asset drawer or example. No reservation, calibration or repair task. |
| 07 · 5:50–6:35 · Inventory | `/inventory` | “Use the right material and lot.” Read quantity, expiry, storage and lot status. | Local example selection. Explain that view, reservation and consumption differ. No stock writes. |
| 08 · 6:35–8:05 · Preparation | `/workbench?workItemId=:gateItemId&sampleId=:id` | “Preparation is evidence.” Read configured checklist and durable receipt; practise representative checks locally. | Practice checklist done. Show later prepared checkpoint as an example, not instant real completion. Explain legacy evidence gaps as unresolved. |
| 09 · 8:05–9:20 · Method worksheet | `/workbench?workItemId=:numericItemId&sampleId=:id` | “One method, a clear batch. Match identity, method revision and unit.” Local pH entry, decimal separator example and review preview. | Numeric practice parsed; no production validators replaced. Teach draft → record determination → submit for review. Discuss keyboard/batch flow and row identity. |
| 10 · 9:20–10:30 · Grouped texture | Texture work-item link | “Three fractions, one result.” Try a non-closing total, then correct to 35/35/30. | Practice bounds and closure feedback. Explain method-defined precision/tolerance and validated derived class. No independently invented production classification. |
| 11 · 10:30–11:40 · Spectra | Spectral work-item link, then `/spectral-library` | “The evidence is the spectrum.” Show source file, instrument, sample, replicate, axes and QC. | Load a synthetic curve locally; call it synthetic. No server staging. Inspect permitted existing spectra only when safe. Predictions are not implied by upload. |
| 12 · 11:40–12:40 · Review | `/manager-queue?lane=review`, `/samples/:id?tab=review` | “Review submitted evidence. Give a clear reason when returning work.” Practice a meaningful reason and display it in a local technician handover card. | Local exercise; no ACCEPT/RETURN/RELEASE API. Unsubmitted work must not be taught as approvable. Missing QC is Unknown even if a legacy UI fallback badge says PASS. |
| 13 · 12:40–13:20 · Workflow map | `/samples/:id/map` | “See the dependencies, not just a progress bar.” Inspect Overview, Dependencies and a stage. | View available graph, explain gates. Never change graph nodes or mislabel a blocked real sample as complete. |
| 14 · 13:20–14:00 · Report/history | `/samples/:id?tab=reports`, `?tab=history`, `/result-reports?reportId=:id` | “A released result has a version and a history.” Find method, revision, author/reviewer and record links. | View an existing permitted report. If absent, explicitly labelled example. No generate, publish, issue share token or send. |
| 15 · 14:00–14:30 · Exchange and finish | Project connections; authorized `/admin?tab=api-keys` only when relevant | “An export preview is not delivery.” Show a redacted example payload and distinguish query, transfer and acknowledgement. | No live API tester, API-key generation or transmission. Finish with next-role task, Help Centre and issue-reporting link. |

## Role-specific chapter selection

- **Reception:** identity/language → project/field provenance → physical container → draft versus receipt → handover → next task/help.
- **Technician:** identity → assignment/readiness → equipment/inventory → preparation → method worksheet → texture/spectral branch relevant to their work → submission/return → traceability.
- **Lab manager:** identity → intake/assignment queues → prerequisites → submitted evidence → reasoned return → final release/report → next task/help.
- **Project coordinator:** identity/scope → project status/admissions → labs/people read view → field connections → expected versus received → sample progress/report → exchange. No create lab/project/user or access changes.
- **Viewer/auditor:** authorized project/sample context → workflow history → report provenance → authorized export explanation. No account switching into privileged roles by default.

Every path can end early. Completion must say which lessons were illustrated, practised, skipped or unavailable. Do not claim the person performed real lab work or is certified.

## Three-minute overview script outline

Reuse the earlier narrative with corrected current routes and honest example labels: login/roles 14s; dashboard 6s; field/Kobo 16s; receipt 20s; assignment/equipment/inventory 16s; preparation 14s; numeric/texture 19s; spectrum 14s; review 16s; map/report 17s; SIS 15s; next steps 13s. Total 180 seconds. Presenter-controlled by default; optional paced playback must pause for interruption and never click or submit live controls.

The preview groups these into fewer visual chapters for design review and adds three interactive introductory screens inside Welcome. Antigravity should implement the actual content manifest from the beginner foundation plus the fifteen-lesson curriculum, with the three-minute overview dispatch separate from full learning progression. Re-time the overview to include the essential definitions rather than assuming prior LIMS experience.

## Reusable microcopy

**Role mismatch:** “This step belongs to a laboratory manager. Continue with an illustrated explanation, or sign in with the manager account provided for this session.”

**Handover:** “Reception records the arrival. A technician now checks the prepared material and carries out the assigned method.”

**Account switch:** “Save any current work before switching accounts. The guide will keep your place. Your application permissions still come from the account you sign into.”

**Password:** “Use the password supplied by your facilitator. The guide does not store it.”

**No eligible record:** “There is no suitable sample available for this account. You can still learn this step using the labelled example.”

**Missing target:** “This page looks different from the guide. Continue with the explanation or retry after the page finishes loading.”

**Offline:** “This page needs a connection. Your lesson position is kept. Practice examples already loaded remain available.” Never claim full offline LIMS work is supported by the tutorial.

**Unexpected state:** “This sample is not at the step described here. Choose another permitted example or view the illustrated checkpoint.” Never change it to fit the lesson.

**Practice saved:** “Practice checked in this guide. No result was submitted to LIMS.”

**Unverified operation:** “The guide can explain this step. Actual operation remains subject to the application's current validation.”

**Finish:** “You have seen how the work fits together. Use your assigned role and the samples agreed for testing. Keep Help nearby, and report one distinct problem per GitHub issue.”

## Content manifest example (not executable production code)

```json
{
  "version": "first-visit-v1",
  "id": "technician.preparation",
  "chapter": "preparation",
  "mode": "orientation",
  "permission": "ENTER_RESULTS",
  "routeKey": "workbench.workItem",
  "targetKey": "workbench.operationalEvidence",
  "titleKey": "lessons.preparation.title",
  "bodyKey": "lessons.preparation.body",
  "practiceKey": "preparation-checklist",
  "expectedObservation": "authorized-target-visible",
  "fallbackLesson": "illustration.preparation",
  "next": "technician.methodWorksheet"
}
```

Route resolvers take only the current verified actor and permitted, fetched entity references. Do not put actual sample IDs or account passwords in the content manifest. Locale files use the same content keys across all five languages.
