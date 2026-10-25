jest.mock('../../prisma_client', () => ({
    ...jest.requireActual('../../prisma_client'),
    PrismaClient: jest.fn(() => ({
        $transaction: jest.fn(),
        $executeRawUnsafe: jest.fn(),
        lab: { findUnique: jest.fn() },
        sample: {},
        workItem: {}
    }))
}));
jest.mock('../../prisma', () => require('../../utils/prismaClientIdentity').createRootClient({}));
jest.mock('../../wsServer', () => ({ broadcastToLab: jest.fn() }));
jest.mock('../../services/qcRunViewService', () => ({
    QC_RUN_INCLUDE: {},
    batchApiView: batch => ({ ...batch, history: [] })
}));

const root = require('../../prisma');
const { createRootClient, extendRootClient, registerRootClient, isRootClient } = require('../../utils/prismaClientIdentity');
const rules = require('../../services/workflowStateRules');
const intake = require('../../services/intakeService');
const workGeneration = require('../../services/intakeWorkItemService');
const sampleCodes = require('../../services/sampleCodeService');
const consignments = require('../../services/consignmentNumberService');
const evidence = require('../../services/resultEvidenceService');
const gates = require('../../services/operationalGateStateService');
const lifecycle = require('../../services/labLifecycleService');
const operations = require('../../services/operationalConfirmationService');
const nativeRuns = require('../../services/qcNativeRunService');
const audit = require('../../services/qcRunAuditService');
const { broadcastToLab } = require('../../wsServer');

const actor = { id: 'actor', username: 'reviewer', role: 'SUPER_ADMIN', labId: 'LAB' };
const sample = { id: 'sample', assignedLab: 'LAB', status: 'PROCESSING', dryingStatus: 'DONE' };
const databaseBoundary = new Error('synthetic database boundary');

// Prisma's newer interactive clients can start nested transactions. None of the
// services below should call that method when the caller already owns the tx.
function nestedClient() {
    return {
        $transaction: jest.fn(() => { throw new Error('Unexpected nested transaction'); }),
        $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
        $queryRawUnsafe: jest.fn(),
        lab: { findUnique: jest.fn().mockRejectedValue(databaseBoundary) },
        sample: { findUnique: jest.fn().mockResolvedValue(null) },
        workItem: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
        result: { findMany: jest.fn().mockResolvedValue([]) }
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    root.$transaction.mockReset();
    root.$executeRawUnsafe.mockResolvedValue(undefined);
    root.lab.findUnique.mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());

test('root detection uses identity even when root capabilities change', () => {
    const transactionMethod = root.$transaction;
    delete root.$transaction;
    try {
        expect(isRootClient(root)).toBe(true);
        expect(isRootClient(nestedClient())).toBe(false);
        expect(isRootClient(null)).toBe(false);
    } finally { root.$transaction = transactionMethod; }
});

test('independent constructed roots retain transaction boundaries and cannot pass a transaction guard', async () => {
    const independent = createRootClient({});
    const tx = nestedClient();
    independent.$transaction.mockImplementation(execute => execute(tx));
    expect(isRootClient(independent)).toBe(true);
    expect(() => rules.requireTransaction(independent)).toThrow('Removal requires');
    await rules.inTransaction(independent, inner => expect(inner).toBe(tx));
    expect(independent.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
});

test('module isolation does not change the identity of an existing root client', () => {
    jest.isolateModules(() => {
        const reloaded = require('../../utils/prismaClientIdentity');
        expect(reloaded.isRootClient(root)).toBe(true);
        expect(reloaded.isRootClient(nestedClient())).toBe(false);
    });
});

test('an explicitly constructed root adapter keeps its identity and opens one transaction', async () => {
    const tx = nestedClient();
    const adapter = { ...nestedClient(), $transaction: jest.fn(execute => execute(tx)) };
    expect(registerRootClient(adapter)).toBe(adapter);
    expect(isRootClient(adapter)).toBe(true);
    expect(() => rules.requireTransaction(adapter)).toThrow('Removal requires');
    await rules.inTransaction(adapter, inner => expect(inner).toBe(tx));
    expect(adapter.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
});

test('public root extensions are registered without wrapping either caller or transaction', async () => {
    const independent = createRootClient({});
    const tx = nestedClient();
    const extended = { ...nestedClient(), $transaction: jest.fn(execute => execute(tx)) };
    const extension = { query: {} };
    independent.$extends = jest.fn(() => extended);
    expect(extendRootClient(independent, extension)).toBe(extended);
    expect(independent.$extends).toHaveBeenCalledWith(extension);
    expect(isRootClient(extended)).toBe(true);
    expect(() => rules.requireTransaction(extended)).toThrow('Removal requires');
    await rules.inTransaction(extended, inner => expect(inner).toBe(tx));
    expect(extended.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
});

test('a nested-capable transaction is never registered by the root extension factory', () => {
    const tx = nestedClient();
    tx.$extends = jest.fn();
    expect(() => extendRootClient(tx, {})).toThrow('A registered root client is required');
    expect(tx.$extends).not.toHaveBeenCalled();
    expect(isRootClient(tx)).toBe(false);
});

const requiredPaths = [
    ['workflow removal', tx => rules.requireTransaction(tx), 'WORKFLOW_TRANSACTION_REQUIRED', null],
    ['intake', tx => intake.requireTransaction(tx), 'INTAKE_TRANSACTION_REQUIRED', null],
    ['work generation', tx => workGeneration.generate(tx, sample), 'INTAKE_TRANSACTION_REQUIRED', 'SAMPLE_NOT_FOUND'],
    ['sample allocation', tx => sampleCodes.allocateSampleCode(tx, { labReference: 'LAB' }), 'SAMPLE_CODE_TRANSACTION_REQUIRED', databaseBoundary],
    ['container allocation', tx => sampleCodes.allocateContainerCode(tx, { labReference: 'LAB' }), 'SAMPLE_CODE_TRANSACTION_REQUIRED', databaseBoundary],
    ['consignment allocation', tx => consignments.allocateConsignmentNumber(tx, { labReference: 'LAB' }), 'CONSIGNMENT_TRANSACTION_REQUIRED', databaseBoundary],
    ['preparation evidence', tx => evidence.recordPreparationRevert(tx, sample, 'DRYING', 'Correction', actor), 'EVIDENCE_TRANSACTION_REQUIRED', null],
    ['reviewed gate', tx => gates.resetReviewedGate({ id: 'gate', analysis: 'DRYING' }, actor, 'Correction', tx), 'EVIDENCE_TRANSACTION_REQUIRED', 'GATE_REVIEW_REQUIRED']
];

describe.each(requiredPaths)('%s requires the caller transaction', (_name, invoke, code, downstream) => {
    test.each([['root', root], ['missing', null]])('still refuses the %s client', async (_kind, client) => {
        await expect(Promise.resolve().then(() => invoke(client))).rejects.toMatchObject({ code });
    });

    test('accepts a transaction exposing $transaction without wrapping or nesting it', async () => {
        const tx = nestedClient();
        const result = Promise.resolve().then(() => invoke(tx));
        if (downstream === databaseBoundary) await expect(result).rejects.toBe(databaseBoundary);
        else if (downstream) await expect(result).rejects.toMatchObject({ code: downstream });
        else await result;
        expect(tx.$transaction).not.toHaveBeenCalled();
        expect(root.$transaction).not.toHaveBeenCalled();
    });
});

test('workflow nesting opens one root transaction and retains the exact outer client', async () => {
    const tx = nestedClient();
    root.$transaction.mockImplementation(execute => execute(tx));
    const result = await rules.inTransaction(null, outer => rules.inTransaction(outer, inner => {
        expect(inner).toBe(tx);
        rules.requireTransaction(inner);
        return 'committed';
    }));
    expect(result).toBe('committed');
    expect(root.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
    expect(() => rules.requireTransaction({ $transaction: tx.$transaction })).toThrow('Removal requires');
});

test('native run creation reuses the outer audit transaction', async () => {
    const tx = nestedClient();
    root.$transaction.mockImplementation(execute => execute(tx));
    await expect(nativeRuns.buildNativeRun(root, actor, { workItemIds: ['missing'] }))
        .rejects.toMatchObject({ code: 'WORKITEM_NOT_FOUND' });
    expect(root.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
});

test('nested QC commands share one identity-keyed collector and flush one audit pair', async () => {
    const tx = nestedClient();
    let status = 'BEFORE';
    tx.batch = { findUnique: jest.fn().mockResolvedValue({ id: 'batch', status: 'OPEN' }) };
    tx.workItem.findMany.mockImplementation(async () => [{ id: 'work', batchId: 'batch', status }]);
    tx.batchQcResult = { findMany: jest.fn().mockResolvedValue([]) };
    tx.auditLog = { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) };
    tx.batchEvent = { create: jest.fn().mockResolvedValue({}) };
    root.$transaction.mockImplementation(execute => execute(tx));

    await audit.withQcAudit(root, { actor, batchId: 'batch', operation: 'OUTER' }, async outer => {
        await audit.withQcAudit(outer, { actor, batchId: 'batch', operation: 'INNER' }, async inner => {
            expect(inner).toBe(tx);
            status = 'AFTER';
            await audit.recordBatchAudit(inner, 'batch', { reason: 'Nested correction' });
            return {};
        });
        expect(tx.auditLog.create).not.toHaveBeenCalled();
        expect(tx.batchEvent.create).not.toHaveBeenCalled();
        return {};
    });

    expect(root.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.batchEvent.create).toHaveBeenCalledTimes(1);
    const written = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(written).toMatchObject({ operation: 'OUTER', reason: 'Nested correction', changes: [
        { entity: 'WorkItem', id: 'work', before: { status: 'BEFORE' }, after: { status: 'AFTER' } }
    ] });
    await expect(audit.recordBatchAudit(tx, 'batch', {})).rejects.toThrow('outer command transaction');
});

test.each(['confirmOperation', 'verifyOperation'])('%s broadcasts only after its own root boundary', async command => {
    const tx = nestedClient();
    const outcome = { sample, receipt: { analysis: 'DRYING' }, workItem: { status: 'COMPLETED' }, analysis: 'DRYING', status: 'COMPLETED' };
    jest.spyOn(rules, 'inTransaction').mockResolvedValue(outcome);
    const input = { actor, workItemId: 'gate', decision: 'ACCEPT' };
    await operations[command]({ ...input, db: tx });
    expect(broadcastToLab).not.toHaveBeenCalled();
    await operations[command]({ ...input, db: root });
    expect(broadcastToLab).toHaveBeenCalledTimes(1);
    expect(tx.$transaction).not.toHaveBeenCalled();
});

test.each(['third', 'fourth'])('workspace %s-argument transaction overload retains the supplied client', async position => {
    const tx = nestedClient();
    tx.lab.findUnique.mockResolvedValue(null);
    const call = position === 'third'
        ? lifecycle.getLabWorkspace(actor, 'missing', tx)
        : lifecycle.getLabWorkspace(actor, 'missing', { search: 'sample' }, tx);
    await expect(call).rejects.toMatchObject({ code: 'LAB_NOT_FOUND' });
    expect(tx.lab.findUnique).toHaveBeenCalledTimes(1);
    expect(root.lab.findUnique).not.toHaveBeenCalled();
    expect(tx.$transaction).not.toHaveBeenCalled();
});
