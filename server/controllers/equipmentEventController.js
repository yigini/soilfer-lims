const writeService = require('../services/equipmentWriteService');
const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');
const scopeGuard = require('../utils/scopeGuard');
const { recomputeAndPersist } = require('../services/equipmentQualificationService');
const { hasPermission } = require('../config/roles');
const policyService = require('../services/policyService');
const technicianEventTypes = new Set(require('../../shared/technicianEquipmentEventTypes.json'));

const { recordEventAudit } = require('../services/equipmentWriteService');

/**
 * Log an equipment event (Calibration, Verification, Maintenance, etc.)
 */
exports.logEvent = async (req, res) => {
    try {
        res.json(await writeService.logEvent(req.user, req.body));
    } catch (err) {
        if (err.inputPayload) return res.status(err.statusCode).json(err.inputPayload);
        console.error('[EquipmentEvent] Log error:', err);
        res.status(err.statusCode || 500).json({ error: err.code || 'Failed to log equipment event', ...(err.code && { code: err.code }) });
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

        if (event.userId === req.user.username) {
            return res.status(409).json({ error: 'EQUIPMENT_SIGNOFF_SELF', code: 'EQUIPMENT_SIGNOFF_SELF' });
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
            await recordEventAudit(tx, ev, req.user, 'EQUIPMENT_EVENT_DISPOSITION', { decision, reason: reason || null });

            return ev;
        });

        res.json(updatedEvent);
    } catch (err) {
        console.error('[EquipmentEvent] Disposition error:', err);
        res.status(500).json({ error: 'Failed to update disposition' });
    }
};
