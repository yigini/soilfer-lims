#!/usr/bin/env node
// Schema-only owner of the unchanged #180 DDL. Backfill remains a separate command.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { loadSampleCodeMigrationSource } = require('../services/sampleCodeMigrationSource');
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, statusCode: 409, differences, totalChanges: 0 });
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
// Exact Prisma-generated equivalent; existing counters never gain or lose CHECKs.
const PRISMA_SEQUENCE = `CREATE TABLE "LabSequence" (
    "labId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY ("labId", "scope", "year")
)`;
function classify(db, source) {
    for (const table of ['Sample', 'WorkItem', 'Lab']) {
        const found = db.prepare('SELECT name,type FROM sqlite_master WHERE name=? COLLATE NOCASE').get(table);
        if (found?.type !== 'table' || found.name !== table ||
            !db.prepare('PRAGMA table_info("' + table + '")').all().some(row => row.name === 'id'))
            throw fail('SAMPLE_CODE_SCHEMA_PREREQUISITE_REQUIRED', 'Existing Sample, WorkItem and Lab storage is required.');
    }
    const sample = db.prepare('PRAGMA table_xinfo("Sample")').all().find(row => row.name.toLowerCase() === 'labsamplecode');
    const work = db.prepare('PRAGMA table_xinfo("WorkItem")').all().find(row => row.name.toLowerCase() === 'legacylabid');
    const index = db.prepare("SELECT type,tbl_name,sql FROM sqlite_master WHERE name='Sample_labSampleCode_key' COLLATE NOCASE").get();
    const sequence = db.prepare("SELECT type,sql FROM sqlite_master WHERE name='LabSequence' COLLATE NOCASE").get();
    const presence = [sample, work, index, sequence].map(Boolean), differences = [];
    if (presence.some(Boolean) && !presence.every(Boolean)) differences.push('Atomic sample-code storage is partial');
    for (const [name, column] of [['Sample.labSampleCode', sample], ['WorkItem.legacyLabId', work]]) {
        if (column && (column.type !== 'TEXT' || column.notnull !== 0 || column.pk !== 0 || column.hidden !== 0 || column.dflt_value !== null))
            differences.push(name + ' must be nullable TEXT without a default');
        if (column) {
            const [table, field] = name.split('.'), ddl = db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(table).sql;
            const declaration = ddl.match(new RegExp('(?:\\(|,)\\s*"' + field + '"\\s+([^,)]*)'))?.[1].trim();
            if (column.name !== field || declaration !== 'TEXT' || (ddl.match(new RegExp('\\b' + field + '\\b', 'gi')) || []).length !== 1)
                differences.push(name + ' has an unreviewed declaration or constraint');
        }
    }
    const expectedIndex = source.sql.match(/^CREATE UNIQUE INDEX [^;]+;/m)?.[0];
    const expectedSequence = source.sql.match(/^CREATE TABLE "LabSequence"[\s\S]*?^\);/m)?.[0];
    if (!expectedIndex || !expectedSequence) throw fail('SAMPLE_CODE_SCHEMA_SOURCE_MISMATCH', 'Approved sample-code object list differs.');
    if (index && (index.type !== 'index' || index.tbl_name !== 'Sample' || normalize(index.sql) !== normalize(expectedIndex)))
        differences.push('Sample code uniqueness differs');
    let shape;
    if (sequence) {
        shape = sequence.type === 'table' && normalize(sequence.sql) === normalize(expectedSequence) ? 'CANONICAL'
            : sequence.type === 'table' && normalize(sequence.sql) === normalize(PRISMA_SEQUENCE) ? 'PRISMA_EQUIVALENT' : null;
        if (!shape) differences.push('LabSequence definition differs');
    }
    if (db.prepare("SELECT name FROM sqlite_master WHERE tbl_name='LabSequence' AND name<>'LabSequence' AND name NOT LIKE 'sqlite_autoindex_%'").all().length)
        differences.push('LabSequence contains additional objects');
    if (differences.length) throw fail('SAMPLE_CODE_SCHEMA_MISMATCH', 'Sample-code storage is partial or modified.', differences);
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length)
        throw fail('SAMPLE_CODE_SCHEMA_INTEGRITY_REFUSED', 'An intact database is required.');
    return { classification: presence.every(Boolean) ? 'COMPLETE' : 'ABSENT', ...(shape && { shape }), sourceSha256: source.sha256 };
}
const quote = name => '"' + name.replaceAll('"', '""') + '"';
function snapshot(db, prior) {
    const tables = {}, names = prior ? Object.keys(prior.tables) : db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    for (const name of names) {
        const shape = db.prepare('PRAGMA table_xinfo(' + quote(name) + ')').all();
        const columns = prior ? prior.tables[name].columns.map(row => row.name) : shape.filter(row => row.hidden === 0).map(row => row.name);
        const hash = createHash('sha256'), selected = columns.map(quote).join(','); let count = 0;
        for (const row of db.prepare('SELECT ' + selected + ' FROM ' + quote(name) + ' ORDER BY ' + selected).iterate()) {
            hash.update(JSON.stringify(columns.map(column => row[column])) + '\n'); count++;
        }
        tables[name] = { columns: shape.filter(row => columns.includes(row.name)),
            foreignKeys: db.prepare('PRAGMA foreign_key_list(' + quote(name) + ')').all(), count, sha256: hash.digest('hex') };
    }
    const objects = prior ? prior.objects.map(row => db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name=?').get(row.name))
        : db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND NOT(type='table' AND name IN ('Sample','WorkItem')) ORDER BY type,name").all();
    return { tables, objects };
}
function fileHashes(target) {
    return Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix, fs.existsSync(target + suffix)
        ? createHash('sha256').update(fs.readFileSync(target + suffix)).digest('hex') : null]));
}
function review(target, source, startupContext) {
    if (startupContext) {
        const reader = require('../utils/startupReadinessContext').openReadonlyDatabase(Database, target, { readonly: true, fileMustExist: true }, startupContext);
        try { return reader.transaction(() => classify(reader, source))(); } finally { reader.close(); }
    }
    // SQLite read-only opens can create WAL/SHM files. Review a retained copy instead.
    const before = fileHashes(target), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lims-sample-code-schema-readonly-'));
    const copy = path.join(directory, 'snapshot.db');
    for (const suffix of ['', '-wal', '-shm']) if (before[suffix] !== null) fs.copyFileSync(target + suffix, copy + suffix, fs.constants.COPYFILE_EXCL);
    if (JSON.stringify(fileHashes(copy)) !== JSON.stringify(before) || JSON.stringify(fileHashes(target)) !== JSON.stringify(before))
        throw fail('SAMPLE_CODE_SCHEMA_SNAPSHOT_CHANGED', 'Database files changed while retaining the read-only snapshot.');
    const reader = new Database(copy, { readonly: true, fileMustExist: true }); let result;
    try { result = reader.transaction(() => classify(reader, source))(); } finally { reader.close(); }
    if (JSON.stringify(fileHashes(target)) !== JSON.stringify(before))
        throw fail('SAMPLE_CODE_SCHEMA_SNAPSHOT_CHANGED', 'Database files changed during read-only review.');
    return { ...result, readonlySnapshot: { path: copy, originalDbWalShmSha256: before, originalFilesPreserved: true } };
}
function installSampleCodeSchema({ dbPath, apply = false, startupContext } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim() || !fs.existsSync(dbPath))
        throw fail('SAMPLE_CODE_SCHEMA_DATABASE_REQUIRED', 'Provide an explicit existing database path.');
    const target = path.resolve(dbPath), source = loadSampleCodeMigrationSource(), reviewed = review(target, source, apply ? undefined : startupContext);
    if (reviewed.classification === 'COMPLETE') return { ...reviewed, mode: 'NO_OP', totalChanges: 0, dataWrites: 0, backfilledCount: 0 };
    if (!apply) return { ...reviewed, mode: 'DRY_RUN', totalChanges: 0, dataWrites: 0, backfilledCount: 0 };
    const release = loadSampleCodeMigrationSource(), db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const current = classify(db, source);
            if (current.classification === 'COMPLETE') return { ...current, mode: 'NO_OP', totalChanges: 0, dataWrites: 0, backfilledCount: 0 };
            const before = snapshot(db);
            db.exec(release.sql);
            const complete = classify(db, source), totalChanges = db.prepare('SELECT total_changes() n').get().n;
            if (JSON.stringify(snapshot(db, before)) !== JSON.stringify(before) || db.prepare('SELECT count(*) n FROM LabSequence').get().n !== 0 || totalChanges !== 0)
                throw fail('SAMPLE_CODE_SCHEMA_PRESERVATION_REFUSED', 'Existing rows, objects or receipts changed, or sequence storage was populated.');
            return { ...complete, previousClassification: current.classification, mode: 'APPLIED', executedDdlCount: 4,
                originalRowsPreserved: true, originalReceiptsPreserved: true, newSequenceCount: 0, totalChanges, dataWrites: 0, backfilledCount: 0 };
        }).immediate();
    } finally { db.close(); }
}
function assertSampleCodeStartupReady(dbPath, startupContext) {
    const result = installSampleCodeSchema({ dbPath, startupContext });
    if (result.classification !== 'COMPLETE') throw fail('SAMPLE_CODE_SCHEMA_STARTUP_REQUIRED', 'Install the reviewed sample-code schema before starting the lab.');
    return result;
}
function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('SAMPLE_CODE_SCHEMA_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('SAMPLE_CODE_SCHEMA_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath?.trim() || seen.has('--apply') && seen.has('--dry-run')) throw fail('SAMPLE_CODE_SCHEMA_ARGUMENT_INVALID', 'Provide --db and one mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installSampleCodeSchema(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ error: error.code || 'SAMPLE_CODE_SCHEMA_INSTALL_REFUSED', message: error.message, differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installSampleCodeSchema, assertSampleCodeStartupReady, parseArguments };
