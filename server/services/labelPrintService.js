const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { issuedCode } = require('./sampleCodeService');

const fail = (code, status = 400) => new rules.TransitionError(code, status, code);
function capability(sample, actor, issued) {
    if (!hasPermission(actor, 'PRINT_LABELS')) return { allowed: false, code: 'LABEL_PRINT_FORBIDDEN' };
    if (['REJECTED', 'RECEIVED_REJECTED', 'DISPOSED'].includes(sample.status)) return { allowed: false, code: 'LABEL_PRINT_STATE_REFUSED' };
    if (issued === null) return { allowed: false, code: 'LABEL_PRINT_CODE_REQUIRED' };
    return { allowed: true, code: null };
}
function request(input, printing) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !['items', 'format', 'reason'].includes(key)) ||
        !Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw fail('LABEL_PRINT_FIELDS_INVALID');
    const keys = new Set(); let total = 0;
    const items = input.items.map(row => {
        if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['entity', 'entityId', 'count'].includes(key)) ||
            !['SAMPLE', 'CONTAINER'].includes(row.entity) || typeof row.entityId !== 'string' || !row.entityId.trim() ||
            !Number.isInteger(row.count) || row.count < 1 || row.count > 20 || keys.has(`${row.entity}:${row.entityId}`)) throw fail('LABEL_PRINT_FIELDS_INVALID');
        keys.add(`${row.entity}:${row.entityId}`); total += row.count;
        return { entity: row.entity, entityId: row.entityId, count: row.count };
    });
    if (total > 200 || (printing && !['STANDARD', 'COMPACT'].includes(input.format)) ||
        (input.reason != null && (typeof input.reason !== 'string' || input.reason.trim().length > 1000))) throw fail('LABEL_PRINT_FIELDS_INVALID');
    return { items, format: input.format, reason: input.reason?.trim() || null };
}
async function resolve(db, item, actor) {
    if (!hasPermission(actor, 'PRINT_LABELS')) throw fail('LABEL_PRINT_FORBIDDEN', 403);
    const container = item.entity === 'CONTAINER' ? await db.sampleContainer.findUnique({ where: { id: item.entityId } }) : null;
    if (item.entity === 'CONTAINER' && !container) throw fail('LABEL_PRINT_NOT_FOUND', 404);
    const sample = await db.sample.findUnique({ where: { id: container?.sampleId || item.entityId } });
    if (!sample) throw fail('LABEL_PRINT_NOT_FOUND', 404);
    rules.assertScope(actor, sample);
    const gate = capability(sample, actor);
    if (!gate.allowed || (container && container.status !== 'ACTIVE')) throw fail('LABEL_PRINT_STATE_REFUSED', 409);
    const sampleCode = await issuedCode(sample, db), code = container?.code || sampleCode;
    if (!code) throw fail('LABEL_PRINT_CODE_REQUIRED', 409);
    // Issued values are authoritative, including historical/no-CHK policies.
    // Never append a new checksum or reinterpret a code using today's policy.
    if (!/^[\x20-\x7e]+$/.test(code) || code.length > 128) throw fail('LABEL_PRINT_CODE_UNSUPPORTED', 409);
    const previous = await db.labelPrintEvent.findFirst({ where: { entity: item.entity, entityId: item.entityId }, orderBy: { ordinal: 'desc' } });
    return { ...item, code, sampleId: sample.id, sampleCode, container, ordinal: (previous?.ordinal || 0) + 1,
        reprint: Boolean(previous), sample };
}
async function preview(db, actor, input) {
    const parsed = request(input, false);
    const labels = [];
    for (const item of parsed.items) labels.push(await resolve(db, item, actor));
    return labels;
}
async function print(db, actor, input) {
    const parsed = request(input, true), by = rules.actorName(actor);
    return rules.inTransaction(db, async tx => {
        const labels = [];
        for (const item of parsed.items) labels.push(await resolve(tx, item, actor));
        if (labels.some(label => label.reprint) && !parsed.reason) throw fail('LABEL_REPRINT_REASON_REQUIRED');
        const at = new Date(), events = [];
        for (const label of labels) events.push(await tx.labelPrintEvent.create({ data: {
            id: randomUUID(), entity: label.entity, entityId: label.entityId, sampleId: label.sampleId,
            containerId: label.container?.id || null, code: label.code, count: label.count, ordinal: label.ordinal,
            format: parsed.format, reason: parsed.reason, by, at
        } }));
        return { labels, events };
    });
}
module.exports = { capability, preview, print };
