const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { allocateContainerCode } = require('./sampleCodeService');
const KINDS = Object.freeze(['BULK', 'FINE_EARTH', 'GROUND', 'ALIQUOT', 'ARCHIVE']);
const invalid = message => new rules.TransitionError(message, 400, 'SAMPLE_CONTAINER_FIELDS_INVALID');

function creationRequest(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !['kind', 'parentId', 'massG'].includes(key))) throw invalid('Choose the container kind, parent and optional mass.');
    if (!KINDS.includes(input.kind)) throw invalid('Choose a supported container kind.');
    if (input.parentId != null && (typeof input.parentId !== 'string' || !input.parentId.trim())) throw invalid('Choose an existing parent container.');
    if (input.massG != null && (typeof input.massG !== 'number' || !Number.isFinite(input.massG) || input.massG <= 0)) throw invalid('Mass must be a positive finite number in grams.');
    const parentId = input.parentId ?? null;
    if (!parentId && input.kind !== 'BULK') throw invalid('A derived container requires its physical parent.');
    return { kind: input.kind, parentId, massG: input.massG ?? null };
}
async function scopedSample(db, sampleId, actor) {
    const sample = await db.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    return sample;
}
async function list(db, sampleId, actor) {
    if (!hasPermission(actor, 'VIEW_SAMPLES')) throw new rules.TransitionError('Sample access is required.', 403, 'SAMPLE_CONTAINER_FORBIDDEN');
    const sample = await scopedSample(db, sampleId, actor);
    const rows = await db.sampleContainer.findMany({ where: { sampleId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const events = await db.custodyEvent.findMany({ where: { sampleId }, orderBy: [{ at: 'asc' }, { id: 'asc' }] });
    const current = new Map(events.map(event => [event.containerId, event]));
    return rows.map(row => { const event = current.get(row.id) || current.get(null); return { ...row,
        storageLocationId: event ? event.toLocationId : row.storageLocationId,
        status: sample.status === 'DISPOSED' || event?.type === 'DISPOSED' ? 'DISPOSED' : row.status }; });
}
async function create(db, sampleId, actor, input) {
    if (!hasPermission(actor, 'MANAGE_CONTAINERS')) throw new rules.TransitionError('Container management is required.', 403, 'SAMPLE_CONTAINER_FORBIDDEN');
    const request = creationRequest(input), createdBy = rules.actorName(actor);
    return rules.inTransaction(db, async tx => {
        const sample = await scopedSample(tx, sampleId, actor);
        require('./resultEvidenceService').assertAmendable(sample);
        await require('./sampleHoldService').assertNotHeld(tx, sample);
        if (['EXPECTED', 'DISPOSED', 'ARCHIVED', 'REJECTED'].includes(sample.status))
            throw new rules.TransitionError('This sample cannot create containers.', 409, 'SAMPLE_CONTAINER_STATE_REFUSED');
        if (request.parentId) {
            const parent = await tx.sampleContainer.findUnique({ where: { id: request.parentId } });
            if (!parent || parent.sampleId !== sampleId || parent.status !== 'ACTIVE')
                throw new rules.TransitionError('The parent must be active and belong to this sample.', 409, 'SAMPLE_CONTAINER_PARENT_INVALID');
        }
        const now = new Date();
        const code = await allocateContainerCode(tx, { labReference: sample.assignedLab, projectCode: sample.projectCode, issuedAt: now });
        const row = await tx.sampleContainer.create({ data: { id: 'container-' + randomUUID(), sampleId, ...request, code, createdAt: now, createdBy } });
        await tx.auditLog.create({ data: { id: randomUUID(), action: 'CONTAINER_CREATED', entity: 'SAMPLE', entityId: sampleId,
            sampleId, labId: sample.assignedLab, performedBy: createdBy, performedByName: actor.name || createdBy,
            details: JSON.stringify({ containerId: row.id, code, ...request }), timestamp: now } });
        return row;
    });
}
function aliquotRequest(value) {
    if (value != null && (typeof value !== 'string' || !value.trim())) throw invalid('Choose an existing aliquot.');
    return value ?? null;
}
async function validateAliquot(tx, sampleId, value) {
    rules.requireTransaction(tx);
    const id = aliquotRequest(value);
    if (id == null) return null;
    const row = await tx.sampleContainer.findUnique({ where: { id } });
    if (!row || row.sampleId !== sampleId || row.kind !== 'ALIQUOT' || row.status !== 'ACTIVE')
        throw new rules.TransitionError('The aliquot must be active and belong to this sample.', 409, 'SAMPLE_CONTAINER_ALIQUOT_INVALID');
    return row.id;
}
module.exports = { KINDS, creationRequest, list, create, aliquotRequest, validateAliquot };
