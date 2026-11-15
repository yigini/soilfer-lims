const writeService = require('../services/equipmentWriteService');
const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');
const { equipmentView } = require('../services/equipmentQualificationService');

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
        res.json(await writeService.updateEligibility(req.user, req.body));
    } catch (err) {
        if (err.inputPayload) return res.status(err.statusCode).json(err.inputPayload);
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

        const enriched = (await Promise.all(instruments.map(asset => equipmentView(asset))))
            .filter(asset => asset.readiness !== 'BLOCKED');

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch eligible instruments' });
    }
};
