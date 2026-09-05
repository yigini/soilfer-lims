const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');

/**
 * Helper to compute equipment readiness badge
 */
const getReadiness = (asset) => {
    if (asset.status === 'OUT_OF_SERVICE' || asset.status === 'DECOMMISSIONED') return 'BLOCKED';

    const q = asset.qualification;
    if (!q) return 'READY'; // Or NOT_CONFIGURED? Let's say READY if no rules set yet

    if (q.calibrationStatus === 'OVERDUE' || q.verificationStatus === 'OVERDUE') return 'BLOCKED';
    if (q.calibrationStatus === 'DUE_SOON' || q.verificationStatus === 'DUE_SOON') return 'WARNING';

    return 'READY';
};

/**
 * Get all equipment for the user's lab
 */
exports.getEquipment = async (req, res) => {
    try {
        const { labId, role } = req.user;
        const query = (role === 'SUPER_ADMIN' && !labId) ? {} : (labId ? { labId } : {});

        // Support type / assetType and status filtering
        const typeParam = req.query.type || req.query.assetType;
        if (typeParam) {
            query.assetType = typeParam.toUpperCase();
        }
        if (req.query.status) {
            query.status = req.query.status.toUpperCase();
        }

        const assets = await prisma.equipmentAsset.findMany({
            where: query,
            orderBy: { name: 'asc' },
            include: {
                qualification: true,
                _count: {
                    select: { events: true }
                }
            }
        });

        const enriched = assets.map(a => ({
            ...a,
            readiness: getReadiness(a)
        }));

        res.json(enriched);
    } catch (err) {
        console.error('[Equipment] Fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch equipment registry' });
    }
};

/**
 * Get specific equipment details
 */
exports.getEquipmentDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma.equipmentAsset.findUnique({
            where: { id },
            include: {
                qualification: true,
                scheduleRules: { where: { active: true } },
                events: {
                    orderBy: { ts: 'desc' },
                    take: 50
                }
            }
        });

        if (!asset) return res.status(404).json({ error: 'Equipment not found' });

        // SECURITY: Enforce Lab Scope
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(req.user, asset);
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: Equipment belongs to another lab.' });
        }

        res.json({
            ...asset,
            readiness: getReadiness(asset)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch equipment details' });
    }
};

/**
 * Add new equipment
 */
exports.addEquipment = async (req, res) => {
    try {
        const { name, assetType, manufacturer, model, serialNumber, internalAssetTag, criticality, locationId } = req.body;
        const labId = req.user.labId;

        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Manager permissions required to register equipment' });
        }

        if (!labId && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Administrative role required to add equipment across labs' });
        }

        const targetLabId = req.body.labId || labId;

        const asset = await prisma.equipmentAsset.create({
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
                        userId: req.user.username,
                        eventType: 'REGISTER',
                        summary: `Equipment registered: ${name}`,
                        outcome: 'NA'
                    }
                }
            }
        });

        res.json(asset);
    } catch (err) {
        console.error('[Equipment] Create error:', err);
        res.status(500).json({ error: 'Failed to register equipment' });
    }
};

/**
 * Update Status (Manager only)
 */
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Manager permissions required for status changes' });
        }

        const asset = await prisma.equipmentAsset.findUnique({ where: { id } });
        if (!asset) return res.status(404).json({ error: 'Equipment not found' });

        const updated = await prisma.equipmentAsset.update({
            where: { id },
            data: {
                status,
                events: {
                    create: {
                        id: uuidv4(),
                        labId: asset.labId,
                        userId: req.user.username,
                        eventType: 'STATUS_CHANGE',
                        summary: `Status changed to ${status}`,
                        details: JSON.stringify({ reason, previousStatus: asset.status }),
                        outcome: 'NA'
                    }
                }
            }
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update equipment status' });
    }
};

/**
 * Update general equipment metadata
 */
exports.updateEquipment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, assetType, manufacturer, model, serialNumber, internalAssetTag, criticality, locationId } = req.body;

        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Manager permissions required to edit equipment' });
        }

        const asset = await prisma.equipmentAsset.update({
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
                        labId: req.user.labId,
                        userId: req.user.username,
                        eventType: 'METADATA_UPDATE',
                        summary: `Equipment details updated: ${name}`,
                        outcome: 'NA'
                    }
                }
            }
        });

        res.json(asset);
    } catch (err) {
        console.error('[Equipment] Update error:', err);
        res.status(500).json({ error: 'Failed to update equipment details' });
    }
};
