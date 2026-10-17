#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { loadCustodyMigrationSource } = require('../services/custodyMigrationSource');
const { RECEIPT_FIELDS } = require('../config/custodyContract');
const MARKER = '207_sample_custody';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, message, differences = []) => Object.assign(new Error(message), { statusCode: 409, code, differences, totalChanges: 0 });
const normalize = sql => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');
function recordedDate(value) {
    if (value == null || typeof value === 'string' && !value.trim()) return new Date(NaN);
    if (typeof value === 'string' && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(value)) value = value.replace(' ', 'T') + 'Z';
    return new Date(value);
}
function objects(sql) {
    return [
        ...[...sql.matchAll(/^CREATE TABLE "([^"]+)"[\s\S]*?^\);/gm)].map(m => ({ type: 'table', name: m[1], sql: m[0] })),
        ...[...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)].map(m => ({ type: 'index', name: m[1], sql: m[0] })),
        ...[...sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(m => ({ type: 'trigger', name: m[1], sql: m[0] }))
    ];
}
function classify(db, source) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length)
        throw fail('CUSTODY_INTEGRITY_REFUSED', 'An intact database is required.');
    for (const table of ['Sample', 'Consignment', 'InventoryLocation', 'SampleContainer', '_schema_migrations'])
        if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
            throw fail('CUSTODY_PREREQUISITE_REQUIRED', 'Install the prerequisite application schema.');
    const columns = [['Sample', 'retainUntil'], ['InventoryLocation', 'purpose']].map(([table, column]) =>
        db.prepare(`PRAGMA table_info("${table}")`).all().some(row => row.name === column));
    const schema = objects(source.schemaSql), guards = objects(source.guardsSql), differences = [];
    for (const [table, column, type, notnull, defaultValue] of [['Sample', 'retainUntil', 'DATETIME', 0, null], ['InventoryLocation', 'purpose', 'TEXT', 1, "'REAGENT'"]]) {
        const present = db.prepare(`PRAGMA table_info("${table}")`).all().find(row => row.name === column);
        if (present && (present.type !== type || present.notnull !== notnull || present.dflt_value !== defaultValue)) differences.push(`${table}.${column} differs`);
    }
    const check = wanted => {
        const row = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (row && (row.type !== wanted.type || normalize(row.sql) !== normalize(wanted.sql))) differences.push(`${wanted.name} differs`);
        return Boolean(row);
    };
    const schemaPresent = schema.map(check), guardsPresent = guards.map(check);
    const marker = db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
    const known = new Set([...schema, ...guards].map(row => row.name));
    for (const row of db.prepare("SELECT name FROM sqlite_master WHERE tbl_name='CustodyEvent' AND name NOT LIKE 'sqlite_autoindex_%'").all())
        if (!known.has(row.name)) differences.push(`${row.name} is not a release object`);
    let classification;
    if ([...columns, ...schemaPresent, ...guardsPresent, Boolean(marker)].every(v => !v)) classification = 'PRE_207';
    else if ([...columns, ...schemaPresent].every(Boolean) && [...guardsPresent, Boolean(marker)].every(v => !v)) {
        classification = 'FRESH_PRISMA_207';
        if (db.prepare('SELECT count(*) n FROM CustodyEvent').get().n) differences.push('Unmarked custody rows must not be adopted');
    } else if ([...columns, ...schemaPresent, ...guardsPresent, Boolean(marker)].every(Boolean)) {
        classification = 'COMPLETE_207';
        let receipt;
        try { receipt = JSON.parse(marker.details); } catch { /* Refuse invalid receipts. */ }
        if (!receipt || receipt.sourceSha256 !== source.sha256 || receipt.originalRowsPreserved !== true ||
            receipt.receiptSha256 !== hash(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptSha256'))))
            differences.push('Custody installation receipt differs');
    } else differences.push('Custody installation is partial or unmarked');
    if (differences.length) throw fail('CUSTODY_SCHEMA_MISMATCH', 'Custody storage differs from the release.', differences);
    return classification;
}
function legacyPlan(db) {
    const planned = [], deferred = [];
    for (const [table, kind, timeField] of [['Sample', 'sample', 'receptionDate'], ['Consignment', 'consignment', 'receivedAt']]) {
        for (const row of db.prepare(`SELECT * FROM "${table}" ORDER BY id`).iterate()) {
            if (!row[timeField] && !RECEIPT_FIELDS.some(key => row[key] != null && row[key] !== '')) continue;
            const date = recordedDate(row[timeField] ?? row.custodyHandoverAt);
            const labId = kind === 'sample' ? row.assignedLab : row.labId;
            if (!labId || !Number.isFinite(date.getTime())) { deferred.push({ table, id: row.id, code: 'LEGACY_CUSTODY_PROVENANCE_REQUIRED' }); continue; }
            const evidence = Object.fromEntries(RECEIPT_FIELDS.map(key => [key, row[key] ?? null]));
            if (evidence.custodyHandoverAt != null) {
                const handover = recordedDate(evidence.custodyHandoverAt);
                if (!Number.isFinite(handover.getTime())) { deferred.push({ table, id: row.id, code: 'LEGACY_CUSTODY_PROVENANCE_REQUIRED' }); continue; }
                evidence.custodyHandoverAt = handover.toISOString();
            }
            evidence.legacy = { ...Object.fromEntries(RECEIPT_FIELDS.map(key => [key, row[key] ?? null])),
                receptionData: row.receptionData ?? null, metadata: row.metadata ?? null, history: row.history ?? null };
            planned.push({ id: `legacy-207-${kind}-${row.id}`, labId, sampleId: kind === 'sample' ? row.id : null,
                consignmentId: kind === 'sample' ? row.consignmentId || null : row.id, at: date.toISOString(),
                by: row.receivedBy || row.receivingOfficerName || 'system:207-legacy-backfill', actorId: row.receivingOfficerId || null,
                counterparty: row.custodyCarrierName || null, reference: row.custodyTrackingNumber || null, evidence: JSON.stringify(evidence) });
        }
    }
    return { planned, deferred };
}
function snapshot(db) {
    const out = {};
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'CustodyEvent' ORDER BY name").all()) {
        const table = '"' + name.replaceAll('"', '""') + '"';
        const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name).filter(c =>
            !(name === 'Sample' && c === 'retainUntil' || name === 'InventoryLocation' && c === 'purpose'));
        const selected = columns.map(c => '"' + c.replaceAll('"', '""') + '"').join(',');
        const digest = createHash('sha256');
        for (const row of db.prepare(`SELECT ${selected} FROM ${table}${name === '_schema_migrations' ? ' WHERE id <> ?' : ''} ORDER BY ${selected}`).iterate(...(name === '_schema_migrations' ? [MARKER] : []))) digest.update(JSON.stringify(row) + '\n');
        out[name] = digest.digest('hex');
    }
    return hash(out);
}
function installSampleCustody({ dbPath, apply = false, startupContext } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim() || !fs.existsSync(dbPath)) throw fail('CUSTODY_DATABASE_REQUIRED', 'Provide an existing database path.');
    const target = path.resolve(dbPath), source = loadCustodyMigrationSource();
    require('./install_sample_containers').assertSampleContainerStartupReady(target, apply ? undefined : startupContext);
    const reader = startupContext && !apply
        ? require('../utils/startupReadinessContext').openReadonlyDatabase(Database, target, { readonly: true, fileMustExist: true }, startupContext)
        : new Database(target, { readonly: true, fileMustExist: true });
    let reviewed;
    try { reviewed = reader.transaction(() => { const classification = classify(reader, source); return { classification,
        plan: classification === 'COMPLETE_207' ? { planned: [], deferred: [] } : legacyPlan(reader) }; })(); } finally { reader.close(); }
    if (!apply || reviewed.classification === 'COMPLETE_207') return { classification: reviewed.classification,
        mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0, backfilledCount: reviewed.plan.planned.length, backfillSha256: hash(reviewed.plan.planned),
        deferredCount: reviewed.plan.deferred.length, deferredSha256: hash(reviewed.plan.deferred) };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const classification = classify(db, source);
            if (classification === 'COMPLETE_207') return { classification, mode: 'NO_OP', totalChanges: 0, backfilledCount: 0, deferredCount: 0, deferredSha256: hash([]) };
            const before = snapshot(db), plan = legacyPlan(db);
            if (hash(plan) !== hash(reviewed.plan)) throw fail('CUSTODY_SOURCE_CHANGED', 'Legacy custody changed after review.');
            const ddl = loadCustodyMigrationSource();
            if (classification === 'PRE_207') db.exec(ddl.sql); else db.exec(ddl.guardsSql);
            const insert = db.prepare(`INSERT INTO CustodyEvent(id,labId,sampleId,consignmentId,type,by,actorId,at,source,acknowledgement,counterparty,reference,evidence)
                VALUES(@id,@labId,@sampleId,@consignmentId,'RECEIVED',@by,@actorId,@at,'LEGACY',0,@counterparty,@reference,@evidence)`);
            for (const row of plan.planned) insert.run(row);
            if (before !== snapshot(db)) throw fail('CUSTODY_PRESERVATION_REFUSED', 'Installation changed existing evidence.');
            const receipt = { sourceSha256: source.sha256, originalRowsPreserved: true, originalRowsSha256: before,
                backfilledCount: plan.planned.length, backfillSha256: hash(plan.planned),
                deferredCount: plan.deferred.length, deferredSha256: hash(plan.deferred), deferred: plan.deferred };
            receipt.receiptSha256 = hash(receipt);
            db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER, JSON.stringify(receipt));
            if (db.pragma('foreign_key_check').length) throw fail('CUSTODY_INTEGRITY_REFUSED', 'Custody references failed integrity checks.');
            return { classification: classify(db, source), mode: 'APPLIED', backfilledCount: plan.planned.length,
                deferredCount: plan.deferred.length, deferredSha256: hash(plan.deferred), totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertSampleCustodyStartupReady(dbPath, startupContext) {
    const result = installSampleCustody({ dbPath, startupContext });
    if (result.classification !== 'COMPLETE_207') throw fail('CUSTODY_STARTUP_REQUIRED', 'Run the reviewed custody installer before starting the laboratory.');
    return result;
}
if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        if (args.length !== 3 || args[0] !== '--db' || !['--dry-run', '--apply'].includes(args[2])) throw fail('CUSTODY_ARGUMENT_INVALID', 'Use --db <path> --dry-run or --apply.');
        process.stdout.write(JSON.stringify(installSampleCustody({ dbPath: args[1], apply: args[2] === '--apply' }), null, 2) + '\n');
    } catch (error) { process.stderr.write(JSON.stringify({ code: error.code || 'CUSTODY_INSTALL_REFUSED', message: error.message, differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installSampleCustody, assertSampleCustodyStartupReady };
