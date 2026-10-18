const fs = require('fs');
const path = require('path');

jest.mock('../../prisma', () => {
    const methods = Object.fromEntries(['findUnique', 'findFirst', 'findMany', 'count'].map(key => [key, jest.fn()]));
    return Object.fromEntries(['sample', 'consignment', 'project', 'workItem', 'auditLog', 'lab'].map(key => [key, methods])
        .concat([['$transaction', jest.fn()]]));
});
jest.mock('../../controllers/workItemController', () => ({}));
jest.mock('../../controllers/sampleAmendmentController', () => ({ request: jest.fn() }));
jest.mock('../../services/intakeService', () => ({ snapshot: jest.fn() }));
jest.mock('../../services/closureTaskService', () => ({ requestClosure: jest.fn() }));
jest.mock('../../services/sampleWorkspaceService', () => ({ getWorkspace: jest.fn() }));
jest.mock('../../services/operationalGateStateService', () => ({ changeGate: jest.fn() }));
jest.mock('../../services/sampleAnalysisStateService', () => ({ reviseAnalyses: jest.fn() }));
jest.mock('../../services/resultEvidenceService', () => ({ clearPreparationRevert: jest.fn() }));

const prisma = require('../../prisma');
const intake = require('../../services/intakeService');
const closure = require('../../services/closureTaskService');
const workspace = require('../../services/sampleWorkspaceService');
const gates = require('../../services/operationalGateStateService');
const analyses = require('../../services/sampleAnalysisStateService');
const evidence = require('../../services/resultEvidenceService');
const sample = require('../../controllers/sampleController');
const reception = require('../../controllers/receptionController');

function request() {
    return { params: { id: 'public-test-sample' }, query: { originalId: 'PUBLIC-TEST', q: 'PUBLIC' },
        body: { id: 'public-test-sample', ids: ['public-test-sample'], samples: [], phase: 'PREPARATION', status: 'PENDING' }, headers: {},
        user: { id: 'public-test-actor', username: 'public-test-actor', role: 'SUPER_ADMIN' } };
}
function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; },
        json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; } };
}
function failAtBoundary(failure) {
    const fail = () => { throw failure; };
    for (const method of Object.values(prisma.sample)) method.mockImplementation(fail);
    prisma.$transaction.mockImplementation(fail);
    intake.snapshot.mockImplementation(fail);
    closure.requestClosure.mockImplementation(fail);
    workspace.getWorkspace.mockImplementation(fail);
    gates.changeGate.mockImplementation(fail);
    analyses.reviseAnalyses.mockImplementation(fail);
    evidence.clearPreparationRevert.mockImplementation(fail);
}

describe('#217 public error responses (mock boundaries; no database)', () => {
    let log;
    beforeEach(() => {
        jest.resetAllMocks();
        log = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    const routes = [
        ['sample holds', sample.getSampleHolds],
        ['sample hold resolution', sample.resolveSampleHold],
        ['expected sample search', sample.searchExpectedSamples],
        ['sample listing', sample.getSamples],
        ['sample status', sample.updateStatus],
        ['operational gate status', sample.updatePhaseStatus],
        ['analysis revision', sample.updateSampleAnalyses],
        ['preparation evidence clearance', sample.clearPreparationEvidence],
        ['sample receive delegation', sample.receiveSample],
        ['sample accept delegation', sample.acceptSample],
        ['single removal', sample.deleteSample],
        ['batch removal', sample.batchDeleteSamples],
        ['sample workspace', sample.getSampleWorkspace],
        ['archive request', sample.archiveSample],
        ['disposal request', sample.disposeSample],
        ['intake delegation', reception.processIntake],
        ['batch intake delegation', reception.processBatchConsignmentIntake],
        ['discard draft', reception.discardDraft],
        ['duplicate lookup', reception.checkDuplicate],
        ['consignment listing', reception.getConsignments],
        ['consignment detail', reception.getConsignmentDetail],
        ['sample intake context', reception.getSampleIntakeContext]
    ];
    test.each(routes)('%s hides unexpected exception text and logs the original error', async (_name, handler) => {
        const failure = Object.assign(new Error('PRIVATE_EXCEPTION /private/db.sql password=sentinel'), {
            details: { message: 'PRIVATE_DETAILS', stack: 'PRIVATE_STACK' }
        });
        failAtBoundary(failure);
        const res = response();
        await handler(request(), res);
        expect(res.statusCode).toBe(500);
        const json = JSON.stringify(res.body);
        expect(json).not.toMatch(/PRIVATE_|password=|private\/db|details|stack/i);
        expect(json).toMatch(/failed|internal server error/i);
        expect(log.mock.calls.some(args => args.includes(failure))).toBe(true);
    });

    test.each([
        ['mapped hold', sample.getSampleHolds],
        ['mapped archive', sample.archiveSample],
        ['status branch', sample.updateStatus],
        ['operational gate branch', sample.updatePhaseStatus],
        ['analysis revision branch', sample.updateSampleAnalyses],
        ['preparation evidence branch', sample.clearPreparationEvidence],
        ['transition branch', sample.deleteSample],
        ['workspace branch', sample.getSampleWorkspace],
        ['delegated intake', reception.processIntake],
        ['consignment branch', reception.getConsignmentDetail]
    ])('%s keeps the status/code of a server error while removing its details', async (_name, handler) => {
        const failure = Object.assign(new Error('PRIVATE_EXCEPTION'), {
            statusCode: 500, code: 'INTERNAL_FAILURE', details: { trace: 'PRIVATE_DETAILS' }
        });
        failAtBoundary(failure);
        const res = response();
        await handler(request(), res);
        expect(res.statusCode).toBe(500);
        expect(res.body.code || res.body.error).toBe('INTERNAL_FAILURE');
        expect(JSON.stringify(res.body)).not.toMatch(/PRIVATE_|details|stack/i);
        expect(log.mock.calls.some(args => args.includes(failure))).toBe(true);
    });

    test.each([['hold', sample.getSampleHolds], ['workspace', sample.getSampleWorkspace]])(
        '%s keeps an expected 4xx message and code', async (_name, handler) => {
            failAtBoundary(Object.assign(new Error('A user-correctable rule violation.'), { statusCode: 422, code: 'EXPECTED_RULE' }));
            const res = response();
            await handler(request(), res);
            expect(res.statusCode).toBe(422);
            expect(res.body).toEqual({ code: 'EXPECTED_RULE', error: 'A user-correctable rule violation.' });
            expect(log).not.toHaveBeenCalled();
        });

    test('a delegated expected intake payload is returned unchanged', async () => {
        const payload = { success: false, code: 'EXPECTED_RULE', error: 'Correct the intake.', details: { field: 'sampleType' } };
        failAtBoundary(Object.assign(new Error(payload.error), { statusCode: 422, code: payload.code, payload }));
        const res = response();
        await reception.processIntake(request(), res);
        expect(res.statusCode).toBe(422);
        expect(res.body).toEqual(payload);
    });

    test('a server intake payload retains its envelope/code without exposing error payload fields', async () => {
        failAtBoundary(Object.assign(new Error('PRIVATE_EXCEPTION'), { statusCode: 500, code: 'INTERNAL_FAILURE',
            payload: { success: false, code: 'INTERNAL_FAILURE', error: 'PRIVATE_ERROR', message: 'PRIVATE_MESSAGE',
                details: 'PRIVATE_DETAILS', stack: 'PRIVATE_STACK' } }));
        const res = response();
        await reception.processIntake(request(), res);
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ success: false, code: 'INTERNAL_FAILURE', error: 'Internal server error', message: 'Internal server error' });
    });

    test('client and server workflow contracts remain byte-identical, including compatibility aliases', () => {
        const root = path.resolve(__dirname, '../../..');
        const server = fs.readFileSync(path.join(root, 'server/workflowContract.js'), 'utf8').replace(/\r\n/g, '\n');
        const client = fs.readFileSync(path.join(root, 'client/src/utils/workflowContract.js'), 'utf8').replace(/\r\n/g, '\n');
        expect(client).toBe(server);
    });
});
