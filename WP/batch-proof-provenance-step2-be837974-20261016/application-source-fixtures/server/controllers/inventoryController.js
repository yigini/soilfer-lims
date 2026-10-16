/**
 * Inventory Controller — Production-Grade
 * Lot-level traceability, RBAC enforcement, lab-scoped, append-only ledger
 */
const prisma = require('../prisma');
const crypto = require('crypto');

// ─── Helpers ──────────────────────────────────────────────────────

const uuid = () => crypto.randomUUID();

/** Lab-scope filter: Super Admin sees all, others see own lab */
const labScope = (user, extraWhere = {}) => {
    if (user.role === 'SUPER_ADMIN') return extraWhere;
    return { ...extraWhere, labId: user.labId };
};

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

/** Human-readable transaction description */
const humanize = (tx, lotNumber, itemName) => {
    const who = tx.userName || tx.userId;
    const qty = Math.abs(tx.deltaQuantity);
    const u = tx.unit;
    const lot = lotNumber ? ` (Lot ${lotNumber})` : '';
    const item = itemName || '';
    const map = {
        'RECEIVE': `${who} received ${qty} ${u} of ${item}${lot}`,
        'CONSUME': `${who} consumed ${qty} ${u} of ${item}${lot}${tx.analysisCode ? ` for ${tx.analysisCode}` : ''}${tx.sampleId ? `, Sample ${tx.sampleId}` : ''}`,
        'ADJUST': `${who} adjusted ${item}${lot} by ${tx.deltaQuantity > 0 ? '+' : ''}${tx.deltaQuantity} ${u}${tx.freeTextReason ? ` — ${tx.freeTextReason}` : ''}`,
        'QUARANTINE': `${who} quarantined ${item}${lot}${tx.freeTextReason ? ` — ${tx.freeTextReason}` : ''}`,
        'RELEASE': `${who} released ${item}${lot} from quarantine`,
        'DISPOSE': `${who} disposed ${item}${lot}${tx.freeTextReason ? ` — ${tx.freeTextReason}` : ''}`,
        'TRANSFER': `${who} transferred ${item}${lot}`,
        'EXPIRE': `${item}${lot} marked as expired`
    };
    return map[tx.actionType] || `${who} performed ${tx.actionType} on ${item}${lot}`;
};

/**
 * Authoritative stock aggregation logic across lots for an item (#125).
 * - Distinguishes usable (AVAILABLE and not expired) stock from expired stock.
 * - Handles missing quantities (null/undefined) faithfully: missing is NOT zero.
 * - Enforces reorder threshold: isLowStock is true when usableStock <= reorderPoint (and > 0).
 * - Out of stock: usableLots.length === 0 || usableStock === 0.
 * - Prevents precedence hiding: an item can be both out of stock (or low stock) AND have expired lots.
 */
function computeItemStockAggregation(item, now = new Date()) {
    const lots = Array.isArray(item.lots) ? item.lots : [];
    const nowDate = now instanceof Date ? now : new Date(now);

    const isExpiredLot = (lot) => {
        if (!lot) return false;
        if (lot.status === 'EXPIRED') return true;
        if (lot.expiryDate && new Date(lot.expiryDate) <= nowDate) return true;
        return false;
    };

    const isUsableLot = (lot) => {
        if (!lot) return false;
        return lot.status === 'AVAILABLE' && !isExpiredLot(lot);
    };

    const usableLots = lots.filter(isUsableLot);
    const expiredLots = lots.filter(isExpiredLot);
    const quarantinedLots = lots.filter(l => l.status === 'QUARANTINED');

    let hasMissingQuantity = false;
    let missingQuantityLotCount = 0;
    let usableNumericLots = 0;
    let usableMissingQuantityLotCount = 0;
    let usableSum = 0;

    for (const lot of lots) {
        if (lot.currentQuantity === null || lot.currentQuantity === undefined || isNaN(lot.currentQuantity)) {
            hasMissingQuantity = true;
            missingQuantityLotCount++;
        }
    }

    for (const lot of usableLots) {
        if (lot.currentQuantity !== null && lot.currentQuantity !== undefined && !isNaN(lot.currentQuantity)) {
            usableSum += Number(lot.currentQuantity);
            usableNumericLots++;
        } else {
            usableMissingQuantityLotCount++;
        }
    }

    let expiredSum = 0;
    for (const lot of expiredLots) {
        if (lot.currentQuantity !== null && lot.currentQuantity !== undefined && !isNaN(lot.currentQuantity)) {
            expiredSum += Number(lot.currentQuantity);
        }
    }

    // Usable stock:
    // If there are no usable lots: 0
    // If there are usable lots but NONE have a numeric quantity: null (unknown/missing, NOT zero)
    // If at least one usable lot has numeric quantity: usableSum (known subtotal if other usable lots are missing)
    let usableStock = 0;
    let isUsableStockSubtotal = false;
    if (usableLots.length > 0) {
        if (usableNumericLots === 0) {
            usableStock = null;
        } else {
            usableStock = usableSum;
            if (usableMissingQuantityLotCount > 0) {
                isUsableStockSubtotal = true;
            }
        }
    }

    const expiredStock = expiredSum;
    const totalStock = usableStock; // maintain totalStock as usableStock for backwards compatibility

    // Expiry dates among usable lots
    const nearestExpiry = usableLots
        .filter(l => l.expiryDate)
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0]?.expiryDate || null;

    const isExpiringSoon = nearestExpiry && (new Date(nearestExpiry) - nowDate) <= 30 * 24 * 60 * 60 * 1000;
    const hasQuarantined = quarantinedLots.length > 0;
    const hasExpired = expiredLots.length > 0;
    const hasExpiredLots = hasExpired;

    // Out of stock can only be asserted if there are zero usable lots OR
    // all usable lots have known quantities and sum to zero without any missing quantities
    const isOutOfStock = usableLots.length === 0 || (usableStock === 0 && usableMissingQuantityLotCount === 0);
    const reorderPoint = Number(item.reorderPoint) || 0;
    const isLowStock = usableStock !== null && usableStock > 0 && reorderPoint > 0 && usableStock <= reorderPoint;

    return {
        ...item,
        usableStock,
        totalStock,
        expiredStock,
        lotCount: lots.length,
        availableLotCount: usableLots.length,
        expiredLotCount: expiredLots.length,
        quarantinedLotCount: quarantinedLots.length,
        hasMissingQuantity,
        missingQuantityLotCount,
        usableMissingQuantityLotCount,
        hasMissingQuantityInUsableLots: usableMissingQuantityLotCount > 0,
        isUsableStockSubtotal,
        nearestExpiry,
        isOutOfStock,
        isLowStock,
        isExpiringSoon: Boolean(isExpiringSoon),
        hasQuarantined,
        hasExpired,
        hasExpiredLots
    };
}
exports.computeItemStockAggregation = computeItemStockAggregation;

// ═══════════════════════════════════════════════════════════════════
// ITEMS (catalog)
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/items — list items with aggregate stock */
exports.getItems = async (req, res) => {
    try {
        const user = req.user;
        const { type, search, active } = req.query;

        const where = labScope(user);
        if (type && type !== 'ALL') where.itemType = type;
        if (active !== undefined && active !== 'all') {
            where.isActive = active === 'true';
        } else if (active === undefined) {
            where.isActive = true;
        }
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { shortCode: { contains: search } }
            ];
        }

        const items = await prisma.inventoryItem.findMany({
            where,
            include: {
                lots: {
                    select: {
                        id: true, lotNumber: true, currentQuantity: true,
                        status: true, expiryDate: true, locationId: true,
                        unitOfMeasure: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        const now = new Date();
        const enriched = items.map(item => computeItemStockAggregation(item, now));

        res.json(enriched);
    } catch (e) {
        console.error('[INVENTORY] getItems error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** GET /api/inventory/items/:id — single item with full lots */
exports.getItem = async (req, res) => {
    try {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: req.params.id },
            include: {
                lots: {
                    include: { location: true, transactions: { orderBy: { timestamp: 'desc' }, take: 20 } },
                    orderBy: { createdAt: 'desc' }
                },
                methodRequirements: true
            }
        });
        if (!item) return res.status(404).json({ error: 'Item not found' });

        // Lab scope check
        const user = req.user;
        if (user.role !== 'SUPER_ADMIN' && item.labId !== user.labId) {
            return res.status(403).json({ error: 'Access denied for this lab scope' });
        }

        const enriched = computeItemStockAggregation(item);
        res.json(enriched);
    } catch (e) {
        console.error('[INVENTORY] getItem error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/items — create catalog item */
exports.createItem = async (req, res) => {
    try {
        const user = req.user;
        const labId = user.role === 'SUPER_ADMIN' ? (req.body.labId || user.labId) : user.labId;
        if (!labId) return res.status(400).json({ error: 'labId is required' });

        const { name, itemType, unitOfMeasure } = req.body;
        if (!name || !itemType || !unitOfMeasure) {
            return res.status(400).json({ error: 'name, itemType, and unitOfMeasure are required' });
        }

        const item = await prisma.inventoryItem.create({
            data: {
                id: uuid(),
                labId,
                itemType,
                name,
                shortCode: req.body.shortCode || null,
                grade: req.body.grade || null,
                unitOfMeasure,
                defaultLocationId: req.body.defaultLocationId || null,
                storageConditions: req.body.storageConditions ? JSON.stringify(req.body.storageConditions) : null,
                hazardClass: req.body.hazardClass || null,
                sopLink: req.body.sopLink || null,
                reorderPoint: req.body.reorderPoint || 0,
                reorderQuantity: req.body.reorderQuantity || 0,
                preferredVendor: req.body.preferredVendor || null,
                notes: req.body.notes || null
            }
        });

        await audit(null, {
            entity: 'INVENTORY', entityId: item.id, action: 'ITEM_CREATED',
            details: `Created inventory item: ${item.name} (${item.itemType})`,
            user, labId
        });

        res.status(201).json(item);
    } catch (e) {
        console.error('[INVENTORY] createItem error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** PUT /api/inventory/items/:id — update catalog item */
exports.updateItem = async (req, res) => {
    try {
        const user = req.user;
        const existing = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Item not found' });
        if (user.role !== 'SUPER_ADMIN' && existing.labId !== user.labId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { id, labId, createdAt, updatedAt, lots, methodRequirements, ...updateData } = req.body;
        if (updateData.storageConditions && typeof updateData.storageConditions === 'object') {
            updateData.storageConditions = JSON.stringify(updateData.storageConditions);
        }

        const updated = await prisma.inventoryItem.update({
            where: { id: req.params.id },
            data: updateData
        });

        await audit(null, {
            entity: 'INVENTORY', entityId: updated.id, action: 'ITEM_UPDATED',
            details: `Updated inventory item: ${updated.name}`,
            user, labId: existing.labId, before: existing, after: updated
        });

        res.json(updated);
    } catch (e) {
        console.error('[INVENTORY] updateItem error:', e);
        res.status(500).json({ error: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// LOTS
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/lots — list lots */
exports.getLots = async (req, res) => {
    try {
        const user = req.user;
        const { itemId, status, search } = req.query;
        const where = labScope(user);
        if (itemId) where.inventoryItemId = itemId;
        if (status && status !== 'ALL') where.status = status;
        if (search) {
            where.lotNumber = { contains: search };
        }

        const lots = await prisma.inventoryLot.findMany({
            where,
            include: { item: { select: { name: true, itemType: true, unitOfMeasure: true } }, location: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(lots);
    } catch (e) {
        console.error('[INVENTORY] getLots error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/lots — receive stock (create lot) */
exports.createLot = async (req, res) => {
    try {
        const user = req.user;
        const { inventoryItemId, lotNumber, quantity, expiryDate, locationId, concentration, preparedBy, traceabilityNotes, coaAttachment } = req.body;

        if (!inventoryItemId || !lotNumber || quantity == null || quantity <= 0) {
            return res.status(400).json({ error: 'inventoryItemId, lotNumber, and positive quantity are required' });
        }

        // Verify item exists and is in user's lab
        const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
        if (!item) return res.status(404).json({ error: 'Inventory item not found' });
        if (user.role !== 'SUPER_ADMIN' && item.labId !== user.labId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const lot = await prisma.$transaction(async (tx) => {
            const newLot = await tx.inventoryLot.create({
                data: {
                    id: uuid(),
                    inventoryItemId,
                    labId: item.labId,
                    lotNumber,
                    receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : new Date(),
                    expiryDate: expiryDate ? new Date(expiryDate) : null,
                    initialQuantity: quantity,
                    currentQuantity: quantity,
                    unitOfMeasure: item.unitOfMeasure,
                    locationId: locationId || item.defaultLocationId || null,
                    concentration: concentration || null,
                    preparedBy: preparedBy || null,
                    traceabilityNotes: traceabilityNotes || null,
                    coaAttachment: coaAttachment ? JSON.stringify(coaAttachment) : null
                }
            });

            await createTransaction(tx, {
                labId: item.labId, user, actionType: 'RECEIVE',
                lotId: newLot.id, delta: quantity, unit: item.unitOfMeasure,
                reasonCode: 'STOCK_RECEIPT'
            });

            await audit(tx, {
                entity: 'INVENTORY', entityId: newLot.id, action: 'LOT_RECEIVED',
                details: `Received ${quantity} ${item.unitOfMeasure} of ${item.name} (Lot ${lotNumber})`,
                user, labId: item.labId
            });

            return newLot;
        });

        res.status(201).json(lot);
    } catch (e) {
        console.error('[INVENTORY] createLot error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/lots/:id/consume — consume stock */
exports.consumeLot = async (req, res) => {
    try {
        const user = req.user;
        const { quantity, sampleId, workItemId, analysisCode, reason } = req.body;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Positive quantity required' });
        }

        const lot = await prisma.inventoryLot.findUnique({
            where: { id: req.params.id },
            include: { item: { select: { name: true, itemType: true } } }
        });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });

        // Lab scope
        if (user.role !== 'SUPER_ADMIN' && lot.labId !== user.labId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Block expired/quarantined/disposed
        if (lot.status === 'EXPIRED') {
            // Check for manager override
            if (!['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role) || !reason) {
                return res.status(409).json({ error: 'Cannot consume from expired lot. Manager override with reason required.', code: 'LOT_EXPIRED' });
            }
        }
        if (lot.status === 'QUARANTINED') {
            return res.status(409).json({ error: 'Cannot consume from quarantined lot. Release it first.', code: 'LOT_QUARANTINED' });
        }
        if (lot.status === 'DISPOSED') {
            return res.status(409).json({ error: 'Cannot consume from disposed lot.', code: 'LOT_DISPOSED' });
        }

        // Block exceeding available
        if (quantity > lot.currentQuantity) {
            // Check for manager override
            if (!['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role) || !reason) {
                return res.status(409).json({
                    error: `Insufficient stock. Available: ${lot.currentQuantity} ${lot.unitOfMeasure}. Manager override with reason required.`,
                    code: 'INSUFFICIENT_STOCK', available: lot.currentQuantity
                });
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const newQty = lot.currentQuantity - quantity;
            const updatedLot = await tx.inventoryLot.update({
                where: { id: lot.id },
                data: { currentQuantity: Math.max(0, newQty) }
            });

            await createTransaction(tx, {
                labId: lot.labId, user, actionType: 'CONSUME',
                lotId: lot.id, delta: -quantity, unit: lot.unitOfMeasure,
                reasonCode: reason ? 'MANAGER_OVERRIDE' : 'ANALYSIS_USE',
                freeTextReason: reason || null,
                sampleId, workItemId, analysisCode
            });

            await audit(tx, {
                entity: 'INVENTORY', entityId: lot.id, action: 'LOT_CONSUMED',
                details: `Consumed ${quantity} ${lot.unitOfMeasure} of ${lot.item.name} (Lot ${lot.lotNumber})${analysisCode ? ` for ${analysisCode}` : ''}${sampleId ? `, Sample ${sampleId}` : ''}`,
                user, labId: lot.labId,
                before: { currentQuantity: lot.currentQuantity },
                after: { currentQuantity: updatedLot.currentQuantity }
            });

            return updatedLot;
        });

        res.json(updated);
    } catch (e) {
        console.error('[INVENTORY] consumeLot error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/lots/:id/adjust — manual quantity adjustment (manager only) */
exports.adjustLot = async (req, res) => {
    try {
        const user = req.user;
        const { delta, reason } = req.body;

        if (delta == null || delta === 0) return res.status(400).json({ error: 'Non-zero delta required' });
        if (!reason || reason.trim().length < 3) return res.status(400).json({ error: 'Reason is required for adjustments (min 3 chars)' });

        const lot = await prisma.inventoryLot.findUnique({
            where: { id: req.params.id },
            include: { item: { select: { name: true } } }
        });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });
        if (user.role !== 'SUPER_ADMIN' && lot.labId !== user.labId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const newQty = lot.currentQuantity + delta;
        if (newQty < 0 && !['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role)) {
            return res.status(409).json({ error: 'Adjustment would result in negative stock' });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const updatedLot = await tx.inventoryLot.update({
                where: { id: lot.id },
                data: { currentQuantity: Math.max(0, newQty) }
            });

            await createTransaction(tx, {
                labId: lot.labId, user, actionType: 'ADJUST',
                lotId: lot.id, delta, unit: lot.unitOfMeasure,
                reasonCode: 'MANUAL_ADJUSTMENT', freeTextReason: reason
            });

            await audit(tx, {
                entity: 'INVENTORY', entityId: lot.id, action: 'LOT_ADJUSTED',
                details: `Adjusted ${lot.item.name} (Lot ${lot.lotNumber}) by ${delta > 0 ? '+' : ''}${delta} ${lot.unitOfMeasure} — ${reason}`,
                user, labId: lot.labId,
                before: { currentQuantity: lot.currentQuantity },
                after: { currentQuantity: updatedLot.currentQuantity }
            });

            return updatedLot;
        });

        res.json(updated);
    } catch (e) {
        console.error('[INVENTORY] adjustLot error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/lots/:id/quarantine */
exports.quarantineLot = async (req, res) => {
    try {
        const user = req.user;
        const { reason } = req.body;
        if (!reason || reason.trim().length < 3) return res.status(400).json({ error: 'Reason required for quarantine' });

        const lot = await prisma.inventoryLot.findUnique({
            where: { id: req.params.id },
            include: { item: { select: { name: true } } }
        });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });
        if (user.role !== 'SUPER_ADMIN' && lot.labId !== user.labId) return res.status(403).json({ error: 'Access denied' });
        if (lot.status === 'DISPOSED') return res.status(409).json({ error: 'Cannot quarantine a disposed lot' });

        const updated = await prisma.$transaction(async (tx) => {
            const updatedLot = await tx.inventoryLot.update({
                where: { id: lot.id },
                data: { status: 'QUARANTINED' }
            });

            await createTransaction(tx, {
                labId: lot.labId, user, actionType: 'QUARANTINE',
                lotId: lot.id, delta: 0, unit: lot.unitOfMeasure,
                reasonCode: 'QUALITY_HOLD', freeTextReason: reason
            });

            await audit(tx, {
                entity: 'INVENTORY', entityId: lot.id, action: 'LOT_QUARANTINED',
                details: `Quarantined ${lot.item.name} (Lot ${lot.lotNumber}) — ${reason}`,
                user, labId: lot.labId,
                before: { status: lot.status }, after: { status: 'QUARANTINED' }
            });

            return updatedLot;
        });

        res.json(updated);
    } catch (e) {
        console.error('[INVENTORY] quarantineLot error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/lots/:id/release */
exports.releaseLot = async (req, res) => {
    try {
        const user = req.user;
        const lot = await prisma.inventoryLot.findUnique({
            where: { id: req.params.id },
            include: { item: { select: { name: true } } }
        });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });
        if (user.role !== 'SUPER_ADMIN' && lot.labId !== user.labId) return res.status(403).json({ error: 'Access denied' });
        if (lot.status !== 'QUARANTINED') return res.status(409).json({ error: 'Lot is not quarantined' });

        const updated = await prisma.$transaction(async (tx) => {
            const updatedLot = await tx.inventoryLot.update({
                where: { id: lot.id },
                data: { status: 'AVAILABLE' }
            });

            await createTransaction(tx, {
                labId: lot.labId, user, actionType: 'RELEASE',
                lotId: lot.id, delta: 0, unit: lot.unitOfMeasure,
                freeTextReason: req.body.reason || null
            });

            await audit(tx, {
                entity: 'INVENTORY', entityId: lot.id, action: 'LOT_RELEASED',
                details: `Released ${lot.item.name} (Lot ${lot.lotNumber}) from quarantine`,
                user, labId: lot.labId,
                before: { status: 'QUARANTINED' }, after: { status: 'AVAILABLE' }
            });

            return updatedLot;
        });

        res.json(updated);
    } catch (e) {
        console.error('[INVENTORY] releaseLot error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/lots/:id/dispose */
exports.disposeLot = async (req, res) => {
    try {
        const user = req.user;
        const { reason } = req.body;
        if (!reason || reason.trim().length < 3) return res.status(400).json({ error: 'Reason required for disposal' });

        const lot = await prisma.inventoryLot.findUnique({
            where: { id: req.params.id },
            include: { item: { select: { name: true } } }
        });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });
        if (user.role !== 'SUPER_ADMIN' && lot.labId !== user.labId) return res.status(403).json({ error: 'Access denied' });

        const updated = await prisma.$transaction(async (tx) => {
            const updatedLot = await tx.inventoryLot.update({
                where: { id: lot.id },
                data: { status: 'DISPOSED', currentQuantity: 0 }
            });

            await createTransaction(tx, {
                labId: lot.labId, user, actionType: 'DISPOSE',
                lotId: lot.id, delta: -lot.currentQuantity, unit: lot.unitOfMeasure,
                reasonCode: 'DISPOSAL', freeTextReason: reason
            });

            await audit(tx, {
                entity: 'INVENTORY', entityId: lot.id, action: 'LOT_DISPOSED',
                details: `Disposed ${lot.item.name} (Lot ${lot.lotNumber}) — ${reason}`,
                user, labId: lot.labId,
                before: { status: lot.status, currentQuantity: lot.currentQuantity },
                after: { status: 'DISPOSED', currentQuantity: 0 }
            });

            return updatedLot;
        });

        res.json(updated);
    } catch (e) {
        console.error('[INVENTORY] disposeLot error:', e);
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/lots/:id/transfer — change location */
exports.transferLot = async (req, res) => {
    try {
        const user = req.user;
        const { locationId } = req.body;
        if (!locationId) return res.status(400).json({ error: 'locationId required' });

        const lot = await prisma.inventoryLot.findUnique({
            where: { id: req.params.id },
            include: { item: { select: { name: true } }, location: true }
        });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });
        if (user.role !== 'SUPER_ADMIN' && lot.labId !== user.labId) return res.status(403).json({ error: 'Access denied' });

        const newLocation = await prisma.inventoryLocation.findUnique({ where: { id: locationId } });
        if (!newLocation) return res.status(404).json({ error: 'Location not found' });
        if (newLocation.labId && lot.labId && newLocation.labId !== lot.labId) {
            return res.status(403).json({
                error: 'CROSS_LAB_LOCATION_TRANSFER_FORBIDDEN',
                message: 'Cannot transfer inventory lot to a location belonging to another laboratory.'
            });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const updatedLot = await tx.inventoryLot.update({
                where: { id: lot.id },
                data: { locationId }
            });

            await createTransaction(tx, {
                labId: lot.labId, user, actionType: 'TRANSFER',
                lotId: lot.id, delta: 0, unit: lot.unitOfMeasure,
                freeTextReason: `Moved from ${lot.location?.name || 'unassigned'} to ${newLocation.name}`
            });

            await audit(tx, {
                entity: 'INVENTORY', entityId: lot.id, action: 'LOT_TRANSFERRED',
                details: `Transferred ${lot.item.name} (Lot ${lot.lotNumber}) to ${newLocation.name}`,
                user, labId: lot.labId,
                before: { locationId: lot.locationId, locationName: lot.location?.name },
                after: { locationId, locationName: newLocation.name }
            });

            return updatedLot;
        });

        res.json(updated);
    } catch (e) {
        console.error('[INVENTORY] transferLot error:', e);
        res.status(500).json({ error: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/locations */
exports.getLocations = async (req, res) => {
    try {
        const where = labScope(req.user, { isActive: true });
        const locations = await prisma.inventoryLocation.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        res.json(locations);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/locations */
exports.createLocation = async (req, res) => {
    try {
        const user = req.user;
        const labId = user.role === 'SUPER_ADMIN' ? (req.body.labId || user.labId) : user.labId;
        if (!labId) return res.status(400).json({ error: 'labId required' });

        const location = await prisma.inventoryLocation.create({
            data: {
                id: uuid(),
                labId,
                name: req.body.name,
                locationType: req.body.locationType || 'SHELF',
                parentLocationId: req.body.parentLocationId || null,
                temperatureRange: req.body.temperatureRange || null
            }
        });

        await audit(null, {
            entity: 'INVENTORY', entityId: location.id, action: 'LOCATION_CREATED',
            details: `Created storage location: ${location.name}`,
            user, labId
        });

        res.status(201).json(location);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// TRANSACTIONS (read-only ledger)
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/transactions */
exports.getTransactions = async (req, res) => {
    try {
        const user = req.user;
        const { lotId, actionType, from, to, limit: limitStr } = req.query;
        const where = labScope(user);
        if (lotId) where.inventoryLotId = lotId;
        if (actionType) where.actionType = actionType;
        if (from || to) {
            where.timestamp = {};
            if (from) where.timestamp.gte = new Date(from);
            if (to) where.timestamp.lte = new Date(to);
        }

        const limit = parseInt(limitStr) || 100;

        const transactions = await prisma.inventoryTransaction.findMany({
            where,
            include: {
                lot: {
                    select: { lotNumber: true, item: { select: { name: true, itemType: true } } }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: Math.min(limit, 500)
        });

        // Add human-readable descriptions
        const enriched = transactions.map(tx => ({
            ...tx,
            description: humanize(tx, tx.lot?.lotNumber, tx.lot?.item?.name)
        }));

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/alerts */
exports.getAlerts = async (req, res) => {
    try {
        const user = req.user;
        const where = labScope(user, { isActive: true });

        const items = await prisma.inventoryItem.findMany({
            where,
            include: {
                lots: {
                    select: { id: true, currentQuantity: true, status: true, expiryDate: true, lotNumber: true }
                }
            }
        });

        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const alerts = [];

        for (const rawItem of items) {
            const item = computeItemStockAggregation(rawItem, now);

            // Out of stock
            if (item.isOutOfStock) {
                alerts.push({
                    type: 'OUT_OF_STOCK', severity: 'error',
                    itemId: item.id, itemName: item.name,
                    message: `${item.name}: Out of usable stock (${item.expiredStock > 0 ? `${item.expiredStock} ${item.unitOfMeasure || 'units'} expired` : '0 available'})`,
                    currentStock: item.usableStock, reorderPoint: item.reorderPoint
                });
            } else if (item.isLowStock) {
                // Low stock
                alerts.push({
                    type: 'LOW_STOCK', severity: 'warning',
                    itemId: item.id, itemName: item.name,
                    message: `${item.name}: ${item.usableStock} ${item.unitOfMeasure || 'units'} remaining (reorder threshold: ${item.reorderPoint})`,
                    currentStock: item.usableStock, reorderPoint: item.reorderPoint
                });
            }

            // Missing quantities
            if (item.hasMissingQuantity) {
                alerts.push({
                    type: 'MISSING_QUANTITY', severity: 'warning',
                    itemId: item.id, itemName: item.name,
                    message: `${item.name} has ${item.missingQuantityLotCount} lot(s) with missing quantity`,
                    missingCount: item.missingQuantityLotCount
                });
            }

            // Expired lots
            for (const lot of (item.lots || [])) {
                const isExp = lot.status === 'EXPIRED' || (lot.expiryDate && new Date(lot.expiryDate) <= now);
                if (isExp) {
                    const expStr = lot.expiryDate ? new Date(lot.expiryDate).toISOString().split('T')[0] : 'undated';
                    alerts.push({
                        type: 'EXPIRED', severity: 'error',
                        itemId: item.id, itemName: item.name, lotId: lot.id, lotNumber: lot.lotNumber,
                        message: `${item.name} (Lot ${lot.lotNumber}) expired on ${expStr}`,
                        expiryDate: lot.expiryDate
                    });
                } else if (lot.status === 'AVAILABLE' && lot.expiryDate) {
                    const exp = new Date(lot.expiryDate);
                    if (exp <= thirtyDays) {
                        const daysLeft = Math.ceil((exp - now) / (24 * 60 * 60 * 1000));
                        alerts.push({
                            type: 'EXPIRING_SOON', severity: 'warning',
                            itemId: item.id, itemName: item.name, lotId: lot.id, lotNumber: lot.lotNumber,
                            message: `${item.name} (Lot ${lot.lotNumber}) expires in ${daysLeft} days`,
                            expiryDate: lot.expiryDate, daysLeft
                        });
                    }
                }
            }

            // Quarantined lots
            const quarantinedLots = (item.lots || []).filter(l => l.status === 'QUARANTINED');
            for (const lot of quarantinedLots) {
                alerts.push({
                    type: 'QUARANTINED', severity: 'info',
                    itemId: item.id, itemName: item.name, lotId: lot.id, lotNumber: lot.lotNumber,
                    message: `${item.name} (Lot ${lot.lotNumber}) is quarantined`
                });
            }
        }

        // NOTE: Strictly NO DB updates on GET requests. Removed prisma.inventoryLot.update mutation.

        // Sort: errors first, then warnings, then info
        alerts.sort((a, b) => {
            const order = { error: 0, warning: 1, info: 2 };
            return (order[a.severity] || 3) - (order[b.severity] || 3);
        });

        // Banner chip counts must align with affected item rows in catalog (#125)
        const countUniqueItems = (types) => {
            const typeArr = Array.isArray(types) ? types : [types];
            return new Set(alerts.filter(a => typeArr.includes(a.type)).map(a => a.itemId)).size;
        };

        res.json({
            alerts,
            counts: {
                total: alerts.length,
                expired: countUniqueItems('EXPIRED'),
                expiringSoon: countUniqueItems('EXPIRING_SOON'),
                lowStock: countUniqueItems(['LOW_STOCK', 'OUT_OF_STOCK']),
                outOfStock: countUniqueItems('OUT_OF_STOCK'),
                quarantined: countUniqueItems('QUARANTINED'),
                missingQuantity: countUniqueItems('MISSING_QUANTITY'),
                // Preserved lot-level counts for observability/diagnostics
                expiredLots: alerts.filter(a => a.type === 'EXPIRED').length,
                expiringSoonLots: alerts.filter(a => a.type === 'EXPIRING_SOON').length,
                quarantinedLots: alerts.filter(a => a.type === 'QUARANTINED').length
            }
        });
    } catch (e) {
        console.error('[INVENTORY] getAlerts error:', e);
        res.status(500).json({ error: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// FEFO (First Expiry, First Out) Suggestion
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/fefo/:itemId */
exports.getFEFO = async (req, res) => {
    try {
        const user = req.user;
        const now = new Date();
        const lots = await prisma.inventoryLot.findMany({
            where: {
                ...labScope(user),
                inventoryItemId: req.params.itemId,
                status: 'AVAILABLE',
                currentQuantity: { gt: 0 }
            },
            include: { location: true },
            orderBy: [
                { expiryDate: 'asc' },
                { receivedDate: 'asc' }
            ]
        });

        // Filter out expired lots (expiryDate <= now) so expired lots are NEVER recommended for consumption
        const nonExpiredLots = lots.filter(l => !l.expiryDate || new Date(l.expiryDate) > now);

        // Nulls last: lots without expiry at end
        const sorted = [
            ...nonExpiredLots.filter(l => l.expiryDate),
            ...nonExpiredLots.filter(l => !l.expiryDate)
        ];

        res.json(sorted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/export/:type — CSV export */
exports.exportData = async (req, res) => {
    try {
        const user = req.user;
        const type = req.params.type; // stock | expiry | transactions
        const where = labScope(user);
        let csvRows = [];

        if (type === 'stock') {
            const items = await prisma.inventoryItem.findMany({
                where: { ...where, isActive: true },
                include: { lots: { include: { location: true } } }
            });
            csvRows.push('Item Name,Type,Short Code,Lot Number,Status,Current Qty,Unit,Expiry Date,Location');
            for (const item of items) {
                for (const lot of item.lots) {
                    csvRows.push([
                        `"${item.name}"`, item.itemType, item.shortCode || '',
                        lot.lotNumber, lot.status, lot.currentQuantity, lot.unitOfMeasure,
                        lot.expiryDate ? new Date(lot.expiryDate).toISOString().split('T')[0] : '',
                        lot.location?.name || ''
                    ].join(','));
                }
                if (item.lots.length === 0) {
                    csvRows.push([`"${item.name}"`, item.itemType, item.shortCode || '', '', '', '0', item.unitOfMeasure, '', ''].join(','));
                }
            }
        } else if (type === 'expiry') {
            const now = new Date();
            const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            const lots = await prisma.inventoryLot.findMany({
                where: { ...where, expiryDate: { lte: ninetyDays }, status: { in: ['AVAILABLE', 'QUARANTINED'] } },
                include: { item: { select: { name: true, itemType: true } }, location: true },
                orderBy: { expiryDate: 'asc' }
            });
            csvRows.push('Item Name,Type,Lot Number,Status,Expiry Date,Days Remaining,Current Qty,Unit,Location');
            for (const lot of lots) {
                const daysLeft = Math.ceil((new Date(lot.expiryDate) - now) / (24 * 60 * 60 * 1000));
                csvRows.push([
                    `"${lot.item.name}"`, lot.item.itemType, lot.lotNumber, lot.status,
                    new Date(lot.expiryDate).toISOString().split('T')[0],
                    daysLeft, lot.currentQuantity, lot.unitOfMeasure,
                    lot.location?.name || ''
                ].join(','));
            }
        } else if (type === 'transactions') {
            const { from, to } = req.query;
            const txWhere = { ...where };
            if (from || to) {
                txWhere.timestamp = {};
                if (from) txWhere.timestamp.gte = new Date(from);
                if (to) txWhere.timestamp.lte = new Date(to);
            }
            const txns = await prisma.inventoryTransaction.findMany({
                where: txWhere,
                include: { lot: { select: { lotNumber: true, item: { select: { name: true } } } } },
                orderBy: { timestamp: 'desc' },
                take: 5000
            });
            csvRows.push('Timestamp,User,Action,Item,Lot,Qty Change,Unit,Reason,Sample ID,Work Item,Analysis');
            for (const tx of txns) {
                csvRows.push([
                    new Date(tx.timestamp).toISOString(), tx.userName || tx.userId, tx.actionType,
                    `"${tx.lot?.item?.name || ''}"`, tx.lot?.lotNumber || '',
                    tx.deltaQuantity, tx.unit, `"${tx.freeTextReason || tx.reasonCode || ''}"`,
                    tx.sampleId || '', tx.workItemId || '', tx.analysisCode || ''
                ].join(','));
            }
        } else {
            return res.status(400).json({ error: 'Invalid export type. Use: stock, expiry, transactions' });
        }

        // Log export
        await audit(null, {
            entity: 'INVENTORY', entityId: 'EXPORT', action: 'INVENTORY_EXPORT',
            details: `Exported inventory ${type} report (${csvRows.length - 1} rows)`,
            user
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=inventory_${type}_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvRows.join('\n'));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// METHOD REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════

/** GET /api/inventory/method-requirements */
exports.getMethodRequirements = async (req, res) => {
    try {
        const { analysisCode } = req.query;
        const where = {};
        if (analysisCode) where.analysisCode = analysisCode;
        if (req.user.role !== 'SUPER_ADMIN' && req.user.labId) {
            where.OR = [{ labId: req.user.labId }, { labId: null }];
        }

        const reqs = await prisma.methodRequirement.findMany({
            where,
            include: { item: { select: { name: true, itemType: true, unitOfMeasure: true } } },
            orderBy: { analysisCode: 'asc' }
        });
        res.json(reqs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

/** POST /api/inventory/method-requirements */
exports.createMethodRequirement = async (req, res) => {
    try {
        const { analysisCode, inventoryItemId, defaultConsumption, unit, isRequired, methodId } = req.body;
        if (!analysisCode || !inventoryItemId) {
            return res.status(400).json({ error: 'analysisCode and inventoryItemId are required' });
        }

        const req_ = await prisma.methodRequirement.create({
            data: {
                id: uuid(),
                analysisCode,
                methodId: methodId || null,
                inventoryItemId,
                defaultConsumption: defaultConsumption || null,
                unit: unit || null,
                isRequired: isRequired !== false,
                labId: req.user.labId || null
            }
        });

        res.status(201).json(req_);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

/** DELETE /api/inventory/method-requirements/:id */
exports.deleteMethodRequirement = async (req, res) => {
    try {
        await prisma.methodRequirement.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
        res.status(500).json({ error: e.message });
    }
};
