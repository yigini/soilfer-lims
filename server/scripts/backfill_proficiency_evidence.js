#!/usr/bin/env node
const path = require('node:path');
const Database = require('better-sqlite3');
const { randomUUID, createHash } = require('node:crypto');
const { legacySigmaFlag } = require('../services/proficiencyAssessmentService');
const { assertProficiencyStartupReady, scoreOutcomeDigest } = require('./install_proficiency_evidence');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');
const fail = (code, message) => Object.assign(new Error(message), { code });
const digest = value => createHash('sha256').update(JSON.stringify(value, (_, row) =>
    typeof row === 'number' && !Number.isFinite(row) ? { nonfinite: String(row) } : row)).digest('hex');

function plan(db) {
    const rows = db.prepare('SELECT * FROM "ProficiencyRound" ORDER BY id').all();
    const codes = new Set(db.prepare('SELECT code FROM "Analysis" ORDER BY code').all().map(row => row.code));
    const flagged = rows.map(row => ({ id: row.id, flag: legacySigmaFlag(row.uncertainty) })).filter(row => row.flag);
    const changes = [];
    for (const row of rows) {
        const flag = legacySigmaFlag(row.uncertainty), after = {};
        if (row.legacyScoreFlag != null && !['SIGMA_MISSING', 'SIGMA_NONPOSITIVE'].includes(row.legacyScoreFlag)) {
            throw fail('PT_BACKFILL_REFUSED', `Round ${row.id} has an unsupported legacy score flag.`);
        }
        if (flag && !row.legacyScoreFlag) after.legacyScoreFlag = flag;
        if (!flag && !row.legacyScoreFlag && row.outcome === 'UNSATISFACTORY' && row.ncrStatus == null) after.ncrStatus = 'PENDING';
        if (Object.keys(after).length) changes.push({ id: row.id, before: row, after });
    }
    const codeMismatches = rows.filter(row => !codes.has(row.analysisCode)).map(row => ({ id: row.id, analysisCode: row.analysisCode }));
    return { changes, flagged, codeMismatches, planSha256: digest({ rows, codes: [...codes] }), scoreOutcomeSha256: scoreOutcomeDigest(db) };
}
function receipt(planned, mode, afterHash, totalChanges = 0) {
    return { mode, planSha256: planned.planSha256, totalChanges,
        flagCounts: Object.fromEntries(['SIGMA_MISSING', 'SIGMA_NONPOSITIVE'].map(flag => [flag, planned.flagged.filter(row => row.flag === flag).length])),
        flaggedRounds: planned.flagged, codeMismatches: planned.codeMismatches,
        newFlagCount: planned.changes.filter(row => row.after.legacyScoreFlag).length,
        ncrPendingCount: planned.changes.filter(row => row.after.ncrStatus).length,
        scoreOutcomeSha256Before: planned.scoreOutcomeSha256, scoreOutcomeSha256After: afterHash,
        scoresAndOutcomesPreserved: planned.scoreOutcomeSha256 === afterHash };
}

function backfillProficiencyEvidence({ dbPath, apply = false, planSha256 = null, by = null } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('PT_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath);
    assertProficiencyStartupReady(target);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let reviewed;
    try { reviewed = reader.transaction(() => plan(reader))(); }
    finally { reader.close(); }
    if (!apply) return receipt(reviewed, 'DRY_RUN', reviewed.scoreOutcomeSha256);
    if (!reviewed.changes.length) return receipt(reviewed, 'NO_OP', reviewed.scoreOutcomeSha256);
    if (!planSha256 || planSha256 !== reviewed.planSha256) throw fail('PT_PLAN_STALE', 'Review the current dry-run fingerprint before applying PT evidence flags.');
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const current = plan(db);
            if (current.planSha256 !== planSha256) throw fail('PT_PLAN_STALE', 'PT evidence changed after its dry-run.');
            const actor = typeof by === 'string' ? db.prepare('SELECT username,role,labId,isActive FROM "User" WHERE username=?').get(by) : null;
            if (!actor?.isActive || !scopeGuard.hasGlobalAccess(actor) || !hasPermission(actor, 'APPROVE_RESULTS')) {
                throw fail('PT_BACKFILL_ACTOR_REQUIRED', 'A named, active administrator with global approval authority is required.');
            }
            const now = new Date().toISOString();
            for (const change of current.changes) {
                const patch = { ...change.after, ...(change.after.legacyScoreFlag && { legacyFlaggedAt: now }) };
                const fields = Object.keys(patch);
                db.prepare(`UPDATE "ProficiencyRound" SET ${fields.map(key => `"${key}"=?`).join(',')} WHERE id=?`)
                    .run(...fields.map(key => patch[key]), change.id);
                const after = { ...change.before, ...patch };
                db.prepare(`INSERT INTO "AuditLog" (id,entity,entityId,action,details,before,after,performedBy,timestamp,labId,analysisCode)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(), 'PROFICIENCY_ROUND', change.id,
                    change.after.ncrStatus ? 'PT_UNSATISFACTORY' : 'PT_LEGACY_SCORE_FLAGGED',
                    JSON.stringify({ roundId: change.id, source: 'LEGACY_BACKFILL', zScore: change.before.zScore,
                        classificationLimits: change.before.classificationLimits, planSha256, changes: patch }),
                    JSON.stringify(change.before), JSON.stringify(after), actor.username, now, change.before.labId, change.before.analysisCode);
            }
            const afterHash = scoreOutcomeDigest(db);
            if (afterHash !== current.scoreOutcomeSha256 || db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('PT_BACKFILL_REFUSED', 'PT backfill failed preservation checks.');
            }
            return receipt(current, 'APPLIED', afterHash, db.prepare('SELECT total_changes() n').get().n);
        }).immediate();
    } finally { db.close(); }
}

function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('PT_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (['--db', '--plan-sha256', '--by'].includes(arg) && args[index + 1] && !args[index + 1].startsWith('--')) {
            options[{ '--db': 'dbPath', '--plan-sha256': 'planSha256', '--by': 'by' }[arg]] = args[++index];
        } else throw fail('PT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('PT_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(backfillProficiencyEvidence(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'PT_BACKFILL_REFUSED', message: error.message })}\n`); process.exitCode = 1; }
}
module.exports = { backfillProficiencyEvidence, parseArguments };
