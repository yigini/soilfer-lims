'use strict';

const crypto = require('crypto');
const prisma = require('../prisma');
const { ALL_ROLES, ALLOWED_SUB_ROLES, getPermissionsForRole } = require('../config/roles');
const { canManageUser, POLICY_CODES } = require('./actionPolicyService');
const { JWT_SECRET } = require('../config/auth');

let tablesInitialized = false;

async function ensureTables(tx = prisma) {
    if (tablesInitialized) return;
    try {
        await tx.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "StaffInvitation" (
                "id" TEXT PRIMARY KEY,
                "email" TEXT NOT NULL,
                "name" TEXT NOT NULL,
                "role" TEXT NOT NULL,
                "labId" TEXT NOT NULL,
                "projects" TEXT,
                "tokenHash" TEXT NOT NULL UNIQUE,
                "expiresAt" DATETIME NOT NULL,
                "isConsumed" BOOLEAN DEFAULT 0,
                "isRevoked" BOOLEAN DEFAULT 0,
                "createdBy" TEXT NOT NULL,
                "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
                "consumedAt" DATETIME
            );
        `);

        await tx.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "StaffRecoveryGrant" (
                "id" TEXT PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "tokenHash" TEXT NOT NULL UNIQUE,
                "expiresAt" DATETIME NOT NULL,
                "isConsumed" BOOLEAN DEFAULT 0,
                "isRevoked" BOOLEAN DEFAULT 0,
                "createdBy" TEXT NOT NULL,
                "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
                "consumedAt" DATETIME
            );
        `);
        tablesInitialized = true;
    } catch (err) {
        console.warn('[StaffLifecycle] ensureTables notice:', err.message);
    }
}

/**
 * Creates a pending staff invitation.
 */
async function createInvitation(actor, { name, email, role, labId, projects }, tx = prisma) {
    await ensureTables(tx);

    if (!actor || actor.isActive === false) {
        const err = new Error('Actor account is inactive or missing');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
    }

    if (!name || !email || !role || !labId) {
        const err = new Error('name, email, role, and labId are required');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify role is valid
    if (!ALL_ROLES.includes(role)) {
        const err = new Error(`Invalid role '${role}'`);
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    // Role hierarchy & lab scoping
    const decision = canManageUser(actor, { role, labId }, { role, labId });
    if (!decision.allowed) {
        const err = new Error(decision.message);
        err.statusCode = 403;
        err.code = decision.code;
        throw err;
    }

    // Check target lab status
    const targetLab = await tx.lab.findUnique({ where: { id: labId } });
    if (!targetLab) {
        const err = new Error(`Laboratory '${labId}' not found`);
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }
    if (targetLab.isActive === false) {
        const err = new Error('Laboratory is currently inactive or paused.');
        err.statusCode = 400;
        err.code = 'LAB_PAUSED';
        throw err;
    }

    // Check existing account collision
    const existing = await tx.user.findFirst({
        where: {
            OR: [
                { email: normalizedEmail },
                { email: email.trim() }
            ]
        }
    });
    if (existing) {
        const err = new Error('Account with this email already exists. Use access review to modify scope.');
        err.statusCode = 409;
        err.code = 'ACCOUNT_ALREADY_EXISTS';
        throw err;
    }

    // Generate random single-use token (24h expiry)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const inviteId = 'inv_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await tx.$executeRawUnsafe(
        `INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "projects", "tokenHash", "expiresAt", "createdBy")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        inviteId,
        normalizedEmail,
        name.trim(),
        role,
        labId,
        projects ? (typeof projects === 'string' ? projects : JSON.stringify(projects)) : null,
        tokenHash,
        expiresAt.toISOString(),
        actor.username
    );

    // Audit log
    await tx.auditLog.create({
        data: {
            id: 'audit-inv-' + Date.now(),
            entity: 'USER',
            entityId: inviteId,
            action: 'INVITE_CREATED',
            details: `Created pending invitation for ${normalizedEmail} with role ${role} in lab ${labId}`,
            performedBy: actor.username,
            timestamp: new Date()
        }
    });

    return {
        id: inviteId,
        email: normalizedEmail,
        name: name.trim(),
        role,
        labId,
        expiresAt,
        deliveryStatus: 'LINK_GENERATED',
        activationLink: `/activate?token=${rawToken}`
    };
}

/**
 * Previews access changes and impact on open work items.
 */
async function getAccessPreview(actor, targetUserId, changes = {}, tx = prisma) {
    const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
        const err = new Error('Target user not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    const decision = canManageUser(actor, targetUser, changes);
    if (!decision.allowed) {
        const err = new Error(decision.message);
        err.statusCode = 403;
        err.code = decision.code;
        throw err;
    }

    // Count open work assignments
    const openAssignmentsCount = await tx.workItem.count({
        where: {
            assignedTo: targetUser.username,
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
        }
    });

    const proposedRole = changes.role || targetUser.role;
    const currentPerms = getPermissionsForRole(targetUser.role);
    const proposedPerms = getPermissionsForRole(proposedRole);

    const capabilitiesGained = proposedPerms.filter(p => !currentPerms.includes(p));
    const capabilitiesLost = currentPerms.filter(p => !proposedPerms.includes(p));

    // Sign review token
    const tokenPayload = {
        actorId: actor.id,
        targetId: targetUser.id,
        targetVersion: targetUser.tokenVersion || 0,
        changes,
        ts: Date.now()
    };
    const reviewToken = crypto.createHmac('sha256', JWT_SECRET || 'secret').update(JSON.stringify(tokenPayload)).digest('hex') + '.' + Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    return {
        targetId: targetUser.id,
        targetUsername: targetUser.username,
        currentRole: targetUser.role,
        proposedRole,
        currentLabId: targetUser.labId,
        proposedLabId: changes.labId || targetUser.labId,
        openAssignmentsCount,
        requiresReassignment: openAssignmentsCount > 0,
        capabilitiesGained,
        capabilitiesLost,
        reviewToken
    };
}

/**
 * Applies access changes with transaction and session revocation.
 */
async function applyAccessChanges(actor, targetUserId, { changes = {}, reviewToken, reason }, tx = prisma) {
    const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
        const err = new Error('Target user not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    // Prohibit demoting the last super-admin
    if (targetUser.role === 'SUPER_ADMIN' && changes.role && changes.role !== 'SUPER_ADMIN') {
        const adminCount = await tx.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
        if (adminCount <= 1) {
            const err = new Error('Cannot demote the last remaining Super Administrator');
            err.statusCode = 403;
            err.code = 'LAST_ADMIN_PROTECTED';
            throw err;
        }
    }

    const decision = canManageUser(actor, targetUser, changes);
    if (!decision.allowed) {
        const err = new Error(decision.message);
        err.statusCode = 403;
        err.code = decision.code;
        throw err;
    }

    const updateData = {};
    if (changes.role) updateData.role = changes.role;
    if (changes.labId) updateData.labId = changes.labId;
    if (changes.projects !== undefined) updateData.projects = typeof changes.projects === 'string' ? changes.projects : JSON.stringify(changes.projects);
    if (changes.countries !== undefined) updateData.countries = typeof changes.countries === 'string' ? changes.countries : JSON.stringify(changes.countries);

    // Increment tokenVersion to invalidate all existing sessions
    updateData.tokenVersion = { increment: 1 };

    const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: updateData
    });

    const openCount = await tx.workItem.count({
        where: {
            assignedTo: targetUser.username,
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
        }
    });

    await tx.auditLog.create({
        data: {
            id: 'audit-access-' + Date.now(),
            entity: 'USER',
            entityId: targetUserId,
            action: 'ACCESS_CHANGED',
            details: `Access updated by ${actor.username}. Reason: ${reason || 'Access review'}. Changes: ${JSON.stringify(changes)}`,
            performedBy: actor.username,
            timestamp: new Date()
        }
    });

    return {
        user: updatedUser,
        status: 'APPLIED',
        openAssignmentsCount: openCount,
        warnings: openCount > 0 ? [`Staff member has ${openCount} unfinished work items needing reassignment`] : []
    };
}

/**
 * Suspends a user account.
 */
async function suspendUser(actor, targetUserId, { reason } = {}, tx = prisma) {
    const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
        const err = new Error('Target user not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    // Last Super Admin guard: Protecting system against zero super admins takes priority
    if (targetUser.role === 'SUPER_ADMIN') {
        const adminCount = await tx.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
        if (adminCount <= 1) {
            const err = new Error('Cannot suspend the last remaining Super Administrator');
            err.statusCode = 403;
            err.code = 'LAST_ADMIN_PROTECTED';
            throw err;
        }
    }

    if (actor.id === targetUserId) {
        const err = new Error('Self-suspension is forbidden');
        err.statusCode = 400;
        err.code = 'SELF_MANAGEMENT_FORBIDDEN';
        throw err;
    }

    const decision = canManageUser(actor, targetUser);
    if (!decision.allowed) {
        const err = new Error(decision.message);
        err.statusCode = 403;
        err.code = decision.code;
        throw err;
    }

    // Update active status and increment tokenVersion to revoke active sessions
    const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: {
            isActive: false,
            tokenVersion: { increment: 1 }
        }
    });

    const openCount = await tx.workItem.count({
        where: {
            assignedTo: targetUser.username,
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
        }
    });

    await tx.auditLog.create({
        data: {
            id: 'audit-susp-' + Date.now(),
            entity: 'USER',
            entityId: targetUserId,
            action: 'USER_SUSPENDED',
            details: `Suspended by ${actor.username}. Reason: ${reason || 'Administrative action'}`,
            performedBy: actor.username,
            timestamp: new Date()
        }
    });

    return {
        user: updatedUser,
        status: 'SUSPENDED',
        openAssignmentsToReassign: openCount
    };
}

/**
 * Reactivates a suspended user account.
 */
async function reactivateUser(actor, targetUserId, tx = prisma) {
    const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
        const err = new Error('Target user not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    const decision = canManageUser(actor, targetUser);
    if (!decision.allowed) {
        const err = new Error(decision.message);
        err.statusCode = 403;
        err.code = decision.code;
        throw err;
    }

    // Verify target laboratory is active
    if (targetUser.labId) {
        const lab = await tx.lab.findUnique({ where: { id: targetUser.labId } });
        if (lab && lab.isActive === false) {
            const err = new Error('Cannot reactivate staff in an inactive or paused laboratory');
            err.statusCode = 400;
            err.code = 'LAB_PAUSED';
            throw err;
        }
    }

    // Increment tokenVersion so previously revoked tokens remain invalid
    const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: {
            isActive: true,
            tokenVersion: { increment: 1 }
        }
    });

    await tx.auditLog.create({
        data: {
            id: 'audit-react-' + Date.now(),
            entity: 'USER',
            entityId: targetUserId,
            action: 'USER_REACTIVATED',
            details: `Reactivated by ${actor.username}`,
            performedBy: actor.username,
            timestamp: new Date()
        }
    });

    return {
        user: updatedUser,
        status: 'ACTIVE'
    };
}

/**
 * Issues a single-use password recovery grant.
 */
async function createRecoveryGrant(actor, targetUserId, { reason } = {}, tx = prisma) {
    await ensureTables(tx);

    const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
        const err = new Error('Target user not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    const decision = canManageUser(actor, targetUser);
    if (!decision.allowed) {
        const err = new Error(decision.message);
        err.statusCode = 403;
        err.code = decision.code;
        throw err;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const grantId = 'rec_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry

    await tx.$executeRawUnsafe(
        `INSERT INTO "StaffRecoveryGrant" ("id", "userId", "tokenHash", "expiresAt", "createdBy")
         VALUES (?, ?, ?, ?, ?)`,
        grantId,
        targetUser.id,
        tokenHash,
        expiresAt.toISOString(),
        actor.username
    );

    // Invalidate existing sessions immediately
    await tx.user.update({
        where: { id: targetUserId },
        data: { tokenVersion: { increment: 1 } }
    });

    await tx.auditLog.create({
        data: {
            id: 'audit-rec-' + Date.now(),
            entity: 'USER',
            entityId: targetUserId,
            action: 'RECOVERY_ISSUED',
            details: `Recovery grant issued by ${actor.username}. Reason: ${reason || 'Password reset requested'}`,
            performedBy: actor.username,
            timestamp: new Date()
        }
    });

    return {
        userId: targetUser.id,
        expiresAt,
        deliveryStatus: 'LINK_GENERATED',
        recoveryLink: `/reset-password?token=${rawToken}`
    };
}

module.exports = {
    createInvitation,
    getAccessPreview,
    applyAccessChanges,
    suspendUser,
    reactivateUser,
    createRecoveryGrant
};
