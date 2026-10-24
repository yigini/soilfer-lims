'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Bootstrap utilities must hand a generated password to the local operator
// without putting it in Docker logs, CI output or application log collectors.
function prepareInitialAdminPassword(supplied, env = process.env) {
    const { readSignInPolicy, assertNewPassword } = require('../services/signInPolicy');
    const policy = readSignInPolicy();
    if (supplied) {
        assertNewPassword(supplied, policy);
        return { password: supplied, handoffFile: null };
    }
    const database = env.DATABASE_PATH ? path.resolve(env.DATABASE_PATH) : path.resolve(__dirname, '../prisma/dev.db');
    const directory = path.join(path.dirname(database), '.initial-admin-credentials');
    try { fs.mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw new Error('Could not prepare the private administrator password directory.'); }
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() ||
        (typeof process.getuid === 'function' && stat.uid !== process.getuid()) ||
        (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
        throw new Error('Administrator password directory must be a real owner-only directory.');
    }
    const password = crypto.randomBytes(Math.max(24, Math.ceil(policy.minPasswordLength * 3 / 4))).toString('base64url');
    const handoffFile = path.join(directory, crypto.randomUUID() + '.txt');
    // Exclusive creation refuses an existing file or symlink; no old handoff is overwritten.
    try { fs.writeFileSync(handoffFile, password + '\n', { flag: 'wx', mode: 0o600 }); }
    catch { throw new Error('Could not save the initial administrator password privately.'); }
    return { password, handoffFile };
}

function reportInitialAdminPassword(handoffFile) {
    if (handoffFile) console.log('Initial administrator password saved in owner-only file:', handoffFile);
    else console.log('Initial administrator password supplied externally; it is not logged.');
    console.log('Change it at first sign-in, then remove the local handoff file.');
}

module.exports = { prepareInitialAdminPassword, reportInitialAdminPassword };
