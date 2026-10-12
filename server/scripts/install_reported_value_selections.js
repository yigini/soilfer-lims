#!/usr/bin/env node
const path = require('node:path'), Database = require('better-sqlite3');
const { loadReportedValueMigrationSource } = require('../services/reportedValueMigrationSource');
const { normalize } = require('../services/workRepeatInstallationEvidence');
const { fingerprintRetainedTables } = require('../services/retainedRowsFingerprint');
const MARKER = '192_reported_value_selection';
const fail = (message, differences = []) => Object.assign(new Error(message), { code: 'REPORTED_VALUE_SCHEMA_MISMATCH', differences, totalChanges: 0 });
function releaseObjects(source) {
    const objects = [{ name: 'ReportedValueSelection', type: 'table', sql: source.schemaSql.match(/CREATE TABLE "ReportedValueSelection" \([\s\S]*?\n\);/)?.[0] },
        ...[...source.sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[\s\S]*?;/gm)].map(match => ({ name: match[1], type: 'index', sql: match[0] })),
        ...[...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?\bEND;/gm)].map(match => ({ name: match[1], type: 'trigger', sql: match[0] }))];
    if (objects.length !== 8 || objects.some(row => !row.sql)) throw fail('Reported-value release objects are incomplete.');
    return objects;
}
function classify(db, source) {
    const objects = releaseObjects(source), differences = [];
    const actual = objects.map(wanted => {
        const row = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (row && (row.type !== wanted.type || normalize(row.sql) !== normalize(wanted.sql))) differences.push(wanted.name + ' differs');
        return !!row;
    });
    const permitted = new Set(objects.map(row => row.name));
    for (const row of db.prepare("SELECT name FROM sqlite_master WHERE tbl_name='ReportedValueSelection' AND sql IS NOT NULL").all()) {
        if (!permitted.has(row.name)) differences.push(row.name + ' is not a release object');
    }
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    let classification;
    if (!actual.some(Boolean) && !marker) classification = 'PRE_192';
    else if (actual.slice(0,4).every(Boolean) && !actual.slice(4).some(Boolean) && !marker &&
        db.prepare('SELECT count(*) n FROM "ReportedValueSelection"').get().n === 0) classification = 'FRESH_PRISMA';
    else if (actual.every(Boolean) && marker) {
        let receipt; try { receipt = JSON.parse(marker.details); } catch { /* Refuse damaged evidence. */ }
        if (receipt?.migrationSha256 !== source.sha256 || receipt?.predecessorReceiptSha256 !==
            JSON.parse(db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get('191_repeat_correction_contract').details).receiptSha256 ||
            !/^[a-f0-9]{64}$/.test(receipt?.retainedRowsSha256 || '') || receipt?.newSelectionCount !== 0) differences.push('Reported-value receipt differs');
        classification = 'COMPLETE';
    } else differences.push('Reported-value installation is partial or unmarked');
    if (differences.length) throw fail('Reported-value schema differs from the release.', differences);
    return { classification, migrationSha256: source.sha256 };
}
function retained(db) {
    return fingerprintRetainedTables(db, { excludeTables: ['ReportedValueSelection'] });
}
function installReportedValueSelections({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('An explicit database path is required.');
    const target = path.resolve(dbPath), source = loadReportedValueMigrationSource();
    const predecessor = require('./install_work_repeat_contract').assertWorkRepeatStartupReady(target);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let before; try { before = reader.transaction(() => classify(reader, source))(); } finally { reader.close(); }
    if (!apply || before.classification === 'COMPLETE') return { ...before, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0, newSelectionCount: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = classify(db, source);
            if (current.classification === 'COMPLETE') return { ...current, mode: 'NO_OP', totalChanges: 0, newSelectionCount: 0 };
            const saved = retained(db);
            const installationSql = loadReportedValueMigrationSource();
            if (current.classification === 'PRE_192') db.exec(installationSql.schemaSql);
            db.exec(installationSql.guardsSql);
            if (retained(db) !== saved) throw fail('Reported-value installation changed retained rows.');
            db.prepare('INSERT INTO "_schema_migrations"(id,details) VALUES (?,?)').run(MARKER, JSON.stringify({ migrationSha256: source.sha256,
                predecessorReceiptSha256: predecessor.receipt.receiptSha256, retainedRowsSha256: saved, newSelectionCount: 0 }));
            const after = classify(db, source);
            if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw fail('Reported-value installation failed integrity checks.');
            return { ...after, mode: 'APPLIED', previousClassification: current.classification, newSelectionCount: 0,
                totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertReportedValueStartupReady(dbPath) {
    const current = installReportedValueSelections({ dbPath });
    if (current.classification !== 'COMPLETE') throw Object.assign(new Error('Install reviewed reported-value evidence before startup.'), { code: 'REPORTED_VALUE_NOT_INSTALLED' });
    return current;
}
function parseArguments(args) {
    const options = {}, seen = new Set();
    for (let i=0;i<args.length;i++) {
        const arg=args[i]; if (seen.has(arg)) throw fail('Repeated argument.'); seen.add(arg);
        if (arg==='--db' && args[i+1] && !args[i+1].startsWith('--')) options.dbPath=args[++i];
        else if (arg==='--apply') options.apply=true;
        else if (arg!=='--dry-run') throw fail('Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('Provide --db and one execution mode.');
    return options;
}
if (require.main===module) {
    try { process.stdout.write(JSON.stringify(installReportedValueSelections(parseArguments(process.argv.slice(2))),null,2)+'\n'); }
    catch(error) { process.stderr.write(JSON.stringify({ error:error.code || 'REPORTED_VALUE_INSTALL_REFUSED', message:error.message,
        differences:error.differences || [], totalChanges:0 })+'\n'); process.exitCode=1; }
}
module.exports = { installReportedValueSelections, assertReportedValueStartupReady, parseArguments };
