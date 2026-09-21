/**
 * FAO SoilFER & ISO/IEC 17025 Typed Quality Control Service
 * 
 * Evaluates:
 * 1. Method Blanks (Limit of Quantification / Background threshold)
 * 2. Laboratory Duplicates (Relative Percent Difference - RPD %)
 * 3. Certified Reference Materials / Controls (Recovery %)
 * 4. Automated Batch Quality Disposition (QC_PASS / QC_FAIL)
 */

/**
 * Robust numeric parser: rejects null, undefined, boolean, whitespace and non-finite values
 */
function parseNumericMeasurement(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'boolean') return NaN;
    if (typeof val === 'number') {
        return Number.isFinite(val) ? val : NaN;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return NaN;
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : NaN;
    }
    return NaN;
}

/**
 * Evaluate a single Method / Reagent Blank
 * @param {Object} blank - { id, value, maxAllowed, label }
 * @param {Object} policy - Method/system policy limits
 * @returns {Object} Evaluated blank result
 */
function evaluateBlank(blank = {}, policy = {}) {
    const id = blank.id || `BLK-${Date.now()}`;
    const label = blank.label || 'Method Blank';
    const rawVal = blank.value !== undefined ? blank.value : blank.measured;
    const value = parseNumericMeasurement(rawVal);
    
    // Limits must come from policy/standard, not arbitrarily loosened by caller
    const maxAllowed = (policy && typeof policy.maxAllowed === 'number') ? policy.maxAllowed : 0.05;

    if (isNaN(value)) {
        return {
            id,
            label,
            type: 'BLANK',
            value: null,
            maxAllowed,
            status: 'FAIL',
            error: 'Missing, non-numeric, or non-finite blank value',
            details: 'Invalid blank measurement (null, boolean, or non-finite)'
        };
    }

    const passed = Math.abs(value) <= maxAllowed;
    return {
        id,
        label,
        type: 'BLANK',
        value: Number(value.toFixed(4)),
        maxAllowed,
        status: passed ? 'PASS' : 'FAIL',
        details: passed ? `Blank within acceptable threshold (≤ ${maxAllowed})` : `Blank exceeds limit (${value} > ${maxAllowed})`
    };
}

/**
 * Evaluate an Analytical Duplicate / Replicate
 * Calculates Relative Percent Difference: RPD = (|V1 - V2| / ((V1 + V2) / 2)) * 100%
 * @param {Object} dup - { id, value1, value2, maxRpd, label }
 * @param {Object} policy - Method/system policy limits
 * @returns {Object} Evaluated duplicate result
 */
function evaluateDuplicate(dup = {}, policy = {}) {
    const id = dup.id || `DUP-${Date.now()}`;
    const label = dup.label || 'Analytical Duplicate';
    const v1 = parseNumericMeasurement(dup.value1 !== undefined ? dup.value1 : dup.val1);
    const v2 = parseNumericMeasurement(dup.value2 !== undefined ? dup.value2 : dup.val2);
    const maxRpd = (policy && typeof policy.maxRpd === 'number') ? policy.maxRpd : 10.0;

    if (isNaN(v1) || isNaN(v2)) {
        return {
            id,
            label,
            type: 'DUPLICATE',
            value1: isNaN(v1) ? null : v1,
            value2: isNaN(v2) ? null : v2,
            rpd: null,
            maxRpd,
            status: 'FAIL',
            error: 'Missing, non-numeric, or non-finite duplicate values',
            details: 'Invalid duplicate measurement'
        };
    }

    const avg = (v1 + v2) / 2;
    let rpd = 0;
    if (avg !== 0) {
        rpd = (Math.abs(v1 - v2) / Math.abs(avg)) * 100;
    }

    const passed = rpd <= maxRpd;
    return {
        id,
        label,
        type: 'DUPLICATE',
        value1: Number(v1.toFixed(4)),
        value2: Number(v2.toFixed(4)),
        rpd: Number(rpd.toFixed(2)),
        maxRpd,
        status: passed ? 'PASS' : 'FAIL',
        details: passed ? `RPD ${rpd.toFixed(1)}% ≤ ${maxRpd}% (Acceptable)` : `RPD ${rpd.toFixed(1)}% > ${maxRpd}% (Precision failure)`
    };
}

/**
 * Evaluate a Certified Reference Material (CRM) / Control Sample
 * Calculates Recovery %: Recovery = (measured / expected) * 100%
 * @param {Object} crm - { id, expected, measured, minRecovery, maxRecovery, label }
 * @param {Object} policy - Method/system policy limits
 * @returns {Object} Evaluated control result
 */
function evaluateControl(crm = {}, policy = {}) {
    const id = crm.id || `CRM-${Date.now()}`;
    const label = crm.label || 'Certified Reference Material';
    const expected = parseNumericMeasurement(crm.expected !== undefined ? crm.expected : crm.expectedValue);
    const measured = parseNumericMeasurement(crm.measured !== undefined ? crm.measured : (crm.value !== undefined ? crm.value : crm.val));
    const minRecovery = (policy && typeof policy.minRecovery === 'number') ? policy.minRecovery : 90.0;
    const maxRecovery = (policy && typeof policy.maxRecovery === 'number') ? policy.maxRecovery : 110.0;

    if (isNaN(expected) || isNaN(measured) || expected <= 0) {
        return {
            id,
            label,
            type: 'CONTROL',
            expected: isNaN(expected) ? null : expected,
            measured: isNaN(measured) ? null : measured,
            recoveryPct: null,
            minRecovery,
            maxRecovery,
            status: 'FAIL',
            error: 'Invalid expected or measured CRM value',
            details: 'Invalid control measurement'
        };
    }

    const recoveryPct = (measured / expected) * 100;
    const passed = recoveryPct >= minRecovery && recoveryPct <= maxRecovery;

    return {
        id,
        label,
        type: 'CONTROL',
        expected: Number(expected.toFixed(4)),
        measured: Number(measured.toFixed(4)),
        recoveryPct: Number(recoveryPct.toFixed(2)),
        minRecovery,
        maxRecovery,
        status: passed ? 'PASS' : 'FAIL',
        details: passed ? `Recovery ${recoveryPct.toFixed(1)}% within [${minRecovery}%, ${maxRecovery}%]` : `Recovery ${recoveryPct.toFixed(1)}% out of bounds [${minRecovery}%, ${maxRecovery}%]`
    };
}

/**
 * Comprehensive Evaluation of an entire QC Batch measurement payload
 * @param {Object} qcData - { blanks: [], duplicates: [], controls: [] }
 * @param {Object} options - { runProfile, policy }
 * @returns {Object} Evaluated batch QC results with overall status (QC_PASS, QC_FAIL, OPEN)
 */
function evaluateBatchQc(qcData = {}, options = {}) {
    const rawBlanks = Array.isArray(qcData.blanks) ? qcData.blanks : [];
    const rawDuplicates = Array.isArray(qcData.duplicates) ? qcData.duplicates : [];
    const rawControls = Array.isArray(qcData.controls) ? qcData.controls : [];

    const policy = options.policy || {};
    const evaluatedBlanks = rawBlanks.map(b => evaluateBlank(b, policy.blank));
    const evaluatedDuplicates = rawDuplicates.map(d => evaluateDuplicate(d, policy.duplicate));
    const evaluatedControls = rawControls.map(c => evaluateControl(c, policy.control));

    const allEvaluated = [...evaluatedBlanks, ...evaluatedDuplicates, ...evaluatedControls];
    const totalCount = allEvaluated.length;
    const failedCount = allEvaluated.filter(item => item.status === 'FAIL' || item.status === 'INVALID').length;
    const passedCount = allEvaluated.filter(item => item.status === 'PASS').length;

    // Check completeness against required runProfile QC slots
    const runProfile = options.runProfile;
    const missingQcTypes = [];
    if (runProfile && Array.isArray(runProfile.qcSlots)) {
        const requiredSlotTypes = new Set(runProfile.qcSlots.map(s => s.type));
        if (requiredSlotTypes.has('BLANK') && evaluatedBlanks.length === 0) {
            missingQcTypes.push('BLANK');
        }
        if (requiredSlotTypes.has('CONTROL') && evaluatedControls.length === 0) {
            missingQcTypes.push('CONTROL');
        }
        if (requiredSlotTypes.has('DUPLICATE') && evaluatedDuplicates.length === 0) {
            missingQcTypes.push('DUPLICATE');
        }
    }

    let overallStatus = 'OPEN';
    let incompleteReason = null;

    if (totalCount > 0) {
        if (failedCount > 0) {
            overallStatus = 'QC_FAIL';
        } else if (missingQcTypes.length > 0) {
            overallStatus = 'QC_FAIL';
            incompleteReason = `Missing required QC measurements for profile ${runProfile?.profileKey || 'active'}: ${missingQcTypes.join(', ')}`;
        } else {
            overallStatus = 'QC_PASS';
        }
    }

    return {
        blanks: evaluatedBlanks,
        duplicates: evaluatedDuplicates,
        controls: evaluatedControls,
        summary: {
            totalQcSamples: totalCount,
            passed: passedCount,
            failed: failedCount,
            missingRequired: missingQcTypes,
            incompleteReason,
            evaluatedAt: new Date().toISOString()
        },
        overallStatus
    };
}

/**
 * Check if a batch allows work items to be accepted in review
/**
 * Check if a batch allows work items to be accepted in review
 * @param {Object} batch - Batch object with status and optional disposition
 * @param {Object} options - Optional { prisma: PrismaClient, flagResults: boolean }
 * @returns {{ allowed: boolean, status: string, warning?: string, error?: string }}
 */
function checkBatchDisposition(batch, options = {}) {
    if (!batch) {
        return { allowed: false, status: 'NO_BATCH', error: 'No batch associated with this determination.' };
    }

    if (batch.status === 'QC_PASS') {
        return { allowed: true, status: 'QC_PASS' };
    }

    if (batch.status === 'CLOSED') {
        return { allowed: true, status: 'CLOSED' };
    }

    if (batch.status === 'OPEN' || batch.status === 'RUNNING') {
        return {
            allowed: false,
            status: batch.status,
            error: `Batch ${batch.id || ''} QC is still ${batch.status} — not sufficient evidence for a QC-required method.`
        };
    }

    if (batch.status === 'QC_FAIL') {
        let disp = batch.disposition;
        if (typeof disp === 'string') {
            try { disp = JSON.parse(disp); } catch (e) { disp = null; }
        }

        if (disp && disp.decision === 'PROCEED_WITH_WARNING') {
            return {
                allowed: true,
                status: 'QC_PASS_WITH_WARNING',
                warning: `QC Warning Overridden: ${disp.reason || 'Manager Approved'}`
            };
        }

        return {
            allowed: false,
            status: 'QC_FAIL',
            error: `Batch ${batch.id || ''} is in FAILED QC status without manager override disposition.`
        };
    }

    return { allowed: false, status: batch.status || 'UNKNOWN', error: `Batch status '${batch.status}' unrecognized or unevidenced.` };
}

/**
 * Flags or clears flags on results carrying a batchId based on batch status and disposition
 * @param {Object} prismaClient - Prisma client instance
 * @param {string} batchId - The batch ID
 * @param {string} status - The batch status ('QC_PASS', 'QC_FAIL', etc.)
 * @param {Object|string} disposition - The batch disposition
 * @returns {Promise<number>} Number of results updated
 */
async function flagBatchResults(prismaClient, batchId, status, disposition = null) {
    if (!prismaClient || !batchId) return 0;

    let parsedDisp = disposition;
    if (typeof parsedDisp === 'string') {
        try { parsedDisp = JSON.parse(parsedDisp); } catch (e) { parsedDisp = null; }
    }

    const decision = parsedDisp?.decision || null;
    const isProceedWarning = decision === 'PROCEED_WITH_WARNING';
    const isReanalyze = decision === 'REANALYZE_BATCH';
    const isReject = decision === 'REJECT_BATCH';

    const results = await prismaClient.result.findMany({
        where: { batchId },
        include: { sample: { select: { id: true, status: true } } }
    });
    let count = 0;

    let publishedSampleIds = new Set();
    if (prismaClient.report && typeof prismaClient.report.findMany === 'function') {
        const sampleIds = results.map(r => r.sampleId).filter(Boolean);
        if (sampleIds.length > 0) {
            const pubReports = await prismaClient.report.findMany({
                where: {
                    sampleId: { in: sampleIds },
                    status: { in: ['PUBLISHED', 'SUPERSEDED'] }
                },
                select: { sampleId: true }
            });
            publishedSampleIds = new Set(pubReports.map(pr => pr.sampleId));
        }
    }

    const QC_OWNED_FLAGS = ['QC_BATCH_FAILED', 'QC_WARNING_OVERRIDDEN', 'QC_BATCH_REANALYZE_REQUESTED', 'QC_BATCH_REJECTED'];
    const PROVENANCE_INVALID_FLAGS = ['ORIGINALLY_INVALID', 'UNFLAGGED_INVALID', 'MALFORMED_FLAGS_INVALID'];

    for (const res of results) {
        // Protection for terminal, published, and superseded records: immutable history
        const isSampleTerminal = res.sample && ['RELEASED', 'APPROVED', 'ARCHIVED', 'DISPOSED'].includes(res.sample.status);
        const isPublished = publishedSampleIds.has(res.sampleId) || res.isPublished;
        const isSuperseded = res.isCurrent === false || Boolean(res.supersededBy);
        if (isSampleTerminal || isPublished || isSuperseded) {
            continue;
        }

        let flags = [];
        let isMalformedFlags = false;
        try {
            if (typeof res.flags === 'string') {
                flags = JSON.parse(res.flags);
                if (!Array.isArray(flags)) {
                    flags = [];
                    isMalformedFlags = true;
                }
            } else if (Array.isArray(res.flags)) {
                flags = [...res.flags];
            } else if (res.flags) {
                flags = [];
                isMalformedFlags = true;
            }
        } catch (e) {
            flags = [];
            isMalformedFlags = true;
        }

        const wasInitiallyValid = Boolean(res.isValid);
        const initialFlags = Array.isArray(flags) ? [...flags] : [];
        const hadQcBatchFailed = initialFlags.includes('QC_BATCH_FAILED');
        const hadPriorProvenanceInvalid = initialFlags.some(f => PROVENANCE_INVALID_FLAGS.includes(f));
        const hadPriorRejection = initialFlags.includes('QC_BATCH_REJECTED') || initialFlags.includes('QC_BATCH_REANALYZE_REQUESTED');
        const nonQcFlags = initialFlags.filter(f => !QC_OWNED_FLAGS.includes(f) && !PROVENANCE_INVALID_FLAGS.includes(f));

        if (status === 'QC_FAIL') {
            if (isProceedWarning) {
                // Strip QC failure/rejection flags
                flags = flags.filter(f => f !== 'QC_BATCH_FAILED' && f !== 'QC_BATCH_REJECTED' && f !== 'QC_BATCH_REANALYZE_REQUESTED');
                if (!flags.includes('QC_WARNING_OVERRIDDEN')) flags.push('QC_WARNING_OVERRIDDEN');

                // Preserve independent validity:
                // If it was already valid, it stays valid.
                // If it was invalid, it ONLY becomes valid if QC_BATCH_FAILED was the sole cause of invalidity.
                let isValid = false;
                if (wasInitiallyValid) {
                    isValid = true;
                } else if (hadQcBatchFailed && !hadPriorProvenanceInvalid && !isMalformedFlags && nonQcFlags.length === 0 && !hadPriorRejection) {
                    isValid = true;
                }

                await prismaClient.result.update({
                    where: { id: res.id },
                    data: { isValid, flags: JSON.stringify(flags) }
                });
            } else if (isReanalyze) {
                flags = flags.filter(f => f !== 'QC_BATCH_FAILED' && f !== 'QC_WARNING_OVERRIDDEN');
                if (!flags.includes('QC_BATCH_REANALYZE_REQUESTED')) flags.push('QC_BATCH_REANALYZE_REQUESTED');
                await prismaClient.result.update({
                    where: { id: res.id },
                    data: { isValid: false, flags: JSON.stringify(flags) }
                });
            } else if (isReject) {
                flags = flags.filter(f => f !== 'QC_BATCH_FAILED' && f !== 'QC_WARNING_OVERRIDDEN');
                if (!flags.includes('QC_BATCH_REJECTED')) flags.push('QC_BATCH_REJECTED');
                await prismaClient.result.update({
                    where: { id: res.id },
                    data: { isValid: false, flags: JSON.stringify(flags) }
                });
            } else {
                if (!flags.includes('QC_BATCH_FAILED')) flags.push('QC_BATCH_FAILED');

                // Preserve provenance if the result was already invalid independently before this QC failure
                if ((!wasInitiallyValid && !hadQcBatchFailed) || isMalformedFlags) {
                    if (!flags.includes('ORIGINALLY_INVALID')) {
                        flags.push('ORIGINALLY_INVALID');
                    }
                }

                await prismaClient.result.update({
                    where: { id: res.id },
                    data: { isValid: false, flags: JSON.stringify(flags) }
                });
            }
            count++;
        } else if (status === 'QC_PASS') {
            flags = flags.filter(f => f !== 'QC_BATCH_FAILED');

            // Preserve independent validity:
            // If it was already valid, it stays valid.
            // If it was invalid, it ONLY becomes valid if QC_BATCH_FAILED was present, it was NOT originally invalid for other reasons,
            // had no non-QC flags, was not malformed, and had no prior rejection.
            let isValid = false;
            if (wasInitiallyValid) {
                isValid = true;
            } else if (hadQcBatchFailed && !hadPriorProvenanceInvalid && !isMalformedFlags && nonQcFlags.length === 0 && !hadPriorRejection) {
                isValid = true;
            }

            await prismaClient.result.update({
                where: { id: res.id },
                data: { isValid, flags: JSON.stringify(flags) }
            });
            count++;
        }
    }

    return count;
}

module.exports = {
    evaluateBlank,
    evaluateDuplicate,
    evaluateControl,
    evaluateBatchQc,
    checkBatchDisposition,
    flagBatchResults
};
