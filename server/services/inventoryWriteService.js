const prisma = require('../prisma');
const crypto = require('crypto');
const { hasPermission } = require('../config/roles');
const policyService = require('./policyService');
const { isRootClient } = require('../utils/prismaClientIdentity');
const uuid = () => crypto.randomUUID();
const inputError = (statusCode, inputPayload) => Object.assign(new Error(inputPayload.error), { statusCode, inputPayload });
const inTransaction = (db, work) => isRootClient(db) ? db.$transaction(work) : work(db);

/** Create an audit log entry */
const audit = async (tx, { entity, entityId, action, details, user, labId, before, after }) => {
    await (tx || prisma).auditLog.create({
        data: {
            id: uuid(),
            entity,
            entityId,
            action,
            details,
            performedBy: user.username,
            performedByName: user.name || user.username,
            labId: labId || user.labId,
            before: before ? JSON.stringify(before) : null,
            after: after ? JSON.stringify(after) : null,
            timestamp: new Date()
        }
    });
};

/** Create an inventory transaction */
const createTransaction = async (tx, { labId, user, actionType, lotId, delta, unit, reasonCode, freeTextReason, sampleId, workItemId, analysisCode }) => {
    return (tx || prisma).inventoryTransaction.create({
        data: {
            id: uuid(),
            labId,
            userId: user.id || user.username,
            userName: user.name || user.username,
            actionType,
            inventoryLotId: lotId,
            deltaQuantity: delta,
            unit,
            reasonCode: reasonCode || null,
            freeTextReason: freeTextReason || null,
            sampleId: sampleId || null,
            workItemId: workItemId || null,
            analysisCode: analysisCode || null
        }
    });
};


async function createItem(user, body, { db = prisma } = {}) {
                const labId = user.role === 'SUPER_ADMIN' ? (body.labId || user.labId) : user.labId;
        if (!labId) throw inputError(400, { error: 'labId is required' });

        const { name, itemType, unitOfMeasure } = body;
        if (!name || !itemType || !unitOfMeasure) {
            throw inputError(400, { error: 'name, itemType, and unitOfMeasure are required' });
        }

        if (body.defaultLocationId) {
            const location = await db.inventoryLocation.findUnique({ where: { id: body.defaultLocationId } });
            if (!location || location.labId !== labId) throw inputError(403, { error: 'Access denied' });
        }
        const item = await db.inventoryItem.create({
            data: {
                id: uuid(),
                labId,
                itemType,
                name,
                shortCode: body.shortCode || null,
                grade: body.grade || null,
                unitOfMeasure,
                defaultLocationId: body.defaultLocationId || null,
                storageConditions: body.storageConditions ? JSON.stringify(body.storageConditions) : null,
                hazardClass: body.hazardClass || null,
                sopLink: body.sopLink || null,
                reorderPoint: body.reorderPoint || 0,
                reorderQuantity: body.reorderQuantity || 0,
                preferredVendor: body.preferredVendor || null,
                notes: body.notes || null
            }
        });

        await audit(db, {
            entity: 'INVENTORY', entityId: item.id, action: 'ITEM_CREATED',
            details: `Created inventory item: ${item.name} (${item.itemType})`,
            user, labId
        });

        return item;
}

async function createLot(user, body, { db = prisma } = {}) {
                const canManage = hasPermission(user, 'MANAGE_INVENTORY');
        const { inventoryItemId, lotNumber, quantity, expiryDate, locationId, concentration, preparedBy, traceabilityNotes, coaAttachment, parentLotIds } = body;

        if (!inventoryItemId || !lotNumber || quantity == null || quantity <= 0) {
            throw inputError(400, { error: 'inventoryItemId, lotNumber, and positive quantity are required' });
        }

        const item = await db.inventoryItem.findUnique({ where: { id: inventoryItemId } });
        if (!item) throw inputError(404, { error: 'Inventory item not found' });
        if (user.role !== 'SUPER_ADMIN' && item.labId !== user.labId) {
            throw inputError(403, { error: 'Access denied' });
        }
        if (!canManage && !['REAGENT', 'STANDARD'].includes(item.itemType)) {
            throw inputError(403, { error: 'LOT_ITEM_TYPE_NOT_ALLOWED', code: 'LOT_ITEM_TYPE_NOT_ALLOWED' });
        }
        if (!canManage && Object.hasOwn(body, 'coaAttachment')) {
            throw inputError(403, { error: 'LOT_ATTACHMENT_NOT_ALLOWED', code: 'LOT_ATTACHMENT_NOT_ALLOWED' });
        }
        if (parentLotIds !== undefined && (!Array.isArray(parentLotIds) || parentLotIds.some(id => typeof id !== 'string' || !id.trim()))) {
            throw inputError(400, { error: 'PARENT_LOT_INVALID', code: 'PARENT_LOT_INVALID' });
        }
        const parentIds = [...new Set(parentLotIds || [])];

        const lot = await inTransaction(db, async (tx) => {
            const parents = parentIds.length ? await tx.inventoryLot.findMany({
                where: { id: { in: parentIds }, labId: item.labId },
                select: { id: true, lotNumber: true }
            }) : [];
            if (parents.length !== parentIds.length) {
                throw Object.assign(new Error('PARENT_LOT_INVALID'), { statusCode: 400, code: 'PARENT_LOT_INVALID' });
            }
            const quarantinedByPolicy = !canManage && await policyService.get(item.labId,
                'inventory.technicianLotsStartQuarantined', { db: tx });
            const storageId = locationId || item.defaultLocationId || null;
            if (storageId) {
                const storage = await tx.inventoryLocation.findUnique({ where: { id: storageId } });
                if (!storage || storage.labId !== item.labId || storage.purpose !== 'REAGENT' || !storage.isActive)
                    throw Object.assign(new Error('Choose an active reagent location in this laboratory.'), { statusCode: 400, code: 'CUSTODY_LOCATION_INVALID' });
            }
            const parentNotes = parents.length ? `Parent lots: ${parents.map(parent => `${parent.lotNumber} (${parent.id})`).join('; ')}` : null;
            const notes = parentNotes ? [traceabilityNotes, parentNotes].filter(Boolean).join('\n') : traceabilityNotes || null;
            const recordedPreparer = canManage ? preparedBy || null : user.username;
            const newLot = await tx.inventoryLot.create({
                data: {
                    id: uuid(),
                    inventoryItemId,
                    labId: item.labId,
                    lotNumber,
                    receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
                    expiryDate: expiryDate ? new Date(expiryDate) : null,
                    initialQuantity: quantity,
                    currentQuantity: quantity,
                    unitOfMeasure: item.unitOfMeasure,
                    locationId: storageId,
                    concentration: concentration || null,
                    preparedBy: recordedPreparer,
                    traceabilityNotes: notes,
                    coaAttachment: canManage && coaAttachment ? JSON.stringify(coaAttachment) : null,
                    ...(!canManage && { status: quarantinedByPolicy ? 'QUARANTINED' : 'AVAILABLE' })
                }
            });
            await createTransaction(tx, {
                labId: item.labId, user, actionType: 'RECEIVE',
                lotId: newLot.id, delta: quantity, unit: item.unitOfMeasure,
                reasonCode: canManage ? 'STOCK_RECEIPT' : quarantinedByPolicy ? 'TECHNICIAN_PREPARATION_QUARANTINED' : 'TECHNICIAN_PREPARATION'
            });
            const message = `${canManage ? 'Received' : 'Prepared'} ${quantity} ${item.unitOfMeasure} of ${item.name} (Lot ${lotNumber})`;
            await audit(tx, {
                entity: 'INVENTORY', entityId: newLot.id, action: canManage ? 'LOT_RECEIVED' : 'LOT_PREPARED',
                details: !canManage || parentIds.length ? JSON.stringify({ message, parentLotIds: parentIds,
                    preparedBy: recordedPreparer, quarantinedByPolicy: Boolean(quarantinedByPolicy) }) : message,
                user, labId: item.labId
            });
            return newLot;
        });
        return lot;
}

const LOCATION_TYPES = Object.freeze(['ROOM', 'FRIDGE', 'FREEZER', 'CABINET', 'SHELF', 'OTHER']);

async function createLocation(user, body, { db = prisma } = {}) {
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Provide a location request.' });
                const labId = require('../utils/scopeGuard').hasGlobalAccess(user) ? (body.labId || user.labId) : user.labId;
        if (typeof labId !== 'string' || !labId.trim()) throw inputError(400, { code: 'CUSTODY_LAB_REQUIRED', error: 'labId required' });
        const purpose = body.purpose || 'REAGENT';
        const locationType = body.locationType || 'SHELF';
        if (!require('../config/custodyContract').LOCATION_PURPOSES.includes(purpose) || typeof body.name !== 'string' || !body.name.trim() ||
            !LOCATION_TYPES.includes(locationType) ||
            body.parentLocationId != null && typeof body.parentLocationId !== 'string')
            throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Choose a name and valid location purpose.' });
        if (body.parentLocationId) {
            const parent = await db.inventoryLocation.findUnique({ where: { id: body.parentLocationId } });
            if (parent && parent.labId !== labId) throw inputError(403, { error: 'Access denied' });
            if (!parent || parent.labId !== labId || parent.purpose !== purpose || !parent.isActive)
                throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Choose an active parent location with the same laboratory and purpose.' });
        }

        const location = await db.inventoryLocation.create({
            data: {
                id: uuid(),
                labId,
                purpose,
                name: body.name.trim(),
                locationType,
                parentLocationId: body.parentLocationId || null,
                temperatureRange: typeof body.temperatureRange === 'string' ? (body.temperatureRange.trim() || null) : null
            }
        });

        await audit(db, {
            entity: 'INVENTORY', entityId: location.id, action: 'LOCATION_CREATED',
            details: `Created storage location: ${location.name}`,
            user, labId
        });

        return location;
}

async function updateLocation(user, locationId, body, { db = prisma } = {}) {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Provide a location update request.' });
        }
        const existing = await db.inventoryLocation.findUnique({ where: { id: locationId } });
        if (!existing) throw inputError(404, { error: 'Location not found' });
        if (!require('../utils/scopeGuard').hasGlobalAccess(user) && existing.labId !== user.labId) {
            throw inputError(403, { error: 'Access denied' });
        }
        if (Object.hasOwn(body, 'purpose') && body.purpose !== existing.purpose) {
            throw inputError(400, { code: 'LOCATION_FIELD_IMMUTABLE', error: 'Location purpose cannot be changed.' });
        }
        if (Object.hasOwn(body, 'parentLocationId') && (body.parentLocationId || null) !== (existing.parentLocationId || null)) {
            throw inputError(400, { code: 'LOCATION_FIELD_IMMUTABLE', error: 'Location parent cannot be changed.' });
        }

        const data = {};
        if (Object.hasOwn(body, 'name')) {
            if (typeof body.name !== 'string' || !body.name.trim()) {
                throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Location name is required.' });
            }
            data.name = body.name.trim();
        }
        if (Object.hasOwn(body, 'locationType')) {
            if (!LOCATION_TYPES.includes(body.locationType)) {
                throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Choose a valid location type.' });
            }
            data.locationType = body.locationType;
        }
        if (Object.hasOwn(body, 'temperatureRange')) {
            if (body.temperatureRange !== null && typeof body.temperatureRange !== 'string') {
                throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Temperature range must be text.' });
            }
            data.temperatureRange = body.temperatureRange ? body.temperatureRange.trim() || null : null;
        }
        if (Object.hasOwn(body, 'isActive')) {
            if (typeof body.isActive !== 'boolean') {
                throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'isActive must be a boolean.' });
            }
            data.isActive = body.isActive;
        }
        if (Object.keys(data).length === 0) {
            throw inputError(400, { code: 'CUSTODY_LOCATION_INVALID', error: 'Provide at least one editable location field.' });
        }

        return inTransaction(db, async (tx) => {
            if (data.isActive === false) {
                const activeChildren = await tx.inventoryLocation.count({
                    where: { parentLocationId: existing.id, labId: existing.labId, isActive: true }
                });
                if (activeChildren > 0) {
                    throw inputError(409, {
                        code: 'LOCATION_HAS_ACTIVE_CHILDREN',
                        error: 'Deactivate active child locations before deactivating this location.'
                    });
                }
            }
            const updated = await tx.inventoryLocation.update({
                where: { id: existing.id },
                data
            });
            await audit(tx, {
                entity: 'INVENTORY',
                entityId: updated.id,
                action: 'LOCATION_UPDATED',
                details: `Updated storage location: ${updated.name}`,
                user,
                labId: existing.labId,
                before: existing,
                after: updated
            });
            return updated;
        });
}

module.exports = { createItem, createLot, createLocation, updateLocation, LOCATION_TYPES, audit, createTransaction };
