'use strict';
const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');
const scopeGuard = require('../utils/scopeGuard');
const { recomputeAndPersist } = require('./equipmentQualificationService');
const { hasPermission } = require('../config/roles');
const policyService = require('./policyService');
const { isRootClient } = require('../utils/prismaClientIdentity');
const technicianEventTypes = new Set(require('../../shared/technicianEquipmentEventTypes.json'));
const inputError = (statusCode, inputPayload) => Object.assign(new Error(inputPayload.error), { statusCode, inputPayload });
const inTransaction = (db, work) => isRootClient(db) ? db.$transaction(work) : work(db);

async function addEquipment(user, body, { db = prisma } = {}) {
    const { name, assetType, manufacturer, model, serialNumber, internalAssetTag, criticality, locationId } = body;
    const labId = user.labId;

    if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        throw inputError(403, { error: 'Manager permissions required to register equipment' });
    }

    if (!labId && user.role !== 'SUPER_ADMIN') {
        throw inputError(403, { error: 'Administrative role required to add equipment across labs' });
    }

    let targetLabId = labId;
    if (user.role === 'SUPER_ADMIN') {
        targetLabId = body.labId || labId;
    } else {
        targetLabId = user.labId;
        if (body.labId && body.labId !== user.labId) {
            throw inputError(403, { error: 'Cannot register equipment for another laboratory' });
        }
    }

    const asset = await db.equipmentAsset.create({
        data: {
            id: uuidv4(),
            labId: targetLabId,
            name,
            assetType,
            manufacturer,
            model,
            serialNumber,
            internalAssetTag,
            criticality: criticality || 'IMPORTANT',
            locationId,
            status: 'IN_SERVICE',
            qualification: {
                create: {
                    id: uuidv4(),
                    labId: targetLabId,
                    calibrationStatus: 'NOT_CONFIGURED',
                    verificationStatus: 'NOT_CONFIGURED'
                }
            },
            events: {
                create: {
                    id: uuidv4(),
                    labId: targetLabId,
                    userId: user.username,
                    eventType: 'REGISTER',
                    summary: `Equipment registered: ${name}`,
                    outcome: 'NA'
                }
            }
        }
    });

    return asset;
}

async function updateEquipment(user, params, body, { db = prisma } = {}) {
    const { id } = params;
    const { name, assetType, manufacturer, model, serialNumber, internalAssetTag, criticality, locationId } = body;

    if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        throw inputError(403, { error: 'Manager permissions required to edit equipment' });
    }

    const asset = await db.equipmentAsset.findUnique({ where: { id } });
    if (!asset) throw inputError(404, { error: 'Equipment not found' });

    // Lab scope check (LG-18, P27)
    if (user.role !== 'SUPER_ADMIN') {
        if (user.labId !== asset.labId) {
            throw inputError(403, { error: 'EQUIPMENT_OUTSIDE_SCOPE', message: 'Cannot modify equipment belonging to another laboratory' });
        }
    }

    const updated = await db.equipmentAsset.update({
        where: { id },
        data: {
            name,
            assetType,
            manufacturer,
            model,
            serialNumber,
            internalAssetTag,
            criticality,
            locationId,
            events: {
                create: {
                    id: uuidv4(),
                    labId: asset.labId,
                    userId: user.username,
                    eventType: 'METADATA_UPDATE',
                    summary: `Equipment details updated: ${name}`,
                    outcome: 'NA'
                }
            }
        }
    });

    return updated;
}

const recordEventAudit = (tx, event, user, action, details) => tx.auditLog.create({
    data: {
        id: uuidv4(), entity: 'EQUIPMENT_EVENT', entityId: event.id, action,
        details: JSON.stringify({ equipmentId: event.equipmentId, ...details }),
        performedBy: user.username, performedByName: user.name || user.username,
        labId: event.labId, timestamp: new Date()
    }
});

async function logEvent(user, body, { db = prisma } = {}) {
    const {
        equipmentId,
        eventType,
        summary,
        details,
        outcome = 'PASS',
        performedDate,
        nextDueDate,
        attachments,
        idempotencyKey
    } = body;

    if (!equipmentId) {
        throw inputError(400, { error: 'MISSING_EQUIPMENT_ID', message: 'Equipment ID is required' });
    }
    if (!eventType || typeof eventType !== 'string') {
        throw inputError(400, { error: 'MISSING_EVENT_TYPE', message: 'Event type is required' });
    }
    if (!summary || typeof summary !== 'string' || !summary.trim()) {
        throw inputError(400, { error: 'MISSING_SUMMARY', message: 'Summary is required' });
    }

    const normalizedType = eventType.trim().toUpperCase();
    const canManage = hasPermission(user, 'MANAGE_EQUIPMENT');
    if (!canManage && !technicianEventTypes.has(normalizedType)) {
        throw inputError(403, { error: 'EQUIPMENT_EVENT_TYPE_NOT_ALLOWED', code: 'EQUIPMENT_EVENT_TYPE_NOT_ALLOWED' });
    }
    let normalizedOutcome;
    if (!canManage) {
        normalizedOutcome = normalizedType.endsWith('_FAILED') ? 'FAIL'
            : typeof outcome === 'string' ? outcome.trim().toUpperCase() : null;
        if (!['PASS', 'FAIL'].includes(normalizedOutcome)) {
            throw inputError(400, { error: 'EQUIPMENT_EVENT_OUTCOME_INVALID', code: 'EQUIPMENT_EVENT_OUTCOME_INVALID' });
        }
    } else {
        normalizedOutcome = (outcome || 'PASS').trim().toUpperCase();
        if (!['PASS', 'FAIL', 'NA'].includes(normalizedOutcome)) {
            throw inputError(400, { error: 'INVALID_OUTCOME', message: 'Outcome must be PASS, FAIL, or NA' });
        }
    }

    // Validate performedDate if provided
    let parsedPerformedDate = null;
    if (performedDate) {
        parsedPerformedDate = new Date(performedDate);
        if (isNaN(parsedPerformedDate.getTime())) {
            throw inputError(400, { error: 'INVALID_PERFORMED_DATE', message: 'Invalid performed date format' });
        }
        const tomorrow = new Date(Date.now() + 86400000);
        if (parsedPerformedDate > tomorrow) {
            throw inputError(400, { error: 'FUTURE_PERFORMED_DATE', message: 'Performed date cannot be in the future' });
        }
    }

    // Validate nextDueDate if provided
    let parsedNextDueDate = null;
    if (nextDueDate) {
        parsedNextDueDate = new Date(nextDueDate);
        if (isNaN(parsedNextDueDate.getTime())) {
            throw inputError(400, { error: 'INVALID_NEXT_DUE_DATE', message: 'Invalid next due date format' });
        }
    }

    const userId = user.username;

    const asset = await db.equipmentAsset.findUnique({
        where: { id: equipmentId },
        include: { qualification: true }
    });

    if (!asset) throw inputError(404, { error: 'Equipment not found' });

    // SECURITY: Enforce Lab Scope
    try {
        scopeGuard.ensureScope(user, asset);
    } catch (e) {
        throw inputError(403, { error: 'Access Denied: Equipment belongs to another lab.' });
    }

    // Idempotency / repeat submit guard (within 5 seconds)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const duplicate = await db.equipmentEvent.findFirst({
        where: {
            equipmentId,
            eventType: normalizedType,
            summary: summary.trim(),
            outcome: normalizedOutcome,
            userId,
            ts: { gte: fiveSecondsAgo }
        }
    });
    if (duplicate) {
        return duplicate;
    }

    const detailsObj = typeof details === 'object' && details !== null
        ? { ...details }
        : (details ? { rawNotes: details } : {});

    if (parsedPerformedDate) {
        detailsObj.performedDate = parsedPerformedDate.toISOString().slice(0, 10);
    }
    if (parsedNextDueDate) {
        detailsObj.nextDueDate = parsedNextDueDate.toISOString().slice(0, 10);
    }
    if (idempotencyKey) {
        detailsObj.idempotencyKey = idempotencyKey;
    }

    // Transaction: Create event + Recompute qualification & asset state
    const result = await inTransaction(db, async (tx) => {
        const needsPolicySignoff = !canManage && await policyService.get(asset.labId,
            'equipment.technicianEventsRequireSignoff', { db: tx });
        const event = await tx.equipmentEvent.create({
            data: {
                id: uuidv4(),
                equipmentId,
                labId: asset.labId,
                userId,
                eventType: normalizedType,
                summary: summary.trim(),
                details: Object.keys(detailsObj).length > 0 ? JSON.stringify(detailsObj) : null,
                attachmentIds: attachments ? JSON.stringify(attachments) : null,
                outcome: normalizedOutcome,
                requiresManagerSignoff: normalizedOutcome === 'FAIL' || needsPolicySignoff,
                ts: new Date()
            }
        });

        await recomputeAndPersist(equipmentId, tx, userId);
        await recordEventAudit(tx, event, user, 'EQUIPMENT_EVENT_LOGGED', {
            eventType: event.eventType, outcome: event.outcome,
            requiresManagerSignoff: event.requiresManagerSignoff
        });

        return event;
    });

    return result;
}

async function updateEligibility(user, body, { db = prisma } = {}) {
    const { labId } = user;
    const { analysisCode, methodId, eligibleEquipmentIds, isRequired } = body;

    if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        throw inputError(403, { error: 'Manager permissions required' });
    }

    if (!labId || !analysisCode || eligibleEquipmentIds != null &&
        (!Array.isArray(eligibleEquipmentIds) || eligibleEquipmentIds.some(id => typeof id !== 'string'))) {
        throw inputError(400, { error: 'A laboratory, analysis and equipment ID array are required' });
    }
    if (methodId) {
        const method = await db.methodology.findUnique({ where: { id: methodId } });
        if (!method || method.labId && method.labId !== labId) throw inputError(403, { error: 'Access denied' });
    }
    const equipmentIds = [...new Set(eligibleEquipmentIds || [])];
    if (equipmentIds.length) {
        const ownedCount = await db.equipmentAsset.count({ where: { id: { in: equipmentIds }, labId } });
        if (ownedCount !== equipmentIds.length) throw inputError(403, { error: 'Access denied' });
    }
    // Upsert logic
    const existing = await db.equipmentMethodEligibility.findFirst({
        where: { labId, analysisCode }
    });

    const data = {
        labId,
        analysisCode,
        methodId,
        eligibleEquipmentIds: JSON.stringify(eligibleEquipmentIds || []),
        isRequired: isRequired ?? true
    };

    let mapping;
    if (existing) {
        mapping = await db.equipmentMethodEligibility.update({
            where: { id: existing.id },
            data
        });
    } else {
        mapping = await db.equipmentMethodEligibility.create({
            data: { id: uuidv4(), ...data }
        });
    }

    return mapping;
}

module.exports = { addEquipment, updateEquipment, logEvent, updateEligibility, recordEventAudit };
