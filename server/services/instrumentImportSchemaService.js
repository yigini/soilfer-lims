const { createHash } = require('node:crypto');
const MARKER = '200_instrument_import_templates';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { statusCode: 409, code, differences, totalChanges: 0 });
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');

function classifyInstrumentImportSchema(db, source) {
    const differences = [], managed = ['ImportTemplate', 'InstrumentImportReceipt'];
    for (const [table, columns] of [['Lab', ['id', 'code']], ['EquipmentAsset', ['id', 'labId']], ['WorkItemDraft', ['id', 'workItemId', 'labId', 'instrumentId']]]) {
        const actual = db.prepare('SELECT type FROM sqlite_master WHERE name=?').get(table), fields = db.prepare('PRAGMA table_xinfo("' + table + '")').all();
        if (actual?.type !== 'table' || columns.some(name => !fields.some(field => field.name === name))) differences.push(table + ' prerequisite differs');
    }
    if (differences.length) throw fail('IMPORT_PREREQUISITE_REQUIRED', 'Install the prior application releases first.', differences);
    const objects = managed.map(name => ({ name, table: name, type: 'table', sql: source.freshTables[name] }));
    for (const match of source.schemaSql.matchAll(/^CREATE UNIQUE INDEX "([^"]+)" ON "([^"]+)"[^;]*;/gm)) objects.push({ name: match[1], table: match[2], type: 'index', sql: match[0] });
    for (const match of source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)) {
        const table = match[0].match(/BEFORE (?:INSERT|UPDATE|DELETE) ON "([^"]+)"/)?.[1];
        objects.push({ name: match[1], table, type: 'trigger', sql: match[0] });
    }
    if (objects.length !== 9 || objects.some(row => !row.sql || !managed.includes(row.table))) throw fail('IMPORT_SOURCE_MISMATCH', 'The import release requires exactly two tables, one index and six guards.');
    const present = objects.map(wanted => {
        const actual = db.prepare('SELECT type,tbl_name,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (actual && (actual.type !== wanted.type || actual.tbl_name !== wanted.table || normalized(actual.sql || '') !== normalized(wanted.sql))) differences.push(wanted.name + ' differs');
        return !!actual;
    });
    const names = new Set(objects.map(row => row.name));
    for (const table of managed) for (const row of db.prepare('SELECT name FROM sqlite_master WHERE tbl_name=? AND sql IS NOT NULL').all(table)) {
        if (!names.has(row.name)) differences.push(row.name + ' is not a release object');
    }
    const draft = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='WorkItemDraft'").get();
    const draftSql = normalized(draft.sql), preDraft = draftSql === normalized(source.preDraftSql), freshDraft = draftSql === normalized(source.freshTables.WorkItemDraft), upgradedDraft = draftSql === normalized(source.upgradedDraftSql);
    if (!preDraft && !freshDraft && !upgradedDraft) differences.push('WorkItemDraft differs from all captured schema variants');
    const pointer = db.prepare('PRAGMA table_xinfo(WorkItemDraft)').all().find(row => row.name === 'importReceiptId');
    if (pointer && (pointer.type !== 'TEXT' || pointer.notnull !== 0 || pointer.dflt_value !== null || pointer.pk !== 0 || pointer.hidden !== 0)) differences.push('WorkItemDraft.importReceiptId differs');
    if (pointer) {
        const foreign = db.prepare('PRAGMA foreign_key_list(WorkItemDraft)').all().find(row => row.from === 'importReceiptId');
        if (!foreign || foreign.table !== 'InstrumentImportReceipt' || foreign.to !== 'id' || foreign.on_update !== 'RESTRICT' || foreign.on_delete !== 'RESTRICT') differences.push('Draft receipt foreign key differs');
    }
    if (differences.length) throw fail('IMPORT_SCHEMA_MISMATCH', 'The import schema differs from the captured release.', differences);
    const counts = {
        templates: present[0] ? db.prepare('SELECT count(*) n FROM ImportTemplate').get().n : 0,
        receipts: present[1] ? db.prepare('SELECT count(*) n FROM InstrumentImportReceipt').get().n : 0,
        draftLinks: pointer ? db.prepare('SELECT count(*) n FROM WorkItemDraft WHERE importReceiptId IS NOT NULL').get().n : 0
    };
    const markerTable = db.prepare("SELECT type FROM sqlite_master WHERE name='_schema_migrations'").get();
    if (markerTable && (markerTable.type !== 'table' || ['id', 'appliedAt', 'details'].some(name => !db.prepare('PRAGMA table_xinfo(_schema_migrations)').all().some(row => row.name === name))))
        throw fail('IMPORT_SCHEMA_MISMATCH', 'The release receipt owner differs.');
    const marker = markerTable ? db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER) : null;
    const sources = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256, preDraftSha256: source.preDraftSha256, upgradedDraftSha256: source.upgradedDraftSha256 };
    let classification, receipt;
    if (present.every(value => !value) && preDraft && !pointer && !marker) classification = 'PRE_200';
    else if (present.slice(0, 3).every(Boolean) && present.slice(3).every(value => !value) && freshDraft && !marker && Object.values(counts).every(value => value === 0)) classification = 'FRESH_PRISMA';
    else if (present.every(Boolean) && (freshDraft || upgradedDraft) && pointer && marker) {
        try { receipt = JSON.parse(marker.details); } catch { /* Refuse unverifiable receipts. */ }
        const fields = ['sources', 'originalRowsSha256', 'originalRowsPreserved', 'newTemplateCount', 'newReceiptCount', 'backfilledCount', 'receiptSha256'];
        if (!receipt || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(fields.sort()) || JSON.stringify(receipt.sources) !== JSON.stringify(sources) ||
            !/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256) || receipt.originalRowsPreserved !== true || receipt.newTemplateCount !== 0 || receipt.newReceiptCount !== 0 || receipt.backfilledCount !== 0 ||
            receipt.receiptSha256 !== fingerprint(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptSha256'))))
            throw fail('IMPORT_SCHEMA_MISMATCH', 'The import installation receipt differs.');
        classification = 'COMPLETE_200';
    } else throw fail('IMPORT_SCHEMA_MISMATCH', 'The import installation is partial, foreign, unmarked or populated before installation.');
    return { classification, sources, counts, ...(receipt && { receipt }) };
}
module.exports = { classifyInstrumentImportSchema, MARKER, fingerprint };
