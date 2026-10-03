'use strict';

// Read-only inventory. Never initialize Prisma, exchange triggers, or a journal.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const adapter = require('../services/sisAdapterService');

function parseObject(value) {
    if (value === null || value === '') return {};
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected an object');
    return parsed;
}

function inventory(db, additionalJournal = []) {
    // Same conservative semantic predicate as publication policy, without importing
    // its authorization service (which initializes Prisma in an operator process).
    const hold = column => `(CASE WHEN ${column} IS NULL OR ${column}='' THEN 0 WHEN NOT json_valid(${column}) THEN 1 WHEN json_type(${column})!='object' THEN 1 WHEN COALESCE(json_extract(${column},'$.provenanceHold.status'),'')='AMBIGUOUS_PROVENANCE_HOLD' THEN 1 ELSE 0 END)=1`;
    const held = new Set(db.prepare(`SELECT id FROM Sample WHERE ${hold('metadata')} OR ${hold('fieldMetadata')}`).all().map(row=>row.id));
    const rows = db.prepare('SELECT id,status,approvedAt,country,countryName,projectCode,fieldMetadata,metadata FROM Sample').all();
    const historical = new Map();
    const historicalErrors = [];
    let historyRows = 0;
    const historyCounts = { journal: 0, snapshot: 0, additionalJournal: 0 };
    function record(row, source, bodyColumn) {
        historyCounts[source]++;
        historyRows++;
        if (!row[bodyColumn]) return; // Withdrawal events can have no specimen body.
        try {
            const payload = parseObject(row[bodyColumn]);
            const specimenId = payload.specimenId || row.specimen_id;
            if (!specimenId) throw new Error('Missing specimen identity');
            const profile = payload.profile;
            if (!profile || profile.key == null) return;
            if (typeof profile.key !== 'string' || !profile.key || typeof profile.code !== 'string' || !profile.code || typeof profile.namespace !== 'string' || !profile.namespace || profile.key !== `${profile.namespace}:${profile.code}`) {
                throw new Error('Malformed historical profile identity');
            }
            if (!historical.has(specimenId)) historical.set(specimenId, new Map());
            historical.get(specimenId).set(profile.key, { code: profile.code, namespace: profile.namespace, key: profile.key, relation: profile.relation });
        } catch (error) {
            historicalErrors.push({ specimenId: row.specimen_id || null, source, error: error.message });
        }
    }
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='_exchange_journal'").get()) {
        for (const row of db.prepare('SELECT specimen_id,payload FROM _exchange_journal').iterate()) record(row, 'journal', 'payload');
    }
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='_exchange_snapshot_items'").get()) {
        for (const row of db.prepare('SELECT specimen_id,body_json FROM _exchange_snapshot_items').iterate()) record(row, 'snapshot', 'body_json');
    }
    for (const row of additionalJournal) record(row, 'additionalJournal', 'payload');
    const summary = { samples: rows.length, canonicalPresent: 0, canonicalInvalid: 0, currentCanonicalKeys: 0, currentLegacyKeys: 0, releasedCurrentKeys: 0, sourceMissing: 0, sourceConflicting: 0, held: held.size, malformedMetadata: 0, historicalRows: historyRows, historyCounts, historicalSpecimensWithKeys: historical.size, historicalConflictingSpecimens: 0, historicalMalformedRows: historicalErrors.length, historicalKeysDifferFromCurrent: 0 };
    const details = [];
    const extractLegacy = adapter.extractLegacyProfileReference || adapter.extractProfileReference;
    for (const sample of rows) {
        let field, meta;
        try { field = parseObject(sample.fieldMetadata); meta = parseObject(sample.metadata); }
        catch { summary.malformedMetadata++; details.push({ specimenId: sample.id, classification: 'malformed-metadata', held: held.has(sample.id) }); continue; }
        const canonicalPresent = Object.hasOwn(field, 'profileReference');
        if (canonicalPresent) summary.canonicalPresent++;
        let current;
        try { current = canonicalPresent || Object.hasOwn(field,'profileCompatibility') ? adapter.extractProfileReference(sample,field,meta) : extractLegacy(sample,field,meta); }
        catch { summary.canonicalInvalid++; details.push({specimenId:sample.id,classification:'invalid-reference',held:held.has(sample.id)}); continue; }
        if (current.profileKey) {
            if (canonicalPresent) summary.currentCanonicalKeys++; else summary.currentLegacyKeys++;
            if (['APPROVED', 'RELEASED'].includes(sample.status) || (['ARCHIVED', 'DISPOSED'].includes(sample.status) && sample.approvedAt)) summary.releasedCurrentKeys++;
        } else summary.sourceMissing++;
        const explicit = ['pit_id','pitId','profile_id','profileId','profile_code','profileCode'].filter(k => Object.hasOwn(field,k)).map(k => adapter.unwrapValue(field[k])).filter(v => v != null && v !== '').map(String);
        const conflict = new Set(explicit).size > 1;
        if (conflict) summary.sourceConflicting++;
        const history = historical.get(sample.id);
        if (history?.size > 1) summary.historicalConflictingSpecimens++;
        if (history && [...history.keys()].some(key => key !== current.profileKey)) summary.historicalKeysDifferFromCurrent++;
        if (canonicalPresent || conflict || history || (current.profileKey && ['APPROVED','RELEASED','ARCHIVED','DISPOSED'].includes(sample.status))) {
            details.push({ specimenId: sample.id, classification: canonicalPresent ? 'canonical-present' : conflict ? 'source-conflict' : current.profileKey ? 'legacy-reference' : 'source-missing', held: held.has(sample.id), status: sample.status, current, historical: history ? [...history.values()] : [] });
        }
    }
    const rowIds = new Set(rows.map(row => row.id));
    const historyWithoutCurrent = [...historical.keys()].filter(id => !rowIds.has(id));
    return { summary, details, historicalErrors, historyWithoutCurrent };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const option = key => args[args.indexOf(key) + 1];
    if (!args.includes('--copy') || !args.includes('--db') || !args.includes('--private-output')) throw new Error('Usage: --copy --db <existing database copy> --private-output <private report path> [--additional-journal <JSON>]');
    const dbPath = path.resolve(option('--db'));
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
        const more = args.includes('--additional-journal') ? JSON.parse(fs.readFileSync(option('--additional-journal'), 'utf8').replace(/^\uFEFF/, '')) : [];
        const report = inventory(db, more);
        report.evidence = { readOnly: true, generatedAt: new Date().toISOString(), databaseBytes: fs.statSync(dbPath).size, databaseSha256: crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex') };
        fs.writeFileSync(option('--private-output'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ summary: report.summary, evidence: report.evidence }));
    } finally { db.close(); }
}

module.exports = { inventory };
