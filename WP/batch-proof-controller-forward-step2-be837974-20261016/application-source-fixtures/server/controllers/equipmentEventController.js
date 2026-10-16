const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');
const scopeGuard = require('../utils/scopeGuard');
const { recomputeAndPersist } = require('../services/equipmentQualificationService');

/**
 * Log an equipment event (Calibration, Verification, Maintenance, etc.)
 */
exports.logEvent = async (req, res) => {
    try {
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
        } = req.body;

        if (!equipmentId) {
            return res.status(400).json({ error: 'MISSING_EQUIPMENT_ID', message: 'Equipment ID is required' });
        }
        if (!eventType || typeof eventType !== 'string') {
            return res.status(400).json({ error: 'MISSING_EVENT_TYPE', message: 'Event type is required' });
        }
        if (!summary || typeof summary !== 'string' || !summary.trim()) {
            return res.status(400).json({ error: 'MISSING_SUMMARY', message: 'Summary is required' });
        }

        const normalizedType = eventType.trim().toUpperCase();
        const normalizedOutcome = (outcome || 'PASS').trim().toUpperCase();
        if (!['PASS', 'FAIL', 'NA'].includes(normalizedOutcome)) {
            return res.status(400).json({ error: 'INVALID_OUTCOME', message: 'Outcome must be PASS, FAIL, or NA' });
        }

        // Validate performedDate if provided
        let parsedPerformedDate = null;
        if (performedDate) {
            parsedPerformedDate = new Date(performedDate);
            if (isNaN(parsedPerformedDate.getTime())) {
                return res.status(400).json({ error: 'INVALID_PERFORMED_DATE', message: 'Invalid performed date format' });
            }
            const tomorrow = new Date(Date.now() + 86400000);
            if (parsedPerformedDate > tomorrow) {
                return res.status(400).json({ error: 'FUTURE_PERFORMED_DATE', message: 'Performed date cannot be in the future' });
            }
        }

        // Validate nextDueDate if provided
        let parsedNextDueDate = null;
        if (nextDueDate) {
            parsedNextDueDate = new Date(nextDueDate);
            if (isNaN(parsedNextDueDate.getTime())) {
                return res.status(400).json({ error: 'INVALID_NEXT_DUE_DATE', message: 'Invalid next due date format' });
            }
        }

        const userId = req.user.username;

        const asset = await prisma.equipmentAsset.findUnique({
            where: { id: equipmentId },
            include: { qualification: true }
        });

        if (!asset) return res.status(404).json({ error: 'Equipment not found' });

        // SECURITY: Enforce Lab Scope
        try {
            scopeGuard.ensureScope(req.user, asset);
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: Equipment belongs to another lab.' });
        }

        // Idempotency / repeat submit guard (within 5 seconds)
        const fiveSecondsAgo = new Date(Date.now() - 5000);
        const duplicate = await prisma.equipmentEvent.findFirst({
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
            return res.json(duplicate);
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
        const result = await prisma.$transaction(async (tx) => {
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
                    requiresManagerSignoff: normalizedOutcome === 'FAIL',
                    ts: new Date()
                }
            });

            await recomputeAndPersist(equipmentId, tx, userId);

            return event;
        });

        res.json(result);
    } catch (err) {
        console.error('[EquipmentEvent] Log error:', err);
        res.status(500).json({ error: 'Failed to log equipment event' });
    }
};

/**
 * Get events for a specific instrument
 */
exports.getEquipmentEvents = async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const asset = await prisma.equipmentAsset.findUnique({
            where: { id: equipmentId }
        });

        if (!asset) return res.status(404).json({ error: 'Equipment not found' });

        // SECURITY: Enforce Lab Scope
        try {
            scopeGuard.ensureScope(req.user, asset);
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: Equipment belongs to another lab.' });
        }

        const events = await prisma.equipmentEvent.findMany({
            where: { equipmentId },
            orderBy: { ts: 'desc' }
        });
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch equipment events' });
    }
};

/**
 * Sign off on an event disposition (Manager only)
 */
exports.approveDisposition = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { decision, reason } = req.body;

        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Manager sign-off required' });
        }

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ error: 'INVALID_DECISION', message: 'Decision must be APPROVED or REJECTED' });
        }

        const event = await prisma.equipmentEvent.findUnique({
            where: { id: eventId },
            include: { equipment: true }
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        // SECURITY: Enforce Lab Scope
        try {
            scopeGuard.ensureScope(req.user, event.equipment || { labId: event.labId });
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: Event belongs to another lab.' });
        }

        const updatedEvent = await prisma.$transaction(async (tx) => {
            const ev = await tx.equipmentEvent.update({
                where: { id: eventId },
                data: {
                    managerDecision: decision,
                    managerReason: reason || null,
                    requiresManagerSignoff: false
                }
            });

            await recomputeAndPersist(event.equipmentId, tx, req.user.username);

            return ev;
        });

        res.json(updatedEvent);
    } catch (err) {
        console.error('[EquipmentEvent] Disposition error:', err);
        res.status(500).json({ error: 'Failed to update disposition' });
    }
};
