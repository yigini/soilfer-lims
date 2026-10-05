const fs = require('node:fs');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');

const variants = ['PRE_1_1_DUPLICATES', 'CONSIGNMENT_PRE_1_1_A', 'CONSIGNMENT_PRE_1_1_B', 'PROJECT_PRE_TEMPLATE_POLICY', 'PRE_1_3_SAMPLE_CODES'];
// #179 pin 5990137651: production order is the reference. Only these literal
// appended-column permutations are allowed; every base column stays ordered.
const appendedOrders = {
    Sample: { real: ['labSampleCode', 'holdPriorStatus', 'legacyStatus'], rehearsal: ['holdPriorStatus', 'legacyStatus', 'labSampleCode'] },
    WorkItem: { real: ['legacyLabId', 'duplicateOf', 'holdPriorStatus', 'legacyStatus'], rehearsal: ['duplicateOf', 'holdPriorStatus', 'legacyStatus', 'legacyLabId'] }
};
function schema(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        const objects = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') ORDER BY type,name").all();
        const columns = objects.filter(row => row.type === 'table').map(row => ({ table: row.name,
            columns: db.prepare(`PRAGMA table_xinfo("${row.name.replace(/"/g, '""')}")`).all() }));
        const foreignKeys = objects.filter(row => row.type === 'table').map(row => ({ table: row.name,
            keys: db.prepare(`PRAGMA foreign_key_list("${row.name.replace(/"/g, '""')}")`).all() }));
        return { objects, columns, foreignKeys };
    } finally { db.close(); }
}

describe('Audit 1.2: pinned historical rehearsals retain production migration order semantics', () => {
    test.each(variants)('%s has identical tables, columns, indexes and guards in both migration orders', schemaVariant => {
        const real = beforeGuards({ actor: 'system:fixture', schemaVariant, migrationOrder: 'REAL' });
        const rehearsal = beforeGuards({ actor: 'system:fixture', schemaVariant });
        try {
            expect(real.pendingMigrations).toEqual([]);
            expect(rehearsal.pendingMigrations).toEqual([schemaVariant === 'PRE_1_1_DUPLICATES' ? 'INDEX'
                : schemaVariant === 'PROJECT_PRE_TEMPLATE_POLICY' ? 'PROJECT_POLICY' : schemaVariant === 'PRE_1_3_SAMPLE_CODES' ? 'SAMPLE_CODES' : 'DECLARATION']);
            rehearsal.applyPendingMigration();
            const actual = schema(rehearsal.file), reference = schema(real.file);
            if (schemaVariant === 'PRE_1_3_SAMPLE_CODES') {
                const baseline = new Database(':memory:');
                try {
                    baseline.exec(fs.readFileSync(require.resolve('../helpers/fixtures/pre13_full_application_schema.sql'), 'utf8'));
                    for (const [table, order] of Object.entries(appendedOrders)) {
                        const prefix = baseline.prepare(`PRAGMA table_xinfo("${table}")`).all().map(row => row.name);
                        const realColumns = reference.columns.find(row => row.table === table).columns;
                        const rehearsalColumns = actual.columns.find(row => row.table === table).columns;
                        expect(realColumns.map(row => row.name)).toEqual([...prefix, ...order.real]);
                        expect(rehearsalColumns.map(row => row.name)).toEqual([...prefix, ...order.rehearsal]);
                        const byName = rows => rows.map(({ cid, ...row }) => row).sort((a, b) => a.name.localeCompare(b.name));
                        expect(byName(rehearsalColumns)).toEqual(byName(realColumns));
                    }
                    // Keep base DDL and every other object byte-exact. Removing
                    // only the literal appended TEXT declarations also catches
                    // constraint drift that a PRAGMA column comparison misses.
                    const normalize = object => {
                        const order = object.type === 'table' && appendedOrders[object.name];
                        return order ? { ...object, sql: object.sql.replace(new RegExp(`, "(?:${order.real.join('|')})" TEXT`, 'g'), '') } : object;
                    };
                    expect(actual.objects.map(normalize)).toEqual(reference.objects.map(normalize));
                    expect(actual.columns.filter(row => !appendedOrders[row.table])).toEqual(reference.columns.filter(row => !appendedOrders[row.table]));
                    expect(actual.foreignKeys).toEqual(reference.foreignKeys);
                } finally { baseline.close(); }
            } else expect(actual).toEqual(reference);
            expect(schema(real.file).objects.filter(row => row.type === 'trigger')).toHaveLength(11);
        } finally { rehearsal.close(); real.close(); }
    });
    test('the literal full baseline is the exact deployed pre-1.1 schema pinned by the author', () => {
        const bytes = fs.readFileSync(require.resolve('../helpers/fixtures/pre11_full_application_schema.sql'));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe('ff776730ff70102f018c3a02af76534ada332f2f4484600bde069b45c92f0513');
        expect(bytes.toString('utf8')).not.toMatch(/duplicateOf|WorkItem_one_active_per_analysis|declaredExpectedCount/);
    });
    test('the pre-1.3 baseline is the unchanged deployed v1.6.1 schema', () => {
        const bytes = fs.readFileSync(require.resolve('../helpers/fixtures/pre13_full_application_schema.sql'));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe('7727cd04e0bb7ba7da66e54f49a3a9e53cc64f61be390c9d68efdec3e40284c8');
        expect(bytes.toString('utf8')).not.toMatch(/labSampleCode|legacyLabId|LabSequence/);
    });
    test('an unknown variant is rejected before creating a database', () => {
        expect(() => beforeGuards({ actor: 'system:fixture', schemaVariant: 'INVENTED_SCHEMA' })).toThrow('Unknown pinned historical schema variant.');
    });
    test.each(['CONSIGNMENT_PRE_1_1_A', 'PROJECT_PRE_TEMPLATE_POLICY', 'PRE_1_3_SAMPLE_CODES'])('teardown fails and discards an unaccounted %s migration', schemaVariant => {
        const rehearsal = beforeGuards({ actor: 'system:fixture', schemaVariant });
        expect(() => rehearsal.close()).toThrow('unaccounted pending migration');
        expect(fs.existsSync(rehearsal.file)).toBe(false);
    });
    test('pending migration cannot run against another rehearsal or accept an arbitrary expected error', () => {
        const first = beforeGuards({ actor: 'system:fixture', schemaVariant: 'CONSIGNMENT_PRE_1_1_A' });
        const second = beforeGuards({ actor: 'system:fixture', schemaVariant: 'CONSIGNMENT_PRE_1_1_B' });
        const other = new Database(second.file);
        try {
            expect(() => first.applyPendingMigration({ connection: other })).toThrow('owned writable rehearsal');
            expect(() => first.applyPendingMigration({ expectedFailure: 'ANY_ERROR' })).toThrow('exact unresolved duplicate-index refusal');
            first.applyPendingMigration(); second.applyPendingMigration();
        } finally { other.close(); first.close(); second.close(); }
    });
});
