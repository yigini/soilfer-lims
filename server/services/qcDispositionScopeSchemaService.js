const { loadScopeMigrationSource } = require('./qcDispositionScopeMigrationSource');
const MARKER = '187_qc_gate_scope';
const fail = message => Object.assign(new Error(message), { code: 'QC_GATE_SCOPE_SCHEMA_MISMATCH' });
const normalized = value => (value.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');

function inspectScopeExtension(db) {
    const actual = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='BatchDisposition'").get();
    if (!actual) return { hasScope: false, classification: 'ABSENT', baseSql: null };
    const columns = db.prepare('PRAGMA table_xinfo("BatchDisposition")').all(), scope = columns.find(row => row.name === 'scope');
    const source = loadScopeMigrationSource();
    const prior = require('./qcRunMigrationSource').loadQcRunMigrationSource();
    const allowed = new Set([...prior.sql.matchAll(/^CREATE (?:UNIQUE )?(?:INDEX|TRIGGER) "([^"]+)"[^\n]* ON "BatchDisposition"/gm)].map(match => match[1]));
    source.guards.forEach(row => allowed.add(row.name));
    const objects = db.prepare("SELECT name FROM sqlite_master WHERE tbl_name='BatchDisposition' AND sql IS NOT NULL AND type IN ('index','trigger')").all();
    if (objects.some(row => !allowed.has(row.name))) throw fail('QC disposition has an unexpected schema object.');
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    const guards = source.guards.map(wanted => {
        const row = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (row && (row.type !== 'trigger' || normalized(row.sql) !== normalized(wanted.sql))) throw fail('QC scope guard differs.');
        return Boolean(row);
    });
    if (!scope) {
        if (marker || guards.some(Boolean)) throw fail('QC scope installation is partial.');
        return { hasScope: false, classification: 'PRE_187', baseSql: actual.sql, source };
    }
    if (scope.type !== 'TEXT' || scope.notnull || scope.dflt_value !== null || scope.pk || scope.hidden) throw fail('QC scope column differs.');
    // Both Prisma (before constraints) and SQLite ALTER (after constraints)
    // have exactly one nullable TEXT field; remove only that exact addition.
    const expression = /,\s*"scope"\s+TEXT(?=\s*[,)])/g;
    if ([...actual.sql.matchAll(expression)].length !== 1) throw fail('QC scope table definition differs.');
    const baseSql = actual.sql.replace(expression, '');
    const populatedScopes = db.prepare('SELECT COUNT(*) n FROM "BatchDisposition" WHERE "scope" IS NOT NULL').get().n;
    const invalidScopes = db.prepare(`SELECT COUNT(*) n FROM "BatchDisposition" WHERE "scope" IS NOT NULL AND
        CASE WHEN json_valid("scope") THEN json_type("scope") <> 'object' ELSE 1 END`).get().n;
    if (invalidScopes) throw fail('QC disposition has invalid scope evidence.');
    if (!marker && guards.every(value => !value) && !populatedScopes) return { hasScope: true, classification: 'FRESH_PRISMA', baseSql, source };
    let receipt;
    try { receipt = JSON.parse(marker?.details); } catch (_) { /* fail below */ }
    if (!guards.every(Boolean) || receipt?.migrationSha256 !== source.sha256 || !Array.isArray(receipt.bootstrapRebuild) ||
        receipt.bootstrapRebuild.length || receipt.backfillCount !== 0 || !/^[a-f0-9]{64}$/.test(receipt.originalDispositionFingerprint || '') ||
        !Number.isSafeInteger(receipt.existingDispositionRows) || receipt.existingDispositionRows < 0) throw fail('QC scope receipt/guards differ.');
    return { hasScope: true, classification: 'COMPLETE', baseSql, source, receipt };
}

module.exports = { inspectScopeExtension, loadScopeMigrationSource, MARKER };
