const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const policyService = require('./policyService');
const { evaluateCrossParameters } = require('./crossParameterEvaluator');
const { readSampleReportedValues } = require('./reportedValueReadService');

async function scopedSample(tx, sampleId, actor, permission) {
    if (!hasPermission(actor, permission)) throw new rules.TransitionError('Cross-check access is not authorized.',
        403, 'CROSS_CHECK_FORBIDDEN');
    const sample = await tx.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    return sample;
}
async function labSnapshot(tx, sample) {
    const snapshot = await policyService.snapshot(sample.assignedLab || sample.labId, { db: tx });
    if (!snapshot.labId) throw new rules.TransitionError('Cross-checks require the sample laboratory.',
        409, 'CROSS_CHECK_LAB_REQUIRED');
    return snapshot;
}
function decode(row) {
    try {
        const inputs = JSON.parse(row.inputs), thresholds = JSON.parse(row.thresholds);
        if (!inputs || !Array.isArray(inputs.values) || !Array.isArray(inputs.missing) || typeof inputs.lowerBound !== 'boolean' ||
            inputs.values.some(value => !value || typeof value.analysisCode !== 'string' || !Array.isArray(value.resultIds)) ||
            !thresholds || Array.isArray(thresholds) || !Number.isSafeInteger(thresholds.policyVersion) || thresholds.policyVersion < 0) {
            throw Error('Invalid stored evidence shape');
        }
        return { ...row, inputs, thresholds, severity: 'ADVISORY',
        flagCode: row.outcome === 'FLAGGED' ? ({ BASES_CEC: 'CROSS_CHECK_BASES_GT_CEC',
            BASE_SATURATION: 'CROSS_CHECK_BASE_SAT_GT_MAX', CN_RATIO: 'CROSS_CHECK_CN_OUT_OF_RANGE',
            CACO3_PH: 'CROSS_CHECK_CACO3_LOW_PH', PH_KCL_WATER: 'CROSS_CHECK_PH_SALT_GE_WATER',
            PH_CACL2_WATER: 'CROSS_CHECK_PH_SALT_GE_WATER' }[row.ruleCode] || 'TEXTURE_CLOSURE') : null };
    }
    catch { throw new rules.TransitionError('Stored cross-check evidence cannot be read.', 409, 'CROSS_CHECK_EVIDENCE_INVALID'); }
}

// #201 pin6092380877: the caller's submission transaction owns both the
// workflow change and these immutable rows. Never accept caller-supplied values.
async function recordSubmissionCrossChecks(tx, sampleId, actor) {
    rules.requireTransaction(tx);
    const sample = await scopedSample(tx, sampleId, actor, 'ENTER_RESULTS');
    if (!['SUBMITTED_PARTIAL', 'SUBMITTED_FULL'].includes(sample.status) || !sample.lastSubmissionId) {
        throw new rules.TransitionError('Cross-check evidence requires the caller submission.', 409, 'CROSS_CHECK_SUBMISSION_REQUIRED');
    }
    const snapshot = await labSnapshot(tx, sample);
    const rows = await tx.result.findMany({ where: { sampleId, isCurrent: true }, orderBy: { id: 'asc' } });
    const evaluations = evaluateCrossParameters(rows, snapshot), evaluatedBy = rules.actorName(actor), evaluatedAt = new Date();
    try {
        const saved = [];
        for (const evaluation of evaluations) {
            // JSON cannot represent non-finite legacy numbers. Refuse instead
            // of silently replacing retained numeric evidence with null.
            const json = value => JSON.stringify(value, (_, item) => {
                if (typeof item === 'number' && !Number.isFinite(item)) throw Error('Non-finite stored evidence');
                return item;
            });
            saved.push(await tx.crossCheckEvaluation.create({ data: { id: randomUUID(), sampleId, labId: snapshot.labId,
                trigger: 'SUBMISSION', ruleCode: evaluation.ruleCode, outcome: evaluation.outcome,
                reasonCode: evaluation.reasonCode, inputs: json(evaluation.inputs), thresholds: json(evaluation.thresholds),
                evaluatedBy, evaluatedAt } }));
        }
        return saved.map(decode);
    } catch (cause) {
        throw Object.assign(new rules.TransitionError('Could not retain the submission cross-check evidence.',
            409, 'CROSS_CHECK_EVIDENCE_WRITE_FAILED'), { cause });
    }
}

async function reviewCrossChecks(db, sampleId, actor) {
    return rules.inTransaction(db, async tx => {
        const sample = await scopedSample(tx, sampleId, actor, 'APPROVE_RESULTS');
        const stored = await tx.crossCheckEvaluation.findMany({ where: { sampleId, trigger: 'SUBMISSION' },
            orderBy: [{ evaluatedAt: 'asc' }, { id: 'asc' }] });
        const selectionExists = await tx.reportedValueSelection.findFirst({ where: { workItem: { sampleId } }, select: { id: true } });
        const observations = await tx.result.findMany({ where: { sampleId, isCurrent: true }, orderBy: { id: 'asc' } });
        // The existing gate deliberately retains its old text parser, units and
        // implicit tolerance (#201 pin6092909004; correction deferred to #278).
        const gate = require('../controllers/validationController').validateSampleMatrix(observations);
        let current = null, selectionErrors = [];
        if (selectionExists) {
            const reported = await readSampleReportedValues(tx, sample, { partial: true });
            const snapshot = await labSnapshot(tx, sample);
            current = { evaluations: evaluateCrossParameters(reported.values, snapshot), policyVersion: snapshot.version };
            selectionErrors = reported.errors;
        }
        return { sampleId, current, atSubmission: stored.map(decode), selectionErrors,
            existingTextureGate: { evaluatedFrom: 'CURRENT_OBSERVATIONS', texture: gate.texture,
                isBlocking: gate.isBlocking, blockingErrors: gate.blockingErrors } };
    });
}
module.exports = { recordSubmissionCrossChecks, reviewCrossChecks };
