const policy = require('./policyService');
const holds = require('./sampleHoldService');
const scope = require('../utils/scopeGuard');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { valid } = require('../config/policyRegistry');
const KEY = 'sample.retentionDaysAfterReport';
const fail = (code, message, status = 409) => new rules.TransitionError(message, status, code);
function projectSettings(raw, override) {
    let settings;
    try { settings = raw ? JSON.parse(raw) : {}; } catch { throw fail('PROJECT_RETENTION_INVALID', 'Project retention settings need review.'); }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || settings.sample != null &&
        (typeof settings.sample !== 'object' || Array.isArray(settings.sample))) throw fail('PROJECT_RETENTION_INVALID', 'Project retention settings need review.');
    if (override !== null && !valid(KEY, override)) throw fail('PROJECT_RETENTION_INVALID', 'Project retention must be a non-negative whole number of days.', 400);
    const sample = { ...settings.sample };
    if (override === null) delete sample.retentionDaysAfterReport; else sample.retentionDaysAfterReport = override;
    return JSON.stringify({ ...settings, sample });
}
async function retainAtPublication(tx, sample, publishedAt) {
    let days = await policy.get(sample.assignedLab, KEY, { analysisCode: null, methodologyId: null, db: tx });
    const resolved = sample.projectId || sample.projectCode ? await require('./projectPolicyService').resolveProject(sample.projectId || sample.projectCode, tx) : null;
    if (resolved?.project?.policyConfig) {
        let settings;
        try { settings = JSON.parse(resolved.project.policyConfig); } catch { throw fail('PROJECT_RETENTION_INVALID', 'Project retention settings need review.'); }
        if (!settings || typeof settings !== 'object' || Array.isArray(settings) || settings.sample != null &&
            (typeof settings.sample !== 'object' || Array.isArray(settings.sample))) throw fail('PROJECT_RETENTION_INVALID', 'Project retention settings need review.');
        const override = settings?.sample?.retentionDaysAfterReport;
        if (override !== undefined) {
            if (!valid(KEY, override)) throw fail('PROJECT_RETENTION_INVALID', 'Project retention must be a non-negative whole number of days.');
            days = override;
        }
    }
    const retainUntil = new Date(publishedAt.getTime() + days * 86400000);
    if (!Number.isFinite(retainUntil.getTime())) throw fail('SAMPLE_RETENTION_INVALID', 'Retention date is outside the supported range.');
    await tx.sample.update({ where: { id: sample.id }, data: { retainUntil } });
    return { days, retainUntil };
}
async function hasOpenAmendment(tx, id) {
    const amendments = await tx.sampleAmendment.findMany({ where: { sampleId: id, status: { in: ['PENDING', 'APPROVED'] } } });
    if (!amendments.length) return false;
    const consumed = new Set((await tx.report.findMany({ where: { sampleId: id, amendmentId: { in: amendments.map(row => row.id) },
        status: { in: ['PUBLISHED', 'SUPERSEDED', 'WITHDRAWN'] } }, select: { amendmentId: true } })).map(row => row.amendmentId));
    return amendments.some(row => row.status === 'PENDING' || !['CONSUMED', 'RESOLVED'].includes(row.resolution) && !consumed.has(row.id));
}
async function assertDisposable(tx, sample, reason, now = new Date()) {
    rules.requireReason(reason);
    await holds.assertNotHeld(tx, sample);
    if (await hasOpenAmendment(tx, sample.id)) throw fail('SAMPLE_AMENDMENT_OPEN', 'Resolve the open amendment before disposing of material.');
    if (sample.status !== 'RECEIVED_REJECTED' && (!sample.retainUntil || sample.retainUntil >= now))
        throw fail('SAMPLE_RETENTION_ACTIVE', 'Retention must expire before disposal.');
}
async function queue(db, actor, now = new Date()) {
    if (!hasPermission(actor, 'DISPOSE_SAMPLE')) throw fail('CUSTODY_FORBIDDEN', 'Disposal access is required.', 403);
    const rows = await db.sample.findMany({ where: scope.buildScopedWhere(actor, { status: { in: ['APPROVED', 'ARCHIVED'] }, retainUntil: { lt: now } }),
        orderBy: [{ retainUntil: 'asc' }, { id: 'asc' }], include: { holds: true, amendments: true } });
    const consumed = new Set((await db.report.findMany({ where: { sampleId: { in: rows.map(row => row.id) }, amendmentId: { not: null },
        status: { in: ['PUBLISHED', 'SUPERSEDED', 'WITHDRAWN'] } }, select: { amendmentId: true } })).map(row => row.amendmentId));
    return rows.filter(row => scope.canAccessEntity(actor, row, { altLabField: 'assignedLab' }) && !holds.isHeldSnapshot(row) &&
        !row.amendments.some(a => a.status === 'PENDING' || a.status === 'APPROVED' && !['CONSUMED', 'RESOLVED'].includes(a.resolution) && !consumed.has(a.id)))
        .map(({ id, originalId, labSampleCode, assignedLab, status, retainUntil }) => ({ id, originalId, labSampleCode, assignedLab, status, retainUntil }));
}
module.exports = { projectSettings, retainAtPublication, hasOpenAmendment, assertDisposable, queue };
