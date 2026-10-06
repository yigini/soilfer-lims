const { randomUUID } = require('node:crypto');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { TransitionError } = rules;
const ACTIVE = 'AMBIGUOUS_PROVENANCE_HOLD';
const COMPAT = 'KOBO_PROVENANCE';
const TYPES = Object.freeze(['PROVENANCE', 'CUSTODY', 'CLIENT_QUERY', 'QC', 'OTHER']);

function object(value) {
    if (value == null || value === '') return {};
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) { return null; }
}

// One compatibility reader for the marker and its known Kobo field wrapper.
function legacyHoldState(sample) {
    const metadata = object(sample.metadata), fieldMetadata = object(sample.fieldMetadata);
    const marker = metadata?.provenanceHold, mirror = fieldMetadata?.provenanceHold;
    const invalid = !metadata || !fieldMetadata || marker != null && !object(marker) || mirror != null && !object(mirror);
    const markerActive = marker != null && marker.status !== 'RESOLVED';
    const mirrorActive = mirror != null && (mirror.value ?? mirror.status) !== 'RESOLVED';
    return { metadata, fieldMetadata, marker, mirror, invalid: Boolean(invalid),
        active: Boolean(invalid || markerActive || mirrorActive), reason: marker?.reason || null };
}

async function isHeld(db, sample) {
    if (!sample) return false;
    return legacyHoldState(sample).active || Boolean(await db.sampleHold.count({ where: { sampleId: sample.id, resolvedAt: null } }));
}

// Callers supply only an observed SQL alias and optional historical column set.
// Table presence must be supplied explicitly for pre-#183 schema rehearsals.
function heldSql(alias, { columns = new Set(['metadata', 'fieldMetadata']), hasHoldTable = true } = {}) {
    if (!/^(?:[A-Za-z_][A-Za-z0-9_]*|NEW|OLD)$/.test(alias)) throw new Error('Invalid sample alias.');
    const predicates = [];
    for (const column of ['metadata', 'fieldMetadata']) if (columns.has(column)) {
        const ref = `${alias}."${column}"`, pointer = '$.provenanceHold';
        predicates.push(`(CASE WHEN ${ref} IS NULL OR ${ref} = '' THEN 0
            WHEN NOT json_valid(${ref}) THEN 1 WHEN json_type(${ref}) != 'object' THEN 1
            WHEN json_type(${ref}, '${pointer}') IS NULL THEN 0
            WHEN json_type(${ref}, '${pointer}') != 'object' THEN 1
            WHEN COALESCE(json_extract(${ref}, '${pointer}.${column === 'fieldMetadata' ? 'value' : 'status'}'),
                json_extract(${ref}, '${pointer}.status'), '') != 'RESOLVED' THEN 1 ELSE 0 END = 1)`);
    }
    if (hasHoldTable) predicates.push(`EXISTS (SELECT 1 FROM "SampleHold" hold WHERE hold."sampleId" = ${alias}."id" AND hold."resolvedAt" IS NULL)`);
    return predicates.length ? `(${predicates.join(' OR ')})` : '0';
}

async function assertNotHeld(db, sample) {
    if (await isHeld(db, sample)) throw new TransitionError('Resolve all sample holds before acceptance or assignment.', 409, 'SAMPLE_HELD');
}

async function raiseHold(tx, { sampleId, type, reason, actor, now = new Date(), compatMarker = null }) {
    rules.requireTransaction(tx);
    const raisedBy = rules.actorName(actor), note = rules.requireReason(reason);
    if (!TYPES.includes(type) || ![null, COMPAT].includes(compatMarker)) throw new TransitionError('Choose a valid hold type.', 400, 'HOLD_TYPE_INVALID');
    const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    if (typeof actor !== 'string' && !hasPermission(actor, 'RECEIVE_SAMPLE')) throw new TransitionError('Hold creation is not authorized.', 403, 'HOLD_RAISE_FORBIDDEN');
    if (typeof actor === 'string' && !actor.startsWith('system:')) throw new TransitionError('A named Kobo system actor is required.', 403, 'HOLD_RAISE_FORBIDDEN');
    const hold = await tx.sampleHold.create({ data: { id: randomUUID(), sampleId: sample.id, type, reason: note,
        raisedBy, raisedAt: now, attributionSource: 'LIVE', compatMarker } });
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE_HOLD', entityId: hold.id, action: 'HOLD_RAISED',
        performedBy: raisedBy, sampleId: sample.id, labId: sample.assignedLab || null, timestamp: now,
        after: JSON.stringify(hold) } });
    return hold;
}

async function raiseKoboHold(tx, { sampleId, marker, actor, now = new Date() }) {
    rules.requireTransaction(tx);
    const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    const legacy = legacyHoldState(sample);
    if (legacy.invalid || legacy.marker?.resolutions != null && !Array.isArray(legacy.marker.resolutions)) {
        throw new TransitionError('Stored hold metadata needs review.', 409, 'HOLD_MARKER_INVALID');
    }
    const hold = await raiseHold(tx, { sampleId, type: 'PROVENANCE', reason: marker.reason, actor, now, compatMarker: COMPAT });
    const nextMarker = { ...legacy.marker, ...marker, status: ACTIVE,
        ...(legacy.marker?.resolutions && { resolutions: legacy.marker.resolutions }) };
    const fieldMetadata = { ...legacy.fieldMetadata };
    if (legacy.mirror) fieldMetadata.provenanceHold = { ...legacy.mirror, value: ACTIVE };
    await require('./sampleStateService').writeSampleHoldCompatibility(tx, sample,
        { metadata: JSON.stringify({ ...legacy.metadata, provenanceHold: nextMarker }),
            ...(legacy.mirror && { fieldMetadata: JSON.stringify(fieldMetadata) }) }, actor);
    return hold;
}

async function resolveHold(tx, { sampleId, holdId, reason, actor, now = new Date() }) {
    rules.requireTransaction(tx);
    const resolvedBy = rules.actorName(actor), note = rules.requireReason(reason);
    if (!hasPermission(actor, 'APPROVE_RESULTS')) throw new TransitionError('Hold resolution requires manager authority.', 403, 'HOLD_RESOLVE_FORBIDDEN');
    const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    const legacy = legacyHoldState(sample);
    if (legacy.active && !await tx.sampleHold.count({ where: { sampleId: sample.id, compatMarker: COMPAT } })) {
        throw new TransitionError('Review and back-fill the legacy hold before resolution.', 409, 'HOLD_BACKFILL_REQUIRED');
    }
    const hold = await tx.sampleHold.findUnique({ where: { id: String(holdId) } });
    if (!hold || hold.sampleId !== sample.id) throw new TransitionError('Sample hold not found.', 404, 'HOLD_NOT_FOUND');
    if (hold.resolvedAt) return hold;
    if (legacy.invalid || hold.compatMarker && (!legacy.marker || !object(legacy.marker) ||
        legacy.marker.resolutions != null && !Array.isArray(legacy.marker.resolutions))) {
        throw new TransitionError('Stored hold metadata needs review.', 409, 'HOLD_MARKER_INVALID');
    }
    const changed = await tx.sampleHold.updateMany({ where: { id: hold.id, resolvedAt: null }, data: { resolvedBy, resolvedAt: now, resolution: note } });
    if (changed.count !== 1) throw new TransitionError('Hold changed. Refresh before resolution.', 409, 'HOLD_STATE_CHANGED');
    if (hold.compatMarker) {
        const otherOpen = await tx.sampleHold.count({ where: { sampleId: sample.id, compatMarker: COMPAT, resolvedAt: null } });
        const resolutions = [...(legacy.marker.resolutions || []), { holdId: hold.id, resolvedBy, resolvedAt: now.toISOString(), reason: note }];
        const metadata = { ...legacy.metadata, provenanceHold: { ...legacy.marker, resolutions,
            ...(!otherOpen && { status: 'RESOLVED' }) } };
        const fieldMetadata = { ...legacy.fieldMetadata, ...(legacy.mirror && { provenanceHold: { ...legacy.mirror,
            ...(!otherOpen && { value: 'RESOLVED', ...(Object.hasOwn(legacy.mirror, 'status') && { status: 'RESOLVED' }) }) } }) };
        await require('./sampleStateService').writeSampleHoldCompatibility(tx, sample,
            { metadata: JSON.stringify(metadata), ...(legacy.mirror && { fieldMetadata: JSON.stringify(fieldMetadata) }) }, actor);
    }
    const updated = await tx.sampleHold.findUnique({ where: { id: hold.id } });
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE_HOLD', entityId: hold.id, action: 'HOLD_RESOLVED',
        performedBy: resolvedBy, sampleId: sample.id, labId: sample.assignedLab || null, timestamp: now,
        before: JSON.stringify(hold), after: JSON.stringify(updated) } });
    return updated;
}

function presentHold(hold) {
    return { ...hold, raisedAtIsUpperBound: hold.attributionSource === 'LEGACY_HOLD_UPDATED_AT' };
}

module.exports = { TYPES, ACTIVE, COMPAT, legacyHoldState, isHeld, heldSql, assertNotHeld, raiseHold, raiseKoboHold, resolveHold, presentHold };
