const { randomUUID } = require('node:crypto');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');
const policyService = require('./policyService');
const { actorName, requireReason } = require('./workflowStateRules');
const { parseNumber } = require('../../shared/numberParse');
const rules = require('./referenceMaterialRules');

const error = (statusCode, code, message, details = {}) => Object.assign(new Error(message), { statusCode, code, details });
function permission(actor, edit = false) {
    if (!hasPermission(actor, edit ? 'MANAGE_ANALYSES' : 'VIEW_INVENTORY')) throw error(403, 'REFERENCE_PERMISSION_DENIED', 'Reference material permission is required.');
}
async function scopedActor(db, actor) {
    if (!actor?.labId) return actor;
    const lab = await policyService.resolveLab(actor.labId, db);
    return { ...actor, labId: lab?.id || actor.labId };
}
function scope(actor, entity) {
    if (!scopeGuard.canAccessEntity(actor, entity, { labField: 'labId', altLabField: 'labId' })) throw error(403, 'REFERENCE_SCOPE_DENIED', 'Reference material is outside your laboratory scope.');
}
async function hydrateLot(db, material) {
    if (!material.inventoryLot) return material;
    const lotLab = await policyService.resolveLab(material.inventoryLot.labId, db);
    return { ...material, inventoryLot: { ...material.inventoryLot, labId: lotLab?.id || material.inventoryLot.labId } };
}
async function materialFor(db, actor, id, edit = false) {
    permission(actor, edit);
    const material = await db.referenceMaterial.findUnique({ where: { id: String(id) }, include: { inventoryLot: true } });
    if (!material) throw error(404, 'REFERENCE_MATERIAL_NOT_FOUND', 'Reference material not found.');
    scope(await scopedActor(db, actor), material);
    return hydrateLot(db, material);
}
async function present(db, material, now = new Date()) {
    const state = rules.eligibility(material, now);
    const warningDays = await policyService.get(material.labId, 'referenceMaterials.expiryWarningDays', { db });
    const expiry = state.effectiveExpiry || [material.expiryDate, material.inventoryLot?.expiryDate].filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || null;
    const daysToExpiry = expiry ? Math.ceil((new Date(expiry).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null;
    return { ...material, ...state, effectiveExpiry: expiry, daysToExpiry,
        expiryWarning: daysToExpiry !== null && warningDays > 0 && daysToExpiry <= warningDays, expiryWarningDays: warningDays };
}
async function listMaterials(db, actor, { labId, now = new Date() } = {}) {
    permission(actor);
    const normalized = await scopedActor(db, actor);
    let where = {};
    if (labId) {
        const lab = await policyService.resolveLab(labId, db);
        if (!lab) throw error(404, 'REFERENCE_LAB_NOT_FOUND', 'Laboratory not found.');
        scope(normalized, { labId: lab.id });
        where.labId = lab.id;
    }
    where = scopeGuard.buildScopedWhere(normalized, where, { labField: 'labId', altLabField: 'labId' });
    const rows = await db.referenceMaterial.findMany({ where, include: { inventoryLot: true,
        values: { orderBy: [{ analysisCode: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }] } }, orderBy: [{ code: 'asc' }, { lotNumber: 'asc' }, { id: 'asc' }] });
    return Promise.all(rows.map(async material => present(db, await hydrateLot(db, material), now)));
}
function text(value, field, required = false) {
    if ((value == null || value === '') && !required) return null;
    if (typeof value !== 'string' || !value.trim()) throw error(400, 'REFERENCE_FIELD_REQUIRED', `${field} is required.`, { field });
    return value.trim();
}
function date(value, field) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(new Date(value).getTime())) throw error(400, 'REFERENCE_DATE_INVALID', `${field} must be an ISO timestamp.`, { field });
    return new Date(value);
}
async function audit(db, entity, entityId, action, actor, details, now) {
    return db.auditLog.create({ data: { id: randomUUID(), entity, entityId, action,
        performedBy: actorName(actor), timestamp: now, details: JSON.stringify(details) } });
}
async function createMaterial(db, actor, body, now = new Date()) {
    permission(actor, true);
    const lab = await policyService.resolveLab(body.labId || actor.labId, db);
    if (!lab) throw error(400, 'REFERENCE_LAB_REQUIRED', 'Select a registered laboratory.');
    scope(await scopedActor(db, actor), { labId: lab.id });
    if (!rules.KINDS.includes(body.kind) || !rules.STATUSES.includes(body.status || 'ACTIVE')) throw error(400, 'REFERENCE_KIND_STATUS_INVALID', 'Choose a valid reference material kind and status.');
    const inventoryLotId = text(body.inventoryLotId, 'inventoryLotId');
    if (inventoryLotId) {
        const lot = await db.inventoryLot.findUnique({ where: { id: inventoryLotId } });
        if (!lot || (await policyService.resolveLab(lot.labId, db))?.id !== lab.id) throw error(409, 'REFERENCE_INVENTORY_SCOPE_INVALID', 'Inventory lot must belong to the selected laboratory.');
    }
    const created = await db.referenceMaterial.create({ data: { id: randomUUID(), labId: lab.id,
        code: text(body.code, 'code', true), name: text(body.name, 'name', true), kind: body.kind,
        matrix: text(body.matrix, 'matrix', true), supplier: text(body.supplier, 'supplier'), certificateRef: text(body.certificateRef, 'certificateRef'),
        inventoryLotId, lotNumber: text(body.lotNumber, 'lotNumber', true), expiryDate: date(body.expiryDate, 'expiryDate'),
        openedAt: date(body.openedAt, 'openedAt'), status: body.status || 'ACTIVE', createdBy: actorName(actor), createdAt: now } });
    await audit(db, 'REFERENCE_MATERIAL', created.id, 'REFERENCE_MATERIAL_CREATED', actor, created, now);
    return created;
}
async function changeStatus(db, actor, id, body, now = new Date()) {
    const material = await materialFor(db, actor, id, true), reason = requireReason(body.reason);
    if (!rules.STATUSES.includes(body.status)) throw error(400, 'REFERENCE_STATUS_INVALID', 'Choose a valid reference material status.');
    if (material.status === body.status) return material;
    const changed = await db.referenceMaterial.updateMany({ where: { id: material.id, status: material.status }, data: { status: body.status } });
    if (changed.count !== 1) throw error(409, 'REFERENCE_MATERIAL_CHANGED', 'Reference material changed. Reload before retrying.');
    await audit(db, 'REFERENCE_MATERIAL', material.id, 'REFERENCE_MATERIAL_STATUS_CHANGED', actor,
        { previousStatus: material.status, status: body.status, reason }, now);
    return { ...material, status: body.status };
}
function convertValue(value, sourceUnit, targetUnit) {
    if (!sourceUnit || !targetUnit || sourceUnit.quantityKind !== targetUnit.quantityKind ||
        ![sourceUnit.factorToBase, targetUnit.factorToBase].every(number => Number.isFinite(number) && number > 0)) throw error(409, 'REFERENCE_UNIT_INCOMPATIBLE', 'Reference and analysis units must be compatible.');
    const converted = value * sourceUnit.factorToBase / targetUnit.factorToBase;
    if (!Number.isFinite(converted)) throw error(409, 'REFERENCE_UNIT_INCOMPATIBLE', 'The reference unit conversion is not finite.');
    return converted;
}
async function valueData(db, actor, material, body) {
    const analysisCode = text(body.analysisCode, 'analysisCode', true);
    const analysis = await db.analysis.findUnique({ where: { code: analysisCode }, include: { unit: true } });
    const normalized = await scopedActor(db, actor);
    if (!analysis || analysis.labId && ((await policyService.resolveLab(analysis.labId, db))?.id !== material.labId ||
        !scopeGuard.canAccessEntity(normalized, { labId: material.labId }, { labField: 'labId', altLabField: 'labId' }))) throw error(409, 'REFERENCE_ANALYSIS_INVALID', 'Choose an analysis available to this laboratory.');
    const methodologyId = text(body.methodologyId, 'methodologyId');
    if (methodologyId) {
        const method = await db.methodology.findUnique({ where: { id: methodologyId } });
        if (!method || method.analysisCode !== analysisCode || method.labId && ((await policyService.resolveLab(method.labId, db))?.id !== material.labId ||
            !scopeGuard.canAccessEntity(normalized, { labId: material.labId }, { labField: 'labId', altLabField: 'labId' }))) throw error(409, 'REFERENCE_METHOD_INVALID', 'Reference methodology must belong to the analysis and laboratory.');
    }
    const format = await require('./numberFormatService').getNumberFormat(material.labId, { db });
    const number = (value, field, optional = false) => {
        if (optional && (value == null || value === '')) return null;
        const parsed = parseNumber(value, format);
        if (!parsed.valid || parsed.qualifier || !Number.isFinite(parsed.value)) throw error(400, parsed.code === 'AMBIGUOUS_NUMBER' ? parsed.code : 'REFERENCE_NUMBER_INVALID', `Enter a valid ${field}.`, { field });
        return parsed.value;
    };
    const assignedValue = number(body.assignedValue, 'assignedValue');
    const expandedUncertainty = number(body.expandedUncertainty, 'expandedUncertainty', true);
    const coverageFactor = number(body.coverageFactor, 'coverageFactor', true);
    if (expandedUncertainty !== null && coverageFactor === null) throw error(400, 'REFERENCE_COVERAGE_FACTOR_REQUIRED', 'The certificate coverage factor is required with expanded uncertainty.');
    if (expandedUncertainty !== null && expandedUncertainty < 0 || coverageFactor !== null && coverageFactor <= 0) throw error(400, 'REFERENCE_NUMBER_INVALID', 'Uncertainty must be nonnegative and coverage factor positive.');
    if (!rules.VALUE_TYPES.includes(body.valueType)) throw error(400, 'REFERENCE_VALUE_TYPE_INVALID', 'Choose a valid reference value type.');
    const unit = text(body.unit, 'unit', true), sourceUnit = await db.unit.findUnique({ where: { code: unit } });
    convertValue(assignedValue, sourceUnit, analysis.unit);
    return { referenceMaterialId: material.id, analysisCode, methodologyId, assignedValue, unit, expandedUncertainty, coverageFactor, valueType: body.valueType };
}
async function addValue(db, actor, materialId, body, now = new Date()) {
    const material = await materialFor(db, actor, materialId, true);
    const created = await db.referenceValue.create({ data: { id: randomUUID(), ...await valueData(db, actor, material, body), createdBy: actorName(actor), createdAt: now } });
    await audit(db, 'REFERENCE_VALUE', created.id, 'REFERENCE_VALUE_CREATED', actor, created, now);
    return created;
}
async function correctValue(db, actor, materialId, valueId, body, now = new Date()) {
    const material = await materialFor(db, actor, materialId, true), reason = requireReason(body.reason);
    const previous = await db.referenceValue.findUnique({ where: { id: String(valueId) } });
    if (!previous || previous.referenceMaterialId !== material.id) throw error(404, 'REFERENCE_VALUE_NOT_FOUND', 'Reference value not found.');
    if (previous.supersededById) throw error(409, 'REFERENCE_VALUE_SUPERSEDED', 'This reference value has already been superseded.');
    const replacement = { ...await valueData(db, actor, material, { ...previous, ...body,
        analysisCode: previous.analysisCode, methodologyId: previous.methodologyId }), id: randomUUID(), createdBy: actorName(actor), createdAt: now };
    const changed = await db.referenceValue.updateMany({ where: { id: previous.id, supersededById: null },
        data: { supersededById: replacement.id, supersededAt: now, supersededBy: actorName(actor), correctionReason: reason } });
    if (changed.count !== 1) throw error(409, 'REFERENCE_VALUE_SUPERSEDED', 'This reference value has already been superseded.');
    const created = await db.referenceValue.create({ data: replacement });
    await audit(db, 'REFERENCE_VALUE', previous.id, 'REFERENCE_VALUE_CORRECTED', actor, { previous, replacement: created, reason }, now);
    return created;
}

module.exports = { error, scopedActor, materialFor, listMaterials, createMaterial, changeStatus, addValue, correctValue, convertValue };
