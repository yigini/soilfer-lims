const { randomUUID } = require('node:crypto');
const { error, materialFor, convertValue } = require('./referenceMaterialService');
const { eligibility } = require('./referenceMaterialRules');
const policyService = require('./policyService');

function previousControls(batch) {
    try {
        const saved = typeof batch.qcResults === 'string' ? JSON.parse(batch.qcResults) : batch.qcResults;
        return Array.isArray(saved?.controls) ? saved.controls : [];
    } catch { return []; }
}
const sameNumber = (left, right) => Number.isFinite(left) && Number.isFinite(right) &&
    Math.abs(left - right) <= Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 4;

// Called by both QC entry points inside their existing write transaction. Only
// the stored batch snapshot may grandfather a placement; client details cannot.
async function linkReferences(db, batch, actor, payload, now = new Date()) {
    if (!Array.isArray(payload.controls)) return payload;
    const saved = previousControls(batch), controls = [];
    let anchor;
    for (const [index, input] of payload.controls.entries()) {
        if (!input || typeof input !== 'object') { controls.push(input); continue; }
        if (!input.referenceMaterialId) {
            if (input.referenceValueId || input.referenceUse) throw error(400, 'REFERENCE_MATERIAL_REQUIRED', 'Select a reference material.');
            const { referenceSnapshot, ...unlinked } = input;
            controls.push(unlinked);
            continue;
        }
        if (!['CRM', 'LRM'].includes(input.referenceUse)) throw error(400, 'REFERENCE_USE_REQUIRED', 'Choose CRM or LRM use.');
        if (Object.hasOwn(input, 'methodologyId')) throw error(400, 'REFERENCE_METHOD_SERVER_MANAGED', 'The batch determines the reference methodology.');
        const material = await materialFor(db, actor, input.referenceMaterialId);
        const lab = await policyService.resolveLab(batch.labId, db);
        if (!lab || lab.id !== material.labId) throw error(409, 'REFERENCE_MATERIAL_INELIGIBLE', 'Reference material must belong to the batch laboratory.', { reason: 'BATCH_LAB_MISMATCH' });
        const prior = input.id ? saved.find(row => row.id === input.id) : saved[index];
        const unchanged = prior?.referenceSnapshot && prior.referenceMaterialId === material.id &&
            prior.referenceUse === input.referenceUse && (!input.referenceValueId || input.referenceValueId === prior.referenceValueId);
        if (unchanged) {
            const value = await db.referenceValue.findUnique({ where: { id: prior.referenceValueId } });
            if (!value || value.referenceMaterialId !== material.id || value.analysisCode !== batch.analysis ||
                !Number.isFinite(prior.referenceSnapshot.expected)) throw error(409, 'REFERENCE_VALUE_MISMATCH', 'The saved reference placement needs review.');
            if (input.expected !== null && input.expected !== undefined && !sameNumber(input.expected, prior.referenceSnapshot.expected)) {
                throw error(409, 'REFERENCE_VALUE_MISMATCH', 'Expected value must match the saved reference value.');
            }
            controls.push({ ...input, id: prior.id, expected: prior.referenceSnapshot.expected,
                referenceValueId: prior.referenceValueId, referenceSnapshot: prior.referenceSnapshot });
            continue;
        }
        const state = eligibility(material, now);
        if (!state.eligible) throw error(409, 'REFERENCE_MATERIAL_INELIGIBLE', 'Reference material is ineligible for placement.', { reason: state.reason });
        if (!['CRM', 'LRM', 'CHECK_STANDARD'].includes(material.kind)) throw error(409, 'REFERENCE_USE_INCOMPATIBLE', 'This material kind cannot be used as a control.');
        if (input.referenceUse === 'CRM' && material.kind !== 'CRM') throw error(409, 'REFERENCE_VALUE_NOT_CERTIFIED', 'CRM use requires a certified reference material and value.');
        if (anchor === undefined) {
            const members = await db.workItem.findMany({ where: { batchId: batch.id }, select: { methodologyId: true } });
            const methods = new Set(members.map(row => row.methodologyId));
            anchor = members.length && methods.size === 1 && !methods.has(null) ? [...methods][0] : null;
        }
        const current = await db.referenceValue.findMany({ where: { referenceMaterialId: material.id,
            analysisCode: batch.analysis, supersededById: null } });
        const value = (anchor && current.find(row => row.methodologyId === anchor)) || current.find(row => row.methodologyId === null);
        if (!value) throw error(409, anchor === null && current.some(row => row.methodologyId) ? 'REFERENCE_VALUE_METHOD_AMBIGUOUS' :
            input.referenceUse === 'CRM' ? 'REFERENCE_VALUE_NOT_CERTIFIED' : 'REFERENCE_VALUE_NOT_FOUND', 'No eligible reference value exists for this batch analysis and method.');
        if (input.referenceValueId && input.referenceValueId !== value.id) throw error(409, 'REFERENCE_VALUE_MISMATCH', 'Reference value does not match the batch analysis and method.');
        if (input.referenceUse === 'CRM' && value.valueType !== 'CERTIFIED') throw error(409, 'REFERENCE_VALUE_NOT_CERTIFIED', 'CRM use requires a certified value.');
        const [analysis, sourceUnit] = await Promise.all([
            db.analysis.findUnique({ where: { code: batch.analysis }, include: { unit: true } }),
            db.unit.findUnique({ where: { code: value.unit } })
        ]);
        const expected = convertValue(value.assignedValue, sourceUnit, analysis?.unit);
        if (input.expected !== null && input.expected !== undefined && !sameNumber(input.expected, expected)) throw error(409, 'REFERENCE_VALUE_MISMATCH', 'Expected value must match the converted reference value.');
        controls.push({ ...input, id: input.id || randomUUID(), expected, referenceValueId: value.id,
            referenceSnapshot: { referenceMaterialId: material.id, referenceValueId: value.id, referenceUse: input.referenceUse,
                methodologyId: anchor, valueMethodologyId: value.methodologyId, expected, analysisUnit: analysis.unit.code,
                assignedValue: value.assignedValue, unit: value.unit, expandedUncertainty: value.expandedUncertainty,
                coverageFactor: value.coverageFactor, valueType: value.valueType, materialStatus: material.status,
                materialExpiry: material.expiryDate, inventoryLotId: material.inventoryLotId,
                inventoryStatus: material.inventoryLot?.status || null, inventoryExpiry: material.inventoryLot?.expiryDate || null,
                effectiveExpiry: state.effectiveExpiry || null, placedAt: now.toISOString(), placedBy: actor.username } });
    }
    return { ...payload, controls };
}

function retainReferences(evaluated, payload) {
    (evaluated.controls || []).forEach((row, index) => {
        const input = payload.controls?.[index];
        if (!input?.referenceMaterialId) return;
        // Keep the converted certificate value without the legacy display round.
        Object.assign(row, { expected: input.expected, referenceMaterialId: input.referenceMaterialId,
            referenceValueId: input.referenceValueId, referenceUse: input.referenceUse, referenceSnapshot: input.referenceSnapshot });
    });
    return evaluated;
}

module.exports = { linkReferences, retainReferences };
