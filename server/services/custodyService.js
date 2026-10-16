const { randomUUID } = require('node:crypto');
const { TYPES, RECEIPT_FIELDS } = require('../config/custodyContract');
const { hasPermission } = require('../config/roles');
const scope = require('../utils/scopeGuard');
const rules = require('./workflowStateRules');
const fail = (code, message, status = 400) => new rules.TransitionError(message, status, code);

function authenticated(actor) {
    if (!actor || typeof actor !== 'object' || !actor.id || !actor.username || actor.isActive === false)
        throw fail('CUSTODY_ACTOR_REQUIRED', 'An authenticated acknowledgement is required.', 403);
    return rules.actorName(actor);
}
function receiptFacts(input = {}, actor) {
    const coc = input.coc || {};
    for (const value of [input.custodyCarrierName, input.custodyTrackingNumber, coc.deliveredBy, coc.carrierName, coc.trackingNumber, coc.waybillRef, input.deliveredBy, input.deliveryNoteRef])
        if (value != null && typeof value !== 'string') throw fail('INTAKE_CUSTODY_INVALID', 'Custody names and references must be text.', 422);
    const handover = input.custodyHandoverAt || coc.handoverAt || coc.date;
    if (handover && !Number.isFinite(new Date(handover).getTime())) throw fail('INTAKE_CUSTODY_INVALID', 'The custody handover date must be valid.', 422);
    return { custodyHandoverAt: handover ? new Date(handover).toISOString() : null,
        custodyCarrierName: input.custodyCarrierName || coc.deliveredBy || coc.carrierName || input.deliveredBy || null,
        custodyTrackingNumber: input.custodyTrackingNumber || coc.trackingNumber || coc.waybillRef || input.deliveryNoteRef || null,
        receivingOfficerId: String(actor.id), receivingOfficerName: actor.name || actor.username };
}
function withoutReceiptFields(data) {
    return Object.fromEntries(Object.entries(data).filter(([key]) => !RECEIPT_FIELDS.includes(key)));
}
async function acknowledgeReceipt(tx, { sample, consignment, actor, input = {} }) {
    rules.requireTransaction(tx);
    if (!hasPermission(actor, 'RECEIVE_SAMPLE')) throw fail('CUSTODY_FORBIDDEN', 'Physical receipt permission is required.', 403);
    const by = authenticated(actor);
    const entity = sample || consignment;
    if (sample) rules.assertScope(actor, sample);
    else scope.ensureScope(actor, consignment, { entityType: 'Consignment', altLabField: null });
    const where = sample ? { sampleId: sample.id, containerId: null } : { consignmentId: consignment.id, sampleId: null, containerId: null };
    const first = await tx.custodyEvent.findFirst({ where: { ...where, type: 'RECEIVED' }, orderBy: [{ at: 'asc' }, { id: 'asc' }] });
    if (first) return first;
    const facts = receiptFacts(input, actor);
    return tx.custodyEvent.create({ data: { id: randomUUID(), ...where, labId: entity.assignedLab || entity.labId,
        consignmentId: sample ? sample.consignmentId || null : consignment.id, type: 'RECEIVED', by, actorId: String(actor.id),
        at: new Date(), source: 'LIVE', acknowledgement: true, counterparty: facts.custodyCarrierName,
        reference: facts.custodyTrackingNumber, evidence: JSON.stringify(facts) } });
}
async function receiptView(db, record, kind = 'sample') {
    if (!record) return record;
    const first = await db.custodyEvent.findFirst({ where: { type: 'RECEIVED', containerId: null,
        ...(kind === 'sample' ? { sampleId: record.id } : { consignmentId: record.id, sampleId: null }) }, orderBy: [{ at: 'asc' }, { id: 'asc' }] });
    if (!first) return record;
    const evidence = JSON.parse(first.evidence || '{}');
    return { ...record, ...Object.fromEntries(RECEIPT_FIELDS.map(key => [key, evidence[key] ?? null])),
        custodyHandoverAt: evidence.custodyHandoverAt ? new Date(evidence.custodyHandoverAt) : first.at,
        custodyAcknowledgement: { by: first.by, actorId: first.actorId, at: first.at, authenticated: first.acknowledgement, source: first.source } };
}
async function scopedSample(db, id, actor) {
    const sample = await db.sample.findUnique({ where: { id: String(id) } });
    if (!sample) throw fail('SAMPLE_NOT_FOUND', 'Sample not found.', 404);
    rules.assertScope(actor, sample);
    return sample;
}
async function location(tx, id, labId) {
    if (typeof id !== 'string' || !id.trim()) throw fail('CUSTODY_LOCATION_REQUIRED', 'Choose a sample storage location.');
    const row = await tx.inventoryLocation.findUnique({ where: { id } });
    if (!row || row.labId !== labId || !row.isActive || row.purpose !== 'SAMPLE')
        throw fail('CUSTODY_LOCATION_INVALID', 'Choose an active sample storage location in this laboratory.');
    return row;
}
async function list(db, id, actor) {
    if (!hasPermission(actor, 'VIEW_SAMPLES')) throw fail('CUSTODY_FORBIDDEN', 'Sample access is required.', 403);
    const sample = await scopedSample(db, id, actor);
    const events = await db.custodyEvent.findMany({ where: { sampleId: sample.id }, orderBy: [{ at: 'asc' }, { id: 'asc' }] });
    return events;
}
async function record(db, id, actor, input) {
    if (!hasPermission(actor, 'ARCHIVE_SAMPLE')) throw fail('CUSTODY_FORBIDDEN', 'Custody management is required.', 403);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('CUSTODY_FIELDS_INVALID', 'Provide a custody event request.');
    for (const key of ['type', 'containerId', 'toLocationId', 'counterparty', 'reference'])
        if (input[key] != null && typeof input[key] !== 'string') throw fail('CUSTODY_FIELDS_INVALID', 'Custody locations, containers and references must be text.');
    const by = authenticated(actor), type = input.type || 'MOVED';
    if (!TYPES.includes(type) || ['RECEIVED', 'DISPOSED'].includes(type)) throw fail('CUSTODY_TYPE_INVALID', 'Use the receipt or disposal workflow for this event.');
    return rules.inTransaction(db, async tx => {
        const sample = await scopedSample(tx, id, actor), labId = sample.assignedLab;
        if (sample.status === 'DISPOSED') throw fail('DISPOSED_MATERIAL_IMMUTABLE', 'Disposed material cannot be moved.', 400);
        if (require('./sampleHoldService').legacyHoldState(sample).invalid) throw fail('SAMPLE_METADATA_INVALID', 'Stored sample metadata must be reviewed before changing custody.', 409);
        if (['MOVED', 'RETURNED'].includes(type) && !input.toLocationId) throw fail('CUSTODY_LOCATION_REQUIRED', 'Choose a sample storage location.');
        const reason = rules.requireReason(input.reason);
        const fresh = await tx.sample.findUnique({ where: { id: sample.id } });
        if (!fresh || fresh.status !== sample.status || fresh.metadata !== sample.metadata || fresh.fieldMetadata !== sample.fieldMetadata || fresh.assignedLab !== sample.assignedLab || fresh.updatedAt.getTime() !== sample.updatedAt.getTime())
            throw fail('SAMPLE_STATE_CHANGED', 'Sample changed. Reload before retrying.', 409);
        if (!labId) throw fail('CUSTODY_LAB_REQUIRED', 'Record the receiving laboratory before changing custody.', 409);
        if (['EXPECTED', 'DRAFT', 'DISPOSED'].includes(sample.status)) throw fail('CUSTODY_STATE_REFUSED', 'This sample has no movable material.', 409);
        const container = input.containerId ? await tx.sampleContainer.findUnique({ where: { id: input.containerId } }) : null;
        if (input.containerId && (!container || container.sampleId !== sample.id)) throw fail('CUSTODY_CONTAINER_INVALID', 'Choose a container belonging to this sample.');
        const previous = await tx.custodyEvent.findFirst({ where: { sampleId: sample.id, containerId: container?.id || null }, orderBy: [{ at: 'desc' }, { id: 'desc' }] });
        if (previous?.type === 'DISPOSED') throw fail('CUSTODY_STATE_REFUSED', 'This material is disposed.', 409);
        const to = input.toLocationId ? await location(tx, input.toLocationId, labId) : null;
        if (['ISSUED', 'SENT_OUT'].includes(type) && (typeof input.counterparty !== 'string' || !input.counterparty.trim()))
            throw fail('CUSTODY_COUNTERPARTY_REQUIRED', 'Record the receiving counterparty.');
        const event = await tx.custodyEvent.create({ data: { id: randomUUID(), sampleId: sample.id,
            containerId: container?.id || null, consignmentId: sample.consignmentId, labId, type,
            fromLocationId: previous?.toLocationId || null, toLocationId: to?.id || null, by, actorId: String(actor.id), at: new Date(Math.max(Date.now(), previous ? previous.at.getTime() + 1 : 0)),
            source: 'LIVE', acknowledgement: true, counterparty: input.counterparty?.trim() || null,
            reference: input.reference?.trim() || null, evidence: JSON.stringify({ reason }) } });
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, sampleId: sample.id,
            labId, action: 'STORAGE_MOVEMENT', performedBy: by, details: JSON.stringify({ ...event, toLocationName: to?.name || null }) } });
        return { success: true, event, location: to?.name || null };
    });
}
async function disposalEvent(tx, sample, actor, reason) {
    const by = authenticated(actor);
    if (!sample.assignedLab) throw fail('CUSTODY_LAB_REQUIRED', 'Record the receiving laboratory before disposing of material.', 409);
    const previous = await tx.custodyEvent.findFirst({ where: { sampleId: sample.id, containerId: null }, orderBy: [{ at: 'desc' }, { id: 'desc' }] });
    return tx.custodyEvent.create({ data: { id: randomUUID(), sampleId: sample.id, consignmentId: sample.consignmentId,
        labId: sample.assignedLab, type: 'DISPOSED', fromLocationId: previous?.toLocationId || null,
        by, actorId: String(actor.id), at: new Date(Math.max(Date.now(), previous ? previous.at.getTime() + 1 : 0)), source: 'LIVE', acknowledgement: true, evidence: JSON.stringify({ reason }) } });
}
module.exports = { acknowledgeReceipt, withoutReceiptFields, receiptView, scopedSample, location, list, record, disposalEvent };
