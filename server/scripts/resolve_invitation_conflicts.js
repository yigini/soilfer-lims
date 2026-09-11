'use strict';

/**
 * Controlled Staff Invitation Conflict Resolution Utility (Report 15)
 * 
 * Provides an explicit, audited resolution path for duplicate active staff invitations:
 * 1. Read-only conflict detection and preflight reporting.
 * 2. Normalization of emails and accurate expiration handling.
 * 3. Audited resolution: preserves chosen intended invitation or revokes all to allow fresh issuance.
 * 4. Safe application of partial unique index after conflict resolution.
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

function resolveConflicts(db, resolutions = {}, actor = 'SYSTEM_ADMIN') {
    const conflicts = findInvitationConflicts(db);
    const resolvedSummary = [];

    db.transaction(() => {
        for (const conflict of conflicts) {
            const email = conflict.email;
            const plan = resolutions[email] || { action: 'auto_expire_or_revoke_all' };

            if (plan.action === 'retain' && plan.retainId) {
                // Retain specific reviewed invitation, revoke all others for this email
                const toRevoke = conflict.invitations.filter(i => i.id !== plan.retainId);
                for (const inv of toRevoke) {
                    db.prepare('UPDATE "StaffInvitation" SET isRevoked = 1 WHERE id = ?').run(inv.id);
                }

                const auditId = 'audit-conf-res-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                db.prepare(`
                    INSERT INTO "AuditLog" (id, entity, entityId, action, details, performedBy, timestamp)
                    VALUES (?, 'USER', ?, 'INVITATION_CONFLICT_RESOLVED', ?, ?, CURRENT_TIMESTAMP)
                `).run(
                    auditId,
                    plan.retainId,
                    `Retained invitation ${plan.retainId} for ${email}; revoked ${toRevoke.length}. Reason: ${plan.reason || 'Reviewed manual retention'}`,
                    actor
                );

                resolvedSummary.push({ email, action: 'retain', retainedId: plan.retainId, revokedCount: toRevoke.length });
            } else if (plan.action === 'revoke_all') {
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
                    `Revoked all ${conflict.invitations.length} conflicting invitations for ${email}. Fresh reviewed invitation required. Reason: ${plan.reason || 'Admin reset'}`,
                    actor
                );

                resolvedSummary.push({ email, action: 'revoke_all', revokedCount: conflict.invitations.length });
            } else {
                const expired = conflict.invitations.filter(i => i.isExpired);
                for (const inv of expired) {
                    db.prepare('UPDATE "StaffInvitation" SET isRevoked = 1 WHERE id = ?').run(inv.id);
                }

                const remainingActive = conflict.invitations.filter(i => !i.isExpired);
                if (remainingActive.length === 1) {
                    const auditId = 'audit-conf-exp-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                    db.prepare(`
                        INSERT INTO "AuditLog" (id, entity, entityId, action, details, performedBy, timestamp)
                        VALUES (?, 'USER', ?, 'INVITATION_CONFLICT_RESOLVED', ?, ?, CURRENT_TIMESTAMP)
                    `).run(
                        auditId,
                        remainingActive[0].id,
                        `Expired ${expired.length} stale duplicate invitations for ${email}; retained sole active unexpired invitation ${remainingActive[0].id}`,
                        actor
                    );
                    resolvedSummary.push({ email, action: 'expired_duplicates', retainedId: remainingActive[0].id, revokedCount: expired.length });
                } else if (remainingActive.length > 1) {
                    for (const inv of remainingActive) {
                        db.prepare('UPDATE "StaffInvitation" SET isRevoked = 1 WHERE id = ?').run(inv.id);
                    }
                    const auditId = 'audit-conf-saferev-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                    db.prepare(`
                        INSERT INTO "AuditLog" (id, entity, entityId, action, details, performedBy, timestamp)
                        VALUES (?, 'USER', ?, 'INVITATION_CONFLICT_RESOLVED', ?, ?, CURRENT_TIMESTAMP)
                    `).run(
                        auditId,
                        email,
                        `Revoked ${remainingActive.length} active conflicting invitations for ${email} with differing grants. Fresh invitation required.`,
                        actor
                    );
                    resolvedSummary.push({ email, action: 'revoked_conflicting', revokedCount: remainingActive.length });
                }
            }
        }
    })();

    return resolvedSummary;
}

module.exports = {
    findInvitationConflicts,
    resolveConflicts
};
