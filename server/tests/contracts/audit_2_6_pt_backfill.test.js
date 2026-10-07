const fs = require('node:fs');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { proficiencyEvidenceFixture } = require('../helpers/proficiencyEvidenceFixture');
const { installProficiencyEvidence } = require('../../scripts/install_proficiency_evidence');
const { backfillProficiencyEvidence, parseArguments } = require('../../scripts/backfill_proficiency_evidence');
const owned = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(rounds = [null, 0, -1, Infinity, 1, 2, 3].map(sigma => ({ sigma,
    outcome: sigma === 1 ? 'QUESTIONABLE' : 'UNSATISFACTORY' }))) {
    const f = proficiencyEvidenceFixture(rounds); owned.push(f); installProficiencyEvidence({ dbPath: f.file, apply: true }); return f;
}
afterAll(() => { for (const f of owned) f.close(); });

test('deleted unsatisfactory rounds are listed but excluded from new NCR marking', () => {
    const f = fixture([{ sigma: 1, outcome: 'UNSATISFACTORY' }, { sigma: 1, outcome: 'UNSATISFACTORY' }]);
    const db = new Database(f.file), deletedAt = '2026-10-07T00:00:00.000Z';
    db.prepare('UPDATE "ProficiencyRound" SET deletedAt=?,deletedBy=?,deleteReason=? WHERE id=?').run(deletedAt, f.by, 'Owned duplicate fixture', 'round-0');
    const before = db.prepare('SELECT * FROM "ProficiencyRound" WHERE id=?').get('round-0'); db.close();
    const byteHash = hash(f.file), dry = backfillProficiencyEvidence({ dbPath: f.file });
    expect(dry.deletedRounds).toEqual([{ id: 'round-0', deletedAt }]); expect(dry.ncrPendingCount).toBe(1); expect(hash(f.file)).toBe(byteHash);
    const applied = backfillProficiencyEvidence({ dbPath: f.file, apply: true, planSha256: dry.planSha256, by: f.by });
    expect(applied).toMatchObject({ ncrPendingCount: 1, scoresAndOutcomesPreserved: true, deletedRounds: [{ id: 'round-0', deletedAt }] });
    const check = new Database(f.file);
    expect(check.prepare('SELECT * FROM "ProficiencyRound" WHERE id=?').get('round-0')).toEqual(before);
    expect(check.prepare('SELECT ncrStatus FROM "ProficiencyRound" WHERE id=?').get('round-1').ncrStatus).toBe('PENDING');
    expect(check.prepare('SELECT count(*) n FROM "AuditLog" WHERE entityId=?').get('round-0').n).toBe(0); check.close();
    const finalHash = hash(f.file);
    expect(backfillProficiencyEvidence({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0, deletedRounds: [{ id: 'round-0', deletedAt }] });
    expect(hash(f.file)).toBe(finalHash);
});

test('dry-run lists missing/nonpositive/nonfinite sigma and catalogue mismatches without changing a byte', () => {
    const f = fixture(), before = hash(f.file), dry = backfillProficiencyEvidence({ dbPath: f.file });
    expect(dry).toMatchObject({ mode: 'DRY_RUN', totalChanges: 0, flagCounts: { SIGMA_MISSING: 1, SIGMA_NONPOSITIVE: 3 },
        newFlagCount: 4, ncrPendingCount: 2, scoresAndOutcomesPreserved: true });
    expect(dry.flaggedRounds.map(row => row.id)).toEqual(['round-0', 'round-1', 'round-2', 'round-3']);
    expect(dry.codeMismatches).toHaveLength(7);
    expect(dry.codeMismatches.every(row => row.analysisCode === 'MiXeD')).toBe(true);
    expect(dry.scoreOutcomeSha256Before).toBe(dry.scoreOutcomeSha256After);
    expect(hash(f.file)).toBe(before);
});

test('reviewed apply only flags or marks pending, preserves all analytical values and old outcomes, audits each change and is idempotent', () => {
    const f = fixture(), db = new Database(f.file), before = db.prepare('SELECT * FROM "ProficiencyRound" ORDER BY id').all(); db.close();
    const dry = backfillProficiencyEvidence({ dbPath: f.file });
    const result = backfillProficiencyEvidence({ dbPath: f.file, apply: true, planSha256: dry.planSha256, by: f.by });
    expect(result).toMatchObject({ mode: 'APPLIED', newFlagCount: 4, ncrPendingCount: 2, totalChanges: 12, scoresAndOutcomesPreserved: true });
    const check = new Database(f.file);
    try {
        for (const old of before) {
            const after = check.prepare('SELECT * FROM "ProficiencyRound" WHERE id=?').get(old.id);
            for (const key of Object.keys(old).filter(key => !['legacyScoreFlag', 'legacyFlaggedAt', 'ncrStatus'].includes(key))) expect(after[key]).toEqual(old[key]);
        }
        expect(check.prepare('SELECT legacyScoreFlag,ncrStatus,outcome FROM "ProficiencyRound" WHERE id=?').get('round-4'))
            .toEqual({ legacyScoreFlag: null, ncrStatus: null, outcome: 'QUESTIONABLE' });
        expect(check.prepare('SELECT count(*) n FROM "ProficiencyRound" WHERE legacyScoreFlag IS NOT NULL AND ncrStatus IS NOT NULL').get().n).toBe(0);
        expect(check.prepare('SELECT count(*) n FROM "AuditLog" WHERE action=?').get('PT_UNSATISFACTORY').n).toBe(2);
        expect(check.prepare('SELECT count(*) n FROM "AuditLog" WHERE action=?').get('PT_LEGACY_SCORE_FLAGGED').n).toBe(4);
        const audit = check.prepare('SELECT before,after FROM "AuditLog" WHERE entityId=?').get('round-0');
        expect(JSON.parse(audit.before).legacyScoreFlag).toBeNull();
        expect(JSON.parse(audit.after).legacyScoreFlag).toBe('SIGMA_MISSING');
    } finally { check.close(); }
    const installed = hash(f.file);
    expect(backfillProficiencyEvidence({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0,
        newFlagCount: 0, ncrPendingCount: 0, scoresAndOutcomesPreserved: true });
    expect(hash(f.file)).toBe(installed);
});

test('missing/stale dry-run fingerprint and missing actor each refuse with zero writes', () => {
    const f = fixture(), dry = backfillProficiencyEvidence({ dbPath: f.file }), before = hash(f.file);
    for (const options of [{}, { planSha256: 'wrong' }]) {
        expect(() => backfillProficiencyEvidence({ dbPath: f.file, apply: true, ...options }))
            .toThrow(expect.objectContaining({ code: 'PT_PLAN_STALE' }));
    }
    expect(() => backfillProficiencyEvidence({ dbPath: f.file, apply: true, planSha256: dry.planSha256 }))
        .toThrow(expect.objectContaining({ code: 'PT_BACKFILL_ACTOR_REQUIRED' }));
    expect(hash(f.file)).toBe(before);
});

test('a changed historical row invalidates the reviewed plan without silently re-scoring it', () => {
    const f = fixture(), dry = backfillProficiencyEvidence({ dbPath: f.file }), db = new Database(f.file);
    db.prepare('UPDATE "ProficiencyRound" SET notes=? WHERE id=?').run('Concurrent reviewed metadata', 'round-0'); db.close();
    const before = hash(f.file);
    expect(() => backfillProficiencyEvidence({ dbPath: f.file, apply: true, planSha256: dry.planSha256, by: f.by }))
        .toThrow(expect.objectContaining({ code: 'PT_PLAN_STALE' }));
    expect(hash(f.file)).toBe(before);
});

test('an audit-write fault rolls back every flag and pending marker', () => {
    const f = fixture(), db = new Database(f.file);
    db.exec(`CREATE TRIGGER owned_pt_audit_fault BEFORE INSERT ON "AuditLog" BEGIN SELECT RAISE(ABORT,'OWNED_PT_AUDIT_FAULT'); END;`); db.close();
    const before = hash(f.file), dry = backfillProficiencyEvidence({ dbPath: f.file });
    expect(() => backfillProficiencyEvidence({ dbPath: f.file, apply: true, planSha256: dry.planSha256, by: f.by })).toThrow('OWNED_PT_AUDIT_FAULT');
    expect(hash(f.file)).toBe(before);
});

test('CLI defaults to dry-run and rejects conflicting or incomplete options', () => {
    expect(parseArguments([]).apply).toBe(false);
    expect(() => parseArguments(['--apply', '--dry-run'])).toThrow(expect.objectContaining({ code: 'PT_ARGUMENT_INVALID' }));
    expect(() => parseArguments(['--by'])).toThrow(expect.objectContaining({ code: 'PT_ARGUMENT_INVALID' }));
});
