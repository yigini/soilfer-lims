const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');
const path = require('node:path').posix;
const { SaxesParser } = require('saxes');
const { readBoundedXlsxArchive } = require('./instrumentXlsxArchive');
const { parseNumber } = require('../../shared/numberParse');
const XML_LIMITS = Object.freeze({ nodes: 250000, depth: 64, merges: 4096 });
const SPREADSHEET = new Set(['http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'http://purl.oclc.org/ooxml/spreadsheetml/main']);
const RELATIONSHIPS = new Set(['http://schemas.openxmlformats.org/package/2006/relationships', 'http://purl.oclc.org/ooxml/package/relationships']);
const DOCUMENT_RELATIONSHIPS = new Set(['http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://purl.oclc.org/ooxml/officeDocument/relationships']);
const CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
const error = (code, statusCode = 400, details) => Object.assign(new Error('Review the XLSX source cell or worksheet.'), { code, statusCode, ...(details && { details }) });
const invalid = () => { throw error('IMPORT_XLSX_INVALID'); };
const tooLarge = () => { throw error('IMPORT_XLSX_TOO_LARGE'); };
const child = (node, name) => node.children.filter(item => item.local === name && item.uri === node.uri);
const one = (node, name, required = false) => {
    const found = child(node, name); if (found.length > 1 || required && found.length !== 1) invalid(); return found[0] || null;
};
const attribute = (node, name, namespaces = null) => {
    const found = Object.values(node.attributes).filter(item => item.local === name && (namespaces ? namespaces.has(item.uri) : item.uri === ''));
    if (found.length > 1) invalid(); return found[0]?.value;
};
function integer(text, maximum = Number.MAX_SAFE_INTEGER) {
    if (typeof text !== 'string' || !/^\d+$/.test(text)) invalid();
    const value = Number(text); if (!Number.isSafeInteger(value) || value > maximum) invalid(); return value;
}
function xmlTree(bytes, budget) {
    let text;
    try {
        const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
        text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch { invalid(); }
    const stack = []; let root;
    const parser = new SaxesParser({ xmlns: true });
    parser.on('error', invalid); parser.on('doctype', invalid);
    parser.on('opentag', tag => {
        if (++budget.nodes > XML_LIMITS.nodes || stack.length >= XML_LIMITS.depth) tooLarge();
        const node = { local: tag.local, uri: tag.uri, attributes: tag.attributes, children: [], text: '' };
        if (stack.length) stack.at(-1).children.push(node); else { if (root) invalid(); root = node; }
        stack.push(node);
    });
    const appendText = value => { if (stack.length) stack.at(-1).text += value; };
    parser.on('text', appendText); parser.on('cdata', appendText); parser.on('closetag', () => stack.pop());
    try { parser.write(text).close(); } catch (failure) {
        if (failure.code === 'IMPORT_XLSX_TOO_LARGE') throw failure; invalid();
    }
    if (!root || stack.length) invalid(); return root;
}
function relationshipsName(part) { return part ? path.join(path.dirname(part), '_rels', path.basename(part) + '.rels') : '_rels/.rels'; }
function targetPart(source, target) {
    if (!target || /[\\\u0000?#%]/.test(target) || /^[A-Za-z][A-Za-z\d+.-]*:/.test(target)) invalid();
    // OPC absolute package paths and relative parent segments are resolved only
    // inside the uploaded Map. They can never address the disk or the network.
    const base = target.startsWith('/') ? [] : path.dirname(source || '.').split('/').filter(item => item !== '.');
    for (const part of target.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') { if (!base.length) invalid(); base.pop(); } else base.push(part);
    }
    if (!base.length) invalid(); return base.join('/');
}
function readRelationships(trees, source, required = false) {
    const tree = trees.get(relationshipsName(source));
    if (!tree) { if (required) invalid(); return new Map(); }
    if (tree.local !== 'Relationships' || !RELATIONSHIPS.has(tree.uri)) invalid();
    const found = new Map();
    for (const node of child(tree, 'Relationship')) {
        const id = attribute(node, 'Id'), type = attribute(node, 'Type'), mode = attribute(node, 'TargetMode');
        if (!id || !type || found.has(id) || mode && mode !== 'Internal' || /externalLink|vbaProject/i.test(type)) invalid();
        found.set(id, { type, part: targetPart(source, attribute(node, 'Target')) });
    }
    return found;
}
function relatedPart(relations, kind, required = false) {
    const candidates = [...relations.values()].filter(row => DOCUMENT_RELATIONSHIPS.has(row.type.slice(0, row.type.lastIndexOf('/'))) && row.type.endsWith('/' + kind));
    if (candidates.length > 1 || required && candidates.length !== 1) invalid(); return candidates[0]?.part || null;
}
function spreadsheetTree(trees, part, name) {
    const tree = trees.get(part); if (!tree || tree.local !== name || !SPREADSHEET.has(tree.uri)) invalid(); return tree;
}
// Implied format codes from ISO/IEC29500, as published by Microsoft's OpenXML
// NumberingFormat documentation. Locale-specific date IDs have no single code.
const BUILTIN_FORMATS = Object.freeze({ 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%',
    11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'mm-dd-yy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy',
    18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yy h:mm',
    37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)',
    45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@' });
function builtinDate(id) { return id >= 14 && id <= 22 || id >= 27 && id <= 36 || id >= 45 && id <= 47 || id >= 50 && id <= 58; }
function displayScaled(style) {
    if (builtinDate(style.numFmtId) || [9, 10].includes(style.numFmtId)) return true;
    if (/^General$/i.test(style.formatCode || '')) return false;
    let code = style.formatCode || '';
    // Quoted/escaped literals and padding don't scale a stored number. Bracket
    // elapsed-time tokens do; colours, conditions and locale prefixes don't.
    code = code.replace(/"(?:[^"]|"")*"|\\[\s\S]|[_*][\s\S]/g, '');
    if (/\[(?:h+|m+|s+)\]/i.test(code)) return true;
    code = code.replace(/\[[^\]]*\]/g, '');
    return /%|[ymdhs]|[0#?],+(?![0#?])/i.test(code);
}
function readStyles(trees, part) {
    if (!part) return [{ numFmtId: 0, formatCode: 'General' }];
    const root = spreadsheetTree(trees, part, 'styleSheet'), formats = new Map();
    for (const node of child(one(root, 'numFmts') || { children: [] }, 'numFmt')) {
        const id = integer(attribute(node, 'numFmtId')), code = attribute(node, 'formatCode');
        if (formats.has(id) || typeof code !== 'string' || !code) invalid(); formats.set(id, code);
    }
    const xfs = one(root, 'cellXfs', true), baseXfs = one(root, 'cellStyleXfs');
    const bases = baseXfs ? child(baseXfs, 'xf') : [];
    return child(xfs, 'xf').map(node => {
        const baseIndex = attribute(node, 'xfId'), base = baseIndex === undefined ? null : bases[integer(baseIndex)];
        if (baseIndex !== undefined && !base) invalid();
        const apply = attribute(node, 'applyNumberFormat'), own = attribute(node, 'numFmtId');
        if (apply !== undefined && !['0', '1', 'false', 'true'].includes(apply.trim())) invalid();
        const inherit = apply !== undefined && ['0', 'false'].includes(apply.trim()) && base;
        const id = integer(inherit ? attribute(base, 'numFmtId') || '0' : own ?? (base ? attribute(base, 'numFmtId') : null) ?? '0');
        const code = formats.get(id) ?? BUILTIN_FORMATS[id] ?? null;
        if (code === null && !builtinDate(id)) invalid(); return { numFmtId: id, formatCode: code };
    });
}
function richText(node) {
    // Phonetic annotations are not part of the cell value. Preserve actual
    // Unicode text/whitespace and ordered rich-text runs without formatting.
    let value = '';
    for (const item of node.children) if (item.uri === node.uri) {
        if (item.local === 't') { if (item.children.length) invalid(); value += item.text; }
        else if (item.local === 'r') for (const text of child(item, 't')) { if (text.children.length) invalid(); value += text.text; }
    }
    return value;
}
function reference(text) {
    const match = typeof text === 'string' && text.match(/^([A-Z]{1,3})([1-9]\d*)$/); if (!match) invalid();
    let column = 0; for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64;
    const row = integer(match[2], 1048576); if (column > 16384) invalid(); return { row, column: column - 1 };
}
function cellReference(row, column) {
    let letters = '', value = column + 1;
    while (value) { letters = String.fromCharCode(65 + (value - 1) % 26) + letters; value = Math.floor((value - 1) / 26); }
    return letters + row;
}
function mergeMask(root) {
    const merges = one(root, 'mergeCells'), nodes = merges ? child(merges, 'mergeCell') : [];
    if (nodes.length > XML_LIMITS.merges) tooLarge();
    const events = [];
    for (const node of nodes) {
        const parts = attribute(node, 'ref')?.split(':'); if (parts?.length !== 2) invalid();
        const first = reference(parts[0]), last = reference(parts[1]); if (first.row > last.row || first.column > last.column) invalid();
        const range = { first, last }; events.push({ row: first.row, range, add: true }, { row: last.row + 1, range, add: false });
    }
    events.sort((a, b) => a.row - b.row || Number(a.add) - Number(b.add));
    const active = []; let cursor = 0;
    function search(column) { let lo = 0, hi = active.length; while (lo < hi) { const mid = lo + hi >>> 1; if (active[mid].first.column <= column) lo = mid + 1; else hi = mid; } return lo; }
    function advance(row) {
        while (cursor < events.length && events[cursor].row <= row) {
            const event = events[cursor++], range = event.range;
            if (!event.add) { const index = active.indexOf(range); if (index < 0) invalid(); active.splice(index, 1); }
            else {
                const index = search(range.first.column);
                if (index && active[index - 1].last.column >= range.first.column || index < active.length && active[index].first.column <= range.last.column) invalid();
                active.splice(index, 0, range);
            }
        }
    }
    return { advance, covered(row, column) {
        const index = search(column) - 1, range = active[index];
        return !!range && column <= range.last.column && (row !== range.first.row || column !== range.first.column);
    }, finish() { advance(1048577); } };
}
function decodeInstrumentXlsxSource(bytes, sheetName) {
    const parts = readBoundedXlsxArchive(bytes), trees = new Map(), budget = { nodes: 0 };
    for (const [name, value] of parts) if (/\.(xml|rels)$/i.test(name)) trees.set(name, xmlTree(value, budget));
    const types = trees.get('[Content_Types].xml'); if (!types || types.local !== 'Types' || types.uri !== CONTENT_TYPES) invalid();
    for (const node of types.children) {
        const type = attribute(node, 'ContentType'); if (!type || /macroEnabled|vbaProject|externalLink/i.test(type)) invalid();
    }
    // Every relationship file is checked, including unused sheets/parts. A
    // selected sheet cannot conceal an external reference elsewhere in a file.
    for (const name of trees.keys()) if (name.endsWith('.rels')) {
        const match = name.match(/^(.*\/)?_rels\/([^/]+)\.rels$/);
        if (name === '_rels/.rels') readRelationships(trees, '', true);
        else { if (!match) invalid(); readRelationships(trees, (match[1] || '') + match[2], true); }
    }
    const workbookPart = relatedPart(readRelationships(trees, '', true), 'officeDocument', true);
    const workbook = spreadsheetTree(trees, workbookPart, 'workbook'), relations = readRelationships(trees, workbookPart, true);
    const sheets = child(one(workbook, 'sheets', true), 'sheet').map(node => ({ name: attribute(node, 'name'), state: attribute(node, 'state') || 'visible',
        relation: relations.get(attribute(node, 'id', DOCUMENT_RELATIONSHIPS)) }));
    if (!sheets.length || sheets.some(sheet => !sheet.name || !['visible', 'hidden', 'veryHidden'].includes(sheet.state) || !sheet.relation) || new Set(sheets.map(sheet => sheet.name)).size !== sheets.length) invalid();
    if (sheetName !== undefined && (typeof sheetName !== 'string' || !sheetName.trim())) invalid();
    if (sheetName === undefined && (sheets.length !== 1 || sheets.some(sheet => sheet.state !== 'visible')))
        throw error('IMPORT_XLSX_SHEET_REQUIRED', 400, { sheets: sheets.map(({ name, state }) => ({ name, state })) });
    const selected = sheetName === undefined ? sheets[0] : sheets.find(sheet => sheet.name === sheetName);
    if (!selected) throw error('IMPORT_XLSX_SHEET_NOT_FOUND');
    if (!DOCUMENT_RELATIONSHIPS.has(selected.relation.type.slice(0, selected.relation.type.lastIndexOf('/'))) || !selected.relation.type.endsWith('/worksheet')) invalid();
    const root = spreadsheetTree(trees, selected.relation.part, 'worksheet'), data = one(root, 'sheetData', true);
    const sharedPart = relatedPart(relations, 'sharedStrings'), shared = sharedPart ? child(spreadsheetTree(trees, sharedPart, 'sst'), 'si').map(richText) : [];
    const styles = readStyles(trees, relatedPart(relations, 'styles')), rows = []; let previousRow = 0;
    for (const row of child(data, 'row')) {
        const number = attribute(row, 'r') === undefined ? previousRow + 1 : integer(attribute(row, 'r'), 1048576);
        if (number <= previousRow) invalid(); previousRow = number;
        const decoded = { rowNumber: number, cells: {}, cellEvidence: {} }; let previousColumn = -1;
        for (const cell of child(row, 'c')) {
            const ref = attribute(cell, 'r') || cellReference(number, previousColumn + 1), location = reference(ref);
            if (location.row !== number || location.column <= previousColumn) invalid(); previousColumn = location.column;
            const type = attribute(cell, 't') ?? null, styleIndex = integer(attribute(cell, 's') || '0'), style = styles[styleIndex]; if (!style) invalid();
            const v = one(cell, 'v'), inline = one(cell, 'is'), formula = one(cell, 'f'); if (v?.children.length) invalid();
            let raw = v?.text || '', code = null;
            if (formula || type === 'str') code = 'IMPORT_XLSX_FORMULA_UNSUPPORTED';
            else if (type === 's') { const index = integer(raw); if (index >= shared.length) invalid(); raw = shared[index]; }
            else if (type === 'inlineStr') { if (!inline) invalid(); raw = richText(inline); }
            else if (type === 'e') code = 'IMPORT_XLSX_CELL_ERROR';
            else if (type !== null && !['n', 'b', 'd'].includes(type)) code = 'IMPORT_XLSX_CELL_TYPE_UNSUPPORTED';
            const evidence = { sheetName: selected.name, cellRef: ref, t: type, styleIndex, ...style, rawLexeme: raw,
                numeric: (type === null || type === 'n') && !!v, ...(code && { error: code }) };
            decoded.cells[location.column] = raw; decoded.cellEvidence[location.column] = evidence;
        }
        rows.push(decoded);
    }
    const mask = mergeMask(root);
    for (const row of rows) {
        mask.advance(row.rowNumber);
        for (const column of Object.keys(row.cells)) if (mask.covered(row.rowNumber, Number(column))) {
            row.cells[column] = ''; row.cellEvidence[column].mergedEmpty = true;
        }
    }
    mask.finish();
    return { sourceSha256: createHash('sha256').update(bytes).digest('hex'), sheetName: selected.name,
        sheets: sheets.map(({ name, state }) => ({ name, state })), rows };
}
function assertXlsxMappedCell(source, column, format, { value = false } = {}) {
    const cell = source.cellEvidence?.[column]; if (!cell || cell.mergedEmpty) return source.cells[column];
    const details = { cellRef: cell.cellRef, lexeme: cell.rawLexeme };
    if (cell.error) throw error(cell.error, 400, details);
    if (value && ['b', 'd'].includes(cell.t)) throw error('IMPORT_XLSX_CELL_TYPE_UNSUPPORTED', 400, details);
    if (!cell.numeric) return source.cells[column];
    if (displayScaled(cell)) throw error('IMPORT_XLSX_DISPLAY_SCALED', 400, details);
    if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cell.rawLexeme)) throw error('IMPORT_XLSX_INVALID', 400, details);
    // Pin6096497546: this comma can never group because the regex excluded it.
    // It prevents the existing parser's three-fraction ambiguity in the
    // invariant comparison only; the laboratory parser is unchanged.
    const invariant = parseNumber(cell.rawLexeme, { decimal: '.', thousands: ',' });
    if (!invariant.valid) throw error('IMPORT_XLSX_INVALID', 400, details);
    // Pin6096643904 supersedes raw numeric storage: change only the decimal
    // character, preserving every digit and the exponent. The original stays
    // in the source evidence; the existing typed writer consumes this lab text.
    const labText = format.decimal === ',' ? cell.rawLexeme.replace('.', ',') : cell.rawLexeme;
    const laboratory = parseNumber(labText, format);
    if (!laboratory.valid || laboratory.value !== invariant.value || laboratory.canonical !== invariant.canonical)
        throw error('IMPORT_XLSX_NUMBER_POLICY_CONFLICT', 409, { ...details, labText, invariantCanonical: invariant.canonical, laboratory });
    return labText;
}
module.exports = { decodeInstrumentXlsxSource, assertXlsxMappedCell, XML_LIMITS };
