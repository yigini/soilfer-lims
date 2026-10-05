const fs = require('node:fs');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');

const variants = ['PRE_1_1_DUPLICATES', 'CONSIGNMENT_PRE_1_1_A', 'CONSIGNMENT_PRE_1_1_B'];
function schema(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        const objects = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
        const columns = objects.filter(row => row.type === 'table').map(row => ({ table: row.name,
            columns: db.prepare(`PRAGMA table_xinfo("${row.name.replace(/"/g, '""')}")`).all() }));
        return { objects, columns };
    } finally { db.close(); }
}

describe('Audit 1.2: pinned historical rehearsals retain production migration order semantics', () => {
    test.each(variants)('%s has identical tables, columns, indexes and guards in both migration orders', schemaVariant => {
        const real = beforeGuards({ actor: 'system:fixture', schemaVariant, migrationOrder: 'REAL' });
        const rehearsal = beforeGuards({ actor: 'system:fixture', schemaVariant });
        try {
            expect(real.pendingMigrations).toEqual([]);
            expect(rehearsal.pendingMigrations).toEqual([schemaVariant === 'PRE_1_1_DUPLICATES' ? 'INDEX' : 'DECLARATION']);
            rehearsal.applyPendingMigration();
            expect(schema(rehearsal.file)).toEqual(schema(real.file));
            expect(schema(real.file).objects.filter(row => row.type === 'trigger')).toHaveLength(11);
        } finally { rehearsal.close(); real.close(); }
    });
    test('the literal full baseline is the exact deployed pre-1.1 schema pinned by the author', () => {
        const bytes = fs.readFileSync(require.resolve('../helpers/fixtures/pre11_full_application_schema.sql'));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe('ff776730ff70102f018c3a02af76534ada332f2f4484600bde069b45c92f0513');
        expect(bytes.toString('utf8')).not.toMatch(/duplicateOf|WorkItem_one_active_per_analysis|declaredExpectedCount/);
    });
    test('an unknown variant is rejected before creating a database', () => {
        expect(() => beforeGuards({ actor: 'system:fixture', schemaVariant: 'INVENTED_SCHEMA' })).toThrow('Unknown pinned historical schema variant.');
    });
    test('teardown fails and discards an unaccounted pending migration', () => {
        const rehearsal = beforeGuards({ actor: 'system:fixture', schemaVariant: 'CONSIGNMENT_PRE_1_1_A' });
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
