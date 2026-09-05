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
    if (user && user.role === 'LAB_TECHNICIAN' && item.assignedTo && item.assignedTo !== user.username) {
        blockers.push('UNASSIGNED_TO_USER');
        reasons.push(`Assigned to ${item.assignedTo}, not you`);
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
        } else if (sample.status === 'REJECTED') {
            blockers.push('SAMPLE_REJECTED');
            reasons.push('Sample was rejected during reception intake');
        } else if (sample.status === 'RECEIVED') {
            blockers.push('SAMPLE_NOT_ACCEPTED');
            reasons.push('Sample has not yet been accepted by reception');
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

    if (equipReq?.isRequired && category !== 'Operational Gates' && category !== 'Post-Analytical') {
        if (!selectedAssetId) {
            blockers.push('INSTRUMENT_REQUIRED');
            reasons.push(`Method ${analysis} requires an eligible instrument`);
        } else {
            if (equipReq.eligibleIds && equipReq.eligibleIds.length > 0 && !equipReq.eligibleIds.includes(selectedAssetId)) {
                blockers.push('INSTRUMENT_NOT_ELIGIBLE');
                reasons.push('Selected instrument is not qualified for this analysis method');
            }

            if (asset) {
                if (asset.status !== 'IN_SERVICE') {
                    blockers.push('INSTRUMENT_OUT_OF_SERVICE');
                    reasons.push(`Instrument ${asset.name} is ${asset.status}`);
                }

                const calStatus = asset.calibrationStatus || asset.qualification?.calibrationStatus;
                if (calStatus === 'OVERDUE') {
                    blockers.push('INSTRUMENT_CALIBRATION_OVERDUE');
                    reasons.push(`Instrument ${asset.name} calibration is overdue`);
                } else if (calStatus === 'DUE_SOON') {
                    warnings.push('INSTRUMENT_CALIBRATION_DUE_SOON');
                    reasons.push(`Instrument ${asset.name} calibration is due soon`);
                }
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

module.exports = {
    evaluateItemReadiness
};
