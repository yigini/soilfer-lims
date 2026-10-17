#!/usr/bin/env node
// The optional startup context must not become a default CLI/image-copy dependency.
function openReadonlyDatabase(Database, target, options, startupContext) {
    return startupContext
        ? require('../utils/startupReadinessContext').openReadonlyDatabase(Database, target, options, startupContext)
        : new Database(target, options);
}
// Claudio6160619940: existing canonical DDL only; no data writes or normalization.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { createHash } = require('node:crypto'), Database = require('better-sqlite3');
const { loadLabPolicyMigrationSource } = require('../services/labPolicyMigrationSource');
const TABLES = ['LabPolicy', 'LabPolicyOverride'];
const fail = (code, message, differences = []) => Object.assign(new Error(message), { statusCode: 409, code, differences, totalChanges: 0 });
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
// Exact Prisma-generated equivalents, observed on the real owned db-push schema.
// They are recognized without adding canonical CHECKs or the partial index.
const PRISMA_TABLES = {
    LabPolicy: `CREATE TABLE "LabPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "presetCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabPolicy_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`,
    LabPolicyOverride: `CREATE TABLE "LabPolicyOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "analysisCode" TEXT,
    "methodologyId" TEXT,
    "value" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "setBy" TEXT NOT NULL,
    "setAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    CONSTRAINT "LabPolicyOverride_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`
};
function classify(db, source) {
    const differences = [], present = TABLES.map(name => db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(name));
    const report = db.prepare('PRAGMA table_xinfo("Report")').all();
    const policyVersion = report.find(row => row.name === 'policyVersion');
    if (!report.length || !db.prepare('PRAGMA table_info("Lab")').all().some(row => row.name === 'id'))
        throw fail('LAB_POLICY_PREREQUISITE_REQUIRED', 'Existing Lab and Report storage is required.');
    if (policyVersion && (policyVersion.type !== 'INTEGER' || policyVersion.notnull !== 0 || policyVersion.pk !== 0 || policyVersion.hidden !== 0 || policyVersion.dflt_value !== null))
        differences.push('Report.policyVersion must be a nullable INTEGER without a default');
    if (present.some(Boolean) && !present.every(Boolean)) differences.push('Only one policy table exists');
    let shape;
    if (present.every(Boolean)) {
        if (!policyVersion) differences.push('Present policy storage lacks Report.policyVersion');
        const canonical = [...source.schemaSql.matchAll(/^CREATE TABLE "([^"]+)"[\s\S]*?^\);/gm)];
        const tables = Object.fromEntries(canonical.map(match => [match[1], match[0]]));
        const matches = expected => present.every((row, i) => row.type === 'table' && normalize(row.sql) === normalize(expected[TABLES[i]]));
        shape = matches(tables) ? 'CANONICAL' : matches(PRISMA_TABLES) ? 'PRISMA_EQUIVALENT' : null;
        if (!shape) differences.push('Policy table definitions differ');
        const indexes = [...source.schemaSql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)]
            .filter(match => shape !== 'PRISMA_EQUIVALENT' || match[1] !== 'LabPolicyOverride_one_current_scope');
        const expected = new Map(indexes.map(match => [match[1], normalize(match[0])]));
        const actual = db.prepare("SELECT name,type,sql FROM sqlite_master WHERE tbl_name IN (?,?) AND type<>'table' AND name NOT LIKE 'sqlite_autoindex_%'").all(...TABLES);
        if (actual.length !== expected.size || actual.some(row => row.type !== 'index' || !expected.has(row.name) || normalize(row.sql) !== expected.get(row.name)))
            differences.push('Policy indexes or additional objects differ');
    } else if (!present.some(Boolean)) {
        for (const name of ['LabPolicy_labId_key', 'LabPolicyOverride_labId_key_idx', 'LabPolicyOverride_one_current_scope'])
            if (db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(name)) differences.push(name + ' conflicts with absent policy storage');
    }
    if (differences.length) throw fail('LAB_POLICY_SCHEMA_MISMATCH', 'Policy storage is partial or differs; a human decision is required.', differences);
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length)
        throw fail('LAB_POLICY_INTEGRITY_REFUSED', 'An intact database is required.');
    const classification = present.every(Boolean) ? 'PRESENT' : 'ABSENT';
    return { classification, ...(shape && { shape }), sourceSha256: source.sha256,
        addReportPolicyVersion: classification === 'ABSENT' && !policyVersion,
        plannedSql: classification === 'ABSENT' ? (policyVersion ? source.schemaSql : source.sql) : '',
        plannedDdlCount: classification === 'ABSENT' ? (policyVersion ? 5 : 6) : 0 };
}
const quote = name => '"' + name.replaceAll('"', '""') + '"';
function fileHashes(target) {
    return Object.fromEntries(['', '-wal', '-shm'].map(suffix => {
        if (!fs.existsSync(target + suffix)) return [suffix, null];
        const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024), fd = fs.openSync(target + suffix, 'r');
        try { let length; while ((length = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, length)); }
        finally { fs.closeSync(fd); }
        return [suffix, hash.digest('hex')];
    }));
}
function reviewReadonlySnapshot(target, source, startupContext) {
    startupContext?.beforeSnapshot();
    // A normal SQLite read-only open can create WAL/SHM files. Read target files
    // only, and let SQLite open an isolated, retained copy instead. Bind all
    // three originals before/after copying and classification; never retry a race.
    const before = fileHashes(target), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lims-policy-schema-readonly-'));
    const copy = path.join(directory, 'snapshot.db');
    for (const suffix of ['', '-wal', '-shm']) if (before[suffix] !== null) fs.copyFileSync(target + suffix, copy + suffix, fs.constants.COPYFILE_EXCL);
    if (JSON.stringify(fileHashes(copy)) !== JSON.stringify(before) || JSON.stringify(fileHashes(target)) !== JSON.stringify(before))
        throw fail('LAB_POLICY_SNAPSHOT_CHANGED', 'Database files changed while retaining the read-only snapshot.');
    startupContext?.useSnapshot(copy, before);
    const reader = openReadonlyDatabase(Database, copy, { readonly: true, fileMustExist: true }, startupContext); let reviewed;
    try { reviewed = reader.transaction(() => classify(reader, source))(); } finally { reader.close(); }
    if (JSON.stringify(fileHashes(target)) !== JSON.stringify(before))
        throw fail('LAB_POLICY_SNAPSHOT_CHANGED', 'Database files changed during read-only classification.');
    return { ...reviewed, readonlySnapshot: { path: copy, originalDbWalShmSha256: before, originalFilesPreserved: true } };
}
function snapshot(db, previous) {
    const result = {};
    const tables = previous ? Object.keys(previous) : db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    for (const name of tables) {
        const columns = previous ? previous[name].columns : db.prepare('PRAGMA table_xinfo(' + quote(name) + ')').all().filter(row => row.hidden === 0).map(row => row.name);
        const selected = columns.map(quote).join(','), hash = createHash('sha256'); let rows = 0;
        for (const row of db.prepare('SELECT ' + selected + ' FROM ' + quote(name) + ' ORDER BY ' + selected).iterate()) {
            hash.update(JSON.stringify(columns.map(column => row[column])) + '\n'); rows++;
        }
        result[name] = { columns, rows, sha256: hash.digest('hex') };
    }
    return result;
}
function installLabPolicySchema({ dbPath, apply = false, startupContext} = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('LAB_POLICY_DATABASE_REQUIRED', 'Provide an explicit existing database path.');
    const target = path.resolve(dbPath), source = loadLabPolicyMigrationSource();
    if (!fs.existsSync(target)) throw fail('LAB_POLICY_DATABASE_REQUIRED', 'The explicit database file does not exist.');
    const reviewed = !apply && startupContext
        ? startupContext.reviewPolicy(target, source, fileHashes(target), () => reviewReadonlySnapshot(target, source, startupContext), fileHashes)
        : reviewReadonlySnapshot(target, source);
    if (reviewed.classification === 'PRESENT') return { ...reviewed, mode: 'NO_OP', totalChanges: 0, dataWrites: 0 };
    if (!apply) return { ...reviewed, mode: 'DRY_RUN', totalChanges: 0, dataWrites: 0 };
    // Revalidate the digest before opening a writer, then reclassify under its lock.
    const release = loadLabPolicyMigrationSource(), db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        return db.transaction(() => {
            const current = classify(db, source);
            if (current.classification === 'PRESENT') return { ...current, mode: 'NO_OP', totalChanges: 0, dataWrites: 0 };
            const before = snapshot(db);
            db.exec(current.addReportPolicyVersion ? release.sql : release.schemaSql);
            if (JSON.stringify(snapshot(db, before)) !== JSON.stringify(before) || TABLES.some(name => db.prepare('SELECT count(*) n FROM ' + quote(name)).get().n))
                throw fail('LAB_POLICY_PRESERVATION_REFUSED', 'Existing rows changed or new policy storage is populated.');
            return { ...classify(db, source), previousClassification: current.classification, mode: 'APPLIED',
                executedSql: current.plannedSql, executedDdlCount: current.plannedDdlCount, originalRowsPreserved: true,
                totalChanges: db.prepare('SELECT total_changes() n').get().n, dataWrites: 0 };
        }).immediate();
    } finally { db.close(); }
}
function assertLabPolicyStartupReady(dbPath, startupContext) {
    const result = installLabPolicySchema({ dbPath, startupContext });
    if (result.classification !== 'PRESENT') throw fail('LAB_POLICY_STARTUP_REQUIRED', 'Install the reviewed policy prerequisite before starting the lab.');
    return result;
}
function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('LAB_POLICY_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('LAB_POLICY_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('LAB_POLICY_ARGUMENT_INVALID', 'Provide --db and one mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installLabPolicySchema(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ error: error.code || 'LAB_POLICY_INSTALL_REFUSED', message: error.message, differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installLabPolicySchema, assertLabPolicyStartupReady, parseArguments };
