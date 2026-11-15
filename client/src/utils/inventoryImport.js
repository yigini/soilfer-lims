import * as XLSX from 'xlsx';
import delimitedText from '@lims/delimited-text';
import schema from '../../../shared/importColumns.json';
export const INVENTORY_COLUMNS = schema.inventory;
export const EQUIPMENT_COLUMNS = schema.equipment;
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const failure = code => Object.assign(new Error(code), { code });
const containsControl = value => Array.from(value).some(char => { const code = char.charCodeAt(0); return code <= 31 || code >= 127 && code <= 159; });
const formulaPrefix = value => { let index = 0; while (index < value.length && value.charCodeAt(index) <= 32) index++; return /^[=+\-@']/.test(value.slice(index)); };
export const normalizeImportHeader = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// The server escapes an original apostrophe too, so this reverses only the CSV
// transport escape. XLSX string cells do not use this convention.
export const decodeImportCsvCell = value => value.startsWith("'") && formulaPrefix(value.slice(1)) ? value.slice(1) : value;
function text(value) {
    const result = value == null ? '' : String(value);
    if (containsControl(result)) throw failure('IMPORT_CONTROL_CHARACTER');
    return result.trim();
}
function fromCsv(source, name, t) {
    const candidates = [',', ';', '\t'].map(delimiter => {
        const rows = delimitedText.parseDelimited(source.replace(/^\uFEFF/, ''), delimiter);
        const width = rows[0]?.cells.length || 0;
        return { rows, width, score: width > 1 ? rows.filter(row => !row.error && row.cells.length === width).length : 0 };
    }).sort((a, b) => b.score - a.score || b.width - a.width);
    const parsed = candidates[0].rows;
    if (!parsed.length || !parsed[0].cells.some(cell => cell.trim())) throw failure('IMPORT_EMPTY_FILE');
    if (parsed.some(row => row.error || row.cells.length > parsed[0].cells.length)) throw failure('IMPORT_INVALID_CSV');
    const headers = parsed[0].cells.map((cell, index) => text(decodeImportCsvCell(cell)) || (t ? t('bulkImport.unnamedColumn', { index: index + 1 }) : String(index + 1)));
    const rows = parsed.slice(1).filter(row => row.cells.some(cell => cell.trim())).map(row => ({ rowNumber: row.rowNumber, cells: row.cells.map(cell => decodeImportCsvCell(cell)) }));
    if (rows.length > IMPORT_MAX_ROWS) throw failure('IMPORT_TOO_LARGE');
    return [{ id: 'sheet-0', name, headers, rows }];
}
function workbookCell(cell) {
    if (!cell) return '';
    if (cell.f) return '=' + cell.f;
    if (cell.t === 'e') return cell.w || '#ERROR';
    if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
        const date = XLSX.SSF.parse_date_code(cell.v);
        if (date) return `${String(date.y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    // Numeric cells use their actual value, independent of display grouping.
    return cell.t === 'n' || cell.t === 'b' ? String(cell.v) : String(cell.v ?? '');
}
export async function readInventoryImportFile(file, t) {
    if (!file || !file.name) throw failure('IMPORT_EMPTY_FILE');
    if (file.size > IMPORT_MAX_BYTES) throw failure('IMPORT_TOO_LARGE');
    if (/\.(csv|tsv)$/i.test(file.name)) return fromCsv(await file.text(), file.name, t);
    if (!/\.(xlsx|xls)$/i.test(file.name)) throw failure('IMPORT_UNSUPPORTED_FILE');
    let workbook;
    try { workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellNF: true, cellFormula: true }); }
    catch { throw failure('IMPORT_INVALID_WORKBOOK'); }
    const sheets = workbook.SheetNames.map((name, index) => {
        const sheet = workbook.Sheets[name];
        const populated = new Map(), columns = new Set();
        // Count actual rows, rather than a formatted worksheet range. Empty leading
        // rows must not move the header or silently truncate a later data row.
        for (const [address, cell] of Object.entries(sheet)) {
            if (!/^[A-Z]+\d+$/i.test(address)) continue;
            const value = workbookCell(cell); if (!value.trim()) continue;
            const position = XLSX.utils.decode_cell(address);
            if (!populated.has(position.r)) populated.set(position.r, new Map());
            populated.get(position.r).set(position.c, value); columns.add(position.c);
        }
        const rowNumbers = [...populated.keys()].sort((a, b) => a - b), columnNumbers = [...columns].sort((a, b) => a - b);
        if (!rowNumbers.length) return { id: 'sheet-' + index, name, headers: [], rows: [] };
        if (rowNumbers.length - 1 > IMPORT_MAX_ROWS) throw failure('IMPORT_TOO_LARGE');
        const header = populated.get(rowNumbers[0]);
        const headers = columnNumbers.map(column => text(header.get(column)) || (t ? t('bulkImport.unnamedColumn', { index: column + 1 }) : String(column + 1)));
        const rows = rowNumbers.slice(1).map(row => ({ rowNumber: row + 1, cells: columnNumbers.map(column => populated.get(row).get(column) || '') }));
        return { id: 'sheet-' + index, name, headers, rows };
    });
    if (!sheets.some(sheet => sheet.rows.length)) throw failure('IMPORT_EMPTY_FILE');
    return sheets;
}
export function initialInventoryImportMapping(sheets, t, columns = INVENTORY_COLUMNS) {
    const mapping = {};
    for (const sheet of sheets) {
        const normalized = sheet.headers.map(normalizeImportHeader), title = normalizeImportHeader(sheet.name);
        let dataset = Object.keys(columns).find(key => title === key || title === normalizeImportHeader(t('bulkImport.datasets.' + key))) || '';
        if (!dataset && sheets.length === 1 && columns.equipment) dataset = 'equipment';
        if (!dataset && sheets.length === 1 && !columns.equipment) dataset = normalized.includes('lotnumber') ? 'lots' : normalized.includes('itemtype') ? 'items' : normalized.includes('purpose') || normalized.includes('locationtype') ? 'locations' : '';
        mapping[sheet.id] = { dataset, columns: dataset ? inventoryColumnMapping(sheet, dataset, t, columns) : {} };
    }
    return mapping;
}
export function inventoryColumnMapping(sheet, dataset, t, columns = INVENTORY_COLUMNS) {
    return Object.fromEntries(columns[dataset].map(column => {
        const names = [normalizeImportHeader(column), normalizeImportHeader(t('bulkImport.columns.' + column))];
        const matches = sheet.headers.map((header, index) => names.includes(normalizeImportHeader(header)) ? index : -1).filter(index => index >= 0);
        return [column, matches.length === 1 ? matches[0] : -1];
    }));
}
export function prepareInventoryImport(sheets, mapping, options, datasets = INVENTORY_COLUMNS) {
    const payload = { sheets: {}, duplicateMode: options.duplicateMode, atomic: options.atomic, fileName: options.fileName,
        ...(options.labId && { labId: options.labId }) };
    for (const sheet of sheets) {
        const choice = mapping[sheet.id];
        if (!choice?.dataset) continue;
        if (payload.sheets[choice.dataset]) throw failure('IMPORT_DUPLICATE_SHEET');
        const columns = datasets[choice.dataset];
        if (!columns) throw failure('IMPORT_INVALID_SHEETS');
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
export function inventoryImportTemplate(t, kind = 'inventory') {
    const datasets = schema[kind];
    const workbook = XLSX.utils.book_new();
    const examples = {
        equipment: { internalAssetTag: 'EXAMPLE-METER', name: t('bulkImport.exampleEquipment'), assetType: 'PH_METER', criticality: 'IMPORTANT' },
        locations: { name: t('bulkImport.exampleLocation'), purpose: 'REAGENT', locationType: 'SHELF' },
        items: { shortCode: 'EXAMPLE-ITEM', name: t('bulkImport.exampleItem'), itemType: 'REAGENT', unitOfMeasure: 'mL', defaultLocationName: t('bulkImport.exampleLocation') },
        lots: { itemShortCode: 'EXAMPLE-ITEM', lotNumber: 'EXAMPLE-LOT', quantity: '10.5', expiryDate: '2030-12-31' }
    };
    for (const [dataset, columns] of Object.entries(datasets))
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columns, columns.map(column => examples[dataset][column] || '')]), dataset);
    const allowed = kind === 'equipment' ? [
        [t('bulkImport.field'), t('bulkImport.allowedValues')], ['assetType', schema.assetTypes.join(' | ')],
        ['criticality', schema.criticalities.join(' | ')], ['lastCalibrationDate / nextCalibrationDueDate', 'YYYY-MM-DD'],
        ['eligibleAnalyses', t('bulkImport.eligibleAnalysesHint')], ['duplicateMode', 'SKIP | UPDATE'],
        [t('bulkImport.stockRule'), t('bulkImport.equipmentRuleHint')]
    ] : [
        [t('bulkImport.field'), t('bulkImport.allowedValues')],
        ['purpose', 'REAGENT | SAMPLE'], ['locationType', schema.locationTypes.join(' | ')], ['itemType', schema.itemTypes.join(' | ')],
        ['quantity / reorderPoint / reorderQuantity', t('bulkImport.numberFormatHint')], ['receivedDate / expiryDate', 'YYYY-MM-DD'],
        ['duplicateMode', 'SKIP | UPDATE'], [t('bulkImport.stockRule'), t('bulkImport.stockRuleHint')]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(allowed), t('bulkImport.allowedValuesSheet'));
    return workbook;
}
export function downloadInventoryImportTemplate(t, kind = 'inventory') { XLSX.writeFile(inventoryImportTemplate(t, kind), kind + '-import-template.xlsx'); }
export function importCsvReport(result, t) {
    const cell = value => {
        let text = String(value ?? ''); if (formulaPrefix(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [[t('bulkImport.sheet'), t('bulkImport.row'), t('bulkImport.result'), t('bulkImport.problems')]];
    for (const [sheet, entries] of Object.entries(result.sheets)) for (const entry of entries)
        rows.push([t('bulkImport.datasets.' + sheet), entry.rowNumber, t('bulkImport.status.' + entry.status), entry.errors.map(error => t('bulkImport.errors.' + error.code) + (error.field ? ': ' + t('bulkImport.columns.' + error.field, error.field) : '')).join('; ')]);
    return rows.map(row => row.map(cell).join(',')).join('\n');
}
