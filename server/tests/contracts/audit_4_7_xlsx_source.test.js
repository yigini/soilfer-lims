const { createHash } = require('node:crypto');
const { xlsxWorkbook, xlsxZip } = require('../helpers/instrumentXlsxBytes');
const { decodeInstrumentXlsxSource, assertXlsxMappedCell, XML_LIMITS } = require('../../services/instrumentXlsxSource');
const dot = { decimal: '.', thousands: ',' }, comma = { decimal: ',', thousands: '.' };
const workbook = (cells, options = {}) => xlsxWorkbook({ ...options, sheets: [{ name: 'Raw', xml: `<sheetData><row r="1">${cells}</row></sheetData>${options.merge || ''}` }] });
const source = (cells, options) => decodeInstrumentXlsxSource(workbook(cells, options)).rows[0];
const styles = code => '<numFmts><numFmt numFmtId="164" formatCode="' + code + '"/></numFmts><cellXfs><xf numFmtId="164"/></cellXfs>';

test('numeric and rounding-formatted lexemes, rich Unicode strings and source bytes are exact', () => {
    const bytes = workbook('<c r="A1"><v>0.30000000000000004</v></c><c r="B1" t="n"><v>1E-3</v></c>' +
        '<c r="C1" s="1"><v>0012.3400</v></c><c r="D1" t="s"><v>0</v></c><c r="E1" t="inlineStr"><is><r><t> é </t></r><r><t>土</t></r></is></c>', {
        sharedStrings: '<si><r><t> α </t></r><r><t>β</t></r><rPh sb="0" eb="1"><t>not-cell-text</t></rPh></si>',
        styles: '<cellXfs><xf numFmtId="0"/><xf numFmtId="2"/></cellXfs>'
    }), before = Buffer.from(bytes), decoded = decodeInstrumentXlsxSource(bytes), row = decoded.rows[0];
    expect(bytes.equals(before)).toBe(true); expect(decoded.sourceSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(row.cells).toEqual({ 0: '0.30000000000000004', 1: '1E-3', 2: '0012.3400', 3: ' α β', 4: ' é 土' });
    expect(row.cellEvidence[2]).toMatchObject({ sheetName: 'Raw', cellRef: 'C1', t: null, numFmtId: 2, formatCode: '0.00', rawLexeme: '0012.3400' });
    for (const column of [0, 1, 2]) expect(() => assertXlsxMappedCell(row, column, dot, { value: true })).not.toThrow();
});

test.each([
    ['<c r="A1"><f>1+1</f><v>2</v></c>', 'IMPORT_XLSX_FORMULA_UNSUPPORTED'],
    ['<c r="A1" t="str"><v>cached</v></c>', 'IMPORT_XLSX_FORMULA_UNSUPPORTED'],
    ['<c r="A1" t="e"><v>#DIV/0!</v></c>', 'IMPORT_XLSX_CELL_ERROR'],
    ['<c r="A1" t="b"><v>1</v></c>', 'IMPORT_XLSX_CELL_TYPE_UNSUPPORTED'],
    ['<c r="A1" t="d"><v>2026-10-10</v></c>', 'IMPORT_XLSX_CELL_TYPE_UNSUPPORTED'],
    ['<c r="A1"><v>1,234</v></c>', 'IMPORT_XLSX_INVALID'],
    ['<c r="A1"><v>1E99999</v></c>', 'IMPORT_XLSX_INVALID']
])('%s keeps raw evidence and refuses a mapped value with %s', (xml, code) => {
    const row = source(xml); expect(() => assertXlsxMappedCell(row, 0, dot, { value: true })).toThrow(expect.objectContaining({ code }));
});

test.each(['0%', '#,##0,', '#,##0,,', 'yyyy-mm-dd', '[h]:mm:ss', '0.00;0.00%'])('display format %s refuses without rendering', code => {
    const row = source('<c r="A1"><v>0.250000</v></c>', { styles: styles(code) });
    expect(row.cells[0]).toBe('0.250000');
    expect(() => assertXlsxMappedCell(row, 0, dot)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_DISPLAY_SCALED' }));
});
test.each([9, 14, 27, 36, 45, 46, 50, 58])('implied format ID %s refuses numeric interpretation', id => {
    const row = source('<c r="A1"><v>45200</v></c>', { styles: '<cellXfs><xf numFmtId="' + id + '"/></cellXfs>' });
    expect(() => assertXlsxMappedCell(row, 0, dot)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_DISPLAY_SCALED' }));
});
test.each(['0.00', '#,##0.00', '0.00E+00', '0.00&quot;kg&quot;', '0.00\\%'])('plain/literal format %s retains the stored value', code => {
    const row = source('<c r="A1"><v>1.2500</v></c>', { styles: styles(code) });
    expect(row.cells[0]).toBe('1.2500'); expect(() => assertXlsxMappedCell(row, 0, dot)).not.toThrow();
});

test('numeric lab text has a verified round trip while shared strings retain existing lab parsing', () => {
    const row = source('<c r="A1"><v>1.234</v></c><c r="B1" t="s"><v>0</v></c>', { sharedStrings: '<si><t>1.234</t></si>' });
    expect(assertXlsxMappedCell(row, 0, comma)).toBe('1,234');
    for (const decimal of ['.', ',']) expect(() => assertXlsxMappedCell(row, 0, { decimal, thousands: null })).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_NUMBER_POLICY_CONFLICT', statusCode: 409,
        details: expect.objectContaining({ cellRef: 'A1', lexeme: '1.234', invariantCanonical: '1.234', laboratory: expect.objectContaining({ code: 'AMBIGUOUS_NUMBER' }) }) }));
    expect(assertXlsxMappedCell(row, 0, dot)).toBe('1.234'); expect(assertXlsxMappedCell(row, 1, comma)).toBe('1.234');
    expect(row.cells).toEqual({ 0: '1.234', 1: '1.234' });
});
test.each(['1.5', '12', '1E-3', '-1.5E-3', '1234.5'])('comma-decimal lab syntax preserves every digit/exponent of OOXML numeric %s', lexeme => {
    const row = source(`<c r="A1"><v>${lexeme}</v></c>`);
    expect(assertXlsxMappedCell(row, 0, comma)).toBe(lexeme.replace('.', ',')); expect(row.cells[0]).toBe(lexeme);
});

test('multiple/hidden sheets need an exact name; explicit selection decodes that sheet', () => {
    const bytes = xlsxWorkbook({ sheets: [{ name: 'First', xml: '<sheetData/>' }, { name: 'Exact raw é', state: 'veryHidden', xml: '<sheetData><row r="1"><c r="A1"><v>1E-3</v></c></row></sheetData>' }] });
    expect(() => decodeInstrumentXlsxSource(bytes)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_SHEET_REQUIRED' }));
    expect(() => decodeInstrumentXlsxSource(bytes, 'missing')).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_SHEET_NOT_FOUND' }));
    expect(decodeInstrumentXlsxSource(bytes, 'Exact raw é')).toMatchObject({ sheetName: 'Exact raw é', rows: [{ cells: { 0: '1E-3' } }] });
    const hidden = xlsxWorkbook({ sheets: [{ name: 'Hidden', state: 'hidden', xml: '<sheetData/>' }] });
    expect(() => decodeInstrumentXlsxSource(hidden)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_SHEET_REQUIRED' }));
});
test('merged cells are empty except the top-left and sparse coordinates do not allocate dense rows', () => {
    const bytes = xlsxWorkbook({ sheets: [{ name: 'Raw', xml: '<sheetData><row r="1"><c r="A1"><v>12</v></c><c r="B1"><v>999</v></c><c r="XFD1"><v>2</v></c></row><row r="2"><c r="A2"><v>888</v></c></row></sheetData><mergeCells><mergeCell ref="A1:B2"/></mergeCells>' }] });
    const decoded = decodeInstrumentXlsxSource(bytes);
    expect(decoded.rows[0].cells).toEqual({ 0: '12', 1: '', 16383: '2' }); expect(decoded.rows[1].cells).toEqual({ 0: '' });
    expect(decoded.rows[0].cellEvidence[1]).toMatchObject({ rawLexeme: '999', mergedEmpty: true });
});
test.each([
    '<c r="A2"><v>1</v></c>', '<c r="XFE1"><v>1</v></c>', '<c r="A1" t="s"><v>0</v></c>',
    '<c r="A1" s="99"><v>1</v></c>', '<c r="A1"><v>1</v><v>2</v></c>', '<c r="A1"><v>&unknown;</v></c>',
    '<c r="A1"><v>1</v></c><c r="A1"><v>2</v></c>'
])('invalid coordinates/styles/strings/XML refuse: %s', xml => {
    expect(() => decodeInstrumentXlsxSource(workbook(xml))).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_INVALID' }));
});
test('unused malformed XML, DTD and external relationship content also refuse', () => {
    for (const extraParts of [
        [['unused.xml', '<broken>']],
        [['unused.xml', '<!DOCTYPE x [<!ENTITY a "boom">]><x>&a;</x>']],
        [['other/_rels/unused.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="e" Type="anything" Target="https://example.test" TargetMode="External"/></Relationships>']]
    ]) expect(() => decodeInstrumentXlsxSource(xlsxWorkbook({ extraParts }))).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_INVALID' }));
    expect(() => decodeInstrumentXlsxSource(xlsxZip([['not-xlsx.xml', '<x/>']]))).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_INVALID' }));
});
test('XML node/depth and merge resource limits refuse before constructing import commands', () => {
    for (const extraParts of [
        [['unused.xml', '<x>'.repeat(XML_LIMITS.depth + 1) + '</x>'.repeat(XML_LIMITS.depth + 1)]],
        [['unused.xml', '<x>' + '<y/>'.repeat(XML_LIMITS.nodes) + '</x>']]
    ]) expect(() => decodeInstrumentXlsxSource(xlsxWorkbook({ extraParts }))).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_TOO_LARGE' }));
    const bytes = workbook('', { merge: '<mergeCells>' + '<mergeCell ref="A1:B1"/>'.repeat(XML_LIMITS.merges + 1) + '</mergeCells>' });
    expect(() => decodeInstrumentXlsxSource(bytes)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_TOO_LARGE' }));
});
