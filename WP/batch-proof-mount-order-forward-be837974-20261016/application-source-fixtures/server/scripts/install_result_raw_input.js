#!/usr/bin/env node
const path = require('node:path');
const Database = require('better-sqlite3');
const { loadResultRawInputMigrationSource } = require('../services/resultRawInputMigrationSource');
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });

function classify(db) {
    const table = db.prepare("SELECT type FROM sqlite_master WHERE name='Result'").get();
    const columns = db.prepare('PRAGMA table_xinfo("Result")').all();
    if (table?.type !== 'table' || !columns.some(column => column.name === 'id')) {
        throw fail('RESULT_RAW_INPUT_SCHEMA_MISMATCH', 'An existing Result table is required.', ['Result table or id absent']);
    }
    const column = columns.find(row => row.name === 'rawInput');
    if (column && (column.type !== 'TEXT' || column.notnull !== 0 || column.dflt_value !== null || column.pk !== 0 || column.hidden !== 0)) {
        throw fail('RESULT_RAW_INPUT_SCHEMA_MISMATCH', 'Result.rawInput must be nullable TEXT without a default.', ['Result.rawInput shape differs']);
    }
    return { classification: column ? 'ALREADY_PRESENT' : 'ABSENT',
        counts: { results: db.prepare('SELECT COUNT(*) n FROM "Result"').get().n,
            recordedRawInputs: column ? db.prepare('SELECT COUNT(*) n FROM "Result" WHERE rawInput IS NOT NULL').get().n : 0 },
        backfillCount: 0 };
}

function installResultRawInput({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('RESULT_RAW_INPUT_DATABASE_REQUIRED', 'An explicit database path is required.');
    const source = loadResultRawInputMigrationSource(), target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan;
    try { plan = reader.transaction(() => classify(reader))(); }
    finally { reader.close(); }
    const sources = { migrationSha256: source.sha256 };
    if (!apply || plan.classification === 'ALREADY_PRESENT') return { ...plan, sources, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = classify(db);
            if (locked.classification === 'ALREADY_PRESENT') return { ...locked, sources, mode: 'NO_OP', totalChanges: 0 };
            db.exec(source.sql);
            const complete = classify(db);
            if (complete.classification !== 'ALREADY_PRESENT' || complete.counts.results !== locked.counts.results || complete.counts.recordedRawInputs !== 0 ||
                db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('RESULT_RAW_INPUT_INTEGRITY_REFUSED', 'Result raw input installation failed preservation or integrity checks.');
            }
            // This additive DDL inserts no receipt and rewrites no row.
            return { ...complete, sources, previousClassification: locked.classification, mode: 'APPLIED', totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function parseArguments(args) {
    const options = { dbPath: undefined, apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (seen.has(arg)) throw fail('RESULT_RAW_INPUT_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('RESULT_RAW_INPUT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath?.trim() || seen.has('--apply') && seen.has('--dry-run')) throw fail('RESULT_RAW_INPUT_ARGUMENT_INVALID', 'An explicit database and one mode are required.');
    return options;
}

if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installResultRawInput(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'RESULT_RAW_INPUT_INSTALL_REFUSED', message: error.message, differences: error.differences || [] })}\n`); process.exitCode = 1; }
}

module.exports = { installResultRawInput, parseArguments };
