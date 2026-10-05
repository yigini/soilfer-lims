#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const { loadWorkflowMigrationSources, evidenceCreates } = require('../services/workflowMigrationSources');
const MARKER = '179_workflow_state_guards';
const markerSql = `CREATE TABLE "_schema_migrations" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT
);`;

function refusal(code, message, differences = []) {
    return Object.assign(new Error(message), { code, differences });
}

// Preserve quoted identifiers and literals; only formatting whitespace may differ.
function normalizedSql(sql) {
    return (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|\s+|[^\s'"`\[]+/g) || [])
        .map(token => /^\s+$/.test(token) ? ' ' : token).join('').trim();
}

function columns(db, table) {
    return db.prepare(`PRAGMA table_xinfo("${table}")`).all()
        .map(({ cid, ...column }) => column);
}

function foreignKeys(db, table) {
    return db.prepare(`PRAGMA foreign_key_list("${table}")`).all().map(({ id, ...fk }) => fk)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function indexes(db, table) {
    return db.prepare(`PRAGMA index_list("${table}")`).all().map(({ seq, ...index }) => ({ ...index,
        columns: db.prepare(`PRAGMA index_xinfo("${index.name}")`).all() }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function sourceShape() {
    // SQLite itself interprets the exact new table/index DDL. No application
    // table, fixture row or invented historical schema is needed for this oracle.
    const reference = new Database(':memory:');
    try {
        const sources = loadWorkflowMigrationSources();
        reference.exec(evidenceCreates(sources.evidence.sql));
        reference.exec(markerSql);
        const triggers = [...sources.guards.sql.matchAll(/CREATE TRIGGER "([^"]+)"[\s\S]*?END;/g)]
            .map(match => ({ name: match[1], sql: normalizedSql(match[0].slice(0, -1)) }));
        if (triggers.length !== 11) throw refusal('WORKFLOW_GUARDS_SOURCE_MISMATCH', 'The release must contain exactly 11 guards.');
        return { evidenceColumns: columns(reference, 'ResultEvidenceEvent'),
            evidenceFks: foreignKeys(reference, 'ResultEvidenceEvent'), evidenceIndexes: indexes(reference, 'ResultEvidenceEvent'),
            markerColumns: columns(reference, '_schema_migrations'), triggers };
    } finally { reference.close(); }
}

function preflight(db) {
    // The same reviewed-plan inventory is used here, without backfilling any row.
    const { buildReport } = require('../services/statusMigrationService');
    const read = table => {
        const present = columns(db, table).some(column => column.name === 'legacyStatus');
        return db.prepare(`SELECT id,status,updatedAt,${present ? 'legacyStatus' : 'NULL AS legacyStatus'}${table === 'WorkItem' ? ',version' : ''} FROM "${table}" ORDER BY id`).all();
    };
    const report = buildReport(read('Sample'), read('WorkItem'));
    return { totals: report.totals, candidateCount: report.candidateCount, unmappedCount: report.unmappedCount,
        blockedCount: report.blockedCount, fingerprint: report.fingerprint };
}

function classify(db, evidenceSql, guardsSql, evidenceSha256, guardsSha256, expected) {
    const differences = [], equal = (object, actual, wanted) => {
        if (JSON.stringify(actual) !== JSON.stringify(wanted)) differences.push({ object, expected: wanted, actual });
    };
    const additions = [];
    for (const table of ['Sample', 'WorkItem', 'Batch', 'ReviewDecision', 'Result']) {
        const object = db.prepare('SELECT type FROM sqlite_master WHERE name=?').get(table);
        if (object?.type !== 'table') differences.push({ object: table, expected: 'table', actual: object?.type || 'absent' });
    }
    for (const table of ['Sample', 'WorkItem']) for (const name of ['holdPriorStatus', 'legacyStatus']) {
        const actual = columns(db, table).find(column => column.name === name);
        additions.push(!!actual);
        if (actual) equal(`${table}.${name}`, actual,
            { name, type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 });
    }
    const evidenceObject = db.prepare('SELECT type FROM sqlite_master WHERE name=?').get('ResultEvidenceEvent');
    const evidencePresent = !!evidenceObject;
    if (evidencePresent) {
        equal('ResultEvidenceEvent.type', evidenceObject.type, 'table');
        equal('ResultEvidenceEvent.columns', columns(db, 'ResultEvidenceEvent'), expected.evidenceColumns);
        equal('ResultEvidenceEvent.foreignKeys', foreignKeys(db, 'ResultEvidenceEvent'), expected.evidenceFks);
        equal('ResultEvidenceEvent.indexes', indexes(db, 'ResultEvidenceEvent'), expected.evidenceIndexes);
    }
    const guardPresence = expected.triggers.map(trigger => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').all(trigger.name);
        if (actual.length) equal(trigger.name, actual.map(row => ({ type: row.type, sql: normalizedSql(row.sql || '') })),
            [{ type: 'trigger', sql: trigger.sql }]);
        return actual.length > 0;
    });
    const markerObject = db.prepare('SELECT type FROM sqlite_master WHERE name=?').get('_schema_migrations');
    let marker = null;
    if (markerObject) {
        equal('_schema_migrations.type', markerObject.type, 'table');
        equal('_schema_migrations.columns', columns(db, '_schema_migrations'), expected.markerColumns);
        if (!differences.some(item => item.object.startsWith('_schema_migrations'))) {
            marker = db.prepare('SELECT * FROM "_schema_migrations" WHERE id=?').get(MARKER) || null;
            if (marker) {
                let details;
                try { details = JSON.parse(marker.details); } catch { details = null; }
                equal(`${MARKER}.details`, details && Object.keys(details), ['evidenceSha256', 'guardsSha256']);
                equal(`${MARKER}.evidenceSha256`, details?.evidenceSha256, evidenceSha256);
                equal(`${MARKER}.guardsSha256`, details?.guardsSha256, guardsSha256);
            }
        }
    }
    let classification;
    if (additions.every(value => !value) && !evidencePresent && guardPresence.every(value => !value) && !marker) {
        classification = 'PRE_179';
    } else if (additions.every(Boolean) && evidencePresent && guardPresence.every(value => !value) && !marker) {
        classification = 'FRESH_PRISMA';
    } else if (additions.every(Boolean) && evidencePresent && guardPresence.every(Boolean) && marker) {
        classification = 'COMPLETE';
    } else {
        differences.push({ object: 'workflow schema', additions, evidencePresent, guardPresence, markerPresent: !!marker,
            message: additions.every(Boolean) && evidencePresent && guardPresence.every(Boolean) && !marker
                ? 'The objects match the source but the marker is absent.' : 'The workflow installation is partial or inconsistent.' });
    }
    if (differences.length) throw refusal('WORKFLOW_GUARDS_SCHEMA_MISMATCH', 'The workflow schema differs from the release.', differences);
    const inventory = preflight(db);
    const markerDetails = JSON.stringify({ evidenceSha256, guardsSha256 });
    const statements = classification === 'COMPLETE' ? [] : [
        ...(classification === 'PRE_179' ? [evidenceSql] : []), guardsSql,
        ...(!markerObject ? [markerSql] : []),
        { sql: 'INSERT INTO "_schema_migrations" ("id","details") VALUES (?,?)', parameters: [MARKER, markerDetails] }
    ];
    return { classification, inventory, statements, sources: { evidenceSha256, guardsSha256 } };
}

function assertReviewedStatusPlan({ classification, inventory }, reviewedStatusSha256) {
    const pending = [inventory.candidateCount, inventory.unmappedCount, inventory.blockedCount].some(count => count > 0);
    if (classification === 'COMPLETE' && pending) {
        throw refusal('WORKFLOW_STATUS_PLAN_PENDING', 'Complete the separately reviewed legacy-status plan before starting the lab.', [inventory]);
    }
    if (classification !== 'COMPLETE' && (inventory.unmappedCount > 0 || inventory.blockedCount > 0 ||
        (inventory.candidateCount > 0 && !reviewedStatusSha256))) {
        throw refusal('WORKFLOW_STATUS_PLAN_REQUIRED', 'Review the separate legacy-status plan before installing workflow guards.', [inventory]);
    }
    if (classification !== 'COMPLETE' && reviewedStatusSha256 && inventory.fingerprint !== reviewedStatusSha256) {
        throw refusal('WORKFLOW_STATUS_PLAN_STALE', 'The reviewed legacy-status plan changed; run and review a new dry run.', [inventory]);
    }
}

function postflight(db, expected) {
    const counts = Object.fromEntries(['Sample', 'WorkItem', 'Result', 'ReviewDecision', 'ResultEvidenceEvent']
        .map(table => [table, db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n]));
    return { counts, integrity: db.pragma('integrity_check', { simple: true }), foreignKeyViolations: db.pragma('foreign_key_check'),
        guards: expected.triggers.map(({ name }) => name), marker: db.prepare('SELECT * FROM "_schema_migrations" WHERE id=?').get(MARKER) };
}

function installWorkflowStateGuards({ dbPath, apply = false, reviewedStatusSha256 } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw refusal('WORKFLOW_GUARDS_DATABASE_REQUIRED', 'An explicit database path is required.');
    if (reviewedStatusSha256 !== undefined && (!apply || !/^[a-f0-9]{64}$/.test(reviewedStatusSha256))) {
        throw refusal('WORKFLOW_GUARDS_ARGUMENT_INVALID', '--reviewed-status-sha256 requires --apply and an exact 64-hex reviewed fingerprint.');
    }
    // Validate both release sources before opening even a read-only connection.
    const sources = loadWorkflowMigrationSources(), expected = sourceShape();
    const target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true, timeout: 5000 });
    let plan;
    try { plan = reader.transaction(() => classify(reader, sources.evidence.sql, sources.guards.sql, sources.evidence.sha256, sources.guards.sha256, expected))(); }
    finally { reader.close(); }
    if (apply) assertReviewedStatusPlan(plan, reviewedStatusSha256);
    if (!apply || plan.classification === 'COMPLETE') {
        const observer = new Database(target, { readonly: true, fileMustExist: true });
        try { return { mode: apply ? 'NO_OP' : 'DRY_RUN', ...plan,
            totalChanges: observer.prepare('SELECT total_changes() AS n').get().n,
            ...(plan.classification === 'COMPLETE' && { postflight: postflight(observer, expected) }) }; }
        finally { observer.close(); }
    }
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        return db.transaction(() => {
            // Reclassify and reread statuses while holding the writer lock. A
            // concurrent partial upgrade or legacy write never leaves half a schema.
            const locked = classify(db, sources.evidence.sql, sources.guards.sql, sources.evidence.sha256, sources.guards.sha256, expected);
            assertReviewedStatusPlan(locked, reviewedStatusSha256);
            if (locked.classification === 'PRE_179') db.exec(sources.evidence.sql);
            if (locked.classification !== 'COMPLETE') {
                db.exec(sources.guards.sql);
                if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_schema_migrations'").get()) db.exec(markerSql);
                db.prepare('INSERT INTO "_schema_migrations" ("id","details") VALUES (?,?)')
                    .run(MARKER, JSON.stringify({ evidenceSha256: sources.evidence.sha256, guardsSha256: sources.guards.sha256 }));
            }
            // A reviewed one-off schema installation intentionally precedes
            // mapping. Validate its schema now; normal startup will independently
            // refuse the pending plan until the unchanged status CLI completes it.
            const complete = classify(db, sources.evidence.sql, sources.guards.sql, sources.evidence.sha256, sources.guards.sha256, expected);
            if (complete.classification !== 'COMPLETE') throw refusal('WORKFLOW_GUARDS_SCHEMA_MISMATCH', 'The postflight schema is incomplete.');
            const evidence = postflight(db, expected);
            if (evidence.integrity !== 'ok' || evidence.foreignKeyViolations.length) {
                throw refusal('WORKFLOW_GUARDS_INTEGRITY_REFUSED', 'Workflow schema integrity checks failed.', [evidence]);
            }
            return { mode: locked.classification === 'COMPLETE' ? 'NO_OP' : 'APPLIED', ...locked,
                totalChanges: db.prepare('SELECT total_changes() AS n').get().n, postflight: evidence };
        }).immediate();
    } finally { db.close(); }
}

function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false };
    const seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw refusal('WORKFLOW_GUARDS_ARGUMENT_INVALID', `Repeated argument: ${arg}`);
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[index + 1] && !args[index + 1].startsWith('--')) options.dbPath = args[++index];
        else if (arg === '--reviewed-status-sha256' && args[index + 1] && !args[index + 1].startsWith('--')) options.reviewedStatusSha256 = args[++index];
        else throw refusal('WORKFLOW_GUARDS_ARGUMENT_INVALID', `Unknown or incomplete argument: ${arg}`);
    }
    if (options.apply && seen.has('--dry-run')) throw refusal('WORKFLOW_GUARDS_ARGUMENT_INVALID', '--apply and --dry-run are mutually exclusive.');
    if (options.reviewedStatusSha256 !== undefined && (!options.apply || !/^[a-f0-9]{64}$/.test(options.reviewedStatusSha256))) {
        throw refusal('WORKFLOW_GUARDS_ARGUMENT_INVALID', '--reviewed-status-sha256 requires --apply and an exact 64-hex reviewed fingerprint.');
    }
    return options;
}

// #179 pin 5992946755: the app process never installs a schema. Reuse the
// installer's read-only classification and inventory, then require COMPLETE.
function assertWorkflowStartupReady(dbPath) {
    if (!fs.existsSync(dbPath)) throw refusal('DATABASE_NOT_FOUND',
        'The database does not exist. Set DATABASE_PATH to the existing lab file and follow the reviewed setup procedure.');
    const plan = installWorkflowStateGuards({ dbPath });
    if (plan.classification !== 'COMPLETE') throw refusal('WORKFLOW_GUARDS_NOT_INSTALLED',
        'Run node scripts/install_workflow_state_guards.js --apply, or the reviewed legacy-status upgrade procedure when candidates exist.');
    assertReviewedStatusPlan(plan);
    return { classification: plan.classification, inventory: plan.inventory, totalChanges: plan.totalChanges };
}

if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installWorkflowStateGuards(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) {
        process.stderr.write(`${JSON.stringify({ error: error.code || 'WORKFLOW_GUARDS_INSTALL_REFUSED', message: error.message,
            differences: error.differences || [] })}\n`);
        process.exitCode = 1;
    }
}

module.exports = { MARKER, installWorkflowStateGuards, parseArguments, assertWorkflowStartupReady };
