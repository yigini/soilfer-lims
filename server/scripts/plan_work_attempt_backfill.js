#!/usr/bin/env node
const path = require('node:path');
const Database = require('better-sqlite3');
const { planHistoricalAttempts } = require('../services/workAttemptBackfillPlan');

function parseArguments(args) {
    if (args.length !== 3 || args[0] !== '--db' || !args[1] || args[1].startsWith('--') || args[2] !== '--dry-run') {
        throw Object.assign(new Error('Use --db <backup path> --dry-run. Apply is unavailable in this planning command.'),
            { code: 'WORK_ATTEMPT_PLAN_ARGUMENT_INVALID' });
    }
    return path.resolve(args[1]);
}
function readPlan(dbPath) {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try { return planHistoricalAttempts(db); }
    finally { db.close(); }
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(readPlan(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ code: error.code || 'WORK_ATTEMPT_PLAN_REFUSED', message: error.message }) + '\n'); process.exitCode = 1; }
}
module.exports = { readPlan, parseArguments };
