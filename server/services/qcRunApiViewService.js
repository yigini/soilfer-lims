const policyService = require('./policyService');
const scopeGuard = require('../utils/scopeGuard');
const { getNumberFormat } = require('./numberFormatService');
const { resolveQcPolicy } = require('./qcPolicyService');
const { countRequirements } = require('./qcRequirementService');
const { resolveRunProfile, resolveBatchRunProfile } = require('./qcRunProfileService');
const { currentAnalyteEvidence, batchApiView } = require('./qcRunViewService');

async function scopedBatchWhere(db, actor, filter = {}) {
    const lab = await policyService.resolveLab(actor.labId, db);
    const identities = [...new Set([actor.labId, lab?.id, lab?.code].filter(Boolean))];
    const scopes = identities.map(labId => scopeGuard.buildScopedWhere({ ...actor, labId }, filter,
        { entityType: 'Generic', labField: 'labId', altLabField: null }));
    return scopes.length > 1 ? { OR: scopes } : scopes[0] || scopeGuard.buildScopedWhere(actor, filter,
        { entityType: 'Generic', labField: 'labId', altLabField: null });
}
function forecast(batch, analysisCode) {
    const row = batch.analytes.find(analyte => analyte.analysisCode === analysisCode);
    if (row?.criteriaSnapshot) return JSON.parse(row.criteriaSnapshot);
    const built = batch.events.filter(event => ['RUN_BUILT', 'RUN_REORDERED'].includes(event.type)).sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    return built && JSON.parse(built.payload).forecasts?.find(criteria => criteria.analysisCode === analysisCode);
}
function nativeRequirements(criteria, evidence) {
    const required = criteria.requiredPositions || {}, counts = criteria.counts;
    const kinds = ['BLANK', 'DUPLICATE', 'LRM', 'CRM', 'ICV', 'CCV', 'CCB'];
    const measured = new Set(evidence.measurements.map(row => row.positionId));
    const result = Object.fromEntries(kinds.map(kind => {
        const ids = required[kind], offered = ids?.length ?? counts?.[{ BLANK: 'blank', DUPLICATE: 'duplicate', LRM: 'lrm', CRM: 'crm' }[kind]] ?? 0;
        return [kind, { required: offered, offered, found: ids ? ids.filter(id => measured.has(id)).length : evidence.positions.filter(row => row.kind === kind && measured.has(row.id)).length,
            source: criteria.qcMode === 'OFF' ? 'NOT_USED' : 'RULE' }];
    }));
    result.CONTROL = ['LRM', 'CRM', 'ICV', 'CCV'].reduce((total, kind) => ({ required: total.required + result[kind].required,
        offered: total.offered + result[kind].offered, found: total.found + result[kind].found, source: criteria.qcMode === 'OFF' ? 'NOT_USED' : 'RULE' }),
    { required: 0, offered: 0, found: 0 });
    return result;
}
async function apiRunView(db, batch, { detail = false } = {}) {
    const view = batchApiView(batch, { serialized: true }), primaryCriteria = batch.analytes.some(row => row.analysisCode === batch.analysis && row.provenance === 'NATIVE') && forecast(batch, batch.analysis);
    const runProfile = primaryCriteria ? resolveRunProfile(batch.analysis, batch.instrument, batch.maxCapacity, batch.profile,
        primaryCriteria.policySnapshot.values['qc.runProfiles']) : await resolveBatchRunProfile(batch, db);
    const decorated = [];
    for (const row of batch.analytes) {
        const evidence = currentAnalyteEvidence(batch, row.analysisCode), criteria = row.provenance === 'NATIVE' && forecast(batch, row.analysisCode);
        if (criteria) decorated.push({ ...view.analytes.find(analyte => analyte.id === row.id), numberFormat: criteria.numberFormat,
            qcRule: criteria.qcRule, qcMode: criteria.qcMode, qcRequirements: nativeRequirements(criteria, evidence) });
        else {
            const numberFormat = await getNumberFormat(batch.labId, { db });
            const policy = await resolveQcPolicy({ ...batchApiView(batch), analysis: row.analysisCode }, db, numberFormat);
            decorated.push({ ...view.analytes.find(analyte => analyte.id === row.id), numberFormat, qcRule: policy.qcRule, qcMode: policy.qcMode,
                qcRequirements: countRequirements(policy.qcRule, policy.sampleCount, runProfile, evidence.qcResults || {}, policy.qcMode) });
        }
    }
    for (const row of decorated) {
        row.repeatBracketScope = null;
        if (row.status === 'QC_FAIL') {
            try { row.repeatBracketScope = require('./qcCalibrationBracketService').repeatBracketScope(row, currentAnalyteEvidence(batch, row.analysisCode)); }
            catch (error) { if (error.code !== 'QC_BRACKET_REPEAT_NOT_ALLOWED') throw error; }
        }
    }
    const primary = decorated.find(row => row.analysisCode === batch.analysis) || decorated[0];
    const output = { ...view, analytes: decorated, runProfile, ...(primary && { numberFormat: primary.numberFormat,
        qcRule: primary.qcRule, qcMode: primary.qcMode, qcRequirements: primary.qcRequirements }) };
    if (detail) for (const key of ['qcResults', 'disposition', 'history']) output[key] = typeof output[key] === 'string' ? JSON.parse(output[key]) : output[key];
    return output;
}
module.exports = { apiRunView, scopedBatchWhere };
