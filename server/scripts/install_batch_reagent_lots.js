#!/usr/bin/env node
const path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { loadBatchReagentLotMigrationSource } = require('../services/batchReagentLotMigrationSource');
const { fingerprintRows, fingerprintRetainedTables } = require('../services/retainedRowsFingerprint');
const MARKER = '194_batch_reagent_lots';
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences, totalChanges: 0 });
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
const columns = (db, table) => db.prepare(`PRAGMA table_xinfo("${table}")`).all()
    .map(({ name, type, notnull, dflt_value, pk, hidden }) => ({ name, type, notnull, dflt_value, pk, hidden }));
const foreignKeys = db => db.prepare('PRAGMA foreign_key_list("BatchReagentLot")').all()
    .map(({ table, from, to, on_update, on_delete, match }) => ({ table, from, to, on_update, on_delete, match }))
    .sort((a, b) => a.from.localeCompare(b.from));
const indexes = db => db.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='BatchReagentLot' AND sql IS NOT NULL ORDER BY name")
    .all().map(row => ({ name: row.name, sql: normalize(row.sql) }));
function expectedSchema() {
    const source = loadBatchReagentLotMigrationSource();
    const db = new Database(':memory:');
    try {
        db.exec('CREATE TABLE Lab(id TEXT PRIMARY KEY); CREATE TABLE Batch(id TEXT PRIMARY KEY); CREATE TABLE InventoryLot(id TEXT PRIMARY KEY);');
        db.exec(source.schemaSql);
        return { columns: columns(db, 'BatchReagentLot'), foreignKeys: foreignKeys(db), indexes: indexes(db) };
    } finally { db.close(); }
}
function classify(db) {
    const source = loadBatchReagentLotMigrationSource();
    const differences = [];
    for (const [table, required] of [['Lab', ['id']], ['Batch', ['id', 'labId']],
        ['InventoryLot', ['id', 'labId', 'status', 'expiryDate']], ['_schema_migrations', ['id', 'details']]]) {
        const actual = columns(db, table);
        for (const name of required) if (!actual.some(column => column.name === name)) differences.push(`${table}.${name} absent`);
    }
    if (differences.length) throw fail('REAGENT_LOT_PREREQUISITE_REQUIRED', 'Install the prior application schema before reagent links.', differences);
    const table = db.prepare("SELECT type FROM sqlite_master WHERE name='BatchReagentLot'").get();
    const guards = [...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)]
        .map(match => ({ name: match[1], sql: match[0] }));
    if (guards.length !== 2) throw fail('REAGENT_LOT_SOURCE_MISMATCH', 'The release requires its two immutable-link guards.');
    const installed = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='BatchReagentLot' ORDER BY name").all();
    const managedObjects = db.prepare("SELECT name,tbl_name FROM sqlite_master WHERE name IN ('BatchReagentLot_batchId_inventoryLotId_key','BatchReagentLot_labId_batchId_idx','BatchReagentLot_update_refused','BatchReagentLot_delete_refused')").all();
    const receiptRow = db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
    const sources = { migrationSha256: source.sha256 };
    if (!table && !managedObjects.length && !installed.length && !receiptRow) return { classification: 'PRE_194', sources, linkCount: 0 };
    if (table?.type !== 'table') differences.push('BatchReagentLot table differs');
    if (managedObjects.some(row => row.tbl_name !== 'BatchReagentLot')) differences.push('Managed reagent-link objects belong to a different table');
    const expected = expectedSchema();
    if (JSON.stringify(columns(db, 'BatchReagentLot')) !== JSON.stringify(expected.columns)) differences.push('BatchReagentLot columns differ');
    if (JSON.stringify(foreignKeys(db)) !== JSON.stringify(expected.foreignKeys)) differences.push('BatchReagentLot foreign keys differ');
    if (JSON.stringify(indexes(db)) !== JSON.stringify(expected.indexes)) differences.push('BatchReagentLot indexes differ');
    if (differences.length) throw fail('REAGENT_LOT_SCHEMA_MISMATCH', 'The reagent-link schema differs from the reviewed release.', differences);
    const linkCount = db.prepare('SELECT count(*) n FROM BatchReagentLot').get().n;
    if (!installed.length && !receiptRow) {
        if (linkCount) throw fail('REAGENT_LOT_BOOTSTRAP_DATA_REFUSED', 'Fresh bootstrap requires an empty reagent-link table.',
            db.prepare('SELECT id FROM BatchReagentLot ORDER BY id').all().map(row => row.id));
        return { classification: 'FRESH_PRISMA_194', sources, linkCount };
    }
    if (installed.length !== guards.length || guards.some(guard =>
        normalize(installed.find(row => row.name === guard.name)?.sql || '') !== normalize(guard.sql))) differences.push('Reagent-link guards differ or are partial');
    let receipt;
    try { receipt = JSON.parse(receiptRow?.details); } catch { /* Missing or altered receipts refuse. */ }
    const keys = ['sources', 'originalRowsSha256', 'originalRowsPreserved', 'newLinkCount', 'backfilledCount', 'receiptSha256'];
    if (!receipt || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(keys.sort()) ||
        JSON.stringify(receipt.sources) !== JSON.stringify(sources) || !/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256) ||
        receipt.originalRowsPreserved !== true || receipt.newLinkCount !== 0 || receipt.backfilledCount !== 0 ||
        receipt.receiptSha256 !== fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptSha256')))) {
        differences.push('Reagent-link receipt differs or is absent');
    }
    if (differences.length) throw fail('REAGENT_LOT_SCHEMA_MISMATCH', 'The reagent-link installation differs from the reviewed release.', differences);
    return { classification: 'COMPLETE_194', sources, linkCount, receipt };
}
function retainedRows(db) {
    return fingerprintRetainedTables(db, { excludeTables: ['BatchReagentLot', '_schema_migrations'] });
}
function installBatchReagentLots({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('REAGENT_LOT_DATABASE_REQUIRED', 'Provide an explicit database path.');
    const target = path.resolve(dbPath), source = loadBatchReagentLotMigrationSource();
    const reader = new Database(target, { readonly: true, fileMustExist: true }); let reviewed;
    try { reviewed = reader.transaction(() => classify(reader))(); } finally { reader.close(); }
    if (!apply || reviewed.classification === 'COMPLETE_194') return { ...reviewed, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0, backfilledCount: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        require('../services/exchangeDbFunctions').registerDbFunctions(db); db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = classify(db);
            if (current.classification === 'COMPLETE_194') return { ...current, mode: 'NO_OP', totalChanges: 0, backfilledCount: 0 };
            const before = retainedRows(db), ledger = fingerprintRows(db.prepare('SELECT * FROM _schema_migrations ORDER BY id').iterate());
            db.exec(current.classification === 'PRE_194' ? source.sql : source.guardsSql);
            if (retainedRows(db) !== before || db.prepare('SELECT count(*) n FROM BatchReagentLot').get().n !== 0) {
                throw fail('REAGENT_LOT_PRESERVATION_REFUSED', 'Reagent-link installation changed retained data.');
            }
            const receipt = { sources: current.sources, originalRowsSha256: before, originalRowsPreserved: true, newLinkCount: 0, backfilledCount: 0 };
            receipt.receiptSha256 = fingerprint(receipt);
            db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER, JSON.stringify(receipt));
            if (fingerprintRows(db.prepare('SELECT * FROM _schema_migrations WHERE id<>? ORDER BY id').iterate(MARKER)) !== ledger ||
                db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('REAGENT_LOT_INTEGRITY_REFUSED', 'Reagent-link installation failed preservation or integrity checks.');
            }
            return { ...classify(db), previousClassification: current.classification, mode: 'APPLIED', newLinkCount: 0,
                backfilledCount: 0, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertBatchReagentLotsStartupReady(dbPath) {
    const plan = installBatchReagentLots({ dbPath });
    if (plan.classification !== 'COMPLETE_194') throw fail('REAGENT_LOT_NOT_INSTALLED', 'Install the reviewed reagent-link schema before startup.');
    return plan;
}
function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('REAGENT_LOT_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('REAGENT_LOT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('REAGENT_LOT_ARGUMENT_INVALID', 'Provide --db and one execution mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installBatchReagentLots(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ error: error.code || 'REAGENT_LOT_INSTALL_REFUSED', message: error.message,
        differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installBatchReagentLots, assertBatchReagentLotsStartupReady, parseArguments };
