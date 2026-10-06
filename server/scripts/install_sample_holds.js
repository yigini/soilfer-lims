#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { loadSampleHoldMigrationSource } = require('../services/sampleHoldMigrationSource');
const MARKER = '183_sample_holds_cancellation';
const FIELDS = ['cancellationCode', 'cancellationReason', 'cancelledBy', 'cancelledAt'];
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .map(token => /^\s+$/.test(token) ? ' ' : token).join('').trim().replace(/;$/, '');
const PRISMA_HOLD_TABLE = `CREATE TABLE "SampleHold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "raisedAt" DATETIME NOT NULL,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "resolution" TEXT,
    "attributionSource" TEXT NOT NULL,
    "compatMarker" TEXT,
    CONSTRAINT "SampleHold_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`;

function classify(db, sql, sha256) {
    const differences = [];
    for (const [table, fields] of [['Sample', ['id', 'metadata', 'fieldMetadata']], ['WorkItem', ['id', 'sampleId']],
        ['_schema_migrations', ['id', 'appliedAt', 'details']]]) {
        const columns = db.prepare(`PRAGMA table_xinfo("${table}")`).all();
        for (const name of fields) if (!columns.some(column => column.name === name)) differences.push(`${table}.${name} absent`);
    }
    if (differences.length) throw fail('SAMPLE_HOLD_SCHEMA_MISMATCH', 'Install the prior workflow schema first.', differences);
    const columns = db.prepare('PRAGMA table_xinfo("WorkItem")').all();
    const present = FIELDS.map(name => {
        const column = columns.find(row => row.name === name);
        if (column && (column.type !== (name === 'cancelledAt' ? 'DATETIME' : 'TEXT') || column.notnull || column.dflt_value !== null || column.pk || column.hidden)) differences.push(`WorkItem.${name} differs`);
        return Boolean(column);
    });
    const table = db.prepare("SELECT type,sql FROM sqlite_master WHERE name='SampleHold'").get();
    const releaseTable = sql.match(/CREATE TABLE "SampleHold"[\s\S]*?\n\);/)[0];
    if (table && (table.type !== 'table' || ![normalized(releaseTable), normalized(PRISMA_HOLD_TABLE)].includes(normalized(table.sql)))) differences.push('SampleHold table differs');
    const wantedIndexes = [...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[\s\S]*?;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    const indexes = wantedIndexes.map(wanted => {
        const index = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (index && (index.type !== 'index' || normalized(index.sql).replaceAll(', ', ',') !== normalized(wanted.sql).replaceAll(', ', ','))) differences.push(`${wanted.name} differs`);
        return Boolean(index);
    });
    const wantedGuards = [...sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    if (wantedIndexes.length !== 2 || wantedGuards.length !== 4) throw fail('SAMPLE_HOLD_SOURCE_MISMATCH', 'The release requires two hold indexes and four integrity guards.');
    const guards = wantedGuards.map(wanted => {
        const guard = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (guard && (guard.type !== 'trigger' || normalized(guard.sql) !== normalized(wanted.sql))) differences.push(`${wanted.name} differs`);
        return Boolean(guard);
    });
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    if (marker) {
        let details;
        try { details = JSON.parse(marker.details); } catch { /* Refuse malformed provenance. */ }
        if (JSON.stringify(details) !== JSON.stringify({ migrationSha256: sha256 })) differences.push('Sample hold marker differs');
    }
    let classification;
    if (present.every(value => !value) && !table && indexes.every(value => !value) && guards.every(value => !value) && !marker) classification = 'PRE_183';
    else if (present.every(Boolean) && table && indexes[0] && guards.every(value => !value) && !marker) classification = 'FRESH_PRISMA';
    else if (present.every(Boolean) && table && indexes.every(Boolean) && guards.every(Boolean) && marker) classification = 'COMPLETE';
    else differences.push('Sample hold installation is partial or unmarked');
    if (differences.length) throw fail('SAMPLE_HOLD_SCHEMA_MISMATCH', 'Sample hold schema differs from the release.', differences);
    if (table) {
        const invalid = db.prepare(`SELECT id FROM SampleHold WHERE type NOT IN ('PROVENANCE','CUSTODY','CLIENT_QUERY','QC','OTHER')
            OR COALESCE(length(trim(reason)),0)=0 OR COALESCE(length(trim(raisedBy)),0)=0 OR raisedAt IS NULL
            OR attributionSource NOT IN ('KOBO_CONFLICT_AUDIT','LEGACY_HOLD_UPDATED_AT','REVIEWED_MAPPING','LIVE')
            OR (compatMarker IS NOT NULL AND (compatMarker <> 'KOBO_PROVENANCE' OR type <> 'PROVENANCE'))
            OR (attributionSource <> 'LIVE' AND COALESCE(compatMarker,'') <> 'KOBO_PROVENANCE')
            OR (resolvedAt IS NULL AND (resolvedBy IS NOT NULL OR resolution IS NOT NULL))
            OR (resolvedAt IS NOT NULL AND (COALESCE(length(trim(resolvedBy)),0)=0 OR COALESCE(length(trim(resolution)),0)=0)) ORDER BY id`).all();
        if (invalid.length) throw fail('SAMPLE_HOLD_INTEGRITY_REFUSED', 'Existing hold attribution needs review.', invalid);
        const cancellations = db.prepare(`SELECT id FROM WorkItem WHERE
            (cancellationCode IS NULL AND (cancellationReason IS NOT NULL OR cancelledBy IS NOT NULL OR cancelledAt IS NOT NULL))
            OR (cancellationCode IS NOT NULL AND (cancellationCode NOT IN ('INTAKE_UNDONE','INTAKE_REJECTED')
            OR COALESCE(length(trim(cancellationReason)),0)=0 OR COALESCE(length(trim(cancelledBy)),0)=0 OR cancelledAt IS NULL)) ORDER BY id`).all();
        if (cancellations.length) throw fail('SAMPLE_HOLD_INTEGRITY_REFUSED', 'Existing cancellation attribution needs review.', cancellations);
        if (db.prepare(`SELECT sampleId FROM SampleHold WHERE attributionSource IN ('KOBO_CONFLICT_AUDIT','LEGACY_HOLD_UPDATED_AT','REVIEWED_MAPPING') GROUP BY sampleId HAVING count(*) > 1`).all().length) throw fail('SAMPLE_HOLD_INTEGRITY_REFUSED', 'Repeated historical holds need review.');
    }
    return { classification, sources: { migrationSha256: sha256 }, guards: wantedGuards.map(row => row.name),
        counts: { workItems: db.prepare('SELECT count(*) n FROM WorkItem').get().n, holds: table ? db.prepare('SELECT count(*) n FROM SampleHold').get().n : 0 }, backfillCount: 0 };
}

function installSampleHolds({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('SAMPLE_HOLD_DATABASE_REQUIRED', 'An explicit database path is required.');
    const source = loadSampleHoldMigrationSource(), target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan;
    try { plan = reader.transaction(() => classify(reader, source.sql, source.sha256))(); }
    finally { reader.close(); }
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = classify(db, source.sql, source.sha256);
            if (locked.classification === 'COMPLETE') return { ...locked, mode: 'NO_OP', totalChanges: 0 };
            if (locked.classification === 'PRE_183') db.exec(source.sql);
            else {
                // Existing Prisma rows and schemas stay intact: add only the
                // partial unique index and exact guards missing from db push.
                if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='SampleHold_one_backfilled_per_sample'").get()) {
                    db.exec(source.indexSql);
                }
                db.exec(source.guardsSql);
            }
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify({ migrationSha256: source.sha256 }));
            const complete = classify(db, source.sql, source.sha256);
            if (complete.classification !== 'COMPLETE' || db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw fail('SAMPLE_HOLD_INTEGRITY_REFUSED', 'Sample hold installation failed integrity checks.');
            return { ...complete, previousClassification: locked.classification, mode: 'APPLIED', totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function assertSampleHoldStartupReady(dbPath) {
    if (!fs.existsSync(dbPath)) throw fail('DATABASE_NOT_FOUND', 'The lab database does not exist.');
    const result = installSampleHolds({ dbPath });
    if (result.classification !== 'COMPLETE') throw fail('SAMPLE_HOLD_NOT_INSTALLED', 'Run the reviewed sample hold installer before starting the lab.');
    return result;
}

function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (seen.has(arg)) throw fail('SAMPLE_HOLD_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('SAMPLE_HOLD_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('SAMPLE_HOLD_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    return options;
}

if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installSampleHolds(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'SAMPLE_HOLD_INSTALL_REFUSED', message: error.message, differences: error.differences || [] })}\n`); process.exitCode = 1; }
}
module.exports = { installSampleHolds, assertSampleHoldStartupReady, parseArguments };
