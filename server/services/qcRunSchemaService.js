const MARKER = '186_normalized_qc_runs';
const TABLES = Object.freeze(['BatchAnalyte', 'BatchPosition', 'BatchPositionWorkItem', 'BatchPositionReference',
    'QcMeasurement', 'QcEvaluation', 'BatchDisposition', 'BatchEvent']);
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, differences });
const normalized = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|\s+|[^\s'"`\[]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
function validBackfillCounts(counts) {
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return false;
    const grouped = { legacyDispositionMapped: ['REJECT_REANALYSIS', 'ACCEPT_OPAQUE'],
        dispositionAttribution: ['AUDIT_LOG', 'BATCH_DISPOSITION_FIELD', 'SNAPSHOT_DISPOSITION_FIELD'] };
    const nonnegative = count => Number.isInteger(count) && count >= 0;
    if (!Object.entries(grouped).every(([name, keys]) => {
        const value = counts[name];
        return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length &&
            keys.every(key => Object.hasOwn(value, key) && nonnegative(value[key]));
    })) return false;
    return Object.entries(counts).every(([name, count]) => Object.hasOwn(grouped, name) || nonnegative(count));
}

function classifyQcRunSchema(db, source) {
    const differences = [], bootstrapRebuild = [];
    for (const [table, fields] of [['Batch', ['id', 'labId', 'analysis', 'qcResults', 'workItemIds', 'disposition', 'history']],
        ['BatchQcResult', ['id', 'batchId', 'type', 'referenceMaterialId', 'referenceValueId']],
        ['WorkItem', ['id', 'sampleId', 'analysis', 'methodologyId', 'batchId', 'rackPosition']], ['Sample', ['id']],
        ['User', ['username']], ['EquipmentAsset', ['id']], ['Methodology', ['id', 'analysisCode']],
        ['ReferenceMaterial', ['id']], ['ReferenceValue', ['id']], ['QcRule', ['id', 'version']],
        ['AuditLog', ['id', 'entity', 'entityId', 'action', 'details']], ['_schema_migrations', ['id', 'appliedAt', 'details']]]) {
        const columns = db.prepare(`PRAGMA table_xinfo("${table}")`).all();
        for (const field of fields) if (!columns.some(column => column.name === field)) differences.push(`${table}.${field} absent`);
    }
    if (differences.length) throw fail('QC_RUN_SCHEMA_MISMATCH', 'Install the prior application schema first.', differences);
    const tables = TABLES.map(name => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(name);
        if (name === 'BatchDisposition' && actual?.type === 'table') {
            // #187 parts 2–3: recognize only its reviewed nullable column and
            // exact guards/receipt. Its separate startup gate rejects pending
            // installation; all #186 DDL, digests and receipts stay unchanged.
            actual.sql = require('./qcDispositionScopeSchemaService').inspectScopeExtension(db).baseSql;
        }
        const wanted = source.sql.match(new RegExp(`CREATE TABLE "${name}" \\([\\s\\S]*?\\n\\);`))?.[0];
        // #186 part 19: Prisma cannot emit deferred FKs. Only these two exact
        // self-FK clauses may differ by this suffix; all other DDL is exact.
        const deferred = { QcMeasurement: 'QcMeasurement_supersededById_fkey', BatchPositionReference: 'BatchPositionReference_supersededById_fkey' };
        const clause = deferred[name] && `CONSTRAINT "${deferred[name]}" FOREIGN KEY ("supersededById") REFERENCES "${name}" ("id") ON DELETE RESTRICT ON UPDATE CASCADE`;
        const deferredClause = clause && `${clause} DEFERRABLE INITIALLY DEFERRED`;
        const comparable = deferredClause && wanted?.includes(deferredClause) ? wanted.replace(deferredClause, clause) : wanted;
        if (!wanted || clause && !wanted.includes(deferredClause) || normalized(comparable) !== normalized(source.freshTables[name] || '')) {
            throw fail('QC_RUN_SOURCE_MISMATCH', 'Normalized QC tables differ from the fresh Prisma oracle.');
        }
        if (actual && (actual.type !== 'table' || normalized(actual.sql) !== normalized(wanted))) {
            if (clause && actual.type === 'table' && normalized(actual.sql) === normalized(comparable)) bootstrapRebuild.push(name);
            else differences.push(`${name} definition differs`);
        }
        return Boolean(actual);
    });
    const batchColumns = db.prepare('PRAGMA table_xinfo("Batch")').all(), batchFks = db.prepare('PRAGMA foreign_key_list("Batch")').all();
    const columns = [['instrumentId', 'TEXT', 'EquipmentAsset', 'id'], ['analystUsername', 'TEXT', 'User', 'username'],
        ['startedAt', 'DATETIME'], ['completedAt', 'DATETIME']].map(([name, type, table, target]) => {
        const column = batchColumns.find(row => row.name === name);
        if (column && (column.type !== type || column.notnull || column.dflt_value !== null || column.pk || column.hidden ||
            (table && !batchFks.some(row => row.from === name && row.table === table && row.to === target && row.on_delete === 'RESTRICT' && row.on_update === 'CASCADE')))) differences.push(`Batch.${name} definition differs`);
        return Boolean(column);
    });
    const indexes = [...source.sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[\s\S]*?;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    const guards = [...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], sql: match[0] }));
    if (indexes.length !== 14 || guards.length !== 47) throw fail('QC_RUN_SOURCE_MISMATCH', 'Normalized QC release needs fourteen indexes and forty-seven guards.');
    function present(wanted, type) {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (wanted.name === 'WorkItem_batch_membership_guard') {
            const extension = require('./qcDispositionScopeSchemaService').inspectScopeExtension(db);
            if (extension.classification === 'COMPLETE') wanted = { ...wanted, sql: extension.membership.guardSql };
        }
        if (actual && (actual.type !== type || normalized(actual.sql) !== normalized(wanted.sql))) differences.push(`${wanted.name} differs`);
        return Boolean(actual);
    }
    const installedIndexes = indexes.map(row => present(row, 'index')), installedGuards = guards.map(row => present(row, 'trigger'));
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    const sources = { migrationSha256: source.sha256, oracleSha256: source.oracleSha256 };
    let receipt = null;
    if (marker) {
        try { receipt = JSON.parse(marker.details); } catch { /* Refuse malformed receipts. */ }
        if (receipt?.migrationSha256 !== sources.migrationSha256 || receipt?.oracleSha256 !== sources.oracleSha256 ||
            !/^[a-f0-9]{64}$/.test(receipt?.backfillFingerprint || '') ||
            !validBackfillCounts(receipt?.backfillCounts) || !Array.isArray(receipt?.bootstrapRebuild) ||
            ![JSON.stringify([]), JSON.stringify(['QcMeasurement', 'BatchPositionReference'])].includes(JSON.stringify(receipt.bootstrapRebuild))) differences.push('Normalized QC receipt differs');
    }
    const base = [...tables, ...columns, ...installedIndexes.slice(0, 11)], release = [...installedIndexes.slice(11), ...installedGuards, Boolean(marker)];
    let classification;
    if ([...base, ...release].every(value => !value)) classification = 'PRE_186';
    else if (base.every(Boolean) && release.every(value => !value)) classification = 'FRESH_PRISMA';
    else if ([...base, ...release].every(Boolean)) classification = 'COMPLETE';
    else differences.push('Normalized QC installation is partial or unmarked');
    if (bootstrapRebuild.length && (classification !== 'FRESH_PRISMA' || bootstrapRebuild.length !== 2)) differences.push('Deferred QC foreign keys require the empty fresh-Prisma bootstrap');
    if (classification === 'FRESH_PRISMA') {
        const objects = db.prepare(`SELECT type,name FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('index','trigger') AND tbl_name IN (${TABLES.map(() => '?').join(',')})`).all(...TABLES);
        const allowed = new Set(indexes.slice(0, 11).map(row => row.name));
        if (objects.some(row => row.type !== 'index' || !allowed.has(row.name))) differences.push('Fresh normalized QC schema has foreign indexes or triggers');
    }
    if (differences.length) throw fail('QC_RUN_SCHEMA_MISMATCH', 'Normalized QC schema differs from the release.', differences);
    const counts = Object.fromEntries(TABLES.map((table, index) => [table, tables[index] ? db.prepare(`SELECT COUNT(*) n FROM "${table}"`).get().n : 0]));
    if (classification === 'FRESH_PRISMA' && Object.values(counts).some(Boolean)) throw fail('QC_RUN_INTEGRITY_REFUSED', 'Unmarked normalized QC rows need review before import.');
    return { classification, sources, counts, receipt,
        bootstrapRebuild: classification === 'COMPLETE' ? receipt.bootstrapRebuild : bootstrapRebuild.length ? ['QcMeasurement', 'BatchPositionReference'] : [],
        guards: guards.map(row => row.name), indexes: indexes.map(row => row.name) };
}
module.exports = { classifyQcRunSchema, MARKER, TABLES };
