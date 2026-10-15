#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { loadQcRuleMigrationSource } = require('../services/qcRuleMigrationSource');
const MARKER = '185_qc_rules';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|\s+|[^\s'"`\[]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
function classify(db, source) {
    const differences = [];
    for (const [table, fields] of [['Lab', ['id', 'code']], ['Analysis', ['code', 'labId']], ['Methodology', ['id', 'analysisCode', 'labId']],
        ['AuditLog', ['id', 'entity', 'action', 'details']], ['ReferenceMaterial', ['id']], ['_schema_migrations', ['id', 'appliedAt', 'details']]]) {
        const columns = db.prepare(`PRAGMA table_xinfo("${table}")`).all();
        for (const name of fields) if (!columns.some(column => column.name === name)) differences.push(`${table}.${name} absent`);
    }
    if (differences.length) throw fail('QC_RULE_SCHEMA_MISMATCH', 'Install the prior application schema first.', differences);
    const table = db.prepare("SELECT type,sql FROM sqlite_master WHERE name='QcRule'").get();
    const wantedTable = source.sql.match(/CREATE TABLE "QcRule" \([\s\S]*?\n\);/)[0];
    if (table && (table.type !== 'table' || ![wantedTable, source.freshTables.QcRule].some(sql => normalized(sql) === normalized(table.sql)))) differences.push('QcRule definition differs');
    const indexes = [...source.sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[\s\S]*?;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    const guards = [...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    if (indexes.length !== 2 || guards.length !== 5) throw fail('QC_RULE_SOURCE_MISMATCH', 'QC rule release needs two indexes and five guards.');
    function present(row, type) {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(row.name);
        if (actual && (actual.type !== type || normalized(actual.sql) !== normalized(row.sql))) differences.push(`${row.name} differs`);
        return Boolean(actual);
    }
    const installedIndexes = indexes.map(row => present(row, 'index')), installedGuards = guards.map(row => present(row, 'trigger'));
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    const sources = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256 };
    if (marker) {
        let details;
        try { details = JSON.parse(marker.details); } catch { /* Refuse malformed receipts. */ }
        if (JSON.stringify(details) !== JSON.stringify(sources)) differences.push('QC rule receipt differs');
    }
    let classification;
    if ([Boolean(table), ...installedIndexes, ...installedGuards, Boolean(marker)].every(value => !value)) classification = 'PRE_185';
    else if (table && installedIndexes[0] && [installedIndexes[1], ...installedGuards, Boolean(marker)].every(value => !value)) classification = 'FRESH_PRISMA';
    else if ([Boolean(table), ...installedIndexes, ...installedGuards, Boolean(marker)].every(Boolean)) classification = 'COMPLETE';
    else differences.push('QC rule installation is partial or unmarked');
    if (differences.length) throw fail('QC_RULE_SCHEMA_MISMATCH', 'QC rule schema differs from the release.', differences);
    const rows = table ? db.prepare('SELECT * FROM "QcRule" ORDER BY labId,analysisCode,methodologyId,version').all() : [];
    const versions = new Map();
    for (const row of rows) {
        const scope = JSON.stringify([row.labId, row.analysisCode, row.methodologyId]);
        if (row.version !== (versions.get(scope) || 0) + 1) differences.push(`${row.id}: version gap`);
        versions.set(scope, row.version);
        try { const service = require('../services/qcRuleService'); service.validateCriteria(service.criteria(row)); }
        catch { differences.push(`${row.id}: invalid criteria`); }
        if (!row.reason.trim() || !row.approvedBy.trim() || !Number.isFinite(new Date(row.effectiveFrom).getTime()) ||
            !Number.isFinite(new Date(row.createdAt).getTime()) || new Date(row.effectiveFrom) < new Date(row.createdAt)) differences.push(`${row.id}: invalid provenance`);
    }
    if (differences.length) throw fail('QC_RULE_INTEGRITY_REFUSED', 'Existing QC rules need review.', differences);
    return { classification, sources, guards: guards.map(row => row.name), indexes: indexes.map(row => row.name), counts: { rules: rows.length }, backfillCount: 0 };
}
function installQcRules({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('QC_RULE_DATABASE_REQUIRED', 'An explicit database path is required.');
    const source = loadQcRuleMigrationSource(), target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan;
    try { plan = reader.transaction(() => classify(reader, { sql: source.sql, sha256: source.sha256, oracleSha256: source.oracleSha256, freshTables: source.freshTables }))(); } finally { reader.close(); }
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = classify(db, { sql: source.sql, sha256: source.sha256, oracleSha256: source.oracleSha256, freshTables: source.freshTables });
            if (locked.classification === 'COMPLETE') return { ...locked, mode: 'NO_OP', totalChanges: 0 };
            db.exec(locked.classification === 'PRE_185' ? source.sql : source.guardsSql);
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify(locked.sources));
            const complete = classify(db, { sql: source.sql, sha256: source.sha256, oracleSha256: source.oracleSha256, freshTables: source.freshTables });
            if (complete.classification !== 'COMPLETE' || db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw fail('QC_RULE_INTEGRITY_REFUSED', 'QC rule installation failed integrity checks.');
            return { ...complete, previousClassification: locked.classification, mode: 'APPLIED', totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertQcRuleStartupReady(dbPath) {
    if (!fs.existsSync(dbPath)) throw fail('DATABASE_NOT_FOUND', 'The lab database does not exist.');
    const outcome = installQcRules({ dbPath });
    if (outcome.classification !== 'COMPLETE') throw fail('QC_RULE_NOT_INSTALLED', 'Run the reviewed QC rule installer before starting the lab.');
    return outcome;
}
function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('QC_RULE_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[index + 1] && !args[index + 1].startsWith('--')) options.dbPath = args[++index];
        else throw fail('QC_RULE_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('QC_RULE_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installQcRules(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'QC_RULE_INSTALL_REFUSED', message: error.message, differences: error.differences || [] })}\n`); process.exitCode = 1; }
}
module.exports = { installQcRules, assertQcRuleStartupReady, parseArguments };
