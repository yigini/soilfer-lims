'use strict';
// #205 pin 6099330444: structured preparation evidence. Rows are append-only
// and scoped to the gate confirmation receipt that wrote them.
const { randomUUID } = require('node:crypto');
const { TransitionError } = require('./workflowStateRules');

const DRYING_METHODS = Object.freeze(['AIR', 'OVEN_40', 'OVEN_105', 'OTHER']);
const PREPARATION_STEPS = Object.freeze(['SIEVING', 'GRINDING', 'SPLITTING']);
const FIELDS = Object.freeze(['gateCode', 'equipmentId', 'method', 'startedAt', 'endedAt', 'temperatureC', 'massBeforeG',
    'massAfterG', 'coarseFractionG', 'sieveMm', 'grindMm', 'notes']);
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const invalid = (message, details) => new TransitionError(message, 422, 'PREPARATION_RECORD_INVALID', details);

/** Steps the PREPARATION gate requires: active OperationalGate rows, the lab row overriding the global row by code. */
async function requiredSteps(db, labId, gate) {
    if (gate === 'DRYING') return ['DRYING'];
    const rows = await db.operationalGate.findMany({ where: { code: { in: [...PREPARATION_STEPS] },
        OR: [{ labId: null }, ...(labId ? [{ labId }] : [])] } });
    const effective = new Map();
    for (const row of rows.sort((a, b) => (a.labId ? 1 : 0) - (b.labId ? 1 : 0))) effective.set(row.code, row);
    return [...effective.values()].filter(row => row.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
        .map(row => row.code);
}

function number(record, field, { required = false, min = null, exclusive = false } = {}) {
    const value = record[field];
    if (value === undefined || value === null || value === '') {
        if (required) throw invalid(`${record.gateCode} requires ${field}.`, { gateCode: record.gateCode, field });
        return null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(`${field} must be a number.`, { gateCode: record.gateCode, field });
    if (min !== null && (exclusive ? value <= min : value < min)) throw invalid(`${field} is out of range.`, { gateCode: record.gateCode, field });
    return value;
}

function time(record, field, now) {
    const raw = record[field];
    const value = typeof raw === 'string' && raw.trim() ? new Date(raw) : null;
    if (!value || Number.isNaN(value.getTime())) throw invalid(`${record.gateCode} requires ${field}.`, { gateCode: record.gateCode, field });
    if (value.getTime() > now.getTime() + CLOCK_SKEW_MS) throw invalid(`${field} cannot be in the future.`, { gateCode: record.gateCode, field });
    return value;
}

function normalize(record, now) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw invalid('Each preparation record must be an object.');
    const unknown = Object.keys(record).filter(key => !FIELDS.includes(key));
    if (unknown.length) throw invalid('Preparation records accept only the recorded fields.', { fields: unknown });
    const gateCode = record.gateCode;
    if (![ 'DRYING', ...PREPARATION_STEPS ].includes(gateCode)) throw invalid('Unknown preparation step.', { gateCode });
    const startedAt = time(record, 'startedAt', now), endedAt = time(record, 'endedAt', now);
    if (endedAt <= startedAt) throw invalid('A preparation step must end after it starts.', { gateCode, field: 'endedAt' });
    const row = { gateCode, startedAt, endedAt, equipmentId: null, method: null, temperatureC: null,
        massBeforeG: number(record, 'massBeforeG', { required: gateCode === 'SIEVING', min: 0, exclusive: true }),
        massAfterG: number(record, 'massAfterG', { min: 0, exclusive: true }),
        coarseFractionG: null, coarseFractionPct: null, sieveMm: null, grindMm: null,
        notes: typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim().slice(0, 1000) : null };
    if (record.equipmentId !== undefined && record.equipmentId !== null && record.equipmentId !== '') {
        if (typeof record.equipmentId !== 'string') throw invalid('equipmentId must be an equipment id.', { gateCode, field: 'equipmentId' });
        row.equipmentId = record.equipmentId;
    }
    if (gateCode === 'DRYING') {
        if (!DRYING_METHODS.includes(record.method)) throw invalid('DRYING requires a drying method.', { gateCode, field: 'method', allowed: DRYING_METHODS });
        row.method = record.method;
        row.temperatureC = number(record, 'temperatureC', { required: true, min: -20 });
        if (row.temperatureC > 250) throw invalid('temperatureC is out of range.', { gateCode, field: 'temperatureC' });
    } else {
        for (const field of ['method', 'temperatureC']) if (record[field] !== undefined && record[field] !== null)
            throw invalid(`${gateCode} does not record ${field}.`, { gateCode, field });
    }
    if (gateCode === 'SIEVING') {
        row.sieveMm = number(record, 'sieveMm', { required: true, min: 0, exclusive: true });
        row.coarseFractionG = number(record, 'coarseFractionG', { required: true, min: 0 });
        if (row.coarseFractionG > row.massBeforeG) throw invalid('The coarse fraction cannot exceed the sieved mass.', { gateCode, field: 'coarseFractionG' });
        row.coarseFractionPct = Math.round(row.coarseFractionG / row.massBeforeG * 1e6) / 1e4;
    } else if (record.sieveMm !== undefined && record.sieveMm !== null || record.coarseFractionG !== undefined && record.coarseFractionG !== null) {
        throw invalid(`${gateCode} does not record sieve fractions.`, { gateCode });
    }
    if (gateCode === 'GRINDING') row.grindMm = number(record, 'grindMm', { required: true, min: 0, exclusive: true });
    else if (record.grindMm !== undefined && record.grindMm !== null) throw invalid(`${gateCode} does not record grindMm.`, { gateCode });
    return row;
}

/** Validates the submitted records against the gate's required steps before anything is written. */
async function validateRecords(tx, { gate, sample, records, now = new Date() }) {
    const required = await requiredSteps(tx, sample.assignedLab || sample.labId || null, gate);
    if (records !== undefined && records !== null && !Array.isArray(records)) throw invalid('Preparation records must be a list.');
    const rows = (records || []).map(record => normalize(record, now));
    const codes = rows.map(row => row.gateCode);
    const missing = required.filter(code => !codes.includes(code));
    if (missing.length) throw new TransitionError(`${gate} requires its structured preparation record.`, 422, 'PREPARATION_RECORD_REQUIRED',
        { gate, required, missing });
    const extra = codes.filter((code, index) => !required.includes(code) || codes.indexOf(code) !== index);
    if (extra.length) throw invalid('Submitted steps are not required by this gate.', { gate, required, extra });
    for (const row of rows.filter(value => value.equipmentId)) {
        const asset = await tx.equipmentAsset.findUnique({ where: { id: row.equipmentId } });
        const labId = sample.assignedLab || sample.labId;
        if (!asset || labId && asset.labId !== labId || asset.status !== 'IN_SERVICE') {
            throw new TransitionError('The preparation equipment is not in service in this laboratory.', 422, 'PREPARATION_EQUIPMENT_INVALID',
                { gateCode: row.gateCode, equipmentId: row.equipmentId });
        }
    }
    return { required, rows };
}

async function write(tx, prepared, { sampleId, workItemId, receiptId, actor }) {
    const written = [];
    for (const row of prepared.rows) {
        written.push(await tx.preparationRecord.create({ data: { id: randomUUID(), sampleId, workItemId, receiptId,
            performedBy: actor.username, version: 1, ...row } }));
    }
    return written;
}

function summary(row) {
    return { id: row.id, gateCode: row.gateCode, method: row.method, temperatureC: row.temperatureC,
        startedAt: new Date(row.startedAt).toISOString(), endedAt: new Date(row.endedAt).toISOString(),
        durationMinutes: Math.round((new Date(row.endedAt) - new Date(row.startedAt)) / 60000),
        equipmentId: row.equipmentId, massBeforeG: row.massBeforeG, massAfterG: row.massAfterG,
        coarseFractionG: row.coarseFractionG, coarseFractionPct: row.coarseFractionPct, sieveMm: row.sieveMm, grindMm: row.grindMm,
        performedBy: row.performedBy, notes: row.notes,
        ...(row.equipment && { equipment: { name: row.equipment.name, internalAssetTag: row.equipment.internalAssetTag || null } }) };
}

/** Records written under the given confirmation receipts, in gate order. */
async function forReceipts(db, receiptIds) {
    const ids = [...new Set(receiptIds.filter(id => typeof id === 'string' && id))];
    if (!ids.length) return [];
    const order = ['DRYING', ...PREPARATION_STEPS];
    const rows = await db.preparationRecord.findMany({ where: { receiptId: { in: ids } }, include: { equipment: true } });
    return rows.sort((a, b) => order.indexOf(a.gateCode) - order.indexOf(b.gateCode)).map(row => ({ receiptId: row.receiptId, ...summary(row) }));
}

module.exports = { DRYING_METHODS, PREPARATION_STEPS, requiredSteps, validateRecords, write, summary, forReceipts };
