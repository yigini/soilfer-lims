const prisma = require('../prisma');
const writes = require('./inventoryWriteService');
const { LOCATION_PURPOSES } = require('../config/custodyContract');
const MAX_ROWS = 2000, MAX_BYTES = 2 * 1024 * 1024;
const columns = require('../../shared/importColumns.json');
const ITEM_TYPES = columns.itemTypes, LOCATION_TYPES = columns.locationTypes;
const COLUMNS = Object.freeze(columns.inventory);
const control = /[\u0000-\u001f\u007f-\u009f]/;
const problem = (statusCode, code) => Object.assign(new Error(code), { statusCode, code });
const issue = (row, code, field) => { if (!row.errors.some(error => error.code === code && error.field === field)) row.errors.push({ code, field }); };
const own = (object, key) => Object.hasOwn(object, key);
const locKey = (name, purpose) => JSON.stringify([name, purpose]);
const itemKey = row => row.shortCode ? 'code:' + row.shortCode : 'name:' + JSON.stringify([row.name, row.itemType]);
const nameKey = row => 'name:' + JSON.stringify([row.name, row.itemType]);
function push(map, key, value) { if (!map.has(key)) map.set(key, []); if (!map.get(key).includes(value)) map.get(key).push(value); }
function scalar(value) {
    if (value == null) return '';
    if (!['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw problem(400, 'IMPORT_INVALID_CELL');
    const text = String(value);
    if (control.test(text)) throw problem(400, 'IMPORT_CONTROL_CHARACTER');
    return text.trim();
}
function envelope(input, user) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw problem(400, 'IMPORT_INVALID_REQUEST');
    if (Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_BYTES) throw problem(413, 'IMPORT_TOO_LARGE');
    if (!['SKIP', 'UPDATE'].includes(input.duplicateMode) || typeof input.atomic !== 'boolean') throw problem(400, 'IMPORT_INVALID_REQUEST');
    const labId = user.role === 'SUPER_ADMIN' ? scalar(input.labId) : user.labId;
    if (user.role !== 'SUPER_ADMIN' && own(input, 'labId') && input.labId !== user.labId) throw problem(403, 'IMPORT_LAB_FORBIDDEN');
    if (!labId) throw problem(400, 'IMPORT_LAB_REQUIRED');
    const fileName = scalar(input.fileName);
    if (!fileName || fileName.length > 255) throw problem(400, 'IMPORT_INVALID_FILENAME');
    const sheets = input.sheets;
    if (!sheets || typeof sheets !== 'object' || Array.isArray(sheets) || Object.keys(sheets).some(sheet => !own(COLUMNS, sheet)) || !Object.keys(sheets).length) throw problem(400, 'IMPORT_INVALID_SHEETS');
    const rows = {}, ignoredColumns = {};
    for (const sheet of Object.keys(COLUMNS)) {
        const source = own(sheets, sheet) ? sheets[sheet] : [];
        if (!Array.isArray(source)) throw problem(400, 'IMPORT_INVALID_SHEET');
        if (source.length > MAX_ROWS) throw problem(413, 'IMPORT_TOO_LARGE');
        const unknown = new Set();
        rows[sheet] = source.map((cells, index) => {
            const row = { sheet, rowNumber: index + 2, _index: index, provided: new Set(), values: {}, errors: [], status: 'NEW' };
            if (!cells || typeof cells !== 'object' || Array.isArray(cells)) { issue(row, 'IMPORT_INVALID_ROW'); return row; }
            if (own(cells, 'rowNumber')) {
                if (!Number.isSafeInteger(cells.rowNumber) || cells.rowNumber < 1) issue(row, 'IMPORT_INVALID_ROW_NUMBER', 'rowNumber');
                else row.rowNumber = cells.rowNumber;
            }
            for (const [column, value] of Object.entries(cells)) {
                if (column === 'rowNumber') continue;
                try { const clean = scalar(value); if (COLUMNS[sheet].includes(column)) { row.values[column] = clean; row.provided.add(column); } else unknown.add(column); }
                catch (error) { issue(row, error.code, column); }
            }
            if (row.values.labId && row.values.labId !== labId) issue(row, 'IMPORT_LAB_FORBIDDEN', 'labId');
            return row;
        });
        ignoredColumns[sheet] = [...unknown].sort();
    }
    return { labId, fileName, duplicateMode: input.duplicateMode, atomic: input.atomic, rows, ignoredColumns };
}
function required(row, fields) { for (const field of fields) if (!row.values[field]) issue(row, 'IMPORT_REQUIRED', field); }
function oneOf(row, field, choices) { if (!choices.includes(row.values[field])) issue(row, 'IMPORT_INVALID_ENUM', field); }
function decimal(row, field, { positive = false, optional = false } = {}) {
    const value = row.values[field];
    if (!value && optional) return 0;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value || '') || !Number.isFinite(Number(value)) || Number(value) < 0 || positive && Number(value) === 0) {
        issue(row, 'IMPORT_INVALID_NUMBER', field); return null;
    }
    return Number(value);
}
function date(row, field) {
    const value = row.values[field]; if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
        issue(row, 'IMPORT_INVALID_DATE', field); return null;
    }
    return value;
}
function duplicates(rows, keyFor) {
    const groups = new Map();
    for (const row of rows) { row.key = keyFor(row.values); if (row.key) push(groups, row.key, row); }
    for (const group of groups.values()) if (group.length > 1) for (const row of group) issue(row, 'IMPORT_DUPLICATE_IN_FILE');
}
function match(row, choices, field) {
    if (choices.length > 1) { issue(row, 'IMPORT_AMBIGUOUS_REFERENCE', field); return null; }
    return choices[0] || null;
}
function registerSource(map, row, keys) { for (const key of keys.filter(Boolean)) push(map, key, row); }
function reference(row, { id, name, purpose, code, itemType, optional = false }, index, submitted, field, kind) {
    if (!id && !name && !code) { if (!optional) issue(row, 'IMPORT_REQUIRED', field); return null; }
    const key = id ? 'id:' + id : kind === 'location' ? locKey(name, purpose || 'REAGENT') : code ? 'code:' + code : 'name:' + JSON.stringify([name, itemType]);
    if ((submitted.get(key) || []).some(candidate => candidate.errors.length)) { issue(row, 'IMPORT_PARENT_FAILED', field); return null; }
    const found = match(row, index.get(key) || [], field);
    if (!found) { if (!row.errors.some(error => error.field === field)) issue(row, kind === 'location' ? 'IMPORT_UNKNOWN_LOCATION' : 'IMPORT_UNKNOWN_ITEM', field); return null; }
    if (found._plan?.errors.length) { issue(row, 'IMPORT_PARENT_FAILED', field); return null; }
    return found;
}
function describe(plan, mode = 'preview') {
    const sheets = {}, counts = {}, totals = { created: 0, updated: 0, skipped: 0, errors: 0 };
    for (const [sheet, rows] of Object.entries(plan.rows)) {
        counts[sheet] = { NEW: 0, DUPLICATE_SKIP: 0, DUPLICATE_UPDATE: 0, ERROR: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
        sheets[sheet] = rows.map(row => {
            const status = row.errors.length ? 'ERROR' : row.status;
            counts[sheet][status]++;
            if (status === 'ERROR') { counts[sheet].errors++; totals.errors++; }
            if (row.outcome) { counts[sheet][row.outcome]++; totals[row.outcome]++; }
            return { sheet, rowNumber: row.rowNumber, status, errors: row.errors, values: row.values,
                ...(row.existing && { existingId: row.existing.id }), ...(row.savedId && { id: row.savedId }) };
        });
    }
    return { mode, labId: plan.labId, fileName: plan.fileName, atomic: plan.atomic, duplicateMode: plan.duplicateMode, committed: false,
        ignoredColumns: plan.ignoredColumns, sheets, counts, totals, totalRows: Object.values(sheets).reduce((sum, rows) => sum + rows.length, 0) };
}
async function validate(db, user, input) {
    const plan = envelope(input, user);
    const lab = await db.lab.findUnique({ where: { id: plan.labId }, select: { id: true, isActive: true } });
    if (!lab?.isActive) throw problem(400, 'IMPORT_LAB_UNAVAILABLE');
    const [locations, items, lots] = await Promise.all([
        db.inventoryLocation.findMany({ where: { labId: plan.labId } }), db.inventoryItem.findMany({ where: { labId: plan.labId } }), db.inventoryLot.findMany({ where: { labId: plan.labId } })
    ]);
    const locationIndex = new Map(), itemIndex = new Map(), sourceLocations = new Map(), sourceItems = new Map();
    for (const location of locations) { push(locationIndex, 'id:' + location.id, location); push(locationIndex, locKey(location.name, location.purpose), location); }
    for (const item of items) { push(itemIndex, 'id:' + item.id, item); push(itemIndex, itemKey(item), item); push(itemIndex, nameKey(item), item); }
    duplicates(plan.rows.locations, values => values.name && locKey(values.name, values.purpose || 'REAGENT'));
    for (const row of plan.rows.locations) {
        const values = row.values; values.purpose ||= 'REAGENT'; values.locationType ||= 'SHELF';
        required(row, ['name']); oneOf(row, 'purpose', LOCATION_PURPOSES); oneOf(row, 'locationType', LOCATION_TYPES);
        row.existing = match(row, locationIndex.get(row.key) || [], 'name');
        row.status = row.existing ? plan.duplicateMode === 'UPDATE' ? 'DUPLICATE_UPDATE' : 'DUPLICATE_SKIP' : 'NEW';
        row.record = row.existing || { id: 'import:locations:' + row._index, name: values.name, purpose: values.purpose, isActive: true, _plan: row };
        registerSource(sourceLocations, row, [row.key, row.existing && 'id:' + row.existing.id]);
        if (!row.existing && !row.errors.length) push(locationIndex, row.key, row.record);
    }
    for (const row of plan.rows.locations) {
        if (row.status !== 'NEW' || row.errors.length) continue;
        const v = row.values;
        row.parent = reference(row, { id: v.parentLocationId, name: v.parentLocationName, purpose: v.parentLocationPurpose || v.purpose, optional: true }, locationIndex, sourceLocations, 'parentLocationName', 'location');
        if (row.parent && (!row.parent.isActive || row.parent.purpose !== v.purpose)) issue(row, 'CUSTODY_LOCATION_INVALID', 'parentLocationName');
    }
    const depth = (row, seen = new Set()) => {
        if (seen.has(row)) { issue(row, 'IMPORT_PARENT_CYCLE', 'parentLocationName'); return 0; }
        if (!row.parent?._plan) return 0;
        const next = new Set(seen); next.add(row); const result = 1 + depth(row.parent._plan, next);
        if (row.parent._plan.errors.length) issue(row, 'IMPORT_PARENT_FAILED', 'parentLocationName');
        return result;
    };
    for (const row of plan.rows.locations) row.depth = depth(row);
    duplicates(plan.rows.items, values => (values.shortCode || values.name && values.itemType) && itemKey(values));
    for (const row of plan.rows.items) {
        const v = row.values;
        required(row, ['name', 'itemType', 'unitOfMeasure']); oneOf(row, 'itemType', ITEM_TYPES);
        row.reorderPoint = decimal(row, 'reorderPoint', { optional: true }); row.reorderQuantity = decimal(row, 'reorderQuantity', { optional: true });
        row.existing = match(row, itemIndex.get(row.key) || [], 'shortCode');
        row.status = row.existing ? plan.duplicateMode === 'UPDATE' ? 'DUPLICATE_UPDATE' : 'DUPLICATE_SKIP' : 'NEW';
        row.location = reference(row, { id: v.defaultLocationId, name: v.defaultLocationName, purpose: v.defaultLocationPurpose, optional: true }, locationIndex, sourceLocations, 'defaultLocationName', 'location');
        if (row.location && (!row.location.isActive || row.location.purpose !== 'REAGENT')) issue(row, 'CUSTODY_LOCATION_INVALID', 'defaultLocationName');
        row.record = row.existing || { id: 'import:items:' + row._index, name: v.name, shortCode: v.shortCode || null, itemType: v.itemType, unitOfMeasure: v.unitOfMeasure, isActive: true, _plan: row };
        registerSource(sourceItems, row, [row.key, nameKey(v), row.existing && 'id:' + row.existing.id]);
        if (!row.errors.length) { if (!row.existing) push(itemIndex, row.key, row.record); push(itemIndex, nameKey(v), row.record); }
    }
    const lotKeys = new Map();
    for (const lot of lots) push(lotKeys, JSON.stringify([lot.inventoryItemId, lot.lotNumber]), lot);
    for (const row of plan.rows.lots) {
        const v = row.values; required(row, ['lotNumber']);
        row.item = reference(row, { id: v.inventoryItemId, code: v.itemShortCode, name: v.itemName, itemType: v.itemType }, itemIndex, sourceItems, 'itemShortCode', 'item');
        row.key = row.item && JSON.stringify([row.item.id, v.lotNumber]);
        row.existing = row.key && match(row, lotKeys.get(row.key) || [], 'lotNumber');
        row.status = row.existing ? 'DUPLICATE_SKIP' : 'NEW';
        // Existing stock is always skipped, even in UPDATE mode. No stock field is written.
        if (row.existing) continue;
        if (row.item && !row.item.isActive) issue(row, 'IMPORT_ITEM_INACTIVE', 'itemShortCode');
        row.quantity = decimal(row, 'quantity', { positive: true }); row.receivedDate = date(row, 'receivedDate'); row.expiryDate = date(row, 'expiryDate');
        row.location = reference(row, { id: v.locationId, name: v.locationName, purpose: v.locationPurpose, optional: true }, locationIndex, sourceLocations, 'locationName', 'location');
        if (!row.location && row.item) {
            if (row.item._plan) row.location = row.item._plan.location;
            else if (row.item.defaultLocationId) row.location = reference(row, { id: row.item.defaultLocationId }, locationIndex, sourceLocations, 'locationName', 'location');
        }
        if (row.location && (!row.location.isActive || row.location.purpose !== 'REAGENT')) issue(row, 'CUSTODY_LOCATION_INVALID', 'locationName');
        if (v.unitOfMeasure && row.item && v.unitOfMeasure !== row.item.unitOfMeasure) issue(row, 'IMPORT_UNIT_MISMATCH', 'unitOfMeasure');
    }
    const inFileLots = new Map(); for (const row of plan.rows.lots) if (row.key) push(inFileLots, row.key, row);
    for (const rows of inFileLots.values()) if (rows.length > 1) for (const row of rows) issue(row, 'IMPORT_DUPLICATE_IN_FILE');
    return plan;
}
const actualId = record => record?._plan ? record._plan.savedId : record?.id;
async function apply(db, user, plan) {
    for (const row of [...plan.rows.locations].sort((a, b) => a.depth - b.depth)) {
        if (row.errors.length) continue;
        const v = row.values;
        if (row.status === 'DUPLICATE_SKIP') { row.savedId = row.existing.id; row.outcome = 'skipped'; continue; }
        if (row.status === 'NEW') {
            const saved = await writes.createLocation(user, { labId: plan.labId, name: v.name, purpose: v.purpose, locationType: v.locationType,
                parentLocationId: actualId(row.parent), temperatureRange: v.temperatureRange || null }, { db });
            row.savedId = saved.id; row.outcome = 'created';
        } else {
            const data = Object.fromEntries(['locationType', 'temperatureRange'].filter(field => row.provided.has(field)).map(field => [field, v[field] || null]));
            const saved = await db.inventoryLocation.update({ where: { id: row.existing.id }, data });
            await writes.audit(db, { entity: 'INVENTORY', entityId: saved.id, action: 'LOCATION_UPDATED', details: 'Updated imported location description', user, labId: plan.labId, before: row.existing, after: saved });
            row.savedId = saved.id; row.outcome = 'updated';
        }
    }
    for (const row of plan.rows.items) {
        if (row.errors.length) continue;
        const v = row.values;
        if (row.status === 'DUPLICATE_SKIP') { row.savedId = row.existing.id; row.outcome = 'skipped'; continue; }
        if (row.status === 'NEW') {
            const saved = await writes.createItem(user, { ...v, labId: plan.labId, defaultLocationId: actualId(row.location), reorderPoint: row.reorderPoint, reorderQuantity: row.reorderQuantity }, { db });
            row.savedId = saved.id; row.outcome = 'created';
        } else {
            const data = Object.fromEntries(['name', 'grade', 'hazardClass', 'sopLink', 'preferredVendor', 'notes'].filter(field => row.provided.has(field)).map(field => [field, v[field] || null]));
            const saved = await db.inventoryItem.update({ where: { id: row.existing.id }, data });
            await writes.audit(db, { entity: 'INVENTORY', entityId: saved.id, action: 'ITEM_UPDATED', details: 'Updated imported item description', user, labId: plan.labId, before: row.existing, after: saved });
            row.savedId = saved.id; row.outcome = 'updated';
        }
    }
    for (const row of plan.rows.lots) {
        if (row.errors.length) continue;
        if (row.status === 'DUPLICATE_SKIP') { row.savedId = row.existing.id; row.outcome = 'skipped'; continue; }
        const v = row.values;
        const saved = await writes.createLot(user, { inventoryItemId: actualId(row.item), lotNumber: v.lotNumber, quantity: row.quantity,
            locationId: actualId(row.location), receivedDate: row.receivedDate, expiryDate: row.expiryDate,
            concentration: v.concentration, preparedBy: v.preparedBy, traceabilityNotes: v.traceabilityNotes }, { db });
        row.savedId = saved.id; row.outcome = 'created';
    }
}
async function preview(user, input, { db = prisma } = {}) { return describe(await validate(db, user, input)); }
async function commit(user, input, { db = prisma } = {}) {
    return db.$transaction(async tx => {
        const plan = await validate(tx, user, input), before = describe(plan, 'commit');
        if (plan.atomic && before.totals.errors) return { ...before, code: 'IMPORT_VALIDATION_FAILED' };
        await apply(tx, user, plan);
        const result = { ...describe(plan, 'commit'), committed: true };
        await writes.audit(tx, { entity: 'INVENTORY', entityId: 'IMPORT', action: 'IMPORT_COMPLETED',
            details: JSON.stringify({ fileName: plan.fileName, user: user.username, labId: plan.labId, counts: result.counts, totals: result.totals }), user, labId: plan.labId });
        return result;
    }, { timeout: 120000, maxWait: 5000 });
}
module.exports = { preview, commit, validate, COLUMNS, ITEM_TYPES, LOCATION_TYPES, MAX_ROWS, MAX_BYTES };
