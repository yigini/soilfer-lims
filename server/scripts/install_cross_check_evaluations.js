#!/usr/bin/env node
const path = require('node:path'), { createHash } = require('node:crypto'), Database = require('better-sqlite3');
const { loadCrossCheckMigrationSource } = require('../services/crossCheckMigrationSource');
const MARKER = '201_cross_check_evaluations', TABLE = 'CrossCheckEvaluation';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { statusCode: 409, code, differences, totalChanges: 0 });
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
function releaseObjects(source) {
    const objects = [{ name: TABLE, type: 'table', sql: source.schemaSql.match(/CREATE TABLE "CrossCheckEvaluation" \([\s\S]*?\n\);/)?.[0] },
        ...[...source.schemaSql.matchAll(/^CREATE INDEX "([^"]+)"[^;]*;/gm)].map(match => ({ name: match[1], type: 'index', sql: match[0] })),
        ...[...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], type: 'trigger', sql: match[0] }))];
    if (objects.length !== 5 || objects.some(row => !row.sql)) throw fail('CROSS_CHECK_SOURCE_MISMATCH', 'The evidence release requires its table, two indexes and two guards.');
    return objects;
}
function integrity(db) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length)
        throw fail('CROSS_CHECK_INTEGRITY_REFUSED', 'Cross-check installation requires an intact database.');
}
function classify(db, source, predecessor) {
    const objects = releaseObjects(source), differences = [], names = new Set(objects.map(row => row.name));
    const present = objects.map(wanted => {
        const actual = db.prepare('SELECT type,tbl_name,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (actual && (actual.type !== wanted.type || actual.tbl_name !== TABLE || normalized(actual.sql) !== normalized(wanted.sql))) differences.push(wanted.name + ' differs');
        return !!actual;
    });
    for (const row of db.prepare('SELECT name FROM sqlite_master WHERE tbl_name=? AND sql IS NOT NULL').all(TABLE)) {
        if (!names.has(row.name)) differences.push(row.name + ' is not a release object');
    }
    const marker = db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
    if (differences.length) throw fail('CROSS_CHECK_SCHEMA_MISMATCH', 'Cross-check evidence differs from the reviewed release.', differences);
    let classification, receipt;
    const count = present[0] ? db.prepare('SELECT COUNT(*) n FROM CrossCheckEvaluation').get().n : 0;
    const sources = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256,
        predecessorMigrationSha256: predecessor.migrationSha256 };
    if (!present.some(Boolean) && !marker) classification = 'PRE_201';
    else if (present.slice(0, 3).every(Boolean) && present.slice(3).every(value => !value) && !marker && count === 0) classification = 'FRESH_PRISMA';
    else if (present.every(Boolean) && marker) {
        classification = 'COMPLETE_201';
        try { receipt = JSON.parse(marker.details); } catch { /* Unverifiable receipts refuse. */ }
        const fields = ['sources', 'originalRowsSha256', 'originalRowsPreserved', 'newEvaluationCount', 'backfilledCount', 'receiptSha256'];
        if (!receipt || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(fields.sort()) ||
            JSON.stringify(receipt.sources) !== JSON.stringify(sources) || !/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256) ||
            receipt.originalRowsPreserved !== true || receipt.newEvaluationCount !== 0 || receipt.backfilledCount !== 0 ||
            receipt.receiptSha256 !== fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptSha256'))))
            differences.push('Cross-check installation receipt differs');
    } else differences.push('Cross-check installation is partial, unmarked or populated before installation');
    if (differences.length) throw fail('CROSS_CHECK_SCHEMA_MISMATCH', 'Cross-check evidence differs from the reviewed release.', differences);
    return { classification, sources, evaluationCount: count, ...(receipt && { receipt }) };
}
function retainedRows(db) {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('CrossCheckEvaluation','_schema_migrations') ORDER BY name").all();
    return Object.fromEntries(names.map(({ name }) => [name, db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '" ORDER BY rowid').all()]));
}
function installCrossCheckEvaluations({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('CROSS_CHECK_DATABASE_REQUIRED', 'Provide an explicit database path.');
    const target = path.resolve(dbPath), source = loadCrossCheckMigrationSource();
    const predecessor = require('./install_reported_value_selections').assertReportedValueStartupReady(target);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let reviewed;
    try { reviewed = reader.transaction(() => { integrity(reader); return classify(reader, source, predecessor); })(); }
    finally { reader.close(); }
    if (!apply || reviewed.classification === 'COMPLETE_201') return { ...reviewed, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0, newEvaluationCount: 0, backfilledCount: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        require('../services/exchangeDbFunctions').registerDbFunctions(db); db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const lockedPredecessor = require('./install_reported_value_selections').assertReportedValueStartupReady(target);
            if (lockedPredecessor.migrationSha256 !== predecessor.migrationSha256)
                throw fail('CROSS_CHECK_PLAN_STALE', 'The reported-value prerequisite changed after review.');
            const current = classify(db, source, predecessor);
            if (current.classification === 'COMPLETE_201') return { ...current, mode: 'NO_OP', totalChanges: 0, newEvaluationCount: 0, backfilledCount: 0 };
            const before = fingerprint(retainedRows(db)), ledger = db.prepare('SELECT * FROM _schema_migrations ORDER BY id').all();
            const installationSql = loadCrossCheckMigrationSource();
            if (current.classification === 'PRE_201') db.exec(installationSql.schemaSql);
            db.exec(installationSql.guardsSql);
            if (fingerprint(retainedRows(db)) !== before || db.prepare('SELECT COUNT(*) n FROM CrossCheckEvaluation').get().n !== 0)
                throw fail('CROSS_CHECK_PRESERVATION_REFUSED', 'Evidence installation changed retained rows.');
            const receipt = { sources: current.sources, originalRowsSha256: before, originalRowsPreserved: true, newEvaluationCount: 0, backfilledCount: 0 };
            receipt.receiptSha256 = fingerprint(receipt);
            db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER, JSON.stringify(receipt));
            if (fingerprint(db.prepare('SELECT * FROM _schema_migrations WHERE id<>? ORDER BY id').all(MARKER)) !== fingerprint(ledger))
                throw fail('CROSS_CHECK_PRESERVATION_REFUSED', 'Evidence installation changed a retained receipt.');
            integrity(db);
            return { ...classify(db, source, predecessor), previousClassification: current.classification, mode: 'APPLIED',
                newEvaluationCount: 0, backfilledCount: 0, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } catch (error) {
        if (error.statusCode) throw error;
        throw Object.assign(fail('CROSS_CHECK_INSTALL_REFUSED', 'Cross-check evidence installation failed atomically.'), { cause: error });
    } finally { db.close(); }
}
function assertCrossCheckStartupReady(dbPath) {
    const current = installCrossCheckEvaluations({ dbPath });
    if (current.classification !== 'COMPLETE_201') throw fail('CROSS_CHECK_NOT_INSTALLED', 'Install cross-check evidence before startup.');
    return current;
}
function parseArguments(args) {
    const options = {}, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('CROSS_CHECK_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--db' && args[index + 1] && !args[index + 1].startsWith('--')) options.dbPath = args[++index];
        else if (arg === '--apply') options.apply = true;
        else if (arg !== '--dry-run') throw fail('CROSS_CHECK_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('CROSS_CHECK_ARGUMENT_INVALID', 'Provide a database and one mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installCrossCheckEvaluations(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ code: error.code || 'CROSS_CHECK_INSTALL_REFUSED', message: error.message,
        differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installCrossCheckEvaluations, assertCrossCheckStartupReady, parseArguments };
