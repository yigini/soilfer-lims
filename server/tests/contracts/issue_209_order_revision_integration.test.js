const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const installer = require('../../scripts/install_order_revisions');
const order = require('../../services/orderService');
const { resolveOrderLine } = require('../../services/orderLineResolutionService');

const held = [];
const triples = file => Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix,
    fs.existsSync(file + suffix) ? createHash('sha256').update(fs.readFileSync(file + suffix)).digest('hex') : null]));

async function fixture({ revisions = 1, lines = 1, historicalOpen = false } = {}) {
    const f = await qcGateFixture({ resolvedRules: false, fixedWindowPolicy: false }); held.push(f);
    const item = f.items[0];
    await require('../../services/sampleStateService').transitionSample(item.sampleId, 'PROCESSING', f.actor,
        'Declared complete order context', { requiredAnalyses: JSON.stringify([item.analysis]) }, f.db);
    const db = new Database(f.file, { fileMustExist: true });
    try {
        db.pragma('foreign_keys=ON');
        for (let version = 1; version <= revisions; version++) {
            const revisionId = randomUUID();
            db.prepare('INSERT INTO SampleOrderRevision(id,sampleId,version,status,reason,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)')
                .run(revisionId, item.sampleId, version, 'ACTIVE', 'Retained order context', 1, 1);
            for (let index = 0; index < lines; index++) db.prepare('INSERT INTO OrderLine(id,revisionId,analysis,isRequired,status,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)')
                .run(randomUUID(), revisionId, item.analysis, 1, 'ACTIVE', 1, 1);
        }
    } finally { db.close(); }
    if (historicalOpen) {
        f.openId = randomUUID();
        // A retained #191 reservation uses its ordinary Prisma timestamp representation.
        await f.db.workAttempt.create({ data: { id: f.openId, workItemId: item.id, attemptNo: 1, status: 'OPEN',
            version: 1, createdAt: new Date(1), updatedAt: new Date(1) } });
    }
    return f;
}

async function rows(f) {
    const db = new Database(f.file, { readonly: true, fileMustExist: true });
    try { return {
        revisions: db.prepare('SELECT id,sampleId,version,status,reason,createdAt,updatedAt FROM SampleOrderRevision ORDER BY id').all(),
        lines: db.prepare('SELECT id,revisionId,analysis,methodologyId,methodRevision,isRequired,status,omissionReason,omissionAuthorizedBy,omissionAuthorizedAt,predecessorLineId,createdAt,updatedAt FROM OrderLine ORDER BY id').all(),
        attempts: db.prepare('SELECT * FROM WorkAttempt ORDER BY id').all()
    }; } finally { db.close(); }
}

afterAll(async () => { for (const f of held) await f.db.$disconnect(); }); // Retain every owned fixture/triple.

test('installer dry/apply/repeat retains three ACTIVE histories, every line and a null historical OPEN identity', async () => {
    const f = await fixture({ revisions: 3, historicalOpen: true }), before = await rows(f), physical = triples(f.file);
    const dry = installer.installOrderRevisions({ dbPath: f.file });
    expect(dry).toMatchObject({ classification: 'PRE_209', mode: 'DRY_RUN', totalChanges: 0, backfilledCount: 0,
        impact: { multipleActiveSampleCount: 1 } });
    expect(triples(f.file)).toEqual(physical);
    expect(installer.installOrderRevisions({ dbPath: f.file, apply: true })).toMatchObject({ classification: 'COMPLETE_209', originalRowsPreserved: true, backfilledCount: 0 });
    expect(await rows(f)).toEqual(before);
    const after = triples(f.file);
    expect(installer.installOrderRevisions({ dbPath: f.file, apply: true })).toMatchObject({ classification: 'COMPLETE_209', mode: 'NO_OP', totalChanges: 0 });
    expect(triples(f.file)).toEqual(after);
});

test('a full reasoned revision supersedes all three ACTIVE ids while every old line and attempt stays byte-equivalent', async () => {
    const f = await fixture({ revisions: 3, historicalOpen: true }), before = await rows(f);
    installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const result = await order.reviseAnalyses(f.items[0].sampleId, { analyses: [f.items[0].analysis], reason: 'Reviewed complete target against actual work' }, f.actor, { tx: f.db, mode: 'order' });
    expect(result.revision.status).toBe('ACTIVE');
    expect(await f.db.sampleOrderRevision.count({ where: { sampleId: f.items[0].sampleId, status: 'ACTIVE' } })).toBe(1);
    expect(await f.db.sampleOrderRevision.count({ where: { sampleId: f.items[0].sampleId, status: 'SUPERSEDED' } })).toBe(3);
    const after = await rows(f);
    expect(after.lines.filter(line => before.lines.some(old => old.id === line.id))).toEqual(before.lines);
    expect(after.attempts).toEqual(before.attempts);
    const audit = await f.db.auditLog.findFirst({ where: { sampleId: f.items[0].sampleId, action: 'ORDER_REVISION_APPLIED' } });
    expect(JSON.parse(audit.details)).toMatchObject({ priorActiveCount: 3, supersededRevisionIds: before.revisions.map(row => row.id) });
    const newLines = await f.db.orderLine.findMany({ where: { revisionId: result.revision.id } });
    expect(newLines).toHaveLength(1); expect(newLines[0].workItemId).toBe(f.items[0].id);
});

test('legacy single-match resolution writes only the newly inserted attempt link', async () => {
    const f = await fixture(), before = await rows(f);
    installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const result = await f.result(f.items[0]);
    const attempt = await f.db.workAttempt.findUnique({ where: { id: result.attemptId } });
    expect(attempt.orderLineId).toBe(before.lines[0].id);
    expect((await rows(f)).lines).toEqual(before.lines);
    expect((await f.db.orderLine.findUnique({ where: { id: before.lines[0].id } })).workItemId).toBeNull();
});

test.each([[0, 0, 'NO_LINE'], [1, 2, 'AMBIGUOUS_LINE'], [2, 1, 'MULTIPLE_ACTIVE_REVISIONS']])(
    'a legacy %i-revision/%i-line context refuses with %s and no row writes', async (revisions, lines, cause) => {
        const f = await fixture({ revisions, lines }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
        const before = await rows(f);
        await expect(f.db.$transaction(tx => resolveOrderLine(tx, f.items[0]))).rejects.toMatchObject({ code: 'ORDER_LINE_REQUIRED', statusCode: 409, details: { cause } });
        expect(await rows(f)).toEqual(before);
        expect(installer.installOrderRevisions({ dbPath: f.file }).impact.refusalCounts[cause]).toBe(1);
    });

test('a retained OPEN attempt fills with its original null order-line identity', async () => {
    const f = await fixture({ historicalOpen: true }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const before = (await rows(f)).attempts.find(row => row.id === f.openId);
    let result;
    try { result = await f.result(f.items[0]); }
    catch (error) { throw new Error('Historical first-fill guard: ' + error.code + ': ' + error.message); }
    expect(result.attemptId).toBe(f.openId);
    expect(await f.db.workAttempt.findUnique({ where: { id: f.openId } })).toMatchObject({ status: 'RECORDED', orderLineId: null });
    const after = (await rows(f)).attempts.find(row => row.id === f.openId);
    for (const field of ['id','workItemId','orderLineId','attemptNo','batchId','reason','requestedBy','requestedAt','parentAttemptId','note',
        'rawData','calcVersion','dilutionFactor','aliquotId','legacyAttemptNoConflict','version','createdAt','updatedAt']) expect(after[field]).toEqual(before[field]);
});

test('two concurrent complete revisions leave exactly one ACTIVE revision', async () => {
    const f = await fixture({ revisions: 3 }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const outcomes = await Promise.allSettled([1, 2].map(index => order.reviseAnalyses(f.items[0].sampleId,
        { analyses: [f.items[0].analysis], reason: 'Reviewed concurrent full target ' + index }, f.actor, { tx: f.db, mode: 'order' })));
    expect(outcomes.some(outcome => outcome.status === 'fulfilled')).toBe(true);
    for (const outcome of outcomes) if (outcome.status === 'rejected') expect(outcome.reason).toMatchObject({ code: 'ORDER_REVISION_CHANGED', statusCode: 409 });
    expect(await f.db.sampleOrderRevision.count({ where: { sampleId: f.items[0].sampleId, status: 'ACTIVE' } })).toBe(1);
});

test('raw new-attempt insertion cannot select one ambiguous legacy line', async () => {
    const f = await fixture({ lines: 2 }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const line = await f.db.orderLine.findFirst({ where: { revision: { sampleId: f.items[0].sampleId } } });
    const connection = new Database(f.file, { fileMustExist: true });
    try {
        expect(() => connection.prepare('INSERT INTO WorkAttempt(id,workItemId,orderLineId,attemptNo,status,version,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)')
            .run(randomUUID(), f.items[0].id, line.id, 1, 'OPEN', 1, 1, 1)).toThrow('ORDER_LINE_REQUIRED');
    } finally { connection.close(); }
    expect(await f.db.workAttempt.count({ where: { workItemId: f.items[0].id } })).toBe(0);
});

test('a new linked line cannot have its ownership or analysis rewritten', async () => {
    const f = await fixture({ revisions: 3 }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const revised = await order.reviseAnalyses(f.items[0].sampleId, { analyses: [f.items[0].analysis], reason: 'Reviewed immutable line identity' }, f.actor, { tx: f.db, mode: 'order' });
    const line = await f.db.orderLine.findFirst({ where: { revisionId: revised.revision.id } }), before = JSON.stringify(line);
    const connection = new Database(f.file, { fileMustExist: true });
    try {
        expect(() => connection.prepare('UPDATE OrderLine SET workItemId=NULL WHERE id=?').run(line.id)).toThrow('ORDER_LINE_IDENTITY_IMMUTABLE');
        expect(() => connection.prepare('UPDATE OrderLine SET analysis=? WHERE id=?').run('OTHER', line.id)).toThrow('ORDER_LINE_IDENTITY_IMMUTABLE');
    } finally { connection.close(); }
    expect(JSON.stringify(await f.db.orderLine.findUnique({ where: { id: line.id } }))).toBe(before);
});

test('a reasoned repeat receives its resolved legacy line at the new reservation INSERT', async () => {
    const f = await fixture(); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const original = await f.result(f.items[0]);
    const originalAttempt = await f.db.workAttempt.findUnique({ where: { id: original.attemptId } });
    const result = await require('../../services/workRepeatService').requestRepeat(f.db, f.items[0].id, f.actor,
        { reason: 'INSTRUMENT_FAULT', note: 'Reviewed remeasurement request' });
    expect(result.attempt).toMatchObject({ status: 'OPEN', orderLineId: originalAttempt.orderLineId, parentAttemptId: originalAttempt.id });
    expect(result.attempt.id).not.toBe(originalAttempt.id);
    expect(await f.db.workAttempt.findUnique({ where: { id: originalAttempt.id } })).toMatchObject({ orderLineId: originalAttempt.orderLineId });
});
