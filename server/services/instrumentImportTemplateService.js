const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName, inTransaction } = require('./workflowStateRules');
const fail = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const column = value => Number.isSafeInteger(value) && value >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;
const keys = (value, allowed) => plainObject(value) && Object.keys(value).every(key => allowed.includes(key));
const unitSource = value => Object.hasOwn(value, 'unitColumn')
    ? column(value.unitColumn) && !Object.hasOwn(value, 'unit') : text(value.unit);

// Column numbers are zero-based. The mapping describes raw cells; it never
// resolves methods, converts units, calculates values or chooses a QC limit.
function validateMapping(mapping) {
    const invalid = () => { throw fail(400, 'IMPORT_TEMPLATE_MAPPING_INVALID', 'Select exact identifier, analyte and raw-input columns.'); };
    if (!keys(mapping, ['version', 'delimiter', 'hasHeader', 'idColumn', 'idType', 'analytes', 'qcDetector', 'sheetName']) ||
        mapping.version !== 1 || !['COMMA', 'SEMICOLON', 'TAB'].includes(mapping.delimiter) ||
        typeof mapping.hasHeader !== 'boolean' || !column(mapping.idColumn) ||
        !['LAB_SAMPLE_CODE', 'ORIGINAL_ID', 'POSITION'].includes(mapping.idType) ||
        !Array.isArray(mapping.analytes) || !mapping.analytes.length ||
        Object.hasOwn(mapping, 'sheetName') && !text(mapping.sheetName)) invalid();
    const codes = new Set();
    for (const analyte of mapping.analytes) {
        if (!plainObject(analyte) || !text(analyte.analysisCode) || codes.has(analyte.analysisCode)) invalid();
        codes.add(analyte.analysisCode);
        if (Object.hasOwn(analyte, 'inputs')) {
            if (!keys(analyte, ['analysisCode', 'inputs']) || !Array.isArray(analyte.inputs) || !analyte.inputs.length) invalid();
            for (const input of analyte.inputs) {
                if (!keys(input, ['variable', 'column', 'unit', 'unitColumn']) || !text(input.variable) || !column(input.column) ||
                    !unitSource(input)) invalid();
            }
        } else if (!keys(analyte, ['analysisCode', 'valueColumn', 'unit', 'unitColumn', 'dilutionColumn']) ||
            !column(analyte.valueColumn) || !unitSource(analyte) ||
            Object.hasOwn(analyte, 'dilutionColumn') && !column(analyte.dilutionColumn)) invalid();
    }
    if (mapping.qcDetector !== undefined) {
        const detector = mapping.qcDetector;
        if (!keys(detector, ['positionColumn', 'prefixes']) || !column(detector.positionColumn) ||
            !Array.isArray(detector.prefixes) || !detector.prefixes.length) invalid();
        const prefixes = new Set();
        for (const rule of detector.prefixes) {
            if (!keys(rule, ['prefix', 'kind']) || !text(rule.prefix) ||
                !['BLANK', 'CCV', 'LRM'].includes(rule.kind) || prefixes.has(rule.prefix)) invalid();
            prefixes.add(rule.prefix);
        }
    }
    return JSON.parse(JSON.stringify(mapping));
}

function permission(actor, edit = false) {
    if (!hasPermission(actor, edit ? 'MANAGE_EQUIPMENT' : 'ENTER_RESULTS'))
        throw fail(403, 'IMPORT_PERMISSION_DENIED', 'Instrument import permission is required.');
}
async function instrumentScope(db, actor, instrumentId, labReference, edit = false) {
    permission(actor, edit);
    const instrument = typeof instrumentId === 'string' && await db.equipmentAsset.findUnique({ where: { id: instrumentId } });
    if (!instrument) throw fail(404, 'IMPORT_INSTRUMENT_NOT_FOUND', 'Select an existing instrument.');
    const lab = await policyService.resolveLab(instrument.labId, db);
    const selected = labReference === undefined ? lab : await policyService.resolveLab(labReference, db);
    if (!lab || selected?.id !== lab.id) throw fail(403, 'IMPORT_SCOPE_DENIED', 'The instrument must belong to the selected laboratory.');
    const actorLab = await policyService.resolveLab(actor.labId, db), normalized = { ...actor, labId: actorLab?.id || actor.labId };
    scopeGuard.ensureScope(normalized, { labId: lab.id }, { labField: 'labId', altLabField: null });
    if (edit && !scopeGuard.canManageLab(normalized, lab.id)) throw fail(403, 'IMPORT_SCOPE_DENIED', 'The instrument is outside your management scope.');
    return { instrument, lab };
}
function decode(row) {
    try { return { ...row, mapping: validateMapping(JSON.parse(row.mapping)) }; }
    catch (cause) { throw Object.assign(fail(409, 'IMPORT_TEMPLATE_INVALID', 'The stored mapping needs review.'), { cause }); }
}
async function saveTemplate(db, actor, body, now = new Date()) {
    permission(actor, true);
    if (!keys(body, ['instrumentId', 'labId', 'name', 'mapping', 'supersedesId', 'expectedVersion']) || !text(body.name) ||
        !(body.supersedesId === null || text(body.supersedesId)) || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0)
        throw fail(422, 'IMPORT_TEMPLATE_INVALID', 'Supply a named mapping and its expected revision.');
    const mapping = validateMapping(body.mapping);
    return inTransaction(db, async tx => {
        const { lab, instrument } = await instrumentScope(tx, actor, body.instrumentId, body.labId, true);
        const username = actorName(actor);
        if (!await tx.user.findUnique({ where: { username }, select: { username: true } }))
            throw fail(403, 'IMPORT_ACTOR_INVALID', 'A registered actor is required.');
        let version = 1;
        if (body.supersedesId !== null) {
            const previous = await tx.importTemplate.findUnique({ where: { id: body.supersedesId } });
            if (!previous || previous.labId !== lab.id || previous.instrumentId !== instrument.id)
                throw fail(409, 'IMPORT_TEMPLATE_INSTRUMENT_MISMATCH', 'The prior mapping belongs to another instrument.');
            if (previous.version !== body.expectedVersion || await tx.importTemplate.findFirst({ where: { supersedesId: previous.id }, select: { id: true } }))
                throw fail(409, 'IMPORT_TEMPLATE_VERSION_CHANGED', 'The mapping was revised. Refresh before saving.');
            version = previous.version + 1;
        } else if (body.expectedVersion !== 0) throw fail(409, 'IMPORT_TEMPLATE_VERSION_CHANGED', 'A new mapping starts at version one.');
        const row = await tx.importTemplate.create({ data: { id: randomUUID(), labId: lab.id, instrumentId: instrument.id,
            name: body.name.trim(), version, mapping: JSON.stringify(mapping), createdBy: username, createdAt: now, supersedesId: body.supersedesId } });
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'IMPORT_TEMPLATE', entityId: row.id, labId: lab.id,
            action: 'IMPORT_TEMPLATE_SAVED', performedBy: username, timestamp: now, after: JSON.stringify(row) } });
        return decode(row);
    });
}
async function listTemplates(db, actor, instrumentId, labId) {
    const { instrument, lab } = await instrumentScope(db, actor, instrumentId, labId);
    return (await db.importTemplate.findMany({ where: { instrumentId: instrument.id, labId: lab.id }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })).map(decode);
}
async function templateForRun(db, actor, batchId, templateId) {
    permission(actor);
    const batch = await require('./qcRunViewService').readQcRun(db, batchId, actor);
    const { instrument, lab } = await instrumentScope(db, actor, batch.instrumentId, batch.labId);
    if (!batch.startedAt || !batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE'))
        throw fail(409, 'IMPORT_NATIVE_RUN_REQUIRED', 'Select a started native run.');
    if (batch.status === 'CLOSED') throw fail(409, 'IMPORT_RUN_CLOSED', 'The selected run is closed.');
    const row = typeof templateId === 'string' && await db.importTemplate.findUnique({ where: { id: templateId } });
    if (!row || row.labId !== lab.id || row.instrumentId !== instrument.id)
        throw fail(409, 'IMPORT_TEMPLATE_INSTRUMENT_MISMATCH', 'Select a mapping for this run instrument.');
    const template = decode(row);
    if (template.mapping.analytes.some(entry => !batch.analytes.some(analyte => analyte.analysisCode === entry.analysisCode)))
        throw fail(409, 'IMPORT_ANALYSIS_NOT_IN_RUN', 'Every mapped analysis must belong to this run.');
    return { batch, template, lab, instrument };
}
module.exports = { validateMapping, saveTemplate, listTemplates, templateForRun, instrumentScope, fail };
