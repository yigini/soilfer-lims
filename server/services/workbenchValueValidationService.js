const workflow = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { resolveNumericValueRules } = require('./resultValueRulesService');
const { validateNumericMethod } = require('./workbenchValidationService');

async function validateNumericEntry(db, item, actor, entry, { approval = true, calibrationCurve = null } = {}) {
    const analysis = await db.analysis.findUnique({ where: { code: item.analysis } });
    if (!analysis) throw new workflow.TransitionError('Analysis configuration is unavailable.', 409, 'RESULT_ANALYSIS_UNAVAILABLE');
    const method = item.methodologyId ? await db.methodology.findUnique({ where: { id: item.methodologyId } }) : null;
    const resolved = await resolveNumericValueRules(db, { labId: item.sample?.assignedLab || item.assignedLab || item.labId,
        analysis, method, calibrationCurve });
    const validation = validateNumericMethod(entry.value, resolved.rules, resolved.numberFormat);
    if (!approval || !entry.overrideRequestId) return validation;
    return workflow.inTransaction(db, async tx => {
        const writer = require('./resultWriteService'), overrides = require('./resultOverrideService');
        await overrides.available(tx, entry.overrideRequestId, actor);
        const measurement = writer.selectMeasurement({ ...entry, param: item.analysis, methodologyId: item.methodologyId });
        const context = await writer.resolveResultValidationContext(tx, { sampleId: item.sampleId, workItemId: item.id, actor, measurement });
        await overrides.matchApproval(tx, context.ctx, measurement, context);
        return { ...context.validation, isValid: true, flags: [...context.validation.flags, 'OVERRIDE_APPROVED'] };
    }).catch(error => { throw require('./resultOverrideService').mapContextError(error); });
}

// Read-only projection of the unchanged #191 command. The prompt cannot grant
// repeat authority, create an attempt or manufacture a source determination.
async function dilutionOpportunity(db, item, actor) {
    if (!hasPermission(actor, 'MANAGE_WORK_ATTEMPTS')) return { eligible: false };
    const attempts = await db.workAttempt.findMany({ where: { workItemId: item.id, status: 'RECORDED' } });
    const rows = attempts.length ? await db.result.findMany({ where: { attemptId: { in: attempts.map(row => row.id) },
        isCurrent: true, supersededBy: null } }) : [];
    const flagged = rows.some(row => { try { return JSON.parse(row.flags || '[]').includes('ABOVE_RANGE'); } catch { return false; } });
    if (!flagged) return { eligible: false };
    try {
        return await workflow.inTransaction(db, async tx => {
            const sample = item.sample || await tx.sample.findUnique({ where: { id: item.sampleId } });
            const plan = await require('./workRepeatService').preflightRepeat(tx, item, sample, actor,
                require('./workRepeatContract').repeatRequest({ reason: 'ABOVE_RANGE_DILUTION' }));
            return { eligible: true, attemptId: plan.parent.id };
        });
    } catch (error) {
        if (error.statusCode >= 400 && error.statusCode < 500) return { eligible: false, code: error.code };
        throw error;
    }
}
module.exports = { validateNumericEntry, dilutionOpportunity };
