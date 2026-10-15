#!/usr/bin/env node
// The optional startup context must not become a default CLI/image-copy dependency.
function openReadonlyDatabase(Database, target, options, startupContext) {
    return startupContext
        ? require('../utils/startupReadinessContext').openReadonlyDatabase(Database, target, options, startupContext)
        : new Database(target, options);
}
const fs = require('node:fs'), path = require('node:path'), Database = require('better-sqlite3');
const { isDeepStrictEqual } = require('node:util');
const { createHash } = require('node:crypto');
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
    return { objects, tables, rowsSha256: preservedRowsFingerprint(db, tables) };
}
// Exact JSON.stringify(Object.fromEntries(original table/row arrays)) bytes,
// streamed one row at a time. Original columns include #205 records; the new
// nullable pointer and this release's own receipt are excluded on the recheck.
function preservedRowsFingerprint(db, tables) {
    const byName = Object.fromEntries(tables.map(table => [table.name, table]));
    const hash = createHash('sha256'); hash.update('{'); let separator = '';
    for (const name of Object.keys(byName)) {
        const table = byName[name]; hash.update(separator); hash.update(JSON.stringify(name)); hash.update(':[');
        const sql = 'SELECT ' + table.columns.map(column => quoted(column.name)).join(',') + ' FROM ' + quoted(name);
        const rows = name === '_schema_migrations' ? db.prepare(sql + ' WHERE id<>? ORDER BY rowid').iterate(MARKER) : db.prepare(sql + ' ORDER BY rowid').iterate();
        let rowSeparator = '';
        for (const row of rows) { hash.update(rowSeparator); hash.update(JSON.stringify(row)); rowSeparator = ','; }
        hash.update(']'); separator = ',';
    }
    hash.update('}'); return hash.digest('hex');
}
function assertPreserved(db, original) {
    if (preservedRowsFingerprint(db, original.tables) !== original.rowsSha256) throw fail('IMPORT_PRESERVATION_REFUSED', 'An original row changed during import installation.');
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
function installInstrumentImports({ dbPath, apply = false, startupContext} = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim() || !fs.existsSync(path.resolve(dbPath))) throw fail('IMPORT_DATABASE_REQUIRED', 'Provide an explicit existing lab database.');
    const target = path.resolve(dbPath), source = loadInstrumentImportMigrationSource();
    require('./install_calculation_templates').assertCalculationStartupReady(target, apply ? undefined : startupContext);
    const reader = openReadonlyDatabase(Database, target, { readonly: true, fileMustExist: true }, apply ? undefined : startupContext);
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
            const receipt = { sources: locked.sources, originalRowsSha256: original.rowsSha256, originalRowsPreserved: true,
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
function assertInstrumentImportStartupReady(dbPath, startupContext) {
    const outcome = installInstrumentImports({ dbPath, startupContext });
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
