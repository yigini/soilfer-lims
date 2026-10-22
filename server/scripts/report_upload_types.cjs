'use strict';

// File metadata/type report only. Deliberately imports no application, Prisma,
// database, scheduler or environment loader; never extracts or changes files.
const fs = require('node:fs');
const path = require('node:path');
const { contained, fileType } = require('../utils/uploadFiles');

function scanUploadTypes(selectedRoot) {
    const root = path.resolve(selectedRoot), rows = [], directories = [];
    let realRoot;
    try {
        const stat = fs.lstatSync(root);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw Object.assign(new Error(), { code: 'ROOT_REFUSED' });
        realRoot = fs.realpathSync(root);
    } catch (error) {
        return { root, readOnly: true, directories, files: rows, errors: [{ path: '.', code: error.code || 'READ_FAILED' }] };
    }
    const errors = [];
    const relative = full => path.relative(root, full).split(path.sep).join('/');
    function visit(directory) {
        for (const name of fs.readdirSync(directory)) {
            const full = path.join(directory, name);
            try {
                const stat = fs.lstatSync(full);
                if (stat.isSymbolicLink() || !contained(realRoot, fs.realpathSync(full))) {
                    rows.push({ path: relative(full), state: 'symlink-or-outside-refused' });
                } else if (stat.isDirectory()) visit(full);
                else if (stat.isFile()) {
                    const type = fileType({ full, stat });
                    rows.push({ path: relative(full), bytes: stat.size,
                        state: type ? 'raster-image' : 'non-image', contentType: type?.contentType || null,
                        category: relative(full).startsWith('intake/') ? 'intake' : 'instrument-source-or-staging' });
                } else rows.push({ path: relative(full), state: 'non-regular-refused' });
            } catch (error) { errors.push({ path: relative(full), code: error.code || 'READ_FAILED' }); }
        }
    }
    for (const name of ['intake', 'spectra', 'staging']) {
        const full = path.join(root, name);
        try {
            const stat = fs.lstatSync(full);
            if (stat.isSymbolicLink() || !stat.isDirectory() || !contained(realRoot, fs.realpathSync(full))) {
                directories.push({ path: name, state: 'refused' });
                continue;
            }
            directories.push({ path: name, state: 'scanned' });
            visit(full);
        } catch (error) {
            if (error.code === 'ENOENT') directories.push({ path: name, state: 'absent' });
            else errors.push({ path: name, code: error.code || 'READ_FAILED' });
        }
    }
    return { root, readOnly: true, directories, files: rows, errors,
        nonImageCount: rows.filter(row => row.state === 'non-image').length };
}

if (require.main === module) {
    const report = scanUploadTypes(process.argv[2] || path.resolve(__dirname, '..', 'uploads'));
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.errors.length) process.exitCode = 1;
}
module.exports = { scanUploadTypes };
