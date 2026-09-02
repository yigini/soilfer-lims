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
 * Evaluate a single Method / Reagent Blank
 * @param {Object} blank - { id, value, maxAllowed, label }
 * @returns {Object} Evaluated blank result
 */
function evaluateBlank(blank = {}) {
    const id = blank.id || `BLK-${Date.now()}`;
    const label = blank.label || 'Method Blank';
    const value = Number(blank.value !== undefined ? blank.value : blank.measured);
    const maxAllowed = Number(blank.maxAllowed !== undefined ? blank.maxAllowed : 0.05);

    if (isNaN(value)) {
        return { id, label, type: 'BLANK', value: null, maxAllowed, status: 'INVALID', error: 'Non-numeric blank value' };
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
 * @returns {Object} Evaluated duplicate result
 */
function evaluateDuplicate(dup = {}) {
    const id = dup.id || `DUP-${Date.now()}`;
    const label = dup.label || 'Analytical Duplicate';
    const v1 = Number(dup.value1 !== undefined ? dup.value1 : dup.val1);
    const v2 = Number(dup.value2 !== undefined ? dup.value2 : dup.val2);
    const maxRpd = Number(dup.maxRpd !== undefined ? dup.maxRpd : 10.0);

    if (isNaN(v1) || isNaN(v2)) {
        return { id, label, type: 'DUPLICATE', value1: v1, value2: v2, rpd: null, maxRpd, status: 'INVALID', error: 'Non-numeric duplicate values' };
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
 * @returns {Object} Evaluated control result
 */
function evaluateControl(crm = {}) {
    const id = crm.id || `CRM-${Date.now()}`;
    const label = crm.label || 'Certified Reference Material';
    const expected = Number(crm.expected !== undefined ? crm.expected : crm.expectedValue);
    const measured = Number(crm.measured !== undefined ? crm.measured : (crm.value !== undefined ? crm.value : crm.val));
    const minRecovery = Number(crm.minRecovery !== undefined ? crm.minRecovery : 90.0);
    const maxRecovery = Number(crm.maxRecovery !== undefined ? crm.maxRecovery : 110.0);

    if (isNaN(expected) || isNaN(measured) || expected <= 0) {
        return { id, label, type: 'CONTROL', expected, measured, recoveryPct: null, minRecovery, maxRecovery, status: 'INVALID', error: 'Invalid expected or measured value' };
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
 * @returns {Object} Evaluated batch QC results with overall status (QC_PASS, QC_FAIL, OPEN)
 */
function evaluateBatchQc(qcData = {}) {
    const rawBlanks = Array.isArray(qcData.blanks) ? qcData.blanks : [];
    const rawDuplicates = Array.isArray(qcData.duplicates) ? qcData.duplicates : [];
    const rawControls = Array.isArray(qcData.controls) ? qcData.controls : [];

    const evaluatedBlanks = rawBlanks.map(evaluateBlank);
    const evaluatedDuplicates = rawDuplicates.map(evaluateDuplicate);
    const evaluatedControls = rawControls.map(evaluateControl);

    const allEvaluated = [...evaluatedBlanks, ...evaluatedDuplicates, ...evaluatedControls];
    const totalCount = allEvaluated.length;
    const failedCount = allEvaluated.filter(item => item.status === 'FAIL' || item.status === 'INVALID').length;
    const passedCount = allEvaluated.filter(item => item.status === 'PASS').length;

    let overallStatus = 'OPEN';
    if (totalCount > 0) {
        overallStatus = failedCount > 0 ? 'QC_FAIL' : 'QC_PASS';
    }

    return {
        blanks: evaluatedBlanks,
        duplicates: evaluatedDuplicates,
        controls: evaluatedControls,
        summary: {
            totalQcSamples: totalCount,
            passed: passedCount,
            failed: failedCount,
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
        return { allowed: true, status: 'N/A' };
    }

    if (batch.status === 'QC_PASS' || batch.status === 'OPEN' || batch.status === 'CLOSED') {
        return { allowed: true, status: batch.status };
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
            error: `Batch ${batch.id} is in FAILED QC status without manager override disposition.`
        };
    }

    return { allowed: true, status: batch.status };
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

    const isOverridden = parsedDisp && parsedDisp.decision === 'PROCEED_WITH_WARNING';
    const results = await prismaClient.result.findMany({ where: { batchId } });
    let count = 0;

    for (const res of results) {
        let flags = [];
        try {
            flags = typeof res.flags === 'string' ? JSON.parse(res.flags) : (res.flags || []);
        } catch (e) {
            flags = [];
        }

        if (status === 'QC_FAIL') {
            if (isOverridden) {
                flags = flags.filter(f => f !== 'QC_BATCH_FAILED');
                if (!flags.includes('QC_WARNING_OVERRIDDEN')) flags.push('QC_WARNING_OVERRIDDEN');
                await prismaClient.result.update({
                    where: { id: res.id },
                    data: { isValid: true, flags: JSON.stringify(flags) }
                });
            } else {
                if (!flags.includes('QC_BATCH_FAILED')) flags.push('QC_BATCH_FAILED');
                await prismaClient.result.update({
                    where: { id: res.id },
                    data: { isValid: false, flags: JSON.stringify(flags) }
                });
            }
            count++;
        } else if (status === 'QC_PASS') {
            if (flags.includes('QC_BATCH_FAILED')) {
                flags = flags.filter(f => f !== 'QC_BATCH_FAILED');
                await prismaClient.result.update({
                    where: { id: res.id },
                    data: { isValid: true, flags: JSON.stringify(flags) }
                });
                count++;
            }
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
