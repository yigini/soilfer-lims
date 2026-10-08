#!/usr/bin/env node
const path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { inspectScopeExtension, MARKER } = require('../services/qcDispositionScopeSchemaService');
const { loadScopeMigrationSource } = require('../services/qcDispositionScopeMigrationSource');
const { loadBracketMembershipSource } = require('../services/qcBracketMembershipMigrationSource');
const fail = (code, message) => Object.assign(new Error(message), { code });

function originalFingerprint(db) {
    const columns = db.prepare('PRAGMA table_xinfo("BatchDisposition")').all().filter(row => row.name !== 'scope').map(row => row.name);
    const hash = createHash('sha256');
    for (const row of db.prepare(`SELECT ${columns.map(name => `"${name}"`).join(',')} FROM "BatchDisposition" ORDER BY id`).iterate()) {
        hash.update(JSON.stringify(row) + '\n');
    }
    return hash.digest('hex');
}

function assertIntegrity(db) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
        throw fail('QC_GATE_SCOPE_INTEGRITY_REFUSED', 'QC scope installation requires an intact database.');
    }
}

function installQcGateScope({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('QC_GATE_SCOPE_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath);
    const prior = require('./install_qc_runs').installQcRuns({ dbPath: target });
    if (prior.classification !== 'COMPLETE') throw fail('QC_GATE_SCOPE_PRIOR_REQUIRED', 'Install normalized QC runs first.');
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let planned, count, fingerprint;
    try {
        reader.transaction(() => {
            assertIntegrity(reader); planned = inspectScopeExtension(reader);
            count = reader.prepare('SELECT COUNT(*) n FROM "BatchDisposition"').get().n;
            fingerprint = originalFingerprint(reader);
        })();
    } finally { reader.close(); }
    const summary = { classification: planned.classification, migrationSha256: planned.source.sha256,
        membershipMigrationSha256: planned.membership.sha256, membershipGuardSha256: planned.membership.guardSha256,
        supersededMembershipGuardSha256: planned.membership.supersededGuardSha256,
        existingDispositionRows: count, originalDispositionFingerprint: fingerprint, backfillCount: 0, bootstrapRebuild: [], totalChanges: 0 };
    if (planned.classification === 'COMPLETE' || !apply) return { ...summary,
        mode: apply ? 'NO_OP' : 'DRY_RUN', ...(planned.receipt && { receipt: planned.receipt }) };
    if (!['PRE_187', 'FRESH_PRISMA'].includes(planned.classification)) throw fail('QC_GATE_SCOPE_SCHEMA_MISMATCH', 'QC scope schema is unexpected.');
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    const source = loadScopeMigrationSource();
    const membership = loadBracketMembershipSource();
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            assertIntegrity(db);
            const locked = inspectScopeExtension(db);
            if (locked.classification !== planned.classification || originalFingerprint(db) !== fingerprint) throw fail('QC_GATE_SCOPE_PLAN_STALE', 'QC disposition evidence changed after planning.');
            db.exec(locked.hasScope ? source.guardsSql : source.sql);
            db.exec(membership.sql);
            if (originalFingerprint(db) !== fingerprint || db.prepare('SELECT COUNT(*) n FROM "BatchDisposition" WHERE "scope" IS NOT NULL').get().n) {
                throw fail('QC_GATE_SCOPE_INTEGRITY_REFUSED', 'Existing disposition evidence must remain unchanged with NULL scope.');
            }
            const receipt = { migrationSha256: locked.source.sha256, existingDispositionRows: count,
                membershipMigrationSha256: membership.sha256, membershipGuardSha256: membership.guardSha256,
                supersededMembershipGuardSha256: membership.supersededGuardSha256,
                originalDispositionFingerprint: fingerprint, backfillCount: 0, bootstrapRebuild: [] };
            db.prepare('INSERT INTO "_schema_migrations" (id, appliedAt, details) VALUES (?, CURRENT_TIMESTAMP, ?)').run(MARKER, JSON.stringify(receipt));
            const installed = inspectScopeExtension(db); assertIntegrity(db);
            if (installed.classification !== 'COMPLETE') throw fail('QC_GATE_SCOPE_SCHEMA_MISMATCH', 'QC scope installation did not complete.');
            return { ...summary, classification: 'COMPLETE', mode: 'APPLIED', receipt, totalChanges: 1 };
        }).immediate();
    } finally { db.close(); }
}

function assertQcGateScopeStartupReady(dbPath) {
    const outcome = installQcGateScope({ dbPath });
    if (outcome.classification !== 'COMPLETE') throw fail('QC_GATE_SCOPE_NOT_INSTALLED', 'Install the reviewed QC scope guards before startup.');
    return outcome;
}

function parseArguments(args) {
    const parsed = { dbPath: process.env.DATABASE_PATH, apply: false };
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--db' && args[index + 1]) parsed.dbPath = args[++index];
        else if (args[index] === '--apply') parsed.apply = true;
        else if (args[index] === '--dry-run') parsed.apply = false;
        else throw fail('QC_GATE_SCOPE_ARGUMENT_INVALID', 'Use --db <path> [--dry-run|--apply].');
    }
    return parsed;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installQcGateScope(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ code: error.code, error: error.message })}\n`); process.exitCode = 1; }
}
module.exports = { installQcGateScope, assertQcGateScopeStartupReady, parseArguments };
