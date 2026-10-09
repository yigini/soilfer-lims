const policyService = require('./policyService');
const { TransitionError } = require('./workflowStateRules');

// Inputs are the lab/method/batch derived by the existing scoped row authority.
// An older snapshot without the new count does not acquire an invented count.
async function resolveSampleReplicateRules(db, { labId, analysisCode, methodologyId, batchId }) {
    const lab = await policyService.resolveLab(labId, db);
    const scopedLabId = lab?.id || labId;
    const analyte = batchId ? await db.batchAnalyte.findFirst({ where: { batchId, analysisCode },
        include: { batch: { select: { labId: true, startedAt: true } } } }) : null;
    if (analyte && analyte.batch.labId !== scopedLabId) {
        throw new TransitionError('The run belongs to another laboratory.', 403, 'REPLICATE_SCOPE_DENIED');
    }
    let frozen = null;
    if (analyte?.provenance === 'NATIVE' && analyte.batch.startedAt && analyte.criteriaSnapshot) {
        try { frozen = JSON.parse(analyte.criteriaSnapshot); }
        catch { throw new TransitionError('The recorded replicate criteria are unavailable.', 409, 'REPLICATE_CRITERIA_INVALID'); }
    }
    const scope = { db, analysisCode, methodologyId };
    const storedCount = frozen?.policySnapshot?.values;
    const countFrozen = storedCount && Object.hasOwn(storedCount, 'results.replicatesRequired');
    const currentSnapshot = !frozen || !countFrozen ? await policyService.snapshot(scopedLabId, scope) : null;
    const requiredCount = countFrozen ? storedCount['results.replicatesRequired']
        : currentSnapshot.values['results.replicatesRequired'];
    if (![1, 2].includes(requiredCount)) throw new TransitionError('The recorded replicate count is invalid.', 409, 'REPLICATE_CRITERIA_INVALID');
    let policy;
    if (frozen) {
        const rules = frozen.qcRule?.resolved;
        if (!rules || !frozen.methodContext || !frozen.numberFormat ||
            frozen.policySnapshot?.values?.['qc.duplicateNearLoqMultiplier'] == null) {
            throw new TransitionError('The recorded replicate criteria are unavailable.', 409, 'REPLICATE_CRITERIA_INVALID');
        }
        policy = { mode: rules.duplicateMode?.value, maxRpd: rules.duplicateRpdMax?.value,
            absMax: rules.duplicateAbsMax?.value, absMaxBelow5LOQ: rules.duplicateAbsMaxBelow5LOQ?.value,
            nearLoqMultiplier: frozen.policySnapshot.values['qc.duplicateNearLoqMultiplier'],
            ...frozen.methodContext, numberFormat: frozen.numberFormat, recordedCriteria: true };
    } else {
        const snapshot = currentSnapshot, values = snapshot.values;
        const method = methodologyId ? await db.methodology.findUnique({ where: { id: methodologyId }, select: { loq: true } }) : null;
        policy = { mode: values['qc.duplicateMode'], maxRpd: values['qc.duplicateMaxRpd'],
            absMax: values['qc.duplicateAbsMax'], absMaxBelow5LOQ: values['qc.duplicateAbsMaxBelow5LOQ'],
            nearLoqMultiplier: values['qc.duplicateNearLoqMultiplier'],
            methodologyId, loq: method?.loq ?? null, loqSource: method?.loq == null ? null : 'METHODOLOGY',
            numberFormat: await require('./numberFormatService').getNumberFormat(scopedLabId, { db, snapshot }), recordedCriteria: true };
    }
    if (!['RPD', 'ABS_DIFF'].includes(policy.mode) || !Number.isFinite(policy.maxRpd) ||
        policy.maxRpd < 0 || !Number.isFinite(policy.nearLoqMultiplier) || policy.nearLoqMultiplier < 0 ||
        [policy.absMax, policy.absMaxBelow5LOQ, policy.loq].some(value => value !== null && (!Number.isFinite(value) || value < 0))) {
        throw new TransitionError('The recorded replicate criteria are unavailable.', 409, 'REPLICATE_CRITERIA_INVALID');
    }
    return { requiredCount, countSource: countFrozen ? 'FROZEN' : 'CURRENT', source: frozen ? 'FROZEN' : 'CURRENT', policy };
}

module.exports = { resolveSampleReplicateRules };
