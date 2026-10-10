const { deflateRawSync, crc32 } = require('node:zlib');

// Synthetic ZIP bytes for the real decoder. No filesystem/database mutation.
function xlsxZip(parts, { deflate = false, descriptor = false, declaredSize = null } = {}) {
    const local = [], central = []; let offset = 0;
    for (const [name, input] of parts) {
        const raw = Buffer.isBuffer(input) ? input : Buffer.from(input), data = deflate ? deflateRawSync(raw) : raw,
            filename = Buffer.from(name), checksum = crc32(raw), flags = 0x0800 | (descriptor ? 8 : 0),
            method = deflate ? 8 : 0, uncompressed = declaredSize ?? raw.length;
        const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
        header.writeUInt16LE(flags, 6); header.writeUInt16LE(method, 8); header.writeUInt16LE(filename.length, 26);
        if (!descriptor) { header.writeUInt32LE(checksum, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(uncompressed, 22); }
        const tail = descriptor ? Buffer.alloc(16) : Buffer.alloc(0);
        if (descriptor) { tail.writeUInt32LE(0x08074b50); tail.writeUInt32LE(checksum, 4); tail.writeUInt32LE(data.length, 8); tail.writeUInt32LE(uncompressed, 12); }
        local.push(header, filename, data, tail);
        const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
        directory.writeUInt16LE(flags, 8); directory.writeUInt16LE(method, 10); directory.writeUInt32LE(checksum, 16);
        directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(uncompressed, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
        central.push(directory, filename); offset += header.length + filename.length + data.length + tail.length;
    }
    const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(parts.length, 8); end.writeUInt16LE(parts.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, directory, end]);
}
module.exports = { xlsxZip };
