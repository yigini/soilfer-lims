import * as XLSX from 'xlsx';
import delimitedText from '@lims/delimited-text';
import schema from '../../../shared/importColumns.json';
export const INVENTORY_COLUMNS = schema.inventory;
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const failure = code => Object.assign(new Error(code), { code });
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
export const normalizeImportHeader = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// The server escapes an original apostrophe too, so this reverses only the CSV
// transport escape. XLSX string cells do not use this convention.
export const decodeImportCsvCell = value => /^'[\u0000-\u0020]*[=+\-@']/.test(value) ? value.slice(1) : value;
function text(value) {
    const result = value == null ? '' : String(value);
    if (CONTROL.test(result)) throw failure('IMPORT_CONTROL_CHARACTER');
    return result.trim();
}
function fromCsv(source, name) {
    const candidates = [',', ';', '\t'].map(delimiter => {
        const rows = delimitedText.parseDelimited(source.replace(/^\uFEFF/, ''), delimiter);
        const width = rows[0]?.cells.length || 0;
        return { rows, width, score: width > 1 ? rows.filter(row => !row.error && row.cells.length === width).length : 0 };
    }).sort((a, b) => b.score - a.score || b.width - a.width);
    const parsed = candidates[0].rows;
    if (!parsed.length || !parsed[0].cells.some(cell => cell.trim())) throw failure('IMPORT_EMPTY_FILE');
    if (parsed.some(row => row.error)) throw failure('IMPORT_INVALID_CSV');
    const headers = parsed[0].cells.map((cell, index) => text(decodeImportCsvCell(cell)) || `Column ${index + 1}`);
    const rows = parsed.slice(1).filter(row => row.cells.some(cell => cell.trim())).map(row => ({ rowNumber: row.rowNumber, cells: row.cells.map(cell => decodeImportCsvCell(cell)) }));
    if (rows.length > IMPORT_MAX_ROWS) throw failure('IMPORT_TOO_LARGE');
    return [{ id: 'sheet-0', name, headers, rows }];
}
function workbookCell(cell) {
    if (!cell) return '';
    if (cell.f) return '=' + cell.f;
    if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
        const date = XLSX.SSF.parse_date_code(cell.v);
        if (date) return `${String(date.y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    // Numeric cells use their actual value, independent of display grouping.
    return cell.t === 'n' || cell.t === 'b' ? String(cell.v) : String(cell.v ?? '');
}
export async function readInventoryImportFile(file) {
    if (!file || !file.name) throw failure('IMPORT_EMPTY_FILE');
    if (file.size > IMPORT_MAX_BYTES) throw failure('IMPORT_TOO_LARGE');
    if (/\.(csv|tsv)$/i.test(file.name)) return fromCsv(await file.text(), file.name);
    if (!/\.(xlsx|xls)$/i.test(file.name)) throw failure('IMPORT_UNSUPPORTED_FILE');
    let workbook;
    try { workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellNF: true, cellFormula: true, sheetRows: IMPORT_MAX_ROWS + 2 }); }
    catch { throw failure('IMPORT_INVALID_WORKBOOK'); }
    const sheets = workbook.SheetNames.map((name, index) => {
        const sheet = workbook.Sheets[name];
        if (!sheet['!ref']) return { id: 'sheet-' + index, name, headers: [], rows: [] };
        const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
        if (range.e.r - range.s.r > IMPORT_MAX_ROWS) throw failure('IMPORT_TOO_LARGE');
        const headers = [];
        for (let column = range.s.c; column <= range.e.c; column++) headers.push(text(workbookCell(sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })])) || `Column ${column + 1}`);
        const rows = [];
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const cells = headers.map((_header, column) => workbookCell(sheet[XLSX.utils.encode_cell({ r: row, c: column + range.s.c })]));
            if (cells.some(cell => cell.trim())) rows.push({ rowNumber: row + 1, cells });
        }
        return { id: 'sheet-' + index, name, headers, rows };
    });
    if (!sheets.some(sheet => sheet.rows.length)) throw failure('IMPORT_EMPTY_FILE');
    return sheets;
}
export function initialInventoryImportMapping(sheets, t) {
    const mapping = {};
    for (const sheet of sheets) {
        const normalized = sheet.headers.map(normalizeImportHeader), title = normalizeImportHeader(sheet.name);
        let dataset = Object.keys(INVENTORY_COLUMNS).find(key => title === key || title === normalizeImportHeader(t('bulkImport.datasets.' + key))) || '';
        if (!dataset && sheets.length === 1) dataset = normalized.includes('lotnumber') ? 'lots' : normalized.includes('itemtype') ? 'items' : normalized.includes('purpose') || normalized.includes('locationtype') ? 'locations' : '';
        mapping[sheet.id] = { dataset, columns: dataset ? inventoryColumnMapping(sheet, dataset, t) : {} };
    }
    return mapping;
}
export function inventoryColumnMapping(sheet, dataset, t) {
    return Object.fromEntries(INVENTORY_COLUMNS[dataset].map(column => {
        const names = [normalizeImportHeader(column), normalizeImportHeader(t('bulkImport.columns.' + column))];
        const matches = sheet.headers.map((header, index) => names.includes(normalizeImportHeader(header)) ? index : -1).filter(index => index >= 0);
        return [column, matches.length === 1 ? matches[0] : -1];
    }));
}
export function prepareInventoryImport(sheets, mapping, options) {
    const payload = { sheets: {}, duplicateMode: options.duplicateMode, atomic: options.atomic, fileName: options.fileName,
        ...(options.labId && { labId: options.labId }) };
    for (const sheet of sheets) {
        const choice = mapping[sheet.id];
        if (!choice?.dataset) continue;
        if (payload.sheets[choice.dataset]) throw failure('IMPORT_DUPLICATE_SHEET');
        const columns = INVENTORY_COLUMNS[choice.dataset];
        const mapped = Object.values(choice.columns).filter(index => index >= 0);
        if (new Set(mapped).size !== mapped.length) throw failure('IMPORT_DUPLICATE_MAPPING');
        const used = new Set(mapped);
        payload.sheets[choice.dataset] = sheet.rows.map(row => {
            const cells = { rowNumber: row.rowNumber };
            for (const column of columns) {
                const index = choice.columns[column];
                if (index >= 0) cells[column] = row.cells[index] ?? '';
            }
            // Only names of ignored columns are sent, never their unrelated contents.
            sheet.headers.forEach((header, index) => { if (!used.has(index)) cells[`unmapped:${index}:${header}`] = ''; });
            return cells;
        });
    }
    if (!Object.keys(payload.sheets).length) throw failure('IMPORT_NO_SHEET_SELECTED');
    if (new TextEncoder().encode(JSON.stringify(payload)).length > IMPORT_MAX_BYTES) throw failure('IMPORT_TOO_LARGE');
    return payload;
}
export function inventoryImportTemplate(t) {
    const workbook = XLSX.utils.book_new();
    const examples = {
        locations: { name: t('bulkImport.exampleLocation'), purpose: 'REAGENT', locationType: 'SHELF' },
        items: { shortCode: 'EXAMPLE-ITEM', name: t('bulkImport.exampleItem'), itemType: 'REAGENT', unitOfMeasure: 'mL', defaultLocationName: t('bulkImport.exampleLocation') },
        lots: { itemShortCode: 'EXAMPLE-ITEM', lotNumber: 'EXAMPLE-LOT', quantity: '10.5', expiryDate: '2030-12-31' }
    };
    for (const [dataset, columns] of Object.entries(INVENTORY_COLUMNS))
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columns, columns.map(column => examples[dataset][column] || '')]), dataset);
    const allowed = [
        [t('bulkImport.field'), t('bulkImport.allowedValues')],
        ['purpose', 'REAGENT | SAMPLE'], ['locationType', schema.locationTypes.join(' | ')], ['itemType', schema.itemTypes.join(' | ')],
        ['quantity / reorderPoint / reorderQuantity', t('bulkImport.numberFormatHint')], ['receivedDate / expiryDate', 'YYYY-MM-DD'],
        ['duplicateMode', 'SKIP | UPDATE'], [t('bulkImport.stockRule'), t('bulkImport.stockRuleHint')]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(allowed), 'Allowed values');
    return workbook;
}
export function downloadInventoryImportTemplate(t) { XLSX.writeFile(inventoryImportTemplate(t), 'inventory-import-template.xlsx'); }
export function importCsvReport(result, t) {
    const cell = value => {
        let text = String(value ?? ''); if (/^[\u0000-\u0020]*[=+\-@']/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [[t('bulkImport.sheet'), t('bulkImport.row'), t('bulkImport.result'), t('bulkImport.problems')]];
    for (const [sheet, entries] of Object.entries(result.sheets)) for (const entry of entries)
        rows.push([t('bulkImport.datasets.' + sheet), entry.rowNumber, t('bulkImport.status.' + entry.status), entry.errors.map(error => t('bulkImport.errors.' + error.code) + (error.field ? ': ' + t('bulkImport.columns.' + error.field, error.field) : '')).join('; ')]);
    return rows.map(row => row.map(cell).join(',')).join('\n');
}
