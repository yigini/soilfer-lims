# Acceptance and evidence checklist

All checks below are required outcomes, not assertions that the application already passes. Use an isolated synthetic database and real browser sessions. For each record expected/observed outcome, test location, exact candidate commit and sanitized evidence. Mark blocked instead of skipping silently. Prototype checks verify only the design artifact.

## Counts, scope and lifecycle

- A01: Register all ten canonical roles. Each loads the correct home; unknown roles show a safe access explanation, never a privileged fallback.
- A02: Expected and draft records with legacy PENDING drying/preparation flags contribute zero ready processing work. Confirm the prior 5,295-unreceived inflation pattern with synthetic bulk records.
- A03: Physically received but unaccepted sample appears in intake acceptance, not bench result entry. Accepted sample with unfinished gates appears waiting, not ready for a result draft.
- A04: Complete drying and preparation through real checklists. Only applicable assigned work becomes eligible. Null, missing, failed and formally not-applicable are separate cases. No numerical drying field reappears.
- A05: More than 200 technician tasks and 500 lab tasks; old active work remains counted and reachable. Assert total before grouping/paging.
- A06: Every summary count equals the exact defined selector's full matching entities, with documented units. Preview truncation does not reduce total; next/previous pages cover all rows without omissions/duplicates.
- A07: Forty pH determinations appear as a method group. Texture groups count once, not three; spectra/replicates/predictions do not multiply ordered work. Separate method revisions, labs and existing runs.
- A08: Completed, submitted, accepted and published events remain distinct. Updating metadata does not change completion-day counts. Submission remains in historical submitted-today after acceptance.
- A09: Midnight boundaries in America/Guatemala; DST start/end in a lab timezone that observes it; future events excluded. Missing/invalid timezone is unavailable or explicitly labelled fallback, not a silently wrong day.
- A10: Two labs in one country, two projects in one lab, a project-only user, a country user, a user with no grants, and a super-admin with selected lab. Both count and row queries enforce documented scope intersections/unions.
- A11: OR queue criteria (attention, preparation, search) cannot overwrite scope OR. Test foreign-lab records that intentionally satisfy the same condition.
- A12: Changing URL lab/project/queue/ID, calling APIs directly and using later pages cannot widen authorization. Count responses and search hints do not leak hidden records.
- A13: Technician reassigned or disabled while home remains open: old tasks/private data disappear; stale command is rejected. Missing actor.labId never causes a global private-data broadcast.
- A14: External/viewer report searches, direct report/PDF URLs, sample detail, data-results and spectral endpoints honor published/granted visibility. No private drafts or internal QC/audit commentary appears.
- A15: Reception all-lab vs my-drafts counts have explicit scope. Locked or advanced drafts cannot resume/reset a sample. Canonical reception detail restores project/location/analysis deltas without broad dashboard metadata payloads.
- A16: Current published reports exclude superseded/withdrawn versions; historical publication event count remains separately defined. Reopening/amending a sample changes release eligibility safely.

## Decisions and destination parity

- A17: Fresh intake with no analysis is absent from final approval. Repeat with gate-only work and all-omitted orders; no vacuous “all completed” approval.
- A18: Incomplete evidence, pending/failed applicable QC, a hold, historical evidence gap or current incomplete analysis excludes normal final approval. Server approval command rejects independently of UI.
- A19: Eligible sample can enter the existing final review; concurrent modification before command returns conflict, does not approve stale evidence. Required validation and audit transaction are preserved.
- A20: Pending review badge/list use the same entity unit and grouping. QC-blocked submissions remain inspectable with reasons but cannot be accepted.
- A21: Manager default opens an actual nonempty actionable lane, including final approval when it is the only work. Invalid URL falls back safely. Explicit lane, same-route navigation, browser back/forward and refresh preserve intent.
- A22: Every visible KPI, primary action, row action, shortcut and navigation item opens the correct supported destination with context. No no-op buttons, first-record substitution or ignored query parameters.
- A23: Forty-sample group opens the right worksheet and method revision. Continue run opens saved positions/QC/instrument; open-from-home does not duplicate a run. Test 36+4 split when configured QC positions reduce capacity, without hardcoding that capacity universally.
- A24: Use actual controls to enter/save several rows, reload all forty rows, submit selected eligible work and review it. Assert persisted outcomes, assignment and counts across bench/home/manager/sample. Unselected work stays untouched.
- A25: Returned analysis opens the current editable attempt and review reason; prior approved/submitted evidence remains immutable. No edit-after-approval shortcut introduced.
- A26: MIR/NIR continuation opens spectral intake/linking with sample matching; scalar reflectance entry absent. Trashing/replacing a linked spectrum invalidates relevant evidence/readiness.
- A27: Texture continuation opens grouped sand/silt/clay results and configured derived class; home/sample/report preserve current approved values and provenance. No separate hidden fraction queue is fabricated.
- A28: Surveyor home offers only existing authorized field actions; never routes into forbidden Reception. Zero-valued coordinates are valid; failed detail loading is not missing field data.
- A29: Audit role can inspect QC/history/report versions but cannot approve, dispose, waive, edit or publish through direct APIs or UI. Existing PDF download remains read-only.
- A30: Master user selects an authorized lab and can use only existing validated national operational privileges; external/project roles do not inherit those actions.
- A31: Parameter names and lab sample identifiers are consistent on home, workbench, sample, queue, report and notifications. No raw UUID/title or raw code for an available catalogue name.
- A32: Sample controls listed in role-control-matrix.md remain available in appropriate states/roles; nothing disappears because navigation was consolidated.

## Reliability and interaction

- A33: First-load error, true zero, no search results, partial section error and stale refresh are visibly different; no failed query yields green zero or “Live”.
- A34: Change role/session/lab/project while an old request is delayed. No late response overwrites new scoped data; abort/sequence protection is asserted.
- A35: Receive/accept/assign/complete/submit/review/QC/spectral/report/amendment/catalogue/equipment changes update affected dashboards. Verify actual scoped events and polling fallback, not just method calls mocked to resolve.
- A36: Scope change and reconnect clear inaccessible cache, refresh current membership and do not reveal other users' drafts. Offline failure does not discard unrelated Workbench drafts.
- A37: Keyboard reaches all controls in logical order; focus visible and unobscured, detail dialog traps/restores focus and closes with Escape. Counts/status changes announced without hijacking focus.
- A38: Desktop 1440, laptop1024, narrow390/320, 200% zoom, long method/project names, translated labels and dark appearance have readable layout and no clipped actions. Tables preserve relationships on narrow screens.
- A39: Search/pagination/deep-link/back retain intentional context. Refresh never automatically jumps away from a queue a person is inspecting.
- A40: No result/intake/approval/report mutation occurs on a dashboard navigation click, refresh, initial load or role/scope selection.
- A41: Payload projection excludes full spectra/fieldMetadata/attachments/report blobs/private values. Aggregate queries are bounded; measure response time/size on realistic synthetic volume; no hidden N+1 sample-workspace loads.
- A42: All supported languages use existing translations and correct dates; no new mixed-language cards/status codes. No arbitrary urgency colors or fabricated due dates.

## Shipping

- A43: Existing reception/workflow/RBAC/catalogue/group/spectral/QC/report regression suites and client build pass on exact candidate. Do not weaken expected outcomes to turn failures green.
- A44: All intended source, design, test and documentation files pushed to GitHub; PR/CI evidence identifies exact code. No credentials, databases, build folders or scratch node_modules committed.
- A45: Backup includes DB and required assets; restore/start compatibility verified for candidate. Deploy immutable image; record image/commit, migrations if any, backup and rollback steps. Verify live read-only role journeys; do not create test samples in production.
- A46: Reconcile GitHub issues last. Close only demonstrated fixes, open/reopen remaining connected defects. Provide a plain-language completion report distinguishing implemented, tested, live and unresolved.

The deliverable is not complete while any promised role is a placeholder or an essential access/readiness/count/navigation scenario fails. Evidence gaps remain visible; a successful screenshot/build alone is insufficient.
