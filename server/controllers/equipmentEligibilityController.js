const prisma = require('../prisma');
const { v4: uuidv4 } = require('uuid');

/**
 * Get eligibility mappings for a lab
 */
exports.getEligibility = async (req, res) => {
    try {
        const { labId } = req.user;
        const mappings = await prisma.equipmentMethodEligibility.findMany({
            where: { labId }
        });
        res.json(mappings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch eligibility mappings' });
    }
};

/**
 * Update eligibility mapping
 */
exports.updateEligibility = async (req, res) => {
    try {
        const { labId } = req.user;
        const { analysisCode, methodId, eligibleEquipmentIds, isRequired } = req.body;

        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Manager permissions required' });
        }

        // Upsert logic
        const existing = await prisma.equipmentMethodEligibility.findFirst({
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
            mapping = await prisma.equipmentMethodEligibility.update({
                where: { id: existing.id },
                data
            });
        } else {
            mapping = await prisma.equipmentMethodEligibility.create({
                data: { id: uuidv4(), ...data }
            });
        }

        res.json(mapping);
    } catch (err) {
        console.error('[EquipmentEligibility] Update error:', err);
        res.status(500).json({ error: 'Failed to update eligibility' });
    }
};

/**
 * Get eligible instruments for a specific analysis
 */
exports.getEligibleInstruments = async (req, res) => {
    try {
        const { labId } = req.user;
        const { analysisCode } = req.params;

        // 1. Find mapping
        const mapping = await prisma.equipmentMethodEligibility.findFirst({
            where: { labId, analysisCode }
        });

        // 2. Fetch instruments
        let instruments;
        if (mapping && mapping.eligibleEquipmentIds) {
            const ids = JSON.parse(mapping.eligibleEquipmentIds);
            instruments = await prisma.equipmentAsset.findMany({
                where: { id: { in: ids }, labId, status: 'IN_SERVICE' },
                include: { qualification: true }
            });
        } else {
            // Default: show all instruments of appropriate type if any, else all IN_SERVICE
            // This is a fuzzy fallback
            instruments = await prisma.equipmentAsset.findMany({
                where: { labId, status: 'IN_SERVICE' },
                include: { qualification: true }
            });
        }

        res.json(instruments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch eligible instruments' });
    }
};
