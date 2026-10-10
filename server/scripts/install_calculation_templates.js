#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const Database = require('better-sqlite3');
const { loadCalculationTemplateMigrationSource } = require('../services/calculationTemplateMigrationSource');
const { classifyCalculationSchema, MARKER } = require('../services/calculationTemplateSchemaService');
const { classifyCalculationUnit } = require('../services/calculationReferenceUnit');
const { classifyCalculationReferences, installCalculationReferences } = require('../services/calculationReferenceInstall');
const fail = (code, message, differences = []) => Object.assign(new Error(message), { statusCode: 409, code, differences });

function integrity(db) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
        throw fail('CALC_INTEGRITY_REFUSED', 'Calculation installation requires an intact database.');
    }
}
function plan(db, source) {
    const schema = classifyCalculationSchema(db, source), unit = classifyCalculationUnit(db);
    integrity(db);
    const references = classifyCalculationReferences(db);
    return { ...schema, unit, references, ready: schema.classification === 'COMPLETE' && references.classification === 'COMPLETE', plannedUnitInsertCount: 0,
        plannedReferenceInsertCount: references.missingReferenceIds.length, activationInsertCount: 0 };
}
function installCalculationTemplates({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('CALC_DATABASE_REQUIRED', 'Provide an explicit database path.');
    const source = loadCalculationTemplateMigrationSource(), target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let planned; try { planned = reader.transaction(() => plan(reader, source))(); } finally { reader.close(); }
    if (!apply || planned.ready) return { ...planned, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0, unitInsertCount: 0, referenceInsertCount: 0, referenceReceiptInsertCount: 0, schemaReceiptInsertCount: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = plan(db, source);
            if (locked.ready) return { ...locked, mode: 'NO_OP', totalChanges: 0, unitInsertCount: 0, referenceInsertCount: 0, referenceReceiptInsertCount: 0, schemaReceiptInsertCount: 0 };
            if (locked.classification !== planned.classification) throw fail('CALC_PLAN_STALE', 'The calculation schema changed after the read-only plan.');
            const releaseSource = loadCalculationTemplateMigrationSource();
            if (locked.classification === 'PRE_199') db.exec(releaseSource.schemaSql);
            // The same additive guard set protects fresh and managed tables.
            // No existing analytical table is rebuilt or rewritten.
            if (locked.classification !== 'COMPLETE') db.exec(releaseSource.guardsSql);
            const references = installCalculationReferences(db, { apply: true });
            if (locked.classification !== 'COMPLETE') db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify(locked.receipt));
            const complete = plan(db, source); integrity(db);
            if (!complete.ready) throw fail('CALC_INTEGRITY_REFUSED', 'Calculation installation did not complete.');
            return { ...complete, previousClassification: locked.classification, mode: 'APPLIED',
                unitInsertCount: 0, referenceInsertCount: references.referenceInsertCount,
                referenceReceiptInsertCount: references.referenceReceiptInsertCount,
                schemaReceiptInsertCount: locked.classification === 'COMPLETE' ? 0 : 1,
                totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertCalculationStartupReady(dbPath) {
    if (!fs.existsSync(dbPath)) throw fail('CALC_DATABASE_REQUIRED', 'The lab database does not exist.');
    const outcome = installCalculationTemplates({ dbPath });
    if (!outcome.ready) throw fail('CALC_NOT_INSTALLED', 'Run the reviewed calculation installer before starting the lab.');
    return outcome;
}
function parseArguments(args) {
    const options = { dbPath: undefined, apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('CALC_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('CALC_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath?.trim() || seen.has('--apply') && seen.has('--dry-run')) throw fail('CALC_ARGUMENT_INVALID', 'Provide an explicit database and one mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installCalculationTemplates(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'CALC_INSTALL_REFUSED', message: error.message,
        differences: error.differences || [], totalChanges: 0 })}\n`); process.exitCode = 1; }
}
module.exports = { installCalculationTemplates, assertCalculationStartupReady, parseArguments };
