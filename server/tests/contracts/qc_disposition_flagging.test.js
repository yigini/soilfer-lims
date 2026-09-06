const prisma = require('../../prisma');
const qcService = require('../../services/qcService');
const qcController = require('../../controllers/qcController');

describe('WP-29: QC Service & Batch Disposition Result Flagging', () => {
    let testBatchId;
    let testSampleId;
    let testResultId;

    beforeEach(async () => {
        testBatchId = `BATCH-TEST-${Date.now()}`;
        testSampleId = `SMP-QC-${Date.now()}`;
        testResultId = `RES-QC-${Date.now()}`;

        // Create sample
        await prisma.sample.create({
            data: {
                id: testSampleId,
                originalId: `ORIG-${testSampleId}`,
                status: 'PROCESSING',
                labId: 'LAB-TEST',
                assignedLab: 'LAB-TEST'
            }
        });

        // Create result attached to batchId
        await prisma.result.create({
            data: {
                id: testResultId,
                sampleId: testSampleId,
                param: 'PH',
                value: '7.20',
                numericValue: 7.20,
                unit: 'pH_units',
                isValid: true,
                batchId: testBatchId
            }
        });

        // Create batch
        await prisma.batch.create({
            data: {
                id: testBatchId,
                labId: 'LAB-TEST',
                analysis: 'PH',
                status: 'OPEN',
                createdBy: 'test_tech'
            }
        });
    });

    afterEach(async () => {
        await prisma.batchQcResult.deleteMany({ where: { batchId: testBatchId } });
        await prisma.result.deleteMany({ where: { batchId: testBatchId } });
        await prisma.batch.deleteMany({ where: { id: testBatchId } });
        await prisma.sample.deleteMany({ where: { id: testSampleId } });
    });

    test('1. qcService accurately computes blank threshold, duplicate RPD, and control recovery', () => {
        // Blank evaluation
        const blankPass = qcService.evaluateBlank({ value: 0.02, maxAllowed: 0.05 });
        expect(blankPass.status).toBe('PASS');
        const blankFail = qcService.evaluateBlank({ value: 0.08, maxAllowed: 0.05 });
        expect(blankFail.status).toBe('FAIL');

        // Duplicate evaluation
        const dupPass = qcService.evaluateDuplicate({ value1: 10.0, value2: 10.5, maxRpd: 10.0 });
        expect(dupPass.status).toBe('PASS');
        const dupFail = qcService.evaluateDuplicate({ value1: 10.0, value2: 15.0, maxRpd: 10.0 });
        expect(dupFail.status).toBe('FAIL');

        // Control evaluation
        const crmPass = qcService.evaluateControl({ expected: 100.0, measured: 98.0, minRecovery: 90.0, maxRecovery: 110.0 });
        expect(crmPass.status).toBe('PASS');
        const crmFail = qcService.evaluateControl({ expected: 100.0, measured: 75.0, minRecovery: 90.0, maxRecovery: 110.0 });
        expect(crmFail.status).toBe('FAIL');
    });

    test('2. A batch evaluated as QC_FAIL creates typed BatchQcResult rows and flags associated results', async () => {
        const req = {
            params: { id: testBatchId },
            body: {
                blanks: [{ value: 0.12, maxAllowed: 0.05, label: 'Reagent Blank' }], // FAILS
                controls: [{ expected: 100, measured: 99, label: 'Standard CRM' }]  // PASSES
            },
            user: { username: 'test_tech', role: 'LAB_TECHNICIAN', labId: 'LAB-TEST' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        await qcController.evaluateBatch(req, res);
        expect(res.json).toHaveBeenCalled();

        // 1. Verify typed BatchQcResult rows created
        const typedRows = await prisma.batchQcResult.findMany({ where: { batchId: testBatchId } });
        expect(typedRows.length).toBe(2);
        expect(typedRows.some(r => r.type === 'BLANK' && r.status === 'FAIL')).toBe(true);

        // 2. Verify Result carrying this batchId is flagged
        const flaggedResult = await prisma.result.findUnique({ where: { id: testResultId } });
        expect(flaggedResult.isValid).toBe(false);
        const flags = JSON.parse(flaggedResult.flags || '[]');
        expect(flags).toContain('QC_BATCH_FAILED');
    });

    test('3. Manager disposition with PROCEED_WITH_WARNING overrides fail and restores result validity', async () => {
        // First, mark batch as QC_FAIL and flag results
        await prisma.batch.update({ where: { id: testBatchId }, data: { status: 'QC_FAIL' } });
        await qcService.flagBatchResults(prisma, testBatchId, 'QC_FAIL');

        const req = {
            params: { id: testBatchId },
            body: {
                decision: 'PROCEED_WITH_WARNING',
                reason: 'Blank contamination negligible relative to high analyte concentration'
            },
            user: { username: 'lab_mgr', role: 'LAB_MANAGER', labId: 'LAB-TEST' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        await qcController.dispositionBatch(req, res);
        expect(res.json).toHaveBeenCalled();

        // Verify result flags updated
        const restoredResult = await prisma.result.findUnique({ where: { id: testResultId } });
        expect(restoredResult.isValid).toBe(true);
        const flags = JSON.parse(restoredResult.flags || '[]');
        expect(flags).not.toContain('QC_BATCH_FAILED');
        expect(flags).toContain('QC_WARNING_OVERRIDDEN');
    });
});
