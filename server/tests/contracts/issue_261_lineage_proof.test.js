const { createHash } = require('node:crypto');
jest.mock('../../prisma', () => ({}));
jest.mock('../../services/resultWriteService', () => ({ resolveResultRunContext: async () => ({ equipmentId: 'instrument' }) }));
jest.mock('../../services/resultEvidenceService', () => ({ assertAmendable: jest.fn() }));
jest.mock('../../services/sampleHoldService', () => ({ assertNotHeld: jest.fn() }));
jest.mock('../../config/auth', () => ({ JWT_SECRET: require('node:crypto').randomBytes(32).toString('hex') }));
jest.mock('../../services/sessionValidationService', () => ({ validateUserPrincipal: async decoded => ({ valid: true,
    user: { id: decoded.id, username: decoded.id, role: decoded.role, labId: null } }) }));
const lineage = require('../../services/workRepeatLineageService');
const { partialReplacementRequest } = require('../../services/workRepeatContract');

function fixture() {
    const item = { id: 'work', sampleId: 'sample', labId: 'lab', analysis: 'P', methodologyId: null, batchId: null };
    const attempt = (id, attemptNo, status, parentAttemptId = null) => {
        const evidenceData = JSON.stringify({ sourceResultIds: [id + '-first'], instrument: 'instrument' });
        return { id, attemptNo, status, parentAttemptId, workItemId: item.id, evidenceData,
            evidenceHash: createHash('sha256').update(evidenceData).digest('hex'), requestedBy: 'manager', requestedAt: 'time',
            reason: 'INSTRUMENT_FAULT', note: 'Instrument failed', qcBatchId: null, instrumentId: 'instrument', executedMethodRevision: null };
    };
    const root = attempt('root', 1, 'QUESTIONED'), partial = attempt('partial', 2, 'RECORDED', root.id);
    const result = (id, owner, replicateNo, isCurrent = true) => ({ id, attemptId: owner.id, replicateNo, isCurrent,
        supersededBy: isCurrent ? null : 'partial-1', sampleId: item.sampleId, param: item.analysis,
        batchId: null, methodologyId: null, equipmentId: 'instrument' });
    const rows = [result('root-1', root, 1, false), result('root-2', root, 2), result('root-3', root, 3), result('partial-1', partial, 1)];
    const event = (owner, oldResultIds = []) => ({ entity: 'WORK_ATTEMPT', entityId: owner.id, action: 'CREATED', sampleId: item.sampleId,
        labId: item.labId, analysisCode: item.analysis, performedBy: owner.requestedBy,
        details: JSON.stringify({ from: null, to: 'OPEN', reason: owner.reason, note: owner.note, oldResultIds }) });
    const attempts = [root, partial], events = [event(partial)];
    const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => value && typeof value === 'object'
        ? value.in.includes(row[key]) : row[key] === value);
    const db = { sample: { findUnique: async () => ({ id: item.sampleId, assignedLab: item.labId }) }, workItem: {}, methodology: { findUnique: jest.fn() },
        workAttempt: { findMany: async ({ where }) => attempts.filter(row => matches(row, where)) },
        result: { findMany: async ({ where }) => rows.filter(row => matches(row, where)) },
        auditLog: { findMany: async ({ where }) => events.filter(row => matches(row, where)) } };
    const replacement = () => {
        partial.status = 'INVALIDATED';
        const child = attempt('replacement', 3, 'RECORDED', partial.id);
        attempts.push(child); events.push(event(child, ['partial-1', 'root-2', 'root-3']));
        return child;
    };
    return { db, item, root, partial, rows, attempts, events, replacement, result };
}

test('partial reservation proves the union using actual current Result identities, including an older owner', async () => {
    const f = fixture();
    await expect(lineage.partialReplacementSources(f.db, f.item, f.partial, { username: 'manager' }))
        .resolves.toEqual(['partial-1', 'root-2', 'root-3']);
});
test.each(['hash', 'evidence-json', 'cycle', 'missing-parent', 'duplicate-replica', 'foreign-owner', 'lost-replica', 'requester', 'sealed-parent', 'batch', 'item-run', 'method', 'instrument'])
    ('partial proof refuses %s instead of selecting a newest execution', async kind => {
        const f = fixture();
        if (kind === 'hash') f.partial.evidenceHash = 'tampered';
        if (kind === 'evidence-json') {
            f.partial.evidenceData='"opaque"';f.partial.evidenceHash=createHash('sha256').update(f.partial.evidenceData).digest('hex');
        }
        if (kind === 'cycle') f.root.parentAttemptId = f.partial.id;
        if (kind === 'missing-parent') f.partial.parentAttemptId = 'absent';
        if (kind === 'duplicate-replica') f.rows.push({ ...f.rows[1], id: 'duplicate' });
        if (kind === 'foreign-owner') f.rows[1].attemptId = 'unrelated';
        if (kind === 'lost-replica') f.rows[2].isCurrent = false;
        if (kind === 'requester') f.events[0].performedBy = 'other';
        if (kind === 'sealed-parent') f.root.status = 'ACCEPTED';
        if (kind === 'batch') f.rows.at(-1).batchId = 'other';
        if (kind === 'item-run') f.item.batchId = 'other';
        if (kind === 'method') f.rows.at(-1).methodologyId = 'other';
        if (kind === 'instrument') f.rows.at(-1).equipmentId = 'other';
        await expect(lineage.partialReplacementSources(f.db, f.item, f.partial, { username: 'manager' }))
            .rejects.toMatchObject({ statusCode: 409, code: 'PARTIAL_REPEAT_CONTEXT_MISMATCH' });
    });
test('a replacement with three current owners resolves only through its immutable source Result set', async () => {
    const f = fixture(), child = f.replacement();
    f.rows[1].isCurrent = false; f.rows[1].supersededBy = 'replacement-2';
    f.rows.push(f.result('replacement-2', child, 2));
    await expect(lineage.recordedReplacement(f.db, f.item, f.attempts, f.rows.filter(row => row.isCurrent))).resolves.toEqual(child);
    await expect(lineage.assertReplacementComplete(f.db, f.item, child)).rejects.toMatchObject({
        code: 'ATTEMPT_REPLICATE_SET_INCOMPLETE', details: { missingReplicateNumbers: [1, 3] } });
    for (const number of [1, 3]) f.rows.push(f.result('replacement-' + number, child, number));
    await expect(lineage.assertReplacementComplete(f.db, f.item, child)).resolves.toBeUndefined();
});
test.each(['missing-source', 'duplicate-source', 'foreign-result', 'partial-set', 'event-context', 'event-json'])
    ('a stored replacement proof refuses %s with no guessed or caller-supplied lineage', async kind => {
        const f = fixture(), child = f.replacement(), event = f.events.at(-1), value = JSON.parse(event.details);
        if (kind === 'missing-source') value.oldResultIds[0] = 'absent';
        if (kind === 'duplicate-source') value.oldResultIds.push(value.oldResultIds[0]);
        if (kind === 'foreign-result') f.rows[1].sampleId = 'foreign';
        if (kind === 'partial-set') value.oldResultIds.pop();
        if (kind === 'event-context') event.labId = 'foreign';
        event.details = kind==='event-json'?'null':JSON.stringify(value);
        await expect(lineage.replacementSources(f.db, f.item, child)).rejects.toMatchObject({ code: 'PARTIAL_REPEAT_CONTEXT_MISMATCH' });
    });
test('an ordinary instrument-fault repeat does not acquire replacement authority', async () => {
    const f = fixture(); await expect(lineage.replacementSources(f.db, f.item, f.partial)).resolves.toBeNull();
});
test.each([{}, { attemptId: 'partial', expectedVersion: 1, reason: 'PREP_ERROR' },
    { attemptId: 'partial', expectedVersion: 1, reason: 'INSTRUMENT_FAULT', note: ' ' },
    { attemptId: 'partial', expectedVersion: 1, reason: 'INSTRUMENT_FAULT', note: 'Fault', oldResultIds: ['guessed'] }])
    ('the explicit command refuses malformed or caller-authored lineage %j', input => {
        expect(() => partialReplacementRequest(input)).toThrow();
    });
test('only the explicit limit-override command accepts a fresh NCR assessment', () => {
    const input = { attemptId: 'partial', expectedVersion: 2, reason: 'INSTRUMENT_FAULT', note: 'Fault',
        description: 'Failure', impactAssessment: 'Repeat the whole set' };
    expect(() => partialReplacementRequest(input)).toThrow();
    expect(partialReplacementRequest(input, true)).toMatchObject({ partialReplacement: { attemptId: 'partial', expectedVersion: 2 },
        limitOverride: { description: 'Failure', impactAssessment: 'Repeat the whole set' } });
});

test('the batched REPEAT_REQUIRED refusal is an upfront stable 409 before any reservation or transition', async () => {
    const f=fixture(), actor={username:'manager',role:'LAB_MANAGER',labId:'lab'};
    f.item.status='REPEAT_REQUIRED';f.item.batchId='run';f.item.version=2;
    const request=partialReplacementRequest({attemptId:f.partial.id,expectedVersion:2,reason:'INSTRUMENT_FAULT',note:'Instrument fault'});
    const writes=jest.fn(()=>{throw Error('A write was attempted');});
    for(const model of [f.db.workAttempt,f.db.workItem,f.db.auditLog,f.db.result])Object.assign(model,{create:writes,update:writes,updateMany:writes});
    await expect(require('../../services/workRepeatService').preflightRepeat(f.db,f.item,{id:'sample',assignedLab:'lab'},actor,request))
        .rejects.toMatchObject({statusCode:409,code:'REPEAT_REPLACEMENT_BATCH_FROZEN'});
    expect(writes).not.toHaveBeenCalled();
});

test.each(['replace-partial','replace-partial/limit-override'])('the actual %s router uses the registered manager permission', async command => {
    const express=require('express'), request=require('supertest'), jwt=require('jsonwebtoken');
    const service=require('../../services/workRepeatService');
    const spy=jest.spyOn(service,'replacePartialRepeat').mockResolvedValue({attempt:{id:'replacement',status:'OPEN'}});
    const log=jest.spyOn(console,'log').mockImplementation(()=>{}), warn=jest.spyOn(console,'warn').mockImplementation(()=>{});
    try {
        const app=express();app.use(express.json());app.use('/api/work-items',require('../../routes/workRepeatRoutes'));
        for(const role of ['SUPER_ADMIN','MASTER_USER','LAB_MANAGER','LAB_TECHNICIAN','PROJECT_MANAGER','SAMPLE_RECEPTION','SURVEYOR','VIEWER']) {
            spy.mockClear();
            const token=jwt.sign({id:'unit-'+role,role},require('../../config/auth').JWT_SECRET,{expiresIn:'1m'});
            const response=await request(app).post('/api/work-items/work/repeats/'+command).set('Authorization','Bearer '+token).send({});
            if(require('../../config/roles').hasPermission({role},'APPROVE_RESULTS')) {
                expect(response.status).toBe(201);expect(spy).toHaveBeenCalledTimes(1);
                expect(spy.mock.calls[0][2].role).toBe(role);
                if(command.endsWith('limit-override'))expect(spy.mock.calls[0][4]).toBe(true);
            } else { expect(response.status).toBe(403);expect(spy).not.toHaveBeenCalled(); }
        }
        spy.mockClear();
        expect((await request(app).post('/api/work-items/work/repeats/'+command).send({})).status).toBe(401);
        expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore();log.mockRestore();warn.mockRestore(); }
});
