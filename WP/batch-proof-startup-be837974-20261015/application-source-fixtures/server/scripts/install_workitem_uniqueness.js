#!/usr/bin/env node
const path = require('node:path');
const Database = require('better-sqlite3');
const { createHash } = require('node:crypto');
const { loadWorkItemDuplicateMarkerSource, loadActiveWorkItemIndexSource } = require('../services/workItemUniquenessMigrationSource');

const MARKER_ID = '20261004190000_add_workitem_duplicate_marker';
const INDEX_ID = '20261004190100_unique_active_workitem';
const INDEX_NAME = 'WorkItem_one_active_per_analysis';
const fail = (code, message, report) => Object.assign(new Error(message), { code, report });
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');

function tableExists(db, table) {
    return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

// Stream every existing row/column, including analytical, QC and audit tables.
// The ledger alone gains two rows. WorkItem's original columns stay identical.
function preservation(db) {
    return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'_schema_migrations' ORDER BY name").all()
        .map(({ name }) => {
            const quote = value => '"' + value.replaceAll('"', '""') + '"';
            const columns = db.prepare(`PRAGMA table_xinfo(${quote(name)})`).all()
                .filter(row => !row.hidden && !(name === 'WorkItem' && row.name === 'duplicateOf')).map(row => row.name);
            const hash = createHash('sha256');
            let count = 0;
            hash.update(JSON.stringify(columns));
            for (const row of db.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(name)} ORDER BY rowid`).iterate()) {
                hash.update('\n'); hash.update(JSON.stringify(row)); count++;
            }
            return { table: name, columns, count, sha256: hash.digest('hex') };
        });
}

function classifyDuplicateMarkerPrerequisite(db) {
    const markerSource = loadWorkItemDuplicateMarkerSource();
    const indexSource = loadActiveWorkItemIndexSource();
    const sources = [
        { id: MARKER_ID, sqlSha256: markerSource.sha256 },
        { id: INDEX_ID, sqlSha256: indexSource.sha256 }
    ];
    const differences = [], columns = db.prepare('PRAGMA table_xinfo("WorkItem")').all();
    if (!['id', 'sampleId', 'analysis'].every(name => columns.some(row => row.name === name))) {
        return { classification: 'FOREIGN', sources, differences: ['Required WorkItem columns absent'],
            workItemCount: null, duplicateGroupCount: null, duplicateGroups: [] };
    }
    const column = columns.find(row => row.name === 'duplicateOf');
    const allKeys = db.prepare('PRAGMA foreign_key_list("WorkItem")').all();
    const keys = allKeys.filter(row => row.from === 'duplicateOf');
    if (column && (column.type !== 'TEXT' || column.notnull || column.dflt_value !== null || column.pk || column.hidden)) {
        differences.push('WorkItem.duplicateOf definition differs');
    }
    if (column && (keys.length !== 1 || keys[0].table !== 'WorkItem' || keys[0].to !== 'id' ||
        keys[0].on_delete !== 'RESTRICT' || keys[0].on_update !== 'CASCADE' || keys[0].seq !== 0 || keys[0].match !== 'NONE' ||
        allKeys.filter(row => row.id === keys[0].id).length !== 1)) {
        differences.push('WorkItem.duplicateOf RESTRICT self-FK differs');
    }
    if (!column && keys.length) differences.push('Duplicate-marker FK without its column');
    const index = db.prepare('SELECT type,tbl_name,sql FROM sqlite_master WHERE name=?').get(INDEX_NAME);
    const expectedIndex = indexSource.sql.match(/CREATE UNIQUE INDEX[\s\S]*?;/g);
    if (expectedIndex?.length !== 1) throw fail('WORKITEM_PREREQUISITE_SOURCE_MISMATCH', 'Expected one exact active-owner index.');
    if (index && (index.type !== 'index' || index.tbl_name !== 'WorkItem' || normalize(index.sql) !== normalize(expectedIndex[0]))) {
        differences.push('Active WorkItem index definition differs');
    }
    const ledger = tableExists(db, '_schema_migrations');
    const ledgerColumns = db.prepare('PRAGMA table_xinfo("_schema_migrations")').all();
    const ledgerReady = ledger && ['id', 'appliedAt', 'details'].every(name => ledgerColumns.some(row => row.name === name));
    if (ledger && !ledgerReady) differences.push('Migration ledger definition differs');
    const receipts = ledgerReady ? sources.map(source => db.prepare('SELECT id,details FROM "_schema_migrations" WHERE id=?').get(source.id)) : [null, null];
    receipts.forEach((receipt, number) => {
        if (!receipt) return;
        let details;
        try { details = JSON.parse(receipt.details); } catch (_) { /* Foreign provenance is never repaired. */ }
        if (details?.sqlSha256 !== sources[number].sqlSha256) differences.push(`${sources[number].id} receipt source differs`);
        if (number === 0 ? !column : !index) differences.push(`${sources[number].id} receipt has no object`);
    });
    const workItemCount = db.prepare('SELECT count(*) n FROM "WorkItem"').get().n;
    const duplicateGroups = db.prepare(`SELECT sampleId,analysis FROM "WorkItem" ${column ? 'WHERE duplicateOf IS NULL' : ''}
        GROUP BY sampleId,analysis HAVING count(*)>1 ORDER BY sampleId,analysis`).all().map(group => ({ ...group,
        workItemIds: db.prepare(`SELECT id FROM "WorkItem" WHERE sampleId IS ? AND analysis IS ? ${column ? 'AND duplicateOf IS NULL' : ''} ORDER BY id`)
            .all(group.sampleId, group.analysis).map(row => row.id) }));
    const emptyExecutionTables = ['WorkItem', 'Result', 'WorkAttempt'].every(table =>
        tableExists(db, table) && db.prepare(`SELECT count(*) n FROM "${table}"`).get().n === 0);
    let classification;
    if (differences.length) classification = 'FOREIGN';
    else if (!column && !index && receipts.every(row => !row)) classification = 'ABSENT';
    else if (column && index && receipts.every(Boolean)) classification = 'COMPLETE';
    else if (column && !index && receipts.every(row => !row) && emptyExecutionTables) classification = 'FRESH_PRISMA';
    else classification = 'PARTIAL';
    return { classification, sources, workItemCount, duplicateGroupCount: duplicateGroups.length, duplicateGroups,
        differences, ledgerReady, executionTablesEmpty: emptyExecutionTables };
}

function installWorkItemUniqueness({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('WORKITEM_PREREQUISITE_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath), reader = new Database(target, { readonly: true, fileMustExist: true });
    let before;
    try { before = reader.transaction(() => classifyDuplicateMarkerPrerequisite(reader))(); }
    finally { reader.close(); }
    if (!apply || before.classification === 'COMPLETE') return { ...before, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const refuse = report => {
        if (!['ABSENT', 'FRESH_PRISMA'].includes(report.classification) || !report.ledgerReady) {
            throw fail('WORKITEM_PREREQUISITE_SCHEMA_MISMATCH', 'Duplicate-marker prerequisite is partial, foreign or lacks the prior migration ledger.', report);
        }
        if (report.duplicateGroupCount) throw fail('WORKITEM_PREREQUISITE_DUPLICATES', 'A manager must resolve the reported duplicate WorkItems.', report);
    };
    refuse(before);
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = classifyDuplicateMarkerPrerequisite(db);
            if (current.classification === 'COMPLETE') return { ...current, mode: 'NO_OP', totalChanges: 0 };
            refuse(current);
            const retained = preservation(db), oldReceipts = db.prepare('SELECT * FROM "_schema_migrations" ORDER BY id').all();
            const markerSource = loadWorkItemDuplicateMarkerSource();
            const indexSource = loadActiveWorkItemIndexSource();
            if (current.classification === 'ABSENT') db.exec(markerSource.sql);
            db.exec(indexSource.sql);
            const afterRows = preservation(db);
            if (JSON.stringify(retained) !== JSON.stringify(afterRows) ||
                db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('WORKITEM_PREREQUISITE_PRESERVATION_REFUSED', 'Duplicate-marker prerequisite changed retained evidence.', current);
            }
            const preservationEvidence = { before: retained, after: afterRows, originalRowsAndFieldsPreserved: true };
            for (const source of current.sources) {
                const marker = source.id === MARKER_ID;
                const receipt = { sqlSha256: source.sqlSha256, classification: current.classification,
                    mode: marker && current.classification === 'FRESH_PRISMA' ? 'FRESH_PRISMA_BOOTSTRAP' : 'APPLIED',
                    sourceExecuted: !marker || current.classification === 'ABSENT',
                    ...(marker && current.classification === 'FRESH_PRISMA' && { columnAndForeignKeyVerified: true }),
                    workItemCount: current.workItemCount, duplicateGroupCount: current.duplicateGroupCount,
                    duplicateGroups: current.duplicateGroups, sources: current.sources, preservation: preservationEvidence };
                db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(source.id, JSON.stringify(receipt));
            }
            const preservedReceipts = db.prepare('SELECT * FROM "_schema_migrations" WHERE id NOT IN (?,?) ORDER BY id').all(MARKER_ID, INDEX_ID);
            if (JSON.stringify(oldReceipts) !== JSON.stringify(preservedReceipts)) {
                throw fail('WORKITEM_PREREQUISITE_PRESERVATION_REFUSED', 'An existing migration receipt changed.', current);
            }
            const after = classifyDuplicateMarkerPrerequisite(db);
            if (after.classification !== 'COMPLETE') throw fail('WORKITEM_PREREQUISITE_SCHEMA_MISMATCH', 'Prerequisite did not finish COMPLETE.', after);
            return { ...after, previousClassification: current.classification, mode: 'APPLIED', preservation: preservationEvidence,
                receiptsInserted: 2, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function assertWorkItemUniquenessStartupReady(dbPath) {
    const report = installWorkItemUniqueness({ dbPath });
    if (report.classification !== 'COMPLETE') throw fail('WORKITEM_PREREQUISITE_NOT_INSTALLED', 'Install the duplicate-marker prerequisite before startup.', report);
    return report;
}

function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('WORKITEM_PREREQUISITE_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[index + 1] && !args[index + 1].startsWith('--')) options.dbPath = args[++index];
        else throw fail('WORKITEM_PREREQUISITE_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('WORKITEM_PREREQUISITE_ARGUMENT_INVALID', 'Provide --db and one execution mode.');
    return options;
}

if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installWorkItemUniqueness(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) {
        process.stderr.write(JSON.stringify({ error: error.code || 'WORKITEM_PREREQUISITE_INSTALL_REFUSED', message: error.message,
            ...(error.report && { report: error.report }) }) + '\n'); process.exitCode = 1;
    }
}
module.exports = { installWorkItemUniqueness, classifyDuplicateMarkerPrerequisite, assertWorkItemUniquenessStartupReady,
    parseArguments, MARKER_ID, INDEX_ID };
