#!/usr/bin/env node
const path = require('node:path');
const Database = require('better-sqlite3');
const { createHash } = require('node:crypto');
const { loadProficiencyMigrationSource } = require('../services/proficiencyMigrationSource');
const MARKER = '189_proficiency_evidence';
const FIELDS = { ncrStatus: 'TEXT', classificationLimits: 'TEXT', legacyScoreFlag: 'TEXT',
    legacyFlaggedAt: 'DATETIME', deletedAt: 'DATETIME', deletedBy: 'TEXT', deleteReason: 'TEXT' };
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');

function scores(db) {
    return createHash('sha256').update(JSON.stringify(db.prepare(
        'SELECT id,zScore,outcome FROM "ProficiencyRound" ORDER BY id').all(), (_, value) =>
        typeof value === 'number' && !Number.isFinite(value) ? { nonfinite: String(value) } : value)).digest('hex');
}
function classify(db, source) {
    const differences = [], columns = db.prepare('PRAGMA table_xinfo("ProficiencyRound")').all();
    for (const name of ['id', 'labId', 'analysisCode', 'uncertainty', 'zScore', 'outcome']) {
        if (!columns.some(row => row.name === name)) differences.push(`ProficiencyRound.${name} absent`);
    }
    if (!db.prepare('PRAGMA table_xinfo("_schema_migrations")').all().some(row => row.name === 'details')) differences.push('Migration ledger absent');
    if (differences.length) throw fail('PT_SCHEMA_MISMATCH', 'Install the prior application schema first.', differences);
    const present = Object.entries(FIELDS).map(([name, type]) => {
        const column = columns.find(row => row.name === name);
        if (column && (column.type !== type || column.notnull || column.dflt_value !== null || column.pk || column.hidden)) differences.push(`${name} differs`);
        return Boolean(column);
    });
    const guards = [...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)];
    if (guards.length !== 2) throw fail('PT_SOURCE_MISMATCH', 'The PT release requires exactly two NCR guards.');
    const installed = guards.map(match => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(match[1]);
        if (actual && (actual.type !== 'trigger' || normalized(actual.sql) !== normalized(match[0]))) differences.push(`${match[1]} differs`);
        return Boolean(actual);
    });
    const receipt = { migrationSha256: source.sha256 };
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    if (marker) {
        let parsed;
        try { parsed = JSON.parse(marker.details); } catch (_) { /* Refuse altered receipts. */ }
        if (JSON.stringify(parsed) !== JSON.stringify(receipt)) differences.push('PT migration receipt differs');
    }
    let classification;
    if ([...present, ...installed, Boolean(marker)].every(value => !value)) classification = 'PRE_189';
    else if (present.every(Boolean) && [...installed, Boolean(marker)].every(value => !value)) classification = 'FRESH_PRISMA';
    else if ([...present, ...installed, Boolean(marker)].every(Boolean)) classification = 'COMPLETE';
    else differences.push('PT installation is partial or unmarked');
    if (differences.length) throw fail('PT_SCHEMA_MISMATCH', 'PT evidence schema differs from the release.', differences);
    return { classification, sources: receipt, bootstrapRebuild: [], backfillCount: 0,
        roundCount: db.prepare('SELECT count(*) n FROM "ProficiencyRound"').get().n, scoreOutcomeSha256: scores(db) };
}

function installProficiencyEvidence({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('PT_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath), source = loadProficiencyMigrationSource();
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan;
    try { plan = reader.transaction(() => classify(reader, { sql: source.sql, sha256: source.sha256 }))(); }
    finally { reader.close(); }
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const current = classify(db, { sql: source.sql, sha256: source.sha256 });
            if (current.classification === 'COMPLETE') return { ...current, mode: 'NO_OP', totalChanges: 0 };
            db.exec(current.classification === 'PRE_189' ? source.sql : source.guardsSql);
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify(current.sources));
            const after = classify(db, { sql: source.sql, sha256: source.sha256 });
            if (after.classification !== 'COMPLETE' || after.scoreOutcomeSha256 !== current.scoreOutcomeSha256 ||
                db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('PT_INTEGRITY_REFUSED', 'PT evidence installation failed preservation checks.');
            }
            return { ...after, previousClassification: current.classification, mode: 'APPLIED',
                totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function assertProficiencyStartupReady(dbPath) {
    const plan = installProficiencyEvidence({ dbPath });
    if (plan.classification !== 'COMPLETE') throw fail('PT_NOT_INSTALLED', 'Install reviewed PT evidence before starting the lab.');
    return plan;
}
function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('PT_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[index + 1] && !args[index + 1].startsWith('--')) options.dbPath = args[++index];
        else throw fail('PT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('PT_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installProficiencyEvidence(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'PT_INSTALL_REFUSED', message: error.message, differences: error.differences || [] })}\n`); process.exitCode = 1; }
}
module.exports = { installProficiencyEvidence, assertProficiencyStartupReady, parseArguments, scoreOutcomeDigest: scores };
