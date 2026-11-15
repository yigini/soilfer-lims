const writeService = require('../services/equipmentWriteService');
const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');
const { equipmentView, generateMismatchReport } = require('../services/equipmentQualificationService');

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

        const enriched = await Promise.all(assets.map(asset => equipmentView(asset)));

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

        res.json(await equipmentView(asset));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch equipment details' });
    }
};

/**
 * Add new equipment
 */
exports.addEquipment = async (req, res) => {
    try {
        res.json(await writeService.addEquipment(req.user, req.body));
    } catch (err) {
        if (err.inputPayload) return res.status(err.statusCode).json(err.inputPayload);
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

        // Lab scope check (LG-18, P27)
        if (req.user.role !== 'SUPER_ADMIN') {
            if (req.user.labId !== asset.labId) {
                return res.status(403).json({ error: 'EQUIPMENT_OUTSIDE_SCOPE', message: 'Cannot modify equipment belonging to another laboratory' });
            }
        }

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
        res.json(await writeService.updateEquipment(req.user, req.params, req.body));
    } catch (err) {
        if (err.inputPayload) return res.status(err.statusCode).json(err.inputPayload);
        console.error('[Equipment] Update error:', err);
        res.status(500).json({ error: 'Failed to update equipment details' });
    }
};

/**
 * Read-only diagnostic: audit equipment registry for discrepancies between events and qualifications
 */
exports.getAuditMismatches = async (req, res) => {
    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Manager permissions required' });
        }
        const targetLabId = req.user.role === 'SUPER_ADMIN' ? req.query.labId || null : req.user.labId;
        const report = await generateMismatchReport(targetLabId);
        res.json(report);
    } catch (err) {
        console.error('[Equipment] Audit error:', err);
        res.status(500).json({ error: 'Failed to generate equipment audit report' });
    }
};
