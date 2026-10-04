const Database = require('better-sqlite3');
const path = require('path');

function plan(db) {
    const labs = db.prepare('SELECT id, code FROM Lab').all();
    const exact = new Map(labs.flatMap(lab => [[lab.id, lab.id], [lab.code, lab.id]]));
    const normalized = new Set([...exact.keys()].map(value => value.trim().toUpperCase()));
    const samples = db.prepare('SELECT id, labId, labSampleCode, assignedLab FROM Sample').all();
    const sampleById = new Map(samples.map(row => [row.id, row]));
    const report = { mode: 'dry-run', sampleCounts: { copiedSNumber: 0, copiedOtherFormat: 0, ambiguous: 0, blank: 0, labValued: 0, alreadyCopied: 0 },
        otherFormatSampleIds: [], ambiguous: [], duplicates: [], workItemCounts: { updated: 0, unchanged: 0, unresolved: 0, sampleLabDiffer: 0 }, unresolvedWorkItems: [], differingWorkItems: [], sampleChanges: [], workItemChanges: [] };
    const owners = new Map();
    function reserve(code, id) {
        if (!owners.has(code)) owners.set(code, new Set());
        owners.get(code).add(id);
    }
    for (const sample of samples) if (sample.labSampleCode != null) reserve(sample.labSampleCode, sample.id);
    for (const sample of samples) {
        const old = sample.labId;
        if (!old?.trim()) { report.sampleCounts.blank++; continue; }
        if (exact.has(old)) { report.sampleCounts.labValued++; continue; }
        if (normalized.has(old.trim().toUpperCase())) {
            report.sampleCounts.ambiguous++;
            report.ambiguous.push({ id: sample.id, code: 'AMBIGUOUS_LAB_OR_CODE', labId: old }); continue;
        }
        if (!/^S\d+$/.test(old)) report.otherFormatSampleIds.push(sample.id);
        reserve(old, sample.id);
        if (sample.labSampleCode === old) { report.sampleCounts.alreadyCopied++; continue; }
        if (sample.labSampleCode != null) {
            report.duplicates.push({ code: 'SAMPLE_CODE_ALREADY_ASSIGNED', id: sample.id, labId: old, labSampleCode: sample.labSampleCode }); continue;
        }
        report.sampleCounts[/^S\d+$/.test(old) ? 'copiedSNumber' : 'copiedOtherFormat']++;
        report.sampleChanges.push({ id: sample.id, before: null, after: old });
    }
    for (const [value, ids] of owners) if (ids.size > 1) report.duplicates.push({ code: 'SAMPLE_CODE_DUPLICATE', value, sampleIds: [...ids].sort() });
    for (const item of db.prepare('SELECT id, sampleId, labId, legacyLabId, assignedLab FROM WorkItem').all()) {
        const own = exact.get(item.assignedLab), sampleLab = exact.get(sampleById.get(item.sampleId)?.assignedLab);
        const target = own || sampleLab;
        if (own && sampleLab && own !== sampleLab) {
            report.workItemCounts.sampleLabDiffer++;
            report.differingWorkItems.push({ id: item.id, code: 'WORKITEM_SAMPLE_LAB_DIFFER', workItemLab: own, sampleLab });
        }
        if (!target) {
            report.workItemCounts.unresolved++;
            report.unresolvedWorkItems.push({ id: item.id, code: 'WORKITEM_LAB_UNRESOLVED' }); continue;
        }
        if (item.labId === target) { report.workItemCounts.unchanged++; continue; }
        report.workItemCounts.updated++;
        report.workItemChanges.push({ id: item.id, before: item.labId, after: target, legacyLabId: item.legacyLabId ?? item.labId });
    }
    return report;
}
function backfill(db, apply = false) {
    // Existing exchange triggers require the same UDFs as normal app writes.
    // Registration is connection-local and never changes the database schema.
    if (apply) require('../services/exchangeDbFunctions').registerDbFunctions(db);
    const run = () => {
        const report = plan(db);
        if (report.duplicates.length) { report.refused = true; return report; }
        if (apply) {
            const samples = db.prepare('UPDATE Sample SET labSampleCode = ? WHERE id = ? AND labSampleCode IS NULL');
            for (const row of report.sampleChanges) if (samples.run(row.after, row.id).changes !== 1) throw new Error('Concurrent sample code change; entire back-fill rolled back.');
            const work = db.prepare('UPDATE WorkItem SET legacyLabId = COALESCE(legacyLabId, labId), labId = ? WHERE id = ?');
            for (const row of report.workItemChanges) work.run(row.after, row.id);
            report.mode = 'apply';
        }
        return report;
    };
    return apply ? db.transaction(run).immediate() : run();
}
if (require.main === module) {
    const args = process.argv.slice(2), dbIndex = args.indexOf('--database');
    if (dbIndex < 0 || !args[dbIndex + 1] || args.some((arg, i) => i !== dbIndex + 1 && !['--database', '--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
        console.error('Usage: node scripts/backfill_sample_codes.js --database <existing SQLite file> [--dry-run | --apply]'); process.exitCode = 2;
    } else {
        const db = new Database(path.resolve(args[dbIndex + 1]), { readonly: !args.includes('--apply'), fileMustExist: true });
        try { const report = backfill(db, args.includes('--apply')); console.log(JSON.stringify(report, null, 2)); if (report.refused) process.exitCode = 1; }
        finally { db.close(); }
    }
}
module.exports = { plan, backfill };
