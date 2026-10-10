/**
 * Workbench Readiness Service
 * Evaluates execution readiness for workbench tasks:
 * - Sample intake & hold status
 * - Operational prerequisites (drying, preparation gates)
 * - Equipment qualification and calibration status
 * - Technician assignment
 */

/**
 * Evaluate readiness for a single work item
 *
 * @param {object} item - WorkItem with included sample
 * @param {object} user - Current user { username, role, labId }
 * @param {object} [options] - Options { equipReq, asset }
 * @returns {object} { isReady: boolean, blockers: string[], warnings: string[], reasons: string[] }
 */
function evaluateItemReadiness(item, user, options = {}) {
    const blockers = [];
    const warnings = [];
    const reasons = [];

    const sample = item.sample;
    const analysis = item.analysis;
    const category = item.category;

    // 1. Assignment check
    if (user && user.role === 'LAB_TECHNICIAN' && item.assignedTo !== user.username) {
        blockers.push('UNASSIGNED_TO_USER');
        reasons.push(`Assigned to ${item.assignedTo}, not you`);
    }

    if (options.prerequisite && !options.prerequisite.canStart) {
        blockers.push(options.prerequisite.code || 'ANALYSIS_PREREQUISITE_BLOCKED');
        reasons.push(options.prerequisite.reason);
    }
    if (options.gateEvidence && !options.gateEvidence.satisfied) {
        for (const gate of options.gateEvidence.blocked) {
            const code = gate.mismatch ? 'GATE_STATE_MISMATCH' : `${gate.analysis}_PREREQUISITE_BLOCKED`;
            if (!blockers.includes(code)) blockers.push(code);
            reasons.push(gate.mismatch ? `${gate.analysis} WorkItem and sample flag disagree`
                : `${gate.analysis} must be completed before continuing`);
        }
    }

    // 2. Sealed state check
    const sealedStates = ['SUBMITTED', 'ACCEPTED', 'WAIVED'];
    if (sealedStates.includes(item.status)) {
        blockers.push('ITEM_SEALED');
        reasons.push(`Work item is already sealed (${item.status})`);
    }

    // 3. Sample Intake & Status Checks
    if (!sample) {
        blockers.push('SAMPLE_NOT_FOUND');
        reasons.push('Sample record is missing');
    } else {
        if (sample.status === 'ON_HOLD') {
            blockers.push('SAMPLE_ON_HOLD');
            reasons.push('Sample is ON_HOLD — contact lab manager');
        } else if (['REJECTED', 'RECEIVED_REJECTED'].includes(sample.status)) {
            blockers.push('SAMPLE_REJECTED');
            reasons.push('Sample was rejected during reception intake');
        } else if (sample.status === 'RECEIVED') {
            blockers.push('SAMPLE_NOT_ACCEPTED');
            reasons.push('Sample has not yet been accepted by reception');
        }

        if (category !== 'Post-Analytical' && !['ACCEPTED', 'PROCESSING', 'SUBMITTED_PARTIAL', 'ANALYSIS', 'PARTIALLY_COMPLETE'].includes(sample.status)) {
            blockers.push('SAMPLE_STATUS_INELIGIBLE');
            reasons.push('Sample must be accepted and open for analysis before recording work.');
        }

        // 4. Operational Gate Prerequisite Trail
        if (category !== 'Post-Analytical') {
            if (sample.dryingStatus === 'FAILED') {
                blockers.push('DRYING_FAILED');
                reasons.push('Sample drying failed — cannot proceed');
            }

            if (analysis === 'DRYING') {
                const allowedStates = ['ACCEPTED', 'PROCESSING', 'SUBMITTED_PARTIAL'];
                if (!allowedStates.includes(sample.status)) {
                    blockers.push('SAMPLE_STATUS_INELIGIBLE');
                    reasons.push(`Cannot dry sample with status ${sample.status}`);
                }
            } else if (analysis === 'PREPARATION') {
                if (sample.dryingStatus !== 'DONE') {
                    blockers.push('DRYING_PREREQUISITE_BLOCKED');
                    reasons.push(`Drying must be completed before preparation (current: ${sample.dryingStatus || 'PENDING'})`);
                }
            } else if (category !== 'Operational Gates') {
                // Standard chemical/physical/spectral analyses require both Drying and Prep DONE
                if (sample.dryingStatus !== 'DONE') {
                    blockers.push('DRYING_PREREQUISITE_BLOCKED');
                    reasons.push(`Drying must be completed before analysis (current: ${sample.dryingStatus || 'PENDING'})`);
                }
                if (sample.preparationStatus !== 'DONE') {
                    blockers.push('PREPARATION_PREREQUISITE_BLOCKED');
                    reasons.push(`Sample preparation must be completed before analysis (current: ${sample.preparationStatus || 'PENDING'})`);
                }
            }
        }
    }

    // 5. Equipment Qualification Checks
    const equipReq = options.equipReq;
    const selectedAssetId = options.selectedEquipmentId || item.equipmentId;
    const asset = options.asset;

    if ((equipReq?.isRequired || selectedAssetId) && category !== 'Operational Gates' && category !== 'Post-Analytical') {
        if (!selectedAssetId) {
            blockers.push('INSTRUMENT_REQUIRED');
            reasons.push(`Method ${analysis} requires an eligible instrument`);
        } else {
            if (equipReq?.eligibleIds && equipReq.eligibleIds.length > 0 && !equipReq.eligibleIds.includes(selectedAssetId)) {
                blockers.push('INSTRUMENT_NOT_ELIGIBLE');
                reasons.push('Selected instrument is not qualified for this analysis method');
            }

            if (!asset) {
                blockers.push('INSTRUMENT_NOT_FOUND');
                reasons.push('Selected instrument is unavailable');
            } else {
                if (asset.status !== 'IN_SERVICE') {
                    blockers.push('INSTRUMENT_OUT_OF_SERVICE');
                    reasons.push(`Instrument ${asset.name} is ${asset.status}`);
                }

                const calStatus = asset.calibrationStatus || asset.qualification?.calibrationStatus;
                const due = asset.qualification?.nextCalibrationDueDate ?? asset.nextCalibrationDueDate;
                const overdue = due != null && new Date(due).getTime() < (options.now || new Date()).getTime();
                if (calStatus === 'OVERDUE' || overdue) {
                    blockers.push('INSTRUMENT_CALIBRATION_OVERDUE');
                    reasons.push(`Instrument ${asset.name} calibration is overdue`);
                } else if (calStatus === 'DUE_SOON') {
                    warnings.push('INSTRUMENT_CALIBRATION_DUE_SOON');
                    reasons.push(`Instrument ${asset.name} calibration is due soon`);
                }
                if (asset.readiness === 'BLOCKED' || asset.readiness === 'NOT_CONFIGURED') {
                    if (!blockers.some(code => code.startsWith('INSTRUMENT_'))) {
                        blockers.push('INSTRUMENT_NOT_READY');
                        reasons.push(`Instrument ${asset.name} is not ready`);
                    }
                }
                for (const warning of asset.readinessWarnings || []) if (!warnings.includes(warning)) warnings.push(warning);
            }
        }
    }

    return {
        isReady: blockers.length === 0,
        blockers,
        warnings,
        reasons
    };
}

async function resolveEquipmentRequirement(db, item, labId) {
    const methodId = item.methodologyId || null;
    const policy = await require('./policyService').resolve(labId, 'equipment.requireEquipment',
        { db, analysisCode: item.analysis, methodologyId: methodId });
    let mapping = labId && methodId ? await db.equipmentMethodEligibility.findFirst({ where: { labId, analysisCode: item.analysis, methodId } }) : null;
    if (!mapping && labId) mapping = await db.equipmentMethodEligibility.findFirst({ where: { labId, analysisCode: item.analysis, methodId: null } });
    const eligibleIds = mapping?.eligibleEquipmentIds == null ? [] : require('./cataloguePolicy').parseJson(mapping.eligibleEquipmentIds, null);
    if (!Array.isArray(eligibleIds)) throw Object.assign(new Error('Equipment eligibility must be a list.'),
        { statusCode: 409, code: 'INSTRUMENT_CONFIGURATION_INVALID' });
    return { isRequired: policy.value === 'REQUIRED' || policy.value === 'AUTO' && Boolean(mapping?.isRequired),
        eligibleIds: eligibleIds || [], requirement: policy.value,
        requirementSource: policy.value === 'AUTO' ? { policy: policy.source, eligibilityId: mapping?.id || null,
            methodId: mapping?.methodId || null } : { policy: policy.source, scope: policy.scope }, mappingId: mapping?.id || null };
}

async function eligibleEquipmentForItem(db, item, labId, options = {}) {
    const requirement = await resolveEquipmentRequirement(db, item, labId);
    const assets = requirement.eligibleIds.length ? await db.equipmentAsset.findMany({
        where: { id: { in: requirement.eligibleIds }, labId, status: 'IN_SERVICE' }, include: { qualification: true }
    }) : [];
    const views = await Promise.all(assets.map(asset => require('./equipmentQualificationService').equipmentView(asset, { db, ...options })));
    return { requirement, eligibleEquipment: views.map(asset => ({ id: asset.id, labId: asset.labId, name: asset.name,
        assetType: asset.assetType, status: asset.status, criticality: asset.criticality,
        calibrationStatus: asset.qualification?.calibrationStatus || 'NOT_CONFIGURED',
        nextCalibrationDue: asset.qualification?.nextCalibrationDueDate || null,
        nextCalibrationDueDate: asset.qualification?.nextCalibrationDueDate || null,
        readiness: asset.readiness, readinessState: asset.readinessState, readinessWarnings: asset.readinessWarnings })) };
}

/** Application callers load evidence and catalogue before the pure evaluation. */
async function evaluateExecutionReadiness(db, item, user, options = {}) {
    const engine = require('../utils/workflowEngine');
    const workflow = require('../workflowContract');
    const gates = require('./gateEvidenceService');
    if (!item.sample) return evaluateItemReadiness(item, user, options);
    const labId = item.sample.assignedLab || item.assignedLab || item.sample.labId;
    const runContext = await require('./resultWriteService').resolveResultRunContext(db, item,
        { equipmentId: options.selectedEquipmentId });
    const selectedEquipmentId = runContext.equipmentId;
    // A transaction caller must read qualification dates afresh, rather than
    // trusting the queue's cached calibration label.
    const equipReq = await resolveEquipmentRequirement(db, item, labId);
    const selectedAsset = selectedEquipmentId ? await db.equipmentAsset.findUnique({
        where: { id: selectedEquipmentId }, include: { qualification: true }
    }) : null;
    if (selectedAsset && selectedAsset.labId !== labId) return { isReady: false, equipmentBlocked: true, blockers: ['INSTRUMENT_LAB_MISMATCH'], warnings: [], reasons: ['Instrument belongs to a different laboratory'] };
    const now = options.now || new Date();
    const asset = selectedAsset ? await require('./equipmentQualificationService').equipmentView(selectedAsset, { db, now }) : null;
    const workItems = await db.workItem.findMany({ where: { sampleId: item.sample.id } });
    const required = workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis) ? [] : item.analysis === 'DRYING' ? []
        : item.analysis === 'PREPARATION' ? ['DRYING'] : ['DRYING', 'PREPARATION'];
    const { prerequisite, category } = await engine.withCatalogue(db, () => ({
        prerequisite: engine.checkPrerequisites(item, workItems, item.sample),
        category: workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis) ? 'Post-Analytical'
            : ['DRYING', 'PREPARATION'].includes(item.analysis) ? 'Operational Gates' : item.category || engine.getAnalysisConfig(item.analysis).category
    }));
    const readiness = evaluateItemReadiness({ ...item, category }, user, { ...options, now, selectedEquipmentId, asset,
        equipReq, prerequisite,
        gateEvidence: gates.evaluateGateEvidence(item.sample, workItems, required) });
    return { ...readiness, equipmentRequired: equipReq.isRequired, instrumentSource: runContext.instrumentSource,
        equipmentId: selectedEquipmentId,
        equipmentBlocked: Boolean(readiness.blockers[0]?.startsWith('INSTRUMENT_')),
        equipmentSnapshot: asset ? { equipmentId: asset.id, assetStatus: asset.status, readiness: asset.readinessState,
            calibrationDueDate: asset.qualification?.nextCalibrationDueDate || null, criticality: asset.criticality,
            requirement: equipReq.requirement, requirementSource: equipReq.requirementSource, evaluatedAt: now.toISOString() } : null };
}

module.exports = {
    evaluateItemReadiness,
    evaluateExecutionReadiness,
    resolveEquipmentRequirement,
    eligibleEquipmentForItem
};
