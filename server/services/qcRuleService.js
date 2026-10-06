const crypto = require('crypto');
const policyService = require('./policyService');
const { valid, definition, clone } = require('../config/policyRegistry');
const { FIELD_POLICIES, SHIPPED_ANALYSIS_DEFAULTS, DEFERRED_FIELDS } = require('../config/qcRuleFields');
const { resolveLoq } = require('./qcMethodContextService');
function error(statusCode, code, message) { return Object.assign(new Error(message), { statusCode, code }); }
const fields = Object.keys(FIELD_POLICIES);
function criteria(row) {
    return Object.fromEntries(fields.map(field => [field, field === 'failAction' && row?.[field] != null ? JSON.parse(row[field]) : row?.[field] ?? null]));
}
function validateCriteria(values) {
    for (const field of fields) {
        const value = values[field];
        if (value === null) continue;
        const d = definition(FIELD_POLICIES[field]);
        if (d.unsupportedValues?.includes(value)) throw error(422, 'QC_RULE_MODE_UNSUPPORTED', 'This QC mode needs a later audit implementation.');
        if (!valid(FIELD_POLICIES[field], value)) throw error(422, 'QC_RULE_VALUE_INVALID', `Invalid QC criterion: ${field}.`);
    }
    for (const [min, max] of [['crmRecoveryMin', 'crmRecoveryMax'], ['ccvMin', 'ccvMax']]) {
        if (values[min] !== null && values[max] !== null && values[min] > values[max]) throw error(422, 'QC_RULE_VALUE_INVALID', 'A lower QC bound cannot exceed its upper bound.');
    }
}
async function target(reference, analysisCode, methodologyId, db) {
    if (typeof reference !== 'string' || !reference.trim()) throw error(422, 'QC_RULE_SCOPE_INVALID', 'A laboratory reference is required.');
    const lab = await policyService.resolveLab(reference, db);
    if (!lab) throw error(404, 'LAB_NOT_FOUND', 'Laboratory not found.');
    const analysis = typeof analysisCode === 'string' && await db.analysis.findUnique({ where: { code: analysisCode } });
    if (!analysis || (analysis.labId && analysis.labId !== lab.id && analysis.labId !== lab.code)) throw error(422, 'QC_RULE_SCOPE_INVALID', 'Analysis must be available to this laboratory.');
    if (methodologyId !== null) {
        const method = typeof methodologyId === 'string' && methodologyId && await db.methodology.findUnique({ where: { id: methodologyId } });
        if (!method || method.analysisCode !== analysisCode || (method.labId && method.labId !== lab.id && method.labId !== lab.code)) {
            throw error(422, 'QC_RULE_SCOPE_INVALID', 'Method must belong to this analysis and laboratory.');
        }
    }
    return { lab, analysis };
}

async function resolve(reference, analysisCode, context = {}) {
    const db = context.db || require('../prisma');
    if (!context.db) return db.$transaction(tx => resolve(reference, analysisCode, { ...context, db: tx }));
    const methodologyId = context.noLoqReason === 'METHOD_AMBIGUOUS' ? null : context.methodologyId || null;
    // Historical batches may predate a registered Lab/catalogue entry. They keep
    // the policy fallback; saving a rule still requires a fully validated target.
    const [lab, analysis] = await Promise.all([policyService.resolveLab(reference, db), db.analysis.findUnique({ where: { code: analysisCode } })]);
    const evaluatedAt = context.evaluatedAt || new Date();
    const query = method => db.qcRule.findFirst({ where: { labId: lab.id, analysisCode, methodologyId: method, effectiveFrom: { lte: evaluatedAt } }, orderBy: { version: 'desc' } });
    const row = lab ? (methodologyId && await query(methodologyId)) || await query(null) : null;
    const overrides = criteria(row);
    validateCriteria(overrides);
    const used = context.policySnapshot || await policyService.snapshot(lab?.id || reference, { db, analysisCode, methodologyId });
    const shipped = analysis?.isGlobal && !analysis.labId ? SHIPPED_ANALYSIS_DEFAULTS[analysisCode] || {} : {};
    const resolved = {};
    for (const [field, key] of Object.entries(FIELD_POLICIES)) {
        const policy = await policyService.resolve(lab?.id || reference, key, { db, analysisCode, methodologyId, snapshot: used });
        resolved[field] = overrides[field] !== null ? { value: clone(overrides[field]), source: 'QC_RULE' }
            : ['METHOD_OVERRIDE', 'ANALYSIS_OVERRIDE'].includes(policy.source) ? policy
                : Object.hasOwn(shipped, field) ? { value: clone(shipped[field]), source: 'SHIPPED_ANALYSIS_DEFAULT' } : policy;
    }
    validateCriteria(Object.fromEntries(Object.entries(resolved).map(([key, value]) => [key, value.value])));
    return { id: row?.id || null, version: row?.version || null, source: row ? 'QC_RULE' : 'DEFAULT_RULE',
        methodologyId, evaluatedAt: evaluatedAt.toISOString(), effectiveFrom: row?.effectiveFrom || null,
        resolved, notes: context.noLoqReason ? [context.noLoqReason] : [], deferredFields: DEFERRED_FIELDS };
}

async function list(actor, reference, analysisCode, methodologyId = null, options = {}) {
    const db = options.db || require('../prisma');
    return db.$transaction(async tx => {
        const { lab } = await target(reference, analysisCode, methodologyId, tx);
        await policyService.assertScope(actor, lab, false, tx);
        const versions = await tx.qcRule.findMany({ where: { labId: lab.id, analysisCode, methodologyId }, orderBy: { version: 'desc' } });
        const methods = await tx.methodology.findMany({ where: { analysisCode, OR: [{ labId: null }, { labId: lab.id }, { labId: lab.code }] }, select: { id: true, name: true } });
        return { labId: lab.id, analysisCode, methodologyId, fieldPolicies: FIELD_POLICIES, expectedVersion: versions[0]?.version || 0,
            versions: versions.map(row => ({ ...row, criteria: criteria(row) })), methods,
            qcRule: await resolve(lab.id, analysisCode, { ...options, db: tx, methodologyId }) };
    });
}

async function change(actor, request, options = {}) {
    const db = options.db || require('../prisma');
    try { return await db.$transaction(async tx => {
        const methodologyId = request.methodologyId ?? null;
        const { lab } = await target(request.labId, request.analysisCode, methodologyId, tx);
        await policyService.assertScope(actor, lab, true, tx);
        if (typeof request.reason !== 'string' || !request.reason.trim()) throw error(400, 'QC_RULE_REASON_REQUIRED', 'A reason is required for QC rule changes.');
        const previous = await tx.qcRule.findFirst({ where: { labId: lab.id, analysisCode: request.analysisCode, methodologyId }, orderBy: { version: 'desc' } });
        const version = previous?.version || 0;
        if (!Number.isSafeInteger(request.expectedVersion) || request.expectedVersion !== version) throw error(409, 'QC_RULE_VERSION_CONFLICT', 'QC rule changed. Refresh before saving.');
        const now = new Date();
        const effectiveFrom = request.effectiveFrom === undefined ? now : new Date(request.effectiveFrom);
        if ((request.effectiveFrom !== undefined && (typeof request.effectiveFrom !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(request.effectiveFrom))) || !Number.isFinite(effectiveFrom.getTime()) || effectiveFrom < now) {
            throw error(422, 'QC_RULE_EFFECTIVE_FROM_INVALID', 'QC rules cannot be backdated.');
        }
        if (request.criteria !== undefined && (!request.criteria || typeof request.criteria !== 'object' || Array.isArray(request.criteria) || Object.keys(request.criteria).some(field => !fields.includes(field)))) {
            throw error(422, 'QC_RULE_VALUE_INVALID', 'Unknown QC criteria.');
        }
        const values = request.reset === true ? criteria(null) : { ...criteria(previous), ...(request.criteria || {}) };
        validateCriteria(values);
        const prospective = { id: crypto.randomUUID(), labId: lab.id, analysisCode: request.analysisCode, methodologyId,
            version: version + 1, effectiveFrom, approvedBy: actor.username, reason: request.reason.trim(), createdAt: now,
            ...values, failAction: values.failAction === null ? null : JSON.stringify(values.failAction) };
        await tx.qcRule.create({ data: prospective });
        // Validate inherited bounds too. A scheduled revision is checked at its own effective time.
        const after = await resolve(lab.id, request.analysisCode, { ...options, db: tx, methodologyId, evaluatedAt: effectiveFrom });
        await tx.auditLog.create({ data: { id: crypto.randomUUID(), entity: 'QC_RULE', entityId: prospective.id, labId: lab.id,
            action: 'CREATE_QC_RULE_VERSION', performedBy: actor.username, timestamp: now,
            before: JSON.stringify(previous), after: JSON.stringify(prospective),
            details: JSON.stringify({ kind: 'QC_RULE_CHANGE', reason: prospective.reason, version: version + 1, methodologyId, resolved: after }) } });
        const loq = await resolveLoq(request.analysisCode, methodologyId, tx);
        const warnings = after.resolved.blankLimitMode.value !== 'ABSOLUTE' && loq.loq === null ? [{ code: 'QC_RULE_LOQ_MISSING', notes: loq.noLoqReason ? [loq.noLoqReason] : [] }] : [];
        return { rule: { ...prospective, criteria: values }, expectedVersion: version + 1, qcRule: after, warnings };
    }); } catch (e) {
        if (['P2002', 'P2034'].includes(e.code) || /SQLITE_BUSY|database is locked/.test(e.message)) throw error(409, 'QC_RULE_VERSION_CONFLICT', 'QC rule changed. Refresh before saving.');
        throw e;
    }
}
module.exports = { resolve, list, change, criteria, validateCriteria, FIELD_POLICIES, DEFERRED_FIELDS };
