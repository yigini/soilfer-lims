#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { loadReferenceMaterialMigrationSource } = require('../services/referenceMaterialMigrationSource');
const MARKER = '184_reference_material_catalogue';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|\s+|[^\s'"`\[]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');

function classify(db, source) {
    const differences = [];
    for (const [table, fields] of [['BatchQcResult', ['id', 'batchId', 'type']], ['Batch', ['id', 'labId', 'analysis']],
        ['Lab', ['id', 'code']], ['InventoryLot', ['id', 'labId']], ['Analysis', ['code']], ['Methodology', ['id', 'analysisCode']],
        ['Unit', ['code']], ['AuditLog', ['id', 'entity', 'action', 'details']], ['_schema_migrations', ['id', 'appliedAt', 'details']]]) {
        const columns = db.prepare(`PRAGMA table_xinfo("${table}")`).all();
        for (const name of fields) if (!columns.some(column => column.name === name)) differences.push(`${table}.${name} absent`);
    }
    if (differences.length) throw fail('REFERENCE_SCHEMA_MISMATCH', 'Install the prior application schema first.', differences);
    const tables = ['ReferenceMaterial', 'ReferenceValue'].map(name => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(name);
        const additive = source.sql.match(new RegExp(`CREATE TABLE "${name}" \\([\\s\\S]*?\\n\\);`))?.[0];
        if (actual && (actual.type !== 'table' || ![additive, source.freshTables[name]].some(sql => sql && normalized(sql) === normalized(actual.sql)))) differences.push(`${name} definition differs`);
        return Boolean(actual);
    });
    const columns = db.prepare('PRAGMA table_xinfo("BatchQcResult")').all();
    const fks = db.prepare('PRAGMA foreign_key_list("BatchQcResult")').all();
    const links = ['referenceMaterialId', 'referenceValueId'].map((name, index) => {
        const column = columns.find(row => row.name === name);
        const target = ['ReferenceMaterial', 'ReferenceValue'][index];
        if (column && (column.type !== 'TEXT' || column.notnull || column.dflt_value !== null || column.pk || column.hidden ||
            !fks.some(row => row.from === name && row.table === target && row.to === 'id' && row.on_delete === 'RESTRICT' && row.on_update === 'CASCADE'))) differences.push(`BatchQcResult.${name} definition differs`);
        return Boolean(column);
    });
    const indexes = [...source.sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[\s\S]*?;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    const guards = [...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    if (indexes.length !== 4 || guards.length !== 7) throw fail('REFERENCE_SOURCE_MISMATCH', 'Reference release must contain four indexes and seven guards.');
    function present(wanted, type) {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (actual && (actual.type !== type || normalized(actual.sql) !== normalized(wanted.sql))) differences.push(`${wanted.name} differs`);
        return Boolean(actual);
    }
    const installedIndexes = indexes.map(row => present(row, 'index')), installedGuards = guards.map(row => present(row, 'trigger'));
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    const receipt = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256 };
    if (marker) {
        let details;
        try { details = JSON.parse(marker.details); } catch { /* Refuse malformed receipts. */ }
        if (JSON.stringify(details) !== JSON.stringify(receipt)) differences.push('Reference migration marker differs');
    }
    let classification;
    if ([...tables, ...links, ...installedIndexes, ...installedGuards, Boolean(marker)].every(value => !value)) classification = 'PRE_184';
    else if ([...tables, ...links, ...installedIndexes.slice(0, 2)].every(Boolean) &&
        [...installedIndexes.slice(2), ...installedGuards, Boolean(marker)].every(value => !value)) classification = 'FRESH_PRISMA';
    else if ([...tables, ...links, ...installedIndexes, ...installedGuards, Boolean(marker)].every(Boolean)) classification = 'COMPLETE';
    else differences.push('Reference installation is partial or unmarked');
    if (differences.length) throw fail('REFERENCE_SCHEMA_MISMATCH', 'Reference schema differs from the release.', differences);
    const invalidSupersessions = tables.every(Boolean) ? db.prepare(`SELECT old.id,old.supersededById FROM "ReferenceValue" old
        LEFT JOIN "ReferenceValue" replacement ON replacement.id=old.supersededById WHERE old.supersededById IS NOT NULL AND
        (replacement.id IS NULL OR replacement.id=old.id OR replacement.referenceMaterialId IS NOT old.referenceMaterialId OR replacement.analysisCode IS NOT old.analysisCode)
        ORDER BY old.id`).all() : [];
    const invalidLinks = links.every(Boolean) ? db.prepare(`SELECT q.id FROM "BatchQcResult" q LEFT JOIN "ReferenceValue" v ON v.id=q.referenceValueId
        LEFT JOIN "ReferenceMaterial" r ON r.id=q.referenceMaterialId LEFT JOIN "Batch" b ON b.id=q.batchId LEFT JOIN "Lab" lab ON lab.id=r.labId
        WHERE (q.referenceMaterialId IS NULL) != (q.referenceValueId IS NULL) OR (q.referenceMaterialId IS NOT NULL AND
        (q.type<>'CONTROL' OR v.id IS NULL OR r.id IS NULL OR v.referenceMaterialId IS NOT r.id OR v.analysisCode IS NOT b.analysis OR
        b.labId IS NULL OR b.labId NOT IN (lab.id,lab.code))) ORDER BY q.id`).all() : [];
    if (invalidSupersessions.length || invalidLinks.length) throw fail('REFERENCE_INTEGRITY_REFUSED', 'Existing reference links need review.',
        [...invalidSupersessions.map(row => ({ type: 'SUPERSESSION', ...row })), ...invalidLinks.map(row => ({ type: 'QC_LINK', ...row }))]);
    return { classification, sources: receipt, guards: guards.map(row => row.name), indexes: indexes.map(row => row.name),
        counts: { materials: tables[0] ? db.prepare('SELECT COUNT(*) n FROM "ReferenceMaterial"').get().n : 0,
            values: tables[1] ? db.prepare('SELECT COUNT(*) n FROM "ReferenceValue"').get().n : 0,
            qcRows: db.prepare('SELECT COUNT(*) n FROM "BatchQcResult"').get().n,
            linked: links.every(Boolean) ? db.prepare('SELECT COUNT(*) n FROM "BatchQcResult" WHERE referenceValueId IS NOT NULL').get().n : 0 }, backfillCount: 0 };
}

function installReferenceMaterials({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('REFERENCE_DATABASE_REQUIRED', 'An explicit database path is required.');
    const source = loadReferenceMaterialMigrationSource(), target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan;
    try { plan = reader.transaction(() => classify(reader, { sql: source.sql, sha256: source.sha256,
        oracleSha256: source.oracleSha256, freshTables: source.freshTables }))(); }
    finally { reader.close(); }
    if (!apply || plan.classification === 'COMPLETE') return { ...plan, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = classify(db, { sql: source.sql, sha256: source.sha256, oracleSha256: source.oracleSha256, freshTables: source.freshTables });
            if (locked.classification === 'COMPLETE') return { ...locked, mode: 'NO_OP', totalChanges: 0 };
            db.exec(locked.classification === 'PRE_184' ? source.sql : source.guardsSql);
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify(locked.sources));
            const complete = classify(db, { sql: source.sql, sha256: source.sha256, oracleSha256: source.oracleSha256, freshTables: source.freshTables });
            if (complete.classification !== 'COMPLETE' || db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw fail('REFERENCE_INTEGRITY_REFUSED', 'Reference installation failed integrity checks.');
            return { ...complete, previousClassification: locked.classification, mode: 'APPLIED', totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function assertReferenceStartupReady(dbPath) {
    if (!fs.existsSync(dbPath)) throw fail('DATABASE_NOT_FOUND', 'The lab database does not exist.');
    const outcome = installReferenceMaterials({ dbPath });
    if (outcome.classification !== 'COMPLETE') throw fail('REFERENCE_NOT_INSTALLED', 'Run the reviewed reference material installer before starting the lab.');
    return outcome;
}
function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('REFERENCE_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[index + 1] && !args[index + 1].startsWith('--')) options.dbPath = args[++index];
        else throw fail('REFERENCE_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('REFERENCE_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installReferenceMaterials(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'REFERENCE_INSTALL_REFUSED', message: error.message, differences: error.differences || [] })}\n`); process.exitCode = 1; }
}
module.exports = { installReferenceMaterials, assertReferenceStartupReady, parseArguments };
