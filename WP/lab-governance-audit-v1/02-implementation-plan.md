# Implementation plan — dependable laboratory management

## 1. Intended outcome

A laboratory manager opens **My laboratory**, sees which people and resources can perform today’s work, and can resolve access problems without changing another laboratory or losing work. A system administrator can onboard and support labs without shared credentials, silent partial setup, or accidental lockout. A national lead can oversee their authorized labs; a project lead can follow their projects without acquiring staff or laboratory-administration rights.

User creation, role changes, lab changes, project access, work assignment, result entry, offline replay and reporting must agree about the same person and the same resource. UI hiding is never the permission boundary. The server evaluates both action and resource on every request. This follows [OWASP’s authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html); the detailed defaults below are project-specific design recommendations.

## 2. Delivery order

Implement seven reviewable work packages, each with code, real regression tests, migrations where applicable and a plain-language completion note. Do not delay access-control repairs until the redesign is complete. Do not combine schema cleanup with unrelated Help v2 or scientific workflow rewrites.

### WP-A — Close alternative write and secret paths

**Findings:** LG-01–03, LG-11–14, LG-18, LG-20. **Files:** `labRoutes`, `userController`, `projectController`, `syncService`, `equipment*Controller`, `adminRoutes/adminController`, `roles`, plus their route mounts.

1. Add narrowly named actions and one shared policy interface. Immediately scope lab/person/equipment IDs against the authenticated actor and target. A lab manager cannot provision another lab, reset management roles or modify global languages. Deny unspecified management actions.
2. Keep ordinary scoped directory reads usable while removing private management fields. Do not break reception/project/lab pickers by putting a blanket admin guard on GET `/labs`.
3. Replace fixed password reset and auto-account creation with the secure recovery/onboarding service specified in WP-C. During this staged change, disable only the unsafe legacy reset route and return an explicit supported recovery route; keep a tested administrator recovery path. Never substitute another static password.
4. Prevent global project metadata, access, archive, restore and manifest operations through a shared lab’s read grant. Scope and redact Kobo config reads; write by exact project/lab identity. Do not log, redisplay or export saved credentials. After the repair, review who could access existing keys and rotate affected integration credentials through controlled configuration, verifying sync continuity. Do not rotate blindly during this audit.
5. Make sync commands call the current online domain services. Reuse `resultEntryPolicy`, `workEligibility`, `OperationalConfirmationService`, scientific validation, command receipts and amendment/submission rules. Trace actual callers before extraction. No local imitation of COMPLETED/ACCEPTED logic. A disabled/unauthorized actor cannot replay an old action; an approved result can only enter the established amendment process.
6. `SAVE_WORK_DRAFT` needs real persisted draft evidence and an atomic receipt before APPLIED. If persistence is not implemented, return UNSUPPORTED/REJECTED and retain the local draft; never success. Verify strict Prisma fields against the actual schema, not just mocks.
7. Scope every equipment event/status/disposition mutation and every foreign resource reference. Hold cached-pack responses to owner, lab, lease and current authorization checks.

8. Include LG-28: SIS key list/create/revoke needs dedicated integration authority and validated explicit lab scope. The current creator omits labs, causing correctly restricted consumers to reject new keys; fix issuance rather than weakening that restriction. SIS JWT validation must share normal session revocation. Standalone Kobo lab config/sync paths must receive the same target-scope checks as project config.

**Exit evidence:** tests with lab A/B in the same country, lab C in another country, all affected roles, HTTP entry points and strict database assertions show zero unauthorized mutations. A legitimate same-lab staff reset, same-lab equipment change, normal draft and replay still work. This package can be released before the larger workspace UI once its recovery and compatibility gates pass.

### WP-B — Establish one action and scope model

**Findings:** LG-07–12, LG-17, LG-22, LG-25. **Files:** `roles`, `scopeGuard`, `dashboardScope`, `cataloguePolicy`, `resultEntryPolicy`, user/project/lab controllers and selectors.

1. Build server services with explicit inputs: `actor`, `action`, `resource`, `requestedChange`, resolved relationships. Return allowed/denied and stable reason codes. A pure role matrix is insufficient; a project-manager role must still have that project. A country must never expand an ordinary technician’s lab access.
2. Separate scoped read queries from mutation authority. Adopt the role table in `03-policy-and-contracts.md`; add positive tests for each national/project role before changing shared scope behavior. Avoid replacing the generic guard wholesale in one commit.
3. Correct national Users query to find labs in explicit national scope, then users in those labs. Empty/malformed scopes never mean global. Invalid scope metadata returns an actionable access-configuration error, not an unexplained token failure.
4. Resolve project owner versus servicing labs versus individual project grants. Build a read-only discrepancy report before migrating four legacy links. Do not take their union and silently grant more access. Preserve legitimate historical access through an explicitly reviewed mapping.
5. Publish allowed role options and capabilities from the same server policy. Keep immutable role keys for persistence; display translated human names and scope descriptions. Preserve all ten existing roles; introduce capabilities, not improvised new roles.
6. Make assignment selection and submission use the same eligible-person resolver. Reject inactive accounts, suspended labs, unauthorized actors and wrong receiving labs. An empty valid roster is different from a network/permission error.
7. Add indexes and DB pagination. Scope first, then search/filter/sort/page. Bound page size (default 25, maximum 100), stable sort `(name,id)`, escaped query construction, cancellation for stale client searches. Never load password hashes for directory DTOs.

8. Include LG-29: reject unauthorized national dashboard selectedLabId before querying that lab’s details/counts. Fix local-day end calculation to use the next local midnight, including 23/25-hour days. Preserve the existing dashboard route and queue contract while repairing its scope resolver.

**Exit evidence:** list/detail/count/selector/download agreement for lab, sample, project, asset and user IDs across all ten roles. Unrelated identifiers do not reveal whether the record exists. A scoped manager’s query parameters cannot widen access.

### WP-C — Staff lifecycle, recovery and lockout prevention

**Findings:** LG-03–09, LG-15–17, LG-21, LG-25. **Files:** user/auth controllers and middleware, lab routes, `wsServer`, client Auth/Sync contexts and staff components.

**Named onboarding:** create a pending invitation for a real person, exact role and scoped lab/projects. Existing account detection offers a scoped membership/change request, not a duplicate identity. Normalization preserves display names, prevents case-equivalent username collisions according to an explicit compatibility policy, and never synthesizes deliverable-looking email addresses. Validate server-side, including Unicode names and emails.

Use a cryptographically random, single-use, expiring token stored only as a hash. A proposed default is 24 hours for invitations and 30 minutes for reset grants, configurable by the system administrator. Resend invalidates the older grant. A verified email delivery provider is a dependency, not an assumption. If email is unavailable, allow the administrator to deliver a one-time activation link through the organization’s established secure channel, with the same expiry, rate limits and audit. Never auto-login after reset. These controls follow [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

**Edit personal details:** dedicated self-profile route for name and supported language/theme preferences. Password change remains a separate current-password-verified action. Do not post role/lab/project arrays for an ordinary profile edit.

**Change role or lab:** show an impact review listing gained/lost capabilities, unfinished assignments, submissions awaiting review, known offline packs and reports that keep the old authorship. Verify on commit with a revision and policy version. Cross-lab transfer is administrator/national-scope authority, never a free-text change. Existing work stays with its receiving lab; transfer cannot move samples, attempts or signed reports.

**Disable account:** permit immediate authorized suspension for a security concern even if work is pending. Preserve pending work, revoke access and create a manager task to reassign it. For planned departure, offer reassignment before disabling. An emergency suspension must not depend on an unavailable replacement technician. Do not advertise that an offline device has acknowledged revocation until it reconnects.

**Remove identity:** replace normal hard-delete with archive/disable. Keep immutable IDs/usernames, submissions, attempts, chain-of-custody, reports and audit actors. Privacy/anonymization work is a separate policy, not a delete button. No broad cascade deletion.

**Administrator guard:** prohibit removing/demoting/suspending the last effective super administrator across all APIs, lab suspension cascades and concurrency. Self role/scope disabling requires a separate eligible administrator, not the target’s own session. A fresh reauthentication step protects privileged changes; a real server transaction/lock prevents two admins concurrently removing each other. Preserve an existing verified administrator throughout rollout; no newly created shared emergency account.

**Manager coverage:** planned removal of the last active manager must identify a replacement or an authorized scoped oversight owner. Emergency disable is still possible; flag uncovered review/assignment queues immediately to authorized oversight. Do not assign manager powers silently to a technician.

**Sessions:** reuse current database checks, increment session/authorization revision on password reset, role/scope transfer and suspension, close affected WebSockets and invalidate relevant caches. Account reactivation must not make previously revoked tokens valid again. Support impersonation includes current target and actor versions; revalidate both. Provide visible support context and an explicit end/return flow; no support session writes to approvals or credentials by default. Record original actor and effective subject. Account switches cannot trigger another person’s offline outbox.

**Exit evidence:** invitation reuse/expiry/rate limits; two parallel last-admin operations; self edit; simultaneous reassignment/deactivation; revoked HTTP and WebSocket session; support session after target password change; offline reconnect after transfer; all historical authors unchanged.

### WP-D — Lab lifecycle and project relationships

**Findings:** LG-04–05, LG-10–13, LG-24–25.

Use explicit lab states rather than a toggle. Proposed states: `SETUP`, `ACTIVE`, `PAUSED`, `RETIRED`. Keep existing `isActive` compatibility during migration; do not derive state from a missing timezone. Current active labs remain operational while configuration gaps are resolved.

- **SETUP:** directory and administrative configuration available to authorized people; no real intake/assignments until required identity, location/timezone and responsible manager checks pass.
- **ACTIVE:** normal permitted operations. Resource/method readiness still governs individual work.
- **PAUSED:** stop new intake, assignments and operational writes; preserve records. Authorized staff can read scoped history and local unsynced work; a reconnect can upload quarantined evidence to a recovery store if authorized, never silently finalize it. Explicit resume restores lab access only, not individual disabled accounts.
- **RETIRED:** long-term read-only records; no physical or data deletion. Retirement checks unresolved work, sample storage/disposal, project handover, credentials, equipment and inventory disposition. Exceptional recovery is an administrator action with reason and audit.

The pause review states exactly what happens to each group, pending submissions, active batches, devices and integrations. It is one purposeful action with a required reason, not an icon click. Infrastructure emergencies may need a separate platform restriction; do not overload staff status.

Project membership changes include pending samples, historical reports and live Kobo/SIS mappings in their impact report. Removing a servicing lab cannot silently unlink its samples or make mandatory history inaccessible. Keep historical sample ownership and a time-bounded historical read grant where policy permits. Project closure and local lab withdrawal are separate commands. No sample `projectCode = RESTORE:*` rewrite as the routine archive behavior; migrate existing restore links carefully.

## 3. WP-E — User experience specification

### Navigation

Administrators start at **Laboratories**: a searchable table of lab name, country, operational status, responsible manager, current work, configuration attention and a clearly labeled Open action. National leads see only their authorized region; lab managers land directly in **My laboratory**. People without management authority see a concise read-only lab profile where useful, not empty admin tabs.

One workspace has six tabs. URLs retain selected lab and tab; existing `/admin/labs?labId=...` dashboard links remain compatible. `/users` remains a supported alias/global people view using the shared roster/editor. One browser back action returns to the original filtered list. No duplicate implementation for national versus lab management.

| Tab | Useful content and actions |
|---|---|
| Overview | Lab identity/local time/status/manager; a short list of concrete issues; current work separated into expected, received, waiting, in progress, review and released; links go to filtered queues |
| People | Search and role/status filters; person, human role, scope, availability, unfinished assignments and recovery state; invite, review access, suspend/reactivate and planned handover |
| Projects | Project title, owner, this lab’s service role, intake mode, local work counts and integration health; local setup or request global change according to capability |
| Methods & resources | Links/cards into existing lab-method defaults, equipment, inventory and QC/proficiency screens with lab context preserved; active method/readiness gaps; no second editing engine |
| Settings | Lab identity/contact/timezone, local language/branding, capacity with unit; admin-only lifecycle actions in a separate section; immutable IDs in details |
| History | Scoped redacted audit: who changed what, subject, reason, before/after, timestamp and related record; export only for authorized users |

### People details and review

Person panel has Overview, Access, Work and Activity sections. A manager sees only manageable roles, and read-only explanation for themselves, peers and higher roles. **Review access** opens a two-column “Current / Proposed” comparison. Common safe edits stay compact; adding a project shows its name, owner and access level. The final action reads “Apply these access changes”, with the real affected person and lab visible.

After success, use the authoritative response to refresh the roster, user details, counts, assignment selectors and related queue. Show a durable command receipt reference and a concise sentence (“Access changed. Two unfinished tasks need reassignment.”). Do not claim all sessions/devices are cleared without evidence. If conflict, preserve edits and show differences to rebase; do not silently overwrite.

### Required UI states

Loading skeleton; genuinely empty lab; filtered empty results; permission denied with authorized help path; server unavailable with Retry; stale revision conflict; pending email delivery; partial batch failure with per-person outcomes; unavailable replacement; missing timezone; manager coverage gap; unacknowledged offline device; saved state confirmed by server. A 403/500 is never an empty roster.

### Visual direction

Use the established SoilFER shell and tokens: warm off-white workspace, restrained soil/forest accents, subtle borders, clear data tables, human names. Status always includes text and icon, not color alone. Avoid gradient KPI walls and raw technical codes as titles. Small calm “scope” labels prevent cross-lab mistakes. Keep overview compact enough to reach actions without scrolling on desktop.

The included preview demonstrates the layout and representative transitions using synthetic data. It is an English review model, not production code, exhaustive localization, or proof of server enforcement. Implement with current shared components, not a standalone app pasted into the project.

### Mobile, language, theme and accessibility

All five deployed locales (`en`, `es`, `es-419`, `fr`, `pt`) require real UI keys, meaningful role explanations, action outcomes, validation errors and relevant Help v2 guides. `es-419` is the existing regional locale; use the actual configured language registry rather than inventing a fifth language. Translation changes cannot affect stable role/method IDs. Use locale-aware dates and lab timezone; UTC persists in storage. Search supports accents.

Use zone identifiers from the [IANA time-zone database](https://www.iana.org/time-zones) and supported runtime zone validation; do not maintain hand-written fixed UTC offsets. The application must calculate the relevant date’s offset.

Maintain light default and existing session/profile theme preferences. Dark mode uses existing semantic tokens, not fixed near-black backgrounds. Keep colors readable for tables, inputs, badges, dialogs, errors and focus rings. Preserve desktop workflows and preferences.

At 320/390/768 px: prioritize names, status and primary action; move supporting details into expandable rows or full-screen panels. Dialog actions stay reachable without overlaying errors. Use 44 px targets for this lab UI, visible keyboard focus, proper labels, screen-reader headings/status, dialog focus trap/return and no pointer-only row expansion. W3C’s [WCAG 2.2 minimum target criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is 24 CSS pixels subject to exceptions; 44 px is our more comfortable design target, not a claim about that minimum.

## 4. WP-F — Connected services and migration

Follow `04-connections-and-migration.md` in order. Build compatibility adapters with a documented removal date. Keep identifiers, historical authors, method snapshots, spectra, receipts and reports intact. Consume existing workflow/readiness services in overview metrics. Apply explicit lab/project context to equipment, inventory, workbench, sample map, reports and integration screens.

After committed mutations, a transactional outbox carries redacted scope-change and work-change events to the relevant users/labs. Cache keys include lab/project/actor scope, locale and relevant revisions. Database writes are authoritative; a missing event cannot invalidate the result. Clients refetch on navigation/reconnect and distinguish stale counts from confirmed values.

## 5. WP-G — Rollout and completion

Use the release procedure and acceptance gates in `05-acceptance-and-release.md`. Deploy additive server compatibility first, then client components, then enforcement and migration cutover. Security restrictions must remain enforced through client rollout and rollback; never restore a known bypass to keep a legacy button functioning. Keep the previous hashed JS assets available long enough for existing/offline clients to update safely. An update cannot discard in-progress drafts.

The deliverable is complete when tests and staged role-by-role journeys pass, production read-only smoke checks match the shipped commit, and all outstanding findings have evidence or an explicit documented release blocker. “Build successful” or “all pages look fine” is insufficient. Do not promise zero defects.
