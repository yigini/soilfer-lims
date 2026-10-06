const { randomUUID } = require('node:crypto');
const { materialFor, convertValue } = require('./referenceMaterialService');
const { eligibility } = require('./referenceMaterialRules');
const policyService = require('./policyService');
const { actorName } = require('./workflowStateRules');
const error = (code, message, details = {}, statusCode = 409) => Object.assign(new Error(message), { statusCode, code, details });
const KINDS = Object.freeze({ CRM: ['CRM'], LRM: ['CRM', 'LRM', 'CHECK_STANDARD'],
    ICV: ['CHECK_STANDARD', 'CRM'], CCV: ['CHECK_STANDARD', 'CALIBRATION_STANDARD', 'CRM'], CCB: ['BLANK_MATRIX'] });

// Resolve every served analyte before mutating any binding. Existing placements
// retain their exact value revision; catalogue updates never refresh them.
async function preparePositionBindings(db, { batch, position, analyses, actor, referenceMaterialId, referenceValueIds = {}, reason = null }, now = new Date()) {
    if (!KINDS[position.kind]) throw error('REFERENCE_USE_INCOMPATIBLE', 'This position cannot hold a reference material.');
    if (!analyses.length) throw error('REFERENCE_VALUE_MISMATCH', 'The reference position serves no analyte.');
    const current = (position.references || []).filter(row => !row.supersededById);
    const correctionReason = typeof reason === 'string' ? reason.trim() : '';
    if (current.some(row => row.referenceMaterialId !== referenceMaterialId) && !correctionReason) {
        throw error('REFERENCE_POSITION_LOT_CONFLICT', 'One physical position must use the same lot for all analytes.');
    }
    const material = await materialFor(db, actor, referenceMaterialId);
    const lab = await policyService.resolveLab(batch.labId, db);
    if (!lab || material.labId !== lab.id) throw error('REFERENCE_MATERIAL_INELIGIBLE', 'Reference material must belong to the batch laboratory.', { reason: 'BATCH_LAB_MISMATCH' });
    if (!KINDS[position.kind].includes(material.kind)) throw error('REFERENCE_USE_INCOMPATIBLE', 'The material kind cannot serve this QC position.');
    const unchanged = analyses.every(analyte => current.some(row => row.analysisCode === analyte.analysisCode &&
        row.referenceMaterialId === material.id && (!referenceValueIds[analyte.analysisCode] || row.referenceValueId === referenceValueIds[analyte.analysisCode]) &&
        JSON.parse(row.referenceSnapshot).methodologyId === (analyte.methodologyId || null)));
    if (unchanged) return { replacements: [], bindings: analyses.map(analyte => current.find(row => row.analysisCode === analyte.analysisCode)) };
    if (current.length && !correctionReason) throw error('QC_CORRECTION_REASON_REQUIRED', 'A reason is required to change a reference placement.', {}, 400);
    const state = eligibility(material, now);
    if (!state.eligible) throw error('REFERENCE_MATERIAL_INELIGIBLE', 'Reference material is ineligible for placement.', { reason: state.reason });
    const bindings = [];
    for (const analyte of analyses) {
        const analysisCode = analyte.analysisCode, methodologyId = analyte.methodologyId || null;
        try {
            let value = null, expected = null, analysis = null;
            if (position.kind !== 'CCB') {
                const values = await db.referenceValue.findMany({ where: { referenceMaterialId: material.id, analysisCode, supersededById: null } });
                value = (methodologyId && values.find(row => row.methodologyId === methodologyId)) || values.find(row => row.methodologyId === null);
                if (!value) throw error(!methodologyId && values.some(row => row.methodologyId) ? 'REFERENCE_VALUE_METHOD_AMBIGUOUS' :
                    position.kind === 'CRM' ? 'REFERENCE_VALUE_NOT_CERTIFIED' : 'REFERENCE_VALUE_NOT_FOUND', 'No eligible reference value exists for this analysis and method.');
                if (referenceValueIds[analysisCode] && referenceValueIds[analysisCode] !== value.id) throw error('REFERENCE_VALUE_MISMATCH', 'Reference value does not match the analysis and method.');
                if (position.kind === 'CRM' && value.valueType !== 'CERTIFIED') throw error('REFERENCE_VALUE_NOT_CERTIFIED', 'CRM requires a certified value.');
                const sourceUnit = await db.unit.findUnique({ where: { code: value.unit } });
                analysis = await db.analysis.findUnique({ where: { code: analysisCode }, include: { unit: true } });
                expected = convertValue(value.assignedValue, sourceUnit, analysis?.unit);
            } else if (referenceValueIds[analysisCode]) throw error('REFERENCE_VALUE_MISMATCH', 'A calibration blank has no assigned value.');
            bindings.push({ id: randomUUID(), positionId: position.id, analysisCode, referenceMaterialId: material.id,
                referenceValueId: value?.id || null, referenceUse: position.kind,
                referenceSnapshot: JSON.stringify({ referenceMaterialId: material.id, referenceValueId: value?.id || null,
                    referenceUse: position.kind, methodologyId, valueMethodologyId: value?.methodologyId || null, expected,
                    analysisUnit: analysis?.unit?.code || null, assignedValue: value?.assignedValue ?? null, unit: value?.unit || null,
                    expandedUncertainty: value?.expandedUncertainty ?? null, coverageFactor: value?.coverageFactor ?? null, valueType: value?.valueType || null,
                    materialKind: material.kind, materialStatus: material.status, materialExpiry: material.expiryDate,
                    inventoryLotId: material.inventoryLotId, inventoryStatus: material.inventoryLot?.status || null,
                    inventoryExpiry: material.inventoryLot?.expiryDate || null, effectiveExpiry: state.effectiveExpiry || null,
                    placedAt: now.toISOString(), placedBy: actorName(actor) }), boundBy: actorName(actor), boundAt: now,
                correctionReason: correctionReason || null });
        } catch (cause) {
            if (cause.statusCode) cause.details = { ...cause.details, analysisCode };
            throw cause;
        }
    }
    return { bindings, replacements: current.map(row => ({ previous: row, replacement: bindings.find(binding => binding.analysisCode === row.analysisCode) })) };
}

async function applyPositionBindings(tx, plan) {
    for (const { previous, replacement } of plan.replacements) {
        if (!replacement) throw error('REFERENCE_VALUE_MISMATCH', 'Every existing analyte binding must be retained or superseded.');
        const changed = await tx.batchPositionReference.updateMany({ where: { id: previous.id, supersededById: null }, data: { supersededById: replacement.id } });
        if (changed.count !== 1) throw error('REFERENCE_POSITION_LOT_CONFLICT', 'The reference placement changed. Reload before retrying.');
    }
    for (const binding of plan.bindings) if (!binding.supersededById && (!binding.id || !await tx.batchPositionReference.findUnique({ where: { id: binding.id } }))) {
        await tx.batchPositionReference.create({ data: binding });
    }
}

async function prepareBuildBindings(db, batch, sequence, selections, actor, now = new Date()) {
    const chosen = new Map();
    for (const selection of selections) for (const reference of selection.references || []) {
        const matches = sequence.positions.filter(position => position.kind === reference.positionKind && position.servedAnalytes.includes(selection.analysisCode));
        if (!matches.length) throw error('REFERENCE_VALUE_MISMATCH', 'The selected reference has no matching position.', { analysisCode: selection.analysisCode });
        for (const position of matches) {
            const prior = chosen.get(position.id);
            if (prior && prior.referenceMaterialId !== reference.referenceMaterialLotId) throw error('REFERENCE_POSITION_LOT_CONFLICT', 'A shared position cannot use different physical lots.');
            chosen.set(position.id, { position, referenceMaterialId: reference.referenceMaterialLotId });
        }
    }
    const plans = [];
    for (const { position, referenceMaterialId } of chosen.values()) plans.push(await preparePositionBindings(db, {
        batch, position, analyses: sequence.forecasts.filter(row => position.servedAnalytes.includes(row.analysisCode)), actor, referenceMaterialId
    }, now));
    return plans;
}

module.exports = { preparePositionBindings, applyPositionBindings, prepareBuildBindings };
