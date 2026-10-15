#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { loadResultAttemptMigrationSource } = require('../services/resultAttemptMigrationSource');
const MARKER = '182_result_attempt_links';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|\s+|[^\s'"`\[]+/g) || [])
    .map(token => /^\s+$/.test(token) ? ' ' : token).join('').trim().replace(/;$/, '');

function classify(db, source) {
    const differences = [];
    for (const [table, fields] of [['Result', ['id', 'sampleId']], ['WorkAttempt', ['id', 'workItemId']], ['WorkItem', ['id', 'sampleId']],
        ['_schema_migrations', ['id', 'appliedAt', 'details']]]) {
        const columns = db.prepare(`PRAGMA table_xinfo("${table}")`).all();
        for (const name of fields) if (!columns.some(column => column.name === name)) differences.push(`${table}.${name} absent`);
    }
    if (differences.length) throw fail('RESULT_ATTEMPT_SCHEMA_MISMATCH', 'Install the prior workflow schema first.', differences);
    const column = db.prepare('PRAGMA table_xinfo("Result")').all().find(row => row.name === 'attemptId');
    if (column && (column.type !== 'TEXT' || column.notnull || column.dflt_value !== null || column.pk || column.hidden)) differences.push('Result.attemptId shape differs');
    const wantedIndex = source.sql.match(/CREATE INDEX[^;]+;/)[0];
    const index = db.prepare("SELECT type,sql FROM sqlite_master WHERE name='Result_attemptId_idx'").get();
    if (index && (index.type !== 'index' || normalized(index.sql) !== normalized(wantedIndex))) differences.push('Result_attemptId_idx differs');
    const expected = [...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    if (expected.length !== 3) throw fail('RESULT_ATTEMPT_SOURCE_MISMATCH', 'The release must contain exactly three attempt guards.');
    const guards = expected.map(wanted => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (actual && (actual.type !== 'trigger' || normalized(actual.sql) !== normalized(wanted.sql))) differences.push(`${wanted.name} differs`);
        return Boolean(actual);
    });
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    if (marker) {
        let details;
        try { details = JSON.parse(marker.details); } catch { /* Refuse malformed provenance. */ }
        if (JSON.stringify(details) !== JSON.stringify({ migrationSha256: source.sha256 })) differences.push('Result attempt marker differs');
    }
    let classification;
    if (!column && !index && guards.every(value => !value) && !marker) classification = 'PRE_182';
    else if (column && index && guards.every(value => !value) && !marker) classification = 'FRESH_PRISMA';
    else if (column && index && guards.every(Boolean) && marker) classification = 'COMPLETE';
    else differences.push('Result attempt installation is partial or unmarked');
    if (differences.length) throw fail('RESULT_ATTEMPT_SCHEMA_MISMATCH', 'Result attempt schema differs from the release.', differences);
    const invalidLinks = column ? db.prepare(`SELECT r.id FROM "Result" r LEFT JOIN "WorkAttempt" a ON a.id=r.attemptId
        LEFT JOIN "WorkItem" w ON w.id=a.workItemId WHERE r.attemptId IS NOT NULL AND (a.id IS NULL OR w.id IS NULL OR w.sampleId != r.sampleId) ORDER BY r.id`).all() : [];
    if (invalidLinks.length) throw fail('RESULT_ATTEMPT_INTEGRITY_REFUSED', 'Existing result attempt links need review.', invalidLinks);
    return { classification, sources: { migrationSha256: source.sha256 }, guards: expected.map(row => row.name),
        counts: { results: db.prepare('SELECT COUNT(*) n FROM "Result"').get().n,
            linked: column ? db.prepare('SELECT COUNT(*) n FROM "Result" WHERE attemptId IS NOT NULL').get().n : 0 },
        backfillCount: 0 };
}

function installResultAttemptLinks({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('RESULT_ATTEMPT_DATABASE_REQUIRED', 'An explicit database path is required.');
    const source = loadResultAttemptMigrationSource(), target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan;
    try { plan = reader.transaction(() => classify(reader, { sql: source.sql, guardsSql: source.guardsSql, sha256: source.sha256 }))(); }
    finally { reader.close(); }
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = classify(db, { sql: source.sql, guardsSql: source.guardsSql, sha256: source.sha256 });
            if (locked.classification === 'COMPLETE') return { ...locked, mode: 'NO_OP', totalChanges: 0 };
            db.exec(locked.classification === 'PRE_182' ? source.sql : source.guardsSql);
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify({ migrationSha256: source.sha256 }));
            const complete = classify(db, { sql: source.sql, guardsSql: source.guardsSql, sha256: source.sha256 });
            if (complete.classification !== 'COMPLETE' || db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('RESULT_ATTEMPT_INTEGRITY_REFUSED', 'Result attempt installation failed integrity checks.');
            }
            return { ...complete, previousClassification: locked.classification, mode: 'APPLIED', totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function assertResultAttemptStartupReady(dbPath) {
    if (!fs.existsSync(dbPath)) throw fail('DATABASE_NOT_FOUND', 'The lab database does not exist.');
    const outcome = installResultAttemptLinks({ dbPath });
    if (outcome.classification !== 'COMPLETE') throw fail('RESULT_ATTEMPT_NOT_INSTALLED', 'Run the reviewed result attempt installer before starting the lab.');
    return outcome;
}

function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (seen.has(arg)) throw fail('RESULT_ATTEMPT_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('RESULT_ATTEMPT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('RESULT_ATTEMPT_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    return options;
}

if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installResultAttemptLinks(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'RESULT_ATTEMPT_INSTALL_REFUSED', message: error.message, differences: error.differences || [] })}\n`); process.exitCode = 1; }
}

module.exports = { installResultAttemptLinks, assertResultAttemptStartupReady, parseArguments };
