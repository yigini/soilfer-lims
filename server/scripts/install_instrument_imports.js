#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), Database = require('better-sqlite3');
const { isDeepStrictEqual } = require('node:util');
const { loadInstrumentImportMigrationSource } = require('../services/instrumentImportMigrationSource');
const { classifyInstrumentImportSchema, MARKER, fingerprint } = require('../services/instrumentImportSchemaService');
const fail = (code, message) => Object.assign(new Error(message), { statusCode: 409, code, totalChanges: 0 });
const quoted = name => '"' + name.replaceAll('"', '""') + '"';
function integrity(db) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length)
        throw fail('IMPORT_INTEGRITY_REFUSED', 'Instrument import installation requires an intact database.');
}
function preserve(db) {
    const objects = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND tbl_name NOT IN ('ImportTemplate','InstrumentImportReceipt') ORDER BY type,name").all();
    const tables = objects.filter(row => row.type === 'table').map(row => ({ name: row.name, columns: db.prepare('PRAGMA table_xinfo(' + quoted(row.name) + ')').all(), foreign: db.prepare('PRAGMA foreign_key_list(' + quoted(row.name) + ')').all() }));
    return { objects, tables, rows: readPreservedRows(db, tables) };
}
function readPreservedRows(db, tables) {
    return Object.fromEntries(tables.map(row => {
        const sql = 'SELECT ' + row.columns.map(column => quoted(column.name)).join(',') + ' FROM ' + quoted(row.name);
        const rows = row.name === '_schema_migrations' ? db.prepare(sql + ' WHERE id<>? ORDER BY rowid').all(MARKER) : db.prepare(sql + ' ORDER BY rowid').all();
        return [row.name, rows];
    }));
}
function assertPreserved(db, original) {
    if (!isDeepStrictEqual(readPreservedRows(db, original.tables), original.rows)) throw fail('IMPORT_PRESERVATION_REFUSED', 'An original row changed during import installation.');
    for (const object of original.objects) {
        if (object.type === 'table' && object.name === 'WorkItemDraft') continue;
        const actual = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name=?').get(object.name);
        if (!isDeepStrictEqual(actual, object)) throw fail('IMPORT_PRESERVATION_REFUSED', 'An original schema object changed during import installation.');
    }
    const foreignFields = rows => rows.map(({ id, ...row }) => row).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    for (const table of original.tables) {
        const columns = db.prepare('PRAGMA table_xinfo(' + quoted(table.name) + ')').all(), foreign = db.prepare('PRAGMA foreign_key_list(' + quoted(table.name) + ')').all();
        if (table.name === 'WorkItemDraft') {
            const oldNames = new Set(table.columns.map(row => row.name));
            if (!isDeepStrictEqual(columns.filter(row => oldNames.has(row.name)), table.columns) ||
                !isDeepStrictEqual(foreignFields(foreign.filter(row => row.from !== 'importReceiptId')), foreignFields(table.foreign.filter(row => row.from !== 'importReceiptId'))))
                throw fail('IMPORT_PRESERVATION_REFUSED', 'The original draft columns or foreign keys changed.');
        } else if (!isDeepStrictEqual(columns, table.columns) || !isDeepStrictEqual(foreign, table.foreign)) throw fail('IMPORT_PRESERVATION_REFUSED', 'An original table shape changed.');
    }
}
function installInstrumentImports({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim() || !fs.existsSync(path.resolve(dbPath))) throw fail('IMPORT_DATABASE_REQUIRED', 'Provide an explicit existing lab database.');
    const target = path.resolve(dbPath), source = loadInstrumentImportMigrationSource();
    require('./install_calculation_templates').assertCalculationStartupReady(target);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let planned; try { planned = reader.transaction(() => { integrity(reader); return classifyInstrumentImportSchema(reader, source); })(); } finally { reader.close(); }
    const zero = { totalChanges: 0, newTemplateCount: 0, newReceiptCount: 0, backfilledCount: 0 };
    if (!apply || planned.classification === 'COMPLETE_200') return { ...planned, mode: apply ? 'NO_OP' : 'DRY_RUN', ...zero };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            integrity(db); const locked = classifyInstrumentImportSchema(db, source);
            if (locked.classification === 'COMPLETE_200') return { ...locked, mode: 'NO_OP', ...zero };
            if (locked.classification !== planned.classification || !isDeepStrictEqual(locked.sources, planned.sources)) throw fail('IMPORT_PLAN_STALE', 'The import schema changed after the read-only plan.');
            const original = preserve(db), releaseSource = loadInstrumentImportMigrationSource();
            if (locked.classification === 'PRE_200') db.exec(releaseSource.schemaSql);
            db.exec(releaseSource.guardsSql);
            assertPreserved(db, original);
            const receipt = { sources: locked.sources, originalRowsSha256: fingerprint(original.rows), originalRowsPreserved: true,
                newTemplateCount: 0, newReceiptCount: 0, backfilledCount: 0 };
            receipt.receiptSha256 = fingerprint(receipt);
            db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, JSON.stringify(receipt));
            const complete = classifyInstrumentImportSchema(db, source); integrity(db); assertPreserved(db, original);
            if (complete.classification !== 'COMPLETE_200' || Object.values(complete.counts).some(count => count !== 0)) throw fail('IMPORT_PRESERVATION_REFUSED', 'Installation changed import evidence or draft links.');
            return { ...complete, previousClassification: locked.classification, mode: 'APPLIED', newTemplateCount: 0, newReceiptCount: 0,
                backfilledCount: 0, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertInstrumentImportStartupReady(dbPath) {
    const outcome = installInstrumentImports({ dbPath });
    if (outcome.classification !== 'COMPLETE_200') throw fail('IMPORT_STARTUP_REQUIRED', 'Run the reviewed instrument import installer before starting the lab.');
    return outcome;
}
function parseArguments(args) {
    const options = { dbPath: undefined, apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('IMPORT_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('IMPORT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath?.trim() || seen.has('--apply') && seen.has('--dry-run')) throw fail('IMPORT_ARGUMENT_INVALID', 'Provide an explicit database and one mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installInstrumentImports(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ error: error.code || 'IMPORT_INSTALL_REFUSED', message: error.message, differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installInstrumentImports, assertInstrumentImportStartupReady, parseArguments };
