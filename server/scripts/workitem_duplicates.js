const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

class DuplicateError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new DuplicateError(code, message); };
const markerExists = db => db.prepare('PRAGMA table_info("WorkItem")').all().some(column => column.name === 'duplicateOf');
const active = db => markerExists(db) ? ' AND duplicateOf IS NULL' : '';
const tableExists = (db, name) => !!db.prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?').get('table', name);

function readGroup(db, sampleId, analysis) {
    const rows = db.prepare(`SELECT * FROM WorkItem WHERE sampleId = ? AND analysis = ?${active(db)} ORDER BY id`).all(sampleId, analysis);
    // Hash linked evidence too, without retaining potentially large spectra.
    const hash = crypto.createHash('sha256').update(JSON.stringify(rows));
    const results = [], scans = [];
    for (const row of tableExists(db, 'Result') ? db.prepare('SELECT * FROM Result WHERE sampleId = ? AND param = ? ORDER BY id').iterate(sampleId, analysis) : []) {
        hash.update('\nResult\n').update(JSON.stringify(row)); results.push({ id: row.id });
    }
    for (const row of tableExists(db, 'SpectralData') ? db.prepare('SELECT * FROM SpectralData WHERE workItemId IN (SELECT id FROM WorkItem WHERE sampleId = ? AND analysis = ?) ORDER BY id').iterate(sampleId, analysis) : []) {
        hash.update('\nSpectralData\n').update(JSON.stringify(row)); scans.push({ id: row.id, workItemId: row.workItemId });
    }
    const fingerprint = hash.digest('hex');
    return { sampleId, analysis, fingerprint, rows: rows.map(row => ({
        id: row.id, status: row.status, createdAt: row.createdAt, duplicateOf: row.duplicateOf ?? null,
        submissionId: row.submissionId, batchId: row.batchId,
        hasEmbeddedResult: row.result != null && String(row.result).trim() !== '',
        resultIds: results.map(result => result.id), spectralIds: scans.filter(scan => scan.workItemId === row.id).map(scan => scan.id),
        flags: row.result != null && String(row.result).trim() !== '' || results.length || scans.some(scan => scan.workItemId === row.id) ? ['HAS_RESULTS'] : []
    })) };
}
function listDuplicates(db) {
    const groups = db.prepare(`SELECT sampleId, analysis FROM WorkItem WHERE 1 = 1${active(db)} GROUP BY sampleId, analysis HAVING COUNT(*) > 1 ORDER BY sampleId, analysis`).all();
    return { mode: 'dry-run', groupCount: groups.length, groups: groups.map(group => readGroup(db, group.sampleId, group.analysis)) };
}
function resolveGroup(db, input, expected = readGroup(db, input.sampleId, input.analysis)) {
    if (!markerExists(db)) fail('WORKITEM_DUPLICATE_SCHEMA_REQUIRED', 'Apply the additive duplicate marker migration before resolving rows.');
    if (!input.reason?.trim()) fail('WORKITEM_DUPLICATE_REASON_REQUIRED', 'An explicit manager reason is required.');
    if (!input.actor?.trim()) fail('WORKITEM_DUPLICATE_ACTOR_REQUIRED', 'An authenticated manager username must be recorded.');
    if (expected.sampleId !== input.sampleId || expected.analysis !== input.analysis) fail('WORKITEM_DUPLICATE_GROUP_CHANGED', 'The reviewed group does not match this request.');
    if (!expected.rows.some(row => row.id === input.keep)) fail('WORKITEM_DUPLICATE_KEEP_INVALID', 'The kept item must belong to the reviewed active group.');
    if (expected.rows.length < 2) fail('WORKITEM_DUPLICATE_GROUP_NOT_FOUND', 'No active duplicate group exists for this sample and analysis.');
    require('../services/exchangeDbFunctions').registerDbFunctions(db);
    return db.transaction(() => {
        const current = readGroup(db, input.sampleId, input.analysis);
        if (current.fingerprint !== expected.fingerprint) fail('WORKITEM_DUPLICATE_GROUP_CHANGED', 'The group changed after it was reviewed; rerun the dry-run.');
        const update = db.prepare('UPDATE WorkItem SET duplicateOf = ? WHERE id = ? AND duplicateOf IS NULL');
        const audit = db.prepare('INSERT INTO AuditLog (id, entity, entityId, action, details, performedBy, timestamp, sampleId, analysisCode, before, after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const changedIds = [];
        for (const row of current.rows) {
            if (row.id === input.keep) continue;
            if (update.run(input.keep, row.id).changes !== 1) fail('WORKITEM_DUPLICATE_GROUP_CHANGED', 'A reviewed row changed; the entire resolution is rolled back.');
            audit.run(crypto.randomUUID(), 'WORKITEM', row.id, 'WORKITEM_DUPLICATE_RESOLVED', JSON.stringify({ reason: input.reason.trim(), canonicalId: input.keep, flags: row.flags }), input.actor.trim(), new Date().toISOString(), input.sampleId, input.analysis, JSON.stringify({ duplicateOf: null }), JSON.stringify({ duplicateOf: input.keep }));
            changedIds.push(row.id);
        }
        return { mode: 'resolve', sampleId: input.sampleId, analysis: input.analysis, keptId: input.keep, changedCount: changedIds.length, changedIds };
    }).immediate();
}

function argumentsFor(argv) {
    const values = new Set(['--database', '--sample', '--analysis', '--keep', '--reason', '--actor']);
    const flags = new Set(['--resolve', '--dry-run']);
    const parsed = {};
    for (let i = 0; i < argv.length; i++) {
        const key = argv[i];
        if (Object.hasOwn(parsed, key)) fail('WORKITEM_DUPLICATE_ARGUMENTS_INVALID', `Repeated argument: ${key}`);
        if (flags.has(key)) parsed[key] = true;
        else if (values.has(key) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) parsed[key] = argv[++i];
        else fail('WORKITEM_DUPLICATE_ARGUMENTS_INVALID', `Invalid argument: ${key}`);
    }
    if (!parsed['--database'] || parsed['--resolve'] && parsed['--dry-run'] || !parsed['--resolve'] && [...values].some(key => key !== '--database' && parsed[key] !== undefined)) fail('WORKITEM_DUPLICATE_ARGUMENTS_INVALID', 'Use --database <existing file> [--dry-run] or --resolve --sample <id> --analysis <code> --keep <id> --reason <text> --actor <username>.');
    if (parsed['--resolve'] && ['--sample', '--analysis', '--keep', '--actor'].some(key => !parsed[key]?.trim())) fail('WORKITEM_DUPLICATE_ARGUMENTS_INVALID', 'Resolve requires a sample, analysis, kept item and actor.');
    return parsed;
}
if (require.main === module) {
    let db;
    try {
        const args = argumentsFor(process.argv.slice(2));
        db = new Database(path.resolve(args['--database']), { readonly: !args['--resolve'], fileMustExist: true });
        const report = args['--resolve'] ? resolveGroup(db, { sampleId: args['--sample'], analysis: args['--analysis'], keep: args['--keep'], reason: args['--reason'], actor: args['--actor'] }) : listDuplicates(db);
        console.log(JSON.stringify(report, null, 2));
    } catch (error) { console.error(JSON.stringify({ code: error.code || 'WORKITEM_DUPLICATE_FAILED', message: error.message })); process.exitCode = 1; }
    finally { db?.close(); }
}
module.exports = { listDuplicates, readGroup, resolveGroup, argumentsFor, DuplicateError };
