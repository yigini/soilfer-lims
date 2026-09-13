'use strict';

/**
 * Controlled Staff Invitation Conflict Resolution Utility (Report 15 & 16)
 * 
 * Provides an explicit, strictly validated, audited resolution path for duplicate active staff invitations:
 * 1. Read-only conflict detection and preflight reporting (findInvitationConflicts).
 * 2. Strict pre-validation: every conflict must have an explicit plan with an authorized action ('retain' or 'revoke_all'),
 *    a non-empty reason, and a valid retainId matching an actual conflicting invitation.
 * 3. Zero implicit fallbacks: missing or invalid plans throw before any mutation occurs.
 * 4. Atomic transactional execution: all revocations and audit log entries commit together or roll back completely.
 */

const crypto = require('crypto');

function findInvitationConflicts(db) {
    const rows = db.prepare(`
        SELECT id, email, name, role, labId, projects, expiresAt, isConsumed, isRevoked, createdAt, createdBy
        FROM "StaffInvitation"
        WHERE isConsumed = 0 AND isRevoked = 0
        ORDER BY email, createdAt
    `).all();

    const now = Date.now();
    const grouped = new Map();

    for (const row of rows) {
        const norm = (row.email || '').trim().toLowerCase();
        if (!norm) continue;
        if (!grouped.has(norm)) grouped.set(norm, []);
        const exp = new Date(row.expiresAt).getTime();
        const isExpired = Number.isFinite(exp) ? exp <= now : false;
        grouped.get(norm).push({
            ...row,
            normalizedEmail: norm,
            isExpired
        });
    }

    const conflicts = [];
    for (const [normEmail, invites] of grouped.entries()) {
        if (invites.length > 1) {
            const activeUnexpired = invites.filter(i => !i.isExpired);
            const roles = new Set(invites.map(i => i.role));
            const labs = new Set(invites.map(i => i.labId));
            const hasDifferingGrants = roles.size > 1 || labs.size > 1;

            conflicts.push({
                email: normEmail,
                totalCount: invites.length,
                activeCount: activeUnexpired.length,
                expiredCount: invites.length - activeUnexpired.length,
                hasDifferingGrants,
                invitations: invites
            });
        }
    }

    return conflicts;
}

/**
 * Resolves conflicting active invitations using explicit, pre-validated resolution plans.
 * 
 * @param {object} db better-sqlite3 database connection
 * @param {object} resolutions map of email -> { action: 'retain' | 'revoke_all', retainId?: string, reason: string }
 * @param {string} actor user identifier performing the audited resolution
 * @returns {Array} array of resolution outcomes
 */
function resolveConflicts(db, resolutions = {}, actor = 'SYSTEM_ADMIN') {
    if (!actor || typeof actor !== 'string' || !actor.trim()) {
        throw new Error('An authorized actor identity is required for conflict resolution.');
    }

    const conflicts = findInvitationConflicts(db);
    if (conflicts.length === 0) {
        return [];
    }

    // Step 1: Strict preflight validation of all plans before ANY database mutation
    const validatedPlans = new Map();

    for (const conflict of conflicts) {
        const email = conflict.email;
        const plan = resolutions[email];

        if (!plan || typeof plan !== 'object') {
            throw new Error(`Missing explicit resolution plan for conflicting email "${email}". No default action is permitted.`);
        }

        if (!plan.reason || typeof plan.reason !== 'string' || !plan.reason.trim()) {
            throw new Error(`Non-empty justification reason is required for resolving conflict for "${email}".`);
        }

        if (plan.action !== 'retain' && plan.action !== 'revoke_all') {
            throw new Error(`Invalid action "${plan.action}" for "${email}". Allowed actions are 'retain' or 'revoke_all'.`);
        }

        if (plan.action === 'retain') {
            if (!plan.retainId || typeof plan.retainId !== 'string' || !plan.retainId.trim()) {
                throw new Error(`A valid retainId is required when action is 'retain' for "${email}".`);
            }
            const matchingInvite = conflict.invitations.find(i => i.id === plan.retainId.trim());
            if (!matchingInvite) {
                throw new Error(`retainId "${plan.retainId}" does not match any existing conflicting invitation for "${email}".`);
            }
            validatedPlans.set(email, {
                action: 'retain',
                retainId: plan.retainId.trim(),
                reason: plan.reason.trim(),
                conflict
            });
        } else if (plan.action === 'revoke_all') {
            validatedPlans.set(email, {
                action: 'revoke_all',
                reason: plan.reason.trim(),
                conflict
            });
        }
    }

    // Step 2: Atomic transactional execution
    const resolvedSummary = [];

    db.transaction(() => {
        for (const [email, validated] of validatedPlans.entries()) {
            const { action, conflict, reason } = validated;

            if (action === 'retain') {
                const toRevoke = conflict.invitations.filter(i => i.id !== validated.retainId);
                for (const inv of toRevoke) {
                    db.prepare('UPDATE "StaffInvitation" SET isRevoked = 1 WHERE id = ?').run(inv.id);
                }

                const auditId = 'audit-conf-res-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                db.prepare(`
                    INSERT INTO "AuditLog" (id, entity, entityId, action, details, performedBy, timestamp)
                    VALUES (?, 'USER', ?, 'INVITATION_CONFLICT_RESOLVED', ?, ?, CURRENT_TIMESTAMP)
                `).run(
                    auditId,
                    validated.retainId,
                    `Audited conflict resolution: retained invitation ${validated.retainId} for ${email}; revoked ${toRevoke.length} conflicting invitation(s). Reason: ${reason}`,
                    actor.trim()
                );

                resolvedSummary.push({
                    email,
                    action: 'retain',
                    retainedId: validated.retainId,
                    revokedCount: toRevoke.length
                });
            } else if (action === 'revoke_all') {
                for (const inv of conflict.invitations) {
                    db.prepare('UPDATE "StaffInvitation" SET isRevoked = 1 WHERE id = ?').run(inv.id);
                }

                const auditId = 'audit-conf-revall-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                db.prepare(`
                    INSERT INTO "AuditLog" (id, entity, entityId, action, details, performedBy, timestamp)
                    VALUES (?, 'USER', ?, 'INVITATION_CONFLICT_RESOLVED', ?, ?, CURRENT_TIMESTAMP)
                `).run(
                    auditId,
                    email,
                    `Audited conflict resolution: revoked all ${conflict.invitations.length} conflicting invitations for ${email}. Fresh reviewed invitation required. Reason: ${reason}`,
                    actor.trim()
                );

                resolvedSummary.push({
                    email,
                    action: 'revoke_all',
                    revokedCount: conflict.invitations.length
                });
            }
        }
    })();

    return resolvedSummary;
}

module.exports = {
    findInvitationConflicts,
    resolveConflicts
};
