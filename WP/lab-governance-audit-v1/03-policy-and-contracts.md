# Policy, state and API contracts

These are proposed implementation contracts, not endpoints that already exist. Use compatible route naming after checking the current router. A role provides possible actions; the resource relationship and state determine whether that action is permitted now.

## 1. Access decisions

`allowed = active identity AND action capability AND authorized resource relationship AND valid resource state AND change invariants`.

Authentication, a hidden button, a lab ID in a URL, or a role string alone is insufficient. Derive scope from the current server record and validated relationships. Query/filter composition uses AND. A direct detail lookup must have the same boundary as list, export, count, picker, background job, WebSocket and offline command.

For national scope, use explicit country grants to resolve authorized Lab IDs, with optional narrower explicit lab grants. Do not infer a person’s management rights from the country of a soil sample. For project scope, resolve membership using immutable project identity and server-managed relations. Sample provenance country, laboratory location country and user scope are different concepts.

## 2. Proposed role defaults

Keep existing role keys. Do not silently broaden a role just because the current screen or permission array suggests it. The following is the recommended target policy. In the migration report, highlight any existing legitimate grant that would change; apply sensitive expansions only through a named delegation. Corrections to demonstrably unauthorized cross-lab behavior are required.

| Role | Resource scope | Lab / staff administration | Project authority | Scientific work |
|---|---|---|---|---|
| SUPER_ADMIN | Explicit global administration; choose a target lab for operational work | Provision labs; manage all roles with self/last-admin safeguards; audited recovery | Global configuration/ownership/relationships; protect historical data | Existing operational capabilities subject to workflow and separation-of-duty rules; no force-approval shortcut |
| MASTER_USER | Explicit national labs/projects; empty grants mean no access | See national labs; propose/manage lab-level staffing only where explicitly delegated; no peer/super-admin recovery or global lab creation | National oversight; ownership/delegation required for global edits | Existing review/assignment capabilities only within authorized labs, with current workflow gates |
| LAB_MANAGER | Own lab; service-related project records | Own lab contact/preferences and permitted subordinate roles; no peer/manager/national/admin edits; planned handover | Own lab projects if owner; local service settings on shared projects; request central changes | Assign/review/approve eligible work in own receiving lab; no self-review where current separation-of-duty rules prohibit it |
| SAMPLE_RECEPTION | Own lab and authorized intake projects | Read operational lab directory; personal preferences only | Select eligible active projects and receiving lab; no access-grant edits | Intake, labels and authorized custody steps; no analytical approval |
| LAB_TECHNICIAN | Own lab and assigned work | Personal preferences; authorized team contact/availability only | Read context needed for assignments | Record/submit via workbench and domain services; prerequisites and method/equipment rules apply online and offline |
| PROJECT_MANAGER | Explicit projects, including cross-lab project views | No laboratory or account administration | Project tracking, authorized metadata by ownership/delegation; no global lab grants or key management by default | No analytical sign-off from project role alone; preserve permitted project intake tracking |
| AUDIT_USER | Explicit lab/project audit grants | Read authorized configuration and redacted audit; no staff mutations | Read required project trail | Review evidence/read history; not approval authority by default |
| SURVEYOR | Assigned field projects/own authorized field records | Personal preferences | Field context only | Field observations/provenance; no receipt, result approval or lab setup from this role alone |
| EXTERNAL_VIEWER | Explicit released/publication-granted projects/data | No staff roster/credentials/administration | Published progress/results as granted | No drafts, internal notes or mutations |
| VIEWER | Explicit read grants | No staff administration | Read only within explicit grant | No writes; restrict unpublished data according to the grant |

**Bounded decisions for product owner:** whether national directors should directly manage lab managers; whether project managers may edit project metadata; whether named quality staff can be delegated review authority. Until a grant exists, deny that privileged mutation and show “Ask your system administrator.” Do not block all legitimate existing national read/oversight work pending these choices. This avoids inventing broad rights during implementation.

### Assignable roles

Lab managers can assign only `LAB_TECHNICIAN`, `SAMPLE_RECEPTION`, `SURVEYOR`, `AUDIT_USER`, `EXTERNAL_VIEWER`, `VIEWER` within their permitted scope. External users should normally receive explicit project/release grants rather than automatic whole-lab access. Never inherit every country/project grant from the manager by default. National delegated staff administrators may assign LAB_MANAGER only inside their delegated labs; may not grant their own delegation. System administrators manage remaining management roles subject to recovery guards.

### Administrative and scientific authority

Do not infer method competence or instrument authorization from account role. If such qualification records exist, use them for eligible assignees. If they do not, display “Competence not recorded” and design an explicit follow-up qualification model; do not invent approved competence during migration. Do not invalidate existing method snapshots simply because a person changes role. Approval remains a separate reviewed workflow with its existing evidence and independence rules.

## 3. API contracts

All mutations below are online only. Offline laboratory operations continue through authenticated typed domain sync; offline account/role/lab lifecycle changes are not queued. Persist business state, audit and command receipt atomically where the operation touches one database. External mail/events use a transactional outbox.

| Proposed route / service | Contract |
|---|---|
| GET `/api/lab-directory` | Minimum fields `id,code,name,country,operationalStatus`; authorized selectable labs; paginated; no notes/settings/credentials. Disabled lab choice only where a history filter requires it |
| GET `/api/labs` management view | Policy-scoped summary; reject unauthorized management projection. Legacy picker adapter remains until consumers move |
| GET `/api/labs/:id/workspace` | Identity, local time/zone, lifecycle, revision, scoped counts, management capabilities and links to filtered queues |
| GET `/api/labs/:id/staff` | Consistent own-lab/delegated national/global policy; paginated directory DTO; no password fields; include `accountStatus,roleLabelKey,manageableActions,workSummary` |
| GET `/api/access/assignable-roles?labId=...` | Only roles actor may assign to this context; explanation, scope requirements and available actions; server still rechecks on commit |
| POST `/api/staff/invitations` | Named person and validated exact role/lab/projects; creates pending invite; no active fabricated users. Idempotent creation and distinct delivery status |
| POST `/api/users/:id/access-preview` | Resolve proposed changes and impacts within actor’s authority; creates short-lived review token binding actor, target, changes and versions; no mutation |
| PATCH `/api/users/:id/access` | Validated changed fields only, expected revision, review token, idempotency key and reason; re-evaluate policy and impacts transactionally |
| POST `/api/users/:id/suspend` / `reactivate` | Explicit state commands, never toggle; revoke access/version on suspend; preserve historic identity and work. Reactivate only eligible account, not previously revoked sessions |
| POST `/api/users/:id/recovery` | Issue one-time recovery using verified delivery path; authorized target hierarchy, reauthentication, bounded rate, audit without token |
| PATCH `/api/auth/profile` | Self-safe fields only. Own role/scopes forbidden. Existing preferences endpoints may remain as compatible implementation |
| POST `/api/labs` | Administrator-only draft lab creation. Strict ID/code/country/timezone checks; no staff/test project side effects |
| PATCH `/api/labs/:id/profile` | Allowlist contacts, address, name, capacity with unit, supported IANA timezone and permitted local settings. Immutable ID/code policy explicit; no lifecycle/access fields |
| POST `/api/labs/:id/lifecycle-preview` | Impact on accounts, assignments, samples, batches, reports, offline packs, integrations, stock and equipment; deterministic reviewed revision |
| POST `/api/labs/:id/lifecycle` | Target state, reason, expected revision, review token, idempotency key. Protect account coverage; no user.isActive cascade |
| GET/PATCH `/api/projects/:id/lab-access` | Read owner and servicing relations by capability; write only owner/delegated authority, with impact review and optimistic concurrency |
| GET `/api/projects/:id/integration-status` | Project/lab-authorized health metadata; credentials never in response. Kobo read/write adapters share this scope policy |
| SIS key administration | Dedicated system integration authority, explicit labs/projects/countries/data categories, expiry and rotation. No authority from MANAGE_BRANDING; correct omitted-labs creation defect without removing consumer fail-closed checks |
| GET `/api/users/directory` | Only people relevant to requested purpose/lab; `/eligible-assignees` includes active/competence/work constraints. Never pass full user objects to clients |
| GET `/api/labs/:id/audit` | Scope-filtered redacted events; bounded pagination; no secret values; downloadable only where permission allows |

### Shared command envelope

```json
{
  "expectedRevision": 12,
  "reviewToken": "opaque-server-issued-review-token",
  "idempotencyKey": "client-generated-uuid",
  "reason": "Planned end of assignment",
  "changes": { "role": "AUDIT_USER" }
}
```

The review token is bound to the actor, target, exact normalized payload, authorization version and target revision; it is short-lived and reusable only for the same idempotent commit. It is not a substitute for checking current authorization. Recompute work impacts at commit if dependent records changed. A hash alone is not permission. A server receipt contains actual committed revision and outcome, never a fabricated receipt ID.

```json
{
  "commandId": "opaque-id",
  "status": "APPLIED",
  "revision": 13,
  "effects": {"openAssignmentsNeedingHandover": 2, "sessionRevocationRequested": true},
  "warnings": ["One offline device has not reconnected"],
  "links": {"handover": "/workbench?labId=LAB-A&assignee=person-id&view=handover"}
}
```

The example link is a proposed route contract, not an existing route. Implement actual filter support before rendering the action. Never use arbitrary user-supplied return URLs.

### Errors and conflict behavior

Use `400` malformed fields; `401` absent/invalid/revoked session; consistent `403/404` for unauthorized resources without existence disclosure; `409` revision/state/duplicate-key payload conflict; `422` valid request blocked by domain conditions; `429` throttled recovery. Error payload has stable code, human message, authorized resolution action and field errors. It must not expose raw Prisma output.

Examples: `TARGET_OUTSIDE_SCOPE`, `TARGET_ROLE_NOT_MANAGEABLE`, `LAST_ADMIN_PROTECTED`, `STALE_REVISION`, `LAB_PAUSED`, `ASSIGNEE_INACTIVE`, `PROJECT_OWNER_REQUIRED`, `RECOVERY_REQUIRED`, `OFFLINE_OWNER_MISMATCH`, `REVIEW_EXPIRED`. Translate their messages, keep codes stable. After a timeout, look up command status instead of blindly toggling/repeating.

## 4. Data model changes

Prefer additive migrations over replacement:

- `Lab.operationalStatus`, `revision`; keep existing IDs/code and current `isActive` adapter during cutover.
- User `revision` and authorization/session version strategy; keep tokenVersion semantics compatible. Optional pending/archived lifecycle with explicit translation to existing isActive.
- Existing `ProjectLab` remains the service relation. Add active/effective dates/revision if needed; store project ownership separately so service PRIMARY does not accidentally mean administrative owner.
- Explicit `UserProjectGrant` and national/delegated lab grants only after reconciling JSON lists. Keep one operational home lab in this release; do not introduce multi-lab technician identities without a separate domain design.
- Invitation/recovery: target ID or validated pending identity, role/scope snapshot, token hash, expiry, consumed/revoked timestamp, issuer, delivery state. No plaintext secret persistence.
- Immutable administrative command receipt and audit event; reuse existing receipt machinery where compatible. Audit stores original actor/effective subject, lab/project, action, reason, redacted changes and UTC timestamp.
- Offline pack/lease with persisted owner/device/lab/auth version, expiry and revision; outbox keys include owner and lab. Queued command captures original actor identity and method snapshot; current login cannot replace it.

Database uniqueness and transaction constraints must match concurrent behavior. For SQLite, prove the locking strategy in parallel connections; do not write database-specific `FOR UPDATE` code unsupported by the deployed provider. Never use `prisma db push` against production for this work.
