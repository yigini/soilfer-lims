const prisma = require('../prisma');
const { scalar, problem } = require('../services/rowImport');
const columns = require('../../shared/importColumns.json').equipment.equipment;
const { csvCell } = require('../utils/importCsv');
exports.exportEquipment = async (req, res) => {
    try {
        const labId = req.user.role === 'SUPER_ADMIN' ? scalar(req.query.labId) : req.user.labId;
        if (req.user.role !== 'SUPER_ADMIN' && req.query.labId && req.query.labId !== labId) throw problem(403, 'IMPORT_LAB_FORBIDDEN');
        if (!labId) throw problem(400, 'IMPORT_LAB_REQUIRED');
        const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { isActive: true } });
        if (!lab?.isActive) throw problem(400, 'IMPORT_LAB_UNAVAILABLE');
        const [assets, mappings] = await Promise.all([
            prisma.equipmentAsset.findMany({ where: { labId }, include: { qualification: true }, orderBy: { name: 'asc' } }),
            prisma.equipmentMethodEligibility.findMany({ where: { labId } })
        ]);
        const codes = new Map();
        for (const mapping of mappings) {
            const ids = JSON.parse(mapping.eligibleEquipmentIds || '[]');
            if (!Array.isArray(ids)) continue;
            for (const id of ids) { if (!codes.has(id)) codes.set(id, []); codes.get(id).push(mapping.analysisCode); }
        }
        const iso = date => date ? new Date(date).toISOString().slice(0, 10) : '';
        const rows = assets.map(asset => {
            const values = { ...asset, lastCalibrationDate: iso(asset.qualification?.lastCalibrationDate),
                nextCalibrationDueDate: iso(asset.qualification?.nextCalibrationDueDate), eligibleAnalyses: (codes.get(asset.id) || []).sort().join(' | ') };
            return columns.map(column => values[column] ?? '');
        });
        res.type('text/csv').attachment('equipment.csv').send([columns, ...rows].map(row => row.map(csvCell).join(',')).join('\n'));
    } catch (error) {
        res.status(error.statusCode || 500).json({ code: error.code || 'IMPORT_EXPORT_FAILED', error: 'Equipment export could not be completed.' });
    }
};
