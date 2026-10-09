#!/usr/bin/env node
const path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { loadResultOverrideMigrationSource } = require('../services/resultOverrideMigrationSource');
const MARKER = '197_result_override_requests';
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences, totalChanges: 0 });
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
const columns = (db, table) => db.prepare(`PRAGMA table_xinfo("${table}")`).all()
    .map(({ name, type, notnull, dflt_value, pk, hidden }) => ({ name, type, notnull, dflt_value, pk, hidden }));
const foreignKeys = db => db.prepare('PRAGMA foreign_key_list("ResultOverrideRequest")').all()
    .map(({ table, from, to, on_update, on_delete, match }) => ({ table, from, to, on_update, on_delete, match }))
    .sort((a, b) => a.from.localeCompare(b.from));
const indexes = db => db.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='ResultOverrideRequest' AND sql IS NOT NULL AND name<>'ResultOverrideRequest_one_active_cell' ORDER BY name")
    .all().map(row => ({ name: row.name, sql: normalize(row.sql) }));
function expectedSchema() {
    const source = loadResultOverrideMigrationSource();
    const db = new Database(':memory:');
    try {
        db.exec('CREATE TABLE Lab(id TEXT PRIMARY KEY); CREATE TABLE WorkItem(id TEXT PRIMARY KEY); CREATE TABLE Sample(id TEXT PRIMARY KEY); CREATE TABLE Analysis(code TEXT PRIMARY KEY); CREATE TABLE Methodology(id TEXT PRIMARY KEY); CREATE TABLE EquipmentAsset(id TEXT PRIMARY KEY); CREATE TABLE User(id TEXT PRIMARY KEY); CREATE TABLE Result(id TEXT PRIMARY KEY);');
        db.exec(source.schemaSql);
        return { columns: columns(db, 'ResultOverrideRequest'), foreignKeys: foreignKeys(db), indexes: indexes(db) };
    } finally { db.close(); }
}
function classify(db) {
    const source = loadResultOverrideMigrationSource();
    const differences = [];
    for (const [table, required] of [['Lab',['id','code']],['WorkItem',['id','sampleId','analysis','assignedLab']],['Sample',['id','assignedLab','labId']],['Analysis',['code']],['Methodology',['id']],['EquipmentAsset',['id']],['User',['id']],['Result',['id','sampleId','param','replicateNo','rawInput','unit','basis','methodologyId','equipmentId','flags']],['_schema_migrations',['id','details']]]) {
        const actual = columns(db, table);
        for (const name of required) if (!actual.some(column => column.name === name)) differences.push(`${table}.${name} absent`);
    }
    if (differences.length) throw fail('OVERRIDE_PREREQUISITE_REQUIRED', 'Install the prior application schema before override requests.', differences);
    const table = db.prepare("SELECT type FROM sqlite_master WHERE name='ResultOverrideRequest'").get();
    const guards = [...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)]
        .map(match => ({ name: match[1], sql: match[0] }));
    if (guards.length !== 3) throw fail('OVERRIDE_SOURCE_MISMATCH', 'The release requires its three approval/cancellation guards.');
    const installed = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='ResultOverrideRequest' ORDER BY name").all();
    const managedObjects = db.prepare("SELECT name,tbl_name FROM sqlite_master WHERE name IN ('ResultOverrideRequest_consumedResultId_key','ResultOverrideRequest_labId_status_requestedAt_idx','ResultOverrideRequest_workItemId_replicateNo_idx','ResultOverrideRequest_one_active_cell','ResultOverrideRequest_insert_guard','ResultOverrideRequest_update_guard','ResultOverrideRequest_delete_refused')").all();
    const activeIndex = db.prepare("SELECT sql FROM sqlite_master WHERE name='ResultOverrideRequest_one_active_cell' AND type='index'").get();
    const expectedActiveIndex = source.guardsSql.match(/CREATE UNIQUE INDEX "ResultOverrideRequest_one_active_cell"[\s\S]*?;/)?.[0];
    const receiptRow = db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
    const sources = { migrationSha256: source.sha256 };
    if (!table && !managedObjects.length && !installed.length && !receiptRow) return { classification: 'PRE_197', sources, requestCount: 0 };
    if (table?.type !== 'table') differences.push('ResultOverrideRequest table differs');
    if (managedObjects.some(row => row.tbl_name !== 'ResultOverrideRequest')) differences.push('Managed override-request objects belong to a different table');
    const expected = expectedSchema();
    if (JSON.stringify(columns(db, 'ResultOverrideRequest')) !== JSON.stringify(expected.columns)) differences.push('ResultOverrideRequest columns differ');
    if (JSON.stringify(foreignKeys(db)) !== JSON.stringify(expected.foreignKeys)) differences.push('ResultOverrideRequest foreign keys differ');
    if (JSON.stringify(indexes(db)) !== JSON.stringify(expected.indexes)) differences.push('ResultOverrideRequest indexes differ');
    if (differences.length) throw fail('OVERRIDE_SCHEMA_MISMATCH', 'The override-request schema differs from the reviewed release.', differences);
    const requestCount = db.prepare('SELECT count(*) n FROM ResultOverrideRequest').get().n;
    if (!installed.length && !receiptRow && !activeIndex) {
        if (requestCount) throw fail('OVERRIDE_BOOTSTRAP_DATA_REFUSED', 'Fresh bootstrap requires an empty override-request table.',
            db.prepare('SELECT id FROM ResultOverrideRequest ORDER BY id').all().map(row => row.id));
        return { classification: 'FRESH_PRISMA_197', sources, requestCount };
    }
    if (!expectedActiveIndex || normalize(activeIndex?.sql || '') !== normalize(expectedActiveIndex)) differences.push('Active-cell partial uniqueness differs or is absent');
    if (installed.length !== guards.length || guards.some(guard =>
        normalize(installed.find(row => row.name === guard.name)?.sql || '') !== normalize(guard.sql))) differences.push('Override-request guards differ or are partial');
    let receipt;
    try { receipt = JSON.parse(receiptRow?.details); } catch { /* Missing or altered receipts refuse. */ }
    const keys = ['sources', 'originalRowsSha256', 'originalRowsPreserved', 'newRequestCount', 'backfilledCount', 'receiptSha256'];
    if (!receipt || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(keys.sort()) ||
        JSON.stringify(receipt.sources) !== JSON.stringify(sources) || !/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256) ||
        receipt.originalRowsPreserved !== true || receipt.newRequestCount !== 0 || receipt.backfilledCount !== 0 ||
        receipt.receiptSha256 !== fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptSha256')))) {
        differences.push('Override-request receipt differs or is absent');
    }
    if (differences.length) throw fail('OVERRIDE_SCHEMA_MISMATCH', 'The override-request installation differs from the reviewed release.', differences);
    return { classification: 'COMPLETE_197', sources, requestCount, receipt };
}
function retainedRows(db) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('ResultOverrideRequest','_schema_migrations') ORDER BY name").all();
    return Object.fromEntries(tables.map(({ name }) => [name, db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}" ORDER BY rowid`).all()]));
}
function installResultOverrideRequests({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('OVERRIDE_DATABASE_REQUIRED', 'Provide an explicit database path.');
    const target = path.resolve(dbPath), source = loadResultOverrideMigrationSource();
    const reader = new Database(target, { readonly: true, fileMustExist: true }); let reviewed;
    try { reviewed = reader.transaction(() => classify(reader))(); } finally { reader.close(); }
    if (!apply || reviewed.classification === 'COMPLETE_197') return { ...reviewed, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0, backfilledCount: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        require('../services/exchangeDbFunctions').registerDbFunctions(db); db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = classify(db);
            if (current.classification === 'COMPLETE_197') return { ...current, mode: 'NO_OP', totalChanges: 0, backfilledCount: 0 };
            const before = fingerprint(retainedRows(db)), ledger = db.prepare('SELECT * FROM _schema_migrations ORDER BY id').all();
            db.exec(current.classification === 'PRE_197' ? source.sql : source.guardsSql);
            if (fingerprint(retainedRows(db)) !== before || db.prepare('SELECT count(*) n FROM ResultOverrideRequest').get().n !== 0) {
                throw fail('OVERRIDE_PRESERVATION_REFUSED', 'Override-request installation changed retained data.');
            }
            const receipt = { sources: current.sources, originalRowsSha256: before, originalRowsPreserved: true, newRequestCount: 0, backfilledCount: 0 };
            receipt.receiptSha256 = fingerprint(receipt);
            db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER, JSON.stringify(receipt));
            if (fingerprint(db.prepare('SELECT * FROM _schema_migrations WHERE id<>? ORDER BY id').all(MARKER)) !== fingerprint(ledger) ||
                db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('OVERRIDE_INTEGRITY_REFUSED', 'Override-request installation failed preservation or integrity checks.');
            }
            return { ...classify(db), previousClassification: current.classification, mode: 'APPLIED', newRequestCount: 0,
                backfilledCount: 0, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertResultOverrideRequestsStartupReady(dbPath) {
    const plan = installResultOverrideRequests({ dbPath });
    if (plan.classification !== 'COMPLETE_197') throw fail('OVERRIDE_NOT_INSTALLED', 'Install the reviewed override-request schema before startup.');
    return plan;
}
function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('OVERRIDE_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('OVERRIDE_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('OVERRIDE_ARGUMENT_INVALID', 'Provide --db and one execution mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installResultOverrideRequests(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ error: error.code || 'OVERRIDE_INSTALL_REFUSED', message: error.message,
        differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installResultOverrideRequests, assertResultOverrideRequestsStartupReady, parseArguments };
