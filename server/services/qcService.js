const crypto = require('crypto');

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
// Preserve inclusive absolute boundaries despite binary floating-point subtraction.
const withinAbsoluteLimit = (difference, limit) => difference <= limit ||
    difference - limit <= Number.EPSILON * Math.max(1, difference, limit) * 4;

// Validate explicit measurements by required QC type, without introducing position rules.
function getMissingQcValueTypes(qcData = {}, runProfile = {}, numberFormat = require('./policyService').getStrictNumberFormat()) {
    const fieldsByType = {
        BLANK: ['blanks', item => [item.value !== undefined ? item.value : item.val]],
        DUPLICATE: ['duplicates', item => [
            item.value1 !== undefined ? item.value1 : item.val1,
            item.value2 !== undefined ? item.value2 : item.val2
        ]],
        CONTROL: ['controls', item => [
            item.expected !== undefined ? item.expected : item.expectedValue,
            item.measured !== undefined ? item.measured : (item.value !== undefined ? item.value : item.val)
        ]]
    };
    const requiredTypes = new Set((runProfile.qcSlots || []).map(slot => slot.type));
    return [...requiredTypes].filter(type => {
        const [collection, fields] = fieldsByType[type] || [];
        const items = qcData[collection];
        return !fields || !Array.isArray(items) || items.length === 0 || items.some(item =>
            !item || typeof item !== 'object' || !fields(item).every((value, index) => type === 'DUPLICATE'
                ? require('../../shared/numberParse').parseDuplicateObservation(
                    item.rawInput && Object.prototype.hasOwnProperty.call(item.rawInput, `value${index + 1}`) ? item.rawInput[`value${index + 1}`] : value, numberFormat).valid
                : Number.isFinite(parseNumericMeasurement(value)))
        );
    });
}

/**
 * Evaluate a single Method / Reagent Blank
 * @param {Object} blank - { id, value, maxAllowed, label }
 * @param {Object} policy - Method/system policy limits
 * @returns {Object} Evaluated blank result
 */
function evaluateBlank(blank = {}, policy = {}) {
    const id = blank.id || crypto.randomUUID();
    const label = blank.label || 'Method Blank';
    const rawVal = blank.value !== undefined ? blank.value : blank.measured;
    const value = parseNumericMeasurement(rawVal);
    
    // Limits must come from policy/standard, not arbitrarily loosened by caller
    const maxAllowed = (policy && typeof policy.maxAllowed === 'number') ? policy.maxAllowed : require('./policyService').getStrict('qc.blankMaxAllowed');
    const mode = policy.mode || require('./policyService').getStrict('qc.blankLimitMode');
    if (mode !== 'ABSOLUTE') {
        const notes = policy.noLoqReason ? [policy.noLoqReason] : [];
        if (typeof policy.loq !== 'number' || !Number.isFinite(policy.loq) || policy.loq < 0) return { id, label, type: 'BLANK', value: Number.isFinite(value) ? value : null,
            status: 'INVALID', criterion: 'NO_LOQ', loq: null, notes: ['NO_LOQ', ...notes], details: ['NO_LOQ', ...notes].join(' ') };
        const limit = mode === 'LT_HALF_LOQ' ? policy.loq / 2 : policy.loq;
        return { id, label, type: 'BLANK', value: Number.isFinite(value) ? value : null, maxAllowed: limit,
            loq: policy.loq, loqSource: policy.loqSource, methodologyId: policy.methodologyId, criterion: mode, notes,
            status: Number.isFinite(value) && Math.abs(value) < limit ? 'PASS' : 'FAIL', details: `|${value}| < ${limit}` };
    }

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
    const id = dup.id || crypto.randomUUID();
    const label = dup.label || 'Analytical Duplicate';
    const defaults = require('./policyService');
    const format = policy.numberFormat || defaults.getStrictNumberFormat();
    const observations = [1, 2].map(index => require('../../shared/numberParse').parseDuplicateObservation(
        dup.rawInput && Object.prototype.hasOwnProperty.call(dup.rawInput, `value${index}`) ? dup.rawInput[`value${index}`]
            : (dup[`value${index}`] !== undefined ? dup[`value${index}`] : dup[`val${index}`]), format));
    const [v1, v2] = observations.map(observation => observation.valid && !observation.censored ? observation.value : NaN);
    const maxRpd = typeof policy.maxRpd === 'number' ? policy.maxRpd : defaults.getStrict('qc.duplicateMaxRpd');
    const nearLoqMultiplier = policy.nearLoqMultiplier ?? defaults.getStrict('qc.duplicateNearLoqMultiplier');
    const loq = typeof policy.loq === 'number' && Number.isFinite(policy.loq) && policy.loq >= 0 ? policy.loq : null;
    const notes = loq === null ? ['NO_LOQ', ...(policy.noLoqReason ? [policy.noLoqReason] : [])] : [];
    const evidence = { loq, loqSource: loq === null ? null : policy.loqSource || null, methodologyId: policy.methodologyId || null, notes };

    if (observations.every(observation => observation.valid) && observations.some(observation => observation.censored)) {
        const censoringLimits = observations.map(observation => observation.censored
            ? { qualifier: observation.qualifier, limit: observation.literalLoq ? loq : observation.value, literalLoq: observation.literalLoq } : null);
        let status = 'INVALID', criterion;
        if (observations.some(observation => observation.censored === 'ABOVE')) criterion = 'CENSORED_ABOVE_RANGE';
        else if (observations.every(observation => observation.censored === 'BELOW')) {
            status = 'PASS'; criterion = 'CENSORED_PAIR';
            if (censoringLimits[0].limit !== censoringLimits[1].limit) notes.push('CENSORING_LIMITS_DIFFER');
        } else criterion = 'CENSORED_MISMATCH';
        notes.push(criterion);
        return { id, label, type: 'DUPLICATE', value1: Number.isNaN(v1) ? null : v1, value2: Number.isNaN(v2) ? null : v2,
            rpd: null, maxRpd, ...evidence, censoringLimits, status, criterion, details: notes.join(' ') };
    }

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
            ...evidence,
            error: 'Missing, non-numeric, or non-finite duplicate values',
            details: 'Invalid duplicate measurement'
        };
    }

    const difference = Math.abs(v1 - v2);
    if ((policy.mode || defaults.getStrict('qc.duplicateMode')) === 'ABS_DIFF') {
        const limit = policy.absMax ?? defaults.getStrict('qc.duplicateAbsMax');
        if (limit === null) return { id, label, type: 'DUPLICATE', value1: v1, value2: v2, rpd: null, maxRpd,
            ...evidence, status: 'INVALID', criterion: 'ABS_DIFF_UNSET', details: 'ABS_DIFF_UNSET' };
        const passed = withinAbsoluteLimit(difference, limit);
        return { id, label, type: 'DUPLICATE', value1: v1, value2: v2, rpd: null, maxRpd, ...evidence,
            status: passed ? 'PASS' : 'FAIL', criterion: 'ABS_DIFF', absoluteDifference: difference, absMax: limit,
            details: `Absolute difference ${difference} ${passed ? '≤' : '>'} ${limit}` };
    }
    const avg = v1 / 2 + v2 / 2;
    if (v1 <= 0 || v2 <= 0 || avg === 0) {
        return { id, label, type: 'DUPLICATE', value1: v1, value2: v2, rpd: null, maxRpd,
            ...evidence, status: 'INVALID', criterion: 'INVALID_NONPOSITIVE',
            details: ['Duplicate readings must both be greater than zero.', ...notes].join(' ') };
    }
    if (loq !== null && (v1 < nearLoqMultiplier * loq || v2 < nearLoqMultiplier * loq)) {
        const limit = policy.absMaxBelow5LOQ ?? loq;
        const passed = difference <= limit;
        return { id, label, type: 'DUPLICATE', value1: v1, value2: v2, rpd: null, maxRpd,
            ...evidence, status: passed ? 'PASS' : 'FAIL', criterion: 'ABSOLUTE_DIFFERENCE', absoluteDifference: difference,
            absMax: limit, details: `Absolute difference ${difference} ${passed ? '≤' : '>'} ${limit}` };
    }
    const rpd = (difference / avg) * 100;
    const passed = rpd <= maxRpd;
    return {
        id,
        label,
        type: 'DUPLICATE',
        value1: Number(v1.toFixed(4)),
        value2: Number(v2.toFixed(4)),
        rpd: Number(rpd.toFixed(2)),
        maxRpd,
        ...evidence,
        criterion: 'RPD',
        status: passed ? 'PASS' : 'FAIL',
        details: (passed ? `RPD ${rpd.toFixed(1)}% ≤ ${maxRpd}% (Acceptable)` : `RPD ${rpd.toFixed(1)}% > ${maxRpd}% (Precision failure)`) + (notes.length ? ` ${notes.join(' ')}` : '')
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
    const id = crm.id || crypto.randomUUID();
    const label = crm.label || 'Certified Reference Material';
    const expected = parseNumericMeasurement(crm.expected !== undefined ? crm.expected : crm.expectedValue);
    const measured = parseNumericMeasurement(crm.measured !== undefined ? crm.measured : (crm.value !== undefined ? crm.value : crm.val));
    const minRecovery = (policy && typeof policy.minRecovery === 'number') ? policy.minRecovery : require('./policyService').getStrict('qc.controlMinRecovery');
    const maxRecovery = (policy && typeof policy.maxRecovery === 'number') ? policy.maxRecovery : require('./policyService').getStrict('qc.controlMaxRecovery');

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
    const isCrm = crm.referenceUse === 'CRM';
    const notes = [];
    let criterion = 'RECOVERY';
    let lower = minRecovery, upper = maxRecovery;
    if (!isCrm && policy.lrmMode === 'CONTROL_CHART') notes.push('PROVISIONAL_NO_CHART');
    if (!isCrm && policy.lrmWindowPct !== null && policy.lrmWindowPct !== undefined) {
        lower = 100 - policy.lrmWindowPct; upper = 100 + policy.lrmWindowPct;
    }
    let passed = recoveryPct >= lower && recoveryPct <= upper;
    if (isCrm && policy.crmMode === 'ABS_WINDOW') {
        if (policy.crmAbsWindow === null) notes.push('ABS_WINDOW_UNSET');
        else { criterion = 'ABS_WINDOW'; passed = withinAbsoluteLimit(Math.abs(measured - expected), policy.crmAbsWindow); }
    }

    return {
        id,
        label,
        type: 'CONTROL',
        expected: Number(expected.toFixed(4)),
        measured: Number(measured.toFixed(4)),
        recoveryPct: Number(recoveryPct.toFixed(2)),
        minRecovery,
        maxRecovery,
        criterion, notes, crmAbsWindow: policy.crmAbsWindow ?? null, lrmWindowPct: policy.lrmWindowPct ?? null,
        status: passed ? 'PASS' : 'FAIL',
        details: (criterion === 'ABS_WINDOW' ? `Absolute difference ${Math.abs(measured - expected)} compared with ${policy.crmAbsWindow}` :
            `Recovery ${recoveryPct.toFixed(1)}% ${passed ? 'within' : 'out of bounds'} [${lower}%, ${upper}%]`) + (notes.length ? ` ${notes.join(' ')}` : '')
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
    if (policy.qcRule) {
        const requirements = require('./qcRequirementService').countRequirements(policy.qcRule, policy.sampleCount, options.runProfile, qcData, policy.qcMode);
        const missingRequired = Object.entries(requirements).filter(([, row]) => row.found < row.required).map(([type, row]) => ({ type, ...row }));
        const failAction = policy.qcRule.resolved.failAction.value;
        const warnings = [];
        let failed = 0;
        const qcRule = { ...policy.qcRule, requirements };
        allEvaluated.forEach((item, index) => {
            const type = item.type === 'CONTROL' ? rawControls[index - evaluatedBlanks.length - evaluatedDuplicates.length]?.referenceUse === 'CRM' ? 'CRM' : 'LRM' : item.type;
            item.qcRule = qcRule;
            item.failAction = failAction[type];
            if (['FAIL', 'INVALID'].includes(item.status)) {
                if (item.failAction === 'WARN') warnings.push({ type, id: item.id, status: item.status, criterion: item.criterion });
                else failed++;
            }
        });
        if (policy.qcMode === 'REQUIRED_WARN') warnings.push(...missingRequired.map(row => ({ ...row, code: 'QC_REQUIRED_COUNT_MISSING' })));
        const total = allEvaluated.length;
        const blocking = missingRequired.length > 0 && policy.qcMode === 'REQUIRED_BLOCKING';
        return { blanks: evaluatedBlanks, duplicates: evaluatedDuplicates, controls: evaluatedControls, qcRule,
            summary: { totalQcSamples: total, passed: allEvaluated.filter(row => row.status === 'PASS').length, failed,
                missingRequired, warnings, requirements, qcRule, evaluatedAt: qcRule.evaluatedAt,
                incompleteReason: blocking ? 'QC_REQUIRED_COUNT_MISSING' : null },
            overallStatus: total === 0 ? 'OPEN' : failed || blocking ? 'QC_FAIL' : 'QC_PASS' };
    }
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
const QC_OWNED_FLAGS = ['QC_BATCH_FAILED', 'QC_WARNING_OVERRIDDEN', 'QC_BATCH_REANALYZE_REQUESTED', 'QC_BATCH_REJECTED'];
const PROVENANCE_INVALID_FLAGS = ['ORIGINALLY_INVALID', 'UNFLAGGED_INVALID', 'MALFORMED_FLAGS_INVALID'];

function isInvalidOnlyByQcFailure(result) {
    if (result.isValid !== false) return false;
    let flags;
    try { flags = typeof result.flags === 'string' ? JSON.parse(result.flags) : result.flags; }
    catch (_) { return false; }
    return Array.isArray(flags) && flags.includes('QC_BATCH_FAILED') &&
        !flags.some(flag => PROVENANCE_INVALID_FLAGS.includes(flag) || !QC_OWNED_FLAGS.includes(flag)) &&
        !flags.includes('QC_BATCH_REJECTED') && !flags.includes('QC_BATCH_REANALYZE_REQUESTED');
}

async function flagBatchResults(prismaClient, batchId, status, disposition = null, analysisCode = null) {
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
        where: { batchId, ...(analysisCode && { param: analysisCode }) },
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
                } else if (isInvalidOnlyByQcFailure(res)) {
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
    isInvalidOnlyByQcFailure,
    getMissingQcValueTypes,
    evaluateBlank,
    evaluateDuplicate,
    evaluateControl,
    evaluateBatchQc,
    checkBatchDisposition,
    flagBatchResults
};
