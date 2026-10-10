const { readBoundedXlsxArchive, LIMITS } = require('../../services/instrumentXlsxArchive');
const { xlsxZip } = require('../helpers/instrumentXlsxBytes');
const parts = [['xl/workbook.xml', '<workbook>retained Unicode é 0001.2300</workbook>'], ['xl/worksheets/sheet1.xml', '<worksheet/>']];
test.each([{ deflate: false }, { deflate: true }, { deflate: true, descriptor: true }])('stored/deflated/described archive bytes are decoded exactly in memory: %j', options => {
    const bytes = xlsxZip(parts, options), before = Buffer.from(bytes), result = readBoundedXlsxArchive(bytes);
    expect([...result].map(([name, value]) => [name, value.toString()])).toEqual(parts); expect(bytes).toEqual(before);
});
test.each(['xl/vbaProject.bin', 'xl/externalLinks/externalLink1.xml', '../outside.xml', '/absolute.xml', 'xl\\workbook.xml'])('unsafe or macro/external part %s refuses the archive', name => {
    const bytes = xlsxZip([[name, '<unchanged/>']]);
    expect(() => readBoundedXlsxArchive(bytes)).toThrow(expect.objectContaining({ statusCode: 400, code: 'IMPORT_XLSX_INVALID' }));
});
test.each([
    bytes => bytes.subarray(0, bytes.length - 1),
    bytes => { bytes[0] = 0; return bytes; },
    bytes => { bytes.writeUInt32LE(0, 14); return bytes; },
    bytes => { bytes.writeUInt16LE(1, 6); return bytes; },
    bytes => Buffer.concat([bytes, Buffer.from('trailing data')])
])('malformed headers/checksums/encryption/truncation refuse without changing supplied bytes', change => {
    const bytes = change(xlsxZip(parts)), before = Buffer.from(bytes);
    expect(() => readBoundedXlsxArchive(bytes)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_INVALID' }));
    expect(bytes).toEqual(before);
});
test('duplicate member names are refused rather than choosing one content', () => {
    expect(() => readBoundedXlsxArchive(xlsxZip([parts[0], parts[0]]))).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_INVALID' }));
});
test('compressed, total declared and entry-count limits each refuse before decoding', () => {
    const tooMany = xlsxZip(parts); tooMany.writeUInt16LE(LIMITS.entries + 1, tooMany.length - 22 + 8); tooMany.writeUInt16LE(LIMITS.entries + 1, tooMany.length - 22 + 10);
    for (const bytes of [Buffer.alloc(LIMITS.compressedBytes + 1), xlsxZip([parts[0]], { declaredSize: LIMITS.uncompressedBytes + 1 }), tooMany])
        expect(() => readBoundedXlsxArchive(bytes)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_TOO_LARGE' }));
});
test('a forged small size cannot bypass the real bounded inflater', () => {
    const bytes = xlsxZip([['xl/worksheets/sheet1.xml', Buffer.alloc(LIMITS.uncompressedBytes + 1, 65)]], { deflate: true, declaredSize: 1 });
    expect(bytes.length).toBeLessThan(LIMITS.compressedBytes);
    expect(() => readBoundedXlsxArchive(bytes)).toThrow(expect.objectContaining({ code: 'IMPORT_XLSX_TOO_LARGE' }));
});
