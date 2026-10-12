const { inflateRawSync, crc32: nativeCrc32 } = require('node:zlib');
const { TextDecoder } = require('node:util');
const LIMITS = Object.freeze({ compressedBytes: 16 * 1024 * 1024, uncompressedBytes: 64 * 1024 * 1024, entries: 4096 });
const fail = code => Object.assign(new Error('The XLSX archive is invalid or exceeds the import resource limits.'), { statusCode: 400, code });
const invalid = () => { throw fail('IMPORT_XLSX_INVALID'); };
const tooLarge = () => { throw fail('IMPORT_XLSX_TOO_LARGE'); };
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
    let value = byte; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0;
});
function crc32(bytes) {
    if (nativeCrc32) return nativeCrc32(bytes);
    let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
    return (value ^ 0xffffffff) >>> 0;
}
function partName(bytes) {
    let name; try { name = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { invalid(); }
    if (!name || /[\\\u0000]/.test(name) || name.startsWith('/') || name.split('/').some((part, index, parts) =>
        part === '.' || part === '..' || !part && index !== parts.length - 1)) invalid();
    return name;
}

// Read ordinary stored/deflated ZIP members only, in memory. No member is
// extracted to disk. Declared and actual sizes, CRCs, duplicate/overlapping
// members, local/central headers and descriptors are all checked independently.
function readBoundedXlsxArchive(bytes) {
    if (!Buffer.isBuffer(bytes) || bytes.length < 22) invalid();
    if (bytes.length > LIMITS.compressedBytes) tooLarge();
    const inside = (offset, size) => Number.isSafeInteger(offset) && Number.isSafeInteger(size) && offset >= 0 && size >= 0 && offset + size <= bytes.length;
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 65535); offset--)
        if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break; }
    if (end < 0 || bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0) invalid();
    const count = bytes.readUInt16LE(end + 10), directorySize = bytes.readUInt32LE(end + 12), directoryStart = bytes.readUInt32LE(end + 16);
    if (count > LIMITS.entries) tooLarge();
    if (!count || count !== bytes.readUInt16LE(end + 8) || directorySize === 0xffffffff || directoryStart === 0xffffffff ||
        !inside(directoryStart, directorySize) || directoryStart + directorySize !== end) invalid();
    const members = [], names = new Set(); let cursor = directoryStart, declaredTotal = 0;
    for (let index = 0; index < count; index++) {
        if (!inside(cursor, 46) || cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) invalid();
        const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10), checksum = bytes.readUInt32LE(cursor + 16),
            compressed = bytes.readUInt32LE(cursor + 20), uncompressed = bytes.readUInt32LE(cursor + 24),
            nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30),
            commentLength = bytes.readUInt16LE(cursor + 32), localOffset = bytes.readUInt32LE(cursor + 42),
            size = 46 + nameLength + extraLength + commentLength;
        if (flags & ~0x080e || ![0, 8].includes(method) || bytes.readUInt16LE(cursor + 34) !== 0 ||
            localOffset === 0xffffffff || !inside(cursor, size) || cursor + size > end) invalid();
        declaredTotal += uncompressed; if (declaredTotal > LIMITS.uncompressedBytes) tooLarge();
        const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength), name = partName(rawName);
        if (names.has(name)) invalid(); names.add(name);
        if (/vbaproject\.bin|(?:^|\/)externallinks\//i.test(name)) invalid();
        members.push({ name, rawName, flags, method, checksum, compressed, uncompressed, localOffset }); cursor += size;
    }
    if (cursor !== end) invalid();
    const parts = new Map(), ranges = []; let actualTotal = 0;
    for (const member of members) {
        const offset = member.localOffset;
        if (!inside(offset, 30) || offset + 30 > directoryStart || bytes.readUInt32LE(offset) !== 0x04034b50 ||
            bytes.readUInt16LE(offset + 6) !== member.flags || bytes.readUInt16LE(offset + 8) !== member.method) invalid();
        const nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28), start = offset + 30 + nameLength + extraLength;
        if (!inside(offset, 30 + nameLength + extraLength) || !inside(start, member.compressed) || start + member.compressed > directoryStart ||
            !bytes.subarray(offset + 30, offset + 30 + nameLength).equals(member.rawName)) invalid();
        const localValues = [bytes.readUInt32LE(offset + 14), bytes.readUInt32LE(offset + 18), bytes.readUInt32LE(offset + 22)],
            expected = [member.checksum, member.compressed, member.uncompressed];
        if (localValues.some((value, index) => value !== expected[index] && (!(member.flags & 8) || value !== 0))) invalid();
        let finish = start + member.compressed;
        if (member.flags & 8) {
            if (!inside(finish, 12)) invalid();
            const descriptor = bytes.readUInt32LE(finish) === 0x08074b50 ? finish + 4 : finish;
            if (!inside(descriptor, 12) || expected.some((value, index) => bytes.readUInt32LE(descriptor + index * 4) !== value)) invalid();
            finish = descriptor + 12;
        }
        if (finish > directoryStart) invalid(); ranges.push([offset, finish]);
        let decoded;
        if (member.method === 0) decoded = bytes.subarray(start, start + member.compressed);
        else {
            try {
                const result = inflateRawSync(bytes.subarray(start, start + member.compressed), { maxOutputLength: LIMITS.uncompressedBytes - actualTotal || 1, info: true });
                if (result.engine.bytesWritten !== member.compressed) invalid(); decoded = result.buffer;
            } catch (error) {
                if (error.code === 'ERR_BUFFER_TOO_LARGE') tooLarge();
                if (error.code === 'IMPORT_XLSX_TOO_LARGE') throw error; invalid();
            }
        }
        actualTotal += decoded.length; if (actualTotal > LIMITS.uncompressedBytes) tooLarge();
        if (decoded.length !== member.uncompressed || crc32(decoded) !== member.checksum) invalid();
        parts.set(member.name, decoded);
    }
    ranges.sort((a, b) => a[0] - b[0]); for (let index = 1; index < ranges.length; index++) if (ranges[index][0] < ranges[index - 1][1]) invalid();
    return parts;
}
module.exports = { readBoundedXlsxArchive, LIMITS };
