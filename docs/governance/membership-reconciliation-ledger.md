# User Membership Reconciliation & Scoped Authorization Ledger (#103)

**Work Package**: `WP/contributor-issues-2026-09`  
**Issue**: [#103 User membership reconciliation & country access grants](https://github.com/yigini/soilfer-lims/issues/103)  
**Lead**: Antigravity (Evidence & Ledger) / Codex (Governance & Issue Communication)  
**Baseline Policy**: `WP/project-management-country-kobo-v2` & `INDEPENDENT-REVIEW-2026-09-21.md`  
**Gate Status**: **Production Migration Hold Active** (Read-Only Inspection; Zero unverified schema or data mutations).

> [!IMPORTANT]
> **Illustrative Drafting & Governance Framework Only (Not Production Data)**
> This document provides a governance methodology, architectural mapping against the actual Prisma schema, and illustrative user archetypes for country coordinators to review.
> **No Verified Production Rows**: The entries in Section 2 below are **illustrative examples / pending reconciliation archetypes**, NOT query results from production, verified source extracts, or migration inputs.
> **Zero Inventions**: Do not treat these illustrative rows as confirmed identities, active grants, or mandates. They must NEVER be used as a database migration script or seed input.

---

## 1. Actual Schema Architecture & Principles of Reconciliation

### Current Prisma Schema Facts (Single Source of Truth)
The SoilFER LIMS core schema (`server/prisma/schema.prisma`) defines user and project relationships as follows:
- **`User` Model**:
  - `labId String?`: Direct foreign key to assigned `Lab.id`.
  - `projects String?`: JSON-serialized array of project codes (e.g. `["PROJ-GTM-01"]`).
  - `countries String?`: JSON-serialized array of ISO-3 country codes (e.g. `["GTM", "HND"]`).
  - `role String`: System role (`SUPER_ADMIN`, `LAB_MANAGER`, `LAB_TECHNICIAN`, `SAMPLE_RECEPTION`).
  - `isActive Boolean`: Account activity flag (defaults to `true`).
  - *Note*: There are **no** `UserProject` or `UserLab` relational junction models in the database schema.
- **`ProjectLab` Model**:
  - Junction table defining which laboratories service which projects: `projectCode` (references `Project.code`), `labId` (references `Lab.id`), `role` (`PRIMARY`, `BACKUP`, `OVERFLOW`).

### Authorization Scoping Rules (`server/utils/scopeGuard.js`)
1. **Global Access Scope**: `hasGlobalAccess(user)` grants un-scoped query access **strictly to `SUPER_ADMIN`** (`user.role === 'SUPER_ADMIN'`).
2. **Lab Scoping Requirement**: All non-`SUPER_ADMIN` roles must possess a valid `user.labId`. If `user.labId` is missing/null, `getLabScope(user)` throws an explicit denial error (`SCOPE_GUARD: User is not assigned to a lab. Access denied`).
3. **Audit Role Scope**: `AUDIT_USER` does **not** have built-in unrestricted global bypass in `scopeGuard.js`. Any global or regional read-only audit access would require an explicit policy addition to `scopeGuard.js` and formal sign-off; it cannot be inferred or assumed.
4. **Deny-by-Default / Fail-Closed**: Users lacking verified association receive empty data sets or HTTP 403 `FORBIDDEN`.

---

## 2. Illustrative Discrepancy & Mapping Archetypes (Pending Production Evidence)

The following table documents the reconciliation archetypes required by governance. These are **illustrative draft profiles** showing how each role must be evaluated against the actual schema, not live database rows:

| User Archetype | Role | Country Attribute (`User.countries`) | Lab Attribute (`User.labId`) | Project Attribute (`User.projects`) | Servicing Lab Junction (`ProjectLab`) | Architectural Evaluation | Governance Action Required | Reconciliation State |
|---|---|---|---|---|---|---|---|---|
| `admin` (Archetype) | `SUPER_ADMIN` | Global / null | Unassigned / Central | Full (`*`) / null | N/A | `hasGlobalAccess()` returns `true`. Bypasses lab filters. | Maintain strictly for system-level administrators. | **Pending Live Audit** |
| `manager.gtm` (Archetype) | `LAB_MANAGER` | `["GTM"]` | `LAB-GTM-01` | `["PROJ-GTM-SOILFER"]` | `PROJ-GTM-SOILFER` <-> `LAB-GTM-01` | Scoped to `LAB-GTM-01`. Project code matches active servicing lab. | Requires signed mandate letter from Guatemala national coordinator. | **Pending Country Mandate** |
| `tech.gtm` (Archetype) | `LAB_TECHNICIAN`| `["GTM"]` | `LAB-GTM-01` | `["PROJ-GTM-SOILFER"]` | `PROJ-GTM-SOILFER` <-> `LAB-GTM-01` | Scoped to `LAB-GTM-01` bench work items. | Requires lab manager operational sign-off. | **Pending Lab Manager Sign-off** |
| `auditor` (Archetype) | `AUDIT_USER` | Multi-country or `["*"]` | Unassigned / Central | Read-Only | N/A | Current `scopeGuard` denies unassigned non-superadmins. Requires explicit read-only audit policy. | Formal specification of audit boundaries required before provisioning. | **Pending Policy Definition** |
| `unassigned.pm` (Archetype) | `PROJECT_MANAGER`| `["HND"]` | `null` | `null` | Unconfirmed | Fails closed. Cannot access samples or work items without explicit project mapping. | **Do not guess**. Keep unmapped until national coordinator confirms project code. | **Blocked / Hold** |
| `unassigned.tech` (Archetype) | `LAB_TECHNICIAN` | `["RWA"]` | `null` | `null` | Unconfirmed | Fails closed. `getLabScope()` rejects access. | **Do not guess**. Keep unmapped until lab director confirms lab assignment. | **Blocked / Hold** |

---

## 3. Authorization Comparison: Legacy Fallback vs. Current Scope Guard

### Legacy Permissive Fallback (Historical Vulnerability)
- Legacy heuristic: If `user.country === project.country`, access was granted implicitly without verifying laboratory assignment or project enrollment.
- Defect: Led to cross-programme leakage when multiple projects or sovereign programs operated within the same nation, or when personnel transitioned between responsibilities without database profile updates.

### Enforced Explicit Scope Guards (`server/utils/scopeGuard.js`)
- Enforced behavior:
  1. Lab-bound operational roles require a non-null `user.labId` verified against the `Lab` registry.
  2. Queries for `Sample`, `WorkItem`, `Consignment`, and `InventoryItem` automatically append scoped clauses (`where: { labId: user.labId }`).
  3. Client-supplied lab or project overrides in query parameters or request bodies are stripped at the HTTP trust boundary.
  4. Unmapped users receive truthful empty datasets or HTTP 403 `FORBIDDEN` without information leakage.

---

## 4. Production Execution Gate & Rollback Plan

Prior to applying any future verified user reconciliation data:
1. **Production Hold**: Maintain zero schema mutations and zero manual database edits until all country mandate letters are formally logged.
2. **Backup Verification**: Generate a full database dump (`sqlite3 .dump` or `pg_dump`) and verify its SHA-256 digest prior to any execution.
3. **Discrete Reviewable SQL**: Any proposed update must be formulated as an idempotent, parameterized script matching the actual schema (`User.labId`, `User.projects`, `User.countries`).
4. **Dry-Run & Rollback Verification**: Execute in a segregated test environment to verify fail-closed isolation remains intact before production staging.
