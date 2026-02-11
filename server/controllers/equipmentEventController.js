const prisma = require('../prisma');
const { v4: uuidv4 } = require('uuid');

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
            outcome,
            nextDueDate,
            attachments
        } = req.body;

        const userId = req.user.username;

        const asset = await prisma.equipmentAsset.findUnique({
            where: { id: equipmentId },
            include: { qualification: true }
        });

        if (!asset) return res.status(404).json({ error: 'Equipment not found' });

        // SECURITY: Enforce Lab Scope
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(req.user, asset);
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: Equipment belongs to another lab.' });
        }

        // Update qualification based on event type
        const qualUpdate = {};
        if (eventType.includes('CALIBRATION')) {
            qualUpdate.lastCalibrationDate = new Date();
            if (nextDueDate) qualUpdate.nextCalibrationDueDate = new Date(nextDueDate);
            qualUpdate.calibrationStatus = (outcome === 'PASS') ? 'OK' : 'OVERDUE'; // or FAILED policy
        } else if (eventType.includes('VERIFICATION')) {
            qualUpdate.lastVerificationDate = new Date();
            if (nextDueDate) qualUpdate.nextVerificationDueDate = new Date(nextDueDate);
            qualUpdate.verificationStatus = (outcome === 'PASS') ? 'OK' : 'OVERDUE';
        }

        // Transaction: Create event + Update Qualification
        const result = await prisma.$transaction(async (tx) => {
            const event = await tx.equipmentEvent.create({
                data: {
                    id: uuidv4(),
                    equipmentId,
                    labId: asset.labId,
                    userId,
                    eventType,
                    summary,
                    details: details ? JSON.stringify(details) : null,
                    attachmentIds: attachments ? JSON.stringify(attachments) : null,
                    outcome,
                    ts: new Date()
                }
            });

            if (Object.keys(qualUpdate).length > 0) {
                await tx.equipmentQualification.update({
                    where: { equipmentId },
                    data: {
                        ...qualUpdate,
                        lastUpdatedBy: userId
                    }
                });
            }

            // If it was a failure, optionally mark instrument as OUT_OF_SERVICE
            if (outcome === 'FAIL' && ['CALIBRATION_FAILED', 'VERIFICATION_FAILED'].includes(eventType)) {
                await tx.equipmentAsset.update({
                    where: { id: equipmentId },
                    data: { status: 'OUT_OF_SERVICE' }
                });
            }

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
 * Sign off on a failed event (Manager only)
 */
exports.approveDisposition = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { decision, reason } = req.body;

        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Manager sign-off required' });
        }

        const event = await prisma.equipmentEvent.update({
            where: { id: eventId },
            data: {
                managerDecision: decision,
                managerReason: reason,
                requiresManagerSignoff: false
            }
        });

        res.json(event);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update disposition' });
    }
};
