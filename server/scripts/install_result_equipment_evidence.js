#!/usr/bin/env node
const path = require('node:path'), Database = require('better-sqlite3');
const { createHash } = require('node:crypto');
const { loadResultEquipmentMigrationSource } = require('../services/resultEquipmentMigrationSource');
const MARKER = '189_result_equipment_readiness';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || []).filter(t => !/^\s+$/.test(t)).join('').replace(/;$/, '');
function resultDigest(db) {
    const rows = db.prepare('SELECT * FROM "Result" ORDER BY id').all().map(({ equipmentReadiness, ...row }) => row);
    return createHash('sha256').update(JSON.stringify(rows, (_, value) => typeof value === 'number' && !Number.isFinite(value)
        ? { nonfinite: String(value) } : value)).digest('hex');
}
function classify(db, source) {
    const columns = db.prepare('PRAGMA table_xinfo("Result")').all(), differences = [];
    if (!['id', 'sampleId', 'equipmentId'].every(name => columns.some(row => row.name === name)) ||
        !db.prepare('PRAGMA table_info("_schema_migrations")').all().some(row => row.name === 'details')) {
        throw fail('RESULT_EQUIPMENT_SCHEMA_MISMATCH', 'Install the prior application schema first.');
    }
    const column = columns.find(row => row.name === 'equipmentReadiness');
    if (column && (column.type !== 'TEXT' || column.notnull || column.dflt_value !== null || column.pk || column.hidden)) differences.push('Result.equipmentReadiness differs');
    const guards = [...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)];
    if (guards.length !== 2) throw fail('RESULT_EQUIPMENT_SOURCE_MISMATCH', 'The release requires exactly two evidence guards.');
    const installed = guards.map(match => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(match[1]);
        if (actual && (actual.type !== 'trigger' || normalize(actual.sql) !== normalize(match[0]))) differences.push(`${match[1]} differs`);
        return Boolean(actual);
    });
    const sources = { migrationSha256: source.sha256 }, marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    if (marker) {
        let receipt; try { receipt = JSON.parse(marker.details); } catch (_) { /* Refuse altered receipts. */ }
        if (JSON.stringify(receipt) !== JSON.stringify(sources)) differences.push('Result equipment receipt differs');
    }
    let classification;
    if (![Boolean(column), ...installed, Boolean(marker)].some(Boolean)) classification = 'PRE_189';
    else if (column && ![...installed, Boolean(marker)].some(Boolean)) classification = 'FRESH_PRISMA';
    else if ([Boolean(column), ...installed, Boolean(marker)].every(Boolean)) classification = 'COMPLETE';
    else differences.push('Result equipment installation is partial or unmarked');
    if (differences.length) throw fail('RESULT_EQUIPMENT_SCHEMA_MISMATCH', 'Result equipment evidence differs from the release.', differences);
    return { classification, sources, bootstrapRebuild: [], backfillCount: 0, resultCount: db.prepare('SELECT count(*) n FROM "Result"').get().n,
        originalResultSha256: resultDigest(db) };
}
function installResultEquipmentEvidence({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('RESULT_EQUIPMENT_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath), source = loadResultEquipmentMigrationSource();
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan; try { plan = reader.transaction(() => classify(reader, source))(); } finally { reader.close(); }
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const before = classify(db, source);
            if (before.classification === 'COMPLETE') return { ...before, mode: 'NO_OP', totalChanges: 0 };
            db.exec(before.classification === 'PRE_189' ? source.sql : source.guardsSql);
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify(before.sources));
            const after = classify(db, source);
            if (after.classification !== 'COMPLETE' || after.originalResultSha256 !== before.originalResultSha256 ||
                db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('RESULT_EQUIPMENT_INTEGRITY_REFUSED', 'Result equipment installation failed preservation checks.');
            }
            return { ...after, previousClassification: before.classification, mode: 'APPLIED', totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertResultEquipmentStartupReady(dbPath) {
    const plan = installResultEquipmentEvidence({ dbPath });
    if (plan.classification !== 'COMPLETE') throw fail('RESULT_EQUIPMENT_NOT_INSTALLED', 'Install reviewed Result equipment evidence before startup.');
    return plan;
}
function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('RESULT_EQUIPMENT_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i+1] && !args[i+1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('RESULT_EQUIPMENT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('RESULT_EQUIPMENT_ARGUMENT_INVALID', 'Apply and dry-run conflict.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installResultEquipmentEvidence(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'RESULT_EQUIPMENT_INSTALL_REFUSED', message: error.message, differences: error.differences || [] })}\n`); process.exitCode = 1; }
}
module.exports = { installResultEquipmentEvidence, assertResultEquipmentStartupReady, parseArguments };
