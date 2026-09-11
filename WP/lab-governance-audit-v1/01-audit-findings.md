# Laboratory governance audit — evidence register

Baseline `ecb7c91`; reviewed 11 September 2026. These are source findings, not evidence of exploitation. No production mutations were performed. Handler probes use synthetic persistence and are not real HTTP/Prisma integration tests. Read the limits in `probe-results.json`.

| ID | Priority | Finding | Evidence |
|---|---|---|---|
| LG-01 | Critical | Laboratory staff actions bypass target scope and role hierarchy | server/routes/labRoutes.js:202 |
| LG-02 | High | Lab update accepts immutable identity and lifecycle fields | server/routes/labRoutes.js:347 |
| LG-03 | Critical | Staff recovery and generated accounts share a predictable secret | server/routes/labRoutes.js:201 |
| LG-04 | High | Lab creation can leave partial setup and fabricated users | server/routes/labRoutes.js:238 |
| LG-05 | High | Lab suspension and restoration can strand the whole staff | server/routes/labRoutes.js:124 |
| LG-06 | High | User deletion and role changes lack last-admin and dependency protection | server/controllers/userController.js:277 |
| LG-07 | High | Invalid lab, role and scope values can be stored | server/controllers/userController.js:183 |
| LG-08 | High | National staff administration alternates between invalid query and global scope | server/controllers/userController.js:30 |
| LG-09 | Medium | Roles and staff screens disagree | client/src/components/UserDialog.jsx:42 |
| LG-10 | High | Project-to-lab membership has four conflicting representations | server/controllers/projectController.js:105 |
| LG-11 | High | Shared-project read access authorizes global mutations | server/controllers/projectController.js:635 |
| LG-12 | High | Country metadata broadens ordinary laboratory access | server/utils/scopeGuard.js:166 |
| LG-13 | Critical | Kobo configuration endpoint lacks project scope and returns credentials | server/controllers/projectController.js:845 |
| LG-14 | Critical | Offline synchronization bypasses normal result authorization and can falsely acknowledge drafts | server/services/syncService.js:89 |
| LG-15 | High | Offline packs and queued work are not consistently bound to user and lab | server/controllers/offlineController.js:21 |
| LG-16 | High | Session revocation differs between HTTP, impersonation and WebSocket | server/middleware/authMiddleware.js:14 |
| LG-17 | High | Assignment can target inactive staff and misses national bounds | server/controllers/workItemController.js:494 |
| LG-18 | High | Equipment management has inconsistent lab checks | server/controllers/equipmentController.js:158 |
| LG-19 | High | Inventory location transfer does not validate destination lab | server/controllers/inventoryController.js:599 |
| LG-20 | High | Global language management is exposed through branding permission | server/controllers/adminController.js:220 |
| LG-21 | Medium | Audit records do not consistently explain staff and scope changes | server/controllers/userController.js:183 |
| LG-22 | Medium | Common lab picker endpoint exposes a full management DTO | server/routes/labRoutes.js:10 |
| LG-23 | Medium | Lab workspace mixes setup, access and status in unsafe small controls | client/src/pages/admin/LabManagement.jsx:243 |
| LG-24 | Medium | Lab workload counts and time-zone setup can mislead managers | server/routes/labRoutes.js:36 |
| LG-25 | High | Lab identifier semantics require a controlled migration | server/prisma/schema.prisma:13 |
| LG-26 | Medium | Work change notifications use the actor lab instead of the work lab | server/controllers/workItemController.js:696 |
| LG-27 | Medium | Project update attempts to send its response twice | server/controllers/projectController.js:496 |
| LG-28 | High | SIS key administration and JWT revocation diverge from platform policy | server/controllers/sisController.js:836 |
| LG-29 | High | National dashboard lab selector accepts unauthorized labs | server/services/dashboardScope.js:95 |

## LG-01 · Laboratory staff actions bypass target scope and role hierarchy

**Critical** · source + synthetic handler probes. [Source](../../server/routes/labRoutes.js) line 202; anchor `router.patch('/:id/staff/:userId/reset-password'`.

MANAGE_BRANDING grants lab managers sensitive actions for arbitrary laboratory IDs. The staff reset checks target membership in the path lab, but never the acting manager’s lab or target role. The ordinary Users update correctly denies the equivalent cross-lab operation.

**Required change:** Introduce action-specific server policy for every lab/user mutation. Reuse the same staff service behind both entry points; no authority from a client lab ID. Protect management targets and the actor.

Evidence probes: P01, P02, P03, P06.

## LG-02 · Lab update accepts immutable identity and lifecycle fields

**High** · source + synthetic handler probes. [Source](../../server/routes/labRoutes.js) line 347; anchor `router.put('/:id'`.

The body is spread into the lab update. A caller can forward id, isActive and other Prisma-recognized fields; capacity is cleared when absent and no audit is recorded.

**Required change:** Typed PATCH allowlist, reject immutable and unknown fields, preserve omitted values. Separate versioned lifecycle command; never rename IDs through profile editing.

Evidence probes: P05.

## LG-03 · Staff recovery and generated accounts share a predictable secret

**Critical** · source + synthetic handler probes. [Source](../../server/routes/labRoutes.js) line 201; anchor `// ─── PATCH /api/labs/:id/staff/:userId/reset-password`.

Reset uses a fixed shared password and returns it; generated active accounts use the same pattern. Resets do not increment tokenVersion. The forced-password-change gate exists but does not replace revocation or secure recovery.

**Required change:** Replace with single-use expiring activation/recovery. Invalidate sessions and other reset grants on administrative reset. No passwords in responses, bulk-copy panels, logs, email templates or screenshots.

Evidence probes: P02.

## LG-04 · Lab creation can leave partial setup and fabricated users

**High** · source + synthetic handler probes. [Source](../../server/routes/labRoutes.js) line 238; anchor `router.post('/'`.

A lab is created before six staff accounts; per-user errors are swallowed and a test project is created afterward. Real people, valid addresses and a responsible manager are not prerequisites.

**Required change:** Create a draft lab transactionally, then invite named people and configure approved project access. Report readiness accurately; no automatic active test projects or invented identities.

Evidence probes: P06.

## LG-05 · Lab suspension and restoration can strand the whole staff

**High** · source + synthetic handler probes. [Source](../../server/routes/labRoutes.js) line 124; anchor `router.patch('/:id/toggle-active'`.

Disabling a lab disables all users in separate writes; re-enabling it does not restore them. HTTP auth only checks user status, allowing an individually enabled user in an inactive lab. Audit failure can return 500 after state changed.

**Required change:** Separate lab operational access from individual account status; use explicit target status, transaction and impact review. Do not bulk-enable existing disabled users during migration or recovery.

Evidence probes: P04, P08, P21.

## LG-06 · User deletion and role changes lack last-admin and dependency protection

**High** · source + synthetic handler probes. [Source](../../server/controllers/userController.js) line 277; anchor `exports.deleteUser =`.

Hard deletion permits self/last-admin attempts. FK constraints may reject referenced users, but there is no intentional recovery policy. A lab manager can manage a same-lab project manager. Role/lab changes do not reconcile unfinished work.

**Required change:** Archive identities; protect self and last eligible administrator atomically. Restrict target roles explicitly. Route work transfer separately, preserve all historical authorship.

Evidence probes: P09, P15.

## LG-07 · Invalid lab, role and scope values can be stored

**High** · source + synthetic handler probes. [Source](../../server/controllers/userController.js) line 183; anchor `exports.updateUser =`.

User labId has no Lab relation and API validation permits nonexistent labs. Empty role bypasses truthy validation. Boolean strings are coerced. Self-profile saves containing unchanged arrays are rejected.

**Required change:** Strict request schemas and entity checks; dedicated self-profile endpoint; exact booleans and recognized roles/locales. Validate explicit scope sets, require a real lab for lab-bound staff.

Evidence probes: P10, P11, P14.

## LG-08 · National staff administration alternates between invalid query and global scope

**High** · source + synthetic handler probes. [Source](../../server/controllers/userController.js) line 30; anchor `exports.getUsers =`.

Country-scoped national users generate a User.country predicate, but the schema has countries. Empty country lists yield no restriction. National users can list staff but cannot create/manage them consistently.

**Required change:** Resolve authorized labs from explicit national scope and lab country; empty means none. Join staff through those labs. Publish capabilities that match permitted national administration.

Evidence probes: P12, P13.

## LG-09 · Roles and staff screens disagree

**Medium** · source + synthetic handler probes. [Source](../../client/src/components/UserDialog.jsx) line 42; anchor `getRoleOptions`.

User dialog omits Quality & Audit and External Partner roles available in the server registry; national role choices are empty. Laboratory management is super-admin-only while some staff endpoints allow managers. Raw role codes and free-text lab IDs undermine safe entry.

**Required change:** Server-owned role catalogue and assignable-role API; lab selector with names/country; shared staff components with scoped routes. Display account status, scope and pending work.

Evidence probes: P14.

## LG-10 · Project-to-lab membership has four conflicting representations

**High** · source + synthetic handler probes. [Source](../../server/controllers/projectController.js) line 105; anchor `exports.getProject =`.

Lab.projectCode, Project.labId, Project.assignedLabIds and ProjectLab compete. Junction membership is checked after detail authorization. National users fall through to empty project lists; project-manager membership does not satisfy the detail guard.

**Required change:** Canonical ProjectLab service relationships plus explicit project ownership and project-user grants. Reconcile legacy conflicts without taking their union automatically; list, detail, selectors and reports use one resolver.

Evidence probes: P17, P18, P19.

## LG-11 · Shared-project read access authorizes global mutations

**High** · source inspection. [Source](../../server/controllers/projectController.js) line 635; anchor `exports.deleteProject =`.

A manager assigned to a global project can reach its soft-delete path, which unlinks samples across the whole project. Archive/restore and update similarly rely on generic read access. Updating assignedLabIds can alter other labs’ access.

**Required change:** Separate project ownership, service access and delegation. Lab managers change local execution settings only on shared projects. Global archive/restore/manifest/membership commands require owner authority and impact checks.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-12 · Country metadata broadens ordinary laboratory access

**High** · source + synthetic handler probes. [Source](../../server/utils/scopeGuard.js) line 166; anchor `function canAccessEntity`.

Country match is an OR grant in generic entity checks, including ordinary lab roles; project membership is missing. A same-country sample from another lab may become readable, and callers reuse this predicate for writes.

**Required change:** Use resource-specific policy: role capability AND resource relationship AND state. Country is a national-role scope only, not an alternative grant for every staff member.

Evidence probes: P16.

## LG-13 · Kobo configuration endpoint lacks project scope and returns credentials

**Critical** · source + synthetic handler probes. [Source](../../server/controllers/projectController.js) line 845; anchor `exports.getProjectKoboConfig =`.

Any role with MANAGE_PROJECTS reaches a project’s config without project authorization. National users are considered admin and receive the raw token. The first config is selected across labs; update also finds by project only.

**Required change:** Return configured/health metadata only. Never return stored secrets. Scope every config by project and lab, require integration-admin authority, preserve existing secret on unchanged edit, audit rotation without secret values.

Evidence probes: P28.

## LG-14 · Offline synchronization bypasses normal result authorization and can falsely acknowledge drafts

**Critical** · source + synthetic handler probes. [Source](../../server/services/syncService.js) line 89; anchor `op.type === 'COMPLETE_WORK'`.

Actual sync handler reaches completion writes without role, current assignment, lab, workflow-state or method gates; route requires authentication only. SAVE_WORK_DRAFT reports APPLIED without storing a draft. Synthetic probes demonstrate handler decisions, not a real DB commit.

**Required change:** Delegate every offline command to the canonical online domain services. Revalidate current grants, ownership, prerequisites and versions. Persist receipt and result atomically. Never report APPLIED before durable persistence.

Evidence probes: P25, P26.

## LG-15 · Offline packs and queued work are not consistently bound to user and lab

**High** · source + synthetic handler probes. [Source](../../server/controllers/offlineController.js) line 21; anchor `exports.getPack =`.

A cached pack is returned by ID without owner/lab/expiry checks. A missing pack regenerates a different one. A non-admin missing lab can request an unscoped pack. Client sync sends all pending operations using the currently stored token.

**Required change:** Bind pack, device, account, lab, authorization version and lease. Missing/expired means explicit error. Partition local outbox/drafts by immutable actor and lab; never replay another operator’s work after account switch. Preserve rejected evidence for authorized recovery.

Evidence probes: P23, P24.

## LG-16 · Session revocation differs between HTTP, impersonation and WebSocket

**High** · source + synthetic handler probes. [Source](../../server/middleware/authMiddleware.js) line 14; anchor `const verifyToken =`.

HTTP checks current user status and tokenVersion, which is useful. Impersonation omits target version and does not recheck the original actor. WebSocket checks active status only when connecting and caches lab/role; no tokenVersion validation or ongoing revocation.

**Required change:** Shared authentication context and authorization version; revoke active sockets on changes, validate actor and target in support sessions, include current versions. Offline leases cannot be instantly revoked while disconnected: state this limit and reject unauthorized replay.

Evidence probes: P20, P21, P22.

## LG-17 · Assignment can target inactive staff and misses national bounds

**High** · source inspection. [Source](../../server/controllers/workItemController.js) line 494; anchor `exports.assignWork =`.

Assignment correctly checks technician role and receiving-lab equality, but does not reject inactive assignees; actor ownership restriction is only for LAB_MANAGER. National scope and staff transfer impact are missing.

**Required change:** Eligible-assignee query and command must require active account/lab, correct receiving lab, actor scope, method authorization where configured and current work state. Reassignment preserves attempts and history.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-18 · Equipment management has inconsistent lab checks

**High** · source + synthetic handler probes. [Source](../../server/controllers/equipmentController.js) line 158; anchor `exports.updateStatus =`.

Detail and event creation use scope guards, but registration trusts body labId, status/metadata updates target arbitrary IDs, and event list/disposition omit parent-lab checks. Missing lab yields an unfiltered equipment list.

**Required change:** Apply equipment policy to every lookup/write/event/eligibility endpoint. Validate referenced location and instrument ownership. Recompute readiness using existing equipment rules and invalidate affected bench rows.

Evidence probes: P27.

## LG-19 · Inventory location transfer does not validate destination lab

**High** · source inspection. [Source](../../server/controllers/inventoryController.js) line 599; anchor `exports.transferLot =`.

Transfer checks the source lot belongs to the actor’s lab, but only checks destination location existence. This can create a cross-lab lot/location mismatch. Generic list scope uses undefined labId without an explicit missing-scope denial.

**Required change:** Require destination and source same lab for location moves; real inter-lab stock transfer is a separate approved, balanced-ledger workflow. Fail closed on missing scope; preserve existing transactional quantity/audit rules.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-20 · Global language management is exposed through branding permission

**High** · source inspection. [Source](../../server/controllers/adminController.js) line 220; anchor `exports.deleteLanguage =`.

Create/delete language routes use MANAGE_BRANDING and lack a global-role check inside their handlers. In contrast, translation update and default selection already distinguish global and lab scopes.

**Required change:** Separate MANAGE_GLOBAL_LANGUAGES from lab overrides. Protect all five supported locales and existing content; no locale deletion through ordinary lab management. Preserve local translation overrides.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-21 · Audit records do not consistently explain staff and scope changes

**Medium** · source inspection. [Source](../../server/controllers/userController.js) line 183; anchor `exports.updateUser =`.

User change audit records list field names but omit labId and meaningful before/after values. Lab PUT is unaudited. Several mutations occur before audit, so audit failures can leave successful state changes reported as failures. Impersonated operations can appear under the target only.

**Required change:** Append redacted before/after, actor/subject, reason, lab/project scope, command ID and revision transactionally. Authorize audit reads and retain immutable history. Never log passwords, recovery tokens or integration keys.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-22 · Common lab picker endpoint exposes a full management DTO

**Medium** · source + synthetic handler probes. [Source](../../server/routes/labRoutes.js) line 10; anchor `router.get('/'`.

Authenticated GET /labs returns every lab with notes/settings and aggregate staff/sample/project information. Common forms depend on this endpoint, so simply denying it would break normal selection.

**Required change:** Split a minimal scoped lab directory from management summaries. Enumerate consumers and migrate them together; cache keys include actor scope and revision.

Evidence probes: P07.

## LG-23 · Lab workspace mixes setup, access and status in unsafe small controls

**Medium** · source inspection. [Source](../../client/src/pages/admin/LabManagement.jsx) line 243; anchor `InfoTab`.

Tiny activation dot, inline staff actions, hardcoded English, generic project links, no impact review and a staff fetch failure presented as an empty roster. Missing configuration disappears from info display.

**Required change:** Use a focused lab workspace with Overview, People, Projects, Methods & resources, Settings and History. Named actions with inline reasons, real error/empty states, mobile rows, translated human labels and one staff editor.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-24 · Lab workload counts and time-zone setup can mislead managers

**Medium** · source inspection. [Source](../../server/routes/labRoutes.js) line 36; anchor `const TERMINAL_STATUSES`.

Lab active-sample count includes every status except ARCHIVED/DISPOSED, including expected/unreceived samples. Live admin showed timezone gaps in eight labs; the existing Configure deep link worked. Static timezone offsets in the lab form can mislead around daylight saving.

**Required change:** Define mutually exclusive operational counts from canonical workflow/readiness; use explicit IANA zone, localized dates and current offset preview. Reuse existing dashboard contracts; do not add another pipeline calculator.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-25 · Lab identifier semantics require a controlled migration

**High** · source inspection. [Source](../../server/prisma/schema.prisma) line 13; anchor `model User {`.

User.labId is an unconstrained string. Sample.labId is also used as a generated sample/lab accession identifier; Sample.assignedLab is receiving-lab ownership. A bulk rename/relation migration could corrupt labels or access.

**Required change:** Document each field’s meaning, reconcile orphan user lab IDs against real Lab IDs, retain public sample accession IDs. Add relations only after a read-only mismatch report and reviewed resolution map.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-26 · Work change notifications use the actor lab instead of the work lab

**Medium** · source inspection. [Source](../../server/controllers/workItemController.js) line 696; anchor `broadcastToLab(user.labId`.

Assignment/reassignment/review notifications use user.labId. A global admin with no lab can make a valid change while the broadcaster drops the missing-lab event; a manager’s screen stays stale.

**Required change:** Emit transactional outbox events using the resource receiving lab and affected users, partition bulk actions by lab. Clients refetch authoritative state on reconnect; events must not confer access.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-27 · Project update attempts to send its response twice

**Medium** · source inspection. [Source](../../server/controllers/projectController.js) line 496; anchor `res.json(updated);`.

Two consecutive res.json(updated) calls occur in the update handler. The second write can raise headers-already-sent after a successful save.

**Required change:** Return once after the transaction. Assert one response, one audit and idempotent retry behavior; do not assume an HTTP 500 reaches the client after headers were sent.

Reproduce in isolated, strict-schema integration tests before closing.

## LG-28 · SIS key administration and JWT revocation diverge from platform policy

**High** · source + synthetic handler probes. [Source](../../server/controllers/sisController.js) line 836; anchor `exports.createApiKey =`.

Key list/create/revoke use MANAGE_BRANDING without an owner/lab check; revoke can target any key. Key creation accepts country/project scopes but omits labs, while the consumer requires explicit lab scope and correctly denies absent labs. SIS JWT middleware checks active user but not tokenVersion or forced-password-change.

**Required change:** Dedicated integration-key policy, explicit validated lab/project scopes and bounded expiry; creation never grants more than the issuer. Preserve hashed keys and one-time creation display. Scope list/revoke and audit them. Reuse HTTP session validation for JWT callers; do not loosen the empty-lab denial to make keys work.

Evidence probes: P29.

## LG-29 · National dashboard lab selector accepts unauthorized labs

**High** · source + synthetic handler probes. [Source](../../server/services/dashboardScope.js) line 95; anchor `async function resolveActorScope`.

National selectedLabId is accepted without validating the lab country against the actor. Downstream query uses that active lab directly. The local-day helper adds a fixed 24 hours and gives the wrong end boundary on a daylight-saving day.

**Required change:** Validate selectable labs before loading their names or counts; deny out-of-scope selectors. Reuse a timezone-aware next-local-midnight calculation and test 23/25-hour days. Keep the existing queue contract and positive role filters.

Evidence probes: P30, P31.
