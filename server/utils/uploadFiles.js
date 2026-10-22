'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TYPES = {
    jpeg: { contentType: 'image/jpeg', extension: '.jpg' },
    png: { contentType: 'image/png', extension: '.png' },
    webp: { contentType: 'image/webp', extension: '.webp' }
};

function imageType(bytes, size = bytes.length) {
    if (size >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return TYPES.jpeg;
    if (size >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.subarray(12, 16).toString('ascii') === 'IHDR') return TYPES.png;
    if (size >= 20 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
        bytes.subarray(8, 12).toString('ascii') === 'WEBP' &&
        ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.subarray(12, 16).toString('ascii')) &&
        bytes.readUInt32LE(4) + 8 === size) return TYPES.webp;
    return null;
}

function canonicalIntakePath(value) {
    if (typeof value !== 'string' || value.length > 270 || !value.startsWith('/uploads/intake/')) return null;
    const filename = value.slice('/uploads/intake/'.length);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/.test(filename)) return null;
    return '/uploads/intake/' + filename;
}

function uploadsRoot() {
    const selected = process.env.LIMS_OWNED_UPLOAD_ROOT;
    if (!selected) return path.resolve(__dirname, '..', 'uploads');
    const root = path.resolve(selected);
    const parent = path.resolve(__dirname, '..', 'tests', '.tmp');
    if (process.env.NODE_ENV !== 'test' || path.dirname(root) !== parent ||
        !/^uploads_[a-f0-9-]+$/.test(path.basename(root)) || !fs.existsSync(root) ||
        fs.realpathSync(root) !== root) throw new Error('Owned upload root selection refused.');
    return root;
}

function contained(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

function regularFile(root, filename) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/.test(filename) || !fs.existsSync(root)) return null;
    const rootStat = fs.lstatSync(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return null;
    const full = path.resolve(root, filename);
    if (!contained(root, full)) return null;
    let stat;
    try { stat = fs.lstatSync(full); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    if (!contained(fs.realpathSync(root), fs.realpathSync(full))) return null;
    return { root, filename, full, stat };
}

function fileType(file) {
    const fd = fs.openSync(file.full, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const current = fs.fstatSync(fd);
        if (!current.isFile() || current.dev !== file.stat.dev || current.ino !== file.stat.ino ||
            current.size !== file.stat.size) return null;
        const header = Buffer.alloc(32);
        const count = fs.readSync(fd, header, 0, header.length, 0);
        return imageType(header.subarray(0, count), current.size);
    } finally { fs.closeSync(fd); }
}

module.exports = { MAX_IMAGE_BYTES, imageType, canonicalIntakePath, uploadsRoot, contained, regularFile, fileType };
