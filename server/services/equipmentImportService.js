const prisma = require('../prisma');
const writes = require('./equipmentWriteService');
const { audit } = require('./inventoryWriteService');
const { isRootClient } = require('../utils/prismaClientIdentity');
const { envelope, problem, issue, required, oneOf, date, duplicates, match, describe } = require('./rowImport');
const schema = require('../../shared/importColumns.json');
const COLUMNS = schema.equipment;
const DESCRIPTIVE = ['name', 'manufacturer', 'model', 'serialNumber', 'locationId'];

async function validate(db, user, input) {
    const plan = envelope(input, user, COLUMNS);
    const lab = await db.lab.findUnique({ where: { id: plan.labId }, select: { id: true, isActive: true } });
    if (!lab?.isActive) throw problem(400, 'IMPORT_LAB_UNAVAILABLE');
    const [assets, analyses, mappings] = await Promise.all([
        db.equipmentAsset.findMany({ where: { labId: plan.labId } }),
        db.analysis.findMany({ where: { OR: [{ labId: plan.labId }, { labId: null }], status: 'active' }, select: { code: true } }),
        db.equipmentMethodEligibility.findMany({ where: { labId: plan.labId } })
    ]);
    const active = new Set(analyses.map(a => a.code)), byTag = new Map();
    for (const asset of assets) {
        if (!byTag.has(asset.internalAssetTag)) byTag.set(asset.internalAssetTag, []);
        byTag.get(asset.internalAssetTag).push(asset);
    }
    const ownedIds = new Set(assets.map(a => a.id));
    const methodIds = mappings.map(m => m.methodId).filter(Boolean);
    const methods = methodIds.length ? await db.methodology.findMany({ where: { id: { in: methodIds }, OR: [{ labId: plan.labId }, { labId: null }] }, select: { id: true } }) : [];
    const allowedMethods = new Set(methods.map(m => m.id));
    const brokenMappings = new Set(mappings.filter(mapping => {
        try {
            const ids = JSON.parse(mapping.eligibleEquipmentIds || '[]');
            return !Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !ownedIds.has(id)) || mapping.methodId && !allowedMethods.has(mapping.methodId);
        } catch { return true; }
    }).map(mapping => mapping.analysisCode));
    duplicates(plan.rows.equipment, v => v.internalAssetTag);
    for (const row of plan.rows.equipment) {
        const v = row.values;
        required(row, ['internalAssetTag']);
        row.existing = match(row, byTag.get(v.internalAssetTag) || [], 'internalAssetTag');
        row.status = row.existing ? plan.duplicateMode === 'UPDATE' ? 'DUPLICATE_UPDATE' : 'DUPLICATE_SKIP' : 'NEW';
        // Descriptive updates cannot alter type, criticality, calibration or eligibility.
        // Show their retained values, even if the file supplied different ones.
        if (row.existing) {
            v.assetType = row.existing.assetType; v.criticality = row.existing.criticality;
            if (!row.provided.has('name')) v.name = row.existing.name;
            if (row.status === 'DUPLICATE_UPDATE') required(row, ['name']);
            continue;
        }
        v.criticality ||= 'IMPORTANT';
        required(row, ['name', 'assetType']);
        oneOf(row, 'assetType', schema.assetTypes); oneOf(row, 'criticality', schema.criticalities);
        row.lastCalibrationDate = date(row, 'lastCalibrationDate');
        row.nextCalibrationDueDate = date(row, 'nextCalibrationDueDate');
        if (row.lastCalibrationDate && row.nextCalibrationDueDate && row.nextCalibrationDueDate <= row.lastCalibrationDate) issue(row, 'IMPORT_CALIBRATION_DATE_ORDER', 'nextCalibrationDueDate');
        if (v.nextCalibrationDueDate && !v.lastCalibrationDate) issue(row, 'IMPORT_CALIBRATION_DATE_REQUIRED', 'lastCalibrationDate');
        if (row.lastCalibrationDate && new Date(row.lastCalibrationDate + 'T00:00:00Z') > new Date(Date.now() + 86400000)) issue(row, 'IMPORT_FUTURE_DATE', 'lastCalibrationDate');
        row.analyses = v.eligibleAnalyses ? v.eligibleAnalyses.split(/[|;]/).map(code => code.trim()) : [];
        if (row.analyses.some(code => !code) || new Set(row.analyses).size !== row.analyses.length) issue(row, 'IMPORT_INVALID_ANALYSIS_LIST', 'eligibleAnalyses');
        if (row.analyses.some(code => !active.has(code))) issue(row, 'IMPORT_ANALYSIS_UNAVAILABLE', 'eligibleAnalyses');
        if (row.analyses.some(code => brokenMappings.has(code))) issue(row, 'IMPORT_ELIGIBILITY_INVALID', 'eligibleAnalyses');
    }
    return plan;
}
async function apply(db, user, plan) {
    for (const row of plan.rows.equipment) {
        if (row.errors.length) continue;
        const v = row.values;
        if (row.status === 'DUPLICATE_SKIP') { row.savedId = row.existing.id; row.outcome = 'skipped'; continue; }
        let asset;
        if (row.status === 'NEW') {
            asset = await writes.addEquipment(user, { ...v, labId: plan.labId }, { db });
            if (row.lastCalibrationDate) await writes.logEvent(user, {
                equipmentId: asset.id, eventType: 'CALIBRATION', summary: 'Calibration recorded during equipment import',
                outcome: 'PASS', performedDate: row.lastCalibrationDate, nextDueDate: row.nextCalibrationDueDate,
                details: { importFileName: plan.fileName }
            }, { db });
            for (const analysisCode of row.analyses) {
                const mappings = await db.equipmentMethodEligibility.findMany({ where: { labId: plan.labId, analysisCode } });
                for (const current of mappings.length ? mappings : [null]) {
                    const ids = current ? JSON.parse(current.eligibleEquipmentIds || '[]') : [];
                    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw problem(409, 'IMPORT_ELIGIBILITY_INVALID');
                    await writes.updateEligibility(user, { analysisCode, methodId: current?.methodId,
                        eligibleEquipmentIds: [...new Set([...ids, asset.id])], isRequired: current?.isRequired ?? true },
                    { db, labId: plan.labId, mappingId: current?.id });
                }
            }
            row.outcome = 'created';
        } else {
            const data = { name: v.name, ...Object.fromEntries(DESCRIPTIVE.filter(key => row.provided.has(key)).map(key => [key, v[key] || null])) };
            asset = await writes.updateEquipment(user, { id: row.existing.id }, data, { db });
            row.outcome = 'updated';
        }
        row.savedId = asset.id;
        await audit(db, { entity: 'EQUIPMENT', entityId: asset.id, action: row.outcome === 'created' ? 'EQUIPMENT_IMPORTED' : 'EQUIPMENT_UPDATED',
            details: JSON.stringify({ fileName: plan.fileName, rowNumber: row.rowNumber }), user, labId: plan.labId,
            before: row.existing || null, after: asset });
    }
}
async function preview(user, input, { db = prisma } = {}) { return describe(await validate(db, user, input)); }
async function commit(user, input, { db = prisma } = {}) {
    const work = async tx => {
        const plan = await validate(tx, user, input), before = describe(plan, 'commit');
        if (plan.atomic && before.totals.errors) return { ...before, code: 'IMPORT_VALIDATION_FAILED' };
        await apply(tx, user, plan);
        const result = { ...describe(plan, 'commit'), committed: true };
        await audit(tx, { entity: 'EQUIPMENT', entityId: 'IMPORT', action: 'IMPORT_COMPLETED',
            details: JSON.stringify({ fileName: plan.fileName, user: user.username, labId: plan.labId, counts: result.counts, totals: result.totals }), user, labId: plan.labId });
        return result;
    };
    return isRootClient(db) ? db.$transaction(work, { timeout: 120000, maxWait: 5000 }) : work(db);
}
module.exports = { preview, commit, validate, COLUMNS };
