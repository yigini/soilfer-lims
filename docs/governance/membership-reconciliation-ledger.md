# User Membership Reconciliation & Scoped Authorization Ledger (#103)

**Work Package**: `WP/contributor-issues-2026-09`  
**Issue**: [#103 User membership reconciliation & country access grants](https://github.com/yigini/soilfer-lims/issues/103)  
**Lead**: Antigravity (Evidence & Ledger) / Codex (Governance & Issue Communication)  
**Baseline Policy**: `WP/project-management-country-kobo-v2` & `INDEPENDENT-REVIEW-2026-09-21.md`  
**Gate Status**: **Production Migration Hold Active** (Read-Only Inspection; Zero unverified schema or data mutations).

---

## 1. Principles of Reconciliation
1. **No Blanket Permission**: Global programme membership (e.g. SoilFER central team) does not convey blanket permission across sovereign national projects or isolated laboratories.
2. **Explicit Owner-Junction Disambiguation**:
   - Explicit known owner-junction rows (`UserProject` / `UserLab`) must be distinguished from central servicing staff.
   - Missing junction rows for verified local personnel must be reconciled against explicit mandate letters or national coordinator confirmations, not inferred by user country string alone.
3. **Fail-Closed Isolation**: Unverified mappings remain unresolved. If a user record lacks explicit verified project association, access fails closed with HTTP 403.
4. **Governed Execution**: Any proposed database update script must be generated as a discrete, reviewable SQL change-set with SHA-256 backup verification, dry-run simulation, and automated rollback before production execution.

---

## 2. Read-Only Discrepancy & Mapping Ledger

| User Identifier | Role | User Country Claim | Assigned Laboratory | Explicit Project Junctions | Servicing Status | Reconciliation Finding | Recommended Action | Gate Status |
|---|---|---|---|---|---|---|---|---|
| `admin` | `SUPER_ADMIN` | Global (`*`) | `N/A (Central)` | Full (`*`) | System Root | Explicit central administration | Retain global supervisory scope | Verified |
| `luis.gtm` | `LAB_MANAGER` | `GTM` | `LAB-GTM-01` | `PROJ-GTM-SOILFER` | National | Verified Guatemala lab manager; explicit project junction matches lab mandate | Retain explicit junction; confirm servicing status | Verified |
| `tech.gtm.01` | `LAB_TECHNICIAN`| `GTM` | `LAB-GTM-01` | `PROJ-GTM-SOILFER` | National | Verified Guatemala bench technician | Retain explicit junction | Verified |
| `audit.hq` | `AUDIT_USER` | Global (`*`) | `N/A (Central)` | View-Only Audit | Central QA | Read-only global audit scope | Maintain read-only QA boundaries | Verified |
| `unresolved.user.01` | `PROJECT_MANAGER`| `HND` | `Unassigned` | Missing | Ambiguous | User claims HND country but lacks verified national project junction row | **Do not guess**. Keep unverified; await country coordinator sign-off | **Blocked / Hold** |
| `unresolved.user.02` | `LAB_MANAGER` | `RWA` | `Unassigned` | Missing | Ambiguous | User claims RWA country but lab association unconfirmed | **Do not guess**. Keep unverified; await Rwanda coordinator sign-off | **Blocked / Hold** |

---

## 3. Before vs. After Authorization Comparison

### Before (Legacy Permissive Fallback)
- Legacy heuristic: If `user.country === project.country`, access was granted implicitly without junction record verification.
- Defect: Led to cross-programme leakage when multiple projects existed within the same country, or when users transferred duties without profile update.

### After (Enforced Explicit Scope Guards - WP Checkpoint `e2fff7e`)
- Pure explicit authorization:
  1. Access requires matching explicit entry in `UserProject` junction table OR explicit manager authority in `lab.projects`.
  2. `scopeGuard.js` verifies active user status, non-empty lab for lab-bound roles, and deep country matching for multi-country roles.
  3. Client-supplied authorization bypass claims are stripped at HTTP trust boundary.
  4. Unmapped users receive truthful empty datasets or HTTP 403 `FORBIDDEN` without data disclosure.

---

## 4. Production Execution Gate & Rollback Plan
- **Backup Verification**: `pg_dump / sqlite3 .dump` with SHA-256 conservation digest prior to any migration.
- **Dry-Run Script**: Must execute in sandbox transaction with rollback confirmation.
- **Rollback Procedure**: Revert to checkpoint snapshot without data alteration to analytical results or audit trails.
