'use strict';
const MAX_ROWS = 2000, MAX_BYTES = 2 * 1024 * 1024;
const control = /[\u0000-\u001f\u007f-\u009f]/;
const problem = (statusCode, code) => Object.assign(new Error(code), { statusCode, code });
const issue = (row, code, field) => { if (!row.errors.some(error => error.code === code && error.field === field)) row.errors.push({ code, field }); };
const own = (object, key) => Object.hasOwn(object, key);
function push(map, key, value) { if (!map.has(key)) map.set(key, []); if (!map.get(key).includes(value)) map.get(key).push(value); }
function scalar(value) {
    if (value == null) return '';
    if (!['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw problem(400, 'IMPORT_INVALID_CELL');
    const text = String(value);
    if (control.test(text)) throw problem(400, 'IMPORT_CONTROL_CHARACTER');
    return text.trim();
}
function envelope(input, user, COLUMNS) {
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
module.exports = { MAX_ROWS, MAX_BYTES, problem, issue, own, push, scalar, envelope, required, oneOf, decimal, date, duplicates, match, describe };
