'use strict';

const crypto = require('crypto');
const prisma = require('../prisma');
const { ALL_ROLES, ALLOWED_SUB_ROLES, getPermissionsForRole } = require('../config/roles');
const { canManageUser, POLICY_CODES } = require('./actionPolicyService');
const { JWT_SECRET } = require('../config/auth');
const { getUnfinishedWorkWhere, UNFINISHED_WORK_STATUSES } = require('./workEligibility');


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
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_staff_invitation_active_email"
            ON "StaffInvitation" ("email")
            WHERE "isConsumed" = 0 AND "isRevoked" = 0;
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

const txHookRegistry = new WeakMap();

/**
 * Registers an after-commit hook with the transaction owner.
 * Returns true if successfully registered, or false if the outer transaction
 * contract does not support an explicit afterCommit mechanism.
 */
function registerAfterCommit(outerTx, options, hook) {
    if (outerTx && txHookRegistry.has(outerTx)) {
        txHookRegistry.get(outerTx).push(hook);
        return true;
    }
    if (outerTx && typeof outerTx.afterCommit === 'function') {
        outerTx.afterCommit(hook);
        return true;
    }
    if (outerTx && Array.isArray(outerTx.afterCommit)) {
        outerTx.afterCommit.push(hook);
        return true;
    }
    if (options && typeof options.afterCommit === 'function') {
        options.afterCommit(hook);
        return true;
    }
    if (options && Array.isArray(options.afterCommit)) {
        options.afterCommit.push(hook);
        return true;
    }
    return false;
}

/**
 * Executes a transaction and runs registered afterCommit hooks only upon successful commit.
 * If the transaction rolls back or throws, afterCommit hooks are never executed.
 */
async function withTransaction(callback) {
    const afterCommitHooks = [];
    const result = await prisma.$transaction(async (tx) => {
        txHookRegistry.set(tx, afterCommitHooks);
        tx.afterCommit = (hook) => {
            if (typeof hook === 'function') {
                afterCommitHooks.push(hook);
            }
        };
        try {
            return await callback(tx);
        } finally {
            try { delete tx.afterCommit; } catch (_) {}
            txHookRegistry.delete(tx);
        }
    });
    for (const hook of afterCommitHooks) {
        try {
            await hook();
        } catch (e) {
            console.error('[staffLifecycleService] Error executing afterCommit hook:', e);
        }
    }
    return result;
}

/**
 * Creates a pending staff invitation.
 */
async function createInvitation(actor, { name, email, role, labId, projects, reissue = false }, outerTx = null) {
    await ensureTables(outerTx || prisma);
    const run = async (tx) => {

        if (!actor || actor.isActive === false) {
            const err = new Error('Actor account is inactive or missing');
            err.statusCode = 401;
            err.code = 'UNAUTHORIZED';
            throw err;
        }

        if (!email || !role || !labId) {
            const err = new Error('email, role, and labId are required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const resolvedName = (name && typeof name === 'string' && name.trim()) ? name.trim() : (email.trim().split('@')[0] || 'Staff');

        // Verify role is valid
        if (!ALL_ROLES.includes(role)) {
            const err = new Error(`Invalid role '${role}'`);
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        // Resolve target lab first before authorization
        const targetLab = await tx.lab.findUnique({ where: { id: labId } });
        if (!targetLab) {
            const err = new Error(`Laboratory '${labId}' not found`);
            err.statusCode = 404;
            err.code = 'LAB_NOT_FOUND';
            throw err;
        }

        // Role hierarchy & lab scoping with targetLab country
        const decision = canManageUser(
            actor,
            { role, labId, labCountry: targetLab.country, country: targetLab.country },
            { role, labId, proposedLabCountry: targetLab.country, labCountry: targetLab.country }
        );
        if (!decision.allowed) {
            const err = new Error(decision.message);
            err.statusCode = 403;
            err.code = decision.code;
            throw err;
        }

        // Check target lab operational status
        const { getLabOperationalState } = require('./labLifecycleService');
        const opState = await getLabOperationalState(labId, tx);
        if (opState.operationalStatus === 'PAUSED') {
            const err = new Error('Laboratory is currently inactive or paused.');
            err.statusCode = 400;
            err.code = 'LAB_PAUSED';
            throw err;
        }
        if (opState.operationalStatus === 'RETIRED') {
            const err = new Error('Laboratory is retired.');
            err.statusCode = 400;
            err.code = 'LAB_RETIRED';
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

        // Revoke any expired unconsumed invitations for this email so they don't block
        await tx.$executeRawUnsafe(
            `UPDATE "StaffInvitation" SET "isRevoked" = 1
             WHERE "email" = ? AND "isConsumed" = 0 AND "expiresAt" <= CURRENT_TIMESTAMP`,
            normalizedEmail
        );

        // Check existing pending live invitation collision
        const existingPending = await tx.$queryRawUnsafe(
            `SELECT "id", "email", "name", "role", "labId", "expiresAt"
             FROM "StaffInvitation"
             WHERE "email" = ? AND "isConsumed" = 0 AND "isRevoked" = 0 AND "expiresAt" > CURRENT_TIMESTAMP
             LIMIT 1`,
            normalizedEmail
        );

        if (existingPending && existingPending.length > 0) {
            if (reissue) {
                // Safely revoke the prior pending invitation
                await tx.$executeRawUnsafe(
                    `UPDATE "StaffInvitation" SET "isRevoked" = 1 WHERE "id" = ?`,
                    existingPending[0].id
                );
            } else {
                const err = new Error('An active invitation for this email already exists. Reissue or revoke the existing invitation.');
                err.statusCode = 409;
                err.code = 'PENDING_INVITATION_EXISTS';
                err.existingInvitationId = existingPending[0].id;
                throw err;
            }
        }

        // Validate requested projects against canonical authority
        let approvedProjects = [];
        if (projects) {
            const rawProjects = Array.isArray(projects)
                ? projects
                : (typeof projects === 'string' ? (() => {
                    try {
                        const parsed = JSON.parse(projects);
                        return Array.isArray(parsed) ? parsed : [projects];
                    } catch {
                        return [projects];
                    }
                })() : []);

            const requestedProjectCodes = rawProjects
                .filter(p => p && typeof p === 'string')
                .map(p => p.trim())
                .filter(Boolean);

            if (requestedProjectCodes.length > 0) {
                const { resolveProjectLabs } = require('./projectMembershipService');
                for (const pCode of requestedProjectCodes) {
                    const proj = await tx.project.findFirst({
                        where: {
                            OR: [
                                { code: pCode },
                                { id: pCode }
                            ]
                        }
                    });
                    if (!proj) {
                        const err = new Error(`Project '${pCode}' not found`);
                        err.statusCode = 404;
                        err.code = 'PROJECT_NOT_FOUND';
                        throw err;
                    }

                    let canAssign = false;
                    if (actor.role === 'SUPER_ADMIN') {
                        canAssign = true;
                    } else if (actor.role === 'MASTER_USER') {
                        const countries = Array.isArray(actor.countries)
                            ? actor.countries
                            : (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : []);
                        const labCountries = [];
                        if (proj.labId) {
                            const pLab = await tx.lab.findUnique({ where: { id: proj.labId } });
                            if (pLab?.country) labCountries.push(pLab.country);
                        }
                        canAssign = labCountries.some(c => countries.includes(c));
                    } else if (actor.role === 'LAB_MANAGER') {
                        const relations = await resolveProjectLabs(proj, tx);
                        canAssign = relations.isMember(actor.labId);
                    }

                    if (!canAssign) {
                        const err = new Error(`Cannot assign project '${pCode}' outside actor laboratory or country scope`);
                        err.statusCode = 403;
                        err.code = 'PROJECT_OUTSIDE_SCOPE';
                        throw err;
                    }

                    approvedProjects.push(proj.code);
                }
            }
        }

        // Generate random single-use token (24h expiry)
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const inviteId = 'inv_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const projectsJson = approvedProjects.length > 0 ? JSON.stringify(approvedProjects) : null;

        try {
            await tx.$executeRawUnsafe(
                `INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "projects", "tokenHash", "expiresAt", "createdBy")
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                inviteId,
                normalizedEmail,
                resolvedName,
                role,
                labId,
                projectsJson,
                tokenHash,
                expiresAt.toISOString(),
                actor.username
            );
        } catch (dbErr) {
            if (dbErr.message && (dbErr.message.includes('UNIQUE constraint failed') || dbErr.message.includes('idx_staff_invitation_active_email'))) {
                const err = new Error('An active invitation for this email already exists. Reissue or revoke the existing invitation.');
                err.statusCode = 409;
                err.code = 'PENDING_INVITATION_EXISTS';
                throw err;
            }
            throw dbErr;
        }

        // Audit log with collision-safe UUID in the same transaction
        await tx.auditLog.create({
            data: {
                id: `audit-inv-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: inviteId,
                action: 'INVITE_CREATED',
                details: `Created pending invitation for ${normalizedEmail} with role ${role} in lab ${labId}${approvedProjects.length > 0 ? ' with projects: ' + JSON.stringify(approvedProjects) : ''}`,
                performedBy: actor.username,
                labId: labId,
                timestamp: new Date()
            }
        });

        return {
            id: inviteId,
            email: normalizedEmail,
            name: resolvedName,
            role,
            labId,
            projects: approvedProjects,
            expiresAt,
            deliveryStatus: 'LINK_GENERATED',
            token: rawToken,
            activationLink: `/activate?token=${rawToken}`,
            activationUrl: `/activate?token=${rawToken}`
        };
    };

    if (outerTx && outerTx !== prisma) return run(outerTx);
    return prisma.$transaction(run);
}

function normalizeChanges(changes = {}) {
    return {
        role: changes.role || null,
        labId: changes.labId || null,
        projects: changes.projects ? (Array.isArray(changes.projects) ? [...changes.projects].sort() : changes.projects) : null,
        countries: changes.countries ? (Array.isArray(changes.countries) ? [...changes.countries].sort() : changes.countries) : null
    };
}

/**
 * Validates a signed access review token.
 */
function verifyReviewToken(reviewToken, actorId, targetId, expectedChanges, currentTargetVersion) {
    if (!reviewToken || typeof reviewToken !== 'string' || !reviewToken.includes('.')) {
        return { valid: false, reason: 'Malformed review token' };
    }
    const parts = reviewToken.split('.');
    if (parts.length !== 2) {
        return { valid: false, reason: 'Invalid review token structure' };
    }
    const [sig, b64] = parts;
    let payload;
    try {
        payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
        return { valid: false, reason: 'Invalid payload encoding' };
    }
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET || 'secret').update(JSON.stringify(payload)).digest('hex');
    if (sig !== expectedSig) {
        return { valid: false, reason: 'Invalid signature' };
    }
    if (!payload.ts || (Date.now() - payload.ts) > 15 * 60 * 1000) {
        return { valid: false, reason: 'Review token expired' };
    }
    if (payload.actorId !== actorId) {
        return { valid: false, reason: 'Actor mismatch' };
    }
    if (payload.targetId !== targetId) {
        return { valid: false, reason: 'Target mismatch' };
    }
    if (currentTargetVersion !== undefined && payload.targetVersion !== undefined) {
        if (Number(currentTargetVersion) !== Number(payload.targetVersion)) {
            return { valid: false, reason: `Stale review token: target version changed from ${payload.targetVersion} to ${currentTargetVersion}` };
        }
    }
    if (expectedChanges !== undefined) {
        const pNorm = normalizeChanges(payload.changes || {});
        const eNorm = normalizeChanges(expectedChanges);
        if (JSON.stringify(pNorm) !== JSON.stringify(eNorm)) {
            return { valid: false, reason: 'Altered payload: requested changes do not match reviewed changes' };
        }
    }
    return { valid: true, payload };
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

    let targetLab = null;
    if (targetUser.labId) {
        targetLab = await tx.lab.findUnique({ where: { id: targetUser.labId } });
    }
    let proposedLab = null;
    if (changes.labId) {
        proposedLab = await tx.lab.findUnique({ where: { id: changes.labId } });
    }

    const decision = canManageUser(
        actor,
        { ...targetUser, labCountry: targetLab?.country },
        { ...changes, proposedLabCountry: proposedLab?.country }
    );
    if (!decision.allowed) {
        const err = new Error(decision.message);
        err.statusCode = 403;
        err.code = decision.code;
        throw err;
    }

    // Count open work assignments
    const openAssignmentsCount = await tx.workItem.count({
        where: getUnfinishedWorkWhere(targetUser.username)
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
        changes: normalizeChanges(changes),
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
async function applyAccessChanges(actor, targetUserId, options = {}, outerTx = null) {
    const { changes = {}, reviewToken, reason } = options;
    const run = async (tx) => {
        const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
            const err = new Error('Target user not found');
            err.statusCode = 404;
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        // Validate role against ALL_ROLES
        if (changes.role) {
            if (!ALL_ROLES.includes(changes.role)) {
                const err = new Error(`Invalid role '${changes.role}'`);
                err.statusCode = 400;
                err.code = 'INVALID_ROLE';
                throw err;
            }
        }

        // Validate lab existence
        let proposedLab = null;
        if (changes.labId) {
            proposedLab = await tx.lab.findUnique({ where: { id: changes.labId } });
            if (!proposedLab) {
                const err = new Error(`Laboratory '${changes.labId}' not found`);
                err.statusCode = 400;
                err.code = 'LAB_NOT_FOUND';
                throw err;
            }
        }

        let targetLab = null;
        if (targetUser.labId) {
            targetLab = await tx.lab.findUnique({ where: { id: targetUser.labId } });
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

        const decision = canManageUser(
            actor,
            { ...targetUser, labCountry: targetLab?.country },
            { ...changes, proposedLabCountry: proposedLab?.country }
        );
        if (!decision.allowed) {
            const err = new Error(decision.message);
            err.statusCode = 403;
            err.code = decision.code;
            throw err;
        }

        const openCount = await tx.workItem.count({
            where: getUnfinishedWorkWhere(targetUser.username)
        });

        // Review token verification (IR-03)
        if (reviewToken) {
            const tokenCheck = verifyReviewToken(reviewToken, actor.id, targetUser.id, changes, targetUser.tokenVersion || 0);
            if (!tokenCheck.valid) {
                const err = new Error(`Review token verification failed: ${tokenCheck.reason}`);
                err.statusCode = 400;
                err.code = 'INVALID_REVIEW_TOKEN';
                throw err;
            }
        } else {
            if (openCount > 0 && changes.role && changes.role !== targetUser.role) {
                const err = new Error(`Cannot change role with ${openCount} open assignments without a valid access review token`);
                err.statusCode = 400;
                err.code = 'REVIEW_TOKEN_REQUIRED';
                throw err;
            }
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

        await tx.auditLog.create({
            data: {
                id: `audit-access-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: targetUserId,
                action: 'ACCESS_CHANGED',
                details: `Access updated by ${actor.username}. Reason: ${reason || 'Access review'}. Changes: ${JSON.stringify(changes)}`,
                performedBy: actor.username,
                timestamp: new Date()
            }
        });

        const safeUser = { ...updatedUser };
        delete safeUser.password;

        return {
            user: safeUser,
            status: 'APPLIED',
            openAssignmentsCount: openCount,
            warnings: openCount > 0 ? [`Staff member has ${openCount} unfinished work items needing reassignment`] : []
        };
    };

    if (outerTx && outerTx !== prisma) {
        const registered = registerAfterCommit(outerTx, options, () => {
            try {
                const wsServer = require('../wsServer');
                wsServer.revokeUserSockets(targetUserId);
            } catch (e) {}
        });
        if (!registered) {
            const err = new Error('Unsupported outer transaction contract: transaction owner must provide an explicit afterCommit hook to ensure session revocation after commit');
            err.statusCode = 500;
            err.code = 'UNSUPPORTED_TRANSACTION_CONTRACT';
            throw err;
        }
        return run(outerTx);
    }
    const result = await prisma.$transaction(run);
    try {
        const wsServer = require('../wsServer');
        wsServer.revokeUserSockets(targetUserId);
    } catch (e) {}
    return result;
}

/**
 * Suspends a user account.
 */
async function suspendUser(actor, targetUserId, options = {}, outerTx = null) {
    const { reason } = options;
    const run = async (tx) => {
        const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
            const err = new Error('Target user not found');
            err.statusCode = 404;
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        // Last Super Admin guard INSIDE the transaction
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

        let targetLab = null;
        if (targetUser.labId) {
            targetLab = await tx.lab.findUnique({ where: { id: targetUser.labId } });
        }

        const decision = canManageUser(actor, { ...targetUser, labCountry: targetLab?.country });
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
            where: getUnfinishedWorkWhere(targetUser.username)
        });

        await tx.auditLog.create({
            data: {
                id: `audit-susp-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: targetUserId,
                action: 'USER_SUSPENDED',
                details: `Suspended by ${actor.username}. Reason: ${reason || 'Administrative action'}`,
                performedBy: actor.username,
                timestamp: new Date()
            }
        });

        const safeUser = { ...updatedUser };
        delete safeUser.password;

        return {
            user: safeUser,
            status: 'SUSPENDED',
            openAssignmentsToReassign: openCount
        };
    };

    if (outerTx && outerTx !== prisma) {
        const registered = registerAfterCommit(outerTx, options, () => {
            try {
                const wsServer = require('../wsServer');
                wsServer.revokeUserSockets(targetUserId);
            } catch (e) {}
        });
        if (!registered) {
            const err = new Error('Unsupported outer transaction contract: transaction owner must provide an explicit afterCommit hook to ensure session revocation after commit');
            err.statusCode = 500;
            err.code = 'UNSUPPORTED_TRANSACTION_CONTRACT';
            throw err;
        }
        return run(outerTx);
    }
    const result = await prisma.$transaction(run);
    try {
        const wsServer = require('../wsServer');
        wsServer.revokeUserSockets(targetUserId);
    } catch (e) {}
    return result;
}

/**
 * Reactivates a suspended user account.
 */
async function reactivateUser(actor, targetUserId, outerTx = null) {
    const run = async (tx) => {
        const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
            const err = new Error('Target user not found');
            err.statusCode = 404;
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        let targetLab = null;
        if (targetUser.labId) {
            targetLab = await tx.lab.findUnique({ where: { id: targetUser.labId } });
        }

        const decision = canManageUser(actor, { ...targetUser, labCountry: targetLab?.country });
        if (!decision.allowed) {
            const err = new Error(decision.message);
            err.statusCode = 403;
            err.code = decision.code;
            throw err;
        }

        // Check if user's laboratory is active
        if (targetUser.labId) {
            const lab = targetLab || await tx.lab.findUnique({ where: { id: targetUser.labId } });
            if (lab && lab.isActive === false) {
                const err = new Error(`Cannot reactivate user: Assigned laboratory '${targetUser.labId}' is currently inactive or suspended`);
                err.statusCode = 400;
                err.code = 'LAB_PAUSED';
                throw err;
            }
        }

        const updatedUser = await tx.user.update({
            where: { id: targetUserId },
            data: {
                isActive: true,
                tokenVersion: { increment: 1 }
            }
        });

        await tx.auditLog.create({
            data: {
                id: `audit-react-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: targetUserId,
                action: 'USER_REACTIVATED',
                details: `Reactivated by ${actor.username}`,
                performedBy: actor.username,
                timestamp: new Date()
            }
        });

        const safeUser = { ...updatedUser };
        delete safeUser.password;

        return {
            user: safeUser,
            status: 'ACTIVE'
        };
    };

    if (outerTx && outerTx !== prisma) {
        return run(outerTx);
    }
    return prisma.$transaction(run);
}

/**
 * Issues an emergency single-use recovery grant.
 */
async function createRecoveryGrant(actor, targetUserId, options = {}, outerTx = null) {
    const { reason } = options;
    const run = async (tx) => {
        await ensureTables(tx);

        const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
            const err = new Error('Target user not found');
            err.statusCode = 404;
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        let targetLab = null;
        if (targetUser.labId) {
            targetLab = await tx.lab.findUnique({ where: { id: targetUser.labId } });
        }

        const decision = canManageUser(actor, { ...targetUser, labCountry: targetLab?.country });
        if (!decision.allowed) {
            const err = new Error(decision.message);
            err.statusCode = 403;
            err.code = decision.code;
            throw err;
        }

        // Revoke existing grants
        await tx.$executeRawUnsafe(
            `UPDATE "StaffRecoveryGrant" SET "isRevoked" = 1 WHERE "userId" = ? AND "isConsumed" = 0`,
            targetUserId
        );

        const grantId = `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes default

        await tx.$executeRawUnsafe(
            `INSERT INTO "StaffRecoveryGrant" ("id", "userId", "tokenHash", "expiresAt", "createdBy")
             VALUES (?, ?, ?, ?, ?)`,
            grantId,
            targetUserId,
            tokenHash,
            expiresAt.toISOString(),
            actor.username
        );

        await tx.auditLog.create({
            data: {
                id: `audit-rec-${Date.now()}-${crypto.randomUUID()}`,
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
            token: rawToken,
            recoveryLink: `/reset-password?token=${rawToken}`,
            recoveryUrl: `/reset-password?token=${rawToken}`
        };
    };

    if (outerTx && outerTx !== prisma) {
        const registered = registerAfterCommit(outerTx, options, () => {
            try {
                const wsServer = require('../wsServer');
                wsServer.revokeUserSockets(targetUserId);
            } catch (e) {}
        });
        if (!registered) {
            const err = new Error('Unsupported outer transaction contract: transaction owner must provide an explicit afterCommit hook to ensure session revocation after commit');
            err.statusCode = 500;
            err.code = 'UNSUPPORTED_TRANSACTION_CONTRACT';
            throw err;
        }
        return run(outerTx);
    }
    const result = await prisma.$transaction(run);
    try {
        const wsServer = require('../wsServer');
        wsServer.revokeUserSockets(targetUserId);
    } catch (e) {}
    return result;
}

/**
 * Verifies an invitation token and returns non-sensitive metadata for onboarding UI.
 */
async function verifyInvitationToken(rawToken, tx = prisma) {
    await ensureTables(tx);
    if (!rawToken || typeof rawToken !== 'string') {
        const err = new Error('Invalid token');
        err.statusCode = 400;
        err.code = 'INVALID_TOKEN';
        throw err;
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const rows = await tx.$queryRawUnsafe(
        `SELECT "id", "email", "name", "role", "labId", "projects", "expiresAt", "isConsumed", "isRevoked"
         FROM "StaffInvitation" WHERE "tokenHash" = ? LIMIT 1`,
        tokenHash
    );
    if (!rows || rows.length === 0) {
        const err = new Error('Invitation not found or invalid');
        err.statusCode = 404;
        err.code = 'INVITATION_NOT_FOUND';
        throw err;
    }
    const invite = rows[0];
    if (invite.isConsumed) {
        const err = new Error('Invitation has already been consumed');
        err.statusCode = 410;
        err.code = 'INVITATION_ALREADY_CONSUMED';
        throw err;
    }
    if (invite.isRevoked) {
        const err = new Error('Invitation has been revoked');
        err.statusCode = 410;
        err.code = 'INVITATION_REVOKED';
        throw err;
    }
    if (new Date(invite.expiresAt) < new Date()) {
        const err = new Error('Invitation has expired');
        err.statusCode = 410;
        err.code = 'INVITATION_EXPIRED';
        throw err;
    }

    const lab = await tx.lab.findUnique({
        where: { id: invite.labId },
        select: { id: true, name: true, code: true, country: true, isActive: true }
    });

    let parsedProjects = [];
    if (invite.projects) {
        try {
            parsedProjects = typeof invite.projects === 'string' ? JSON.parse(invite.projects) : invite.projects;
        } catch (_) {}
    }

    return {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        labId: invite.labId,
        projects: parsedProjects,
        labName: lab?.name || invite.labId,
        expiresAt: invite.expiresAt
    };
}

/**
 * Consumes an invitation token and registers the new user account.
 */
async function consumeInvitation(rawToken, { username, password }, outerTx = null) {
    const bcrypt = require('bcryptjs');
    const run = async (tx) => {
        await ensureTables(tx);
        const metadata = await verifyInvitationToken(rawToken, tx);

        if (!username || !username.trim() || username.length < 3) {
            const err = new Error('Username must be at least 3 characters long');
            err.statusCode = 400;
            err.code = 'INVALID_USERNAME';
            throw err;
        }
        if (!password || password.length < 8) {
            const err = new Error('Password must be at least 8 characters long');
            err.statusCode = 400;
            err.code = 'INVALID_PASSWORD';
            throw err;
        }

        const normalizedUsername = username.trim().toLowerCase();
        const existingUser = await tx.user.findFirst({
            where: {
                OR: [
                    { username: normalizedUsername },
                    { email: metadata.email }
                ]
            }
        });
        if (existingUser) {
            const err = new Error(existingUser.username === normalizedUsername ? 'Username already taken' : 'An account with this email already exists');
            err.statusCode = 409;
            err.code = 'IDENTITY_CONFLICT';
            throw err;
        }

        const { getLabOperationalState } = require('./labLifecycleService');
        const opState = await getLabOperationalState(metadata.labId, tx);
        if (opState.operationalStatus === 'RETIRED') {
            const err = new Error('Cannot activate staff in a retired laboratory');
            err.statusCode = 400;
            err.code = 'LAB_RETIRED';
            throw err;
        }
        if (opState.operationalStatus === 'PAUSED') {
            const err = new Error('Cannot activate staff in a paused laboratory');
            err.statusCode = 400;
            err.code = 'LAB_PAUSED';
            throw err;
        }

        let userProjectsJson = '[]';
        if (metadata.projects && Array.isArray(metadata.projects) && metadata.projects.length > 0) {
            // Re-validate against database
            const validProjects = await tx.project.findMany({
                where: { code: { in: metadata.projects } },
                select: { code: true }
            });
            const validCodes = validProjects.map(p => p.code);
            userProjectsJson = JSON.stringify(validCodes);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

        const newUser = await tx.user.create({
            data: {
                id: userId,
                username: normalizedUsername,
                name: metadata.name,
                email: metadata.email,
                password: hashedPassword,
                role: metadata.role,
                labId: metadata.labId,
                projects: userProjectsJson,
                isActive: true,
                tokenVersion: 1
            }
        });

        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await tx.$executeRawUnsafe(
            `UPDATE "StaffInvitation" SET "isConsumed" = 1, "consumedAt" = CURRENT_TIMESTAMP WHERE "tokenHash" = ?`,
            tokenHash
        );

        await tx.auditLog.create({
            data: {
                id: `audit-inv-cons-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: userId,
                action: 'INVITATION_CONSUMED',
                details: `User ${newUser.username} registered via invitation ${metadata.id}`,
                performedBy: newUser.username,
                labId: metadata.labId,
                timestamp: new Date()
            }
        });

        const safeUser = { ...newUser };
        delete safeUser.password;
        safeUser.projects = typeof newUser.projects === 'string' ? JSON.parse(newUser.projects) : (newUser.projects || []);
        return safeUser;
    };

    if (outerTx && outerTx !== prisma) return run(outerTx);
    return prisma.$transaction(run);
}

/**
 * Verifies a password recovery grant token.
 */
async function verifyRecoveryToken(rawToken, tx = prisma) {
    await ensureTables(tx);
    if (!rawToken || typeof rawToken !== 'string') {
        const err = new Error('Invalid token');
        err.statusCode = 400;
        err.code = 'INVALID_TOKEN';
        throw err;
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const rows = await tx.$queryRawUnsafe(
        `SELECT "id", "userId", "expiresAt", "isConsumed", "isRevoked"
         FROM "StaffRecoveryGrant" WHERE "tokenHash" = ? LIMIT 1`,
        tokenHash
    );
    if (!rows || rows.length === 0) {
        const err = new Error('Recovery grant not found or invalid');
        err.statusCode = 404;
        err.code = 'GRANT_NOT_FOUND';
        throw err;
    }
    const grant = rows[0];
    if (grant.isConsumed) {
        const err = new Error('Recovery grant has already been used');
        err.statusCode = 410;
        err.code = 'GRANT_ALREADY_CONSUMED';
        throw err;
    }
    if (grant.isRevoked) {
        const err = new Error('Recovery grant has been revoked');
        err.statusCode = 410;
        err.code = 'GRANT_REVOKED';
        throw err;
    }
    if (new Date(grant.expiresAt) < new Date()) {
        const err = new Error('Recovery grant has expired');
        err.statusCode = 410;
        err.code = 'GRANT_EXPIRED';
        throw err;
    }

    const user = await tx.user.findUnique({
        where: { id: grant.userId },
        select: { id: true, username: true, name: true, email: true }
    });
    if (!user) {
        const err = new Error('Associated user account not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    return {
        id: grant.id,
        user
    };
}

/**
 * Consumes a recovery grant and resets the user password.
 */
async function consumeRecoveryGrant(rawToken, { newPassword }, outerTx = null) {
    const bcrypt = require('bcryptjs');
    const run = async (tx) => {
        await ensureTables(tx);
        const { user } = await verifyRecoveryToken(rawToken, tx);

        if (!newPassword || newPassword.length < 8) {
            const err = new Error('Password must be at least 8 characters long');
            err.statusCode = 400;
            err.code = 'INVALID_PASSWORD';
            throw err;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await tx.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                tokenVersion: { increment: 1 }
            }
        });

        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await tx.$executeRawUnsafe(
            `UPDATE "StaffRecoveryGrant" SET "isConsumed" = 1, "consumedAt" = CURRENT_TIMESTAMP WHERE "tokenHash" = ?`,
            tokenHash
        );

        await tx.auditLog.create({
            data: {
                id: `audit-rec-cons-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: user.id,
                action: 'PASSWORD_RECOVERED',
                details: `User ${user.username} recovered password using recovery grant`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        return { success: true, username: user.username };
    };

    if (outerTx && outerTx !== prisma) return run(outerTx);
    return prisma.$transaction(run);
}

/**
 * Returns pending invitations for a laboratory.
 * Enforces canonical actor scoping:
 * - SUPER_ADMIN can view any lab.
 * - MASTER_USER can view labs in authorized countries.
 * - LAB_MANAGER can only view invitations in their own lab.
 */
async function getPendingInvitations(actor, labId, tx = prisma) {
    await ensureTables(tx);

    if (!actor || actor.isActive === false) {
        const err = new Error('Actor account is inactive or missing');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
    }

    if (!labId) {
        const err = new Error('labId is required');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    const lab = await tx.lab.findUnique({ where: { id: labId } });
    if (!lab) {
        const err = new Error(`Laboratory '${labId}' not found`);
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }

    let allowed = false;
    if (actor.role === 'SUPER_ADMIN') {
        allowed = true;
    } else if (actor.role === 'MASTER_USER') {
        const countries = Array.isArray(actor.countries)
            ? actor.countries
            : (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : []);
        if (countries.includes(lab.country)) {
            allowed = true;
        }
    } else if (actor.role === 'LAB_MANAGER' && actor.labId === labId) {
        allowed = true;
    }

    if (!allowed) {
        const err = new Error(`Unauthorized to view invitations for laboratory '${labId}'`);
        err.statusCode = 403;
        err.code = 'TARGET_OUTSIDE_SCOPE';
        throw err;
    }

    const invitations = await tx.$queryRawUnsafe(
        `SELECT "id", "email", "name", "role", "labId", "projects", "expiresAt", "createdAt", "createdBy"
         FROM "StaffInvitation"
         WHERE "labId" = ? AND "isConsumed" = 0 AND "isRevoked" = 0 AND "expiresAt" > CURRENT_TIMESTAMP
         ORDER BY "createdAt" DESC`,
        labId
    );

    return invitations.map(inv => {
        let parsedProjects = [];
        if (inv.projects) {
            try {
                parsedProjects = typeof inv.projects === 'string' ? JSON.parse(inv.projects) : inv.projects;
            } catch (_) {}
        }
        return {
            id: inv.id,
            email: inv.email,
            name: inv.name,
            role: inv.role,
            labId: inv.labId,
            projects: parsedProjects,
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt,
            createdBy: inv.createdBy,
            deliveryStatus: 'MANUAL_LINK',
            isExpired: false
        };
    });
}

/**
 * Revokes an existing invitation.
 * Enforces canonical authority checks on actor vs target invitation/lab.
 */
async function revokeInvitation(actor, invitationId, options = {}, outerTx = null) {
    await ensureTables(outerTx || prisma);
    const run = async (tx) => {

        if (!actor || actor.isActive === false) {
            const err = new Error('Actor account is inactive or missing');
            err.statusCode = 401;
            err.code = 'UNAUTHORIZED';
            throw err;
        }

        if (!invitationId) {
            const err = new Error('invitationId is required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        const rows = await tx.$queryRawUnsafe(
            `SELECT "id", "email", "name", "role", "labId", "isConsumed", "isRevoked"
             FROM "StaffInvitation" WHERE "id" = ?`,
            invitationId
        );

        if (!rows || rows.length === 0) {
            const err = new Error(`Invitation '${invitationId}' not found`);
            err.statusCode = 404;
            err.code = 'INVITATION_NOT_FOUND';
            throw err;
        }

        const invitation = rows[0];

        if (invitation.isConsumed) {
            const err = new Error('Cannot revoke an invitation that has already been consumed');
            err.statusCode = 400;
            err.code = 'INVITATION_ALREADY_CONSUMED';
            throw err;
        }

        const targetLab = await tx.lab.findUnique({ where: { id: invitation.labId } });

        // Authority check
        const decision = canManageUser(
            actor,
            { role: invitation.role, labId: invitation.labId, labCountry: targetLab?.country },
            { role: invitation.role, labId: invitation.labId }
        );

        if (!decision.allowed) {
            const err = new Error(decision.message || 'Unauthorized to revoke this invitation');
            err.statusCode = 403;
            err.code = decision.code || 'TARGET_OUTSIDE_SCOPE';
            throw err;
        }

        await tx.$executeRawUnsafe(
            `UPDATE "StaffInvitation" SET "isRevoked" = 1 WHERE "id" = ?`,
            invitationId
        );

        await tx.auditLog.create({
            data: {
                id: `audit-inv-rev-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: invitationId,
                action: 'INVITE_REVOKED',
                details: `Revoked invitation for ${invitation.email} (role: ${invitation.role}, lab: ${invitation.labId}) by ${actor.username}. Reason: ${options.reason || 'Manual revocation'}`,
                performedBy: actor.username,
                labId: invitation.labId,
                timestamp: new Date()
            }
        });

        return { success: true, invitationId, revokedEmail: invitation.email };
    };

    if (outerTx && outerTx !== prisma) return run(outerTx);
    return prisma.$transaction(run);
}

/**
 * Reissues an invitation: revokes the previous token and generates a new active invitation.
 */
async function reissueInvitation(actor, invitationId, options = {}, outerTx = null) {
    await ensureTables(outerTx || prisma);
    const run = async (tx) => {

        if (!actor || actor.isActive === false) {
            const err = new Error('Actor account is inactive or missing');
            err.statusCode = 401;
            err.code = 'UNAUTHORIZED';
            throw err;
        }

        if (!invitationId) {
            const err = new Error('invitationId is required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        const rows = await tx.$queryRawUnsafe(
            `SELECT "id", "email", "name", "role", "labId", "projects", "isConsumed", "isRevoked"
             FROM "StaffInvitation" WHERE "id" = ?`,
            invitationId
        );

        if (!rows || rows.length === 0) {
            const err = new Error(`Invitation '${invitationId}' not found`);
            err.statusCode = 404;
            err.code = 'INVITATION_NOT_FOUND';
            throw err;
        }

        const existing = rows[0];

        if (existing.isConsumed) {
            const err = new Error('Cannot reissue an invitation that has already been consumed');
            err.statusCode = 400;
            err.code = 'INVITATION_ALREADY_CONSUMED';
            throw err;
        }

        const targetLab = await tx.lab.findUnique({ where: { id: existing.labId } });

        const decision = canManageUser(
            actor,
            { role: existing.role, labId: existing.labId, labCountry: targetLab?.country },
            { role: existing.role, labId: existing.labId }
        );

        if (!decision.allowed) {
            const err = new Error(decision.message || 'Unauthorized to reissue this invitation');
            err.statusCode = 403;
            err.code = decision.code || 'TARGET_OUTSIDE_SCOPE';
            throw err;
        }

        // Revoke all prior pending invitations for this email
        await tx.$executeRawUnsafe(
            `UPDATE "StaffInvitation" SET "isRevoked" = 1 WHERE "email" = ? AND "isConsumed" = 0`,
            existing.email
        );

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const newInviteId = 'inv_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await tx.$executeRawUnsafe(
            `INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "projects", "tokenHash", "expiresAt", "createdBy")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            newInviteId,
            existing.email,
            existing.name,
            existing.role,
            existing.labId,
            existing.projects,
            tokenHash,
            expiresAt.toISOString(),
            actor.username
        );

        await tx.auditLog.create({
            data: {
                id: `audit-inv-reis-${Date.now()}-${crypto.randomUUID()}`,
                entity: 'USER',
                entityId: newInviteId,
                action: 'INVITE_REISSUED',
                details: `Reissued invitation for ${existing.email} (superseded: ${invitationId}) by ${actor.username}`,
                performedBy: actor.username,
                labId: existing.labId,
                timestamp: new Date()
            }
        });

        let parsedProjects = [];
        if (existing.projects) {
            try {
                parsedProjects = typeof existing.projects === 'string' ? JSON.parse(existing.projects) : existing.projects;
            } catch (_) {}
        }

        return {
            id: newInviteId,
            email: existing.email,
            name: existing.name,
            role: existing.role,
            labId: existing.labId,
            projects: parsedProjects,
            expiresAt,
            deliveryStatus: 'LINK_GENERATED',
            token: rawToken,
            activationLink: `/activate?token=${rawToken}`,
            activationUrl: `/activate?token=${rawToken}`
        };
    };

    if (outerTx && outerTx !== prisma) return run(outerTx);
    return prisma.$transaction(run);
}

module.exports = {
    withTransaction,
    createInvitation,
    verifyInvitationToken,
    consumeInvitation,
    getAccessPreview,
    applyAccessChanges,
    suspendUser,
    reactivateUser,
    createRecoveryGrant,
    verifyRecoveryToken,
    consumeRecoveryGrant,
    getPendingInvitations,
    revokeInvitation,
    reissueInvitation,
    UNFINISHED_WORK_STATUSES,
    getUnfinishedWorkWhere
};
