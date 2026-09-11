'use strict';

const crypto = require('crypto');
const prisma = require('../prisma');
const { JWT_SECRET } = require('../config/auth');
const { getUnfinishedWorkWhere, UNFINISHED_WORK_STATUSES } = require('./workEligibility');


let tableInitialized = false;

async function ensureTables(tx = prisma) {
    if (tableInitialized) return;
    try {
        await tx.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "LabLifecycleState" (
                "labId" TEXT PRIMARY KEY,
                "operationalStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
                "revision" INTEGER DEFAULT 1,
                "pauseReason" TEXT,
                "pausedAt" DATETIME,
                "pausedBy" TEXT,
                "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        tableInitialized = true;
    } catch (err) {
        console.warn('[LabLifecycle] ensureTables notice:', err.message);
    }
}

const VALID_STATES = ['SETUP', 'ACTIVE', 'PAUSED', 'RETIRED'];

const INACTIVE_SAMPLE_STATUSES = [
    'EXPECTED',
    'DRAFT',
    'COLLECTED',
    'RELEASED',
    'APPROVED',
    'COMPLETED',
    'ARCHIVED',
    'DISPOSED',
    'RECEIVED_REJECTED',
    'REJECTED'
];

function isSampleActiveInWorkload(status) {
    if (!status) return false;
    return !INACTIVE_SAMPLE_STATUSES.includes(status);
}

/**
 * Resolves current operational state and revision for a lab.
 */
async function getLabOperationalState(labId, tx = prisma) {
    await ensureTables(tx);
    const rows = await tx.$queryRawUnsafe(
        `SELECT "operationalStatus", "revision", "pauseReason", "pausedAt", "pausedBy"
         FROM "LabLifecycleState" WHERE "labId" = ? LIMIT 1`,
        labId
    );
    if (rows && rows.length > 0) {
        return rows[0];
    }
    // Fallback: check lab isActive
    const lab = await tx.lab.findUnique({ where: { id: labId }, select: { isActive: true } });
    const status = (lab && lab.isActive) ? 'ACTIVE' : 'PAUSED';
    return {
        operationalStatus: status,
        revision: 1,
        pauseReason: null,
        pausedAt: null,
        pausedBy: null
    };
}

/**
 * Resolves full workspace details, counts, configuration gaps and capabilities.
 */
async function getLabWorkspace(actor, labId, tx = prisma) {
    await ensureTables(tx);

    const lab = await tx.lab.findUnique({
        where: { id: labId }
    });
    if (!lab) {
        const err = new Error(`Laboratory '${labId}' not found`);
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }

    // Authorization check
    let isAuthorized = false;
    let isNationalLead = false;
    if (actor.role === 'SUPER_ADMIN') {
        isAuthorized = true;
    } else if (actor.role === 'MASTER_USER') {
        const countries = Array.isArray(actor.countries)
            ? actor.countries
            : (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : []);
        if (countries.includes(lab.country)) {
            isAuthorized = true;
            isNationalLead = true;
        }
    } else if (actor.labId === labId) {
        isAuthorized = true;
    }

    if (!isAuthorized) {
        const err = new Error('Unauthorized to access this laboratory workspace');
        err.statusCode = 403;
        err.code = 'TARGET_OUTSIDE_SCOPE';
        throw err;
    }

    const state = await getLabOperationalState(labId, tx);

    // Compute parallel workload counts
    const [
        totalSamples,
        activeSamples,
        expectedSamples,
        receivedSamples,
        inAnalysisSamples,
        reviewSamples,
        releasedSamples,
        totalWorkItems,
        openWorkItems,
        completedWorkItems,
        totalStaff,
        activeStaff,
        responsibleManager,
        totalEquipment
    ] = await Promise.all([
        tx.sample.count({ where: { assignedLab: labId } }),
        tx.sample.count({ where: { assignedLab: labId, status: { notIn: INACTIVE_SAMPLE_STATUSES } } }),
        tx.sample.count({ where: { assignedLab: labId, status: { in: ['EXPECTED', 'DRAFT', 'COLLECTED'] } } }),
        tx.sample.count({ where: { assignedLab: labId, status: { in: ['RECEIVED', 'ACCEPTED'] } } }),
        tx.sample.count({ where: { assignedLab: labId, status: { in: ['IN_ANALYSIS', 'PROCESSING', 'ANALYZING', 'PREPARATION', 'PARTIALLY_COMPLETE'] } } }),
        tx.sample.count({ where: { assignedLab: labId, status: { in: ['REVIEW', 'PENDING_APPROVAL', 'SUBMITTED_PARTIAL', 'SUBMITTED_FULL'] } } }),
        tx.sample.count({ where: { assignedLab: labId, status: { in: ['RELEASED', 'APPROVED', 'COMPLETED'] } } }),
        tx.workItem.count({ where: { labId } }),
        tx.workItem.count({ where: getUnfinishedWorkWhere(null, labId) }),
        tx.workItem.count({ where: { labId, status: { in: ['COMPLETED', 'ACCEPTED', 'APPROVED'] } } }),
        tx.user.count({ where: { labId } }),
        tx.user.count({ where: { labId, isActive: true } }),
        tx.user.findFirst({
            where: { labId, role: 'LAB_MANAGER', isActive: true },
            select: { id: true, name: true, username: true, email: true }
        }),
        tx.equipmentAsset ? tx.equipmentAsset.count({ where: { labId } }) : Promise.resolve(0)
    ]);

    // Configuration attention flags
    const attention = [];
    if (!lab.timezone) attention.push({ code: 'MISSING_TIMEZONE', message: 'Laboratory IANA time zone is not configured' });
    if (!responsibleManager) attention.push({ code: 'NO_ACTIVE_MANAGER', message: 'No active responsible Laboratory Manager assigned' });
    if (!lab.country) attention.push({ code: 'MISSING_COUNTRY', message: 'Country designation is required' });
    if (!lab.email && !lab.phone) attention.push({ code: 'MISSING_CONTACT', message: 'No contact phone or email recorded' });

    // Management capabilities
    const isOwnManager = actor.role === 'LAB_MANAGER' && actor.labId === labId;
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';

    const capabilities = {
        canManageProfile: isSuperAdmin || isOwnManager,
        canManageLifecycle: isSuperAdmin,
        canManageStaff: isSuperAdmin || isOwnManager || isNationalLead,
        canManageProjects: isSuperAdmin || isOwnManager
    };

    // Fetch staff roster with open task counts
    const staffUsers = await tx.user.findMany({
        where: { labId },
        select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            labId: true,
            countries: true,
            projects: true,
            isActive: true,
            createdAt: true
        },
        orderBy: { username: 'asc' }
    });

    const openWorkCounts = await tx.workItem.groupBy({
        by: ['assignedTo'],
        where: {
            ...getUnfinishedWorkWhere(null, labId),
            assignedTo: { in: staffUsers.map(u => u.username).filter(Boolean) }
        },
        _count: { _all: true }
    });
    const countMap = {};
    for (const row of openWorkCounts) {
        if (row.assignedTo) countMap[row.assignedTo] = row._count._all;
    }
    const staff = staffUsers.map(u => ({
        ...u,
        openWorkCount: countMap[u.username] || 0
    }));

    // Fetch projects served by this laboratory (owned, ProjectLab junction, or assignedLabIds)
    const junctionRecords = await tx.projectLab.findMany({
        where: { labId },
        select: { projectCode: true }
    });
    const junctionProjectCodes = new Set(junctionRecords.map(j => j.projectCode).filter(Boolean));

    const allProjects = await tx.project.findMany({
        where: { status: { not: 'DELETED' } },
        select: {
            id: true,
            code: true,
            name: true,
            status: true,
            labId: true,
            assignedLabIds: true,
            createdAt: true
        }
    });
    const projects = allProjects.filter(p => {
        if (p.labId === labId) return true;
        if (junctionProjectCodes.has(p.code)) return true;
        try {
            const assigned = JSON.parse(p.assignedLabIds || '[]');
            return Array.isArray(assigned) && assigned.includes(labId);
        } catch {
            return false;
        }
    }).map(p => ({
        ...p,
        isOwned: p.labId === labId
    }));

    const workload = {
        samples: {
            total: totalSamples,
            active: activeSamples,
            expected: expectedSamples,
            received: receivedSamples,
            inAnalysis: inAnalysisSamples,
            review: reviewSamples,
            released: releasedSamples
        },
        workItems: {
            total: totalWorkItems,
            open: openWorkItems,
            completed: completedWorkItems
        },
        staff: {
            total: totalStaff,
            active: activeStaff
        },
        equipment: {
            total: totalEquipment
        }
    };

    return {
        lab: {
            id: lab.id,
            code: lab.code,
            name: lab.name,
            country: lab.country,
            location: lab.location,
            address: lab.address,
            city: lab.city,
            phone: lab.phone,
            email: lab.email,
            website: lab.website,
            capacity: lab.capacity,
            timezone: lab.timezone || 'UTC',
            notes: (capabilities.canManageProfile ? lab.notes : undefined),
            isActive: lab.isActive
        },
        operationalStatus: state.operationalStatus,
        revision: state.revision,
        pauseReason: state.pauseReason,
        pausedAt: state.pausedAt,
        pausedBy: state.pausedBy,
        responsibleManager,
        staff,
        projects,
        workload,
        counts: workload,
        attention,
        capabilities
    };
}

/**
 * Updates laboratory profile details with strict allowlist.
 */
async function updateLabProfile(actor, labId, updates = {}, tx = prisma) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isOwnManager = actor.role === 'LAB_MANAGER' && actor.labId === labId;

    if (!isSuperAdmin && !isOwnManager) {
        const err = new Error('Unauthorized to update this laboratory profile');
        err.statusCode = 403;
        err.code = 'TARGET_OUTSIDE_SCOPE';
        throw err;
    }

    // Rejection of immutable or lifecycle fields
    const forbiddenKeys = ['id', 'code', 'isActive', 'operationalStatus', 'createdAt', 'projectCode'];
    const bodyKeys = Object.keys(updates);
    const attemptedForbidden = bodyKeys.filter(k => forbiddenKeys.includes(k));
    if (attemptedForbidden.length > 0) {
        const err = new Error(`Cannot alter immutable or lifecycle fields: ${attemptedForbidden.join(', ')}`);
        err.statusCode = 400;
        err.code = 'IMMUTABLE_FIELDS_REJECTED';
        throw err;
    }

    const {
        name, country, location, address, city, phone, email, website,
        capacity, timezone, notes
    } = updates;

    const data = {};
    if (name !== undefined) {
        if (!name || typeof name !== 'string' || !name.trim()) {
            const err = new Error('Laboratory name must be a non-empty string');
            err.statusCode = 400;
            err.code = 'INVALID_NAME';
            throw err;
        }
        data.name = name.trim();
    }

    if (timezone !== undefined) {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            data.timezone = timezone;
        } catch (e) {
            const err = new Error(`Invalid IANA time zone identifier: '${timezone}'`);
            err.statusCode = 400;
            err.code = 'INVALID_TIMEZONE';
            throw err;
        }
    }

    if (capacity !== undefined) {
        const parsed = parseInt(capacity, 10);
        if (isNaN(parsed) || parsed < 0) {
            const err = new Error('Capacity must be a non-negative integer');
            err.statusCode = 400;
            err.code = 'INVALID_CAPACITY';
            throw err;
        }
        data.capacity = parsed;
    }

    if (country !== undefined) data.country = country;
    if (location !== undefined) data.location = location;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (website !== undefined) data.website = website;
    if (notes !== undefined && isSuperAdmin) data.notes = notes;

    const updated = await tx.lab.update({
        where: { id: labId },
        data
    });

    await tx.auditLog.create({
        data: {
            id: 'audit-lab-prof-' + Date.now(),
            entity: 'LAB',
            entityId: labId,
            action: 'UPDATE_PROFILE',
            details: `Updated fields: ${Object.keys(data).join(', ')}`,
            performedBy: actor.username,
            labId,
            timestamp: new Date()
        }
    });

    return updated;
}

/**
 * Previews the operational and data impact of transitioning a laboratory state.
 */
async function getLifecyclePreview(actor, labId, targetState, tx = prisma) {
    await ensureTables(tx);

    if (actor.role !== 'SUPER_ADMIN') {
        const err = new Error('Only Super Administrators can modify laboratory operational status');
        err.statusCode = 403;
        err.code = 'INSUFFICIENT_PERMISSIONS';
        throw err;
    }

    if (!VALID_STATES.includes(targetState)) {
        const err = new Error(`Invalid operational status '${targetState}'. Allowed: ${VALID_STATES.join(', ')}`);
        err.statusCode = 400;
        err.code = 'INVALID_OPERATIONAL_STATUS';
        throw err;
    }

    const lab = await tx.lab.findUnique({ where: { id: labId } });
    if (!lab) {
        const err = new Error('Laboratory not found');
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }

    const currentState = await getLabOperationalState(labId, tx);

    const [openAssignmentsCount, pendingSamplesCount, activeStaffCount] = await Promise.all([
        tx.workItem.count({ where: getUnfinishedWorkWhere(null, labId) }),
        tx.sample.count({ where: { assignedLab: labId, status: { notIn: INACTIVE_SAMPLE_STATUSES } } }),
        tx.user.count({ where: { labId, isActive: true } })
    ]);

    const warnings = [];
    if (targetState === 'PAUSED') {
        warnings.push('Pausing will prevent new sample intake, work assignments, and result entry.');
        if (openAssignmentsCount > 0) {
            warnings.push(`${openAssignmentsCount} active work items are currently assigned and will be halted.`);
        }
    } else if (targetState === 'RETIRED') {
        warnings.push('Retiring will place the laboratory in permanent read-only mode.');
        if (openAssignmentsCount > 0) {
            warnings.push(`CRITICAL: ${openAssignmentsCount} open work items must be completed or reassigned prior to retirement.`);
        }
        if (pendingSamplesCount > 0) {
            warnings.push(`${pendingSamplesCount} samples are currently pending or in-analysis.`);
        }
    }

    const tokenPayload = {
        actorId: actor.id,
        labId,
        currentState: currentState.operationalStatus,
        targetState,
        revision: currentState.revision,
        ts: Date.now()
    };
    const reviewToken = crypto.createHmac('sha256', JWT_SECRET || 'secret').update(JSON.stringify(tokenPayload)).digest('hex') + '.' + Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    return {
        labId,
        currentStatus: currentState.operationalStatus,
        targetStatus: targetState,
        revision: currentState.revision,
        openAssignmentsCount,
        pendingSamplesCount,
        activeStaffCount,
        warnings,
        reviewToken
    };
}

function verifyLabReviewToken(token, actorId, labId, targetState, currentRevision) {
    if (!token || typeof token !== 'string') {
        return { valid: false, code: 'REVIEW_TOKEN_REQUIRED', error: 'Review token is required' };
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
        return { valid: false, code: 'INVALID_REVIEW_TOKEN', error: 'Malformed review token' };
    }
    const [signature, payloadBase64] = parts;
    try {
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET || 'secret').update(payloadJson).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
            return { valid: false, code: 'INVALID_REVIEW_TOKEN', error: 'Invalid review token signature' };
        }
        const payload = JSON.parse(payloadJson);
        if (!payload.ts || (Date.now() - payload.ts) > 15 * 60 * 1000) {
            return { valid: false, code: 'INVALID_REVIEW_TOKEN', error: 'Review token has expired' };
        }
        if (payload.actorId !== actorId) {
            return { valid: false, code: 'INVALID_REVIEW_TOKEN', error: 'Review token actor mismatch' };
        }
        if (payload.labId !== labId) {
            return { valid: false, code: 'INVALID_REVIEW_TOKEN', error: 'Review token laboratory mismatch' };
        }
        if (targetState && payload.targetState !== targetState) {
            return { valid: false, code: 'INVALID_REVIEW_TOKEN', error: 'Review token target state mismatch' };
        }
        if (currentRevision !== undefined && payload.revision !== undefined) {
            if (Number(currentRevision) !== Number(payload.revision)) {
                return { valid: false, code: 'STALE_TARGET_REVISION', error: 'Target laboratory revision has changed since preview was generated' };
            }
        }
        return { valid: true, payload };
    } catch {
        return { valid: false, code: 'INVALID_REVIEW_TOKEN', error: 'Failed to verify review token' };
    }
}

/**
 * Commits a laboratory operational lifecycle state transition.
 * Executes atomically inside a real database transaction.
 */
async function transitionLifecycle(actor, labId, { targetState, reason, reviewToken }, tx = null) {
    if (!tx || tx === prisma) {
        return prisma.$transaction(async (innerTx) => {
            return _executeTransitionLifecycle(actor, labId, { targetState, reason, reviewToken }, innerTx);
        });
    }
    return _executeTransitionLifecycle(actor, labId, { targetState, reason, reviewToken }, tx);
}

async function _executeTransitionLifecycle(actor, labId, { targetState, reason, reviewToken }, tx) {
    await ensureTables(tx);

    if (actor.role !== 'SUPER_ADMIN') {
        const err = new Error('Only Super Administrators can modify laboratory operational status');
        err.statusCode = 403;
        err.code = 'INSUFFICIENT_PERMISSIONS';
        throw err;
    }

    if (!reviewToken || typeof reviewToken !== 'string' || !reviewToken.trim()) {
        const err = new Error('Review token is required to transition laboratory lifecycle. Request a preview first.');
        err.statusCode = 400;
        err.code = 'REVIEW_TOKEN_REQUIRED';
        throw err;
    }

    const currentState = await getLabOperationalState(labId, tx);

    const tokenVerification = verifyLabReviewToken(reviewToken, actor.id, labId, targetState, currentState?.revision);
    if (!tokenVerification.valid) {
        const err = new Error(tokenVerification.error || 'Invalid, altered, or expired review token');
        err.statusCode = tokenVerification.code === 'STALE_TARGET_REVISION' ? 409 : 400;
        err.code = tokenVerification.code || 'INVALID_REVIEW_TOKEN';
        throw err;
    }

    if (!VALID_STATES.includes(targetState)) {
        const err = new Error(`Invalid operational status '${targetState}'. Allowed: ${VALID_STATES.join(', ')}`);
        err.statusCode = 400;
        err.code = 'INVALID_OPERATIONAL_STATUS';
        throw err;
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
        const err = new Error('A documented reason is required to transition laboratory lifecycle');
        err.statusCode = 400;
        err.code = 'REASON_REQUIRED';
        throw err;
    }

    const lab = await tx.lab.findUnique({ where: { id: labId } });
    if (!lab) {
        const err = new Error('Laboratory not found');
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }

    const newRevision = (currentState.revision || 1) + 1;
    const isLabActive = targetState === 'ACTIVE';

    // Invariant: Retirement safety gate
    if (targetState === 'RETIRED') {
        const openCount = await tx.workItem.count({ where: getUnfinishedWorkWhere(null, labId) });
        if (openCount > 0) {
            const err = new Error(`Cannot retire laboratory with ${openCount} unfinished work assignments`);
            err.statusCode = 422;
            err.code = 'UNRESOLVED_WORK_ITEMS';
            throw err;
        }
    }

    // 1. Update Lab table isActive (strictly does NOT touch User.isActive)
    await tx.lab.update({
        where: { id: labId },
        data: { isActive: isLabActive }
    });

    // 2. Upsert LabLifecycleState with new revision
    await tx.$executeRawUnsafe(`
        INSERT INTO "LabLifecycleState" ("labId", "operationalStatus", "revision", "pauseReason", "pausedAt", "pausedBy", "updatedAt")
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT("labId") DO UPDATE SET
            "operationalStatus" = excluded."operationalStatus",
            "revision" = excluded."revision",
            "pauseReason" = excluded."pauseReason",
            "pausedAt" = excluded."pausedAt",
            "pausedBy" = excluded."pausedBy",
            "updatedAt" = CURRENT_TIMESTAMP
    `,
        labId,
        targetState,
        newRevision,
        targetState === 'PAUSED' ? reason.trim() : null,
        targetState === 'PAUSED' ? new Date().toISOString() : null,
        targetState === 'PAUSED' ? actor.username : null
    );

    // 3. Audit log (collision-safe unique ID)
    const commandId = 'cmd-lab-lc-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const auditId = 'audit-lc-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    await tx.auditLog.create({
        data: {
            id: auditId,
            entity: 'LAB',
            entityId: labId,
            action: 'LIFECYCLE_TRANSITION',
            details: `Transitioned from ${currentState.operationalStatus} to ${targetState}. Reason: ${reason.trim()}`,
            performedBy: actor.username,
            labId,
            timestamp: new Date()
        }
    });

    return {
        commandId,
        status: 'APPLIED',
        labId,
        previousState: currentState.operationalStatus,
        operationalStatus: targetState,
        isActive: isLabActive,
        revision: newRevision,
        reason: reason.trim()
    };
}

module.exports = {
    VALID_STATES,
    getLabOperationalState,
    getLabWorkspace,
    updateLabProfile,
    getLifecyclePreview,
    transitionLifecycle,
    verifyLabReviewToken
};
